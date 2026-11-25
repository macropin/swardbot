/**
 * Castor pad, one half: print four, two for each end of the front beam.
 *
 * Clamps on the end of the front beam, its end wall capping the tube. The
 * castor's plate bolts under the pair with four bolts that also clamp them.
 *
 * As exported it lies as it prints: split face down, no supports. See
 * ./front-beam.ts.
 */
import type { ValidSolid } from 'brepjs';

import { castorPadHalf } from './front-beam-solid.js';
import { finish } from './finish.js';
import { engrave, labelOptions } from './label.js';
import { frontBeam } from './front-beam.js';
import { defaults, layout, type LayoutParams } from './layout.js';
import { nodeDims } from './nodes.js';
import { frontBeamSchema } from './params-front-beam.js';

export { defaults };
export const schema = frontBeamSchema;

export function design(params: LayoutParams = defaults) {
  const l = layout(params);
  const fb = frontBeam(l);
  const d = nodeDims(l);

  function model(): ValidSolid {
    const finished = finish(castorPadHalf(l, fb), { edge: params.edgeChamfer, corner: params.cornerChamfer }, 'castor-pad');
    return engrave(finished, 'CASTOR PAD', labelOptions(params), 'castor-pad');
  }

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  const [x, y, z] = [2 * fb.pad.halfX, fb.pad.yOut - fb.pad.yIn, d.thickness];
  const expected = {
    bounds: { xMin: -x / 2, xMax: x / 2, yMin: -y / 2, yMax: y / 2, zMin: 0, zMax: z },
    tolerancePct: 0.1,
  };

  return { model, expected };
}

const standard = design();

export const { expected } = standard;

export default function castorPad() {
  return standard.model();
}
