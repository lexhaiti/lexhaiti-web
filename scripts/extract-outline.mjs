/**
 * extract-outline.mjs
 *
 * Reads public/haiti-departments.svg (10 department paths),
 * computes their polygon union via polyclip-ts,
 * and writes a single outline path to public/haiti-outline.svg.
 *
 * Usage: node scripts/extract-outline.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pkg from "svg-path-parser";
import * as polyclip from "polyclip-ts";

const { parseSVG, makeAbsolute } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const INPUT = resolve(ROOT, "public/haiti-departments.svg");
const OUTPUT = resolve(ROOT, "public/haiti-outline.svg");

// ---------------------------------------------------------------------------
// 1. Parse the SVG and extract department path strings
// ---------------------------------------------------------------------------

const svg = readFileSync(INPUT, "utf-8");

// Match <path ... d="..." ... id="HT-XX" /> — attributes may appear in any order
const PATH_RE =
  /<path[\s\S]*?(?:d="([^"]+)"[\s\S]*?id="(HT-[A-Z]{2})"|id="(HT-[A-Z]{2})"[\s\S]*?d="([^"]+)")[\s\S]*?\/?\s*>/g;

/** @type {{ id: string, d: string }[]} */
const departments = [];

for (const m of svg.matchAll(PATH_RE)) {
  const d = m[1] ?? m[4];
  const id = m[2] ?? m[3];
  if (d && id) departments.push({ id, d });
}

console.log(`Found ${departments.length} department paths`);
if (departments.length === 0) {
  console.error("No department paths found — check the SVG structure");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Convert SVG path "d" strings into GeoJSON-style polygon coordinate arrays
//    Polygon  = Ring[]         (first ring is outer, rest are holes)
//    Ring     = [x,y][]
//    MultiPolygon = Polygon[]
// ---------------------------------------------------------------------------

/**
 * Convert a single SVG path `d` string into a MultiPolygon.
 * Each sub-path (separated by M commands) becomes a separate Polygon.
 */
function pathToMultiPolygon(d) {
  const cmds = makeAbsolute(parseSVG(d));
  const polygons = [];
  let ring = [];

  for (const cmd of cmds) {
    if (cmd.code === "M") {
      // Start of a new sub-path
      if (ring.length >= 3) {
        polygons.push([ring]);
      }
      ring = [[cmd.x, cmd.y]];
    } else if (cmd.code === "L") {
      ring.push([cmd.x, cmd.y]);
    } else if (cmd.code === "Z") {
      // Close the ring (polyclip-ts handles closing automatically,
      // but we close it explicitly for correctness)
      if (ring.length >= 3) {
        ring.push([...ring[0]]);
        polygons.push([ring]);
      }
      ring = [];
    }
  }

  // Handle un-closed final ring
  if (ring.length >= 3) {
    ring.push([...ring[0]]);
    polygons.push([ring]);
  }

  return polygons;
}

// ---------------------------------------------------------------------------
// 3. Compute the union of all department polygons
// ---------------------------------------------------------------------------

/** @type {import('polyclip-ts').MultiPolygon} */
let result = [];

for (const dept of departments) {
  const multiPoly = pathToMultiPolygon(dept.d);
  if (multiPoly.length === 0) {
    console.warn(`  ${dept.id}: no valid polygons extracted, skipping`);
    continue;
  }

  console.log(
    `  ${dept.id}: ${multiPoly.length} polygon(s), ` +
      `${multiPoly.reduce((s, p) => s + p[0].length, 0)} points total`,
  );

  if (result.length === 0) {
    result = multiPoly;
  } else {
    try {
      result = polyclip.union(result, multiPoly);
    } catch (err) {
      console.error(`  Union failed at ${dept.id}:`, err.message);
      // Try adding polygons one at a time
      for (const poly of multiPoly) {
        try {
          result = polyclip.union(result, [poly]);
        } catch (e2) {
          console.error(`    Sub-polygon also failed:`, e2.message);
        }
      }
    }
  }
}

console.log(`\nRaw union result: ${result.length} polygon(s)`);

// ---------------------------------------------------------------------------
// 4. Clean up the union result
//    polyclip-ts sometimes produces degenerate artefacts along shared edges:
//    - zero-area "rings" that trace back and forth along a shared boundary
//    - back-and-forth spurs in the main ring where it enters and exits
//      along a shared internal edge
// ---------------------------------------------------------------------------

/** Signed area of a ring (shoelace formula) */
function ringArea(ring) {
  let area = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

/** Total absolute area of a polygon (outer ring minus holes) */
function polygonArea(polygon) {
  return polygon.reduce((sum, ring) => sum + Math.abs(ringArea(ring)), 0);
}

/**
 * Remove back-and-forth spurs (palindromes) from a ring.
 *
 * polyclip-ts can produce palindromic sequences where the path traces
 * along a shared internal edge and then retraces the exact same points
 * in reverse. For example: ...A B C D E D C B A F G...
 * The spur B C D E D C B should be removed, leaving ...A F G...
 *
 * Strategy: find every "pivot" — a point P[i] where P[i-k] == P[i+k]
 * for k = 1..n (palindrome). Remove the entire palindromic range.
 * Iterate until no more palindromes exist.
 */
function removeSpurs(ring) {
  const EPS = 0.05;
  const eq = (a, b) =>
    Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;

  let pts = [...ring];
  let changed = true;

  while (changed) {
    changed = false;

    // Remove consecutive duplicates first
    const deduped = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (!eq(pts[i], pts[i - 1])) {
        deduped.push(pts[i]);
      }
    }
    if (deduped.length < pts.length) changed = true;
    pts = deduped;

    // Find the longest palindrome centered at each point
    let bestCenter = -1;
    let bestRadius = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      let r = 0;
      while (
        i - r - 1 >= 0 &&
        i + r + 1 < pts.length &&
        eq(pts[i - r - 1], pts[i + r + 1])
      ) {
        r++;
      }
      if (r > bestRadius) {
        bestRadius = r;
        bestCenter = i;
      }
    }

    // Also check for even-length palindromes: ...A B C C B A...
    // Here the "pivot" is between two identical points
    for (let i = 0; i < pts.length - 1; i++) {
      if (eq(pts[i], pts[i + 1])) {
        let r = 0;
        while (
          i - r - 1 >= 0 &&
          i + 1 + r + 1 < pts.length &&
          eq(pts[i - r - 1], pts[i + 1 + r + 1])
        ) {
          r++;
        }
        // Even palindrome of length 2*(r+1)
        if (r + 1 > bestRadius) {
          bestRadius = r + 1;
          // Remove from i-r to i+1+r (inclusive), keep one copy of the pivot
          bestCenter = i; // mark as even, handled below
        }
      }
    }

    if (bestRadius >= 1 && bestCenter >= 0) {
      // Remove the palindromic portion
      // For odd palindrome centered at bestCenter with radius bestRadius:
      // remove indices [bestCenter - bestRadius + 1 ... bestCenter + bestRadius]
      // keeping the anchor points at both ends
      const lo = bestCenter - bestRadius;
      const hi = bestCenter + bestRadius;
      // Keep pts[lo] (the anchor), skip pts[lo+1..hi]
      pts = [...pts.slice(0, lo + 1), ...pts.slice(hi + 1)];
      changed = true;
    }
  }

  return pts;
}

// Area threshold: keep polygons/rings larger than 50 sq px
const AREA_THRESHOLD = 50;

// Clean each polygon: remove degenerate rings and spurs
const cleaned = [];
for (const poly of result) {
  const cleanRings = [];
  for (const ring of poly) {
    const area = Math.abs(ringArea(ring));
    if (area < AREA_THRESHOLD) continue; // drop degenerate rings

    const despurred = removeSpurs(ring);
    if (despurred.length >= 3) {
      cleanRings.push(despurred);
    }
  }
  if (cleanRings.length > 0) {
    cleaned.push(cleanRings);
  }
}

console.log(
  `Cleaned: ${result.length} polygon(s) -> ${cleaned.length} polygon(s)`,
);

for (const poly of cleaned) {
  const area = polygonArea(poly);
  const pts = poly.reduce((s, r) => s + r.length, 0);
  console.log(`  polygon: ${pts} points, area=${Math.round(area)}`);
}

result = cleaned;

// ---------------------------------------------------------------------------
// 5. Convert the result back to an SVG path string
// ---------------------------------------------------------------------------

/**
 * Remove redundant collinear points from a ring.
 * Keeps only vertices where the path actually turns.
 */
function simplifyRing(ring) {
  if (ring.length < 3) return ring;
  const out = [ring[0]];

  for (let i = 1; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i - 1];
    const [bx, by] = ring[i];
    const [cx, cy] = ring[i + 1];
    // cross product of AB x BC — if ~0 the point is collinear
    const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(cross) > 0.01) {
      out.push(ring[i]);
    }
  }

  // Close the ring
  out.push(ring[ring.length - 1]);
  return out;
}

/**
 * Convert a GeoJSON MultiPolygon back to an SVG `d` attribute string.
 * Each polygon's outer ring becomes a sub-path; holes are included too.
 */
function multiPolygonToSVGPath(multiPoly) {
  const parts = [];

  for (const polygon of multiPoly) {
    for (const ring of polygon) {
      if (ring.length < 3) continue;

      const simplified = simplifyRing(ring);
      const r = (v) => Math.round(v * 100) / 100;
      const points = simplified.map(([x, y]) => `${r(x)},${r(y)}`);
      parts.push(`M ${points[0]} L ${points.slice(1).join(" ")} Z`);
    }
  }

  return parts.join(" ");
}

const outlinePath = multiPolygonToSVGPath(result);

// ---------------------------------------------------------------------------
// 6. Compute bounding box for the viewBox
// ---------------------------------------------------------------------------

let minX = Infinity,
  minY = Infinity,
  maxX = -Infinity,
  maxY = -Infinity;

for (const polygon of result) {
  for (const ring of polygon) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
}

// Add a small margin and round to 2 decimal places
const margin = 5;
const r2 = (v) => Math.round(v * 100) / 100;
minX = r2(minX - margin);
minY = r2(minY - margin);

const vbWidth = r2(maxX + margin - minX);
const vbHeight = r2(maxY + margin - minY);

// ---------------------------------------------------------------------------
// 7. Write the output SVG
// ---------------------------------------------------------------------------

// Use the original SVG's dimensions
const width = 774.57153;
const height = 593.52094;

const outSVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:mapsvg="http://mapsvg.com"
  mapsvg:geoViewBox="-74.480910 20.089566 -71.621754 18.020528"
  width="${width}"
  height="${height}"
  viewBox="${minX} ${minY} ${vbWidth} ${vbHeight}">
  <path
    id="haiti-outline"
    d="${outlinePath}"
    fill="none"
    stroke="#000"
    stroke-width="2" />
</svg>
`;

writeFileSync(OUTPUT, outSVG, "utf-8");
console.log(`\nOutline written to ${OUTPUT}`);
console.log(`  viewBox: ${minX} ${minY} ${vbWidth} ${vbHeight}`);
console.log(`  Path length: ${outlinePath.length} chars`);
