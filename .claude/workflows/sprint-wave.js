export const meta = {
  name: 'sprint-wave',
  description: 'Token-safe sprint wave: lanes in parallel, tasks in sequence per lane, risk-tiered review and fixes, output tokens reserved before every agent call',
  whenToUse: 'Launch with the args in docs/sprint/next-wave.json (made by `node scripts/sprint/sprint.mjs plan`). Always add a "+<N>k" budget directive equal to capOutputTokens.',
  phases: [
    { title: 'Implement', detail: 'one lane engineer per task, isolated worktree, model by task tier' },
    { title: 'Review', detail: '1 reviewer (2 for high-risk tasks)' },
    { title: 'Fix', detail: 'at most 1 fix round (2 for high-risk), only for blocking issues' },
  ],
}

// ---- Token guard: reservation accounting ------------------------------------------------------
// The runtime makes agent() throw once budget.total (from the "+Nk" directive) is reached. We stop
// well before that: work only starts if its ESTIMATE fits in CAP (85% of the hard limit) after
// counting what is already spent AND what running tasks have reserved. That stays correct when
// lanes run concurrently. The 15% margin absorbs estimates that turn out low.
const START = budget.spent() // spent() counts the whole turn; measure only this workflow
const HARD = budget.total ? budget.total - START : (args.capOutputTokens || 300000)
const CAP = Math.floor(HARD * 0.85)
const used = () => budget.spent() - START
let reserved = 0
const reserve = (n) => { if (used() + reserved + n > CAP) return false; reserved += n; return true }
const release = (n) => { reserved = Math.max(0, reserved - n) }

const EST = { S: 12000, M: 35000, L: 80000, general: 6000, risk: 12000 }
const implEst = (t) => EST[t.size] || EST.M
const reviewEst = (t) => t.lenses.reduce((s, l) => s + EST[l], 0)

const WAVE = args.wave
const BASE = args.base || 'main'
const short = (s, n) => ((s || '').length > n ? s.slice(0, n - 1) + '…' : (s || ''))
const branchOf = (t) => `sprint/${WAVE}/${t.id}`

const RESULT = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['DONE', 'PARTIAL', 'BLOCKED'] },
    summary: { type: 'string', maxLength: 700 },
    filesChanged: { type: 'array', items: { type: 'string' }, maxItems: 40 },
    outsideOwnedFiles: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    checkSummary: { type: 'string', maxLength: 400, description: 'the PASS/FAIL/RESULT lines from check.mjs' },
    blocker: { type: 'string', maxLength: 300 },
  },
  required: ['status', 'summary', 'filesChanged', 'checkSummary'],
}
const VERDICT = {
  type: 'object',
  properties: {
    issues: { type: 'array', maxItems: 8, items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string', maxLength: 160 }, detail: { type: 'string', maxLength: 300 } }, required: ['severity', 'detail'] } },
  },
  required: ['issues'],
}

const brief = (t) => `Task ${t.id} [lane ${t.lane}, ${t.size}/${t.risk}]: ${t.title}
What: ${t.what}
How (guidance): ${t.how}
Done when: ${t.done}
Owned files: ${t.owns}
Read these first (then use Grep, not broad reading): ${t.contextFiles.join(', ')}
Checks: node scripts/sprint/check.mjs ${t.checkFlags}${t.design ? '\nDesign note:\n' + t.design : ''}`

const implement = (t, base, issues) => agent(`${brief(t)}

Follow the implementer protocol and token rules in CLAUDE.md.
${issues
    ? `FIX ROUND: git switch ${branchOf(t)}. Fix only these blocking items:\n${JSON.stringify(issues)}`
    : `Create the branch: git switch -c ${branchOf(t)} ${base}`}`,
{ label: `${issues ? 'fix' : 'impl'}:${t.id}`, phase: issues ? 'Fix' : 'Implement', agentType: t.agentType, model: t.model, effort: t.effort, isolation: 'worktree', schema: RESULT })

const review = (t, impl) => Promise.all(t.lenses.map((lens) => agent(
  `Review ${branchOf(t)} against ${BASE} (git diff --stat ${BASE}...${branchOf(t)} first, then only the hunks you need).
${brief(t)}
Implementer: ${short(impl.summary, 500)}
Checks: ${short(impl.checkSummary, 300)}`,
  { label: `review:${t.id}:${lens}`, phase: 'Review', agentType: lens === 'risk' ? 'reviewer-risk' : 'reviewer', effort: t.risk === 'low' ? 'low' : lens === 'risk' ? 'high' : 'medium', schema: VERDICT }))).then((v) => v.filter(Boolean))

async function runTask(t, base) {
  const first = implEst(t) + reviewEst(t)
  if (!reserve(first)) return { id: t.id, lane: t.lane, status: 'DEFERRED_BUDGET' }
  let impl = await implement(t, base, null)
  release(implEst(t))
  if (!impl || impl.status === 'BLOCKED') { release(reviewEst(t)); return { id: t.id, lane: t.lane, status: impl ? 'BLOCKED' : 'FAILED', note: impl ? short(impl.blocker, 300) : 'implementer did not return' } }
  for (let round = 0; ; round++) {
    const verdicts = await review(t, impl)
    release(reviewEst(t))
    const blocking = verdicts.flatMap((v) => v.issues).filter((i) => i.severity !== 'minor')
    const checksOk = /all checks passed/i.test(impl.checkSummary || '')
    if (!blocking.length && checksOk && impl.status === 'DONE' && verdicts.length === t.lenses.length) {
      return { id: t.id, lane: t.lane, status: 'READY', branch: branchOf(t), summary: short(impl.summary, 400), rounds: round, minorIssues: verdicts.flatMap((v) => v.issues).length }
    }
    const fixCost = Math.round(implEst(t) * 0.5) + reviewEst(t)
    if (round >= t.maxFix || !reserve(fixCost)) {
      return { id: t.id, lane: t.lane, status: impl.status === 'PARTIAL' ? 'PARTIAL' : 'NEEDS_OWNER', branch: branchOf(t), summary: short(impl.summary, 400), blocking: blocking.slice(0, 5), checks: short(impl.checkSummary, 300), note: round < t.maxFix ? 'fix not started: token cap' : undefined }
    }
    const fixed = await implement(t, base, { blocking, checks: impl.checkSummary, partial: impl.status === 'PARTIAL' })
    release(Math.round(implEst(t) * 0.5))
    if (!fixed || fixed.status === 'BLOCKED') { release(reviewEst(t)); return { id: t.id, lane: t.lane, status: fixed ? 'BLOCKED' : 'FAILED', branch: branchOf(t), note: fixed ? short(fixed.blocker, 300) : 'fixer did not return' } }
    impl = fixed
  }
}

// Lanes in parallel; tasks inside a lane in order, each branching from the lane's last READY task.
const lanes = []
for (const t of args.tasks) {
  let g = lanes.find((x) => x.lane === t.lane)
  if (!g) { g = { lane: t.lane, tasks: [] }; lanes.push(g) }
  g.tasks.push(t)
}
log(`wave ${WAVE}: ${args.tasks.length} tasks in ${lanes.length} lanes; cap ${Math.round(CAP / 1000)}k output tokens (hard ${Math.round(HARD / 1000)}k)`)
const laneResults = await pipeline(lanes, async (g) => {
  const out = []
  let base = BASE
  for (const [i, t] of g.tasks.entries()) {
    const r = await runTask(t, base)
    out.push(r)
    if (r.status === 'READY') base = r.branch
    if (r.status === 'DEFERRED_BUDGET') { g.tasks.slice(i + 1).forEach((x) => out.push({ id: x.id, lane: x.lane, status: 'DEFERRED_BUDGET' })); break }
  }
  return out
})
const tasks = laneResults.filter(Boolean).flat().filter(Boolean)
const spent = used()
log(`spent ${Math.round(spent / 1000)}k of ${Math.round(CAP / 1000)}k; ready ${tasks.filter((t) => t.status === 'READY').length}/${tasks.length}`)
return { wave: WAVE, base: BASE, spentOutputTokens: spent, capOutputTokens: CAP, readyBranches: tasks.filter((t) => t.status === 'READY').map((t) => t.branch), tasks }
