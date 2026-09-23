export type CommandBatch = { commands: readonly string[]; error?: { message: string; start: number; end: number } };

/** Splits only top-level semicolons; selection and label expressions stay intact. */
export const tokenizeCommandBatch = (input: string): CommandBatch => {
  const commands: string[] = [];
  let start = 0;
  let quote = "";
  let braces = 0;
  let parens = 0;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (character === "{") braces += 1;
    else if (character === "}") { if (braces === 0) return { commands, error: { message: "Unexpected closing brace.", start: index, end: index + 1 } }; braces -= 1; }
    else if (character === "(") parens += 1;
    else if (character === ")") { if (parens === 0) return { commands, error: { message: "Unexpected closing parenthesis.", start: index, end: index + 1 } }; parens -= 1; }
    else if (character === ";" && braces === 0 && parens === 0) {
      const command = input.slice(start, index).trim();
      if (command) commands.push(command);
      start = index + 1;
    }
  }
  if (quote) return { commands, error: { message: "Unterminated quoted string.", start: start, end: input.length } };
  if (braces) return { commands, error: { message: "Unterminated brace expression.", start: start, end: input.length } };
  if (parens) return { commands, error: { message: "Unterminated parenthesized expression.", start: start, end: input.length } };
  const command = input.slice(start).trim();
  if (command) commands.push(command);
  return { commands };
};
