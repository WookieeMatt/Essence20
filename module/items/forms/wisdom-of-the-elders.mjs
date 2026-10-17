/**
 * Wisdom of the Elders (Through the Shattered Grid, Guardian of Eltar, 9th/18th level) - the option is picked once per copy
 * (system.choice); switching it on (paying its Personal Power or Eltarian Tech Points) and off, and Teleportation, are Use
 * rules on the item (rules/conv17-split3.test.js), writing flags.essence20.wisdomOfTheEldersActive.<option>. Read by
 * dice.mjs (Lightshield Armor's Toughness, Enhanced Reflexes' Acrobatics ↑2), documents/actor.mjs (Lightfoil Wings),
 * mechanics/combat/combat.mjs (Resilient Armor), mechanics/actions/action-perks.mjs (Ferocious Strikes) and
 * check:wisdomOfTheElders (Enhanced Reflexes' Initiative rule).
 */
const WISDOM_OF_THE_ELDERS_FLAG = 'wisdomOfTheEldersActive';

/**
 * Whether the given Wisdom of the Elders option is currently switched on for this actor.
 * @param {Actor} actor
 * @param {String} option
 * @returns {Boolean}
 */
export function isWisdomOfTheEldersActive(actor, option) {
  return !!actor?.getFlag?.('essence20', WISDOM_OF_THE_ELDERS_FLAG)?.[option];
}
