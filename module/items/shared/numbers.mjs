/**
 * Number readers the item files share. num answers 0 for anything non-finite (Infinity too);
 * numLoose answers 0 only for NaN and other falsy results, so Infinity passes through.
 */

export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const numLoose = value => Number(value) || 0;
