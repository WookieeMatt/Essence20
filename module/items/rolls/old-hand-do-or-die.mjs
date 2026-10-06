import { itemsOf } from "../shared/item-lookups.mjs";

/**
 * Old Hand (G.I. Joe: Hawk's Personnel Files) - the Do Or Die bonus die's size, for Wild Idea. (Do Or Die's own
 * "add it to a posted roll" button is a CardOffer rule on the Perk - rules/conv10-slD10.test.js.)
 *
 * Do Or Die (1st level): "You gain a bonus die you can roll in case of emergencies. Once per scene,
 * after rolling a Skill Test and determining the results, you can spend a Moxie Point to roll your Do
 * Or Die bonus die and add it to your total. Use this new total to determine the result."
 * Table 05-1: the die is d2 at Old Hand levels 1-5, d4 at 6-10, d6 at 11-15, d8 at 16.
 * Moxie: "You can also spend a Moxie Point to gain an additional use of a Role Perk" - a second use in
 * the same scene costs one more Moxie.
 *
 * Wild Idea (7th level) is a DialogSwitch rule on its item (bonusDie - rules/conv10-slC10.test.js), with the same
 * die-size steps as doOrDieDie below.
 */

export function oldHandLevel(actor) {
  const level = Number(actor?.system?.level) || 0;
  const transition = Number(actor?.system?.oldHandTransitionLevel) || 0;
  return transition ? Math.max(1, level - transition + 1) : level;
}

export function doOrDieDie(actor) {
  const level = oldHandLevel(actor);
  if (level >= 16) {
    return 'd8';
  }

  if (level >= 11) {
    return 'd6';
  }

  return level >= 6 ? 'd4' : 'd2';
}

export function moxieOf(actor) {
  return actor?.items?.documentsByType?.rolePoints?.find(item => item.name == 'Moxie')
    ?? itemsOf(actor).find(item => item.type == 'rolePoints' && item.name == 'Moxie') ?? null;
}

