/**
 * Compendium ids for the pr1 extension modules (A Jump Through Time, Across the Stars, Beneath the
 * Helmet, Adventures in Angel Grove items), plus the Roll Options Dialog source check they use.
 * The lookups, side, distance and chat helpers it used to carry live in item-lookups.mjs,
 * sides.mjs, chat-lines.mjs and relayed-writes.mjs.
 */

const pack = name => id => `Compendium.essence20.${name}.Item.${id}`;
export const jtt = pack('jump_through_time');
export const ats = pack('across_the_stars');
export const bth = pack('beneath_the_helmet');
export const pradv = pack('power_rangers_adventures');

export const PR1 = {
  // A Jump Through Time
  spectrumShifted: jtt('sgRiSOX0hDIKkcMh'),
  timeDisplaced: jtt('N4OwC0gTkUtRwBKr'),
  // Across the Stars
  beAnExample: ats('zkxPG5mwAQl1vZOT'),
  lightspeedBoost: ats('sap5gMPDrWvjLCCu'),
  swatUpgrade: ats('Ce5f5pQTNTSY6xgF'),
  standBehindMe: ats('PcezfGdjUtNUZHYH'),
};

/** The Roll Options Dialog's source id for one of ours (extensions.mjs prefixes 'ext-'). */
export const kept = (options, id) => !(options?.disabledModifierSourceIds ?? []).includes(`ext-${id}`);
