/**
 * Axle clamp: print two, one for each drive wheel.
 *
 * A block round the hub motor's axle, between the rear node and the wheel. Its
 * bore is flatted to fit the axle's flats, which key the motor's stator against
 * its torque, and slit through to the front: a bolt across the slit pinches it
 * shut on the flats, taking up any play. Four bolts through it and the rear
 * node's solid boss hold it to the frame.
 *
 * As exported it lies as it prints: the face that meets the rear node down, the
 * bore standing up. See ./fittings.ts.
 */
import { fittingPart } from './fitting-part.js';

export const { defaults, schema, design } = fittingPart('axle-clamp', ['Drive wheels']);

const standard = design();

export const { expected } = standard;

export default function axleClamp() {
  return standard.model();
}
