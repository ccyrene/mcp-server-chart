/**
 * Regression suite for sec/strip-remote-rendering.
 *
 * These tests are STATIC GUARDS — they prevent accidental re-introduction
 * of remote-rendering code paths or dependencies. They do not exercise the
 * runtime; they grep the source / package manifest / built output.
 *
 * If any of these fail, that means a change snuck in that would let the
 * chart MCP make outbound HTTP again. Investigate the offending file
 * before merging.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");

// ── Forbidden tokens ────────────────────────────────────────────────
// Strings whose presence anywhere in src/ would indicate that remote
// rendering has been (re-)introduced.
const FORBIDDEN_TOKENS = [
  "antv-studio.alipay",
  "VIS_REQUEST_SERVER",
  "VIS_RENDER_MODE",
  "getVisRequestServer",
  "getServiceIdentifier",
  "renderRemote",
  "generateMap",
  "axios",
];

// ── Removed map tool tokens ──────────────────────────────────────────
// Filenames + symbol names that were deleted. If they reappear in src/,
// the deletions have been reverted.
const REMOVED_MAP_TOKENS = [
  "district-map",
  "path-map",
  "pin-map",
  "districtMap",
  "pathMap",
  "pinMap",
  // Schemas that only existed for the map tools — restoring any of these
  // is a strong signal that the map work is being reintroduced.
  "MapTitleSchema",
  "MapWidthSchema",
  "MapHeightSchema",
  "POIsSchema",
  "DistrictNameSchema",
  "StyleSchema",
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (
      entry === "node_modules" ||
      entry === "build" ||
      entry.startsWith(".")
    ) {
      continue;
    }
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry)) {
      yield full;
    }
  }
}

function readSrcFiles(): Array<{ path: string; content: string }> {
  return Array.from(walk(join(REPO_ROOT, "src"))).map((path) => ({
    path,
    content: readFileSync(path, "utf-8"),
  }));
}

describe("regression: no remote-rendering code paths", () => {
  const files = readSrcFiles();

  it("loads at least one source file (sanity)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  describe("forbidden tokens are absent from src/", () => {
    for (const token of FORBIDDEN_TOKENS) {
      it(`src/ contains no occurrence of "${token}"`, () => {
        const hits = files.filter((f) => f.content.includes(token));
        expect(
          hits.map((h) => h.path.replace(REPO_ROOT, "")),
          `Found "${token}" in: ${hits.map((h) => h.path).join(", ") || "(none)"}`,
        ).toEqual([]);
      });
    }
  });

  describe("removed map tool symbols are absent from src/", () => {
    for (const token of REMOVED_MAP_TOKENS) {
      it(`src/ does not reference "${token}"`, () => {
        const hits = files.filter((f) => f.content.includes(token));
        expect(hits.map((h) => h.path.replace(REPO_ROOT, ""))).toEqual([]);
      });
    }
  });

  it("deleted map chart files do not exist on disk", () => {
    for (const name of ["district-map", "path-map", "pin-map"]) {
      expect(
        existsSync(join(REPO_ROOT, "src", "charts", `${name}.ts`)),
        `src/charts/${name}.ts should not exist`,
      ).toBe(false);
    }
  });
});

describe("regression: no remote-network dependencies", () => {
  it("package.json has no axios dependency", () => {
    const pkg = JSON.parse(
      readFileSync(join(REPO_ROOT, "package.json"), "utf-8"),
    );
    expect(pkg.dependencies?.axios).toBeUndefined();
    expect(pkg.devDependencies?.axios).toBeUndefined();
  });

  it("package.json has no other HTTP-client deps the project doesn't use", () => {
    const pkg = JSON.parse(
      readFileSync(join(REPO_ROOT, "package.json"), "utf-8"),
    );
    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    // Common HTTP clients that would route data off-host. The repo never
    // needed one — this guard catches accidental adds.
    const banned = ["got", "node-fetch", "superagent", "request"];
    const present = banned.filter((b) => b in allDeps);
    expect(present).toEqual([]);
  });
});

describe("regression: built output is clean (when present)", () => {
  // build/ only exists after `npm run build`. When the spec runs in CI
  // post-build, this catches any forbidden token that escaped into the
  // compiled JS (e.g. dead imports, leaked string literals).
  const buildDir = join(REPO_ROOT, "build");

  it.skipIf(!existsSync(buildDir))(
    "build/ does not contain forbidden remote-rendering tokens",
    () => {
      const buildFiles: Array<{ path: string; content: string }> = [];
      for (const f of walk(buildDir)) {
        if (f.endsWith(".js") || f.endsWith(".mjs")) {
          buildFiles.push({ path: f, content: readFileSync(f, "utf-8") });
        }
      }
      for (const token of FORBIDDEN_TOKENS) {
        const hits = buildFiles.filter((f) => f.content.includes(token));
        expect(
          hits.map((h) => h.path.replace(REPO_ROOT, "")),
          `Built output contains "${token}"`,
        ).toEqual([]);
      }
    },
  );
});

describe("regression: tool surface is locked-down", () => {
  it("CHART_TYPE_MAP in callTool.ts has no map entries", () => {
    const src = readFileSync(
      join(REPO_ROOT, "src", "utils", "callTool.ts"),
      "utf-8",
    );
    // The original 3 map tools must not appear in the dispatch table.
    expect(src).not.toMatch(/generate_district_map\s*:/);
    expect(src).not.toMatch(/generate_path_map\s*:/);
    expect(src).not.toMatch(/generate_pin_map\s*:/);
  });

  it("Charts module does not export any map chart", () => {
    const src = readFileSync(
      join(REPO_ROOT, "src", "charts", "index.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(
      /from\s+["']\.\/(district-map|path-map|pin-map)["']/,
    );
  });
});
