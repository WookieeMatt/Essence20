import {
  actorHasPerk, bankPendingBonus, clearPendingBonus, getPendingBonus, hasUsedThisEncounter, markUsedThisEncounter,
} from "./perks.mjs";
import { isPersonalShieldActive } from "./personal-shield.mjs";
import { PENDING_ELEMENTAL_SHIELD_FLAG_KEY } from "./team-buffs.mjs";
import { isWisdomOfTheEldersActive } from "./wisdom-of-the-elders.mjs";
import { applyAtAllCostDamage, isAtAllCostActive } from "./at-all-cost.mjs";
import { grantGridElementalAdaptationResistance } from "./grid-elemental-adaptation.mjs";
import { isProtectedTarget } from "./protected-target.mjs";
import { AEGIS_CLAMPED_FLAG, isRecklessAbandonActive } from "./reckless-abandon.mjs";
import { E20 } from "./config.mjs";
import { isMonsterFormActive } from "./monster-morph.mjs";
import { grantNotOnMyWatchReaction } from "./not-on-my-watch.mjs";
import { actorHasZordFeature } from "./zord-features.mjs";
import { getMegaformParticipants } from "./megaform-participants.mjs";

// Relic Key (PR CRB p.140, prerequisite Auxiliary Zord) - see getDefenseValue's own doc comment
// below for the Willpower/Cleverness default this grants while unpiloted.
const PR_CRB = "Compendium.essence20.pr_crb.Item.";
const RELIC_KEY_ID = `${PR_CRB}uSlClAv3oJjf54pa`;

// The 3 Finster's Monster-Matic Cookbook Warlord capstones (20th level) whose own "while in
// Monster Form, reduce incoming damage" clause is built here - see getWarlordDamageReduction's
// own doc comment below. (The other 3 Warlords - Cruel/Thorn/Venom - have no damage-reduction
// clause of their own; their own built pieces live in dice.mjs instead.)
const FMMC = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.";
const FLAME_WARLORD_ID = `${FMMC}TPrNnDxBKHIajafY`;
const FROST_WARLORD_ID = `${FMMC}iFHlsLgUvmlT8cMK`;
const STONE_WARLORD_ID = `${FMMC}QlFNI9fQZXqO5N2J`;

/**
 * Flame/Frost/Stone Warlord (Finster's Monster-Matic Cookbook, all 20th level, p.288/291/294):
 * each grants a flat incoming-damage reduction while in Monster Form - Flame reduces non-Element
 * damage by 1, Frost reduces Energy damage by 2, Stone reduces ALL damage by 1. Same "subtract
 * from the incoming value before Immunity/Resistance processing" shape Adapted Wavelength's own
 * reduction already establishes.
 * @param {Actor} actor
 * @param {String} damageType
 * @returns {Number}
 */
function getWarlordDamageReduction(actor, damageType) {
  if (!isMonsterFormActive(actor)) {
    return 0;
  }

  if (actorHasPerk(actor, STONE_WARLORD_ID)) {
    return 1;
  }

  if (actorHasPerk(actor, FROST_WARLORD_ID) && ENERGY_DAMAGE_TYPES.has(damageType)) {
    return 2;
  }

  if (actorHasPerk(actor, FLAME_WARLORD_ID) && !ENERGY_DAMAGE_TYPES.has(damageType)) {
    return 1;
  }

  return 0;
}

// Aegis (GI Joe CRB, Tank Focus, 20th level, p.99) - see its own doc comment in
// reckless-abandon.mjs. Checked here alongside Defender's Oath/Immortal Rebel Soul's identical
// "clamp newValue at 1 instead of 0" shape.
const AEGIS_ID = "Compendium.essence20.gi_joe_crb.Item.CKQfEuHDNW6zP0FE";
// Not Done Yet - see its own check near AEGIS_ID's identical-shaped clamp below.
const NOT_DONE_YET_ID = "Compendium.essence20.gi_joe_crb.Item.wGAWnAM5zUgcNP9c";

const IMPENETRABLE_SHIELD_ID = "Compendium.essence20.gi_joe_crb.Item.eEUl7OA9yWAk0QD3";

// Defender's Oath (GI Joe CRB, Bodyguard Focus, 20th level, p.110) - see
// hasNearbyDefendersOathProtection's own doc comment below.
const DEFENDERS_OATH_ID = "Compendium.essence20.gi_joe_crb.Item.LuQoEjHVOM8Yoc0Y";

/**
 * Defender's Oath (GI Joe CRB, Bodyguard Focus, 20th level, p.110): "your protected target can't
 * be Defeated, even if they have 0 Health, as long as they are within 10 feet of you and you
 * aren't Defeated." Scans for a nearby Bodyguard who holds Defender's Oath, has designated the
 * damaged actor as their own Protected Target (helpers/protected-target.mjs), isn't Defeated
 * themselves, and is within 10ft - the same "scan canvas.tokens.placeables for a qualifying
 * granter" shape getShieldUpgradeBonus already establishes, just checking a specific protected-
 * target relationship instead of disposition/range alone. No frequency cap in RAW, unlike We All
 * Go Home/Aegis's own once-per-encounter Defeat-prevention grants - a standing protection for as
 * long as the conditions hold.
 * @param {Actor} actor   The actor about to be reduced to 0 Health.
 * @returns {Boolean}
 */
function hasNearbyDefendersOathProtection(actor) {
  const actorToken = actor.getActiveTokens?.()?.[0];
  if (!actorToken || !canvas?.tokens) {
    return false;
  }

  for (const token of canvas.tokens.placeables) {
    if (token === actorToken || !token.actor) {
      continue;
    }

    if (!actorHasPerk(token.actor, DEFENDERS_OATH_ID) || !isProtectedTarget(token.actor, actor)) {
      continue;
    }

    if (token.actor.statuses?.has('defeated')) {
      continue;
    }

    if (canvas.grid.measurePath([token.center, actorToken.center]).distance <= 10) {
      return true;
    }
  }

  return false;
}

// We All Go Home Or Nobody's Going Home (GI Joe CRB, Focus: Frontline Leader, 20th level, p.87) -
// see findWeAllGoHomeHolder's own doc comment below.
const WE_ALL_GO_HOME_ID = "Compendium.essence20.gi_joe_crb.Item.3NS825G6UdbdW7ZY";
const WE_ALL_GO_HOME_ENCOUNTER_FLAG = 'weAllGoHomeUsedThisEncounter';

/**
 * We All Go Home Or Nobody's Going Home (GI Joe CRB, Focus: Frontline Leader, 20th level, p.87):
 * "once per encounter, when you or an ally you can see would be Defeated, you or they instead
 * have 1 Health." Unlike Defender's Oath (a standing protection scoped to one designated target)
 * this covers BOTH the holder themselves and any nearby ally, gated once per encounter per
 * HOLDER (not per actor saved) - "can see" is approximated as "anywhere on the scene," the same
 * "drop the unenforceable narrative precondition" idiom this project already applies elsewhere.
 * Checks the actor's own Perk first (the self case), then scans for a nearby ally holding it with
 * their own use still available (the same disposition-based "nearby ally" scan
 * helpers/allies.mjs#getNearbyAllyTokens establishes, done inline here since this needs the
 * qualifying token itself, not just a boolean).
 * @param {Actor} actor   The actor about to be reduced to 0 Health.
 * @returns {Actor|null}   The Perk-holding actor whose own once-per-encounter use should be
 *   marked (either `actor` itself, or a nearby ally), or null if no one can save them.
 */
function findWeAllGoHomeHolder(actor) {
  if (actorHasPerk(actor, WE_ALL_GO_HOME_ID) && !hasUsedThisEncounter(actor, WE_ALL_GO_HOME_ENCOUNTER_FLAG)) {
    return actor;
  }

  const actorToken = actor.getActiveTokens?.()?.[0];
  if (!actorToken || !canvas?.tokens) {
    return null;
  }

  for (const token of canvas.tokens.placeables) {
    if (token === actorToken || !token.actor || token.document.disposition !== actorToken.document.disposition) {
      continue;
    }

    if (actorHasPerk(token.actor, WE_ALL_GO_HOME_ID) && !hasUsedThisEncounter(token.actor, WE_ALL_GO_HOME_ENCOUNTER_FLAG)) {
      return token.actor;
    }
  }

  return null;
}

// Immortal Rebel Soul (WTNV Citizen's Guide, Soldier Role, StrexCorp Rebel Focus, p.46) - see its
// own check below.
const IMMORTAL_REBEL_SOUL_ID = "Compendium.essence20.wtnv_citizens_guide.Item.SYFScAH8lDshgLNM";

// Renegade Commander (Sgt Slaughter Sourcebook, Alternate Renegade Role Perk, 5th level, p.12):
// "once per scene, if you would be Defeated, you may choose to drop to 1 Health instead." Same
// self-clamp-once-per-scene shape as Immortal Rebel Soul just above - "may choose to" is granted
// unconditionally rather than built as an opt-out prompt, the same "player self-polices whether
// they'd rather just go down" idiom this project already accepts for similar always-beneficial
// once-per-scene saves.
const RENEGADE_COMMANDER_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.JgJRqxXzTPBOlOBz";
const DO_NOT_GO_QUIETLY_ID = "Compendium.essence20.jump_through_time.Item.llL4HUNxVJDNIaej";
const BABY_HOLD_TOGETHER_ID = "Compendium.essence20.gi_joe_crb.Item.ybthZ8mmCSe3ZO84";

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

// Adapted Wavelength (A Jump Through Time, Orange Ranger, Modified Shell III option, p.33):
// "Choose a single type of Element damage. You always reduce sources that inflict that type of
// damage by 1 to a minimum of 0. You can choose this up to two times but must choose a different
// element each time." selectionLimit: 2 means an actor can hold up to 2 separate instances of
// this Perk item, sharing this one compendium sourceId but each with its own system.choice (the
// same "no numeric field of its own, read directly off system.choice" shape
// helpers/phantom-focus.mjs#hasPhantomFocusOption already established) - "a different element
// each time" means at most one instance ever matches a given damageType, so a plain some() is
// enough (no need to sum multiple matches for the same type).
const ADAPTED_WAVELENGTH_ID = "Compendium.essence20.jump_through_time.Item.nmMTFyzNTa9MDbP2";

/**
 * Adapted Wavelength's flat -1 (floored at 0) reduction against the actor's own chosen Element
 * sub-type - see ADAPTED_WAVELENGTH_ID's own comment above.
 * @param {Actor} actor
 * @param {String} damageType
 * @returns {Number}   1 if a matching instance is held, 0 otherwise.
 */
function getAdaptedWavelengthReduction(actor, damageType) {
  if (!ENERGY_DAMAGE_TYPES.has(damageType)) {
    return 0;
  }

  const hasMatch = actor?.items?.some?.(item => {
    const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
    return sourceId == ADAPTED_WAVELENGTH_ID && item.system.choice == damageType;
  });

  return hasMatch ? 1 : 0;
}

// Hardened Armor (Across the Stars, Gold Ranger, 1st level, p.52) - this is the `perk`-type item
// (the scaling Toughness-defense half is a separate, already-automated `rolePoints` sub-item read
// generically by actor.mjs#_prepareDefenses, unrelated to this constant). "After suffering a
// damage type... you gain Resistance to that damage type... for the remainder of the scene." See
// applyDamage's own grantHardenedArmorResistance call below.
const HARDENED_ARMOR_ID = "Compendium.essence20.across_the_stars.Item.LVyy4985HSSKCnGs";

/**
 * Hardened Armor's own Resistance-after-hit clause (see HARDENED_ARMOR_ID's own comment above):
 * once this actor actually suffers real damage of a given type, they become permanently Resistant
 * to that type going forward (system.resistances is a plain per-type boolean, read by dice.mjs's
 * own target-status Snag check) - a no-op if they already are. "For the remainder of the scene"
 * isn't actively cleared at scene end (no such hook exists in this codebase) - the same
 * "approximate, don't hard-enforce a duration" idiom this project already accepts elsewhere (e.g.
 * Dig In's own manual toggle-off) - a GM can clear it back off by hand between scenes if desired.
 * @param {Actor} actor
 * @param {String} damageType
 * @param {Number} amount   The amount actually applied (0 means Immune/no-op - see applyDamage).
 */
async function grantHardenedArmorResistance(actor, damageType, amount) {
  if (amount > 0 && actorHasPerk(actor, HARDENED_ARMOR_ID) && !actor.system.resistances?.[damageType]) {
    await actor.update({ [`system.resistances.${damageType}`]: true });
  }
}

// Tough Enough (GI Joe CRB, Tank Focus, 6th level, p.99): "when you are subjected to a non-attack
// effect against your Toughness, the effect suffers a Snag. If the effect still meets or exceeds
// your Toughness defense, you have resistance to the damage." The Snag half hits the same
// defenseType-not-yet-known-at-modifier-check-time architectural gap already documented for
// Silver/Graphite/Orange Ranger Prime's own reciprocal Defense-Snag bullets
// (_getAutomaticCombatModifiers runs before the Roll Options Dialog resolves
// skillRollOptions.defenseType) - only the Resistance-after-hit half is built, see
// grantToughEnoughResistance's own comment below.
const TOUGH_ENOUGH_ID = "Compendium.essence20.gi_joe_crb.Item.RoIa80w6EAZR0uFP";

/**
 * Tough Enough's own Resistance-after-hit half (see TOUGH_ENOUGH_ID's own comment above) - the
 * same "grant permanent Resistance once real damage actually lands" shape
 * grantHardenedArmorResistance establishes above, but additionally scoped to "a non-attack effect
 * against your Toughness" specifically (an ordinary weapon Attack against Toughness does NOT
 * trigger this, per RAW) - called from chat.mjs's own Apply Damage button handler, which is the
 * one place with access to the posted roll's own recorded isAttack/defenseType flags (see the
 * rollContext widening in dice.mjs#rollSkill) - applyDamage() itself has no such context.
 * @param {Actor} actor
 * @param {String} damageType
 * @param {Number} amount   The amount actually applied (0 means Immune/no-op - see applyDamage).
 */
export async function grantToughEnoughResistance(actor, damageType, amount) {
  if (amount > 0 && actorHasPerk(actor, TOUGH_ENOUGH_ID) && !actor.system.resistances?.[damageType]) {
    await actor.update({ [`system.resistances.${damageType}`]: true });
  }
}

// Sensitive (MLP Precise Hang-Up, p.60): "When you take Damage, you also suffer Snag on Skill
// Tests for the next round." See its own reactive trigger below - "you can expend a Detail
// Oriented use to ignore this for one round" isn't built (Detail Oriented's own action-cost-
// override half needs this project's still-missing action-economy tracking, so there's no working
// resource to spend against it).
const SENSITIVE_ID = "Compendium.essence20.mlp_crb.Item.cLe7ettmAIaBUYIj";
export const PENDING_SENSITIVE_SNAG_FLAG_KEY = 'pendingSensitiveSnag';

/**
 * Sensitive's own reactive Snag (see SENSITIVE_ID's own comment above) - banked, not applied
 * directly, since a fresh Snag needs to be READ back by dice.mjs's own automatic-modifiers check
 * (the same unscoped-Snag bank shape Through the Arches/Debilitating Strike already use), rather
 * than mutating a die-pool this function has no roll context to reach.
 * @param {Actor} actor
 * @param {Number} amount   The amount actually applied (0 means Immune/no-op - see applyDamage).
 */
async function grantSensitiveSnag(actor, amount) {
  if (amount > 0 && actorHasPerk(actor, SENSITIVE_ID)) {
    await bankPendingBonus(actor, PENDING_SENSITIVE_SNAG_FLAG_KEY, { snag: true });
  }
}

// Push Through Pain (Finster's Monster-Matic Cookbook, Path of Cruelty, 2nd level, p.285):
// "Anytime you suffer 2 or more damage in a single attack, you regain 1 Personal Power." Same
// applyDamage()-hook shape as Sensitive/Hardened Armor/Supreme Guardian above - "a single attack"
// is read as "this one applyDamage() call" (the natural per-hit granularity this function already
// operates at), capped at the actor's own Personal Power max.
const PUSH_THROUGH_PAIN_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.HhdIEMBVmXF8UsXu";

/**
 * Push Through Pain's own reactive Personal Power regen - see PUSH_THROUGH_PAIN_ID's own comment
 * above.
 * @param {Actor} actor
 * @param {Number} amount   The amount actually applied (0 means Immune/no-op - see applyDamage).
 */
async function grantPushThroughPainRegen(actor, amount) {
  if (amount >= 2 && actorHasPerk(actor, PUSH_THROUGH_PAIN_ID) && actor.system.powers?.personal) {
    const newValue = Math.min(actor.system.powers.personal.max, actor.system.powers.personal.value + 1);
    await actor.update({ 'system.powers.personal.value': newValue });
  }
}

// Cruel Warlord (Finster's Monster-Matic Cookbook, 20th level, p.284): "Whenever you... suffer
// Psychic damage, you regain 2 Personal Power." (The "Fumble a Skill Test" half lives in
// dice.mjs's own _rollSkillHelper instead, right where isFumble is already computed.)
const CRUEL_WARLORD_ID = `${FMMC}F3TRKmoaUOtHrlzq`;

/**
 * Cruel Warlord's own reactive Personal Power regen on taking Psychic damage - see
 * CRUEL_WARLORD_ID's own comment above. Same applyDamage()-hook shape as Push Through Pain.
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
// Eltarian Tech Point." (Bullet 1 - the AoE Blind-on-Morph - lives in helpers/supreme-guardian.mjs
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
 * @returns {Number}
 */
export function getDefenseValue(actor, defenseType, { ignoreArmor = false, ignoreArmorPoints = 0 } = {}) {
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
      return getDefenseValue(driver, 'evasion', { ignoreArmor, ignoreArmorPoints });
    }
  }

  if (defense?.usesDrivers && !(actor.type == 'vehicle' && actor.system.traits?.ai)) {
    const driver = getVehicleDriver(actor);
    if (driver) {
      return getDefenseValue(driver, defenseType, { ignoreArmor, ignoreArmorPoints });
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

    // No driver, no Relic Key: RAW says this effect only affects the vehicle "if it has a
    // driver" - i.e. it doesn't apply at all while driverless, not that it trivially succeeds.
    // This system has no "this Defense can't be targeted at all" concept to enforce that
    // directly, so this returns an effectively-unbeatable value instead of 0, erring toward
    // "the attack has no effect" rather than "the attack trivially crits."
    return Infinity;
  }

  let value = defense?.total ?? defense?.value ?? 0;

  if (ignoreArmor && defense?.total !== undefined) {
    value -= (actor.system.isMorphed ? defense.morphed : defense.armor) ?? 0;
  } else if (ignoreArmorPoints > 0 && defense?.total !== undefined) {
    const armorComponent = (actor.system.isMorphed ? defense.morphed : defense.armor) ?? 0;
    value -= Math.min(armorComponent, ignoreArmorPoints);
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
 * threatLevel, since RAW scopes that Perk to NPC targets specifically). Falls back to 0 if
 * somehow neither field is set.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getEffectiveLevel(actor) {
  return actor.system.level ?? actor.system.threatLevel ?? 0;
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
 * applyAtAllCostDamage's own doc comment in helpers/at-all-cost.mjs.
 * Dig Deep (WTNV Citizen's Guide, General Perk, p.47): a banked "ignore 1 damage" grant (any
 * damage type) is consumed right after Elemental Shield's own reduction - see
 * consumeDigDeepReduction's own doc comment above.
 * Flame/Frost/Stone Warlord (Finster's Monster-Matic Cookbook, all 20th level): a flat, type-
 * scoped or type-agnostic reduction while in Monster Form - see getWarlordDamageReduction's own
 * doc comment above.
 * @param {Actor} actor
 * @param {Number} damageValue
 * @param {String} damageType
 * @returns {Promise<Number>}   The amount actually applied (0 if Immune), clamped to how much
 *   Health the actor had left when damageType isn't 'stun'.
 */
export async function applyDamage(actor, damageValue, damageType) {
  // Not On My Watch - see grantNotOnMyWatchReaction's own doc comment. Captured before any of
  // this function's own mutations, the same "read Defeated status once, up front" idiom
  // chat.mjs#onApplyDamage's own wasAlreadyDefeated already uses - both branches below only fire
  // the reaction on a genuine NEW transition into Defeated, not on every subsequent hit against
  // an actor who was already at 0 Health (the Stun branch's own newStunValue >= health.value
  // check, in particular, would otherwise re-trigger on literally every later Stun dealt to an
  // already-Defeated actor, since 0 Health makes that comparison trivially true again).
  const wasAlreadyDefeated = !!actor.statuses?.has?.('defeated');

  // Adapted Wavelength - see ADAPTED_WAVELENGTH_ID's own comment above. A permanent, always-on
  // reduction applied to the incoming value itself, ahead of Immunity/Elemental Shield below -
  // order doesn't matter for an already-Immune actor (still zeroed either way).
  damageValue = Math.max(0, damageValue - getAdaptedWavelengthReduction(actor, damageType));

  // Wisdom of the Elders - Resilient Armor (Through the Shattered Grid, Guardian of Eltar,
  // 9th/18th level, p.72): "Ignore 1 damage per turn" while active - unlike Adapted Wavelength
  // above (scoped to one specific Energy sub-type), this applies to ANY incoming damage type, and
  // unlike Elemental Shield's own one-shot "next attack" bank, it's a live toggle applying to
  // every hit for as long as it's switched on (RAW's own "per turn" phrasing is approximated as
  // "per hit while active" - this codebase has no per-turn-reset bucket to track a once-per-turn
  // use separately from the toggle itself, the same "closest existing mechanism" idiom already
  // used throughout this project for a duration this system can't literally enforce).
  if (isWisdomOfTheEldersActive(actor, 'resilientArmor')) {
    damageValue = Math.max(0, damageValue - 1);
  }

  // Flame/Frost/Stone Warlord - see getWarlordDamageReduction's own doc comment above.
  damageValue = Math.max(0, damageValue - getWarlordDamageReduction(actor, damageType));

  const isEmpImmuneViaShield = damageType == 'emp' && isPersonalShieldActive(actor)
    && actorHasPerk(actor, IMPENETRABLE_SHIELD_ID);
  let amount = (actor.system.immunities?.[damageType] || isEmpImmuneViaShield) ? 0 : damageValue;
  amount = await consumeElementalShieldReduction(actor, damageType, amount);
  amount = await consumeDigDeepReduction(actor, amount);

  if (damageType == 'stun') {
    const newStunValue = actor.system.stun.value + amount;
    await actor.update({ 'system.stun.value': newStunValue });

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
    await grantSensitiveSnag(actor, amount);
    await grantPushThroughPainRegen(actor, amount);
    await grantCruelWarlordPsychicRegen(actor, damageType, amount);
    return amount;
  }

  // At All Cost (Through the Shattered Grid, Magna Defender, 18th level, p.25) - see
  // helpers/at-all-cost.mjs's own doc comment. While active, this actor's Health never actually
  // drops - the damage converts to Personal Power loss instead, so Hardened Armor/Supreme
  // Guardian's own hit-triggered grants (both keyed on Health actually dropping) are skipped for
  // this branch entirely, same as they already are for an Immune (0-amount) hit.
  if (isAtAllCostActive(actor)) {
    return await applyAtAllCostDamage(actor, amount);
  }

  const previousValue = actor.system.health.value;
  let newValue = Math.max(0, previousValue - amount);

  // Immortal Rebel Soul (WTNV Citizen's Guide, Soldier Role, StrexCorp Rebel Focus, p.46): "Once
  // per investigation, when you would be Defeated due to your Health... dropping to 0, it stays
  // at 1 instead." Approximated as once per scene (this project's usual idiom for a
  // session/investigation-scoped resource). The "...or an Essence Score dropping to 0" half is
  // blocked on the same missing "Essence damage" resource pool flagged elsewhere in this project
  // (see Headache's own comment in dice.mjs) - no code anywhere reduces an Essence Score as a
  // damage effect to intercept.
  if (newValue <= 0 && amount > 0 && actorHasPerk(actor, IMMORTAL_REBEL_SOUL_ID)
    && !hasUsedThisEncounter(actor, 'immortalRebelSoulUsedThisEncounter')) {
    newValue = 1;
    await markUsedThisEncounter(actor, 'immortalRebelSoulUsedThisEncounter');
  }

  // Renegade Commander - see RENEGADE_COMMANDER_ID's own comment above. Same shape as Immortal
  // Rebel Soul just above.
  if (newValue <= 0 && amount > 0 && actorHasPerk(actor, RENEGADE_COMMANDER_ID)
    && !hasUsedThisEncounter(actor, 'renegadeCommanderUsedThisEncounter')) {
    newValue = 1;
    await markUsedThisEncounter(actor, 'renegadeCommanderUsedThisEncounter');
  }

  // Do Not Go Quietly (A Jump Through Time, Last of my Kind Origin Benefit, p.26, built
  // 2026-09-12): "The first time you face defeat in a scene, you instead drop to 1 Health and
  // gain the Impaired Condition for the rest of the scene." Same once-per-encounter Health clamp
  // shape as Immortal Rebel Soul/Renegade Commander just above, plus applying Impaired
  // (toggleStatusEffect, the same idiom every other Condition-application Perk in this project
  // already uses) - "for the rest of the scene" isn't actively cleared, the same "approximate an
  // unenforceable duration, GM manages the edges" idiom this project already accepts broadly.
  if (newValue <= 0 && amount > 0 && actorHasPerk(actor, DO_NOT_GO_QUIETLY_ID)
    && !hasUsedThisEncounter(actor, 'doNotGoQuietlyUsedThisEncounter')) {
    newValue = 1;
    await markUsedThisEncounter(actor, 'doNotGoQuietlyUsedThisEncounter');
    await actor.toggleStatusEffect('impaired', { active: true });
  }

  // Defender's Oath - see hasNearbyDefendersOathProtection's own doc comment above.
  if (newValue <= 0 && amount > 0 && hasNearbyDefendersOathProtection(actor)) {
    newValue = 1;
  }

  // Baby Hold Together (GI Joe CRB, Mechanized Infantry Focus, 18th level, p.82, built
  // 2026-09-12): "When your vehicle would be Defeated for the first time in an encounter, it is
  // reduced to 2 Health instead." Held by the DRIVER, applied to the VEHICLE - the same
  // driver-holds-it/vehicle-benefits-from-it split Heavy Ordnance's own check already establishes,
  // but in the opposite direction (vehicle-to-driver lookup rather than driver-to-vehicle), so it
  // reads the vehicle's own crew map directly rather than reusing dice.mjs's private
  // _getPilotedVehicle (a Dice-class-only method not reachable from this file).
  if (newValue <= 0 && amount > 0 && actor.type == 'vehicle'
    && !hasUsedThisEncounter(actor, 'babyHoldTogetherUsedThisEncounter')) {
    const driverEntry = Object.values(actor.system?.actors ?? {}).find(crew => crew.vehicleRole == 'driver');
    const driver = driverEntry ? await fromUuid(driverEntry.uuid) : null;
    if (driver && actorHasPerk(driver, BABY_HOLD_TOGETHER_ID)) {
      newValue = 2;
      await markUsedThisEncounter(actor, 'babyHoldTogetherUsedThisEncounter');
    }
  }

  // Not Done Yet (GI Joe CRB, Renegade base, 5th level, p.97, built 2026-09-12): "While in
  // Reckless Abandon, if you would be defeated, you may choose to drop to 1 Health instead. You
  // can use this ability once per Reckless Abandon." Same once-per-encounter Health clamp shape
  // Immortal Rebel Soul/Do Not Go Quietly already establish - "once per Reckless Abandon" is
  // approximated as "once per encounter" (this codebase's widest existing scope, and Reckless
  // Abandon is realistically activated at most once per fight anyway), gated on the toggle
  // actually being active via isRecklessAbandonActive.
  if (newValue <= 0 && amount > 0 && actorHasPerk(actor, NOT_DONE_YET_ID) && isRecklessAbandonActive(actor)
    && !hasUsedThisEncounter(actor, 'notDoneYetUsedThisEncounter')) {
    newValue = 1;
    await markUsedThisEncounter(actor, 'notDoneYetUsedThisEncounter');
  }

  // Aegis - see AEGIS_CLAMPED_FLAG's own doc comment in reckless-abandon.mjs.
  if (newValue <= 0 && amount > 0 && actorHasPerk(actor, AEGIS_ID) && isRecklessAbandonActive(actor)) {
    newValue = 1;
    await actor.setFlag('essence20', AEGIS_CLAMPED_FLAG, true);
  }

  // We All Go Home Or Nobody's Going Home - see findWeAllGoHomeHolder's own doc comment above.
  if (newValue <= 0 && amount > 0) {
    const weAllGoHomeHolder = findWeAllGoHomeHolder(actor);
    if (weAllGoHomeHolder) {
      newValue = 1;
      await markUsedThisEncounter(weAllGoHomeHolder, WE_ALL_GO_HOME_ENCOUNTER_FLAG);
    }
  }

  await actor.update({ 'system.health.value': newValue });

  if (newValue <= 0 && !wasAlreadyDefeated) {
    await grantNotOnMyWatchReaction(actor);
  }

  await grantHardenedArmorResistance(actor, damageType, previousValue - newValue);
  await grantGridElementalAdaptationResistance(actor, damageType, previousValue - newValue);
  await grantSupremeGuardianTechRegen(actor, damageType, previousValue - newValue);
  await grantSensitiveSnag(actor, previousValue - newValue);
  await grantPushThroughPainRegen(actor, previousValue - newValue);
  await grantCruelWarlordPsychicRegen(actor, damageType, previousValue - newValue);
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
 * treatment its Health gets (see helpers/megaform-damage.mjs's own doc comment) - writing to it
 * directly here would just get overwritten on the Megaform's own next render, silently
 * no-op'ing the heal. Redirected to heal each linked participant's own Stun by 1 instead (the
 * same participants helpers/megaform-damage.mjs's applyMegaformDamage distributes damage
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
 *   stashed onto the message's flags so a reroll grant (helpers/reroll.mjs) can later check
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
