export const meta = {
  name: 're-audit',
  description: 'Token-capped before/after check of the 76 health-report findings, grouped by code area (about 10 agents)',
  whenToUse: 'Day 19 after code freeze. Pass {groups: [{area, findings: [{id, title, where}]}]} and add "+150k"',
  phases: [{ title: 'Check' }],
}
const START = budget.spent() // spent() counts the whole turn; measure only this workflow
const HARD = budget.total ? budget.total - START : (150000)
const CAP = Math.floor(HARD * 0.85)
const used = () => budget.spent() - START
const fits = (e) => used() + e <= CAP
const OUT = { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['FIXED', 'PARTLY', 'OPEN'] }, evidence: { type: 'string', maxLength: 200 } }, required: ['id', 'status', 'evidence'] } } }, required: ['results'] }
const jobs = []
for (const g of args.groups) {
  if (!fits(12000)) { log(`token cap: area ${g.area} not checked`); jobs.push(Promise.resolve({ results: g.findings.map((f) => ({ id: f.id, status: 'OPEN', evidence: 'not checked (token cap)' })) })); continue }
  jobs.push(agent(`On main, for each finding decide FIXED, PARTLY or OPEN. Look at the cited location (code may have moved: use Grep) and any test that covers it. Be strict: FIXED only if fully resolved. Read-only.\nArea: ${g.area}\n${g.findings.map((f) => `- ${f.id}: ${f.title} (was ${f.where})`).join('\n')}`,
    { label: `check:${g.area}`, phase: 'Check', agentType: 'reviewer', effort: 'medium', schema: OUT }))
}
const results = (await Promise.all(jobs)).filter(Boolean).flatMap((r) => r.results)
const n = (s) => results.filter((r) => r.status === s).length
return { summary: { fixed: n('FIXED'), partly: n('PARTLY'), open: n('OPEN') }, results, spent: used() }
