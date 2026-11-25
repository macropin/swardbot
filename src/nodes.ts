/**
 * The printed nodes at the three corners of each side frame's triangle.
 *
 * - The rear node, over the axle: it holds the post's foot, the whole rear
 *   rail, the front rail's end, the axle, and the ends of the bumper and the
 *   cradle's rear floor tube.
 * - The apex node, at the top of the post: it holds the post's top, the leg's
 *   top, and the top bar, which runs through it.
 * - The front node, at the front of the rail: it holds the front rail's end,
 *   the leg's foot, and the front cross member's end.
 *
 * Each node is two halves, split on the side frame's plane through the tubes'
 * centrelines. The tubes lie in channels in both halves, and bolts pass
 * through both halves and the tube between them: the bolts locate and pin the
 * tubes, and the halves squeeze them slightly before meeting face to face, so
 * a bolt can't crush the thin tube wall. Between the tubes the halves meet in
 * a web on the tubes' centreline plane. The cross members that end at a node
 * slide over spigots standing off the inner half, bolted through.
 *
 * This module is the nodes' geometry as numbers: what each one holds and where,
 * its outline, its bolts, the checks that it fits, and the holes to drill in
 * the tubes. ./node-solid.ts builds the printed halves from it.
 *
 * Coordinates are in the side frame's plane: u forward (the layout's X) and v
 * up (its Z), for the left side frame. The right side frame mirrors it.
 */
import type { Check, Layout, Member, Vec3 } from './layout.js';

export type Vec2 = [number, number];

/**
 * A tube lying in a node, along a line in the frame's plane. Where a tube ends
 * against another tube, its arm starts back at the junction, so the node is
 * solid in the wedge the tube's end bears against.
 */
export interface Seat {
  /** The member's name, without its side. */
  readonly member: string;
  /** A point on the tube's centreline, and the direction positions `s` run along it from there. */
  readonly origin: Vec2;
  readonly dir: Vec2;
  /** Where the node starts and stops along the tube. */
  readonly start: number;
  readonly stop: number;
  /** Where the tube starts and stops along the same line: inside the node where it ends there. */
  readonly tubeFrom: number;
  readonly tubeTo: number;
  /** Bolts through the tube, across the frame. */
  readonly bolts: readonly number[];
}

/** A cross member's end, which slides over a spigot standing off the inner half. */
export interface Spigot {
  readonly member: string;
  readonly at: Vec2;
}

/**
 * A cross member that runs straight through both halves, pinned by a bolt along
 * u in each: in from the tunnel's rear face, into a nut dropped into a slot in
 * its thickened front wall.
 */
export interface Tunnel {
  readonly member: string;
  readonly at: Vec2;
}

export type NodeName = 'rear' | 'apex' | 'front' | 'cradle' | 'deck' | 'box';

/** Who a hole's bolt belongs to: a node, or one of the clamped-on parts. */
export type HoleSource = NodeName | 'front beam' | 'deck hanger' | 'battery stop' | 'antenna' | 'estop';

export interface NodeSpec {
  readonly name: NodeName;
  readonly seats: readonly Seat[];
  readonly spigots: readonly Spigot[];
  readonly tunnels: readonly Tunnel[];
  /** The drive axle, through the outer half, blind in the inner half. */
  readonly axle?: Vec2;
  /** Regions solid through both halves' full thickness: squares, centre and half-side. */
  readonly bosses?: readonly { readonly at: Vec2; readonly half: number }[];
  /** Bolts through both halves that pass no tube: the axle clamp's. */
  readonly extraBolts?: readonly Vec2[];
  /** The halves' outline: the convex hull of everything they hold. */
  readonly outline: readonly Vec2[];
}

/** Least plastic between a hole or pocket and another feature. */
export const MIN_LIGAMENT = 4;

/** Plastic either side of a nut slot. */
const SLOT_SKIN = 2;

/**
 * Chamfer on the corners of anything that fits into a square tube's bore. The
 * bore's corners are rounded, to about the wall's thickness; a chamfer this
 * size clears them.
 */
export const cornerRelief = (tubeWall: number) => tubeWall + 0.3;

/** A square of side `size` centred at `at`, its corners chamfered by `chamfer`: an octagon. */
export function chamferedSquare(at: Vec2, size: number, chamfer: number): Vec2[] {
  const a = size / 2;
  const b = a - chamfer;
  const [u, v] = at;
  return [
    [u - b, v - a],
    [u + b, v - a],
    [u + a, v - b],
    [u + a, v + b],
    [u + b, v + a],
    [u - b, v + a],
    [u - a, v + b],
    [u - a, v - b],
  ];
}

/** Clearance a drilled hole takes over its bolt or axle. */
const DRILL_CLEARANCE = 0.5;

// ---------------------------------------------------------------------------
// Dimensions shared by every node
// ---------------------------------------------------------------------------

export function nodeDims(l: Layout) {
  const p = l.params;
  const h = l.tube.half;
  const fit = p.fitTolerance;
  const nutAF = p.nutAcrossFlats + fit;
  return {
    h,
    wall: p.jointWall,
    /** Each half, from the split plane to its outer face. */
    thickness: h + p.jointWall,
    /** A tube channel, across and into each half. */
    channelHalf: h + fit / 2,
    channelDepth: h - p.clampSqueeze / 2,
    /** A node's arm around a tube, across. */
    armHalf: h + fit / 2 + p.jointWall,
    boltHole: (p.boltDiameter + fit) / 2,
    nutAF,
    /** The nut pocket's corner radius, and depth into the outer face. */
    nutRadius: nutAF / Math.sqrt(3),
    nutDepth: p.nutThickness + 0.5,
    /** Spigot section: the tube's bore, less the fit. */
    spigot: l.tube.size - 2 * l.tube.wall - fit,
    /**
     * The spigot's corners are chamfered this much: a square tube's bore has
     * rounded corners, which a sharp-cornered spigot would jam in.
     */
    spigotChamfer: cornerRelief(l.tube.wall),
    spigotLength: p.spigotLength,
    axleHole: (p.axleDiameter + fit) / 2,
    /** The axle's blind end in the inner half, from the split plane. */
    axleDepth: h + p.jointWall / 2 + fit,
    /** A tunnel's front wall, thick enough to hold a nut slot between two skins. */
    tunnelFrontWall: Math.max(p.jointWall, p.nutThickness + 0.5 + 2 * SLOT_SKIN),
    slotSkin: SLOT_SKIN,
  };
}

export type NodeDims = ReturnType<typeof nodeDims>;

/**
 * The axle clamp, between the rear node and the wheel: a block round the axle,
 * its bore flatted to grip the axle's flats, slit through to its front and
 * pinched shut by a bolt across the slit. Four bolts through it and the rear
 * node's boss hold it to the frame. Measured from the axle's centre.
 */
export function axleClamp(l: Layout) {
  const p = l.params;
  const d = nodeDims(l);
  const fit = p.fitTolerance;
  /** The pinch bolt's line, ahead of the axle, just clear of its bore. */
  const pinch = d.axleHole + d.boltHole + MIN_LIGAMENT;
  /** The mounting bolts, on a square this far each way, just clear of the pinch bolt. */
  const bolt = pinch + 2 * d.boltHole + MIN_LIGAMENT;
  const half = bolt + d.boltHole + MIN_LIGAMENT;
  return {
    pinch,
    bolt,
    half,
    length: p.axleClampLength,
    bore: d.axleHole,
    flats: (p.axleFlats + fit) / 2,
    slit: 1.5,
    bolts: [
      [-bolt, -bolt],
      [bolt, -bolt],
      [bolt, bolt],
      [-bolt, bolt],
    ] as Vec2[],
  };
}

// ---------------------------------------------------------------------------
// 2D helpers
// ---------------------------------------------------------------------------

export const along = (seat: Seat, s: number, offset = 0): Vec2 => [
  seat.origin[0] + seat.dir[0] * s - seat.dir[1] * offset,
  seat.origin[1] + seat.dir[1] * s + seat.dir[0] * offset,
];

/** A seat's rectangle from s0 to s1, `half` either side of its centreline, as four corners. */
export const band = (seat: Seat, s0: number, s1: number, half: number): Vec2[] => [
  along(seat, s0, -half),
  along(seat, s1, -half),
  along(seat, s1, half),
  along(seat, s0, half),
];

/** A tunnel's walls, in the frame's plane: thicker at the front, where the nut slot is. */
export const tunnelBox = (t: Tunnel, d: { channelHalf: number; wall: number; tunnelFrontWall: number }): Vec2[] => {
  const [u, v] = t.at;
  const [rear, front] = [u - d.channelHalf - d.wall, u + d.channelHalf + d.tunnelFrontWall];
  const [low, high] = [v - d.channelHalf - d.wall, v + d.channelHalf + d.wall];
  return [
    [rear, low],
    [front, low],
    [front, high],
    [rear, high],
  ];
};

export const square = (at: Vec2, half: number): Vec2[] => [
  [at[0] - half, at[1] - half],
  [at[0] + half, at[1] - half],
  [at[0] + half, at[1] + half],
  [at[0] - half, at[1] + half],
];

/** The tube's channel in a seat: where the tube is, inside the node, open past the node's ends where it carries on. */
export function channelSpan(seat: Seat, fit: number, over: number): [number, number] {
  const from = seat.tubeFrom >= seat.start - 1e-9 ? seat.tubeFrom - fit / 2 : seat.start - over;
  const to = seat.tubeTo <= seat.stop + 1e-9 ? seat.tubeTo + fit / 2 : seat.stop + over;
  return [from, to];
}

/** Convex hull, counter-clockwise (Andrew's monotone chain). */
function hull(points: Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Distance from a point to a convex polygon: 0 inside. */
function distanceToPolygon(p: Vec2, poly: readonly Vec2[]): number {
  let inside = true;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
    const [px, py] = [p[0] - a[0], p[1] - a[1]];
    if (ex * py - ey * px < 0) inside = false;
    const t = Math.max(0, Math.min(1, (px * ex + py * ey) / (ex * ex + ey * ey)));
    best = Math.min(best, Math.hypot(px - t * ex, py - t * ey));
  }
  return inside ? 0 : best;
}

/** Whether two convex polygons overlap, by separating axes. */
function overlaps(a: readonly Vec2[], b: readonly Vec2[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p0 = poly[i]!;
      const p1 = poly[(i + 1) % poly.length]!;
      const axis: Vec2 = [p0[1] - p1[1], p1[0] - p0[0]];
      const project = (q: readonly Vec2[]) => q.map((v) => v[0] * axis[0] + v[1] * axis[1]);
      const pa = project(a);
      const pb = project(b);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// The nodes
// ---------------------------------------------------------------------------

export function nodes(l: Layout): NodeSpec[] {
  const p = l.params;
  const d = nodeDims(l);
  const { h } = d;
  const arm = p.jointArm;
  const railZ = l.railZ;
  const frontX = l.wheelbase;
  const legDir: Vec2 = [Math.cos((l.leg.slope * Math.PI) / 180), -Math.sin((l.leg.slope * Math.PI) / 180)];

  /** Two bolts in from the far end of an arm, which ends at `end` and runs back toward `back`. */
  const armBolts = (end: number, back: 1 | -1) => [end + back * p.boltInset, end + back * (p.boltInset + p.boltPitch)];

  /**
   * The standard holes near a tube's end, which ends at `end` and runs on in
   * direction `into`: every tube end held in a node gets its bolts the same
   * distances from the end, so one drill jig drills them all.
   */
  const endBolts = (end: number, into: 1 | -1, count = 2) =>
    [end + into * p.boltInset, end + into * (p.boltInset + p.boltPitch)].slice(0, count);

  /** Bolts spread over [a, b]: two at its ends if they fit apart, else one in the middle. */
  const spread = (a: number, b: number) => (b - a >= p.boltPitch ? [a, b] : b >= a ? [(a + b) / 2] : []);

  // --- Rear node: post foot, axle, rear rail, front rail end, bumper, cradle floor.

  const rearArmTop = railZ + h + arm;
  const axleZ = l.wheel.axleZ;
  const clamp = axleClamp(l);
  const rear: Omit<NodeSpec, 'outline'> = {
    name: 'rear',
    seats: [
      {
        // The post stops above the axle; below it the node is solid, round the
        // axle, down past the cradle's rear floor tube.
        member: 'post',
        origin: [0, 0],
        dir: [0, 1],
        start: l.floorZ - h - d.wall,
        stop: rearArmTop,
        tubeFrom: l.post.foot,
        tubeTo: l.post.top,
        // The standard pair up from the foot, and two more above the rail, drilled
        // through the node: the rear node carries the wheel.
        bolts: [...endBolts(l.post.foot, 1), ...armBolts(rearArmTop, -1).reverse()],
      },
      {
        member: 'rear rail',
        origin: [0, railZ],
        dir: [-1, 0],
        start: 0,
        stop: -l.bumperX + h + d.wall,
        tubeFrom: h,
        tubeTo: -l.bumperX + h,
        // From its end at the post, clear of the bumper's spigot at the other.
        bolts: endBolts(h, 1),
      },
      {
        member: 'front rail',
        origin: [0, railZ],
        dir: [1, 0],
        start: 0,
        stop: h + arm,
        tubeFrom: h,
        tubeTo: frontX - h,
        bolts: endBolts(h, 1),
      },
    ],
    spigots: [
      { member: 'cradle floor, rear', at: [0, l.floorZ] },
      { member: 'bumper', at: [l.bumperX, railZ] },
    ],
    tunnels: [],
    axle: [0, axleZ],
    bosses: [{ at: [0, axleZ], half: clamp.half }],
    extraBolts: clamp.bolts.map(([u, v]) => [u, axleZ + v] as Vec2),
  };

  // --- Apex node: post top, leg top, top bar through.

  const apexArmFoot = l.post.top - arm;
  const legTop: Vec2 = [0, l.leg.top[2]];
  const apex: Omit<NodeSpec, 'outline'> = {
    name: 'apex',
    seats: [
      {
        member: 'post',
        origin: [0, 0],
        dir: [0, 1],
        start: apexArmFoot,
        stop: l.post.top,
        tubeFrom: l.post.foot,
        tubeTo: l.post.top,
        bolts: endBolts(l.post.top, -1),
      },
      {
        member: 'leg',
        origin: legTop,
        dir: legDir,
        start: 0,
        stop: l.leg.topButt + arm,
        tubeFrom: l.leg.topButt,
        tubeTo: l.leg.topButt + l.leg.length,
        bolts: endBolts(l.leg.topButt, 1),
      },
    ],
    spigots: [],
    tunnels: [{ member: 'top bar', at: [0, p.apexHeight] }],
  };

  // --- Front node: front rail end, leg foot, front cross member.

  const front: Omit<NodeSpec, 'outline'> = {
    name: 'front',
    seats: [
      {
        // The rail stops behind the cross member's spigot, so its end bolts sit the
        // standard distances from it; the node runs on solid round the spigot.
        member: 'front rail',
        origin: [frontX, railZ],
        dir: [-1, 0],
        start: -h - d.wall,
        stop: h + arm,
        tubeFrom: h,
        tubeTo: frontX - h,
        bolts: endBolts(h, 1),
      },
      {
        member: 'leg',
        origin: [frontX, railZ],
        dir: [-legDir[0], -legDir[1]],
        start: 0,
        stop: l.leg.footButt + arm,
        tubeFrom: l.leg.footButt,
        tubeTo: l.leg.footButt + l.leg.length,
        bolts: endBolts(l.leg.footButt, 1),
      },
    ],
    spigots: [{ member: 'front cross member', at: [frontX, railZ] }],
    tunnels: [],
  };

  // --- Nodes along the side frame, between the corners: each clamps a tube
  // running through it, and carries a cross member's end on a spigot.

  /**
   * A tube running straight through a node, an arm each way from `at`. These
   * nodes carry little, so one bolt in each arm is enough: drilled through the
   * node, clamped on at its place.
   */
  const through = (member: string, at: Vec2, dir: Vec2, from: number, to: number): Seat => ({
    member,
    origin: at,
    dir,
    start: -h - arm,
    stop: h + arm,
    tubeFrom: from,
    tubeTo: to,
    bolts: [-h - p.boltInset, h + p.boltInset],
  });
  const along = (x: number) => through('front rail', [x, railZ], [1, 0], h - x, frontX - h - x);

  // Cradle node: on the front rail over the cradle's front floor tube, holding
  // the hanger that carries it.
  const hangerBottom = l.floorZ - h;
  const cradle: Omit<NodeSpec, 'outline'> = {
    name: 'cradle',
    seats: [
      along(l.frontFloorX),
      {
        member: 'cradle hanger',
        origin: [l.frontFloorX, 0],
        dir: [0, 1],
        start: hangerBottom - d.wall,
        stop: railZ,
        tubeFrom: hangerBottom,
        tubeTo: railZ - h,
        // One bolt, the standard distance down from its top end.
        bolts: endBolts(railZ - h, -1, 1),
      },
    ],
    spigots: [{ member: 'cradle floor, front', at: [l.frontFloorX, l.floorZ] }],
    tunnels: [],
  };

  // Deck node: on the front rail, carrying the deck beam's end.
  const deck: Omit<NodeSpec, 'outline'> = {
    name: 'deck',
    seats: [along(l.deck.beamX)],
    spigots: [{ member: 'deck beam', at: [l.deck.beamX, railZ] }],
    tunnels: [],
  };

  // Box node: on the post between the rear and apex nodes, carrying the two
  // electronics rails' ends, with a bolt through the post between them.
  const [low, high] = l.electronicsRails;
  const box: Omit<NodeSpec, 'outline'> = {
    name: 'box',
    seats: [
      {
        member: 'post',
        origin: [0, 0],
        dir: [0, 1],
        start: low - d.armHalf,
        stop: high + d.armHalf,
        tubeFrom: l.post.foot,
        tubeTo: l.post.top,
        bolts: [(low + high) / 2],
      },
    ],
    spigots: [
      { member: 'electronics rail, lower', at: [0, low] },
      { member: 'electronics rail, upper', at: [0, high] },
    ],
    tunnels: [],
  };

  return [rear, apex, front, cradle, deck, box].map((n) => ({ ...n, outline: outlineOf(n, d) }));
}

function outlineOf(n: Omit<NodeSpec, 'outline'>, d: NodeDims): Vec2[] {
  const points: Vec2[] = [
    ...(n.bosses ?? []).flatMap((b) => square(b.at, b.half)),
    ...n.seats.flatMap((s) => band(s, s.start, s.stop, d.armHalf)),
    ...n.tunnels.flatMap((t) => tunnelBox(t, d)),
  ];
  return hull(points);
}

/** A node's extent in the frame's plane. */
export function extent(n: NodeSpec) {
  const us = n.outline.map((q) => q[0]);
  const vs = n.outline.map((q) => q[1]);
  return { uMin: Math.min(...us), uMax: Math.max(...us), vMin: Math.min(...vs), vMax: Math.max(...vs) };
}

/** Every bolt through a seat, as a point in the frame's plane. */
export const boltPoints = (n: NodeSpec): { seat: Seat; s: number; at: Vec2 }[] =>
  n.seats.flatMap((seat) => seat.bolts.map((s) => ({ seat, s, at: along(seat, s) })));

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export function nodeChecks(l: Layout, specs: readonly NodeSpec[] = nodes(l)): Check[] {
  const p = l.params;
  const d = nodeDims(l);
  const checks: Check[] = [];
  const atLeast = (name: string, value: number, min: number, unit: Check['unit'] = 'mm') =>
    checks.push({ name, ok: value >= min - 1e-9, value, unit, limit: `≥ ${min}` });

  for (const n of specs) {
    // Each bolt clear of the other tubes' channels, and of the spigots' roots on the inner half.
    let boltClear = Infinity;
    const extra = (n.extraBolts ?? []).map((at) => ({ seat: undefined as Seat | undefined, s: 0, at }));
    for (const b of [...boltPoints(n), ...extra]) {
      for (const other of n.seats) {
        if (other === b.seat) continue;
        const [s0, s1] = channelSpan(other, p.fitTolerance, 0);
        boltClear = Math.min(boltClear, distanceToPolygon(b.at, band(other, s0, s1, d.channelHalf)) - d.boltHole);
      }
      for (const sp of n.spigots) {
        boltClear = Math.min(boltClear, distanceToPolygon(b.at, square(sp.at, d.spigot / 2)) - d.nutRadius);
      }
      if (n.axle) boltClear = Math.min(boltClear, Math.hypot(b.at[0] - n.axle[0], b.at[1] - n.axle[1]) - d.axleHole - d.nutRadius);
    }
    atLeast(`${title(n.name)}: bolts clear of the other tubes`, boltClear, MIN_LIGAMENT);

    const e = extent(n);
    const long = Math.max(e.uMax - e.uMin, e.vMax - e.vMin);
    const short = Math.min(e.uMax - e.uMin, e.vMax - e.vMin);
    const height = d.thickness + (n.spigots.length ? d.spigotLength : 0);
    const fits =
      Math.min(Math.max(p.bedX, p.bedY) - long, Math.min(p.bedX, p.bedY) - short, p.bedZ - height);
    atLeast(`${title(n.name)}: fits the printer bed`, fits, 0);
  }

  // No two nodes on a side frame may touch: each needs its own stretch of tube.
  let closest = Infinity;
  let pair = '';
  for (let i = 0; i < specs.length; i++) {
    for (let j = i + 1; j < specs.length; j++) {
      const [a, b] = [specs[i]!, specs[j]!];
      const gap = overlaps(a.outline, b.outline)
        ? 0
        : Math.min(
            ...a.outline.map((q) => distanceToPolygon(q, b.outline)),
            ...b.outline.map((q) => distanceToPolygon(q, a.outline)),
          );
      if (gap < closest) {
        closest = gap;
        pair = `${a.name} and ${b.name}`;
      }
    }
  }
  atLeast(`Nodes clear of each other (closest: ${pair})`, closest, 3);

  return checks;
}

export const title = (name: NodeName) => `${name[0]!.toUpperCase()}${name.slice(1)} node`;

// ---------------------------------------------------------------------------
// Holes to drill in the tubes
// ---------------------------------------------------------------------------

export interface Hole {
  /** From the member's `from` end, along it. */
  readonly at: number;
  readonly diameter: number;
  /** Which pair of faces it goes through. */
  readonly through: 'sides' | 'top and bottom' | 'front and back';
  readonly for: string;
  /** The node, or the front beam's parts, that the hole's bolt or axle belongs to. */
  readonly node: HoleSource;
}

/** The holes in each member, left side frame (the right is the same), and in the cross members. */
export function holes(l: Layout, specs: readonly NodeSpec[] = nodes(l)): Map<string, Hole[]> {
  const p = l.params;
  const d = nodeDims(l);
  const bolt = p.boltDiameter + DRILL_CLEARANCE;
  const byName = new Map<string, Member>(l.members.map((m) => [m.name, m]));
  const out = new Map<string, Hole[]>();
  const add = (member: string, hole: Hole) => out.set(member, [...(out.get(member) ?? []), hole]);

  /** Distance along a member from its `from` end to a point. */
  const distance = (m: Member, q: Vec3) => {
    const dir = [m.to[0] - m.from[0], m.to[1] - m.from[1], m.to[2] - m.from[2]].map((v) => v / m.length);
    return (q[0] - m.from[0]) * dir[0]! + (q[1] - m.from[1]) * dir[1]! + (q[2] - m.from[2]) * dir[2]!;
  };

  for (const n of specs) {
    for (const b of boltPoints(n)) {
      const m = byName.get(`${b.seat.member} left`);
      if (!m) continue;
      add(m.name.replace(/ left$/, ''), {
        at: distance(m, [b.at[0], l.railY, b.at[1]]),
        diameter: bolt,
        through: 'sides',
        for: `${n.name} node bolt`,
        node: n.name,
      });
    }
    for (const sp of n.spigots) {
      const m = byName.get(sp.member)!;
      for (const end of [0, m.length]) {
        add(sp.member, {
          at: end === 0 ? p.boltInset : m.length - p.boltInset,
          diameter: bolt,
          through: 'top and bottom',
          for: `${n.name} node spigot bolt`,
          node: n.name,
        });
      }
    }
    for (const t of n.tunnels) {
      const m = byName.get(t.member)!;
      for (const y of [l.railY + d.thickness / 2, l.railY - d.thickness / 2]) {
        for (const side of [1, -1]) {
          add(t.member, {
            at: distance(m, [t.at[0], side * y, t.at[1]]),
            diameter: bolt,
            through: 'front and back',
            for: `${n.name} node bolt`,
            node: n.name,
          });
        }
      }
    }
  }
  for (const [name, list] of out) out.set(name, [...list].sort((a, b) => a.at - b.at));
  return out;
}
