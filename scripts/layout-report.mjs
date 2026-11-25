#!/usr/bin/env node
// Prints the chassis layout at its defaults, or with overrides: the key
// dimensions, the mass budget and balance, the checks, and the tube cut list.
// Exits non-zero if a check fails.
//
//   node scripts/layout-report.mjs [name=value ...] [--json out/layout.json]
//
// e.g. node scripts/layout-report.mjs bladeDiameter=400 trayDiameter=440

import './ts-hooks.mjs';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { defaults, layout } = await import(pathToFileURL(resolve('src/layout.ts')).href);
const { holes, nodeChecks, nodes, extent, nodeDims } = await import(pathToFileURL(resolve('src/nodes.ts')).href);
const { drillJigs, jigDims } = await import(pathToFileURL(resolve('src/drill-jigs.ts')).href);
const { frontBeam } = await import(pathToFileURL(resolve('src/front-beam.ts')).href);
const { fittings } = await import(pathToFileURL(resolve('src/fittings.ts')).href);
const { allHoles } = await import(pathToFileURL(resolve('src/holes.ts')).href);
const { bladeAdapter } = await import(pathToFileURL(resolve('src/blade.ts')).href);

const args = process.argv.slice(2);
const overrides = {};
let json;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') {
    json = args[++i];
    continue;
  }
  const [name, value] = args[i].split('=');
  if (!(name in defaults) || value === undefined || Number.isNaN(Number(value))) {
    console.error(`unknown or malformed parameter: ${args[i]}`);
    process.exit(2);
  }
  overrides[name] = Number(value);
}

const l = layout({ ...defaults, ...overrides });
const specs = nodes(l);
const jigs = drillJigs(l);
const fb = frontBeam(l);
const fit = fittings(l);
const blade = bladeAdapter(l);
const checks = [...l.checks, ...nodeChecks(l, specs), ...fb.checks, ...fit.checks, ...blade.checks, ...jigs.checks];

const r0 = (v) => Math.round(v).toString();
const r1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

if (Object.keys(overrides).length) {
  console.log(`overrides: ${Object.entries(overrides).map(([k, v]) => `${k}=${v}`).join(', ')}\n`);
}

const size = l.overall;
console.log('Layout');
for (const [label, value] of [
  ['overall length × width × height', `${r0(size.max[0] - size.min[0])} × ${r0(size.max[1] - size.min[1])} × ${r0(size.max[2])} mm`],
  ['wheelbase (axle to castor swivels)', `${r0(l.wheelbase)} mm`],
  ['track, drive wheels', `${r0(l.track)} mm`],
  ['track, castors', `${r0(2 * l.castor.y)} mm`],
  ['side frames, clear between', `${r0(l.frameInner)} mm`],
  ['rail height', `${r0(l.railZ)} mm`],
  ['leg slope', `${r1(l.legSlope)}°`],
  ['deck centre ahead of axle', `${r0(l.deck.x)} mm`],
  ['ground clearance under cradle', `${r0(l.groundClearance)} mm`],
  ['front pivot height', `${r0(l.pivot[2])} mm`],
]) {
  console.log(`  ${pad(label, 38)} ${value}`);
}

console.log('\nMass budget');
for (const m of l.masses) {
  console.log(`  ${pad(m.name, 26)} ${lpad(r1(m.mass), 6)} kg   at x ${lpad(r0(m.at[0]), 4)}, z ${lpad(r0(m.at[2]), 4)}`);
}
console.log(`  ${pad('total', 26)} ${lpad(r1(l.totalMass), 6)} kg`);
console.log(`  centre of gravity          x ${r0(l.cg[0])} mm ahead of the axle, z ${r0(l.cg[2])} mm up`);
console.log(`  on the castors             ${r1(l.totalMass * l.frontLoadShare)} kg (${r0(100 * l.frontLoadShare)}%)`);

console.log('\nChecks');
let failed = 0;
for (const c of checks) {
  if (!c.ok) failed++;
  const value = c.unit === '%' || c.unit === '°' ? `${r1(c.value)}${c.unit}` : `${r1(c.value)} ${c.unit}`;
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${pad(c.name, 50)} ${lpad(value, 9)}   (${c.limit}${c.unit === 'mm' ? ' mm' : c.unit})`);
}

console.log(`\nCut list: ${l.tube.size} × ${l.tube.size} × ${l.tube.wall} mm square tube, cut square`);
for (const c of l.cutList.cuts) {
  console.log(`  ${lpad(c.count, 2)} × ${lpad(r1(c.length), 7)} mm   ${c.names.join(', ')}`);
}
console.log(
  `  total ${r1(l.cutList.totalLength / 1000)} m, from ${l.cutList.stockLengths} × ${l.params.stockLength / 1000} m lengths`,
);

const d = nodeDims(l);
console.log(`\nPrinted nodes: two halves each, ${r1(2 * d.thickness)} mm thick together`);
for (const n of specs) {
  const e = extent(n);
  const spigots = n.spigots.length ? `, inner half ${r1(d.thickness + d.spigotLength)} with spigots` : '';
  console.log(`  ${pad(n.name, 6)} ${r0(e.uMax - e.uMin)} × ${r0(e.vMax - e.vMin)} × ${r1(d.thickness)} mm${spigots}`);
}

const list = allHoles(l);
console.log('\nHoles to drill, both side frames alike: from the rear end of rails and legs, the foot of posts, the right-hand end of cross members');
for (const [member, hs] of list) {
  const groups = new Map();
  for (const h of hs) {
    const key = `Ø${h.diameter} through the ${h.through}`;
    groups.set(key, [...(groups.get(key) ?? []), r1(h.at)]);
  }
  for (const [key, ats] of groups) console.log(`  ${pad(member, 20)} ${pad(key, 32)} at ${ats.join(', ')}`);
}

console.log('\nFront beam');
console.log(`  pivot at ${r0(fb.B)} mm up, rolling ±${l.params.rollLimit}° to its stops: ±${r0(l.castor.y * Math.sin((l.params.rollLimit * Math.PI) / 180))} mm at the castors`);
console.log(`  pin: M${l.params.pivotPin} × ${Math.ceil(fb.pinLength / 10) * 10} bolt, nyloc nut`);
console.log(`  stops: ${r1(fb.R - fb.hanger.stopFace)} mm below the cross member's centreline, ${r0(fb.hanger.stopIn)}–${r0(fb.hanger.stopOut)} mm out from the middle`);

console.log('\nDeck');
console.log(`  4 × M${l.params.deckRod} threaded rod, ${r0(l.deck.rodLength)} mm, at ${l.deck.rodX.map(r0).join(' and ')} mm ahead of the axle, ${r0(l.deck.rodY)} mm either side`);
console.log(`  deck plate ${r0(fit.plate.x1 - fit.plate.x0)} × ${r0(2 * fit.plate.halfY)} × ${r0(fit.plate.height)} mm, on the tray's top`);

console.log('\nBlade adapter (machined, not printed)');
console.log(`  hub: Ø${l.params.bladeClamp} flange, Ø${l.params.hubDiameter} body, ${r1(blade.hub.top - blade.hub.spigotBottom)} tall, bored Ø${l.params.motorShaft} × ${r1(blade.hub.top - blade.hub.boreBottom)} deep`);
console.log(`  washer: ${l.params.bladeClamp} × ${l.params.bladeClamp} × ${l.params.bladeWasher} mm steel flat bar`);
console.log(`  centre bolt: M${blade.bolt.size} × ${blade.bolt.length} into the shaft's end, thread-locked`);

console.log('\nAxle clamps');
const clampBolt = fit.clamp.length + 2 * nodeDims(l).thickness - nodeDims(l).nutDepth + l.params.nutThickness;
console.log(`  ${r0(2 * fit.clamp.half)} × ${r0(2 * fit.clamp.half)} × ${r0(fit.clamp.length)} mm, for a Ø${l.params.axleDiameter} axle with ${l.params.axleFlats} mm flats`);
console.log(`  4 × M${l.params.boltDiameter} × ${Math.ceil(clampBolt / 5) * 5} through the clamp and the rear node, 1 × M${l.params.boltDiameter} × ${Math.ceil((2 * fit.clamp.half + 10) / 10) * 10} pinch bolt`);

const [endJig] = jigs.jigs;
console.log(`\nDrill jig: drill-jig-end, for ${endJig.count} tube ends; holes ${endJig.holes.map((h) => r1(h.at)).join(' and ')} mm from the end`);
console.log('Holes part way along a tube, drilled through the part that clamps there:');
for (const [member, hs] of jigs.mid) {
  const byPart = new Map();
  for (const h of hs) byPart.set(h.for, [...(byPart.get(h.for) ?? []), r1(h.at)]);
  for (const [part, ats] of byPart) console.log(`  ${pad(member, 24)} ${pad(part, 26)} at ${ats.join(', ')}`);
}

if (json) {
  mkdirSync(dirname(resolve(json)), { recursive: true });
  writeFileSync(
    json,
    JSON.stringify({ ...l, checks, nodes: specs, holes: Object.fromEntries(list), drillJigs: jigs.jigs }, null, 2),
  );
  console.log(`\nwrote ${json}`);
}

if (failed) {
  console.error(`\n${failed} check${failed === 1 ? '' : 's'} failed`);
  process.exit(1);
}
