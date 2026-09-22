# R10 F MACRO BATCH REPORT

Status: PASS_BOUNDED_DAG. MacroDefinition is immutable/versioned, validates unique nodes and acyclic dependencies, bounds nodes/iterations, supports deterministic foreach values, and exposes STOP_ON_ERROR versus CONTINUE_WITH_RECORDED_FAILURES. Implicit child-macro recursion is rejected. Async work uses exactly Created/Queued/Running/Completed/Failed/Cancelled durable states; retry creates a new execution attempt and preserves the failed attempt record.
