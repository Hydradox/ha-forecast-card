import { describe, expect, it } from "vitest";
import { moveItem } from "../src/utils/reorder";

describe("moveItem", () => {
  it("moves an item forward and backward", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("ignores out-of-range moves and does not mutate", () => {
    const list = ["a", "b"];
    expect(moveItem(list, 1, 2)).toEqual(["a", "b"]);
    expect(moveItem(list, -1, 0)).toEqual(["a", "b"]);
    expect(list).toEqual(["a", "b"]);
  });
});
