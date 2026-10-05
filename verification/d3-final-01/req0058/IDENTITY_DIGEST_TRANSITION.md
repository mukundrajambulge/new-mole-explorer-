# Prepared-Receptor Identity Digest Transition

## Values

| Item | Previous incomplete state | Corrected state |
|---|---|---|
| State version | `D2_PREPARED_RECEPTOR_STATE_V1` | `D2_PREPARED_RECEPTOR_STATE_V2` |
| Prepared receptor digest | `sha256:cc8556b9e66fc8baedcff42ac72a56da5ac18cedd2f65a065054e667366c2a06` | `sha256:226761376a4fbb3d361d3fe6b4e677f53986e2c36cc4f4ca0d4dc0ef34dbe76d` |
| Prepared ligand digest | `sha256:65e8b07631df6cc83800b31bf7682b420fce282cadaf3b2427973260b5e851a1` | unchanged |
| SearchRegion digest | `sha256:690c208e99f9cf467662c071e6934abe01950b0d2e22f7753b5cc5e2ee5b1f2d` | `sha256:c7065c614847781cb6c20456d43a3f69ac48520cc1fc11e5b35c010575198117` |

The receptor digest changed because the canonical-CBOR payload now includes three required scientific profile references and uses the V2 receptor-state digest domain. The SearchRegion digest changed because it binds the prepared-receptor digest. The ligand digest is unchanged because REQ-0058 applies to PreparedReceptorState and the ligand contract was already separate and satisfied.

The profile set and new receptor seal replay exactly in `replay/D2_SEAL_DIGEST_REPLAY_VALIDATION.json`. The corrected state carries identical graph, identity, chemical-state and coordinate-state digests to the source-built replay inputs; heavy-atom additions, deletions, remappings, bond changes, and coordinate-bit changes remain zero. The scorer/typing assignment, profiles, geometry and numerical outputs are unchanged.

The former hash must be called the **old incomplete identity digest**. It must not be used as the canonical digest for the corrected contract.
