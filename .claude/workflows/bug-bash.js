export const meta = {
  name: 'bug-bash',
  description: 'Token-capped week-3 bug hunt: 4 focused finders, up to 3 rounds until a dry round, one reproduction per bug',
  whenToUse: 'Days 17-20 on the frozen build. Add a budget directive (for example "+250k")',
  phases: [{ title: 'Find' }, { title: 'Reproduce' }],
}
const START = budget.spent() // spent() counts the whole turn; measure only this workflow
const HARD = budget.total ? budget.total - START : (250000)
const CAP = Math.floor(HARD * 0.85)
const used = () => budget.spent() - START
const fits = (e) => used() + e <= CAP
const REF = args.ref || 'main'
const BUGS = { type: 'object', properties: { bugs: { type: 'array', maxItems: 6, items: { type: 'object', properties: { title: { type: 'string', maxLength: 140 }, steps: { type: 'string', maxLength: 400 }, actual: { type: 'string', maxLength: 200 }, severity: { type: 'string', enum: ['demo-breaking', 'high', 'medium', 'low'] } }, required: ['title', 'steps', 'actual', 'severity'] } } }, required: ['bugs'] }
const VOTE = { type: 'object', properties: { reproduced: { type: 'boolean' }, evidence: { type: 'string', maxLength: 300 } }, required: ['reproduced', 'evidence'] }
const FINDERS = [
  'the golden docking path: 1IEP load, prepare, box, run, results, downloads, cancel',
  'API edge cases on the docking and project routes: malformed or huge input, wrong ids, concurrent and cancel races',
  'large-structure behaviour: 4V6F load, hover, select, colour, tab switches',
  'file formats: every tests/fixtures/rcsb entry as PDB and as mmCIF',
]
const key = (b) => b.title.toLowerCase().replace(/\W+/g, ' ').trim()
const seen = new Set(), confirmed = []
for (let round = 1; round <= 3; round++) {
  const finds = []
  for (const [i, f] of FINDERS.entries()) {
    if (!fits(15000)) break
    finds.push(agent(`Bug hunt round ${round} on ${REF} in your worktree (npm ci; start what you need; use curl or a short Playwright script; follow the token rules). Focus: ${f}. Skip known bugs: ${[...seen].slice(-40).join('; ')}`,
      { label: `find:r${round}:${i + 1}`, phase: 'Find', model: 'sonnet', effort: 'medium', isolation: 'worktree', schema: BUGS }))
  }
  const fresh = (await Promise.all(finds)).filter(Boolean).flatMap((r) => r.bugs).filter((b) => !seen.has(key(b)))
  if (!fresh.length) { log(`round ${round}: dry; stopping`); break }
  fresh.forEach((b) => seen.add(key(b)))
  for (const b of fresh.sort((x, y) => ['demo-breaking', 'high', 'medium', 'low'].indexOf(x.severity) - ['demo-breaking', 'high', 'medium', 'low'].indexOf(y.severity))) {
    if (!fits(5000)) { log('token cap: remaining bugs not reproduced'); break }
    const v = await agent(`Reproduce on ${REF} in your worktree. reproduced=false unless you saw it.\n${JSON.stringify(b)}`,
      { label: `repro:${key(b).slice(0, 24)}`, phase: 'Reproduce', agentType: 'verifier', isolation: 'worktree', schema: VOTE })
    if (v && v.reproduced) confirmed.push({ ...b, evidence: v.evidence })
  }
  if (!fits(15000)) { log('token cap reached; ending bug bash'); break }
}
return { ref: REF, bugs: confirmed, spent: used() }
