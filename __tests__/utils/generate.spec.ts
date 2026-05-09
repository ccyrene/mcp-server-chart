import { describe, expect, it } from "vitest";
import { generateChartUrl } from "../../src/utils/generate";

describe("generateChartUrl", () => {
  it("returns a base64 PNG data URI for a real chart spec", async () => {
    const uri = await generateChartUrl("bar", {
      data: [
        { category: "A", value: 10 },
        { category: "B", value: 25 },
        { category: "C", value: 17 },
      ],
    });
    expect(uri).toMatch(/^data:image\/png;base64,/);

    const b64 = uri.slice("data:image/png;base64,".length);
    const buf = Buffer.from(b64, "base64");
    // PNG magic number: 89 50 4E 47
    expect(buf.subarray(0, 4).toString("hex")).toBe("89504e47");
    expect(buf.length).toBeGreaterThan(1000);
  }, 30_000);

  it("renders different chart types into valid PNG", async () => {
    const types: Array<{ type: string; opts: Record<string, unknown> }> = [
      {
        type: "line",
        opts: {
          data: [
            { time: "2020", value: 100 },
            { time: "2021", value: 120 },
          ],
        },
      },
      {
        type: "pie",
        opts: {
          data: [
            { category: "A", value: 50 },
            { category: "B", value: 50 },
          ],
        },
      },
    ];
    for (const { type, opts } of types) {
      const uri = await generateChartUrl(type, opts);
      const buf = Buffer.from(
        uri.slice("data:image/png;base64,".length),
        "base64",
      );
      expect(buf.subarray(0, 4).toString("hex")).toBe("89504e47");
    }
  }, 60_000);

  // NOTE: we deliberately do NOT assert how generateChartUrl behaves on a
  // bad spec — gpt-vis-ssr's error path emits an unhandled rejection deep
  // in @antv/g2 instead of throwing the awaited promise, which makes the
  // assertion flaky. callTool.spec.ts covers the agent-facing error
  // contract (Zod rejects bad input before reaching the renderer at all).
});
