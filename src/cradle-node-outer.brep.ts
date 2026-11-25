/**
 * Cradle node, outer half: print two, one for each side frame.
 *
 * The cradle node sits on the front rail over the battery cradle's front floor tube. It encloses the cradle hanger, and the inner half carries the front floor tube's end on a spigot. It's the same fore and aft, so the left and
 * right side frames' outer halves are the same part.
 *
 * As exported it lies as it prints: split face down, no supports. See
 * ./nodes.ts for what the nodes hold and ./node-solid.ts for how a half is built.
 */
import { nodePart } from './node-part.js';

export const { defaults, schema, design } = nodePart('cradle', 'outer', 'left');

const standard = design();

export const { expected } = standard;

export default function cradleNodeOuter() {
  return standard.model();
}
