# Console

Click **Command Console** to expand the bottom panel. Commands are tokenized before dispatch, so semicolons split only at the top level and nested parentheses remain part of a selection expression. A batch reports the command that failed and stops safely; malformed nesting is rejected. Unsafe Python, shell, process, arbitrary filesystem, and arbitrary network commands are rejected.
