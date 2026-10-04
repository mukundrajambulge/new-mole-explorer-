# Full-pose validation protocol status

**Protocol execution: BLOCKED before state binding.** The integrated task requires deterministic direct-versus-grid evaluation of every pose against the same sealed receptor, ligand, SearchRegion and scoring-field state. Fixture preparation stopped because the frozen source/profile does not resolve A/B alternatives at ASN68, ASP72, and ARG76. No eligible sealed states or pose inputs exist, and no cohort was materialized.

The requested cohort classes remain: crystallographic pose; controlled translations; controlled rotations; combined perturbations; grid-phase/alignment cases; and cutoff-stress cases. No transform magnitudes, axes, acceptance thresholds or pose IDs were invented in the absence of the task's sealed-state inputs and canonical protocol detail.

If the preconditions become executable within this task, the run must record for each pose both direct and interpolated five-term raw values, weighted values, E_inter, term/total deltas, scorer torsion quantity, corrected score where applicable, cutoff-stress classification, and exact boundary/OOD disposition. Direct/grid evaluations must consume the same sealed pose and state digests, and grid OOD must fail closed without direct fallback.

The current PHD-V2-13 `1e-10`/`1e-12` comparators are engineering/backend equivalence tolerances for specified comparisons. Current PHD-V2 acceptance amendments explicitly leave direct-versus-grid approximation error and ranking thresholds unapproved. Any future completed run must report distributions and evidence without converting those engineering tolerances into a new scientific gate.
