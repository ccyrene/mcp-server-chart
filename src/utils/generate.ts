import http from "node:http";
import https from "node:https";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { render } from "@antv/gpt-vis-ssr";

// `Options` is the discriminated-union the SSR package consumes but it
// is not re-exported from the package entry — derive it structurally
// from the `render` signature so we don't depend on internal paths.
type SSROptions = Parameters<typeof render>[0];
import axios from "axios";
import { getServiceIdentifier, getVisRequestServer } from "./env";

/**
 * Persistent axios instance with HTTP keep-alive — only used when the
 * caller explicitly opts into the remote renderer (USE_REMOTE_CHART_RENDERER=1)
 * or for map tools that depend on a tile server.
 */
const httpClient = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Whether to send chart data to an external HTTP renderer instead of
 * rendering in-process. Defaults to FALSE so chart values never leave
 * the host. Set USE_REMOTE_CHART_RENDERER=1 to restore the original
 * behaviour (POST to VIS_REQUEST_SERVER).
 */
function useRemoteRenderer(): boolean {
  const v = (process.env.USE_REMOTE_CHART_RENDERER || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

async function renderRemote(
  type: string,
  // biome-ignore lint/suspicious/noExplicitAny: chart options vary per type
  options: Record<string, any>,
): Promise<string> {
  const url = getVisRequestServer();
  const response = await httpClient.post(url, {
    type,
    ...options,
    source: "mcp-server-chart",
  });
  const { success, errorMessage, resultObj } = response.data;
  if (!success) throw new Error(errorMessage);
  return resultObj;
}

/**
 * Generate a chart and return a representation suitable for the MCP
 * `text` content channel.
 *
 * Default path (USE_REMOTE_CHART_RENDERER unset/false): renders in-process
 * via `@antv/gpt-vis-ssr` (node-canvas) and returns a `data:image/png;
 * base64,...` URI. This keeps chart input data — which often includes
 * customer values, sales numbers, and other PII — entirely on the host.
 *
 * Opt-in path (USE_REMOTE_CHART_RENDERER=1): falls back to the original
 * behaviour of POSTing the spec to VIS_REQUEST_SERVER and returning the
 * remote CDN URL. Chart data leaves the host in this mode.
 */
export async function generateChartUrl(
  type: string,
  // biome-ignore lint/suspicious/noExplicitAny: chart options vary per type
  options: Record<string, any>,
): Promise<string> {
  if (useRemoteRenderer()) {
    return renderRemote(type, options);
  }

  // Local SSR. The SSR `Options` discriminated union keys exactly match
  // the `type` strings the MCP tool layer hands us (area, bar, pie,
  // dual-axes, network-graph, …) so a structural cast is sufficient.
  const ssrOptions = { type, ...options } as SSROptions;
  const result = await render(ssrOptions);
  try {
    // The SSR types declare `toDataURL()` but G2-SSR (used by every
    // statistical chart — bar, column, line, …) does not implement
    // it; only S2-based spreadsheets and mind-map style charts do.
    // `toBuffer()` is universally implemented, so we build the data
    // URL ourselves from the PNG bytes.
    const buffer = result.toBuffer();
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } finally {
    // Always release the underlying canvas — leaks would accumulate
    // across many chart calls in a long-lived MCP process.
    try {
      result.destroy();
    } catch {
      // destroy() can throw on already-destroyed canvases; ignore.
    }
  }
}

type ResponseResult = {
  metadata: unknown;
  /**
   * @docs https://modelcontextprotocol.io/specification/2025-03-26/server/tools#tool-result
   */
  content: CallToolResult["content"];
  isError?: CallToolResult["isError"];
};

/**
 * Generate a map. Maps depend on a geo-tile backend, so they always go
 * over the network — there is no local-SSR equivalent. Operators who
 * need data privacy on map outputs should disable map tools entirely
 * via `DISABLED_TOOLS=generate_district_map,generate_path_map,
 * generate_pin_map`.
 */
export async function generateMap(
  tool: string,
  input: unknown,
): Promise<ResponseResult> {
  const url = getVisRequestServer();

  const response = await httpClient.post(url, {
    serviceId: getServiceIdentifier(),
    tool,
    input,
    source: "mcp-server-chart",
  });
  const { success, errorMessage, resultObj } = response.data;

  if (!success) {
    throw new Error(errorMessage);
  }
  return resultObj;
}
