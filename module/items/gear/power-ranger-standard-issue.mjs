import { TSafe as T } from "../shared/item-lang.mjs";

/**
 * Standard Issue (PR CRB, p.103): every Ranger's kit - Power Morpher, Wrist Communicator, Power Suit,
 * Blade Blaster, and a Role-specific second Power Weapon. The package item grants the three fixed pieces; the suit style and
 * the Role's Power Weapon are choices, asked for once the package lands on the actor.
 *
 * (Unique Weapon, the Green Ranger's: Survivor's d20 at Smarts 0 is the Perk's own essenceChanged Trigger. Unique
 * Weapon's pick-or-roll Use is the Perk's own Use rule (choose + a 1d4 table); the Ranged weapon's store / draw Uses and
 * its natural-1 risk, the Small Melee's halved summon time (SummonTime) and the Two-Handed Melee's -10 ft (Movement at
 * the derivedHook stage) are the weapons' own rules. Megaform Expeditor (JoinTime) and Peerless Pilot (AutoDisembark,
 * its Edges) are their Perks' own rules.)
 */
const STANDARD_ISSUE = 'Power Ranger Standard Issue';
const POWER_SUITS_FOLDER = 'JfpzK64lCwnQH5v2';

export function isStandardIssueLanding(item, changes) {
  return changes?.flags?.essence20?.equipmentPackage?.name == STANDARD_ISSUE && item?.name == 'Power Morpher';
}

export async function issueSuitAndWeapon(actor) {
  const { findItems, grantCopy, pickOne } = await import("../../mechanics/resources/grants.mjs");
  const tag = { equipmentPackage: { name: STANDARD_ISSUE, packageType: 'standardIssue' } };
  const suits = await findItems({ type: 'armor', matches: entry => entry.folder == POWER_SUITS_FOLDER && entry.name != 'Clothes' });
  const suit = await pickOne(T('Pr3PickPowerSuit'), suits);
  if (suit) {
    await grantCopy(actor, suit, { flags: tag });
  }

  const weapons = await findItems({
    type: 'weapon',
    matches: entry => String(entry.uuid).startsWith('Compendium.essence20.pr_crb.')
      && (entry.system?.traits ?? []).includes('powerWeapon') && !/Blade Blaster|Unique Weapon/.test(entry.name),
  });
  const weapon = await pickOne(T('Pr3PickPowerWeapon'), weapons);
  if (weapon) {
    await grantCopy(actor, weapon, { flags: tag });
  }
}

Hooks.on('updateItem', (item, changes, options, userId) => {
  if (userId == game.user?.id && item.parent instanceof Actor && isStandardIssueLanding(item, changes)) {
    issueSuitAndWeapon(item.parent);
  }
});
