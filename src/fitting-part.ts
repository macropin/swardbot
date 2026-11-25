/**
 * One clamped-on fitting, as a part: built from the layout at any set of its
 * parameters, centred on the bed as it prints, with its declared extent for
 * `brep verify`. Each fitting's src/*.brep.ts module is one of these. See
 * ./fittings.ts.
 */
import { translate, type ValidSolid } from 'brepjs';

import { extentOf, local, type FittingName } from './fittings-solid.js';
import { finish } from './finish.js';
import { engrave, labelOptions } from './label.js';
import { fittings } from './fittings.js';
import { defaults, layout, schema as layoutSchema, type LayoutParams } from './layout.js';
import type { Schema } from './params.js';

/** What a user may change on a fitting: its own group's dimensions, and the walls and fits it shares with the nodes. */
function schemaFor(groups: readonly string[]): Schema<LayoutParams> {
  const shared = new Set([
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
  return Object.fromEntries(
    Object.entries(layoutSchema).filter(([name, spec]) => shared.has(name) || groups.includes(spec?.group ?? '')),
  );
}

/** The label engraved into each fitting, to tell it apart once printed. */
const LABELS: Record<FittingName, string> = {
  'battery-stop': 'BATT STOP',
  'deck-hanger-block': 'DECK BLOCK',
  'deck-plate': 'DECK PLATE',
  'electronics-backplate': 'BACKPLATE',
  'electronics-rail-cap': 'RAIL CAP',
  'antenna-mount': 'ANTENNA',
  'estop-housing': 'ESTOP',
  'estop-clamp': 'ESTOP CLAMP',
  'axle-clamp': 'AXLE CLAMP',
};

export function fittingPart(name: FittingName, groups: readonly string[]) {
  function design(params: LayoutParams = defaults) {
    const l = layout(params);
    const f = fittings(l);
    const e = extentOf(name, l, f);
    const centre: [number, number] = [(e.x[0] + e.x[1]) / 2, (e.y[0] + e.y[1]) / 2];

    function model(): ValidSolid {
      const finished = finish(
        translate(local(name, l, f), [-centre[0], -centre[1], -e.z[0]]),
        { edge: params.edgeChamfer, corner: params.cornerChamfer },
        name,
      );
      return engrave(finished, LABELS[name], labelOptions(params), name);
    }

    // -----------------------------------------------------------------------
    // Declared intent — asserted by `brep verify --check`
    // -----------------------------------------------------------------------

    const [w, d] = [e.x[1] - e.x[0], e.y[1] - e.y[0]];
    const expected = {
      bounds: { xMin: -w / 2, xMax: w / 2, yMin: -d / 2, yMax: d / 2, zMin: 0, zMax: e.z[1] - e.z[0] },
      tolerancePct: 0.1,
    };

    return { model, expected };
  }

  return { defaults, schema: schemaFor(groups), design };
}
