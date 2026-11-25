/**
 * Box node, inner half: print two, one for each side frame.
 *
 * The box node sits on the post between the rear and apex nodes, carrying the two electronics rails' ends on spigots on the inner half. It's the same fore and aft, so the left and
 * right side frames' inner halves are the same part.
 *
 * As exported it lies as it prints: split face down, no supports. See
 * ./nodes.ts for what the nodes hold and ./node-solid.ts for how a half is built.
 */
import { nodePart } from './node-part.js';

export const { defaults, schema, design } = nodePart('box', 'inner', 'left');

const standard = design();

export const { expected } = standard;

export default function boxNodeInner() {
  return standard.model();
}
