import { registerUse, runAfterDamage, runDamageModifiers } from "../item-hooks.mjs";
import { renegadeHolderFor } from "../companions/summons.mjs";
import { isCarried } from "../actions/team-actions.mjs";
import { onOwnerDefeated } from "../companions/companions.mjs";
import { onBondedHit } from "../companions/bonded-partners.mjs";
import { protomatterReduce } from "../resources/kits.mjs";
import { isSealedAboard } from "../vehicles/vehicle-upgrades.mjs";
import {
  actorHasPerk, clearPendingBonus, findPerk, getPendingBonus, hasUsedThisEncounter, markUsedThisEncounter,
} from "../characters/perks.mjs";
import { isPersonalShieldActive } from "../../items/defenses/personal-shield.mjs";
import { PENDING_ELEMENTAL_SHIELD_FLAG_KEY } from "../../items/social/team-buffs.mjs";
import { isWisdomOfTheEldersActive } from "../../items/forms/wisdom-of-the-elders.mjs";
import { applyAtAllCostDamage, isAtAllCostActive } from "../../items/defenses/at-all-cost.mjs";
import { grantGridElementalAdaptationResistance } from "../../items/defenses/grid-elemental-adaptation.mjs";
import { AEGIS_CLAMPED_FLAG, isRecklessAbandonActive } from "../../items/rolls/reckless-abandon.mjs";
import { E20 } from "../../util/config.mjs";
import { applyEssenceAttack, isEssenceDamageType } from "./essence-attack.mjs";
import { isMonsterFormActive } from "../../items/forms/monster-morph.mjs";
import { grantNotOnMyWatchReaction } from "../../items/defenses/not-on-my-watch.mjs";
import { actorHasZordFeature } from "../vehicles/zord-features.mjs";
import { getMegaformParticipants } from "../vehicles/megaform-participants.mjs";
import { deactivateShynessOnDamage } from "../../items/resources/emotional-mastery.mjs";
import { deactivatePhantomOnDamage } from "../../items/senses/phantom.mjs";
import { consumeSelfPreservationImmunity } from "../../items/defenses/self-preservation.mjs";
import { grantSceneResistance } from "../characters/actor-token-helpers.mjs";

// Relic Key (PR CRB p.140, prerequisite Auxiliary Zord) - see getDefenseValue's own doc comment
// below for the Willpower/Cleverness default this grants while unpiloted.
const PR_CRB = "Compendium.essence20.pr_crb.Item.";
const RELIC_KEY_ID = `${PR_CRB}uSlClAv3oJjf54pa`;

// Zord Sentience (Beneath the Helmet, Zord Feature, p.72, prerequisite Energem Infusion): "The
// Zord has a default Smarts and Social of 2 when no crew is currently driving." Same
// unpiloted-default-Essence shape as Relic Key just above, a lower flat value - see
// getDefenseValue's own doc comment below. The reciprocal "Driving (Autopilot) Skill gains ↑1"
// half lives in dice.mjs instead (a Skill Test shift, not a Defense).
const BENEATH_THE_HELMET = "Compendium.essence20.beneath_the_helmet.Item.";
const ZORD_SENTIENCE_ID = `${BENEATH_THE_HELMET}idhVrfBIKELsl3OW`;

// Flame Warlord (Finster's Monster-Matic Cookbook, 20th level) - its own "while in Monster Form,
// reduce incoming damage" clause is built here, see getWarlordDamageReduction's own doc comment
// below. (Frost and Stone Warlord's reductions are their items' own DamageModifier rules; the other
// 3 Warlords - Cruel/Thorn/Venom - have no damage-reduction clause of their own, their own built
// pieces live in dice.mjs instead.)
const FMMC = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.";
const FLAME_WARLORD_ID = `${FMMC}TPrNnDxBKHIajafY`;

/**
 * Flame Warlord (Finster's Monster-Matic Cookbook, 20th level, p.288): a flat incoming-damage
 * reduction while in Monster Form - non-Element damage is reduced by 1, subtracted from the
 * incoming value before Immunity/Resistance processing.
 * @param {Actor} actor
 * @param {String} damageType
 * @returns {Number}
 */
function getWarlordDamageReduction(actor, damageType) {
  if (!isMonsterFormActive(actor)) {
    return 0;
  }

  if (actorHasPerk(actor, FLAME_WARLORD_ID) && !ENERGY_DAMAGE_TYPES.has(damageType)) {
    return 1;
  }

  return 0;
}

// Aegis (GI Joe CRB, Tank Focus, 20th level, p.99) - see its own doc comment in
// reckless-abandon.mjs. Checked here alongside Defender's Oath/Immortal Rebel Soul's identical
// "clamp newValue at 1 instead of 0" shape.
const AEGIS_ID = "Compendium.essence20.gi_joe_crb.Item.0ZTjZ36gN74889am";
// Not Done Yet - see its own check near AEGIS_ID's identical-shaped clamp below.
const NOT_DONE_YET_ID = "Compendium.essence20.gi_joe_crb.Item.wGAWnAM5zUgcNP9c";

const IMPENETRABLE_SHIELD_ID = "Compendium.essence20.gi_joe_crb.Item.eEUl7OA9yWAk0QD3";

// We are the Coinless (Through the Shattered Grid, Coinless Resistance Origin Benefit, p.20) - see
// findCoinlessRescuers's own doc comment below.
const WE_ARE_THE_COINLESS_ID = "Compendium.essence20.through_the_shattered_grid.Item.DRHPP4jmrjNa53ZA";

/**
 * We are the Coinless (Through the Shattered Grid, Origin Benefit, p.20): "Whenever another member
 * of your team would be Defeated in a scene, you may instead spend 1 Personal Power to have that
 * member return to 1 Health and gain the Impaired Condition for the remainder of the scene."
 *
 * Same ally-held Defeat-prevention scan as findWeAllGoHomeHolder just above, with three real
 * differences taken straight from RAW rather than copied across:
 * - RAW says "ANOTHER member of your team", so unlike We All Go Home this deliberately has NO self
 *   case - the holder can't rescue themselves with it.
 * - The limit is the Personal Power cost, not a frequency cap: RAW states no once-per-scene/
 *   encounter gate at all, so there's no flag here. A holder with the Power to spare can do this
 *   repeatedly, which is what the text actually says.
 * - RAW never gates this on the rescuer's own state, so a Defeated holder isn't excluded (unlike
 *   Defender's Oath, whose own text does say "and you aren't Defeated"). Left faithful rather than
 *   tightened on a guess.
 * "Can see"/range is not a factor here either - RAW scopes it to the team, not a distance - so this
 * matches on disposition alone, the same team proxy mechanics/combat/nearby-allies.mjs already uses.
 * @param {Actor} actor   The actor about to be reduced to 0 Health.
 * @returns {Array<Actor>}   Teammates who hold the Perk and can afford the 1 Power.
 */
function findCoinlessRescuers(actor) {
  const actorToken = actor.getActiveTokens?.()?.[0];
  if (!actorToken || !canvas?.tokens) {
    return [];
  }

  const rescuers = [];
  for (const token of canvas.tokens.placeables) {
    if (token === actorToken || !token.actor || token.document.disposition !== actorToken.document.disposition) {
      continue;
    }

    if (actorHasPerk(token.actor, WE_ARE_THE_COINLESS_ID)
      && (token.actor.system?.powers?.personal?.value ?? 0) >= 1 && !rescuers.includes(token.actor)) {
      rescuers.push(token.actor);
    }
  }

  return rescuers;
}

/**
 * "You MAY instead spend 1 Personal Power": asks whether one of the eligible teammates spends it
 * (and which), rather than draining a holder's Power unasked.
 * @param {Actor} actor   The actor about to be Defeated.
 * @param {Array<Actor>} rescuers
 * @returns {Promise<Actor|null>}   The teammate who spends it, or null if nobody does.
 */
async function askCoinlessRescuer(actor, rescuers) {
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: findPerk(rescuers[0], WE_ARE_THE_COINLESS_ID)?.name ?? 'We are the Coinless' },
    classes: ["window-app", "e20-window"],
    buttons: [
      ...rescuers.map((rescuer, i) => ({
        action: `rescuer${i}`, label: game.i18n.format('E20.WeAreTheCoinlessRescue', { rescuer: rescuer.name, actor: actor.name }),
      })),
      { action: 'decline', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  const index = String(choice ?? '').startsWith('rescuer') ? Number(String(choice).slice('rescuer'.length)) : -1;
  return rescuers[index] ?? null;
}

// Immortal Rebel Soul (WTNV Citizen's Guide, Soldier Role, StrexCorp Rebel Focus, p.46) - see its
// own check below.
const IMMORTAL_REBEL_SOUL_ID = "Compendium.essence20.wtnv_citizens_guide.Item.SYFScAH8lDshgLNM";


// Life Supporting (Cobra Codex, Restricted Battledress Upgrade, p.101): "If you would be Defeated
// after being reduced to 0 Health, you immediately regain 1 Health. You can't use Life Support
// again until you succeed at a DIF 20 Technology Skill Test that takes 10 minutes." Same self-
// clamp-to-1-Health shape as Renegade Commander just above ("regain 1 Health" and "drop to 1
// Health instead" land on the same actor state from 0), but this is a worn armor Upgrade Item, not
// a Perk - actorHasPerk can't see it, so this checks for the real Upgrade Item directly (the same
// "unattached armor-type Upgrade, by sourceId" gate Static Slide Inhibitor's own check in dice.mjs
// already establishes). Once it has fired, the Upgrade stays spent (LIFE_SUPPORTING_SPENT_FLAG on
// the Upgrade) until its Use button's DIF 20 Technology Skill Test succeeds.
const LIFE_SUPPORTING_ID = "Compendium.essence20.cobra_codex.Item.VokHpoLjUYTzA3Xk";
export const LIFE_SUPPORTING_SPENT_FLAG = 'lifeSupportingSpent';
const LIFE_SUPPORTING_RECHARGE_DIF = 20;

const isLifeSupporting = item => item?.type == 'upgrade'
  && (item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource) == LIFE_SUPPORTING_ID;

/**
 * The worn Life Supporting Upgrade that is ready to fire, if any - see LIFE_SUPPORTING_ID's own
 * comment above.
 * @param {Actor} actor
 * @returns {Item|undefined}
 */
function readyLifeSupporting(actor) {
  return actor.items?.find?.(item => isLifeSupporting(item) && item.system?.type == 'armor'
    && !item.getFlag?.('essence20', 'parentId') && !item.flags?.essence20?.[LIFE_SUPPORTING_SPENT_FLAG]);
}

/**
 * Life Supporting's recharge: "You can't use Life Support again until you succeed at a DIF 20
 * Technology Skill Test that takes 10 minutes."
 * @param {Item} item   The spent Life Supporting Upgrade.
 * @param {Function} [rollTest]   (actor, skill, dif) => {success}; defaults to grants.mjs#rollTest.
 * @returns {Promise<String>}   The chat line.
 */
export async function rechargeLifeSupporting(item, rollTest = null) {
  const actor = item.parent;
  const roll = rollTest ?? (await import("../resources/grants.mjs")).rollTest;
  const { success } = await roll(actor, 'technology', LIFE_SUPPORTING_RECHARGE_DIF);
  if (!success) {
    return game.i18n.format('E20.O1EmulatorNotRecharged', { name: actor.name, item: item.name });
  }

  await item.unsetFlag('essence20', LIFE_SUPPORTING_SPENT_FLAG);
  return game.i18n.format('E20.O1EmulatorRecharged', { name: actor.name, item: item.name });
}

registerUse({
  id: 'lifeSupportingRecharge',
  matches: isLifeSupporting,
  canUse: item => !!item.flags?.essence20?.[LIFE_SUPPORTING_SPENT_FLAG],
  run: item => rechargeLifeSupporting(item),
});


// Elemental Shield (Beneath the Helmet, Aqua Ranger, 9th/18th level, p.42) - see
// team-buffs.mjs's own doc comment on PENDING_ELEMENTAL_SHIELD_FLAG_KEY. "Energy weapon" is this
// project's own established equivalence of PR's "Energy" display term with the Element damage-type
// family (see the Element/Energy reclassification pass's own doc comments) - 'element' itself plus
// its enumerated sub-types confirmed by the Weapon Effects and Traits page (Acid/Cold/Electric/
// Electromagnetic/Fire/Laser/Sonic). Poison and Psychic are real, but RAW-distinct, damage types -
// not part of the Element family - so they're deliberately excluded here.
export const ENERGY_DAMAGE_TYPES = new Set(['element', 'acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic']);

/**
 * Elemental Shield's own "ignore N Energy damage from your next attack by an energy weapon"
 * clause - a one-shot reduction against the next ENERGY hit this actor actually takes, consumed
 * (and cleared) the moment it applies. Only consumes the banked flag when it would actually do
 * something (amount > 0 and the damage type qualifies), so an already-zeroed hit (Immune, a 0
 * roll) doesn't waste the grant for nothing.
 * @param {Actor} actor
 * @param {String} damageType
 * @param {Number} amount   The damage about to be applied, after Immunity has already zeroed it.
 * @returns {Promise<Number>}   The (possibly reduced) amount, floored at 0.
 */
async function consumeElementalShieldReduction(actor, damageType, amount) {
  if (amount <= 0 || !ENERGY_DAMAGE_TYPES.has(damageType)) {
    return amount;
  }

  const pending = getPendingBonus(actor, PENDING_ELEMENTAL_SHIELD_FLAG_KEY);
  if (!pending) {
    return amount;
  }

  await clearPendingBonus(actor, PENDING_ELEMENTAL_SHIELD_FLAG_KEY);
  return Math.max(0, amount - pending.amount);
}

// Dig Deep (WTNV Citizen's Guide, General Perk, p.47): "Once per scene, you can ignore 1 damage,
// but you suffer a Snag on all Skill Tests until the end of your next turn." Two independent
// banks from one click (see its own dispatch in banked-buffs.mjs) - this one-shot damage
// reduction (any damage type, unlike Elemental Shield's Energy-only scope) consumed here, and an
// unscoped Snag consumed in dice.mjs's own self-status section (same shape as Through the
// Arches). "Until the end of your next turn" is approximated as "the next matching roll," this
// project's usual duration idiom for a short window.
export const PENDING_DIG_DEEP_FLAG_KEY = 'pendingDigDeep';

/**
 * Dig Deep's own "ignore 1 damage" clause - see PENDING_DIG_DEEP_FLAG_KEY's own comment above.
 * @param {Actor} actor
 * @param {Number} amount   The damage about to be applied, after every earlier reduction.
 * @returns {Promise<Number>}   The (possibly reduced) amount, floored at 0.
 */
async function consumeDigDeepReduction(actor, amount) {
  if (amount <= 0) {
    return amount;
  }

  const pending = getPendingBonus(actor, PENDING_DIG_DEEP_FLAG_KEY);
  if (!pending) {
    return amount;
  }

  await clearPendingBonus(actor, PENDING_DIG_DEEP_FLAG_KEY);
  return Math.max(0, amount - pending.amount);
}

// Energy Mastery (Decepticon Directive, Elementalist Focus, 20th level, p.54): "you gain Edge on
// attack Skill Tests with any weapon that deals damage of any of your chosen Elements and those
// attacks inflict +1 damage. In addition, you gain Immunity to damage of the type you originally
// chose for Energy Affinity." The Edge/+1-damage half lives in dice.mjs (a roll-time grant, same
// shape as every other qualifying-attack check there); this constant/function only cover the
// Immunity half, applied live in applyDamage() below (the same isEmpImmuneViaShield idiom just
// below already establishes) rather than a persisted system.immunities write, since it's derived
// from the Perk + Energy Affinity's own choice rather than a standalone toggle. "Any of your
// chosen Elements" collapses to the single Energy Affinity choice - Energy Connection's own
// Additional Energy Types option (a second chosen Element) isn't built, see ENERGY_CONNECTION_ID's
// own comment in dice.mjs.
const ENERGY_AFFINITY_ID = "Compendium.essence20.decepticon_directive.Item.DgFY0ZmAtClAobiA";
const ENERGY_MASTERY_ID = "Compendium.essence20.decepticon_directive.Item.bjR8V1BEc3CfrrDu";

/**
 * Energy Mastery's Immunity half - see ENERGY_MASTERY_ID's own comment above.
 * @param {Actor} actor
 * @param {String} damageType
 * @returns {Boolean}
 */
function isEnergyMasteryImmune(actor, damageType) {
  return actorHasPerk(actor, ENERGY_MASTERY_ID) && !!damageType
    && findPerk(actor, ENERGY_AFFINITY_ID)?.system.choice == damageType;
}

// Hardened Armor (Across the Stars, Gold Ranger, 1st level, p.52) - this is the `perk`-type item
// (the scaling Toughness-defense half is a separate, already-automated `rolePoints` sub-item read
// generically by actor.mjs#_prepareDefenses, unrelated to this constant). "After suffering a
// damage type other than Blunt or Sharp, you gain Resistance to that damage type... for the
// remainder of the scene." See applyDamage's own grantHardenedArmorResistance call below.
const HARDENED_ARMOR_ID = "Compendium.essence20.across_the_stars.Item.LVyy4985HSSKCnGs";
// The two damage types RAW excludes from Hardened Armor's own Resistance grant.
const HARDENED_ARMOR_EXCLUDED_TYPES = ['blunt', 'sharp'];

/**
 * Hardened Armor's own Resistance-after-hit clause (see HARDENED_ARMOR_ID's own comment above):
 * once this actor actually suffers real damage of a given type, they become Resistant to that
 * type for the rest of the scene (mechanics/characters/actor-token-helpers.mjs#grantSceneResistance - folded into
 * system.resistances, read by dice.mjs's own target-status Snag check, until the Scene Clock
 * starts a new scene) - a no-op if they already are.
 * @param {Actor} actor
 * @param {String} damageType
 * @param {Number} amount   The amount actually applied (0 means Immune/no-op - see applyDamage).
 */
async function grantHardenedArmorResistance(actor, damageType, amount) {
  if (amount > 0 && !HARDENED_ARMOR_EXCLUDED_TYPES.includes(damageType)
    && actorHasPerk(actor, HARDENED_ARMOR_ID) && !actor.system.resistances?.[damageType]) {
    await grantSceneResistance(actor, damageType);
  }
}

// Tough Enough (GI Joe CRB, Tank Focus, 6th level, p.99): "when you are subjected to a non-attack
// effect against your Toughness, the effect suffers a Snag. If the effect still meets or exceeds
// your Toughness defense, you have resistance to the damage." The Snag is the item's own incoming
// rule (system.rules); the resistance halves that effect's own damage, see toughEnoughDamage
// below.
const TOUGH_ENOUGH_ID = "Compendium.essence20.gi_joe_crb.Item.RoIa80w6EAZR0uFP";

/**
 * Tough Enough's "you have resistance to the damage" for the effect that just met the holder's
 * Toughness: that effect's own damage, not every later hit of its type. Its roll is already made,
 * so Resistance's no-roll form applies - "the damage is automatically halved (round up)" (GI JOE
 * CRB p.170). Called by chat.mjs's Apply Damage handler on a non-attack effect against Toughness,
 * before the damage is applied.
 * @param {Actor} actor   The target.
 * @param {Number} damage
 * @returns {Number}   The damage to apply.
 */
export function toughEnoughDamage(actor, damage) {
  return damage > 0 && actorHasPerk(actor, TOUGH_ENOUGH_ID) ? Math.ceil(damage / 2) : damage;
}

// Cruel Warlord (Finster's Monster-Matic Cookbook, 20th level, p.284): "Whenever you... suffer
// Psychic damage, you regain 2 Personal Power." (The "Fumble a Skill Test" half lives in
// dice.mjs's own _rollSkillHelper instead, right where isFumble is already computed.)
const CRUEL_WARLORD_ID = `${FMMC}F3TRKmoaUOtHrlzq`;

/**
 * Cruel Warlord's own reactive Personal Power regen on taking Psychic damage - see
 * CRUEL_WARLORD_ID's own comment above. Same applyDamage()-hook shape as Sensitive.
 * @param {Actor} actor
 * @param {String} damageType
 * @param {Number} amount   The amount actually applied (0 means Immune/no-op - see applyDamage).
 */
async function grantCruelWarlordPsychicRegen(actor, damageType, amount) {
  if (amount > 0 && damageType == 'psychic' && actorHasPerk(actor, CRUEL_WARLORD_ID) && actor.system.powers?.personal) {
    const newValue = Math.min(actor.system.powers.personal.max, actor.system.powers.personal.value + 2);
    await actor.update({ 'system.powers.personal.value': newValue });
  }
}

// Supreme Guardian (Through the Shattered Grid, Guardian of Eltar, 20th level, p.73) - bullet 3:
// "Whenever you take Energy damage, you may roll a d20. If the roll is 10 or above, you regain 1
// Eltarian Tech Point." (Bullet 1 - the AoE Blind-on-Morph - lives in items/attacks/supreme-guardian.mjs
// and dice.mjs's own post-hit processing; bullet 2 - spend Eltarian Tech for bonus melee Power
// Weapon damage - lives in dice.mjs. See that file's own doc comment for all 3 bullets together.)
const SUPREME_GUARDIAN_ID = "Compendium.essence20.through_the_shattered_grid.Item.wrBndkBQoKkn3dLy";

/**
 * Supreme Guardian's own passive Eltarian Tech regen - see SUPREME_GUARDIAN_ID's own comment
 * above. "You may roll" is approximated as an automatic roll, the same "a passive grant is always
 * exercised" idiom this project already applies to every other automatic check with no real
 * downside to rolling (a player declining a free chance at a resource regen is a vanishingly
 * unlikely edge case, not worth a confirmation prompt on every single Energy hit taken).
 * @param {Actor} actor
 * @param {String} damageType
 * @param {Number} amount   The amount actually applied (0 means Immune/no-op - see applyDamage).
 */
async function grantSupremeGuardianTechRegen(actor, damageType, amount) {
  if (amount <= 0 || !ENERGY_DAMAGE_TYPES.has(damageType) || !actorHasPerk(actor, SUPREME_GUARDIAN_ID)) {
    return;
  }

  const eltarianTech = actor._getBaseRolePoints?.();
  if (!eltarianTech) {
    return;
  }

  const roll = await new Roll('1d20').evaluate();
  if (roll.total >= 10) {
    const newValue = Math.min(eltarianTech.system.resource.max, eltarianTech.system.resource.value + 1);
    await eltarianTech.update({ 'system.resource.value': newValue });
  }
}

/**
 * Finds the actor currently driving the given vehicle/Zord, via its own system.actors crew map
 * ({vehicleRole, uuid, ...} entries, resolved with fromUuidSync - the same shape
 * prepareSystemActors() and vehicle-handler.mjs's own crew-swap logic already read). Shared by
 * getDefenseValue's own driver/pilot Willpower/Cleverness substitution below and dice.mjs's
 * identically-named private method, which now just delegates here.
 * @param {Actor} vehicleActor
 * @returns {Actor|null}   The driver, or null if the vehicle has no assigned driver.
 */
export function getVehicleDriver(vehicleActor) {
  for (const crewMember of Object.values(vehicleActor.system?.actors ?? {})) {
    if (crewMember.vehicleRole == 'driver') {
      const driver = fromUuidSync(crewMember.uuid);
      if (driver) {
        return driver;
      }
    }
  }

  return null;
}

/**
 * Finds the Zord actor a pilot Actor has registered as their own (e.g. Magna Defender's own
 * Torozord, or any Ranger's plain "Zord") - the entry created when a Zord is dropped directly
 * onto a playerCharacter's own sheet (sheet-handlers/drop-handler.mjs's onDropActor, case
 * 'playerCharacter'), stored in the PILOT's own system.actors, not the Zord's. This is the
 * opposite direction from getVehicleDriver/dice.mjs's own _getPilotedVehicle (both of which read
 * the ZORD's crew map to find who's currently SEATED in it) - "owns a Zord" and "is currently
 * piloting a Zord" are different relationships (a Torozord Feature grant should apply to your own
 * Zord any time, not only while you happen to be seated in it during a live combat roll).
 * @param {Actor} pilotActor
 * @returns {Actor|null}   The owned Zord, or null if none is registered.
 */
export function getOwnedZord(pilotActor) {
  for (const entry of Object.values(pilotActor.system?.actors ?? {})) {
    if (entry.type == 'zord') {
      const zord = fromUuidSync(entry.uuid);
      if (zord) {
        return zord;
      }
    }
  }

  return null;
}

/**
 * Returns the effective numeric value of one of an actor's four Defenses (Toughness, Evasion,
 * Willpower, Cleverness; p.168-169). Every actor type computes its own .total the same way now
 * (Essence20Actor#_prepareDefenses runs for all of them), with one RAW-mandated exception: a
 * Vehicle/Zord's Willpower and Cleverness (system.defenses[type].usesDrivers - see templates/
 * machine.mjs#makeDefensesFields's own doc comment) redirect to its current driver/pilot instead
 * of using its own computed value, per GI Joe CRB p.173 / PR CRB p.126's "Vehicle" trait and PR
 * CRB p.136's baseline Zord stat block ("*Use the pilot's Defense"). An A.I.-trait Vehicle is the
 * one exception to the exception - RAW gives it real Smarts/Social Essence Scores and
 * Willpower/Cleverness Defenses of its own, so it's excluded from the redirect and computes
 * normally.
 * @param {Actor} actor
 * @param {String} defenseType
 * @param {Object} [options]
 * @param {Boolean} [options.ignoreArmor]   PR "Driving Strike" (Finster's Monster-Matic Cookbook
 *   p.286): "...ignore a target's bonuses from armor to Defense..." - subtracts the armor (or,
 *   while Morphed, morphed-form) component _prepareDefenses() already folded into .total, read
 *   back out rather than recomputed.
 * @param {Number} [options.ignoreArmorPoints]   Decepticon Directive Raider "Penetrating Aim"
 *   (Siegemaster Focus, 1st level, p.63): "...ignore 1 point of the target's armor Defense
 *   bonus..." - a partial version of ignoreArmor above (a flat point count instead of an
 *   all-or-nothing strip), capped at the actual armor component so it can never go negative.
 *   Ignored if ignoreArmor is also set (that already strips the whole thing).
 * @param {Boolean} [options.ignoreShield]   Screwball (Cobra Codex, Weapon Upgrade, p.97)'s own
 *   Bypassing trait: "Attacks ignore shield bonuses to Defenses" - subtracts the shield component
 *   _prepareDefenses() already folded into .total, same read-back shape as ignoreArmor above.
 *   Note: ignoreArmor is also forced on automatically whenever `actor` itself carries the
 *   'armorStripped' status (Ice Flechettes, dice.mjs's own ICE_FLECHETTES_EFFECT_IDS comment) -
 *   a target-side effect rather than a caller-passed option.
 * @returns {Number}
 */
export function getDefenseValue(actor, defenseType, { ignoreArmor = false, ignoreArmorPoints = 0, ignoreShield = false } = {}) {
  const defense = actor.system.defenses?.[defenseType];

  // Responsive (GI Joe CRB, Vehicle Trait): "The vehicle can use the driver's Evasion against
  // attacks instead of its own." A driver-value substitution like the Willpower/Cleverness
  // usesDrivers redirect just below, but scoped to Evasion specifically and gated on this one
  // Vehicle Trait rather than being universal - only kicks in with an actual driver seated; RAW
  // has nothing to substitute without one, so this falls through to the vehicle's own normal
  // Evasion below when driverless.
  if (defenseType == 'evasion' && actor.type == 'vehicle' && actor.system.traits?.responsive) {
    const driver = getVehicleDriver(actor);
    if (driver) {
      return getDefenseValue(driver, 'evasion', { ignoreArmor, ignoreArmorPoints, ignoreShield });
    }
  }

  if (defense?.usesDrivers && !(actor.type == 'vehicle' && actor.system.traits?.ai)) {
    const driver = getVehicleDriver(actor);
    if (driver) {
      return getDefenseValue(driver, defenseType, { ignoreArmor, ignoreArmorPoints, ignoreShield });
    }

    // Relic Key (PR CRB p.140): "The Zord has a default Smarts and Social of 3 when the Relic
    // Key is present but no crew is currently driving." Run through the same base + essence +
    // bonus + armor + shield shape _prepareDefenses() uses (this Defense's own fields are still
    // real and GM-editable even while unpiloted), substituting 3 for the missing Essence Score.
    if (actor.type == 'zord' && actorHasZordFeature(actor, RELIC_KEY_ID)) {
      const RELIC_KEY_ESSENCE = 3;
      return (defense.base ?? 0) + RELIC_KEY_ESSENCE + (defense.bonus ?? 0)
        + (defense.armor ?? 0) + (defense.shield ?? 0);
    }

    // Zord Sentience - see ZORD_SENTIENCE_ID's own comment above. Identical shape to Relic Key,
    // just a lower default Essence Score.
    if (actor.type == 'zord' && actorHasZordFeature(actor, ZORD_SENTIENCE_ID)) {
      const ZORD_SENTIENCE_ESSENCE = 2;
      return (defense.base ?? 0) + ZORD_SENTIENCE_ESSENCE + (defense.bonus ?? 0)
        + (defense.armor ?? 0) + (defense.shield ?? 0);
    }

    // No driver, no Relic Key/Zord Sentience: RAW says this effect only affects the vehicle "if
    // it has a driver" - i.e. it doesn't apply at all while driverless, not that it trivially
    // succeeds.
    // This system has no "this Defense can't be targeted at all" concept to enforce that
    // directly, so this returns an effectively-unbeatable value instead of 0, erring toward
    // "the attack has no effect" rather than "the attack trivially crits."
    return Infinity;
  }

  let value = defense?.total ?? defense?.value ?? 0;

  // Ice Flechettes (Finster's Monster-Matic Cookbook, Path of Frost, 9th level, p.293): "On a
  // Critical Success, the target loses all Defense bonuses provided by armor until the end of
  // their next turn." Read live off the target's own 'armorStripped' status (applied via
  // applyTimedCondition, see dice.mjs's own isIceFlechettesAttempt comment) rather than a passed-
  // in option, since this has to apply to every subsequent roll against the target regardless of
  // who's attacking or whether they declared ignoreArmor themselves - same forced-recompute shape
  // as the Drilling Shot/Quantum Cut callers already use, just triggered by the defender's own
  // state instead of the attacker's.
  const hasArmorStripped = !!actor.statuses?.has?.('armorStripped');

  if ((ignoreArmor || hasArmorStripped) && defense?.total !== undefined) {
    value -= (actor.system.isMorphed ? defense.morphed : defense.armor) ?? 0;
  } else if (ignoreArmorPoints > 0 && defense?.total !== undefined) {
    const armorComponent = (actor.system.isMorphed ? defense.morphed : defense.armor) ?? 0;
    value -= Math.min(armorComponent, ignoreArmorPoints);
  }

  if (ignoreShield && defense?.total !== undefined) {
    value -= defense.shield ?? 0;
  }

  return value;
}

/**
 * Applies the Degrees of Success rule (p.169): a result of double the Difficulty applies the
 * numeric effect (Damage, etc.) twice, triple applies it three times, and so on.
 * @param {Number} total   The rolled Skill Test result.
 * @param {Number} difficulty   The Difficulty (a flat DIF or a target's Defense) being tested.
 * @returns {Number}   0 on a miss, otherwise the number of times the effect applies (minimum 1).
 */
export function computeMultiplier(total, difficulty) {
  if (!difficulty || total < difficulty) {
    return 0;
  }

  return Math.max(1, Math.floor(total / difficulty));
}

/**
 * The generic "how strong is this creature" number this system compares across level-vs-level
 * effects (e.g. Just The Facts below, Sudden Death's own Threat-Level compare in chat.mjs) - a
 * PC/Companion's system.level and an NPC/Vehicle's system.threatLevel are treated as the same
 * number line, unlike chat.mjs's own Sudden Death compare (which deliberately only reads
 * threatLevel, since RAW scopes that Perk to NPC targets specifically). NPCs and Vehicles also
 * carry a system.level (a shared template field, 1 by default), so their Threat Level is read
 * first - their level only while no Threat Level is set (0). Falls back to 0 if neither is set.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getEffectiveLevel(actor) {
  const threat = Number(actor?.system?.threatLevel) || 0;
  if (['npc', 'vehicle'].includes(actor?.type) && threat > 0) {
    return threat;
  }

  return actor?.system?.level ?? actor?.system?.threatLevel ?? 0;
}

/**
 * "Skill Ranks" - a number a few General Perks scale off of (Bulked Up Frame, Tactical
 * Gymnastics, both General Hawk's Personnel Files, p.174/177) that isn't tracked as its own field
 * anywhere in this system, but is fully derivable from data already on the actor. The GI Joe CRB's
 * own worked example makes the formula explicit: "if you have Brawn (Endurance) +d6*, you gain a
 * +4 deflective bonus to Toughness because you have 4 Skill Ranks in Brawn (three for Skill Die
 * and one for a Specialization)" - d20 (the untrained baseline) sits 3 rungs above d6 on
 * E20.skillShiftList, and the Specialization itself adds a 4th. Reuses the same
 * skillShiftList.indexOf delta this project's whole shift-substitution family (Cunning Plan, Ever
 * Vigilant, etc.) already computes shift differences with.
 * @param {Actor} actor
 * @param {String} skill   A key into actor.system.skills.
 * @returns {Number}
 */
export function getSkillRanks(actor, skill) {
  const skillData = actor.system.skills[skill];
  if (!skillData) {
    return 0;
  }

  const untrainedIndex = E20.skillShiftList.indexOf('d20');
  const shiftIndex = E20.skillShiftList.indexOf(skillData.shift);
  if (shiftIndex < 0) {
    return 0;
  }

  return Math.max(0, untrainedIndex - shiftIndex) + (skillData.isSpecialized ? 1 : 0);
}

/**
 * Applies damage to an actor, zeroing it out first if the actor is Immune to the given damage
 * type. Resistance does NOT reduce damage here (p.170: "that means that any form of that damage
 * always has a Snag when rolling tests to apply to the creature or object" - the halved-damage
 * clause only covers the no-roll-involved case, which never applies to this system's automated
 * attack/check pipeline, where the Snag is instead applied to the attack roll itself by
 * Dice#_getAutomaticCombatModifiers). Once a Resistant target is actually hit, the damage lands
 * in full. damageType keys are shared between weaponEffect.damageType and
 * actor.resistances/immunities, so this applies uniformly to whatever effect type the attack was
 * defined with.
 *
 * Stun-type damage doesn't reduce Health at all - it instead adds to the separate
 * system.stun.value accumulator (shown on the sheet as "Stun / Health" and reset to 0 on a
 * rest), which is how this system tracks stun buildup rather than a depleting pool. Every other
 * damage type subtracts from system.health.value as normal, floored at 0.
 * Impenetrable Shield (Vanguard base, 18th level, p.109): "immunity to EMP damage" while the
 * shield is active - unlike the Perk's own Resistance-to-everything-else clause (a Snag on the
 * attack roll instead, see dice.mjs's own target-status checks), immunity zeroes damage after a
 * hit, the same as the actor's own permanent system.immunities below, just conditional on the
 * shield being switched on rather than always-on.
 * Hardened Armor (Across the Stars, Gold Ranger, 1st level, p.52): once real damage of a given
 * type actually lands here, see grantHardenedArmorResistance's own doc comment above for the
 * Resistance-after-hit grant this function calls on the way out.
 * Elemental Shield (Beneath the Helmet, Aqua Ranger, 9th/18th level, p.42): a banked "ignore N
 * Energy damage" grant is consumed against the incoming amount right after Immunity has already
 * zeroed it if applicable - see consumeElementalShieldReduction's own doc comment above.
 * Supreme Guardian (Through the Shattered Grid, Guardian of Eltar, 20th level, p.73): once real
 * Energy damage actually lands here, see grantSupremeGuardianTechRegen's own doc comment above for
 * the passive Eltarian Tech Point regen chance this function calls on the way out, alongside
 * Hardened Armor's own Resistance grant.
 * At All Cost (Through the Shattered Grid, Magna Defender, 18th level, p.25): while active, a
 * non-stun hit's Health loss is diverted to Personal Power loss instead - see
 * applyAtAllCostDamage's own doc comment in items/defenses/at-all-cost.mjs.
 * Dig Deep (WTNV Citizen's Guide, General Perk, p.47): a banked "ignore 1 damage" grant (any
 * damage type) is consumed right after Elemental Shield's own reduction - see
 * consumeDigDeepReduction's own doc comment above.
 * Flame Warlord (Finster's Monster-Matic Cookbook, 20th level): a flat non-Element reduction
 * while in Monster Form - see getWarlordDamageReduction's own
 * doc comment above.
 * @param {Actor} actor
 * @param {Number} damageValue
 * @param {String} damageType
 * @returns {Promise<Number>}   The amount actually applied (0 if Immune), clamped to how much
 *   Health the actor had left when damageType isn't 'stun'.
 */
export async function applyDamage(actor, damageValue, damageType, isCrit = false, { ignoreImmunity = false, source = null } = {}) {
  // Not On My Watch - see grantNotOnMyWatchReaction's own doc comment. Captured before any of
  // this function's own mutations, the same "read Defeated status once, up front" idiom
  // chat.mjs#onApplyDamage's own wasAlreadyDefeated already uses - both branches below only fire
  // the reaction on a genuine NEW transition into Defeated, not on every subsequent hit against
  // an actor who was already at 0 Health (the Stun branch's own newStunValue >= health.value
  // check, in particular, would otherwise re-trigger on literally every later Stun dealt to an
  // already-Defeated actor, since 0 Health makes that comparison trivially true again).
  const wasAlreadyDefeated = !!actor.statuses?.has?.('defeated');

  // Carrier (PR CRB, Zord Feature, p.136): "carried Zords may not be harmed until released"
  // (mechanics/actions/team-actions.mjs).
  if (isCarried(actor)) {
    return 0;
  }

  // Essence damage types take from an Essence score, not Health - none of the Health reductions
  // below apply (mechanics/combat/essence-attack.mjs). The Essence is random for 'any'/'swap' here; the
  // chat card's own button (chat.mjs#onApplyDamage) lets a Science attacker choose instead.
  if (isEssenceDamageType(damageType)) {
    return (await applyEssenceAttack(actor, damageValue, damageType, { ignoreImmunity })).applied;
  }

  // Wisdom of the Elders - Resilient Armor (Through the Shattered Grid, Guardian of Eltar,
  // 9th/18th level, p.72): "Ignore 1 damage per turn" while active - this applies to ANY incoming
  // damage type, and unlike Elemental Shield's own one-shot "next attack" bank, it's a live toggle applying to
  // every hit for as long as it's switched on (RAW's own "per turn" phrasing is approximated as
  // "per hit while active" - this codebase has no per-turn-reset bucket to track a once-per-turn
  // use separately from the toggle itself, the same "closest existing mechanism" idiom already
  // used throughout this project for a duration this system can't literally enforce).
  if (isWisdomOfTheEldersActive(actor, 'resilientArmor')) {
    damageValue = Math.max(0, damageValue - 1);
  }

  // Flame Warlord - see getWarlordDamageReduction's own doc comment above.
  damageValue = Math.max(0, damageValue - getWarlordDamageReduction(actor, damageType));

  const isEmpImmuneViaShield = damageType == 'emp' && isPersonalShieldActive(actor)
    && actorHasPerk(actor, IMPENETRABLE_SHIELD_ID);
  // Pressurized Cabin / Submarine Mode: "The sealed compartment grants immunity to Poison and
  // Disease" to everyone aboard (mechanics/vehicles/vehicle-upgrades.mjs).
  const sealedFromPoison = damageType == 'poison' && isSealedAboard(actor);
  let amount = (!ignoreImmunity && (actor.system.immunities?.[damageType] || isEmpImmuneViaShield || isEnergyMasteryImmune(actor, damageType) || sealedFromPoison)) ? 0 : damageValue;
  amount = (await consumeSelfPreservationImmunity(actor, damageType)) ? 0 : amount;
  // Protomatter Injection Layer - mechanics/resources/kits.mjs.
  amount = await protomatterReduce(actor, amount);
  // Extensions (mechanics/item-hooks.mjs).
  amount = await runDamageModifiers(actor, amount, damageType, { isCrit, ignoreImmunity });
  amount = await consumeElementalShieldReduction(actor, damageType, amount);
  amount = await consumeDigDeepReduction(actor, amount);

  if (damageType == 'stun') {
    const newStunValue = actor.system.stun.value + amount;
    await actor.update({ 'system.stun.value': newStunValue });

    // Item rules' takesDamage Triggers see Stun hits too (the after-damage hooks below are Health only).
    if (amount > 0) {
      const { fireTriggers } = await import("../../rules/triggers.mjs");
      await fireTriggers(actor, 'takesDamage', { damage: { amount, damageType }, roll: { damageType, damageAmount: amount } });
    }

    // Stun (damage type): "the target is denied a Move action for the listed number of turns" -
    // unlike the Defeated toggle below, this one IS accurately turned back off once it should be
    // (see healStunAtTurnStart's own comment), since Stun's own value literally counts down the
    // remaining denied turns - there's no separate duration to lose track of here, just this same
    // number. Uses the existing 'cantTakeMoveActions' status (defined in E20.statusEffects but,
    // like most Conditions in this system, otherwise unenforced anywhere in code) as a visible
    // marker for the GM/player to act on - this system has no per-turn action-economy tracking to
    // actually BLOCK a Move action with (a separate, larger, deliberately deferred gap).
    if (amount > 0) {
      await actor.toggleStatusEffect('cantTakeMoveActions', { active: true });
    }

    // Stun (damage type): "if a creature suffers an amount of total Stun equal to the amount of
    // Health the creature has left, they fall unconscious, Defeated." Compared against the
    // actor's own current Health (Stun never reduces Health itself, see the accumulator comment
    // above) right after the new total lands. Toggled ON only - same "grant, don't auto-revoke"
    // idiom this system already applies to every other status a Perk applies (Lock Down's
    // Immobilized, Stunning Surprise's own Stun, etc.) - a GM clears Defeated manually, same as
    // ever other case. Skipped entirely when no Stun actually landed (Immune, or a 0-value hit),
    // so an already-Defeated actor doesn't get a redundant toggle call on every later Stun.
    if (amount > 0 && newStunValue >= actor.system.health.value) {
      await actor.toggleStatusEffect('defeated', { active: true });

      if (!wasAlreadyDefeated) {
        await grantNotOnMyWatchReaction(actor);
      }
    }

    await grantHardenedArmorResistance(actor, damageType, amount);
    await grantGridElementalAdaptationResistance(actor, damageType, amount);
    await grantSupremeGuardianTechRegen(actor, damageType, amount);
    await grantCruelWarlordPsychicRegen(actor, damageType, amount);
    if (amount > 0) {
      await deactivateShynessOnDamage(actor);
      await deactivatePhantomOnDamage(actor);
    }

    return amount;
  }

  // At All Cost (Through the Shattered Grid, Magna Defender, 18th level, p.25) - see
  // items/defenses/at-all-cost.mjs's own doc comment. While active, this actor's Health never actually
  // drops - the damage converts to Personal Power loss instead, so Hardened Armor/Supreme
  // Guardian's own hit-triggered grants (both keyed on Health actually dropping) are skipped for
  // this branch entirely, same as they already are for an Immune (0-amount) hit.
  if (isAtAllCostActive(actor)) {
    return await applyAtAllCostDamage(actor, amount);
  }

  const previousValue = actor.system.health.value;
  let newValue = Math.max(0, previousValue - amount);

  // Item rules' wouldBeDefeated Triggers (rules/triggers.mjs) - first in the Defeat-save chain, once
  // every reduction above has landed.
  if (newValue <= 0 && amount > 0) {
    const { wouldBeDefeated } = await import("../../rules/triggers.mjs");
    newValue = Math.max(0, previousValue - await wouldBeDefeated(actor, amount, damageType, { isCrit }));
  }

  // Immortal Rebel Soul (WTNV Citizen's Guide, Soldier Role, StrexCorp Rebel Focus, p.46): "Once
  // per investigation, when you would be Defeated due to your Health... dropping to 0, it stays
  // at 1 instead." Approximated as once per scene (this project's usual idiom for a
  // session/investigation-scoped resource). The "...or an Essence Score dropping to 0" half lives
  // with the Essence point itself, environment-hazards.mjs#applyEssenceDamage, sharing this use.
  if (newValue <= 0 && amount > 0 && actorHasPerk(actor, IMMORTAL_REBEL_SOUL_ID)
    && !hasUsedThisEncounter(actor, 'immortalRebelSoulUsedThisEncounter')) {
    newValue = 1;
    await markUsedThisEncounter(actor, 'immortalRebelSoulUsedThisEncounter');
  }

  // Life Supporting - see LIFE_SUPPORTING_ID's own comment above. A once-per-scene Defeat save,
  // but spent until its recharge test succeeds rather than per scene.
  const lifeSupporting = newValue <= 0 && amount > 0 ? readyLifeSupporting(actor) : null;
  if (lifeSupporting) {
    newValue = 1;
    await lifeSupporting.setFlag('essence20', LIFE_SUPPORTING_SPENT_FLAG, true);
  }

  // Not Done Yet (GI Joe CRB, Renegade base, 5th level, p.97, built 2026-09-12): "While in
  // Reckless Abandon, if you would be defeated, you may choose to drop to 1 Health instead. You
  // can use this ability once per Reckless Abandon." Same once-per-encounter Health clamp shape
  // Immortal Rebel Soul/Do Not Go Quietly already establish - "once per Reckless Abandon" is
  // approximated as "once per encounter" (this codebase's widest existing scope, and Reckless
  // Abandon is realistically activated at most once per fight anyway), gated on the toggle
  // actually being active via isRecklessAbandonActive.
  const renegade = renegadeHolderFor(actor);
  if (newValue <= 0 && amount > 0 && renegade && actorHasPerk(renegade, NOT_DONE_YET_ID) && isRecklessAbandonActive(renegade)
    && !hasUsedThisEncounter(renegade, 'notDoneYetUsedThisEncounter')) {
    newValue = 1;
    await markUsedThisEncounter(renegade, 'notDoneYetUsedThisEncounter');
  }

  // Aegis - see AEGIS_CLAMPED_FLAG's own doc comment in reckless-abandon.mjs.
  if (newValue <= 0 && amount > 0 && actorHasPerk(actor, AEGIS_ID) && isRecklessAbandonActive(actor)) {
    newValue = 1;
    await actor.setFlag('essence20', AEGIS_CLAMPED_FLAG, true);
  }

  // We are the Coinless - see findCoinlessRescuers's own doc comment above. Checked LAST in this
  // whole chain deliberately: every other entry above either costs nothing or spends the victim's
  // OWN resource, so a teammate's Personal Power is only ever spent once the victim has no
  // self-rescue of their own left. Since this spends a DIFFERENT player's resource and RAW says
  // "you may", it asks first (askCoinlessRescuer) and announces whose Power paid for it.
  const coinlessRescuers = newValue <= 0 && amount > 0 ? findCoinlessRescuers(actor) : [];
  if (coinlessRescuers.length) {
    const coinlessRescuer = await askCoinlessRescuer(actor, coinlessRescuers);
    if (coinlessRescuer) {
      newValue = 1;
      const { needsGmRelay, relayToGm } = await import("../world/gm-relay.mjs");
      const spend = { 'system.powers.personal.value': coinlessRescuer.system.powers.personal.value - 1 };
      await (needsGmRelay(coinlessRescuer) ? relayToGm(coinlessRescuer, 'update', [spend]) : coinlessRescuer.update(spend));
      await actor.toggleStatusEffect('impaired', { active: true });
      ui.notifications.info(game.i18n.format('E20.WeAreTheCoinlessRescue', {
        rescuer: coinlessRescuer.name, actor: actor.name,
      }));
    }
  }

  await actor.update({ 'system.health.value': newValue });

  if (newValue <= 0 && !wasAlreadyDefeated) {
    await grantNotOnMyWatchReaction(actor);
    // Emergency Deployment and Docking - docked Mini-Cons deploy (mechanics/companions/companions.mjs).
    await onOwnerDefeated(actor);
  }

  // Powermaster: "If you are hit by Energy or Laser damage, the module regains 1 Energon Point"
  // (mechanics/companions/bonded-partners.mjs).
  if (amount > 0) {
    await onBondedHit(actor, damageType);
  }

  // source: who dealt it (the chat card's speaker), for their dealtDamage / defeatedEnemy Triggers.
  await runAfterDamage(actor, previousValue - newValue, damageType, { newValue, previousValue, wasAlreadyDefeated, source });

  await grantHardenedArmorResistance(actor, damageType, previousValue - newValue);
  await grantGridElementalAdaptationResistance(actor, damageType, previousValue - newValue);
  await grantSupremeGuardianTechRegen(actor, damageType, previousValue - newValue);
  await grantCruelWarlordPsychicRegen(actor, damageType, previousValue - newValue);
  if (previousValue - newValue > 0) {
    await deactivateShynessOnDamage(actor);
    await deactivatePhantomOnDamage(actor);
  }

  return previousValue - newValue;
}

/**
 * Stun (damage type): "Stun effects heal 1 per turn." Called from essence20.mjs's own
 * combatTurn/combatRound hooks for whoever's turn is currently starting - "per turn" is read as
 * the Stunned creature's OWN turn (the same turn its accumulated Stun would otherwise be denying
 * a Move action on), not once per round for everyone. A no-op for an actor already at 0 Stun, so
 * this is safe to call unconditionally for the active combatant every turn. Clears the
 * 'cantTakeMoveActions' marker applyDamage's own Stun branch sets once Stun actually reaches 0 -
 * the one Condition in this system whose real duration IS tracked (by the Stun value itself), so
 * unlike Defeated/Immobilized/etc. this one is safe to auto-clear rather than leaving it to a GM.
 * Still doesn't enforce the Move-action denial itself - this system has no action-economy tracking
 * at all (a documented, separate, larger gap) - only marks and un-marks it.
 *
 * A Megaform's own system.stun.value is a live-computed mirror summed fresh from its linked
 * participants every render (Essence20Actor#_prepareMegaformData), the same "not a real pool"
 * treatment its Health gets (see mechanics/vehicles/megaform-damage.mjs's own doc comment) - writing to it
 * directly here would just get overwritten on the Megaform's own next render, silently
 * no-op'ing the heal. Redirected to heal each linked participant's own Stun by 1 instead (the
 * same participants mechanics/vehicles/megaform-damage.mjs's applyMegaformDamage distributes damage
 * across), rather than splitting a single point of healing across them the way damage is split -
 * each participant heals the same 1 per turn it would if it weren't merged.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function healStunAtTurnStart(actor) {
  if (actor?.type == 'megaform') {
    for (const participant of getMegaformParticipants(actor)) {
      await healStunAtTurnStart(participant);
    }

    return;
  }

  const currentStun = actor?.system?.stun?.value ?? 0;
  if (currentStun <= 0) {
    return;
  }

  const newStunValue = currentStun - 1;
  await actor.update({ 'system.stun.value': newStunValue });

  if (newStunValue <= 0) {
    await actor.toggleStatusEffect('cantTakeMoveActions', { active: false });
  }
}

/**
 * Determines whether a roll was a Critical Success and/or a Fumble (p.205): a natural '1' on
 * the d20 portion is always a Fumble; showing the highest face value on any non-d20, non-d2
 * bonus die (d2 only counts if canCritD2, e.g. from an Edge Perk) is a Critical Success.
 * @param {Array<Object>} dice   Roll#dice - one entry per die pool (e.g. d20, 3d6).
 * @param {Boolean} canCritD2   Whether a shift-2 (d2) result counts as a Critical Success.
 * @returns {[Boolean, Boolean]}   [isCrit, isFumble]
 */
export const _isCritIsFumble = function (dice, canCritD2) {
  let isCrit = false;
  let isFumble = false;

  for (let diePool of dice) {
    // A diePool here is a group of similarly-sided dice, such as d20 or 3d6
    let faces = diePool.faces;

    for (let dieValue of diePool.values) {
      // dieValue is an individual result from the diePool
      if (faces === 20 && dieValue === 1) {
        isFumble = true;
      } else if ((faces > 2 || canCritD2) && faces != 20 && dieValue === faces) {
        isCrit = true;
        break; // Only one die needs to crit
      }
    }

    if (isCrit) {
      break; // Perpetuating inner-for break
    }
  }

  return [isCrit, isFumble];
};

/**
 * The second damage component a weaponEffect deals on the same hit (weapon-effect.mjs's
 * secondaryDamage, e.g. "1 Blunt and 1 Stun"), or null when it has none.
 * @param {Item} item   The rolled item (anything other than a weaponEffect has none).
 * @param {Boolean} [forgone]   A Perk traded this attack's damage away (Guardian Strikes etc.).
 * @returns {Object|null}   {type, value}
 */
export function getSecondaryDamage(item, forgone = false) {
  const secondary = item?.type == 'weaponEffect' ? item.system.secondaryDamage : null;
  if (forgone || !secondary?.type || !(secondary.value > 0)) {
    return null;
  }

  return { type: secondary.type, value: secondary.value };
}

/**
 * The secondary damage the Apply Damage button `key` should also deal to `targetUuid`, read off
 * the message's own checkResults (dice.mjs stashes each hit's rider there, since check-card.hbs
 * has no slot for a second damage type). The base button deals the scaled rider; the Critical
 * Success "repeat the effect" option deals it again at its flat value, like the rest of that list.
 * @param {Object} flags   The message's essence20 flags.
 * @param {String} key   The button's own data-key ("<uuid>:base", "<uuid>:crit:double", ...).
 * @param {String} targetUuid
 * @returns {Object|null}   {type, value}
 */
export function getSecondaryDamageForButton(flags, key, targetUuid) {
  const secondary = flags?.checkResults?.find(entry => entry.targetUuid == targetUuid)?.secondaryDamage;
  if (!secondary?.type) {
    return null;
  }

  if (key == `${targetUuid}:base`) {
    return { type: secondary.type, value: secondary.value };
  }

  if (key == `${targetUuid}:crit:double`) {
    return { type: secondary.type, value: secondary.base };
  }

  return null;
}

/**
 * Builds the ChatMessage.create() data for a resolved attack or vs-Difficulty Skill Test,
 * rendering templates/chat/check-card.hbs with one row per result.
 * @param {Roll} roll   The already-evaluated Roll.
 * @param {Object} options
 * @param {String} options.flavor   The roll's flavor/label text.
 * @param {Array<Object>} options.results   [{name, targetUuid, difficulty, showDifficulty,
 *   success, multiplier, damageValue, damageTypeLabel, damageType}, ...]
 * @param {Object} options.speaker   ChatMessage speaker data.
 * @param {Boolean} options.canCritD2
 * @param {Object} [options.rollContext]   {skill, essence, snag} describing what was rolled -
 *   stashed onto the message's flags so a reroll grant (mechanics/rolls/reroll.mjs) can later check
 *   whether it actually applies to this roll (e.g. "Expertise" only rerolls one named skill,
 *   "Veteran" requires the roll wasn't already Snagged).
 * @returns {Promise<Object>}   The data object to pass to ChatMessage.create().
 */
export async function buildCheckChatData(roll, { flavor, results, speaker, canCritD2, rollContext = {} }) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/essence20/templates/chat/check-card.hbs",
    {
      flavor,
      results,
      rollHTML: await roll.render(),
    },
  );

  return {
    content,
    rolls: [roll],
    speaker,
    flags: { essence20: { canCritD2, ...rollContext } },
    rollMode: game.settings.get('core', 'rollMode'),
  };
}
