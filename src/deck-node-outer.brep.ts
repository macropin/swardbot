/**
 * Deck node, outer half: print two, one for each side frame.
 *
 * The deck node sits on the front rail, carrying the deck beam's end on a spigot on the inner half. It's the same fore and aft, so the left and
 * right side frames' outer halves are the same part.
 *
 * As exported it lies as it prints: split face down, no supports. See
 * ./nodes.ts for what the nodes hold and ./node-solid.ts for how a half is built.
 */
import { nodePart } from './node-part.js';

export const { defaults, schema, design } = nodePart('deck', 'outer', 'left');

const standard = design();

export const { expected } = standard;

export default function deckNodeOuter() {
  return standard.model();
}
