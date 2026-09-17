# 4V6F performance report

The 38,137,644-byte official source contains 307,345 atom rows. A lightweight source scan completes in 1,735ms, but that is not a canonical application import. Three canonical attempts exceeded 20 minutes and were cancelled after approximately 0.8–2.6 GiB Node memory, including after parser and streaming-hash optimizations. The upload-policy regression passes with a 512 MiB ceiling; the remaining blocker is canonical identity construction.
