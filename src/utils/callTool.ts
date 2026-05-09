import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as Charts from "../charts";
import { generateChartUrl } from "./generate";
import { logger } from "./logger";
import { ValidateError } from "./validator";

// Chart type mapping. Map tools (district / path / pin) were removed
// because they required a geo-tile backend that cannot run in-process.
const CHART_TYPE_MAP = {
  generate_area_chart: "area",
  generate_bar_chart: "bar",
  generate_boxplot_chart: "boxplot",
  generate_column_chart: "column",
  generate_dual_axes_chart: "dual-axes",
  generate_fishbone_diagram: "fishbone-diagram",
  generate_flow_diagram: "flow-diagram",
  generate_funnel_chart: "funnel",
  generate_histogram_chart: "histogram",
  generate_line_chart: "line",
  generate_liquid_chart: "liquid",
  generate_mind_map: "mind-map",
  generate_network_graph: "network-graph",
  generate_organization_chart: "organization-chart",
  generate_pie_chart: "pie",
  generate_radar_chart: "radar",
  generate_sankey_chart: "sankey",
  generate_scatter_chart: "scatter",
  generate_treemap_chart: "treemap",
  generate_venn_chart: "venn",
  generate_violin_chart: "violin",
  generate_waterfall_chart: "waterfall",
  generate_word_cloud_chart: "word-cloud",
  generate_spreadsheet: "spreadsheet",
} as const;

// Pre-compile Zod schemas at module load time to avoid recompiling on every request.
// biome-ignore lint/suspicious/noExplicitAny: schema types vary per chart
const COMPILED_SCHEMA_CACHE = new Map<string, z.ZodObject<any>>();
for (const chartType of Object.values(CHART_TYPE_MAP)) {
  const schema = Charts[chartType as keyof typeof Charts]?.schema;
  if (schema) {
    COMPILED_SCHEMA_CACHE.set(chartType, z.object(schema));
  }
}

/**
 * Call a tool to generate a chart based on the provided name and arguments.
 * @param tool The name of the tool to call, e.g., "generate_area_chart".
 * @param args The arguments for the tool, which should match the expected schema for the chart type.
 * @returns
 */
export async function callTool(tool: string, args: object = {}) {
  logger.info(`Calling tool: ${tool}`);
  const chartType = CHART_TYPE_MAP[tool as keyof typeof CHART_TYPE_MAP];

  if (!chartType) {
    logger.error(`Unknown tool: ${tool}`);
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${tool}.`);
  }

  try {
    // Validate input using Zod before sending to API.
    // Use pre-compiled schema from cache to avoid recompiling on every call.
    const compiledSchema = COMPILED_SCHEMA_CACHE.get(chartType);

    if (compiledSchema) {
      // Use safeParse instead of parse and try-catch.
      const result = compiledSchema.safeParse(args);
      if (!result.success) {
        logger.error(`Invalid parameters: ${result.error.message}`);
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid parameters: ${result.error.message}`,
        );
      }
    }

    const url = await generateChartUrl(chartType, args);
    logger.info(`Generated chart URL: ${url.slice(0, 64)}…`);

    return {
      content: [
        {
          type: "text",
          text: url,
        },
      ],
      _meta: {
        description:
          "The content returned by MCP is an inline base64 PNG (data:image/png;base64,…) of the visualization chart, rendered locally by @antv/gpt-vis-ssr. The _meta.spec content corresponds to the chart's configuration and spec, which can be rendered using AntV GPT-Vis chart components.",
        spec: { type: chartType, ...args },
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  } catch (error: any) {
    logger.error(
      `Failed to generate chart: ${error.message || "Unknown error"}.`,
    );
    if (error instanceof McpError) throw error;
    if (error instanceof ValidateError)
      throw new McpError(ErrorCode.InvalidParams, error.message);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to generate chart: ${error?.message || "Unknown error."}`,
    );
  }
}
