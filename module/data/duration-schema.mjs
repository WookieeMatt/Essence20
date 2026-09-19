import { E20 } from "../helpers/config.mjs";

import { makeInt, makeStr, makeStrWithChoices } from "./generic-makers.mjs";

const fields = foundry.data.fields;

/**
 * How long a spell or Power's effect lasts, shared between SpellItemData
 * (module/data/item/spell.mjs) and PowerItemData (module/data/item/power.mjs).
 *
 * This used to be a single free-text string, which read fine on a sheet but couldn't be reasoned
 * about at all - and the authored content showed exactly what free text produces: "1 scene" and
 * "1 Scene", "3 rounds" and "3 Rounds", a "1 day " with a trailing space, plus one-off phrasings
 * like "4 rounds or until disrupted" and "Special". Nothing could tell an Instant spell from a
 * four-round one, which is precisely the distinction an Area of Effect needs in order to know
 * whether its placed Region is thrown away immediately or persists on the scene (see
 * helpers/aoe-targeting.mjs's own `create` flag).
 *
 * `text` exists so restructuring stays LOSSLESS. A phrase like "4 rounds or until disrupted"
 * carries a cap this system CAN automate (4 rounds) plus an early-end condition it can't; parsing
 * it down to `{units: 'rounds', value: 4}` alone would silently drop the second half from the
 * sheet. When the parse doesn't account for the whole string, the author's original wording is
 * kept here and displayed verbatim instead of the generated label, so a reader still sees every
 * word the book printed. Blank for the overwhelming majority, whose duration is fully expressed
 * by units/value.
 * @returns {Object}   A plain object of schema fields, spread into the caller's own defineSchema().
 */
export const durationSchema = () => ({
  duration: new fields.SchemaField({
    units: makeStrWithChoices(Object.keys(E20.durationUnits), 'instant'),
    // Null for the unit-less units (instant/special), which have no count to carry.
    value: makeInt(null),
    text: makeStr(''),
  }),
});

// Recognised unit words, each mapped to the E20.durationUnits key it means. Both singular and
// plural spellings appear in the authored content ("1 round" alongside "3 rounds"), and the match
// is case-insensitive because "1 scene" and "1 Scene" both exist.
const UNIT_WORDS = [
  [/^rounds?$/i, 'rounds'],
  [/^(?:minutes?|mins?)$/i, 'minutes'],
  [/^(?:hours?|hrs?)$/i, 'hours'],
  [/^days?$/i, 'days'],
  [/^scenes?$/i, 'scenes'],
];

/**
 * Parses one of the legacy free-text duration strings into the structured shape above. Pure, and
 * unit tested against every spelling that actually occurs in the compendium content - this runs
 * once per item during migration, where getting it wrong is silent and permanent.
 *
 * Anything it can't recognise becomes `special` with the original text preserved, rather than a
 * guess: an unrecognised duration that quietly became "1 round" would be far worse than one the
 * GM has to read for themselves.
 * @param {String} raw   The authored duration string, e.g. "3 rounds" or "Instant".
 * @returns {{units: String, value: Number|null, text: String}}
 */
export function parseDurationString(raw) {
  const text = (raw ?? '').trim();
  if (!text) {
    return { units: 'instant', value: null, text: '' };
  }

  if (/^instant(?:aneous)?$/i.test(text)) {
    return { units: 'instant', value: null, text: '' };
  }

  if (/^special$/i.test(text)) {
    return { units: 'special', value: null, text: '' };
  }

  const match = text.match(/^(\d+)\s+([a-z]+)\b(.*)$/i);
  if (match) {
    const units = UNIT_WORDS.find(([pattern]) => pattern.test(match[2]))?.[1];
    if (units) {
      // Anything past the recognised "<n> <unit>" is a qualifier this system can't express (e.g.
      // "or until disrupted") - keep the whole original string so the sheet still shows it.
      const hasQualifier = !!match[3].trim();
      return { units, value: Number(match[1]), text: hasQualifier ? text : '' };
    }
  }

  return { units: 'special', value: null, text };
}

/**
 * Whether a duration describes something that persists after the roll resolves - i.e. whether an
 * Area of Effect with this duration should leave a Region on the scene rather than being thrown
 * away the moment it's decided who it caught.
 *
 * `special` counts as lingering: a duration nobody could parse is far more likely to be some
 * ongoing condition than an instantaneous one, and leaving a Region the GM can delete by hand is
 * a better failure than silently discarding an area that should have stayed.
 * @param {{units: String, value: Number|null}} duration
 * @returns {Boolean}
 */
export function isLingering(duration) {
  return !!duration && duration.units != 'instant';
}

/**
 * The display string for a duration - the author's own preserved wording when the parse couldn't
 * account for all of it, otherwise a generated "<n> <unit>" label. Singular and plural unit names
 * are separate localization keys rather than an appended "(s)", since this shows up in a chip on
 * the character sheet where "1 Scene(s)" would read badly.
 * @param {{units: String, value: Number|null, text: String}} duration
 * @returns {String}
 */
export function formatDuration(duration) {
  if (!duration) {
    return '';
  }

  if (duration.text) {
    return duration.text;
  }

  const isCounted = duration.value != null && !!E20.durationUnitsSingular[duration.units];
  if (!isCounted) {
    return game.i18n.localize(E20.durationUnits[duration.units] ?? '');
  }

  const unitKey = duration.value == 1
    ? E20.durationUnitsSingular[duration.units]
    : E20.durationUnits[duration.units];
  return `${duration.value} ${game.i18n.localize(unitKey)}`;
}
