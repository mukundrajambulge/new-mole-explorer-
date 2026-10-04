"""Small strict mmCIF loop reader for the sealed 3DMX/BNZ execution adapter."""

from __future__ import annotations

import shlex
from dataclasses import dataclass
from typing import Iterator


@dataclass(frozen=True)
class CifLoop:
    headers: tuple[str, ...]
    rows: tuple[tuple[str, ...], ...]


def _tokens(text: str) -> Iterator[str]:
    """Tokenize CIF quoting/comments plus semicolon-delimited text fields."""
    lines = text.splitlines()
    index = 0
    while index < len(lines):
        line = lines[index]
        if line.startswith(";"):
            index += 1
            block: list[str] = []
            while index < len(lines) and not lines[index].startswith(";"):
                block.append(lines[index])
                index += 1
            if index >= len(lines):
                raise ValueError("unterminated CIF semicolon text field")
            index += 1
            yield "\n".join(block)
            continue
        lexer = shlex.shlex(line, posix=True)
        lexer.whitespace_split = True
        lexer.commenters = "#"
        yield from lexer
        index += 1


def read_loops(raw: bytes) -> tuple[CifLoop, ...]:
    text = raw.decode("utf-8", errors="strict")
    tokens = list(_tokens(text))
    loops: list[CifLoop] = []
    cursor = 0
    while cursor < len(tokens):
        if tokens[cursor].lower() != "loop_":
            cursor += 1
            continue
        cursor += 1
        headers: list[str] = []
        while cursor < len(tokens) and tokens[cursor].startswith("_"):
            headers.append(tokens[cursor])
            cursor += 1
        if not headers:
            raise ValueError("CIF loop has no data names")
        values: list[str] = []
        while cursor < len(tokens):
            at_row_boundary = len(values) % len(headers) == 0
            token = tokens[cursor]
            if at_row_boundary and (
                token.lower() == "loop_"
                or token.lower().startswith("data_")
                or token.lower().startswith("save_")
                or token.startswith("_")
            ):
                break
            values.append(token)
            cursor += 1
        if len(values) % len(headers):
            raise ValueError(
                f"CIF loop row width mismatch for {headers[0]}: "
                f"{len(values)} value tokens for {len(headers)} columns"
            )
        rows = tuple(
            tuple(values[offset : offset + len(headers)])
            for offset in range(0, len(values), len(headers))
        )
        loops.append(CifLoop(tuple(headers), rows))
    return tuple(loops)


def find_loop(loops: tuple[CifLoop, ...], prefix: str) -> CifLoop:
    matches = [loop for loop in loops if any(header.startswith(prefix) for header in loop.headers)]
    if len(matches) != 1:
        raise ValueError(f"expected one loop for {prefix}, found {len(matches)}")
    return matches[0]


def rows_by_header(loop: CifLoop) -> list[dict[str, str]]:
    return [dict(zip(loop.headers, row, strict=True)) for row in loop.rows]
