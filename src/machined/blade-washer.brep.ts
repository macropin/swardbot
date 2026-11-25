/**
 * Blade washer: make one, from 50 × 5 mm steel flat bar. Not printed.
 *
 * Cut a 50 mm square from the bar, square its ends and drill its middle for the
 * centre bolt. It clamps the blade up against the hub's flange. See ../blade.ts.
 *
 * Exported as STEP for reference; it is never exported as an STL for printing.
 */
import type { ValidSolid } from 'brepjs';

import { bladeWasher } from '../blade-solid.js';
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
  const r = b.washer.size / 2;

  function model(): ValidSolid {
    return bladeWasher(l, b);
  }

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  const expected = {
    bounds: { xMin: -r, xMax: r, yMin: -r, yMax: r, zMin: 0, zMax: b.washer.thickness },
    tolerancePct: 0.1,
  };

  return { model, expected };
}

const standard = design();

export const { expected } = standard;

export default function bladeWasherPart() {
  return standard.model();
}
