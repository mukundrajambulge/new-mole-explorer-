# Slice C — Console batch tokenizer

The command console now splits semicolon-delimited batches only at top level. Semicolons inside single or double quotes, brace-delimited label expressions, and parenthesized selection expressions are retained as data. Unbalanced delimiters report a one-based character span and execute nothing from the malformed batch.

For a valid batch, each command passes independently through the same console dispatcher and canonical command ledger. Results are summarized in execution order. A capability-level failure stops later commands and reports the completed count.

Verification:

- `src/commands/batchTokenizer.test.ts`: 3 passed.
- `AT-FSR-C-001`: browser verification of `select polymer; show sticks, all`, including rendered stick cylinders, plus malformed-parenthesis rejection.
