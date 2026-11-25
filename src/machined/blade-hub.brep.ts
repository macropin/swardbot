/**
 * Blade hub: machine one, from aluminium (6061) or steel round bar. Not printed.
 *
 * Turned from 50 mm bar: the flange the blade clamps against, the body above
 * it, and a spigot below that locates the blade's centre hole. Bored for the
 * motor's shaft down to a floor, drilled through the floor for the centre bolt,
 * and tapped across for a set screw on the shaft's flat. See ../blade.ts.
 *
 * Exported as STEP for a machinist or an online machining service; it is never
 * exported as an STL for printing.
 */
import type { ValidSolid } from 'brepjs';

import { bladeHub } from '../blade-solid.js';
import { bladeAdapter } from '../blade.js';
import { defaults, layout, schema as layoutSchema, type LayoutParams } from '../layout.js';
import type { Schema } from '../params.js';

export { defaults };
export const schema: Schema<LayoutParams> = Object.fromEntries(
  Object.entries(layoutSchema).filter(([, spec]) => spec?.group === 'Blade'),
);

export function design(params: LayoutParams = defaults) {
  const l = layout(params);
  const b = bladeAdapter(l);
  const r = params.bladeClamp / 2;

  function model(): ValidSolid {
    return bladeHub(l, b);
  }

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  const expected = {
    bounds: { xMin: -r, xMax: r, yMin: -r, yMax: r, zMin: 0, zMax: b.hub.top - b.hub.spigotBottom },
    tolerancePct: 0.1,
  };

  return { model, expected };
}

const standard = design();

export const { expected } = standard;

export default function bladeHubPart() {
  return standard.model();
}
