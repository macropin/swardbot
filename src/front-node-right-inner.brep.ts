/**
 * Front node, right side, inner half: with a spigot for the front cross member.
 *
 * As exported it lies as it prints: split face down, no supports. See
 * ./nodes.ts for what the nodes hold and ./node-solid.ts for how a half is built.
 */
import { nodePart } from './node-part.js';

export const { defaults, schema, design } = nodePart('front', 'inner', 'right');

const standard = design();

export const { expected } = standard;

export default function frontNodeRightInner() {
  return standard.model();
}
