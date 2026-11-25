/**
 * The blade adapter, as numbers: a hub turned from aluminium or steel, and a
 * square clamp washer cut from steel flat bar. Never printed: they carry the
 * blade, at 186 km/h at its tips.
 *
 * The hub slips up on to the motor's shaft, a set screw on the shaft's flat
 * locking it round. A spigot under its flange locates the blade's centre hole.
 * One bolt up through the washer, the blade and the hub's floor into the thread
 * in the shaft's end pulls the stack together: the blade is clamped between the
 * hub's flange and the washer, and the hub on to the shaft's end. The blade is
 * driven by friction, so it can slip on a rock rather than break something.
 *
 * Heights are absolute, at the cut drawn; they all move with the deck, so the
 * checks hold at any cut. Frame as in ./layout.ts.
 */
import type { Check, Layout } from './layout.js';

/** Standard bolt lengths to round up to. */
const LENGTHS = [10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60];

export function bladeAdapter(l: Layout) {
  const p = l.params;
  const d = l.deck;
  const bladeTop = d.bladeZ + p.bladeThickness / 2;
  const bladeBottom = d.bladeZ - p.bladeThickness / 2;
  /** The motor stands on the deck plate's base; its shaft comes down through the plate and the tray. */
  const motorFace = d.motorZ;
  const shaftTip = motorFace - p.motorShaftLength;
  const hub = {
    top: d.trayTop - p.trayThickness - p.hubClearance,
    flangeTop: bladeTop + p.hubFlange,
    flangeBottom: bladeTop,
    /** The spigot stops short of the blade's underside, so the washer clamps the blade, not the spigot. */
    spigotBottom: bladeBottom + 0.5,
    spigot: p.bladeHole - 0.2,
    /** Bore for the shaft, down to just past its tip. */
    bore: p.motorShaft,
    boreBottom: shaftTip - 0.5,
    /** The centre bolt's clearance hole, through the floor. */
    boltHole: p.motorShaftBolt + 0.5,
    setScrewZ: (d.trayTop - p.trayThickness - p.hubClearance + shaftTip) / 2,
    /** Tap drill for the set screw: about 0.8 of its size. */
    setScrewTap: Math.round(p.hubSetScrew * 0.8 * 10) / 10,
  };
  const washer = {
    size: p.bladeClamp,
    thickness: p.bladeWasher,
    top: bladeBottom,
    bottom: bladeBottom - p.bladeWasher,
    hole: p.motorShaftBolt + 0.5,
  };
  /** Bolt from under the washer to one and a half diameters into the shaft. */
  const boltNeeded = shaftTip - washer.bottom + 1.5 * p.motorShaftBolt;
  const bolt = { size: p.motorShaftBolt, length: LENGTHS.find((n) => n >= boltNeeded) ?? Math.ceil(boltNeeded) };

  const checks: Check[] = [];
  const atLeast = (name: string, value: number, min: number) =>
    checks.push({ name, ok: value >= min - 1e-9, value, unit: 'mm', limit: `≥ ${min}` });
  atLeast('Blade hub: the shaft reaches a diameter into it', hub.top - shaftTip, p.motorShaft);
  atLeast('Blade hub: floor between the shaft and the blade', hub.boreBottom - hub.flangeBottom, 4);
  atLeast('Blade hub: body above its flange', hub.top - hub.flangeTop, 5);
  atLeast('Blade hub: wall round the bore', (p.hubDiameter - p.motorShaft) / 2, 4);
  atLeast('Blade hub: spigot round the centre bolt', (hub.spigot - hub.boltHole) / 2, 1.5);
  atLeast('Blade hub: room for the set screw', hub.top - shaftTip - p.hubSetScrew, 2);
  atLeast('Blade hub: flange wider than the body', (p.bladeClamp - p.hubDiameter) / 2, 5);

  return { bladeTop, bladeBottom, shaftTip, hub, washer, bolt, checks };
}

export type BladeAdapter = ReturnType<typeof bladeAdapter>;
