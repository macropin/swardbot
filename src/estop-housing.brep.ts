/**
 * E-stop housing: print one.
 *
 * The upper half of a clamp on the top bar's middle, with a box on top for a
 * 22 mm e-stop button and its contact block. The cable leaves through the back.
 * Drill the bar through it.
 *
 * As exported it lies as it prints, with no supports. See ./fittings.ts.
 */
import { fittingPart } from './fitting-part.js';

export const { defaults, schema, design } = fittingPart('estop-housing', ['Electronics']);

const standard = design();

export const { expected } = standard;

export default function estopHousing() {
  return standard.model();
}
