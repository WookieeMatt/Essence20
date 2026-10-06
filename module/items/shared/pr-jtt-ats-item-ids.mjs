/**
 * Compendium ids for the pr1 extension modules (A Jump Through Time, Across the Stars, Beneath the
 * Helmet, Adventures in Angel Grove items).
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
  // Across the Stars
  standBehindMe: ats('PcezfGdjUtNUZHYH'),
};
