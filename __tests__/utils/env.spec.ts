import { afterEach, describe, expect, it } from "vitest";
import { getDisabledTools } from "../../src/utils/env";

describe("env", () => {
  it("default disabled tools", () => {
    process.env.DISABLED_TOOLS = undefined;
    expect(getDisabledTools()).toEqual([]);
  });

  it("parse disabled tools from env", () => {
    process.env.DISABLED_TOOLS = "generate_fishbone_diagram,generate_mind_map";
    expect(getDisabledTools()).toEqual([
      "generate_fishbone_diagram",
      "generate_mind_map",
    ]);
  });

  it("handle empty disabled tools env", () => {
    process.env.DISABLED_TOOLS = "";
    expect(getDisabledTools()).toEqual([]);
  });

  afterEach(() => {
    process.env.DISABLED_TOOLS = undefined;
  });
});
