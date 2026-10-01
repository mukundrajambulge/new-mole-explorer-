# 181L construct decision

## Finding

**Proposed disposition: HOLD pending owner and structural-biologist resolution.**

The digital 181L record has a 164-residue polymer sequence and explicitly annotates Thr54, Ala97, and Ala99 in places where UniProt P00720 has Cys54, Cys97, and Leu99. The public RCSB summary currently labels the entry “Mutation(s): No,” which conflicts with those detailed annotations. Morton and Matthews (1995) describe the L99A cavity system. Later primary literature describes a C54T/C97A background for T4 lysozyme cavity mutants and includes L99A. This supports a likely triple-substitution interpretation; it does not establish the construct actually present in the 181L diffraction sample.

Evidence:
- Current deposited mmCIF is frozen and hashed in 181L_SOURCE_IDENTITY_FREEZE.md.
- Official entry and revision history: https://www.rcsb.org/structure/181L and https://www.wwpdb.org/pdb?id=pdb_0000181l
- Primary 181L publication: Morton & Matthews, Biochemistry 1995, DOI 10.1021/bi00027a007, https://pubmed.ncbi.nlm.nih.gov/7612599/
- Earlier L99A cavity study: DOI 10.1126/science.1553543, https://escholarship.org/uc/item/4vx635v5
- Later primary context for C54T/C97A background: https://pmc.ncbi.nlm.nih.gov/articles/PMC2664309/
- Detailed prior source review: D3-IR-01 construct assessment and D3-RA-01 report, linked from D3_PREP_DEC_01_REPORT.md.

## Decision boundary

The construct is part of molecular identity. Do not choose the experimental receptor as “wild type,” “L99A,” or “C54T/C97A/L99A” on an engineering preference or literature probability. The owner and structural biologist must either provide a source record tying the 181L experiment to a specific sequence/clone/sample or explicitly decide that the deposited digital model alone defines a narrow in-silico case and accept the resulting limitation. Any such disposition must state whether it changes the proposed case's scientific interpretation. This decision package cannot make that choice for them.

## Required review questions

1. Can the original clone, plasmid, laboratory construct, or archived sample record for the 181L diffraction experiment be recovered?
2. Which sequence should define the receptor identity for this case: the deposited 181L entity sequence, a named construct from primary records, or another exact sequence?
3. How should the contradiction between the public summary (“Mutation(s): No”) and detailed residue-difference annotations be resolved?
4. Is a digitally defined deposited model acceptable for a development-only scoring fixture if the experimental genotype cannot be verified? If so, record the limitation and owner acceptance explicitly.

Until these questions are resolved and documented, DEC-02 remains pending and preparation is scientifically inadmissible.