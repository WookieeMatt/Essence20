import { actorHasZordFeature } from "./zord-features.mjs";

/**
 * Zord Mega-Weapon System (PR CRB, Zord Feature, p.139): "The Zord has a special weapon, be it like
 * a giant sword for melee or a fire-throwing dragon's head for ranged, that it can call into being
 * from the Morphin Grid. It costs a total of 5 Personal Power expended from any combination of the
 * Crew to bring into being, and lasts for 1d2+1 attacks (hit or miss) before it would need to be
 * paid for again. This special weapon inflicts a base of 5 damage. The weapon system and its kind
 * of damage (energy, fire, etc.) are decided when the Zord Feature is acquired. This Zord Feature
 * can be used while part of a Megaform."
 *
 * Two things here are new to this codebase, which is why this Feature sat unbuilt:
 *
 * 1. A cost POOLED ACROSS MULTIPLE ACTORS. Every other Personal Power spend (Warrior Mode, Wisdom
 *    of the Elders) draws from exactly one actor, so those just check one balance and deduct. RAW
 *    says "any combination of the Crew", so this walks the Zord's whole crew, checks the COMBINED
 *    total, then draws from each in turn until the cost is met.
 * 2. A multi-use DURATION COUNTER. Warrior Mode and Combat Stance are on/off flags; Relic Key is a
 *    single-roll grant. This one has to survive a specific number of attacks, so the flag holds a
 *    remaining-attacks count that documents/item.mjs decrements as the weapon is rolled, clearing
 *    itself at zero.
 *
 * The weapon itself is a real weapon/weaponEffect pair created on the Zord when the Feature is
 * dropped (sheet-handlers/zord-feature-handler.mjs), so its damage type can be "decided when the
 * Zord Feature is acquired" per RAW and the attack is rollable from the sheet like any other. This
 * flag only controls whether it's currently paid for.
 */
const MEGA_WEAPON_ID = "Compendium.essence20.pr_crb.Item.Wc1FJ5YDeTQS6XoE";
const MEGA_WEAPON_FLAG = 'megaWeaponAttacksRemaining';
const MEGA_WEAPON_COST = 5;
const MEGA_WEAPON_DAMAGE = 5;

/**
 * Marks the weaponEffect created for this Feature, so documents/item.mjs can tell a Mega-Weapon
 * attack from any other attack the Zord makes without matching on its name.
 */
const MEGA_WEAPON_EFFECT_FLAG = 'isMegaWeapon';

/**
 * @param {Actor} actor
 * @returns {Number}   Attacks left on the currently-summoned weapon; 0 when not summoned.
 */
export function getMegaWeaponAttacksRemaining(actor) {
  return actor?.getFlag?.('essence20', MEGA_WEAPON_FLAG) ?? 0;
}

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isMegaWeaponActive(actor) {
  return getMegaWeaponAttacksRemaining(actor) > 0;
}

/**
 * Every crew member of a Zord that can currently contribute Personal Power, as resolved actors.
 * Unlike getVehicleDriver this deliberately ignores vehicleRole - RAW pools from "any combination
 * of the Crew", drivers and passengers alike.
 * @param {Actor} actor
 * @returns {Actor[]}
 */
function getCrew(actor) {
  return Object.values(actor.system?.actors ?? {})
    .map(entry => fromUuidSync(entry.uuid))
    .filter(crew => crew && (crew.system?.powers?.personal?.value ?? 0) > 0);
}

/**
 * Summons the Mega-Weapon: pools 5 Personal Power from the crew and rolls its 1d2+1 lifespan.
 * Refused (with a warning, nothing spent) when the Zord doesn't hold the Feature, the weapon is
 * already summoned, or the crew can't cover the cost between them.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether it was summoned.
 */
export async function summonMegaWeapon(actor) {
  if (!actor || actor.type != 'zord' || !actorHasZordFeature(actor, MEGA_WEAPON_ID)) {
    return false;
  }

  if (isMegaWeaponActive(actor)) {
    ui.notifications.warn(game.i18n.localize('E20.MegaWeaponAlreadySummoned'));
    return false;
  }

  const crew = getCrew(actor);
  const available = crew.reduce((sum, member) => sum + member.system.powers.personal.value, 0);
  if (available < MEGA_WEAPON_COST) {
    ui.notifications.warn(game.i18n.format('E20.MegaWeaponCannotAfford', {
      cost: MEGA_WEAPON_COST, available,
    }));
    return false;
  }

  // Drawn in crew order until the cost is met - RAW leaves the split up to the players, and any
  // split that covers 5 is legal, so this takes the simplest one rather than prompting for a
  // breakdown the table can just as easily agree on out loud.
  let remaining = MEGA_WEAPON_COST;
  const contributors = [];
  for (const member of crew) {
    if (remaining <= 0) {
      break;
    }

    const spend = Math.min(remaining, member.system.powers.personal.value);
    await member.update({ 'system.powers.personal.value': member.system.powers.personal.value - spend });
    contributors.push(`${member.name} (${spend})`);
    remaining -= spend;
  }

  const lifespan = await new Roll('1d2+1').evaluate();
  await actor.setFlag('essence20', MEGA_WEAPON_FLAG, lifespan.total);

  ChatMessage.create({
    content: game.i18n.format('E20.MegaWeaponSummoned', {
      name: actor.name,
      attacks: lifespan.total,
      contributors: contributors.join(', '),
    }),
    speaker: ChatMessage.getSpeaker({ actor }),
  });

  return true;
}

/**
 * Spends one of the summoned weapon's remaining attacks. Called from documents/item.mjs as the
 * Mega-Weapon's own weaponEffect is rolled - RAW counts the attack "hit or miss", so this fires on
 * the roll itself rather than on a result.
 * @param {Actor} actor
 * @param {Item} item   The weaponEffect being rolled.
 */
export async function consumeMegaWeaponAttack(actor, item) {
  if (!item?.getFlag?.('essence20', MEGA_WEAPON_EFFECT_FLAG) || !isMegaWeaponActive(actor)) {
    return;
  }

  const remaining = getMegaWeaponAttacksRemaining(actor) - 1;
  if (remaining > 0) {
    await actor.setFlag('essence20', MEGA_WEAPON_FLAG, remaining);
    return;
  }

  await actor.unsetFlag('essence20', MEGA_WEAPON_FLAG);
  ChatMessage.create({
    content: game.i18n.format('E20.MegaWeaponExpended', { name: actor.name }),
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

export { MEGA_WEAPON_ID, MEGA_WEAPON_EFFECT_FLAG, MEGA_WEAPON_DAMAGE, MEGA_WEAPON_COST };
