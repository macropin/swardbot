import { getSolids, unwrap, validSolid, type AnyShape, type ValidSolid } from 'brepjs';

/**
 * OCCT hands back a Compound from a boolean even when the result is one body.
 * Collapse it to a single solid — and fail loudly if a boolean ever fragments
 * the part into several.
 */
export function single(shape: AnyShape): ValidSolid {
  const solids = getSolids(shape);
  const [solid] = solids;
  if (solids.length !== 1 || !solid) {
    throw new Error(
      `expected exactly 1 solid, got ${solids.length} — a boolean fragmented the part`,
    );
  }
  return unwrap(validSolid(solid));
}
