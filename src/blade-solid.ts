/**
 * The blade adapter's hub and washer, built from ./blade.ts: each in its own
 * frame (its bottom at z = 0, centred on its axis), with where it sits on the
 * mower.
 */
import { cylinder, translate, type ValidSolid } from 'brepjs';

import { bladeAdapter, type BladeAdapter } from './blade.js';
import type { Layout } from './layout.js';
import { join, OVER, remove, span } from './shapes.js';

export function bladeHub(l: Layout, b: BladeAdapter = bladeAdapter(l)): ValidSolid {
  const p = l.params;
  const h = b.hub;
  const z = (abs: number) => abs - h.spigotBottom;
  let body = cylinder(p.hubDiameter / 2, z(h.top) - z(h.flangeTop) + OVER, { at: [0, 0, z(h.flangeTop) - OVER] });
  body = join(body, cylinder(p.bladeClamp / 2, p.hubFlange, { at: [0, 0, z(h.flangeBottom)] }));
  body = join(body, cylinder(h.spigot / 2, z(h.flangeBottom) + OVER, { at: [0, 0, 0] }));
  body = remove(body, cylinder(h.bore / 2, z(h.top) - z(h.boreBottom) + OVER, { at: [0, 0, z(h.boreBottom)] }));
  body = remove(body, cylinder(h.boltHole / 2, z(h.boreBottom) + 2 * OVER, { at: [0, 0, -OVER] }));
  // The set screw's tapped hole, in from the front on to the shaft's flat.
  return remove(body, cylinder(h.setScrewTap / 2, p.hubDiameter / 2 + OVER, { at: [0, 0, z(h.setScrewZ)], axis: [1, 0, 0] }));
}

export function bladeWasher(l: Layout, b: BladeAdapter = bladeAdapter(l)): ValidSolid {
  const w = b.washer;
  const body = span(-w.size / 2, w.size / 2, -w.size / 2, w.size / 2, 0, w.thickness);
  return remove(body, cylinder(w.hole / 2, w.thickness + 2 * OVER, { at: [0, 0, -OVER] }));
}

/** The hub and washer on the mower. */
export function bladeAdapterBodies(l: Layout): ValidSolid[] {
  const b = bladeAdapter(l);
  return [
    translate(bladeHub(l, b), [l.deck.x, 0, b.hub.spigotBottom]),
    translate(bladeWasher(l, b), [l.deck.x, 0, b.washer.bottom]),
  ];
}
