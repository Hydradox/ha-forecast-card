/**
 * Remembers the last call: while every argument is the same (`===`), returns the same result. Lets a render
 * hand child elements the same objects and functions, so they see nothing changed and skip their own update.
 */
export function memoizeOne<Args extends unknown[], Result>(fn: (...args: Args) => Result): (...args: Args) => Result {
  let last: { args: Args; result: Result } | undefined;
  return (...args: Args): Result => {
    if (last && last.args.length === args.length && last.args.every((arg, index) => arg === args[index])) return last.result;
    last = { args, result: fn(...args) };
    return last.result;
  };
}
