/**
 * The drill jig for the frame's tubes, from the holes the parts need
 * (./holes.ts).
 *
 * Every tube end held in a node, or on a spigot or in an antenna mount, has its
 * holes the same distances from the end: `boltInset`, and `boltPitch` further
 * on. So one jig drills them all. It's a sleeve that slides onto a tube's end
 * until the end meets its stop; guide holes through its top and bottom walls put
 * the holes at their distances, and the drill goes through both of the tube's
 * walls in one pass, guided going in and coming out. A boss round each guide on
 * top keeps the drill square.
 *
 * Holes further along a tube, where a node or a fitting clamps on part way
 * along, are drilled through that part instead, clamped on at its place.
 */
import type { Check, Layout } from './layout.js';
import { allHoles } from './holes.js';
import type { Hole } from './nodes.js';

export const jigDefaults = {
  /** Sleeve walls around the tube, and the end stop's thickness. */
  jigWall: 4,
  jigEnd: 4,
  /** Sleeve on past the last hole. */
  jigMargin: 12,
  /** Clearance of the sleeve on the tube, in total. */
  jigFit: 0.4,
  /** Guide bosses: how tall they stand on top, and their wall around the guide hole. */
  jigBoss: 8,
  jigBossWall: 4,
  /** Guide hole over its drill. */
  jigHoleFit: 0.2,
  /** Biggest hole a jig guides at full size; bigger ones get a pilot this size. */
  jigPilot: 6.5,
} as const;

export type JigParams = { readonly [K in keyof typeof jigDefaults]: number };

export type JigName = 'end';

export interface JigHole {
  /** From the tube's end, against the end stop. */
  readonly at: number;
  /** The hole's finished size. */
  readonly diameter: number;
  /** The guide's size: the hole's, or a pilot's if it's bigger. */
  readonly guide: number;
}

export interface JigUse {
  readonly member: string;
  /** Which end of the member the jig goes on: the `from` end, the `to` end, or both. */
  readonly end: 'from' | 'to' | 'both';
}

export interface JigSpec {
  readonly name: JigName;
  readonly title: string;
  readonly uses: readonly JigUse[];
  readonly through: Hole['through'];
  readonly holes: readonly JigHole[];
  /** Tube ends this jig drills, both side frames together. */
  readonly count: number;
}

/**
 * The end jig; every tube end's holes checked against it; and the holes left
 * over, part way along the tubes, which are drilled through the parts.
 */
export function drillJigs(l: Layout, jig: JigParams = jigDefaults) {
  const p = l.params;
  const list = allHoles(l);
  const standard = [p.boltInset, p.boltInset + p.boltPitch];
  /** A hole this near an end is that end's, and must sit at a standard distance. */
  const reach = standard[1]! + p.boltPitch / 2;
  const length = (member: string) =>
    (l.members.find((m) => m.name === `${member} left`) ?? l.members.find((m) => m.name === member))!.length;
  const perSide = (member: string) => (l.members.some((m) => m.name === `${member} left`) ? 2 : 1);

  const uses: JigUse[] = [];
  const offStandard: string[] = [];
  const mid = new Map<string, Hole[]>();
  let count = 0;
  for (const [member, holes] of list) {
    const L = length(member);
    const ends = { from: [] as number[], to: [] as number[] };
    for (const h of holes) {
      if (h.at <= reach) ends.from.push(h.at);
      else if (L - h.at <= reach) ends.to.push(L - h.at);
      else mid.set(member, [...(mid.get(member) ?? []), h]);
    }
    for (const end of ['from', 'to'] as const) {
      if (!ends[end].length) continue;
      count += perSide(member);
      for (const at of ends[end]) {
        if (!standard.some((s) => Math.abs(s - at) < 0.05)) offStandard.push(`${member} ${end} end, ${at.toFixed(1)}`);
      }
    }
    const used = (['from', 'to'] as const).filter((e) => ends[e].length);
    if (used.length) uses.push({ member, end: used.length === 2 ? 'both' : used[0]! });
  }

  const bolt = p.boltDiameter + 0.5;
  const spec: JigSpec = {
    name: 'end',
    title: 'Every tube end',
    uses,
    through: 'sides',
    holes: standard.map((at) => ({ at, diameter: bolt, guide: Math.min(bolt, jig.jigPilot) })),
    count,
  };

  const checks: Check[] = [
    {
      name: 'Drill jig: every tube end’s holes at the standard distances',
      ok: offStandard.length === 0,
      value: offStandard.length,
      unit: '',
      limit: '0 off',
    },
  ];
  const fits = p.bedX - jigDims(l, spec, jig).length;
  checks.push({ name: 'Drill jig: fits the printer bed', ok: fits >= 0, value: fits, unit: 'mm', limit: '≥ 0' });

  return { jigs: [spec], checks, offStandard, mid };
}

/** A jig's sleeve: its bore and outside, its length, and how tall it stands with its bosses. */
export function jigDims(l: Layout, j: JigSpec, jig: JigParams = jigDefaults) {
  const bore = l.tube.size + jig.jigFit;
  const outside = bore + 2 * jig.jigWall;
  const last = Math.max(...j.holes.map((h) => h.at + h.guide / 2 + jig.jigBossWall));
  const length = jig.jigEnd + last + jig.jigMargin;
  const bossRadius = (h: JigHole) => (h.guide + jig.jigHoleFit) / 2 + jig.jigBossWall;
  return { bore, outside, length, height: outside + jig.jigBoss, bossRadius };
}
