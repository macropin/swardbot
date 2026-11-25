/**
 * GPS antenna mount: print two, one for each end of the top bar.
 *
 * A socket over the top bar's end, pinned through it, with a pedestal on top.
 * The antenna's 5/8" bolt slides head first into a slot under the pedestal, its
 * shank standing up through the top, and the antenna screws on to it.
 *
 * As exported it lies as it prints, with no supports. See ./fittings.ts.
 */
import { fittingPart } from './fitting-part.js';

export const { defaults, schema, design } = fittingPart('antenna-mount', ['Electronics']);

const standard = design();

export const { expected } = standard;

export default function antennaMount() {
  return standard.model();
}
