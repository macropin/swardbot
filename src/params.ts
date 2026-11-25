/**
 * Parameters a user may change, for the online generator (web/).
 *
 * Each part module exports:
 *
 * - `defaults`: every dimension the part is built from, as printed from this
 *   repo.
 * - `schema`: which of those a user may change, and within what range. Every
 *   value in range should build a valid, printable part; `make sweep` checks
 *   each limit.
 * - `design(params)`: the part built from any set of parameters, returning its
 *   `model` and its declared intent, `expected`.
 *
 * Its default export is the part at its defaults, as the brep CLI expects.
 *
 * Every parameter is a number, so a set of them goes in a URL as it is. A
 * feature that is either there or not is a toggle: 1 to include it, 0 to
 * leave it off. A choice between a few forms numbers its options.
 */

interface CommonSpec {
  /** Field label, in sentence case. */
  readonly label: string;
  /** One line under the field. */
  readonly help?: string;
  /** The form section it goes in: Dimensions unless set. */
  readonly group?: string;
  /**
   * Shown, and used, only while each named parameter has one of the listed
   * values, or lies in the given range: a hole's diameter only while the part
   * has holes, holes over a gap only while the gap leaves room for a nut.
   */
  readonly when?: Readonly<Record<string, Condition>>;
}

/** The values of another parameter under which one applies: a list, or a range. */
export type Condition = readonly number[] | { readonly min?: number; readonly max?: number };

/** A dimension, set on a slider within its range. */
export interface DimensionSpec extends CommonSpec {
  readonly kind?: 'dimension';
  /** None for a count, which also takes whole numbers only: a `step` of 1. */
  readonly unit: 'mm' | '°' | '';
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/** A feature that is either included (1) or left off (0). */
export interface ToggleSpec extends CommonSpec {
  readonly kind: 'toggle';
  /** Its range, so `make sweep` builds the part with it off and on. */
  readonly min: 0;
  readonly max: 1;
}

/** One of a few forms of a feature, each numbered. */
export interface ChoiceSpec extends CommonSpec {
  readonly kind: 'choice';
  readonly options: readonly { readonly value: number; readonly label: string }[];
}

export type ParamSpec = DimensionSpec | ToggleSpec | ChoiceSpec;

/** Whether a parameter applies, given the values of the others. */
export function applies(spec: ParamSpec, values: Readonly<Record<string, number>>): boolean {
  return Object.entries(spec.when ?? {}).every(([name, condition]) => {
    const value = values[name];
    if (value === undefined) return false;
    if (Array.isArray(condition)) return condition.includes(value);
    const { min = -Infinity, max = Infinity } = condition as { min?: number; max?: number };
    return value >= min && value <= max;
  });
}

/** A part's parameters: the shape of its defaults, every value a number. */
export type Numeric<T> = { readonly [K in keyof T]: number };

/** The parameters of `P` that a user may change, each with its range. */
export type Schema<P> = { readonly [K in keyof P]?: ParamSpec };

/** Whether a toggle is on. */
export const on = (value: number): boolean => value !== 0;

/** The printed-fit slop. Every part that plugs into a cutout or a groove takes it. */
export const fitToleranceSpec: DimensionSpec = {
  label: 'Fit tolerance',
  unit: 'mm',
  min: 0,
  max: 1,
  step: 0.05,
  help: 'Clearance taken off each fit in total. Raise it if parts print tight.',
  group: 'Fit',
};

/** A parameter combination that would build an unprintable or broken part. */
export class DesignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignError';
  }
}

/** Throws a `DesignError` unless `value` is at least `min`. */
export function atLeast(what: string, value: number, min: number): void {
  if (!(value >= min - 1e-9)) {
    throw new DesignError(`${what} would be ${round(value)} mm, under the ${min} mm minimum`);
  }
}

const round = (v: number) => Math.round(v * 100) / 100;
