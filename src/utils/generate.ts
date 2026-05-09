import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Self-hosted in-process renderer.
 *
 * Charts are rendered directly via @antv/gpt-vis-ssr (server-side,
 * node-canvas based — no browser, no external HTTP) and returned as a
 * `data:image/png;base64,…` URI. There is no remote rendering path.
 *
 * Map rendering (district / path / pin) was removed entirely because it
 * required a geo-tile backend with no local-SSR equivalent.
 */

// gpt-vis-ssr pulls in @antv/s2, which `require()`s a .css file in its
// CommonJS build (browser-targeted code leaking into a Node context).
// Node tries to parse the CSS as JS and throws "Unexpected token '.'".
// Install a Module._extensions[".css"] noop BEFORE the dynamic import
// so any deep `require('./foo.css')` returns an empty module instead
// of crashing. Same shim works for .less / .scss for safety.
// biome-ignore lint/suspicious/noExplicitAny: dynamic import returns any
let _ssrRender: any = null;
let _cssShimInstalled = false;
function installAssetShims(): void {
  if (_cssShimInstalled) return;
  // biome-ignore lint/suspicious/noExplicitAny: Node internals
  const Module: any = require("node:module");
  const noop = (_module: unknown, _filename: string) => {
    /* exports stays {} — silently ignore stylesheet imports in Node */
  };
  for (const ext of [".css", ".less", ".scss", ".sass", ".styl"]) {
    if (!Module._extensions[ext]) Module._extensions[ext] = noop;
  }
  _cssShimInstalled = true;
}

async function getSsrRender(): Promise<
  (
    // biome-ignore lint/suspicious/noExplicitAny: render's exact signature varies by version
    config: Record<string, any>,
    // biome-ignore lint/suspicious/noExplicitAny: result shape varies by version
  ) => Promise<any>
> {
  if (_ssrRender) return _ssrRender;
  installAssetShims();
  // biome-ignore lint/suspicious/noExplicitAny: dynamic import
  const mod: any = await import("@antv/gpt-vis-ssr");
  // The package exports `render` as default in newer versions and named in older.
  _ssrRender = mod.render || mod.default?.render || mod.default;
  if (typeof _ssrRender !== "function") {
    throw new Error(
      "@antv/gpt-vis-ssr did not expose a render() function — check package version",
    );
  }
  return _ssrRender;
}

/**
 * Generate a chart as a base64-encoded PNG data URI by rendering through
 * @antv/gpt-vis-ssr in-process. No outbound network calls.
 *
 * Calls `.destroy()` in a finally block to release the underlying canvas;
 * leaks accumulate across many chart calls in a long-lived MCP process.
 * `.destroy()` is only present on newer versions of the SSR result —
 * guard the call so older versions don't blow up.
 */
export async function generateChartUrl(
  type: string,
  // biome-ignore lint/suspicious/noExplicitAny: chart options vary per type
  options: Record<string, any>,
): Promise<string> {
  const render = await getSsrRender();
  const vis = await render({ type, ...options });
  try {
    const buf = await Promise.resolve(vis.toBuffer());
    return `data:image/png;base64,${buf.toString("base64")}`;
  } finally {
    try {
      vis.destroy?.();
    } catch {
      /* destroy() can throw on already-destroyed canvases; ignore. */
    }
  }
}

export type ResponseResult = {
  metadata: unknown;
  /**
   * @docs https://modelcontextprotocol.io/specification/2025-03-26/server/tools#tool-result
   */
  content: CallToolResult["content"];
  isError?: CallToolResult["isError"];
};
