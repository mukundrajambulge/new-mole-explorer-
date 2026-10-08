export const meta = {
  name: 'design-note',
  description: 'Lean design for a heavy task: two independent designs, one senior judge writes the final note (3 agents, token-capped)',
  whenToUse: 'Before L-size or high-risk tasks such as 5.2, 5.3, 5.4, 5.7a, 7.3 or 7.5. Pass {task} from backlog.json and add a "+60k" budget directive',
  phases: [{ title: 'Design' }, { title: 'Decide' }],
}
const START = budget.spent() // spent() counts the whole turn; measure only this workflow
const HARD = budget.total ? budget.total - START : (60000)
const CAP = Math.floor(HARD * 0.85)
const used = () => budget.spent() - START
const fits = (e) => used() + e <= CAP
const t = args.task
const DESIGN = { type: 'object', properties: { design: { type: 'string', maxLength: 3500, description: 'files, interfaces, data flow, steps, tests, risks' } }, required: ['design'] }
const brief = `Task ${t.id}: ${t.title}\nWhat: ${t.what}\nDone when: ${t.done}\nOwned files: ${t.owns}\nStart from: ${t.contextFiles.join(', ')} (Grep for anything else). Produce a design only; no code changes.`
const angles = ['simplest design that fully meets "done when" in this sprint', 'design that gets failure handling, limits, security and provenance right first']
const designs = []
for (const [i, a] of angles.entries()) {
  if (!fits(8000)) { log('token cap: skipping remaining designs'); break }
  designs.push(agent(`${brief}\nAngle: ${a}.`, { label: `design:${i + 1}`, phase: 'Design', model: 'sonnet', effort: 'medium', schema: DESIGN }))
}
const done = (await Promise.all(designs)).filter(Boolean)
if (!done.length) return { task: t.id, note: null, reason: 'token cap reached before any design' }
if (!fits(10000)) return { task: t.id, note: done[0].design, reason: 'judge skipped: token cap' }
const note = await agent(`${brief}\nTwo candidate designs follow. Write the final design note (at most 60 lines of markdown): pick the better base, graft clearly better ideas from the other, list files, interfaces, step order, test plan and risks.\n\n${done.map((d, i) => `## Design ${i + 1}\n${d.design}`).join('\n\n')}`,
  { label: 'decide', phase: 'Decide', model: 'opus', effort: 'high' })
return { task: t.id, note }
