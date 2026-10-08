export const meta = {
  name: 'nightly-audit',
  description: 'Token-capped audit of the day\'s merged changes: 2 lenses, then 1 skeptic per serious finding',
  whenToUse: 'Each evening after the merge to main, once the script checks (check.mjs --smoke, perf, science) have been run by the main session. Pass {since} and add "+80k"',
  phases: [{ title: 'Audit' }, { title: 'Confirm' }],
}
const START = budget.spent() // spent() counts the whole turn; measure only this workflow
const HARD = budget.total ? budget.total - START : (80000)
const CAP = Math.floor(HARD * 0.85)
const used = () => budget.spent() - START
const fits = (e) => used() + e <= CAP
const SINCE = args.since || 'HEAD~1'
const FIND = { type: 'object', properties: { findings: { type: 'array', maxItems: 6, items: { type: 'object', properties: { file: { type: 'string', maxLength: 160 }, severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }, title: { type: 'string', maxLength: 140 }, scenario: { type: 'string', maxLength: 300 } }, required: ['file', 'severity', 'title', 'scenario'] } } }, required: ['findings'] }
const VOTE = { type: 'object', properties: { real: { type: 'boolean' }, why: { type: 'string', maxLength: 200 } }, required: ['real', 'why'] }
const lenses = [
  ['reviewer-risk', 'security and scientific correctness'],
  ['reviewer', 'reliability, performance on large structures, and test gaps'],
]
const found = []
for (const [type, focus] of lenses) {
  if (!fits(12000)) { log(`token cap: skipped lens "${focus}"`); continue }
  found.push(agent(`Audit only the changes in ${SINCE}..main (git diff --stat first, then path-limited diffs) for ${focus}. Report only concrete defects with a failure scenario.`,
    { label: `audit:${type}`, phase: 'Audit', agentType: type, effort: 'medium', schema: FIND }))
}
const all = (await Promise.all(found)).filter(Boolean).flatMap((r) => r.findings)
const seen = new Set()
const unique = all.filter((f) => { const k = (f.file + f.title).toLowerCase(); return seen.has(k) ? false : seen.add(k) })
const serious = unique.filter((f) => f.severity === 'critical' || f.severity === 'high')
const confirmed = []
for (const f of serious) {
  if (!fits(4000)) { log(`token cap: ${serious.length - confirmed.length} serious findings left unconfirmed`); break }
  const v = await agent(`Check on main whether this is a real defect. Default real=false if you cannot confirm it.\n${JSON.stringify(f)}`,
    { label: `confirm:${f.file}`, phase: 'Confirm', agentType: 'reviewer', effort: 'low', schema: VOTE })
  if (v && v.real) confirmed.push(f)
}
return { since: SINCE, confirmed, unconfirmedMediumLow: unique.filter((f) => !serious.includes(f)), spent: used() }
