// CSS no-op require hook for SSR mode.
//
// `@antv/gpt-vis-ssr` statically imports every chart family at module
// load time, including `@antv/s2-ssr` → `@antv/s2`, which in turn does
// `require("./index.css")` from compiled UI components. Those CSS
// files are stylesheets meant for a browser bundler (webpack /
// rollup); raw Node has no extension handler for `.css`, so the
// require throws `SyntaxError: Unexpected token '.'` and the whole
// MCP process crashes before it can serve a single chart.
//
// The fix is a deprecated-but-supported Node API: register a custom
// extension handler that returns nothing for `.css` files. Visual
// styling is irrelevant on the server side — we render charts to a
// node-canvas PNG buffer, no DOM or stylesheets involved.
//
// MUST be imported *first* in the entrypoint so the hook is installed
// before any `@antv/*` package gets a chance to evaluate its top-level
// requires.

// biome-ignore lint/suspicious/noExplicitAny: Module._extensions / require.extensions is untyped
const req = require as any;
if (req.extensions) {
  req.extensions[".css"] = () => undefined;
}

export {};
