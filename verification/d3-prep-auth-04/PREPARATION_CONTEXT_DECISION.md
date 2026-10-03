# Preparation pH/context and prepared-state interpretation

## Source context

The DEC04 source freeze reports a crystal-growth condition of pH 6.9 and 277 K with 2.0–2.2 M K/Na phosphate, 5 mM BME, and 5 mM oxidized BME. RCSB describes complexes as obtained by soaking or vapor diffusion but the reviewed 3DMX evidence does not identify which route applies to this occurrence or provide a separate ligand-binding/soak solution pH.

## Proposed use

Declare:

- target_pH: 6.9;
- context: crystal-growth-condition proxy;
- context uncertainty: ligand-soak/binding-solution pH and 3DMX preparation route not reported;
- state policy: use the explicit residue-state map in CHEMICAL_STATE_DECISION.md; do not ask a predictor to choose states;
- interpretation: one candidate receptor ChemicalState at a declared evidence-backed proxy context, not an experimentally determined binding-state microstate.

The pH is a named input to this candidate profile; it is not evidence that the deposited receptor was protonated at pH 6.9 during ligand binding. A later analysis that requires an experimentally established binding-solution pH cannot cite this profile for that claim.

## Owner decision

AUTH04-02 in OWNER_DECISION_PACKET.md asks the owner to approve or replace the use of pH 6.9 as a crystallization-context proxy and the associated per-residue state map, including explicit GLU128 disposition and reconciliation of the 49-versus-51 source count. YES accepts only this explicit profile context and fully enumerated state. NO blocks preparation. An alternative pH, residue state, cap, construct, disulfide, or chemical-state method requires a new explicit profile version and decision; it must not be silently substituted during execution.
