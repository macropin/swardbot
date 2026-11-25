/**
 * What a user may change on the front beam's parts: their own group, the
 * castors' mounting, and the nodes' walls and fits they share. The rest of the
 * layout sets where they go.
 */
import { schema as layoutSchema, type LayoutParams } from './layout.js';
import type { Schema } from './params.js';

const SHARED = new Set([
  'jointWall',
  'boltDiameter',
  'nutAcrossFlats',
  'nutThickness',
  'fitTolerance',
  'clampSqueeze',
  'edgeChamfer',
  'cornerChamfer',
  'labelHeight',
  'labelDepth',
  'labelStroke',
]);
const CASTOR = new Set(['castorBolt', 'castorBoltSpacingX', 'castorBoltSpacingY', 'castorNutAcrossFlats', 'castorNutThickness']);

export const frontBeamSchema: Schema<LayoutParams> = Object.fromEntries(
  Object.entries(layoutSchema).filter(
    ([name, spec]) => spec?.group === 'Front beam' || SHARED.has(name) || CASTOR.has(name),
  ),
);
