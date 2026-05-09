import { z } from "zod";

// ── Resource-bound constants ──────────────────────────────────────────
// These caps protect the renderer from request-driven OOM / DoS. Each
// chart call allocates a (W × H × 4 bytes) canvas and walks every node /
// edge / cell, so unbounded inputs translate into unbounded memory.
//
// The numbers were picked to stay generous for legitimate analytics
// use cases — well above any chart a human will actually look at —
// while finite enough that a malicious caller cannot crash the
// container with one request.
const MIN_DIM = 50;
const MAX_DIM = 4000; // 4000 × 4000 × 4 B ≈ 64 MB raw canvas
const MAX_TITLE_LEN = 200;
const MAX_NODE_NAME_LEN = 200;
const MAX_PALETTE_ENTRIES = 64;

// Define Zod schemas for base configuration properties
export const ThemeSchema = z
  .enum(["default", "academy", "dark"])
  .optional()
  .default("default")
  .describe("Set the theme for the chart, optional, default is 'default'.");

export const BackgroundColorSchema = z
  .string()
  .max(64)
  .optional()
  .describe("Background color of the chart, such as, '#fff'.");

export const PaletteSchema = z
  .array(z.string().max(64))
  .max(MAX_PALETTE_ENTRIES)
  .optional()
  .describe("Color palette for the chart, it is a collection of colors.");

export const TextureSchema = z
  .enum(["default", "rough"])
  .optional()
  .default("default")
  .describe(
    "Set the texture for the chart, optional, default is 'default'. 'rough' refers to hand-drawn style.",
  );
export const StartAtZeroSchema = z
  .boolean()
  .optional()
  .default(false)
  .describe("Whether to start the axis at zero, optional, default is false.");

export const WidthSchema = z
  .number()
  .int()
  .min(MIN_DIM)
  .max(MAX_DIM)
  .optional()
  .default(600)
  .describe(
    `Set the width of chart in pixels, ${MIN_DIM}–${MAX_DIM}. Default is 600.`,
  );

export const HeightSchema = z
  .number()
  .int()
  .min(MIN_DIM)
  .max(MAX_DIM)
  .optional()
  .default(400)
  .describe(
    `Set the height of chart in pixels, ${MIN_DIM}–${MAX_DIM}. Default is 400.`,
  );

export const TitleSchema = z
  .string()
  .max(MAX_TITLE_LEN)
  .optional()
  .default("")
  .describe("Set the title of chart.");

export const AxisXTitleSchema = z
  .string()
  .max(MAX_TITLE_LEN)
  .optional()
  .default("")
  .describe("Set the x-axis title of chart.");

export const AxisYTitleSchema = z
  .string()
  .max(MAX_TITLE_LEN)
  .optional()
  .default("")
  .describe("Set the y-axis title of chart.");

export const NodeSchema = z.object({
  name: z.string().min(1).max(MAX_NODE_NAME_LEN),
});

export const EdgeSchema = z.object({
  source: z.string().min(1).max(MAX_NODE_NAME_LEN),
  target: z.string().min(1).max(MAX_NODE_NAME_LEN),
  name: z.string().max(MAX_NODE_NAME_LEN).optional().default(""),
});

// NOTE: the Map* / POI / DistrictName / Style schemas that previously
// lived here were deleted along with the map tools (district / path /
// pin) in sec/strip-remote-rendering — they required a remote geo-tile
// backend with no local-SSR equivalent. If you re-introduce maps in a
// future fork, restore those schemas here.
