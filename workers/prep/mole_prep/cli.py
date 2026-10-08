"""One-shot preparation CLI (task 5.2). Run with cwd = job directory:

  python -I <worker>/run_prep.py --plan            reads job.json, writes plan.json (no structure output)
  python -I <worker>/run_prep.py --apply           reads job.json, plan.json, confirmation.json; writes out/* and prep-manifest.json

Exit codes: 0 READY/PREPARED, 3 BLOCKED (plan.json / prep-manifest.json say why), 2 usage or job file error, 1 internal error.
The worker never seals anything; the API re-hashes every output and seals with server-side profiles.
"""
from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import sys

from . import limits
from .limits import Blocked

ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
OPTION_KEYS = {"pH", "protonation", "ligandProtonation", "chainIds", "keepWaters", "addMissingAtoms"}


class JobError(Exception):
    pass


def _strict(obj, keys: set, required: set, what: str) -> dict:
    if not isinstance(obj, dict):
        raise JobError(f"{what} must be an object")
    extra = set(obj) - keys
    missing = required - set(obj)
    if extra or missing:
        raise JobError(f"{what}: unexpected {sorted(extra)} / missing {sorted(missing)}")
    return obj


def _artifact(obj, what: str, formats) -> dict:
    _strict(obj, {"artifactId", "relPath", "format"}, {"artifactId", "relPath", "format"}, what)
    if not isinstance(obj["artifactId"], str) or not ID_RE.match(obj["artifactId"]):
        raise JobError(f"{what}.artifactId is invalid")
    if obj["format"] not in formats:
        raise JobError(f"{what}.format is not supported")
    return obj


def load_job(root: str) -> dict:
    try:
        raw = limits.read_capped(limits.confined(root, "job.json"), "job file")
        job = json.loads(raw.decode("utf-8"), parse_constant=lambda c: (_ for _ in ()).throw(JobError("NaN/Infinity not allowed")))
    except Blocked as b:
        raise JobError(b.diagnostic()) from None
    except (ValueError, UnicodeDecodeError) as e:
        raise JobError(f"job.json is not valid JSON: {type(e).__name__}") from None
    _strict(job, {"schemaVersion", "jobId", "receptor", "ligand", "ligandTemplate", "options"}, {"schemaVersion", "jobId", "receptor", "ligand", "options"}, "job")
    if job["schemaVersion"] != 1 or not isinstance(job["jobId"], str) or not ID_RE.match(job["jobId"]):
        raise JobError("job.schemaVersion/jobId invalid")
    _artifact(job["receptor"], "receptor", ("pdb",))
    _artifact(job["ligand"], "ligand", ("sdf", "mol", "mol2", "smi", "pdb"))
    if job.get("ligandTemplate") is not None:
        _artifact(job["ligandTemplate"], "ligandTemplate", ("smi",))
    o = _strict(job["options"], OPTION_KEYS, OPTION_KEYS, "options")
    ph = o["pH"]
    if isinstance(ph, bool) or not isinstance(ph, (int, float)) or not (0 <= ph <= 14):
        raise JobError("options.pH must be a finite number in [0, 14]")
    if o["protonation"] not in ("EXPLICIT_SUBMITTED", "PROPKA_PREVIEW") or o["ligandProtonation"] not in ("EXPLICIT_SUBMITTED", "DIMORPHITE_PREVIEW"):
        raise JobError("options protonation choice invalid")
    if o["chainIds"] is not None and (not isinstance(o["chainIds"], list) or len(o["chainIds"]) > 16 or not all(isinstance(c, str) and len(c) == 1 and c.isalnum() for c in o["chainIds"])):
        raise JobError("options.chainIds must be null or up to 16 single-character chain ids")
    if not all(isinstance(o[k], bool) for k in ("keepWaters", "addMissingAtoms")):
        raise JobError("options flags must be booleans")
    return job


def options_of(job: dict) -> dict:
    o = dict(job["options"])
    o["pH"] = float(o["pH"])
    o["ligandTemplate"] = job.get("ligandTemplate") is not None
    return o


def run_pipeline(root: str, job: dict) -> dict:
    from . import ligand, receptor

    from .manifest import sha256_bytes

    opts = options_of(job)
    rec_raw = limits.read_capped(limits.confined(root, job["receptor"]["relPath"]), "receptor")
    lig_raw = limits.read_capped(limits.confined(root, job["ligand"]["relPath"]), "ligand")
    tpl_raw = None
    if job.get("ligandTemplate") is not None:
        tpl_raw = limits.read_capped(limits.confined(root, job["ligandTemplate"]["relPath"]), "ligand template")
    # Digests of exactly the bytes this run used (they enter planDigest).
    inputs = {"receptorSha256": sha256_bytes(rec_raw), "ligandSha256": sha256_bytes(lig_raw), "ligandTemplateSha256": None if tpl_raw is None else sha256_bytes(tpl_raw)}
    rec_text = limits.decode_ascii(rec_raw, "receptor")
    lig_text = limits.decode_ascii(lig_raw, "ligand")
    tpl = None if tpl_raw is None else limits.decode_ascii(tpl_raw, "ligand template")
    lig = ligand.prepare(lig_text, job["ligand"]["format"], tpl, opts)
    rec = receptor.prepare(rec_text, opts, os.path.join(root, "work"))
    return {"rec": rec, "lig": lig, "opts": opts, "inputs": inputs}


def input_digests(root: str, job: dict) -> dict:
    """sha256 of every submitted input file as read now (None when unreadable; the pipeline then BLOCKs)."""
    from .manifest import sha256_bytes

    def one(art):
        if art is None:
            return None
        try:
            return sha256_bytes(limits.read_capped(limits.confined(root, art["relPath"]), "input"))
        except Blocked:
            return None

    return {"receptorSha256": one(job["receptor"]), "ligandSha256": one(job["ligand"]), "ligandTemplateSha256": one(job.get("ligandTemplate"))}


def build_plan(job: dict, result: dict | None, blocked: Blocked | None, inputs: dict | None = None) -> dict:
    from .manifest import PROFILE_ID, lock_digest, plan_digest

    opts = options_of(job)
    preview = opts["protonation"] == "PROPKA_PREVIEW" or opts["ligandProtonation"] == "DIMORPHITE_PREVIEW"
    plan = {
        "schemaVersion": 1, "jobId": job["jobId"], "receptorArtifactId": job["receptor"]["artifactId"], "ligandArtifactId": job["ligand"]["artifactId"],
        "pH": opts["pH"], "protonationSource": opts["protonation"], "chargeModel": "gasteiger", "tautomer": "AS_SUBMITTED", "rotatableBonds": 0,
        "decisions": [], "warnings": [], "status": "BLOCKED", "diagnostics": [], "profileId": PROFILE_ID,
        "qualification": "PREVIEW_UNQUALIFIED" if preview else "INTERIM", "options": opts, "lockDigest": lock_digest(),
    }
    if inputs is not None:
        # Part of planDigest: an input swapped between --plan and --apply yields PLAN_DIGEST_MISMATCH.
        plan["inputs"] = inputs
    if result is not None:
        rec, lig = result["rec"], result["lig"]
        plan["decisions"] = (rec["decisions"] + lig["decisions"])[:200]
        plan["warnings"] = [limits.scrub(w) for w in rec["warnings"] + lig["warnings"]][:100]
        plan["rotatableBonds"] = lig["torsions"]
        plan["tautomer"] = lig["tautomer"]
        plan["protonationSource"] = rec["protonationSource"]
        plan["status"] = "READY"
        # Owner rule: ANY generated hydrogens, charges states or coordinates -> PREVIEW_UNQUALIFIED.
        if preview or rec["generated"] or lig["generated"]:
            plan["qualification"] = "PREVIEW_UNQUALIFIED"
    if blocked is not None:
        plan["diagnostics"] = [blocked.diagnostic()]
    plan["planDigest"] = plan_digest(plan, plan["lockDigest"])
    return plan


def _compute(root: str, job: dict):
    try:
        with contextlib.redirect_stdout(sys.stderr):
            result = run_pipeline(root, job)
        return result, build_plan(job, result, None, result["inputs"])
    except Blocked as b:
        return None, build_plan(job, None, b, input_digests(root, job))


def cmd_plan(root: str, job: dict) -> int:
    from .manifest import write_json

    _, plan = _compute(root, job)
    write_json(root, "plan.json", plan)
    print(json.dumps({"status": plan["status"], "planDigest": plan["planDigest"]}))
    return 0 if plan["status"] == "READY" else 3


def _blocked_manifest(job: dict, plan: dict | None, diags: list[str]) -> dict:
    from .manifest import PROFILE_ID, lock_digest

    m = {"schemaVersion": 1, "jobId": job["jobId"], "status": "BLOCKED", "stages": [], "outputs": [], "diagnostics": [limits.scrub(d) for d in diags][:100],
         "lockDigest": lock_digest(), "profileId": PROFILE_ID}
    if plan is not None:
        m["planDigest"] = plan["planDigest"]
    return m


def cmd_apply(root: str, job: dict) -> int:
    from .manifest import lock_digest, profile_digest, write_atomic, write_json

    def finish(manifest):
        write_json(root, "prep-manifest.json", manifest)
        print(json.dumps({"status": manifest["status"]}))
        return 0 if manifest["status"] == "PREPARED" else 3

    try:
        stored = json.loads(limits.read_capped(limits.confined(root, "plan.json"), "plan").decode("ascii"))
        conf = json.loads(limits.read_capped(limits.confined(root, "confirmation.json"), "confirmation").decode("ascii"))
        _strict(conf, {"jobId", "planDigest", "acks"}, {"jobId", "planDigest", "acks"}, "confirmation")
        if not isinstance(conf["acks"], list) or len(conf["acks"]) > 32 or not all(isinstance(a, str) and 0 < len(a) <= 64 for a in conf["acks"]):
            raise JobError("confirmation.acks invalid")
    except (Blocked, JobError, ValueError, UnicodeDecodeError) as e:
        return finish(_blocked_manifest(job, None, [f"CONFIRMATION_INVALID: {e.diagnostic() if isinstance(e, Blocked) else type(e).__name__}"]))
    result, plan = _compute(root, job)
    if conf["jobId"] != job["jobId"] or conf["planDigest"] != plan["planDigest"] or stored.get("planDigest") != plan["planDigest"]:
        return finish(_blocked_manifest(job, plan, ["PLAN_DIGEST_MISMATCH: the confirmed plan is not the plan this job would run"]))
    if plan["status"] != "READY":
        return finish(_blocked_manifest(job, plan, plan["diagnostics"]))
    required = {d["key"] for d in plan["decisions"] if d["requiresAck"]}
    known = {d["key"] for d in plan["decisions"]}
    acks = set(conf["acks"])
    if not required <= acks:
        return finish(_blocked_manifest(job, plan, [f"ACK_MISSING: {','.join(sorted(required - acks))}"]))
    if not acks <= known:
        return finish(_blocked_manifest(job, plan, [f"ACK_UNKNOWN: {','.join(sorted(acks - known))[:300]}"]))
    rec, lig, opts = result["rec"], result["lig"], result["opts"]
    files = [
        ("RECEPTOR_PDBQT", "out/receptor.pdbqt", rec["pdbqt"].encode("ascii")),
        ("RECEPTOR_CLEAN", "out/receptor.clean.pdb", rec["clean_pdb"].encode("ascii")),
        ("CANONICAL_JSON", "out/receptor.canonical.json", None),
        ("LIGAND_PDBQT", "out/ligand.pdbqt", lig["pdbqt"].encode("ascii")),
        ("LIGAND_CLEAN", "out/ligand.clean.sdf", lig["sdf"].encode("ascii")),
        ("CANONICAL_JSON", "out/ligand.canonical.json", None),
    ]
    outputs = []
    for role, rel, data in files:
        if data is None:
            entry = write_json(root, rel, rec["canonical"] if rel.startswith("out/receptor") else lig["canonical"])
        else:
            entry = write_atomic(root, rel, data)
        outputs.append({"role": role, **entry})
    lock = lock_digest()
    manifest = {
        "schemaVersion": 1, "jobId": job["jobId"], "status": "PREPARED", "stages": (rec["stages"] + lig["stages"])[:16], "outputs": outputs,
        "diagnostics": plan["warnings"], "planDigest": plan["planDigest"], "lockDigest": lock, "profileId": plan["profileId"],
        "profileDigest": profile_digest(opts, lock), "qualification": plan["qualification"],
        "summary": {
            "protonationSource": plan["protonationSource"], "ligandProtonation": opts["ligandProtonation"], "chargeModel": "gasteiger",
            "rotatableBonds": lig["torsions"], "receptorAtoms": rec["atoms"], "ligandAtoms": lig["atoms"],
            "receptorHydrogensSubmitted": rec["hSubmitted"], "receptorHydrogensAdded": rec["hAdded"], "ligandHydrogensAdded": lig["hAdded"],
            "ligandFormalCharge": lig["formalCharge"], "ligandEmbedded3d": lig["embedded"],
        },
    }
    return finish(manifest)


def main(argv=None) -> int:
    limits.harden_process()
    p = argparse.ArgumentParser(prog="mole_prep", add_help=True)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--plan", action="store_true")
    g.add_argument("--apply", action="store_true")
    args = p.parse_args(argv)
    root = os.getcwd()
    try:
        limits.check_determinism_env()
        job = load_job(root)
    except (JobError, Blocked) as e:
        print(limits.scrub(f"JOB_INVALID: {e.diagnostic() if isinstance(e, Blocked) else e}"), file=sys.stderr)
        return 2
    try:
        return cmd_plan(root, job) if args.plan else cmd_apply(root, job)
    except Exception as e:  # internal error: scrubbed one-liner, no traceback paths
        print(limits.scrub(f"INTERNAL_ERROR: {type(e).__name__}: {e}"), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
