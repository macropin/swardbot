/**
 * Every hole to drill in the frame's tubes: the nodes', the front beam's parts'
 * and the fittings', merged by tube and sorted along it. Distances run from each
 * member's `from` end (./layout.ts).
 */
import { fittings } from './fittings.js';
import { frontBeam } from './front-beam.js';
import type { Layout } from './layout.js';
import { holes as nodeHoles, type Hole } from './nodes.js';

export function allHoles(l: Layout): Map<string, Hole[]> {
  const out = new Map<string, Hole[]>(nodeHoles(l));
  for (const extra of [frontBeam(l).holes, fittings(l).holes]) {
    for (const [member, list] of extra) out.set(member, [...(out.get(member) ?? []), ...list]);
  }
  for (const [member, list] of out) out.set(member, [...list].sort((a, b) => a.at - b.at));
  return out;
}
