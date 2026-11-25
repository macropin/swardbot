/**
 * Edge finish for printed parts: a small chamfer on every hard edge.
 *
 * A hard edge is a convex one, where two faces meet at a right angle or
 * sharper: the outside corners of a part, and the rims of its holes, channels
 * and pockets. Chamfering them:
 *
 * - takes off the elephant's foot on the bed's first layers;
 * - gives tubes, spigots, bolts and drills a lead-in;
 * - softens edges that would otherwise chip or cut a hand.
 *
 * The finish leaves alone:
 *
 * - concave edges (inside corners), where a chamfer would add material: a tube
 *   end butting a channel's end wall would stop short and its holes would miss;
 * - shallow edges, such as the corners of an octagonal spigot or a hull;
 * - edges of faces too narrow to take the chamfer, such as an end cap's crush
 *   ribs.
 *
 * Edges upright as printed, the part's corners in plan, take a larger chamfer:
 * it eases the stress that lifts a big print's corners off the bed.
 *
 * If the kernel can't chamfer that set, the finish falls back to the smaller
 * chamfer everywhere, then to straight edges only, and warns if it gives up.
 */
import {
  chamfer,
  classifyPointOnFace,
  curveLength,
  curvePointAt,
  facesOfEdge,
  getEdges,
  isValid,
  measureArea,
  normalAt,
  simplify,
  unwrap,
  type Edge,
  type Face,
  type ValidSolid,
} from 'brepjs';

export interface FinishOptions {
  /** Chamfer on every hard edge. */
  edge: number;
  /** Chamfer on hard edges upright as printed (along Z). */
  corner: number;
}

type Vec = [number, number, number];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: Vec) => Math.hypot(a[0], a[1], a[2]);

/** Faces meeting at more than this, their normals closer than this cosine, aren't a hard edge. */
const HARD = 0.35;
/** Upright edges shorter than this are left sharp. */
const SHORT_UPRIGHT = 15;

/** A face's rough width: twice its area over its perimeter, near enough for a strip. */
function width(face: Face, perimeters: Map<Face, number>): number {
  const area = unwrap(measureArea(face));
  let perimeter = perimeters.get(face);
  if (perimeter === undefined) {
    perimeter = 0;
    for (const e of getEdges(face)) perimeter += curveLength(e);
    perimeters.set(face, perimeter);
  }
  return perimeter > 0 ? (2 * area) / perimeter : 0;
}

export interface HardEdge {
  edge: Edge;
  upright: boolean;
  straight: boolean;
}

/** The part's hard edges that can take a chamfer of `size`. */
export function hardEdges(solid: ValidSolid, size: number): HardEdge[] {
  const out: HardEdge[] = [];
  const perimeters = new Map<Face, number>();
  for (const edge of getEdges(solid)) {
    const length = curveLength(edge);
    if (length < Math.max(3, 4 * size)) continue;
    const faces = facesOfEdge(solid, edge);
    if (faces.length !== 2) continue;
    const [f1, f2] = faces as [Face, Face];
    const p = curvePointAt(edge, 0.5) as Vec;
    const n1 = normalAt(f1, p) as Vec;
    const n2 = normalAt(f2, p) as Vec;
    const cos = dot(n1, n2);
    if (cos > HARD) continue;
    // Convex if, stepping from the edge against the other face's normal, we stay on this face.
    const step = Math.max(0.05, size / 4);
    if (classifyPointOnFace(f1, sub(p, scale(n2, step))) !== 'in') continue;
    const a = curvePointAt(edge, 0) as Vec;
    const b = curvePointAt(edge, 1) as Vec;
    const chord = sub(b, a);
    const straight = Math.abs(norm(chord) - length) < 1e-3 * length;
    // Straight edges only: the outlines, channels, spigots and slots. Round hole
    // rims are left to the drill or a countersink.
    if (!straight) continue;
    const narrow = Math.max(2, 2.5 * size);
    if (width(f1, perimeters) < narrow || width(f2, perimeters) < narrow) continue;
    const upright = straight && Math.abs(chord[2]) > 0.99 * norm(chord);
    // Short upright edges are a corner split where a thin web meets a taller arm;
    // their chamfer would have to end against another, which the kernel can't blend.
    if (upright && length < SHORT_UPRIGHT) continue;
    out.push({ edge, upright, straight });
  }
  return out;
}

/** The chamfered part, or undefined if the kernel can't chamfer that set. */
function tryChamfer(solid: ValidSolid, edges: readonly (HardEdge & { size: number })[]): ValidSolid | undefined {
  if (edges.length === 0) return solid;
  const sizes = new Map(edges.map((e) => [e.edge, e.size]));
  try {
    const result = chamfer(
      solid,
      edges.map((e) => e.edge),
      (edge: Edge) => sizes.get(edge) ?? null,
    );
    return result.ok && isValid(result.value) ? result.value : undefined;
  } catch {
    return undefined;
  }
}

/** Set SWARDBOT_FAST=1 to skip the finish, for quick iteration on a part's shape. */
const FAST = typeof process !== 'undefined' && process.env?.SWARDBOT_FAST === '1';

/**
 * The part with a small chamfer on its hard edges, as `name` for the warning.
 *
 * The kernel can chamfer each edge alone, but not always every edge at once:
 * two chamfers can meet at a corner it can't blend. So the edges go in batches;
 * a batch that fails is split until the edge that can't join is found, which
 * is tried again at the smaller size, and otherwise left sharp.
 */
export function finish(part: ValidSolid, options: FinishOptions, name = 'part'): ValidSolid {
  if (options.edge <= 0 || FAST) return part;
  // Merge the faces the booleans left side by side in one plane, so each outline
  // is one run of edges the chamfer can follow.
  const merged = simplify(part);
  const solid = merged.ok && isValid(merged.value) ? merged.value : part;
  const edges = hardEdges(solid, options.edge).map((e) => ({
    ...e,
    size: e.upright ? Math.max(options.corner, options.edge) : options.edge,
  }));
  const kept: (HardEdge & { size: number })[] = [];
  let best = solid;
  const add = (group: (HardEdge & { size: number })[]) => {
    if (group.length === 0) return;
    const result = tryChamfer(solid, [...kept, ...group]);
    if (result) {
      kept.push(...group);
      best = result;
      return;
    }
    if (group.length > 1) {
      const mid = group.length >> 1;
      add(group.slice(0, mid));
      add(group.slice(mid));
      return;
    }
    const [one] = group as [HardEdge & { size: number }];
    if (one.size > options.edge) add([{ ...one, size: options.edge }]);
  };
  for (let i = 0; i < edges.length; i += 16) add(edges.slice(i, i + 16));
  if (kept.length < edges.length) {
    console.warn(`finish: ${name}: chamfered ${kept.length} of ${edges.length} hard edges`);
  }
  return best;
}
