import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { callTool } from "../../src/utils/callTool";

describe("callTool error paths", () => {
  it("throws MethodNotFound for an unknown tool name", async () => {
    await expect(callTool("not_a_real_tool", {})).rejects.toMatchObject({
      code: ErrorCode.MethodNotFound,
    });
  });

  it("throws MethodNotFound for an arbitrary string", async () => {
    await expect(callTool("", {})).rejects.toThrow(McpError);
  });

  it("throws InvalidParams when required fields are missing", async () => {
    await expect(
      callTool("generate_bar_chart", {
        // `data` is required by the bar chart schema.
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.InvalidParams,
    });
  });

  it("throws InvalidParams when fields have wrong types", async () => {
    await expect(
      callTool("generate_bar_chart", {
        data: "not-an-array",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.InvalidParams,
    });
  });
});

describe("callTool — removed map tools (regression)", () => {
  // The 3 map tools were removed in sec/strip-remote-rendering because
  // they required a remote geo-tile backend with no local-SSR equivalent.
  // These tests guard against accidental re-introduction.
  const REMOVED_MAP_TOOLS = [
    "generate_district_map",
    "generate_path_map",
    "generate_pin_map",
  ];

  for (const tool of REMOVED_MAP_TOOLS) {
    it(`rejects "${tool}" with MethodNotFound`, async () => {
      await expect(callTool(tool, {})).rejects.toMatchObject({
        code: ErrorCode.MethodNotFound,
      });
    });
  }
});

describe("callTool — resource-exhaustion guards (regression)", () => {
  // base.ts caps width/height at 4000 px. A request that asks for a
  // 100 000 × 100 000 canvas should be rejected at the schema layer
  // BEFORE the renderer is invoked. Otherwise one bad call OOMs the
  // container.
  it("rejects oversized width", async () => {
    await expect(
      callTool("generate_bar_chart", {
        data: [{ category: "A", value: 1 }],
        width: 100_000,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
  });

  it("rejects oversized height", async () => {
    await expect(
      callTool("generate_bar_chart", {
        data: [{ category: "A", value: 1 }],
        height: 100_000,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
  });

  it("rejects width below minimum (avoid 0/negative canvas)", async () => {
    await expect(
      callTool("generate_bar_chart", {
        data: [{ category: "A", value: 1 }],
        width: 0,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
  });

  it("rejects oversized title (memory/log bloat)", async () => {
    await expect(
      callTool("generate_bar_chart", {
        data: [{ category: "A", value: 1 }],
        title: "x".repeat(10_000),
      }),
    ).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
  });

  it("network-graph: rejects too many nodes", async () => {
    const nodes = Array.from({ length: 1_000 }, (_, i) => ({
      name: `n${i}`,
    }));
    await expect(
      callTool("generate_network_graph", { data: { nodes, edges: [] } }),
    ).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
  });

  it("flow-diagram: rejects too many edges", async () => {
    const edges = Array.from({ length: 5_000 }, (_, i) => ({
      source: "a",
      target: "b",
      name: `e${i}`,
    }));
    await expect(
      callTool("generate_flow_diagram", {
        data: { nodes: [{ name: "a" }, { name: "b" }], edges },
      }),
    ).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
  });
});

describe("callTool happy path (smoke)", () => {
  it("returns a chart-shaped result for a valid bar chart", async () => {
    const res = await callTool("generate_bar_chart", {
      data: [
        { category: "A", value: 10 },
        { category: "B", value: 25 },
      ],
    });
    expect(res).toMatchObject({
      content: [{ type: "text" }],
      _meta: { spec: { type: "bar" } },
    });
    // biome-ignore lint/suspicious/noExplicitAny: indexing dynamic shape
    const text = (res as any).content[0].text as string;
    expect(text.startsWith("data:image/png;base64,")).toBe(true);
  }, 30_000);
});
