/**
 * One drill jig, as a part: built from the layout's drill list at any set of
 * parameters, lying as it prints, with its declared extent for `brep verify`.
 * Each src/drill-jig-*.brep.ts module is one of these. See ./drill-jigs.ts.
 *
 * It prints on its side: the sleeve along X, the guide holes vertical so they
 * come out round, the bosses on top, and the sleeve's top wall bridged over the
 * bore. The end stop has a window in it, to see the tube's end go home against
 * it and to let chips out.
 */
import { box, cut, cylinder, fuse, translate, unwrap, type ValidSolid } from 'brepjs';

import { drillJigs, jigDefaults, jigDims, type JigName } from './drill-jigs.js';
import { defaults as layoutDefaults, layout, schema as layoutSchema, type LayoutParams } from './layout.js';
import type { Schema } from './params.js';
import { finish } from './finish.js';
import { engrave, labelOptions } from './label.js';
import { teardrop } from './shapes.js';
import { single } from './solid.js';

/** Overshoot so cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

/** The window in the end stop leaves at least this much of the stop around it for the tube's end to meet. */
const STOP_RIM = 4;

export const defaults = { ...layoutDefaults, ...jigDefaults };
export type JigPartParams = { readonly [K in keyof typeof defaults]: number };

const mm = (label: string, min: number, max: number, help?: string, step = 0.5) =>
  ({ label, unit: 'mm', min, max, step, group: 'Jig', ...(help ? { help } : {}) }) as const;

/** What a user may change on a jig: its own dimensions and fits. The layout sets where its holes go. */
export const schema: Schema<JigPartParams> = {
  jigWall: mm('Sleeve wall', 2, 8),
  jigEnd: mm('End stop', 2, 8),
  jigMargin: mm('Sleeve past the last hole', 5, 30, undefined, 1),
  jigFit: { ...mm('Fit on the tube', 0, 1, 'Clearance in total. Raise it if the jig won’t go on.', 0.05) },
  jigBoss: mm('Guide boss height', 0, 20, 'Taller guides keep a hand drill square.', 1),
  jigBossWall: mm('Guide boss wall', 2, 8),
  jigHoleFit: mm('Guide hole fit', 0, 0.6, 'Over the drill. Raise it if the drill binds.', 0.05),
  jigPilot: mm('Pilot drill', 3, 8, 'Biggest guide; bigger holes are piloted, then opened out.'),
  edgeChamfer: { ...layoutSchema.edgeChamfer!, group: 'Jig' },
  cornerChamfer: { ...layoutSchema.cornerChamfer!, group: 'Jig' },
};

export function jigPart(name: JigName) {
  function design(params: JigPartParams = defaults) {
    const l = layout(params as LayoutParams);
    const spec = drillJigs(l, params).jigs.find((j) => j.name === name);
    if (!spec) throw new Error(`no ${name} drill jig`);
    const d = jigDims(l, spec, params);
    const halfWidth = Math.max(d.outside / 2, ...spec.holes.map(d.bossRadius));

    function model(): ValidSolid {
      const { jigWall, jigEnd, jigBoss, jigHoleFit } = params;
      let jig: ValidSolid = box(d.length, d.outside, d.outside, {
        centered: true,
        at: [d.length / 2, 0, d.outside / 2],
      });
      const boreLength = d.length - jigEnd + OVER;
      jig = single(
        unwrap(
          cut(
            jig,
            box(boreLength, d.bore, d.bore, {
              centered: true,
              at: [jigEnd + boreLength / 2, 0, jigWall + d.bore / 2],
            }),
          ),
        ),
      );
      const window = d.bore / 2 - STOP_RIM;
      if (window > 1) {
        jig = single(
          unwrap(cut(jig, teardrop(window, 'x', -OVER, jigEnd + 2 * OVER, [0, d.outside / 2]))),
        );
      }
      for (const h of spec!.holes) {
        const x = jigEnd + h.at;
        if (jigBoss > 0) {
          const boss = cylinder(d.bossRadius(h), jigBoss + OVER, { at: [x, 0, d.outside - OVER] });
          jig = single(unwrap(fuse(jig, boss)));
        }
        const guide = cylinder((h.guide + jigHoleFit) / 2, d.height + 2 * OVER, { at: [x, 0, -OVER] });
        jig = single(unwrap(cut(jig, guide)));
      }
      const finished = finish(
        translate(jig, [-d.length / 2, 0, 0]),
        { edge: params.edgeChamfer, corner: params.cornerChamfer },
        `drill-jig-${name}`,
      );
      return engrave(finished, `${name.toUpperCase()} JIG`, labelOptions(params), `drill-jig-${name}`);
    }

    // -----------------------------------------------------------------------
    // Declared intent — asserted by `brep verify --check`
    // -----------------------------------------------------------------------

    const expected = {
      bounds: {
        xMin: -d.length / 2,
        xMax: d.length / 2,
        yMin: -halfWidth,
        yMax: halfWidth,
        zMin: 0,
        zMax: params.jigBoss > 0 ? d.height : d.outside,
      },
      tolerancePct: 0.1,
    };

    return { model, expected, spec };
  }

  return { defaults, schema, design };
}
