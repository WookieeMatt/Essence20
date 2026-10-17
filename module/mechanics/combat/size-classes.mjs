/**
 * Size Classes, as distinct from the size list. E20.actorSizes also holds Long and the Extended sizes, which are the
 * elongated footprints of the class before them (a vehicle's shape), not a step up - so "one Size Class larger" or
 * "three Size Classes smaller" must count classes, not list positions.
 */

export const SIZE_CLASSES = ['small', 'common', 'large', 'huge', 'gigantic', 'towering', 'titanic'];
const ELONGATED = { long: 'large', extended: 'huge', extended2: 'gigantic', extended3: 'towering' };

/** The class a size belongs to (an elongated size counts as its class). */
export const sizeClassOf = size => ELONGATED[size] ?? size;

/** Position of a size's class in SIZE_CLASSES, or -1 for an unknown size. */
export const sizeClassIndex = size => SIZE_CLASSES.indexOf(sizeClassOf(size));
