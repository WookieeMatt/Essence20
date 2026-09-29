import { zord2WeaponUnusable } from "./extensions/zord2/unusable.mjs";
import { extDefenseAdjust, extRollSources, runConsumer, runHitRiders, runPostRoll } from "./extensions.mjs";
import { acidSacsDamage, consumeSocial, socialDamageBonus, socialDefenseAdjust, socialRollSources } from "./social-rolls.mjs";
import { noteRolledAgainst } from "./companions.mjs";
import { noteFailure } from "./bff.mjs";
import { loaderShoveBonus } from "./kits.mjs";
import { actorHasHangUp, actorHasPerk, bankPendingBonus, findPerk, getPendingBonus } from "./perks.mjs";
import { getSceneEpoch, markUsed } from "./scene-clock.mjs";
import { applyTimedCondition } from "./timed-status.mjs";
import {
  isImmuneToSkill, isMachineEmpire, isMechanical, isNonHuman, isNonHumanoid, isObjectOrStructure, isPuttyOrTenga, isRobotic,
} from "./creature-tags.mjs";
import { essenceDamageOf } from "./essence-damage.mjs";
import { distanceFeet, pickCanvasPoint, placeActorAt, pushActor, slowNextTurn } from "./forced-movement.mjs";
import { postSaveCard, resolveSaveRoll } from "./save-riders.mjs";
import {
  changePoisonState, coatingOf, isHackerPoison, poisonAffects, poisonProdigy, resolveCoatingRoll, startCoating, toggleHackerPoison,
} from "./poison-coating.mjs";
import { checkMarkTarget } from "./mark-target.mjs";
import { checkPrimaryQuarry } from "./primary-quarry.mjs";
import { RIDER, riderUseFor } from "./rider-uses.mjs";
import { GRANT } from "./grant-uses.mjs";
import { isPerfectDisguiseActive } from "./perfect-disguise.mjs";
import { isScarefyingAppearanceActive } from "./scarefying-appearance.mjs";
import { jammingRadiusFeet } from "./vehicle-upgrades.mjs";

/**
 * Per-target modifiers, on-hit riders and the Conditions that go with them - the Perks, weapons and
 * spells whose effect depends on WHO is being hit, or does something to them once they are.
 *
 * dice.mjs calls into this file at five points and nowhere else:
 * - rollRiderSources: the shifts/Edge/Snag a roll picks up from the target, the roller's own state
 *   and anything nearby, as labeled sources for the Roll Options Dialog;
 * - riderDefenseAdjust: what the target's Defense gains or loses for this attack;
 * - riderDialogFlags / applyDialogRiders: the voluntary downshift choices in the dialog;
 * - applyRollRiders: everything that happens once the dice have landed.
 * chat.mjs hands the card buttons it doesn't know to handleRiderButton, and the sheet's Use button
 * reaches the RIDER_USES table through helpers/action-perks.mjs.
 *
 * Every rule is quoted where it is implemented below.
 */

export { RIDER };

// Word of Unicron (Decepticon Directive, General Perk, p.67) - Fanatic's "anyone with the Word of
// Unicron General Perk". Matched by name, since the Perk may not be in a compendium of its own.
const WORD_OF_UNICRON_NAME = 'word of unicron';

const SOCIAL_SKILLS = ['animalHandling', 'deception', 'intimidation', 'performance', 'persuasion', 'streetwise', 'culture'];
const MARKS_FLAG = 'riderMarks';
const STANCE_FLAG = 'riderStance';
const CHOICE_FLAG = 'riderChoice';
const ZONE_FLAG = 'riderZone';

/* -------------------------------------------- */
/*  Lookups                                     */
/* -------------------------------------------- */

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
}

/** Any item (not only a Perk) from the given compendium entry. */
export function findSourced(actor, id) {
  return actor?.items?.find?.(item => sourceOf(item) == id) ?? null;
}

export function hasSourced(actor, id) {
  return !!findSourced(actor, id);
}

function nameOf(actor, id, fallback) {
  return findSourced(actor, id)?.name ?? fallback;
}

function tokenOf(actor) {
  return actor?.token?.object ?? actor?.getActiveTokens?.()?.[0] ?? null;
}

function isWeaponEffect(item) {
  return item?.type == 'weaponEffect';
}

function parentWeaponOf(actor, item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? actor?.items?.get?.(parentId) ?? null : null;
}

function isArea(item) {
  return !!(item?.system?.shape || item?.system?.radius > 0);
}

/** The Choice a Use button stored on an item (Energic Shields' damage type, and the like). */
export function riderChoiceOf(item) {
  return item?.flags?.essence20?.[CHOICE_FLAG] ?? null;
}

/* -------------------------------------------- */
/*  Marks on a creature                          */
/* -------------------------------------------- */

/**
 * A mark someone put on this creature - Reveal Weakness, Shots Fired, Blazing Strikes' "next ally",
 * Make an Opening, Intervene's Resistance and the rest. Each carries who made it and how long it
 * lasts; getMarks drops the ones that ran out.
 * @param {Actor} actor
 * @returns {Array<Object>}
 */
export function getMarks(actor) {
  const marks = actor?.flags?.essence20?.[MARKS_FLAG];
  return Array.isArray(marks) ? marks.filter(mark => isMarkLive(mark)) : [];
}

function isMarkLive(mark) {
  const combat = game?.combat;
  if (mark.combatId && (!combat || combat.id != mark.combatId)) {
    return false;
  }

  if (mark.sceneEpoch != null && mark.sceneEpoch != getSceneEpoch()) {
    return false;
  }

  if (mark.untilRound != null && combat) {
    if (combat.round > mark.untilRound || (combat.round == mark.untilRound && combat.turn > mark.untilTurn)) {
      return false;
    }
  }

  return true;
}

export function findMark(actor, kind, by = null) {
  return getMarks(actor).find(mark => mark.kind == kind && (!by || mark.by == by)) ?? null;
}

export async function addMark(actor, mark) {
  const marks = getMarks(actor).filter(existing => !(existing.kind == mark.kind && existing.by == mark.by));
  await actor.setFlag('essence20', MARKS_FLAG, [...marks, mark]);
}

export async function removeMark(actor, kind, by = null) {
  const marks = getMarks(actor);
  const kept = marks.filter(mark => !(mark.kind == kind && (!by || mark.by == by)));
  if (kept.length != marks.length) {
    await actor.setFlag('essence20', MARKS_FLAG, kept);
  }
}

/**
 * "Until the end of your next turn" - the round/turn index where that ends.
 * @param {Actor} actor   Whose next turn.
 */
export function untilEndOfNextTurn(actor) {
  const combat = game?.combat;
  if (!combat) {
    return {};
  }

  const theirs = combat.turns.findIndex(c => c.actor?.id == actor?.id);
  if (theirs < 0) {
    return { combatId: combat.id, untilRound: combat.round + 1, untilTurn: combat.turn };
  }

  return { combatId: combat.id, untilRound: combat.round + 1, untilTurn: theirs };
}

/**
 * "Until the start of your next turn".
 */
export function untilStartOfNextTurn(actor) {
  const end = untilEndOfNextTurn(actor);
  if (end.untilRound == null) {
    return end;
  }

  return { ...end, untilTurn: end.untilTurn - 1 };
}

/* -------------------------------------------- */
/*  Where a Condition came from                 */
/* -------------------------------------------- */

/*
 * "Frightened of you" (Worst Nightmare, Hawk's Personnel Files p.174) and "the character who
 * mesmerized them" (Mesmerized, GI Joe CRB p.225) both need to know who caused a Condition. Every
 * automated attack and Perk in the system applies its Conditions from inside a roll's
 * post-processing, so the roller is noted when that starts (noteRoller) and any Condition created
 * on this client in the next few seconds is stamped with them (stampConditionSource, from the
 * preCreateActiveEffect hook).
 */
let activeRoller = null;
const ROLLER_WINDOW_MS = 4000;
const SOURCED_CONDITIONS = ['frightened', 'mesmerized'];

export function noteRoller(actor) {
  activeRoller = actor ? { uuid: actor.uuid, at: Date.now() } : null;
}

export function stampConditionSource(effect, data) {
  const statuses = [...(data?.statuses ?? effect?.statuses ?? [])];
  if (!activeRoller || Date.now() - activeRoller.at > ROLLER_WINDOW_MS || !statuses.some(s => SOURCED_CONDITIONS.includes(s))) {
    return;
  }

  if (effect?.parent?.uuid == activeRoller.uuid) {
    return;
  }

  effect.updateSource?.({ 'flags.essence20.conditionSource': activeRoller.uuid });
}

/**
 * Whether this creature has the Condition because of that actor.
 */
export function hasConditionFrom(target, status, source) {
  if (!target?.statuses?.has?.(status)) {
    return false;
  }

  return !!target.effects?.some?.(effect => effect.statuses?.has?.(status) && effect.flags?.essence20?.conditionSource == source?.uuid);
}

/* -------------------------------------------- */
/*  Stances                                     */
/* -------------------------------------------- */

/**
 * All Out Attack / Evasive Fighting, as they stand now.
 * @param {Actor} actor
 * @returns {{allOutAttack: Number, evasiveFighting: Number}}
 */
export function stanceOf(actor) {
  const stance = actor?.flags?.essence20?.[STANCE_FLAG];
  if (!stance || !isMarkLive(stance)) {
    return { allOutAttack: 0, evasiveFighting: 0 };
  }

  return { allOutAttack: stance.allOutAttack ?? 0, evasiveFighting: stance.evasiveFighting ?? 0 };
}

async function setStance(actor, changes) {
  const current = stanceOf(actor);
  await actor.setFlag('essence20', STANCE_FLAG, {
    allOutAttack: Math.max(current.allOutAttack, changes.allOutAttack ?? 0),
    evasiveFighting: Math.max(current.evasiveFighting, changes.evasiveFighting ?? 0),
    ...untilStartOfNextTurn(actor),
  });
}

/* -------------------------------------------- */
/*  Zones                                       */
/* -------------------------------------------- */

function zoneRegions() {
  return (canvas?.scene?.regions?.contents ?? []).filter(region => region.flags?.essence20?.[ZONE_FLAG]);
}

function isZoneLive(zone) {
  return isMarkLive(zone);
}

/**
 * The live Suppressing Fire zones that hold this creature and belong to someone else.
 * @param {Actor} actor
 * @returns {Array<{region: RegionDocument, zone: Object}>}
 */
export function suppressingZonesOn(actor) {
  const token = tokenOf(actor);
  if (!token) {
    return [];
  }

  return zoneRegions()
    .map(region => ({ region, zone: region.flags.essence20[ZONE_FLAG] }))
    .filter(({ region, zone }) => zone.kind == 'suppressingFire' && zone.actorUuid != actor.uuid && isZoneLive(zone)
      && token.document.testInsideRegion?.(region));
}

/**
 * Clear the zones this actor put down that have run out ("until the start of your next turn").
 * Called at every turn start from documents/combat.mjs.
 */
export async function expireZones() {
  const dead = zoneRegions().filter(region => !isZoneLive(region.flags.essence20[ZONE_FLAG]));
  if (dead.length && game.user?.isGM) {
    await canvas.scene.deleteEmbeddedDocuments('Region', dead.map(region => region.id));
  }
}

/* -------------------------------------------- */
/*  Before the roll: shifts, Edge and Snag      */
/* -------------------------------------------- */

/**
 * @typedef {Object} RiderSource
 * @property {String} id
 * @property {String} label
 * @property {Number} [shiftUp]
 * @property {Number} [shiftDown]
 * @property {Boolean} [edge]
 * @property {Boolean} [snag]
 */

/**
 * Shifts, Edge and Snag from the target, the roller's own state and what is nearby.
 * @param {Actor} actor   The roller.
 * @param {Actor|null} target
 * @param {Object} ctx   {item, rolledSkill, rolledEssence, isAttack, isMelee, damageType, weaponTraits}
 * @returns {{sources: Array<RiderSource>, consumes: Array<Object>}}
 */
export function rollRiderSources(actor, target, ctx = {}) {
  const sources = [];
  const consumes = [];
  const { item, rolledSkill, rolledEssence, isAttack } = ctx;
  const damageType = ctx.damageType ?? item?.system?.damageType;
  const isSocial = rolledEssence == 'social' || SOCIAL_SKILLS.includes(rolledSkill);
  const add = (id, label, mods) => sources.push({ id: `rider-${id}`, label, shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...mods });

  // Jammer (GI Joe CRB p.161): "making wireless and radio signals suffer a Snag on any operation
  // within a 30 foot radius." White Noise Generator: "causing a Snag to any audio-based Skill Tests
  // in the area." Read as Technology tests (operating anything wireless) and Alertness tests
  // (listening) made within 30 feet of a device that's switched on.
  for (const device of activeDevicesNear(actor)) {
    if (device.kind == 'jammer' && rolledSkill == 'technology') {
      add('jammer', device.name, { snag: true });
    }

    if (device.kind == 'whiteNoise' && rolledSkill == 'alertness') {
      add('whiteNoise', device.name, { snag: true });
    }
  }

  // Co-Dependent (Enigma of Combination, Influence Hang-Up, p.25): "Anytime this person suffers from
  // a condition (Defeated, Grappled, Unconscious, and the like) when in your line of sight, you
  // suffer ↓1 to all Skill Tests." Line of sight is read as "on the scene".
  const bond = coDependentPartner(actor);
  if (bond && tokenOf(bond) && [...(bond.statuses ?? [])].some(status => !['morphed', 'altMode', 'cover', 'totalCover', 'defending'].includes(status))) {
    add('coDependent', nameOf(actor, RIDER.coDependent, 'Co-Dependent'), { shiftDown: 1 });
  }

  // Pet Venom Adaptation (WTNV Citizen's Guide, General Perk, p.47): "gain an Edge on Brawn Skill
  // Tests to overcome the Poisoned Condition."
  if (rolledSkill == 'brawn' && actor.statuses?.has?.('poisoned') && actorHasPerk(actor, RIDER.petVenomAdaptation)) {
    add('petVenom', nameOf(actor, RIDER.petVenomAdaptation, 'Pet Venom Adaptation'), { edge: true });
  }

  // Monster Hunter's Critical Effect landed on this roller: "Target suffers Snag on their next
  // Attack Skill Test."
  if (isAttack && findMark(actor, 'nextAttackSnag')) {
    const mark = findMark(actor, 'nextAttackSnag');
    add('monsterHunterSnag', mark.label ?? 'Monster Hunter', { snag: true });
    consumes.push({ actorUuid: actor.uuid, kind: 'nextAttackSnag' });
  }

  // Enhanced Impact Points (A Jump Through Time, Morph shell feature, p.32): "Your Unarmed Strike
  // Attacks can always choose to change their base damage to Blunt or Sharp without suffering any
  // Alternate Effect penalties." A Blunt/Sharp alternate of the unarmed attack gets its ↓ back.
  if (isAttack && !parentWeaponOf(actor, item) && ['blunt', 'sharp'].includes(damageType) && (item?.system?.shiftDown ?? 0) > 0
    && actorHasPerk(actor, RIDER.enhancedImpactPoints) && actor.system?.isMorphed) {
    add('enhancedImpactPoints', nameOf(actor, RIDER.enhancedImpactPoints, 'Enhanced Impact Points'), { shiftUp: item.system.shiftDown });
  }

  // In the Rain (WTNV Citizen's Guide, General Perk, p.47): "ignore ... the first ↓1 when Shoving or
  // Tripping a target in Combat."
  if (actorHasPerk(actor, RIDER.inTheRain) && (ctx.isShove || damageType == 'knocProne' || damageType == 'maneuver') && (ctx.pendingShiftDown ?? 0) > 0) {
    add('inTheRain', nameOf(actor, RIDER.inTheRain, 'In the Rain'), { shiftUp: 1 });
  }

  // Chunky (WTNV Citizen's Guide, Pet Perk, p.74): "They can use a Free action to gain an Edge when
  // attempting to Shove an enemy during combat."
  if (ctx.isShove && actorHasPerk(actor, RIDER.chunky)) {
    add('chunky', nameOf(actor, RIDER.chunky, 'Chunky'), { edge: true });
  }

  // Loader (TF CRB p.134, Alt Mode): "gain ↑2 on Might Skill Tests to shove objects and creatures".
  if (ctx.isShove && loaderShoveBonus(actor)) {
    add('loader', game.i18n.localize('E20.KitLoader'), { shiftUp: loaderShoveBonus(actor) });
  }

  // Perfect Disguise (GI Joe CRB, Spy, 10th level, p.76): "Your attacks against targets fooled by
  // your imitation gain an Edge and are sneak attacks." Everyone is fooled while it holds; the
  // first attack ends it (applyRollRiders), since "someone witnesses you attacking".
  if (isAttack && actorHasPerk(actor, RIDER.perfectDisguise) && isPerfectDisguiseActive(actor)) {
    add('perfectDisguise', nameOf(actor, RIDER.perfectDisguise, 'Perfect Disguise'), { edge: true });
  }

  // Adept Armaments (Cobra Codex, Trooper, p.52-53). Highly Effective (7th): "you gain ↑1 on Attack
  // rolls when using a secondary effect of an Adept Armament." Flurry of Attacks (15th): "when you
  // make multiple attacks on your turn, if each attack uses a different Adept Armament, you gain a
  // cumulative ↑1 on each successive attack."
  const adeptWeapon = isAttack ? parentWeaponOf(actor, item) : null;
  if (adeptWeapon?.flags?.essence20?.adeptArmament) {
    const siblings = (actor.items?.contents ?? [...(actor.items ?? [])]).filter(i => i.type == 'weaponEffect' && i.flags?.essence20?.parentId == adeptWeapon.id);
    if (hasSourced(actor, GRANT.highlyEffective) && siblings[0] && siblings[0].id != item.id) {
      add('highlyEffective', nameOf(actor, GRANT.highlyEffective, 'Highly Effective'), { shiftUp: 1 });
    }

    const flurry = flurryWeapons(actor).filter(id => id != adeptWeapon.id);
    if (hasSourced(actor, GRANT.flurryOfAttacks) && flurry.length) {
      add('flurryOfAttacks', nameOf(actor, GRANT.flurryOfAttacks, 'Flurry of Attacks'), { shiftUp: flurry.length });
    }
  }

  // Buzz The Tower (Quartermaster's Guide p.21): "the target is flustered and suffers Snag on Skill
  // Tests until the end of their next turn."
  if (findMark(actor, 'flustered')) {
    add('flustered', findMark(actor, 'flustered').label ?? 'Buzz The Tower', { snag: true });
  }

  // Companions, commands, bonded partners, BFFs and team Perks - helpers/social-rolls.mjs.
  const social = socialRollSources(actor, target, { item, rolledSkill, isAttack, isShove: ctx.isShove });
  sources.push(...social.sources);
  consumes.push(...social.consumes);

  // Extensions (helpers/extensions.mjs).
  const extended = extRollSources(actor, target, ctx);
  sources.push(...extended.sources);
  consumes.push(...extended.consumes);

  if (!target) {
    return { sources, consumes };
  }

  // A Hint of Independence's Weak-Willed (Decepticon Directive, Table 2-11): "All Deception and
  // Persuasion Skill Tests that target you gain Edge."
  if (['deception', 'persuasion'].includes(rolledSkill) && imperfectionOf(target)?.n == 8) {
    add('weakWilled', game.i18n.localize('E20.Imperfection.8'), { edge: true });
  }

  // Tough Enough (GI Joe CRB, Juggernaut, 6th level, p.99): "when you are subjected to a non-attack
  // effect against your Toughness, the effect suffers a Snag."
  if (!isAttack && item?.system?.defenseType == 'toughness' && actorHasPerk(target, RIDER.toughEnough)) {
    add('toughEnough', nameOf(target, RIDER.toughEnough, 'Tough Enough'), { snag: true });
  }

  // Frag It (Quartermaster's Guide, Disruptor, 3rd level, p.24): "you gain Resistance to area
  // effects." Resistance is a Snag on the attack.
  if (isAttack && isArea(item) && actorHasPerk(target, RIDER.fragIt)) {
    add('fragIt', nameOf(target, RIDER.fragIt, 'Frag It'), { snag: true });
  }

  // Intervene (Field Guide, p.65): the ally "gain[s] Resistance against the next attack dealing
  // Blunt or Sharp damage that targets them."
  if (isAttack && ['blunt', 'sharp'].includes(damageType) && findMark(target, 'intervene')) {
    add('intervene', findMark(target, 'intervene').label ?? 'Intervene', { snag: true });
    consumes.push({ actorUuid: target.uuid, kind: 'intervene' });
  }

  // Concentrated Fire (Cobra Codex, Pyro, 6th level, p.58): "the attack treats Fire Immunity as Fire
  // Resistance" - a Snag on the attack, and the damage lands (attackRiders).
  if (isAttack && ctx.concentratedFire && target.system?.immunities?.fire) {
    add('concentratedFire', nameOf(actor, RIDER.concentratedFire, 'Concentrated Fire'), { snag: true });
  }

  // Air Supply (Cobra Codex, armor upgrade, p.100): "You gain Resistance to Inhaled poisons."
  const weapon = parentWeaponOf(actor, item);
  if (isAttack && weapon?.system?.isPoison && weapon.system.poisonApplication?.inhaled && wearsUpgrade(target, RIDER.airSupply)) {
    add('airSupply', nameOf(target, RIDER.airSupply, 'Air Supply'), { snag: true });
  }

  // All Out Attack (GI Joe CRB, General Perk, p.129): "enemies gain an equal number of upshifts to
  // Attack you until the start of your next turn." Evasive Fighting (p.131): "force enemies to
  // suffer the same number of downshifts when attacking you."
  const stance = stanceOf(target);
  if (isAttack && stance.allOutAttack) {
    add('allOutAttack', nameOf(target, RIDER.allOutAttack, 'All Out Attack'), { shiftUp: stance.allOutAttack });
  }

  if (isAttack && stance.evasiveFighting) {
    add('evasiveFighting', nameOf(target, RIDER.evasiveFighting, 'Evasive Fighting'), { shiftDown: stance.evasiveFighting });
  }

  // Mesmerized (GI Joe CRB p.225): "Any Social tests by the mesmerizer gain Edge on mesmerized
  // characters."
  if (isSocial && hasConditionFrom(target, 'mesmerized', actor)) {
    add('mesmerized', game.i18n.localize('E20.StatusMesmerized'), { edge: true });
  }

  // Worst Nightmare (Hawk's Personnel Files, p.174): "...or an Edge if the target is Frightened of
  // you." The ↑1 half is in dice.mjs.
  if (isAttack && actorHasPerk(actor, RIDER.worstNightmare) && hasConditionFrom(target, 'frightened', actor)) {
    add('worstNightmareEdge', nameOf(actor, RIDER.worstNightmare, 'Worst Nightmare'), { edge: true });
  }

  // Shots Fired (Field Guide, p.68): "when you deal damage to a creature, you gain an Edge on
  // Deception, Intimidation, and Persuasion Skill Tests against that creature until the end of
  // your next turn."
  if (['deception', 'intimidation', 'persuasion'].includes(rolledSkill) && findMark(target, 'shotsFired', actor.uuid)) {
    add('shotsFired', nameOf(actor, RIDER.shotsFired, 'Shots Fired'), { edge: true });
  }

  // Grid Champion (PR CRB, General Perk, p.95): "You have a ↑1 bonus to hit Putties and Tengas of any
  // variety."
  if (isAttack && isPuttyOrTenga(target) && actorHasPerk(actor, RIDER.gridChampion)) {
    add('gridChampion', nameOf(actor, RIDER.gridChampion, 'Grid Champion'), { shiftUp: 1 });
  }

  // Machinist Revolutionary (Across the Stars, p.69): "You gain Edge on any Alertness or Streetwise
  // Skill Tests to locate Machine Empire assets. When interacting with the Machine Empire, you gain
  // ↑1 on Smarts and Social Skill Tests."
  if (isMachineEmpire(target) && actorHasPerk(actor, RIDER.machinistRevolutionary)) {
    const label = nameOf(actor, RIDER.machinistRevolutionary, 'Machinist Revolutionary');
    if (['alertness', 'streetwise'].includes(rolledSkill)) {
      add('machinistEdge', label, { edge: true });
    }

    if (['smarts', 'social'].includes(rolledEssence) || SOCIAL_SKILLS.includes(rolledSkill)) {
      add('machinist', label, { shiftUp: 1 });
    }
  }

  // Monster Hunter (Across the Stars, p.70): "You gain Edge on Survival (Tracking) Skill Tests to
  // follow or learn about a non-humanoid."
  if (rolledSkill == 'survival' && isNonHumanoid(target) && actorHasPerk(actor, RIDER.monsterHunter)) {
    add('monsterHunter', nameOf(actor, RIDER.monsterHunter, 'Monster Hunter'), { edge: true });
  }

  // Bot-Hunter (A Jump Through Time, p.54): "You enjoy ↑1 on all Skill Tests against mechanical
  // Threats." The Defense half is in riderDefenseAdjust.
  if (isMechanical(target) && target.type != 'playerCharacter' && actorHasPerk(actor, RIDER.botHunter)) {
    add('botHunter', nameOf(actor, RIDER.botHunter, 'Bot-Hunter'), { shiftUp: 1 });
  }

  // Earth Defenders (Field Guide, p.69): "You gain an Edge on Smarts and Social Skill Tests
  // involving non-human creatures."
  if (['smarts', 'social'].includes(rolledEssence) && isNonHuman(target) && actorHasPerk(actor, RIDER.earthDefenders)) {
    add('earthDefenders', nameOf(actor, RIDER.earthDefenders, 'Earth Defenders'), { edge: true });
  }

  // Snatch (Ferocious Fighters p.37): "Disarm attempts suffer ↓1 when targeting a two-handed weapon."
  // Listed (and untickable) whenever a Maneuver is rolled at someone holding one.
  if (damageType == 'maneuver' && actorHasPerk(actor, RIDER.snatch)
    && heldWeapons(target, 9).some(w => (w.system?.derivedHands ?? w.system?.hands ?? 1) >= 2)) {
    add('snatch', game.i18n.format('E20.SnatchTwoHanded', { perk: nameOf(actor, RIDER.snatch, 'Snatch') }), { shiftDown: 1 });
  }

  // Blazing Strikes (Across the Stars, p.72): "Critical Effect: Next ally gains ↑2 against this foe."
  const blazing = getMarks(target).find(mark => mark.kind == 'blazingStrikes' && mark.by != actor.uuid);
  if (isAttack && blazing) {
    add('blazingStrikes', blazing.label ?? 'Blazing Strikes', { shiftUp: 2 });
    consumes.push({ actorUuid: target.uuid, kind: 'blazingStrikes', by: blazing.by });
  }

  return { sources, consumes };
}

/**
 * Fanatic (Decepticon Directive, Influence Perk, p.25): "While in the presence of a Decepticon
 * commander or anyone with the Word of Unicron General Perk, you can't suffer greater than ↓2 on any
 * given Skill Test." "A Decepticon commander" is an ally tagged "commander" on the scene.
 * @param {Actor} actor
 * @param {Number} shiftUp
 * @param {Number} shiftDown
 * @returns {RiderSource|null}   The upshift that brings the net back to ↓2.
 */
export function fanaticCap(actor, shiftUp, shiftDown) {
  if (shiftDown - shiftUp <= 2 || !actorHasPerk(actor, RIDER.fanatic) || !leaderPresent(actor)) {
    return null;
  }

  return {
    id: 'rider-fanatic', label: nameOf(actor, RIDER.fanatic, 'Fanatic'),
    shiftUp: shiftDown - shiftUp - 2, shiftDown: 0, edge: false, snag: false,
  };
}

function leaderPresent(actor) {
  const own = tokenOf(actor);
  return (canvas?.tokens?.placeables ?? []).some(token => token !== own && token.actor
    && (!own || token.document.disposition == own.document.disposition)
    && (String(token.actor.system?.creatureTags ?? '').toLowerCase().includes('commander')
      || token.actor.items?.some?.(item => item.type == 'perk' && item.name?.toLowerCase() == WORD_OF_UNICRON_NAME)));
}

function coDependentPartner(actor) {
  const hangUp = findSourced(actor, RIDER.coDependent);
  const bondUuid = riderChoiceOf(hangUp);
  if (!bondUuid) {
    return null;
  }

  return game.actors?.get?.(bondUuid.split('.').pop()) ?? canvas?.tokens?.placeables?.find(t => t.actor?.uuid == bondUuid)?.actor ?? null;
}

function wearsUpgrade(actor, id) {
  return !!actor?.items?.some?.(item => item.type == 'upgrade' && sourceOf(item) == id
    && (!item.flags?.essence20?.parentId || actor.items.get(item.flags.essence20.parentId)?.system?.equipped !== false));
}

const DEVICE_RADIUS_FEET = 30;
const DEVICE_FLAG = 'deviceOn';

function activeDevicesNear(actor) {
  const own = tokenOf(actor);
  if (!own || !canvas?.tokens) {
    return [];
  }

  const found = [];
  for (const token of canvas.tokens.placeables) {
    // A vehicle's switched-on Radar Jammer (50ft) or Enhanced Radar Jamming (1 mile) - helpers/
    // vehicle-upgrades.mjs#jammingRadiusFeet. Same Technology Snag as a carried Jammer.
    const jamming = jammingRadiusFeet(token.actor);
    if (jamming && distanceFeet(token.center, own.center) <= jamming) {
      found.push({ kind: 'jammer', name: token.actor.name });
    }

    for (const item of token.actor?.items ?? []) {
      const kind = sourceOf(item) == RIDER.jammer ? 'jammer' : sourceOf(item) == RIDER.whiteNoise ? 'whiteNoise' : null;
      if (kind && item.flags?.essence20?.[DEVICE_FLAG] && distanceFeet(token.center, own.center) <= DEVICE_RADIUS_FEET) {
        found.push({ kind, name: item.name });
      }
    }
  }

  return found;
}

function flurryWeapons(actor) {
  const stamp = actor?.flags?.essence20?.flurryTurn;
  const combat = game?.combat;
  return stamp && combat && stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn ? stamp.weapons ?? [] : [];
}

/** A Hint of Independence's imperfection (Decepticon Directive, Table 2-11), kept on the Perk. */
export function imperfectionOf(actor) {
  return actor?.items?.find?.(i => sourceOf(i) == GRANT.hintOfIndependence)?.flags?.essence20?.imperfection ?? null;
}

/* -------------------------------------------- */
/*  The target's Defense                         */
/* -------------------------------------------- */

/**
 * What this target's Defense gains or loses against this roll.
 * @param {Actor} actor   The roller.
 * @param {Actor} target
 * @param {String} defenseType
 * @param {Object} ctx   {item, isAttack, pinpoint, makeAnOpening}
 * @returns {Number}   Added to the difficulty.
 */
export function riderDefenseAdjust(actor, target, defenseType, ctx = {}) {
  // Shield Companion, Issue Command, Hit Someone Your Own Size! - helpers/social-rolls.mjs.
  let adjust = target ? socialDefenseAdjust(actor, target, defenseType) + extDefenseAdjust(actor, target, defenseType, ctx) : 0;
  const { item, isAttack } = ctx;

  // On My Mark! (Decepticon Directive, Demolitionist, 10th level, p.54): "any Contingency action you
  // take (or arrange for) that targets a creature that you most recently designated with Mark
  // Target treats that creature's Defenses as being 5 lower." A roll made off the roller's own turn
  // is a Contingency.
  if (actorHasPerk(actor, RIDER.onMyMark) && checkMarkTarget(actor, target) && game.combat
    && game.combat.combatant?.actor?.id != actor.id) {
    adjust -= 5;
  }

  // Suppressing Fire (GI Joe CRB, Heavy Gunner, 3rd level, p.111): "Any enemies who start their turn
  // in that area or move into it have their Toughness and Evasion reduced by 5 until the start of
  // your next turn."
  if (['toughness', 'evasion'].includes(defenseType) && suppressingZonesOn(target).length) {
    adjust -= 5;
  }

  // Make an Opening (Decepticon Directive, Beast Warrior, 17th level, p.58): "you reduce the bonus
  // provided by that armor by 2 (to a minimum of +0 to a single Defense); this penalty lasts for
  // the remainder of the scene."
  const strip = findMark(target, 'armorStrip');
  if (strip && strip.defense == defenseType) {
    adjust -= Math.min(strip.amount, armorUpgradeBonuses(target, defenseType).reduce((a, b) => a + b, 0));
  }

  // Pinpoint (TF CRB, Sharpshooter, 9th level, p.60): "when you use the Aim action, instead of ↑1 on
  // your shot, you can choose to ignore one of the target's Armor Upgrades for each Free action you
  // spend Aiming." The biggest ones go first.
  if (isAttack && ctx.pinpoint > 0) {
    const bonuses = armorUpgradeBonuses(target, defenseType).sort((a, b) => b - a).slice(0, ctx.pinpoint);
    adjust -= bonuses.reduce((a, b) => a + b, 0);
  }

  // Energic Shields (PR CRB, Morph shell feature, p.39): "Pick one type of non-physical (blunt or
  // sharp) damage. While Morphed, you gain +3 Toughness to that type of damage."
  const shields = findSourced(target, RIDER.energicShields);
  if (isAttack && defenseType == 'toughness' && shields && target.system?.isMorphed
    && riderChoiceOf(shields) && riderChoiceOf(shields) == item?.system?.damageType) {
    adjust += 3;
  }

  // Bot-Hunter (A Jump Through Time, p.54): "Gain +1 to all Defenses against the actions of robotic
  // Threats."
  if (isRobotic(actor) && actor.type != 'playerCharacter' && actorHasPerk(target, RIDER.botHunter)) {
    adjust += 1;
  }

  // A Hint of Independence's Vulnerability: "Choose a damage type, your Toughness Defense is halved
  // (round up) to that damage."
  const imperfection = imperfectionOf(target);
  if (isAttack && defenseType == 'toughness' && imperfection?.n == 4 && imperfection.imperfectionType == item?.system?.damageType
    && Number.isFinite(ctx.difficulty)) {
    adjust -= ctx.difficulty - Math.ceil(ctx.difficulty / 2);
  }

  // Scarefying Appearance's "+2 Toughness" benefit (Knights of Canterlot p.51).
  if (defenseType == 'toughness' && scarefyingBenefits(target).includes('toughness')) {
    adjust += 2;
  }

  return adjust;
}

/**
 * The Defense each of the target's Armor Upgrades adds to one Defense.
 * @param {Actor} actor
 * @param {String} defenseType
 * @returns {Array<Number>}
 */
export function armorUpgradeBonuses(actor, defenseType) {
  const equipped = new Set((actor?.items?.contents ?? [...(actor?.items ?? [])])
    .filter(item => item.type == 'armor' && item.system?.equipped).map(item => item.id));
  return (actor?.items?.contents ?? [...(actor?.items ?? [])])
    .filter(item => item.type == 'upgrade' && item.system?.type == 'armor' && item.system?.armorBonus?.defense == defenseType
      && (equipped.has(item.flags?.essence20?.parentId) || (!item.flags?.essence20?.parentId && actor.system?.canTransform)))
    .map(item => Number(item.system.armorBonus.value) || 0)
    .filter(value => value > 0);
}

/* -------------------------------------------- */
/*  Roll Options Dialog                          */
/* -------------------------------------------- */

/**
 * What the dialog offers. Merged into the roll's dataset.
 * @param {Actor} actor
 * @param {Item} item
 * @returns {Object}
 */
export function riderDialogFlags(actor, item, dataset = {}) {
  const flags = {};
  if (!isWeaponEffect(item)) {
    return flags;
  }

  // Concentrated Fire - "can score a Critical Success on the d2" (pickConcentratedArea).
  if (dataset?.concentratedFire) {
    flags.canCritD2 = true;
  }

  const skill = item.system?.classification?.skill;
  const ownTurn = !game.combat || game.combat.combatant?.actor?.id == actor.id;
  // All Out Attack / Evasive Fighting (GI Joe CRB p.129/131): "During your turn, you can voluntarily
  // take downshifts on your Attacks with Might, Finesse, or Targeting."
  if (ownTurn && ['might', 'finesse', 'targeting'].includes(skill)) {
    if (actorHasPerk(actor, RIDER.allOutAttack)) {
      flags.allOutAttackMax = 5;
    }

    if (actorHasPerk(actor, RIDER.evasiveFighting)) {
      flags.evasiveFightingMax = 5;
    }
  }

  // Pinpoint - see riderDefenseAdjust.
  if (item.system?.classification?.style != 'melee' && actorHasPerk(actor, RIDER.pinpoint)) {
    flags.pinpointMax = 3;
  }

  // Steady Hand (Cobra Codex, Trooper, 10th level, p.53): "when you would suffer Snag on an attack with
  // an Adept Armament ... you can spend a Free Action to roll your Skill Test without Snag."
  if (parentWeaponOf(actor, item)?.flags?.essence20?.adeptArmament && hasSourced(actor, GRANT.steadyHand)) {
    flags.steadyHandAvailable = true;
  }

  // Make an Opening - "an unarmed combat attack at ↓2 against a target that has an armor upgrade
  // installed."
  const target = game.user?.targets?.first?.()?.actor;
  if (!parentWeaponOf(actor, item) && actorHasPerk(actor, RIDER.makeAnOpening) && target
    && ['toughness', 'evasion'].some(d => armorUpgradeBonuses(target, d).length)) {
    flags.makeAnOpeningAvailable = true;
  }

  return flags;
}

/**
 * The downshifts picked in the dialog. Called once the dialog closes.
 * @param {Actor} actor
 * @param {Object} options   The dialog's result (mutated).
 * @returns {Promise<void>}
 */
export async function applyDialogRiders(actor, options) {
  const allOut = Math.max(0, Number(options.allOutAttackShifts) || 0);
  const evasive = Math.max(0, Number(options.evasiveFightingShifts) || 0);
  options.shiftDown += allOut + evasive + (options.applyMakeAnOpening ? 2 : 0);
  if (options.applySteadyHand && options.snag) {
    const { spend } = await import("./action-economy.mjs");
    const paid = game.combat ? await spend(actor, 'free', { source: game.i18n.localize('E20.RollDialogSteadyHand') }) : { blocked: false };
    if (!paid.blocked) {
      options.snag = false;
    }
  }

  if (allOut || evasive) {
    await setStance(actor, { allOutAttack: allOut, evasiveFighting: evasive });
  }
}

/* -------------------------------------------- */
/*  After the roll                               */
/* -------------------------------------------- */

/**
 * The part of the roll this file needs afterwards, built in dice.mjs#rollSkill.
 * @returns {Object}
 */
export function buildRiderContext(actor, item, dataset, options, consumes = []) {
  const weapon = parentWeaponOf(actor, item);
  let spec = null;
  try {
    spec = dataset?.riderSpec ? JSON.parse(dataset.riderSpec) : null;
  } catch (error) {
    spec = null;
  }

  return {
    spec,
    itemUuid: item?.uuid ?? null,
    itemSource: sourceOf(item) ?? null,
    weaponId: weapon?.id ?? null,
    weaponSource: sourceOf(weapon) ?? null,
    weaponHands: weapon?.system?.derivedHands ?? weapon?.system?.hands ?? null,
    isUnarmed: isWeaponEffect(item) && !weapon,
    isArea: isArea(item),
    style: item?.system?.classification?.style ?? null,
    skill: dataset?.skill ?? null,
    damageType: item?.system?.damageType ?? null,
    isPoison: !!weapon?.system?.isPoison,
    hackerPoison: isHackerPoison(weapon),
    coating: coatingOf(weapon),
    disarmingShot: !!options?.applyDisarmingShot,
    concentratedFire: !!dataset?.concentratedFire,
    allOutAttack: Number(options?.allOutAttackShifts) || 0,
    makeAnOpening: !!options?.applyMakeAnOpening,
    consumes,
  };
}

/**
 * Everything that happens once the dice have landed. Mutates `results` - the per-target rows the
 * check card is built from - and applies what the rules apply on a hit.
 * @param {Actor} actor
 * @param {Array<Object>} results
 * @param {Object} checkContext
 * @param {Object} outcome   {isCrit, isFumble, entries}
 * @returns {Promise<void>}
 */
export async function applyRollRiders(actor, results, checkContext, { isCrit = false, isFumble = false } = {}) {
  const rider = checkContext?.riderContext ?? {};
  const spec = rider.spec;
  noteRoller(actor);

  for (const consume of rider.consumes ?? []) {
    if (consume.companionKey || consume.rightHandsShield || consume.leaveItToMe) {
      await consumeSocial(consume);
      continue;
    }

    if (consume.ext) {
      await runConsumer(consume);
      continue;
    }

    const holder = await fromUuid(consume.actorUuid);
    if (holder) {
      await removeMark(holder, consume.kind, consume.by ?? null);
    }
  }

  if (spec) {
    await resolveSpec(actor, spec, results, { isCrit, isFumble });
    await resolveTargetedSpec(actor, spec, results, { isCrit });
  }

  const hits = [];
  for (const [index, result] of (results ?? []).entries()) {
    const target = result.targetUuid ? await fromUuid(result.targetUuid) : null;
    const entry = checkContext?.entries?.[index] ?? null;
    if (target) {
      hits.push({ result, target, entry, hit: !!result.success });
    }
  }

  await skillImmunity(actor, hits, checkContext);
  // Who rolled against whom this round (Pack Attack, Automatic Harmonics), and a BFF's failure (Leave It
  // To Me) - helpers/companions.mjs, helpers/bff.mjs.
  await noteRolledAgainst(actor, hits.map(h => h.target), !!rider.style);
  if (rider.skill && (results ?? []).length && results.every(r => r.success === false)) {
    await noteFailure(actor, rider.skill);
  }

  await scapegoatHangUp(hits);

  // Flurry of Attacks counts the Adept Armaments used this turn.
  const usedWeapon = rider.weaponId ? actor.items?.get?.(rider.weaponId) : null;
  if (usedWeapon?.flags?.essence20?.adeptArmament && hasSourced(actor, GRANT.flurryOfAttacks) && game.combat) {
    const list = flurryWeapons(actor);
    if (!list.includes(usedWeapon.id)) {
      await actor.setFlag('essence20', 'flurryTurn', { combatId: game.combat.id, round: game.combat.round, turn: game.combat.turn, weapons: [...list, usedWeapon.id] });
    }
  }

  // A Hint of Independence's Stress Leak: "Choose an Element type, one random creature or object
  // adjacent to you takes 1 damage of that type when you Fumble a Skill Test."
  const leak = imperfectionOf(actor);
  if (isFumble && leak?.n == 3) {
    const { getAllNearbyTokens } = await import("./allies.mjs");
    const near = getAllNearbyTokens(actor, 5);
    const victim = near[Math.floor(Math.random() * near.length)]?.actor;
    if (victim) {
      const { applyDamage } = await import("./combat.mjs");
      await applyDamage(victim, 1, leak.imperfectionType ?? 'fire');
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format('E20.StressLeak', { name: actor.name, victim: victim.name }) });
    }
  }

  const attacked = hits.length && checkContext?.isAttack !== false && (rider.itemUuid && (await fromUuid(rider.itemUuid))?.type == 'weaponEffect');
  if (attacked) {
    await attackRiders(actor, hits, checkContext, rider, { isCrit, isFumble });
  }

  await spellRiders(actor, hits, checkContext);
  await runPostRoll(actor, results, checkContext, { isCrit, isFumble, hits, rider });
}

async function resolveSpec(actor, spec, results, { isCrit, isFumble }) {
  const success = !!results?.[0]?.success;
  const multiplier = results?.[0]?.multiplier ?? 0;
  switch (spec.kind) {
  case 'save':
    await resolveSaveRoll(actor, spec.spec, success);
    break;
  case 'coat': {
    const line = await resolveCoatingRoll(actor, spec, { success, isCrit: success && (isCrit || multiplier >= 2), isFumble });
    if (line) {
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: line });
    }

    break;
  }

  case 'shove':
    await resolveShove(actor, spec, { success, multiplier, isFumble });
    break;
  case 'reassemble':
    if (success) {
      const weapon = await fromUuid(spec.weaponUuid);
      await weapon?.unsetFlag?.('essence20', 'dismantled');
    }

    break;
  default:
    break;
  }
}

/**
 * Fear Is Universal (Cobra Codex, Taskmaster, 10th level, p.57): "You can spend a Story Point to use
 * these skills on a creature normally immune to them, such as a robot." A creature immune to the
 * Skill rolled against it isn't affected unless that point is spent.
 */
async function skillImmunity(actor, hits, checkContext) {
  const skill = checkContext?.riderContext?.skill;
  const immune = hits.filter(({ target, hit }) => hit && skill && isImmuneToSkill(target, skill));
  for (const { result, target } of immune) {
    let overcome = false;
    if (actorHasPerk(actor, RIDER.fearIsUniversal)) {
      const { canSpendForActor, spendForActor } = await import("./story-points.mjs");
      if (canSpendForActor(actor, 1)) {
        overcome = await foundry.applications.api.DialogV2.confirm({
          window: { title: nameOf(actor, RIDER.fearIsUniversal, 'Fear Is Universal') },
          content: `<p>${game.i18n.format('E20.FearIsUniversalPrompt', { name: target.name })}</p>`,
          rejectClose: false,
        });
        if (overcome) {
          await spendForActor(actor, 1);
        }
      }
    }

    if (!overcome) {
      result.success = false;
      result.multiplier = 0;
      result.damageValue = null;
      result.criticalOptions = [];
      result.riderNote = game.i18n.format('E20.SkillImmuneNote', { name: target.name });
    }
  }
}

/**
 * Scapegoat's Hang-Up (Cobra Codex p.33): "If you use your Scapegoat Influence Perk and the effect
 * still succeeds, you take 1 point of Essence damage to your Smarts."
 */
async function scapegoatHangUp(hits) {
  for (const { target, entry, hit } of hits) {
    if (hit && entry?.scapegoatSwapped && actorHasHangUp(target, RIDER.scapegoatHangUp)) {
      const { applyEssenceDamage } = await import("./environment-hazards.mjs");
      const damaged = await applyEssenceDamage(target, ['smarts']);
      if (damaged.length) {
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: target }),
          content: game.i18n.format('E20.CheckEssenceDamageApplied', { name: target.name, essence: game.i18n.localize(CONFIG.E20.essences?.smarts ?? 'smarts') }),
        });
      }
    }
  }
}

/* -------------------------------------------- */
/*  After an attack                              */
/* -------------------------------------------- */

const CRIT_WEAPON_OPTIONS = {
  // Mauler (Decepticon Directive p.73): "Alternate Effects: 1 Strength Essence damage".
  [RIDER.mauler]: { key: 'mauler', essence: 'strength' },
  // Arm Claws (Across the Stars p.86): "Critical Effect: Stun 2".
  [RIDER.armClaws]: { key: 'armClaws', damageValue: 2, damageType: 'stun' },
  // Chest Blast (Across the Stars p.86): "Critical Effect: Make an additional Chest Blast Attack
  // immediately against the same target (maximum of 2 additional Attacks per turn)".
  [RIDER.chestBlast]: { key: 'chestBlast', rider: 'bonusAttack' },
};

async function attackRiders(actor, hits, checkContext, rider, { isCrit }) {
  const localize = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  const damageBonusNote = (result, amount, source) => {
    result.damageValue += amount;
    result.damageBonusLabel = [result.damageBonusLabel, localize('E20.CheckDamageBonusFrom', { value: amount, sources: source })].filter(Boolean).join(' ');
  };

  let allOutAttackLeft = rider.allOutAttack;
  const headache = rider.isUnarmed && actorHasPerk(actor, RIDER.headache) ? essenceDamageOf(actor) : 0;
  const disarmed = [];

  for (const { result, target, entry, hit } of hits) {
    if (!hit) {
      continue;
    }

    // Unstoppable Force (GI Joe CRB, Juggernaut, 10th level, p.112): "when wearing heavy or super
    // heavy armor, if you use your Toughness to resist an attack against your Evasion, you do not
    // suffer any additional penalties from using your Toughness (such as Conditions or additional
    // damage effects)." Only the damage itself lands.
    const shrugs = entry?.defenseType == 'toughness' && checkContext.suggestedDefenseType == 'evasion'
      && actorHasPerk(target, RIDER.unstoppableForce)
      && target.items?.some?.(item => item.type == 'armor' && item.system?.equipped && ['heavy', 'superHeavy', 'ultraHeavy'].includes(item.system?.classification));
    if (shrugs) {
      result.secondaryDamage = null;
      result.riderNote = localize('E20.UnstoppableForceNote', { name: target.name });
    }

    if (result.damageValue) {
      // Reveal Weakness (Field Guide, p.68): "attacks that successfully target them deal +1 damage
      // for the rest of combat."
      const weakness = findMark(target, 'revealWeakness');
      if (weakness) {
        damageBonusNote(result, 1, weakness.label ?? 'Reveal Weakness');
      }

      // Targetmaster (Enigma of Combination p.41): "it deals 1 additional damage".
      const partnerDamage = socialDamageBonus(actor, rider.weaponId);
      if (partnerDamage) {
        damageBonusNote(result, partnerDamage, localize('E20.Targetmaster'));
      }

      // Extensions (helpers/extensions.mjs).
      await runHitRiders(actor, target, result, rider, { damageBonusNote, addRiderOption, isCrit, entry, checkContext });

      // Acid Sacs (WTNV, Animal Perk): "Your pet's attacks deal 1 Acid damage in addition to their main
      // weapon."
      if (acidSacsDamage(actor)) {
        addRiderOption(result, { key: 'acidSacs', label: localize('E20.AcidSacs'), damageValue: acidSacsDamage(actor), damageType: 'acid' });
      }

      // All Out Attack: "For each downshift you take, you deal 1 additional damage to a single
      // target hit by the Attack."
      if (allOutAttackLeft) {
        damageBonusNote(result, allOutAttackLeft, nameOf(actor, RIDER.allOutAttack, 'All Out Attack'));
        allOutAttackLeft = 0;
      }

      // Headache (WTNV Citizen's Guide, p.47): "you may deal additional Psychic damage equal to your
      // current Essence damage with your unarmed melee attacks."
      if (headache) {
        damageBonusNote(result, headache, nameOf(actor, RIDER.headache, 'Headache'));
      }

      // Shaped Charges (GI Joe CRB, Artillery, 7th level, p.81): "your explosives deal double damage
      // to objects and structures."
      if (rider.style == 'explosive' && isObjectOrStructure(target) && actorHasPerk(actor, RIDER.shapedCharges)) {
        damageBonusNote(result, result.damageValue, nameOf(actor, RIDER.shapedCharges, 'Shaped Charges'));
      }

      // Hacker (Cobra Codex p.80): "your poisons affect only robots and targets with the
      // Computerized Trait."
      if (rider.isPoison && rider.hackerPoison && !isMechanical(target)) {
        result.damageValue = null;
        result.criticalOptions = [];
        result.riderNote = localize('E20.HackerPoisonNoEffect', { name: target.name });
        continue;
      }
    }

    // A poison on the weapon (Cobra Codex p.93): "your next attack with that weapon, if successful,
    // deals not just one of the weapon's normal effects, but also the effect of the applied poison."
    if (rider.concentratedFire && result.damageValue && rider.damageType == 'fire' && target.system?.immunities?.fire) {
      addRiderOption(result, {
        key: 'concentratedFire', label: nameOf(actor, RIDER.concentratedFire, 'Concentrated Fire'),
        damageValue: result.damageValue, damageType: 'fire', ignoreImmunity: true,
      });
      result.damageValue = null;
    }

    if (rider.coating?.damageValue && poisonAffects(rider.coating, target)) {
      addRiderOption(result, {
        key: 'poison', label: rider.coating.name, damageValue: rider.coating.damageValue, damageType: rider.coating.damageType,
      });
    }

    if (!shrugs) {
      await conditionRiders(actor, target, result, rider);
    }

    if (isCrit && result.damageValue !== null) {
      critRiders(actor, target, result, rider);
    }

    // Ablative Matrix (Enigma of Combination p.54): "this bonus is reduced by 1 each time the wearer
    // is hit by a Critical Success attack Skill Test."
    if (isCrit) {
      await degradeAblative(target);
    }

    // Make an Opening: "If you succeed, you reduce the bonus provided by that armor by 2".
    if (rider.makeAnOpening) {
      const defense = armorUpgradeBonuses(target, 'toughness').length ? 'toughness' : 'evasion';
      await addMark(target, { kind: 'armorStrip', by: actor.uuid, defense, amount: 2, sceneEpoch: getSceneEpoch(), label: nameOf(actor, RIDER.makeAnOpening, 'Make an Opening') });
    }

    // Disarming Shot (Hawk's Personnel Files, p.174): "On a success, you knock the weapon out of
    // their hand. It lands at their feet. On a Critical Success, the weapon also goes off,
    // automatically affecting the creature."
    if (rider.disarmingShot) {
      const weapon = await disarm(actor, target, { maxHands: 1, source: nameOf(actor, RIDER.disarmingShot, 'Disarming Shot') });
      if (weapon) {
        disarmed.push({ target, weapon });
        if (result.multiplier >= 2) {
          const effect = primaryEffectOf(target, weapon);
          if (effect?.system?.damageValue) {
            addRiderOption(result, {
              key: 'discharge', label: localize('E20.DisarmingShotDischarge', { weapon: weapon.name }),
              damageValue: effect.system.damageValue, damageType: effect.system.damageType,
            });
          }
        }
      }
    }

    // Disarming Shot (Decepticon Directive, Scavenger, 17th level, p.63): "when you successful hit a
    // target with a ranged attack that inflicts at least 1 damage, you can spend a Free action to
    // cause the target to drop one hand's worth of held equipment ... or two Free actions to cause
    // the target to drop two hands' worth". The Free actions are paid as it's used.
    if (rider.style != 'melee' && result.damageValue > 0 && actorHasPerk(actor, RIDER.disarmingShotDD)) {
      await disarm(actor, target, { maxHands: 2, payFree: true, optional: true, source: nameOf(actor, RIDER.disarmingShotDD, 'Disarming Shot') });
    }
  }

  // Intervene (Field Guide, p.65): "When an ally within line of sight of you makes an attack with a
  // Stun or Maneuver effect, they gain Resistance against the next attack dealing Blunt or Sharp
  // damage that targets them."
  if (['stun', 'maneuver'].includes(rider.damageType)) {
    const own = tokenOf(actor);
    const intervener = (canvas?.tokens?.placeables ?? []).find(token => token.actor && token.actor.id != actor.id
      && (!own || token.document.disposition == own.document.disposition) && actorHasPerk(token.actor, RIDER.intervene));
    if (intervener) {
      await addMark(actor, { kind: 'intervene', by: intervener.actor.uuid, combatId: game.combat?.id ?? null, label: nameOf(intervener.actor, RIDER.intervene, 'Intervene') });
    }
  }

  // Perfect Disguise "stops working if someone witnesses you attacking".
  if (isPerfectDisguiseActive(actor)) {
    await actor.setFlag('essence20', 'perfectDisguiseActive', false);
  }
}

/**
 * On-hit Conditions that come with the attack itself.
 */
async function conditionRiders(actor, target, result, rider) {
  // Artillery lobber (GI Joe CRB, Table 8-3.2, p.143): "1 Sharp Damage Blast (10ft radius) and
  // Trip".
  if (rider.itemSource == RIDER.artilleryLobberEffect) {
    await target.toggleStatusEffect('prone', { active: true });
  }

  // Gyro-Gun (Enigma of Combination p.51): "Alternate Effects: Target is Impaired for 1d2 turns".
  // Any other Impaired effect lasts until the end of the target's next turn.
  if (rider.damageType == 'impaired') {
    let rounds = 1;
    if (rider.itemSource == RIDER.gyroGunAlternate) {
      const roll = await new Roll('1d2').evaluate();
      rounds = roll.total;
    }

    await applyTimedCondition(target, 'impaired', rounds);
    result.riderNote = [result.riderNote, game.i18n.format('E20.RiderImpairedFor', { name: target.name, rounds })].filter(Boolean).join(' ');
  }

  // Vine Bombs (Technorganic Secrets p.48): "On hit, the Vine Bombs grapple the target. Characters
  // grappled can attempt escape against the Vine Bomb's 16 Toughness."
  if (rider.itemSource == RIDER.vineBombsEffect) {
    await target.toggleStatusEffect('grappled', { active: true });
    await postSaveCard(actor, [target], {
      title: game.i18n.localize('E20.VineBombsEscape'), skills: ['might', 'athletics'], dif: 16, status: 'grappled', removeOnSuccess: true,
    });
  }
}

/**
 * Critical Effects added to what a Critical Success can do.
 */
function critRiders(actor, target, result, rider) {
  const own = [];
  const weaponOption = CRIT_WEAPON_OPTIONS[rider.weaponSource] ?? CRIT_WEAPON_OPTIONS[rider.itemSource];
  if (weaponOption?.essence) {
    own.push({ key: weaponOption.key, label: game.i18n.localize(CONFIG.E20.essences?.[weaponOption.essence] ?? weaponOption.essence), damageValue: 1, damageType: 'special', essence: weaponOption.essence });
  } else if (weaponOption?.rider) {
    own.push({ key: weaponOption.key, label: game.i18n.localize('E20.ChestBlastCrit'), damageValue: 1, damageType: 'special', rider: weaponOption.rider });
  } else if (weaponOption) {
    own.push({ key: weaponOption.key, label: game.i18n.localize(CONFIG.E20.damageTypes[weaponOption.damageType]), damageValue: weaponOption.damageValue, damageType: weaponOption.damageType });
  }

  // Genetic Decoding (Cobra Codex, Test Subject, 17th level, p.65): "Choose an Essence Score. Your
  // attacks gain an Alternate Effect that deals 1 damage to that Essence Score."
  const decoding = findSourced(actor, RIDER.geneticDecoding);
  if (decoding) {
    const essences = riderChoiceOf(decoding) ? [riderChoiceOf(decoding)] : Object.keys(CONFIG.E20.essences ?? {}).filter(e => e != 'any');
    for (const essence of essences) {
      own.push({ key: `geneticDecoding-${essence}`, label: `${decoding.name} (${game.i18n.localize(CONFIG.E20.essences[essence])})`, damageValue: 1, damageType: 'special', essence });
    }
  }

  // Blazing Strikes - its unarmed strikes "gain 'Critical Effect: Next ally gains ↑2 against this
  // foe'".
  if (rider.isUnarmed && actor.getFlag?.('essence20', 'blazingStrikesActive')) {
    own.push({ key: 'blazingStrikes', label: game.i18n.localize('E20.BlazingStrikesCrit'), damageValue: 2, damageType: 'special', rider: 'blazingStrikes' });
  }

  // Machinist Revolutionary: "Your Attack Skill Tests against Machine Empire creatures gain the
  // following Critical Effect: 'Target is stunned until the end of your next turn.'"
  if (isMachineEmpire(target) && actorHasPerk(actor, RIDER.machinistRevolutionary)) {
    own.push({ key: 'machinist', label: nameOf(actor, RIDER.machinistRevolutionary, 'Machinist Revolutionary'), damageValue: 1, damageType: 'special', status: 'stunned' });
  }

  // Monster Hunter: "Your Attack Skill Tests targeting a non-humanoid gain the following: 'Critical
  // Effect: Target suffers Snag on their next Attack Skill Test.'"
  if (isNonHumanoid(target) && actorHasPerk(actor, RIDER.monsterHunter)) {
    own.push({ key: 'monsterHunter', label: game.i18n.localize('E20.MonsterHunterCrit'), damageValue: 1, damageType: 'special', rider: 'nextAttackSnag' });
  }

  result.criticalOptions = [...(result.criticalOptions ?? []), ...own.map(option => ({
    ...option,
    damageTypeLabel: option.damageTypeLabel ?? (option.essence
      ? game.i18n.localize(CONFIG.E20.essences?.[option.essence] ?? option.essence)
      : option.status ? game.i18n.localize(CONFIG.statusEffects?.find?.(s => s.id == option.status)?.name ?? option.status)
        : game.i18n.localize(CONFIG.E20.damageTypes?.[option.damageType] ?? option.damageType)),
  }))];

  // Ravaging Critical (GI Joe CRB, Blitzer, 8th level, p.97): "when you have a critical success on a
  // Might melee attack roll or an attack within 30 feet, your critical effects increase one step."
  // A step is one more point of the effect.
  if (actorHasPerk(actor, RIDER.ravagingCritical) && (isMightMelee(rider) || withinFeet(actor, target, 30))) {
    result.criticalOptions = result.criticalOptions.map(option => (option.essence || option.status || option.rider
      ? option : { ...option, damageValue: option.damageValue + 1, label: `${option.label} (${nameOf(actor, RIDER.ravagingCritical, 'Ravaging Critical')})` }));
  }
}

function isMightMelee(rider) {
  return rider.style == 'melee' && rider.skill == 'might';
}

function withinFeet(actor, target, feet) {
  const a = tokenOf(actor);
  const b = tokenOf(target);
  return !!a && !!b && distanceFeet(a.center, b.center) <= feet;
}

function addRiderOption(result, option) {
  result.riderOptions = [...(result.riderOptions ?? []), {
    ...option,
    damageTypeLabel: game.i18n.localize(CONFIG.E20.damageTypes?.[option.damageType] ?? option.damageType),
  }];
}

function primaryEffectOf(actor, weapon) {
  const effects = (actor?.items?.contents ?? [...(actor?.items ?? [])])
    .filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id);
  return effects.find(effect => effect.system?.damageValue) ?? effects[0] ?? null;
}

const ABLATIVE = [RIDER.ablativeHeavy, RIDER.ablativeMedium, RIDER.ablativeLight];

async function degradeAblative(target) {
  for (const upgrade of target.items?.contents ?? [...(target.items ?? [])]) {
    if (upgrade.type == 'upgrade' && ABLATIVE.includes(sourceOf(upgrade))) {
      const lost = (upgrade.flags?.essence20?.ablativeLoss ?? 0) + 1;
      if (lost <= (Number(upgrade._source?.system?.armorBonus?.value) || 0)) {
        await upgrade.setFlag('essence20', 'ablativeLoss', lost);
      }
    }
  }
}

/**
 * What an Ablative Matrix has left - read by documents/item.mjs when upgrades are prepared.
 */
export function ablativeLossOf(upgrade) {
  return ABLATIVE.includes(sourceOf(upgrade)) ? (upgrade.flags?.essence20?.ablativeLoss ?? 0) : 0;
}

/* -------------------------------------------- */
/*  Disarming                                    */
/* -------------------------------------------- */

function heldWeapons(actor, maxHands) {
  return (actor?.items?.contents ?? [...(actor?.items ?? [])]).filter(item => item.type == 'weapon' && item.system?.equipped !== false
    && !item.system?.isPoison && !(item.system?.traits ?? []).includes('integrated')
    && (item.system?.derivedHands ?? item.system?.hands ?? 1) <= maxHands);
}

/**
 * Knock a held weapon loose. The owner can pick it back up by equipping it again.
 * @returns {Promise<Item|null>}   The weapon dropped.
 */
export async function disarm(actor, target, { maxHands = 2, payFree = false, optional = false, source = '' } = {}) {
  const weapons = heldWeapons(target, maxHands);
  if (!weapons.length) {
    return null;
  }

  const choices = weapons.map(w => `<option value="${w.id}">${foundry.utils.escapeHTML(w.name)}</option>`).join('');
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: source },
    classes: ["window-app", "e20-window"],
    content: `<p>${game.i18n.format('E20.DisarmPrompt', { name: target.name })}</p><div class="form-group"><select name="weapon">${choices}</select></div>`,
    buttons: [
      { action: 'ok', label: game.i18n.localize('E20.DisarmConfirm'), default: true, callback: (event, button) => button.form.elements.weapon.value },
      ...(optional ? [{ action: 'skip', label: game.i18n.localize('E20.DisarmSkip') }] : []),
    ],
    rejectClose: false,
  });
  const weapon = weapons.find(w => w.id == picked);
  if (!weapon) {
    return null;
  }

  if (payFree && game.combat) {
    const { spend } = await import("./action-economy.mjs");
    const hands = Math.max(1, weapon.system?.derivedHands ?? weapon.system?.hands ?? 1);
    for (let i = 0; i < hands; i++) {
      const paid = await spend(actor, 'free', { source });
      if (paid.blocked) {
        return null;
      }
    }
  }

  await weapon.update({ 'system.equipped': false, 'flags.essence20.disarmed': true });

  // Dismantle Firearm (Intercontinental Adventures, p.30): "When you successfully disarm a gun, you
  // can choose to dismantle and damage it as a Free action... It is useless for the remainder of
  // the Combat unless your opponent succeeds on a DIF 20 Technology Skill Test to put it back
  // together."
  let dismantled = false;
  const isGun = (weapon.system?.traits ?? []).some(trait => ['ballistic', 'reload'].includes(trait));
  if (isGun && actorHasPerk(actor, RIDER.dismantleFirearm)) {
    dismantled = await foundry.applications.api.DialogV2.confirm({
      window: { title: nameOf(actor, RIDER.dismantleFirearm, 'Dismantle Firearm') },
      content: `<p>${game.i18n.format('E20.DismantlePrompt', { weapon: weapon.name })}</p>`,
      rejectClose: false,
    });
    if (dismantled) {
      await weapon.setFlag('essence20', 'dismantled', game.combat?.id ?? true);
    }
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${game.i18n.format(dismantled ? 'E20.DismantleDone' : 'E20.DisarmDone', { name: actor.name, target: target.name, weapon: weapon.name })}</p>${
      dismantled ? `<button type="button" class="e20-chat-action-button e20-reassemble" data-weapon-uuid="${weapon.uuid}">${game.i18n.localize('E20.DismantleReassemble')}</button>` : ''}`,
  });
  return weapon;
}

/**
 * Whether the weapon can't be used right now: it was knocked away (and not picked back up) or
 * pulled apart this combat.
 * @param {Item} weapon
 * @returns {String|null}   The warning to show.
 */
export function weaponUnusable(weapon) {
  const flags = weapon?.flags?.essence20 ?? {};
  if (flags.dismantled && (flags.dismantled === true || flags.dismantled == game.combat?.id)) {
    return game.i18n.format('E20.WeaponDismantled', { name: weapon.name });
  }

  if (flags.disarmed && weapon.system?.equipped === false) {
    return game.i18n.format('E20.WeaponDisarmed', { name: weapon.name });
  }

  // Shield modes and once-per-scene Megaform attacks - helpers/extensions/zord2/unusable.mjs.
  const zord2Reason = zord2WeaponUnusable(weapon);
  if (zord2Reason) {
    return zord2Reason;
  }

  return null;
}

/**
 * Wire the reassemble button.
 */
export function decorateRiderCard(message, html) {
  for (const button of html?.querySelectorAll?.('.e20-reassemble') ?? []) {
    button.disabled = false;
    button.addEventListener('click', async () => {
      const weapon = await fromUuid(button.dataset.weaponUuid);
      const owner = weapon?.parent;
      if (!owner || (!owner.isOwner && !game.user.isGM)) {
        return;
      }

      await owner._dice?.rollSkill({
        skill: 'technology', essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: '20',
        riderSpec: JSON.stringify({ kind: 'reassemble', weaponUuid: weapon.uuid }),
      }, owner);
    });
  }
}

/* -------------------------------------------- */
/*  Spells                                       */
/* -------------------------------------------- */

async function spellRiders(actor, hits, checkContext) {
  const spell = checkContext?.spellSourceId;
  if (!spell) {
    return;
  }

  const success = checkContext.entries?.length ? hits.some(h => h.hit) : true;
  const title = (await fromUuid(checkContext.riderContext?.itemUuid ?? ''))?.name ?? '';

  // Barreling Beam (MLP CRB p.136): "On a success, you move your target up to 15ft away."
  if (spell == RIDER.barrelingBeam) {
    for (const { target, hit } of hits) {
      if (hit) {
        await pushActor(target, actor, 15);
      }
    }
  }

  // Teleporting Beam (MLP CRB p.138): "On a success, you move your target instantly to any space
  // within range of your Beam without a creature or object in it." Range 60ft.
  if (spell == RIDER.teleportingBeam) {
    for (const { target, hit } of hits) {
      if (!hit) {
        continue;
      }

      const point = await pickCanvasPoint(game.i18n.format('E20.TeleportingBeamPick', { name: target.name }));
      const own = tokenOf(actor);
      if (point && (!own || distanceFeet(own.center, point) <= 60)) {
        await placeActorAt(target, point);
      } else if (point) {
        ui.notifications.warn(game.i18n.localize('E20.TeleportingBeamOutOfRange'));
      }
    }
  }

  if (!success) {
    return;
  }

  // Bellowbreath (Knights of Canterlot p.49): "If you use it on an unwilling subject, they must
  // succeed at a DIF 15 Brawn Skill Test or be knocked prone."
  if (spell == RIDER.bellowbreath) {
    await postSaveCard(actor, targetsOrHits(hits), { title, skills: ['brawn'], dif: 15, status: 'prone' });
  }

  // Big Honking Boom (p.46): "Those are standing next to you are knocked Prone for 1 round unless
  // they succeed at a DIF 12 Brawn Skill Test."
  if (spell == RIDER.bigHonkingBoom) {
    const { getAllNearbyTokens } = await import("./allies.mjs");
    await postSaveCard(actor, getAllNearbyTokens(actor, 5).map(t => t.actor), { title, skills: ['brawn'], dif: 12, status: 'prone', rounds: 1 });
  }

  // Lullaby (p.50): "Everyone in the area that hears this lullaby must succeed at a DIF 15 Alertness
  // Skill Test or slip gently into slumber... For the next four rounds... they have the Asleep
  // condition." 60 feet.
  if (spell == RIDER.lullaby) {
    const { getAllNearbyTokens } = await import("./allies.mjs");
    await postSaveCard(actor, getAllNearbyTokens(actor, 60).map(t => t.actor), { title, skills: ['alertness'], dif: 15, status: 'asleep', rounds: 4 });
  }

  // Flower Power (p.46): "Each time a pony brushes up against this plant, or for each round they are
  // in the area it suddenly grows, they suffer 1 Sharp damage. Anyone in the area of effect must
  // also make a DIF 12 Acrobatics Skill Test to get out of the way or be trapped inside the
  // briars. Trapped characters ... make a DIF 10 Brawn Skill Test each round to climb out, taking
  // another 1 Sharp damage for each attempt they make."
  if (spell == RIDER.flowerPower) {
    const caught = targetsOrHits(hits);
    await postSaveCard(actor, caught, {
      title, skills: ['acrobatics'], dif: 12, status: 'restrained', damageAlways: { value: 1, type: 'sharp' },
    });
    await postSaveCard(actor, caught, {
      title: game.i18n.format('E20.FlowerPowerEscape', { spell: title }), skills: ['brawn'], dif: 10, status: 'restrained',
      removeOnSuccess: true, damageAlways: { value: 1, type: 'sharp' },
    });
  }

  // Scarefying Appearance (p.51): "Threats of the same or smaller size categories as you gain the
  // Frightened condition unless they can succeed at a DIF 14 Intimidation Skill Test. You can also
  // pick two of the following benefits".
  if (spell == RIDER.scarefyingAppearance) {
    const { getNearbyEnemyTokens } = await import("./enemies.mjs");
    const sizes = Object.keys(CONFIG.E20.actorSizes ?? {});
    const own = sizes.indexOf(actor.system?.size);
    const threats = getNearbyEnemyTokens(actor, Infinity).map(t => t.actor)
      .filter(threat => own < 0 || sizes.indexOf(threat.system?.size) <= own);
    await postSaveCard(actor, threats, { title, skills: ['intimidation'], dif: 14, status: 'frightened' });
    await pickScarefyingBenefits(actor, title);
  }
}

function targetsOrHits(hits) {
  if (hits.length) {
    return hits.map(h => h.target);
  }

  return [...(game.user?.targets ?? [])].map(token => token.actor).filter(Boolean);
}

const SCAREFYING_FLAG = 'scarefyingBenefits';
const SCAREFYING_CHOICES = ['toughness', 'claws', 'wings', 'might', 'intimidation'];

async function pickScarefyingBenefits(actor, title) {
  const boxes = SCAREFYING_CHOICES.map(key => `<label class="checkbox"><input type="checkbox" name="${key}" /> ${game.i18n.localize(`E20.ScarefyingBenefit.${key}`)}</label>`).join('<br>');
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    content: `<p>${game.i18n.localize('E20.ScarefyingPickTwo')}</p>${boxes}`,
    buttons: [{
      action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true,
      callback: (event, button) => SCAREFYING_CHOICES.filter(key => button.form.elements[key]?.checked).slice(0, 2),
    }],
    rejectClose: false,
  });
  if (!Array.isArray(picked) || !picked.length) {
    return;
  }

  await actor.setFlag('essence20', SCAREFYING_FLAG, { picked, sceneEpoch: getSceneEpoch() });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: game.i18n.format('E20.ScarefyingPicked', { name: actor.name, benefits: picked.map(key => game.i18n.localize(`E20.ScarefyingBenefit.${key}`)).join(', ') }),
  });
}

/**
 * The Scarefying Appearance benefits picked, while the spell lasts.
 * @param {Actor} actor
 * @returns {Array<String>}
 */
export function scarefyingBenefits(actor) {
  const stored = actor?.flags?.essence20?.[SCAREFYING_FLAG];
  if (!stored || stored.sceneEpoch != getSceneEpoch() || !isScarefyingAppearanceActive(actor)) {
    return [];
  }

  return stored.picked ?? [];
}

/**
 * Scarefying Appearance's "↑1 to Might, or an additional ↑1 to their Intimidation" benefits, as
 * sources for the roller's own tests.
 */
export function scarefyingSources(actor, rolledSkill) {
  const picked = scarefyingBenefits(actor);
  const label = game.i18n.localize('E20.ScarefyingTitle');
  const out = [];
  if (picked.includes('might') && rolledSkill == 'might') {
    out.push({ id: 'rider-scarefyingMight', label, shiftUp: 1, shiftDown: 0, edge: false, snag: false });
  }

  if (picked.includes('intimidation') && rolledSkill == 'intimidation') {
    out.push({ id: 'rider-scarefyingIntimidation', label, shiftUp: 1, shiftDown: 0, edge: false, snag: false });
  }

  return out;
}

/* -------------------------------------------- */
/*  Shoves                                       */
/* -------------------------------------------- */

const SIZE_ORDER = () => Object.keys(CONFIG.E20.actorSizes ?? {});
export const BOWL_OVER_FLAG = 'bowlOver';

/**
 * Push or Shove (GI Joe CRB p.118, PR CRB p.110): "they must spend a Standard action to do so when
 * they are adjacent. They must then perform a Might ... Skill Test, applying the following dice
 * shift modifiers: ↑1 for each Size Class larger you are than the target, ↓1 for each Size Class
 * smaller you are than the target... The Difficulty of this Skill Test is 12, with each successful
 * effect moving the target directly away from you a distance equal to your natural Reach ... or
 * knocking the target Prone. A critical failure on a Push attempt knocks you Prone at the point of
 * impact."
 *
 * Bowl-Over (PR CRB, General Perk, p.93): "When you Sprint, you can use a Free action to Push an
 * adjacent creature at any time along the action. If successful, targets of your Push are always
 * knocked Prone, if possible."
 * @param {Actor} actor
 * @param {Object} [options]
 * @param {Boolean} [options.bowlOver]
 * @returns {Promise<Object|null>}
 */
export async function rollShove(actor, { bowlOver = false } = {}) {
  const target = game.user?.targets?.first?.()?.actor;
  if (!target || target.id == actor.id) {
    ui.notifications.warn(game.i18n.localize('E20.ShoveNeedsTarget'));
    return { cancelled: true };
  }

  if (!withinFeet(actor, target, 10)) {
    ui.notifications.warn(game.i18n.format('E20.ShoveNotAdjacent', { name: target.name }));
    return { cancelled: true };
  }

  const sizes = SIZE_ORDER();
  const difference = sizes.indexOf(actor.system?.size) - sizes.indexOf(target.system?.size);
  const known = sizes.includes(actor.system?.size) && sizes.includes(target.system?.size);
  await actor._dice?.rollSkill({
    skill: 'might', essence: 'strength',
    shiftUp: known && difference > 0 ? difference : 0,
    shiftDown: known && difference < 0 ? -difference : 0,
    dif: '12', isShove: true,
    riderSpec: JSON.stringify({ kind: 'shove', targetUuid: target.uuid, bowlOver }),
  }, actor);
  return { message: null };
}

async function resolveShove(actor, spec, { success, multiplier, isFumble }) {
  const target = await fromUuid(spec.targetUuid);
  if (!target) {
    return;
  }

  if (!success) {
    if (isFumble) {
      await actor.toggleStatusEffect('prone', { active: true });
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format('E20.ShoveFumble', { name: actor.name }) });
    }

    return;
  }

  let choice = spec.bowlOver ? 'both' : null;
  if (!choice) {
    choice = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.ActionShove') },
      classes: ["window-app", "e20-window"],
      content: `<p>${game.i18n.format('E20.ShoveChoice', { name: target.name })}</p>`,
      buttons: [
        { action: 'push', label: game.i18n.localize('E20.ShovePush') },
        { action: 'prone', label: game.i18n.localize('E20.ShoveProne') },
      ],
      rejectClose: false,
    });
  }

  if (choice == 'push' || choice == 'both') {
    await pushActor(target, actor, 5 * Math.max(1, multiplier));
  }

  if (choice == 'prone' || choice == 'both') {
    await target.toggleStatusEffect('prone', { active: true });
  }
}

/* -------------------------------------------- */
/*  Card buttons                                 */
/* -------------------------------------------- */

/**
 * A check-card button chat.mjs doesn't handle itself - a Critical Effect that marks the target or
 * hands out an attack, or Defense damage.
 * @param {ChatMessage} message
 * @param {HTMLElement} button
 * @param {Actor} target
 * @returns {Promise<Boolean>}   Whether it was handled.
 */
export async function handleRiderButton(message, button, target) {
  const attacker = ChatMessage.getSpeakerActor?.(message.speaker) ?? game.actors?.get(message.speaker?.actor);
  if (button.dataset.defense) {
    const { applyDefenseDamage } = await import("./essence-damage.mjs");
    await applyDefenseDamage(target, button.dataset.defense, 1);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: target }),
      content: game.i18n.format('E20.DefenseDamageApplied', { name: target.name, defense: game.i18n.localize(CONFIG.E20.defenses?.[button.dataset.defense] ?? button.dataset.defense) }),
    });
    return true;
  }

  switch (button.dataset.rider) {
  case 'blazingStrikes':
    await addMark(target, { kind: 'blazingStrikes', by: attacker?.uuid ?? null, sceneEpoch: getSceneEpoch(), label: game.i18n.localize('E20.BlazingStrikesCrit') });
    return true;
  case 'nextAttackSnag':
    await addMark(target, { kind: 'nextAttackSnag', by: attacker?.uuid ?? null, combatId: game.combat?.id ?? null, label: game.i18n.localize('E20.MonsterHunterCrit') });
    return true;
  case 'bonusAttack': {
    if (!attacker) {
      return true;
    }

    const { grantBonusAttack } = await import("./action-economy.mjs");
    const combat = game.combat;
    const stamp = attacker.getFlag?.('essence20', 'chestBlastBonus');
    const given = stamp && combat && stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn ? stamp.count : 0;
    if (combat && given < 2) {
      await grantBonusAttack(attacker, { source: game.i18n.localize('E20.ChestBlastCrit'), cost: 'none' });
      await attacker.setFlag('essence20', 'chestBlastBonus', { combatId: combat.id, round: combat.round, turn: combat.turn, count: given + 1 });
    }

    return true;
  }

  default:
    return false;
  }
}

/**
 * Note a creature that was damaged - Shots Fired (Field Guide, p.68).
 * @param {Actor} attacker
 * @param {Actor} target
 * @param {Number} amount
 */
export async function onDamageDealt(attacker, target, amount) {
  if (amount > 0 && attacker && target && actorHasPerk(attacker, RIDER.shotsFired)) {
    await addMark(target, { kind: 'shotsFired', by: attacker.uuid, ...untilEndOfNextTurn(attacker), label: nameOf(attacker, RIDER.shotsFired, 'Shots Fired') });
  }
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

/**
 * Run a Use button from this file's table.
 * @param {Item} item
 * @param {Object} economy   helpers/action-economy.mjs.
 * @returns {Promise<String|null>}   The chat line to post.
 */
export async function useRider(item, economy) {
  const kind = riderUseFor(item);
  const actor = item.parent;
  const target = game.user?.targets?.first?.()?.actor ?? null;
  const pay = async (cost) => {
    if (!cost || !game.combat || !economy) {
      return true;
    }

    const paid = await economy.spend(actor, cost, { source: item.name });
    return !paid.blocked;
  };

  switch (kind) {
  case 'coat':
    return startCoating(actor, economy);
  case 'poisonChemistry':
    return changePoisonState(actor, economy);
  case 'poisonProdigy':
    return poisonProdigy(actor, economy);
  case 'hacker':
    return toggleHackerPoison(actor);

    // Checkmate (GI Joe CRB, Grandmaster, 20th level, p.87): "as a Standard action, designate both a
    // target and a space that target could reach with a Sprint. Make a Persuasion Skill Test against
    // the target's Willpower. On a success, the target moves to the designated space."
  case 'checkmate': {
    if (!target) {
      ui.notifications.warn(game.i18n.format('E20.ActionPerkNeedsTarget', { perk: item.name }));
      return null;
    }

    const point = await pickCanvasPoint(game.i18n.format('E20.CheckmatePick', { name: target.name }));
    if (!point || !(await pay('standard'))) {
      return null;
    }

    await actor._dice?.rollSkill({
      skill: 'persuasion', essence: 'social', shiftUp: 0, shiftDown: 0, defenseType: 'willpower',
      riderSpec: JSON.stringify({ kind: 'checkmate', point, targetUuid: target.uuid }),
    }, actor);
    return null;
  }

  // Suppressing Fire (GI Joe CRB, Heavy Gunner, 3rd level, p.111): "As a Standard action, you set
  // your suppressive fire area equal to the Multiple Targets area of your heavy weapon."
  case 'suppressingFire':
    return placeSuppressingFire(actor, item, pay);

    // Wrecking Ball (GI Joe CRB, Juggernaut, 17th level, p.112): "You may spend a Story Point when
    // you Sprint to gain the following effects: You ignore Rough Terrain... Make a Might attack with
    // an Edge against any enemies you move through - if successful, they suffer two damage and are
    // knocked prone."
  case 'wreckingBall': {
    // Once it's under way, the button rolls the attack against the enemies moved through
    // (targeted).
    if (isWreckingBallActive(actor)) {
      if (!game.user?.targets?.size) {
        ui.notifications.warn(game.i18n.format('E20.ActionPerkNeedsTarget', { perk: item.name }));
        return null;
      }

      await actor._dice?.rollSkill({
        skill: 'might', essence: 'strength', shiftUp: 0, shiftDown: 0, edge: true, defenseType: 'toughness',
        riderSpec: JSON.stringify({ kind: 'wreckingBall' }),
      }, actor);
      return null;
    }

    const { canSpendForActor, spendForActor } = await import("./story-points.mjs");
    if (!canSpendForActor(actor, 1)) {
      ui.notifications.warn(game.i18n.format('E20.ActionPerkNoStoryPoint', { perk: item.name }));
      return null;
    }

    if (!(await pay('standard'))) {
      return null;
    }

    await spendForActor(actor, 1);
    const { setSprinting } = await import("./action-economy.mjs");
    await setSprinting(actor, true);
    await actor.setFlag('essence20', 'wreckingBall', { combatId: game.combat?.id ?? null, round: game.combat?.round ?? null, turn: game.combat?.turn ?? null });
    return game.i18n.format('E20.WreckingBallOn', { name: actor.name });
  }

  // Jammer / White Noise Generator - switched on and off.
  case 'device': {
    const on = !item.flags?.essence20?.[DEVICE_FLAG];
    await item.setFlag('essence20', DEVICE_FLAG, on);
    return game.i18n.format(on ? 'E20.DeviceOn' : 'E20.DeviceOff', { name: actor.name, device: item.name });
  }

  // Muzzle Punch (Quartermaster's Guide, General Perk, p.30): "As a Move action, you can make a
  // Finesse or Might Skill Test against the Toughness of a creature within your reach, 'thumping'
  // them with the muzzle of a two-handed ranged weapon you wield. On a success, that creature is
  // forced 5 feet directly away from you, and their Movement is reduced by 5 feet on their next
  // turn. On a Critical Success, both of these distances increase to 10 feet."
  case 'muzzlePunch': {
    if (!target || !withinFeet(actor, target, 10)) {
      ui.notifications.warn(game.i18n.format('E20.ShoveNotAdjacent', { name: target?.name ?? '' }));
      return null;
    }

    const hasGun = (actor.items?.contents ?? [...actor.items]).some(i => i.type == 'weapon' && i.system?.equipped !== false
        && (i.system?.derivedHands ?? i.system?.hands ?? 1) >= 2
        && (actor.items.contents ?? [...actor.items]).some(e => e.type == 'weaponEffect' && e.flags?.essence20?.parentId == i.id && e.system?.classification?.style != 'melee'));
    if (!hasGun) {
      ui.notifications.warn(game.i18n.localize('E20.MuzzlePunchNoWeapon'));
      return null;
    }

    if (!(await pay('move'))) {
      return null;
    }

    const skill = rankOf(actor, 'finesse') >= rankOf(actor, 'might') ? 'finesse' : 'might';
    await actor._dice?.rollSkill({
      skill, essence: skill == 'finesse' ? 'speed' : 'strength', shiftUp: 0, shiftDown: 0, defenseType: 'toughness',
      riderSpec: JSON.stringify({ kind: 'muzzlePunch', targetUuid: target.uuid }),
    }, actor);
    return null;
  }

  // Reveal Weakness (Field Guide, p.68): "you can reveal their weakness as a Standard action. When
  // you reveal a creature's weakness, attacks that successfully target them deal +1 damage for
  // the rest of combat."
  case 'revealWeakness': {
    if (!target) {
      ui.notifications.warn(game.i18n.format('E20.ActionPerkNeedsTarget', { perk: item.name }));
      return null;
    }

    if (!(await pay('standard'))) {
      return null;
    }

    await addMark(target, { kind: 'revealWeakness', by: actor.uuid, combatId: game.combat?.id ?? null, label: item.name });
    return game.i18n.format('E20.RevealWeaknessDone', { name: actor.name, target: target.name });
  }

  // Energic Shields - "Pick one type of non-physical (blunt or sharp) damage."
  case 'energicShields': {
    const choice = await pickFrom(item.name, Object.entries(CONFIG.E20.damageTypes)
      .filter(([key]) => ['acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic', 'poison', 'psychic', 'void', 'element'].includes(key))
      .map(([value, label]) => ({ value, label: game.i18n.localize(label) })), riderChoiceOf(item));
    if (!choice) {
      return null;
    }

    await item.setFlag('essence20', CHOICE_FLAG, choice);
    return game.i18n.format('E20.RiderChoiceSet', { name: actor.name, item: item.name, choice: game.i18n.localize(CONFIG.E20.damageTypes[choice]) });
  }

  // Energy Resistor (TF CRB, armor upgrade, p.132): "Choose an energy type. Weapons that deal damage
  // of that energy type do not affect you."
  case 'energyResistor': {
    const choice = await pickFrom(item.name, ['acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic']
      .map(value => ({ value, label: game.i18n.localize(CONFIG.E20.damageTypes[value]) })), riderChoiceOf(item));
    if (!choice) {
      return null;
    }

    await item.setFlag('essence20', CHOICE_FLAG, choice);
    return game.i18n.format('E20.RiderChoiceSet', { name: actor.name, item: item.name, choice: game.i18n.localize(CONFIG.E20.damageTypes[choice]) });
  }

  // Genetic Decoding - "Choose an Essence Score."
  case 'geneticDecoding': {
    const choice = await pickFrom(item.name, Object.entries(CONFIG.E20.essences ?? {}).filter(([key]) => key != 'any')
      .map(([value, label]) => ({ value, label: game.i18n.localize(label) })), riderChoiceOf(item));
    if (!choice) {
      return null;
    }

    await item.setFlag('essence20', CHOICE_FLAG, choice);
    return game.i18n.format('E20.RiderChoiceSet', { name: actor.name, item: item.name, choice: game.i18n.localize(CONFIG.E20.essences[choice]) });
  }

  // Co-Dependent - "Choose a life-form to whom you are Binary Bonded, a teammate, or a similar
  // being." The targeted token.
  case 'coDependent': {
    if (!target) {
      ui.notifications.warn(game.i18n.format('E20.ActionPerkNeedsTarget', { perk: item.name }));
      return null;
    }

    await item.setFlag('essence20', CHOICE_FLAG, target.uuid);
    return game.i18n.format('E20.RiderChoiceSet', { name: actor.name, item: item.name, choice: target.name });
  }

  // Secondary Mark (Decepticon Directive, Tracker, 10th level, p.56): "you can choose two
  // creatures to be your Primary Quarry with the same hour of research."
  case 'secondaryQuarry': {
    if (!target) {
      ui.notifications.warn(game.i18n.format('E20.ActionPerkNeedsTarget', { perk: item.name }));
      return null;
    }

    await actor.setFlag('essence20', 'secondaryQuarryUuid', target.uuid);
    return game.i18n.format('E20.SecondaryQuarryDone', { name: actor.name, target: target.name });
  }

  // Ally Awareness (TF CRB, General Perk, p.84): "once per scene as a Free action, you can use the
  // memory of advice an ally once gave you to gain the benefits of Lend Assistance."
  case 'allyAwareness': {
    const skill = await pickFrom(item.name, Object.entries(CONFIG.E20.skills ?? {})
      .map(([value, label]) => ({ value, label: game.i18n.localize(label) })));
    if (!skill || !(await pay('free'))) {
      return null;
    }

    const { LEND_ASSISTANCE_SHIFT_FLAG } = await import("./lend-assistance.mjs");
    await bankPendingBonus(actor, LEND_ASSISTANCE_SHIFT_FLAG, { skill, shiftUp: 1, assisterUuid: actor.uuid });
    await markUsed(actor, 'allyAwarenessAssist', { window: 'scene' });
    return game.i18n.format('E20.AllyAwarenessDone', { name: actor.name });
  }

  case 'bowlOver': {
    const { isSprinting } = await import("./action-economy.mjs");
    if (!isSprinting(actor)) {
      ui.notifications.warn(game.i18n.localize('E20.BowlOverNotSprinting'));
      return null;
    }

    if (!(await pay('free'))) {
      return null;
    }

    await rollShove(actor, { bowlOver: true });
    return null;
  }

  // Power Quake (PR CRB, Grid Power, p.100): "While Morphed, you can take an action to punch the
  // ground and spend 1 to 3 Power to send a tremor out in a 15' radius, radiating from you. Every
  // creature or vehicle caught in the area must pass a Athletics or Acrobatics Skill Test or be
  // knocked Prone. The DIF for this test is equal to 12 plus 3 for each Power spent."
  case 'powerQuake': {
    const available = Number(actor.system?.powers?.personal?.value) || 0;
    const spent = Number(await pickFrom(item.name, [1, 2, 3].filter(n => n <= available)
      .map(n => ({ value: String(n), label: game.i18n.format('E20.PowerQuakeSpend', { n, dif: 12 + 3 * n }) }))));
    if (!spent || !(await pay('standard'))) {
      return null;
    }

    await actor.update({ 'system.powers.personal.value': available - spent });
    const { getAllNearbyTokens } = await import("./allies.mjs");
    await postSaveCard(actor, getAllNearbyTokens(actor, 15).map(t => t.actor), {
      title: item.name, skills: ['athletics', 'acrobatics'], dif: 12 + 3 * spent, status: 'prone',
    });
    return null;
  }

  // Gremlins' Mischief (A Jump Through Time, p.57): "By spending 1 Personal Power when targeting a
  // mechanical, robotic, or computerized target, all of your Unarmed strikes inflict
  // Electromagnetic damage instead of their normal type until the end of your turn."
  case 'gremlinsMischief': {
    const available = Number(actor.system?.powers?.personal?.value) || 0;
    if (!target || !isMechanical(target)) {
      ui.notifications.warn(game.i18n.localize('E20.GremlinsNeedsMachine'));
      return null;
    }

    if (available < 1) {
      ui.notifications.warn(game.i18n.format('E20.ActionPerkNoPower', { name: actor.name }));
      return null;
    }

    await actor.update({ 'system.powers.personal.value': available - 1 });
    await actor.setFlag('essence20', 'gremlinsMischief', { combatId: game.combat?.id ?? null, round: game.combat?.round ?? null, turn: game.combat?.turn ?? null });
    return game.i18n.format('E20.GremlinsOn', { name: actor.name });
  }

  default:
    return null;
  }
}

function rankOf(actor, skill) {
  const faces = Number(/d(\d+)/.exec(actor?.system?.skills?.[skill]?.shift ?? '')?.[1]);
  return Number.isFinite(faces) ? faces : 0;
}

async function pickFrom(title, options, selected = null) {
  if (!options.length) {
    return null;
  }

  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><select name="choice">${options.map(o => `<option value="${o.value}"${o.value == selected ? ' selected' : ''}>${foundry.utils.escapeHTML(o.label)}</option>`).join('')}</select></div>`,
    buttons: [
      { action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true, callback: (event, button) => button.form.elements.choice.value },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  }).then(result => (result && result != 'cancel' ? result : null));
}

/**
 * Whether Gremlins' Mischief is turning this actor's unarmed strikes Electromagnetic right now.
 */
export function isGremlinsMischiefActive(actor) {
  return isThisTurn(actor?.flags?.essence20?.gremlinsMischief);
}

/**
 * Whether Wrecking Ball is carrying this actor through Rough Terrain this turn.
 */
export function isWreckingBallActive(actor) {
  return isThisTurn(actor?.flags?.essence20?.wreckingBall);
}

function isThisTurn(stamp) {
  const combat = game?.combat;
  if (!stamp) {
    return false;
  }

  if (!combat || stamp.combatId == null) {
    return !combat && stamp.combatId == null;
  }

  return stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn;
}

async function placeSuppressingFire(actor, item, pay) {
  const { buildAoeShapeData, buildAoeRegionData, feetToPixels, angleBetweenPoints, DEFAULT_LINE_WIDTH_FEET } = await import("./aoe-targeting.mjs");
  const effects = (actor.items.contents ?? [...actor.items]).filter(effect => effect.type == 'weaponEffect'
    && (effect.system?.numTargets ?? 1) > 1 && effect.system?.shape && effect.system?.radius > 0);
  if (!effects.length) {
    ui.notifications.warn(game.i18n.localize('E20.SuppressingFireNoWeapon'));
    return null;
  }

  const effectId = effects.length == 1 ? effects[0].id
    : await pickFrom(item.name, effects.map(effect => ({ value: effect.id, label: `${parentWeaponOf(actor, effect)?.name ?? ''} - ${effect.name}` })));
  const effect = actor.items.get(effectId);
  const token = tokenOf(actor);
  if (!effect || !token || !(await pay('standard'))) {
    return null;
  }

  const shape = effect.system.shape;
  const shapeData = buildAoeShapeData(shape, feetToPixels(effect.system.radius), {
    token: token.document._source, center: token.center, lineWidthPixels: feetToPixels(DEFAULT_LINE_WIDTH_FEET),
  });
  const data = buildAoeRegionData(actor, { ...effect, name: item.name, system: effect.system, effects: [] }, shapeData, { lingering: false });
  data.ownership = { [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };
  data.flags = { essence20: { [ZONE_FLAG]: { kind: 'suppressingFire', actorUuid: actor.uuid, ...untilStartOfNextTurn(actor) } } };
  const origin = token.center;
  const region = await canvas.regions.placeRegion(data, {
    create: true,
    onMove: (shape == 'cone' || shape == 'line')
      ? ({ shape: placed, position }) => {
        placed.updateSource({ rotation: angleBetweenPoints(origin, position) });
        return false;
      }
      : undefined,
  });
  if (!region) {
    return null;
  }

  // "make a Targeting attack against the Willpower of any enemies who start their turn in that area
  // or move into it" - the ones in it now.
  await promptSuppressingAttack(actor, region);
  return game.i18n.format('E20.SuppressingFireOn', { name: actor.name });
}

/**
 * Offer the zone's owner the Willpower attack against whoever is in it. "If successful, the enemy is
 * frightened of you until the end of your next turn."
 * @param {Actor} owner
 * @param {RegionDocument} region
 * @param {Array<Actor>} [only]   Just these (the one who moved in, or started their turn there).
 */
export async function promptSuppressingAttack(owner, region, only = null) {
  const { getTokensInRegion } = await import("./aoe-targeting.mjs");
  const ownToken = tokenOf(owner);
  const caught = (only ?? getTokensInRegion(region).map(token => token.actor))
    .filter(actor => actor && actor.uuid != owner.uuid
      && (!ownToken || tokenOf(actor)?.document?.disposition != ownToken.document.disposition));
  if (!caught.length) {
    return;
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: owner }),
    content: `<p>${game.i18n.format('E20.SuppressingFireCaught', { name: owner.name, targets: caught.map(a => a.name).join(', ') })}</p>
      <button type="button" class="e20-chat-action-button e20-suppress-attack" data-owner-uuid="${owner.uuid}" data-targets="${caught.map(a => a.uuid).join(',')}">${game.i18n.localize('E20.SuppressingFireAttack')}</button>`,
  });
}

/**
 * Wire the Suppressing Fire attack button: target those caught, then roll Targeting against
 * Willpower. A hit frightens them "until the end of your next turn".
 */
export function decorateSuppressCard(message, html) {
  for (const button of html?.querySelectorAll?.('.e20-suppress-attack') ?? []) {
    button.disabled = false;
    button.addEventListener('click', async () => {
      const owner = await fromUuid(button.dataset.ownerUuid);
      if (!owner || (!owner.isOwner && !game.user.isGM)) {
        return;
      }

      const ids = [];
      for (const targetUuid of button.dataset.targets.split(',')) {
        const actor = await fromUuid(targetUuid);
        const token = tokenOf(actor);
        if (token) {
          ids.push(token.id);
        }
      }

      canvas.tokens.setTargets(ids);
      await owner._dice?.rollSkill({
        skill: 'targeting', essence: 'speed', shiftUp: 0, shiftDown: 0, defenseType: 'willpower',
        riderSpec: JSON.stringify({ kind: 'suppress' }),
      }, owner);
    });
  }
}

/**
 * What the Use-button rolls do once they land, per target: Checkmate, Muzzle Punch, Suppressing
 * Fire.
 */
export async function resolveTargetedSpec(actor, spec, results, { isCrit }) {
  for (const result of results ?? []) {
    if (!result.success || !result.targetUuid) {
      continue;
    }

    const target = await fromUuid(result.targetUuid);
    if (!target) {
      continue;
    }

    if (spec.kind == 'checkmate') {
      await placeActorAt(target, spec.point);
    }

    if (spec.kind == 'muzzlePunch') {
      const feet = result.multiplier >= 2 || isCrit ? 10 : 5;
      await pushActor(target, actor, feet);
      await slowNextTurn(target, feet);
    }

    if (spec.kind == 'suppress') {
      noteRoller(actor);
      await applyTimedCondition(target, 'frightened', 2);
    }

    if (spec.kind == 'wreckingBall') {
      const { applyDamage } = await import("./combat.mjs");
      await applyDamage(target, 2, 'blunt');
      await target.toggleStatusEffect('prone', { active: true });
    }
  }
}

/* -------------------------------------------- */
/*  Primary Quarry                               */
/* -------------------------------------------- */

/**
 * Whether the roll is against the actor's Primary Quarry - either of them with Secondary Mark.
 * All Too Predictable (Decepticon Directive, Tracker, 20th level, p.56): "once per turn, you may
 * reroll any single die in a Skill Test involving or targeting your Primary Mark."
 */
export function isVsPrimaryQuarry(actor, target) {
  if (!target) {
    return false;
  }

  return checkPrimaryQuarry(actor, target)
    || (actorHasPerk(actor, RIDER.secondaryQuarry) && actor.getFlag?.('essence20', 'secondaryQuarryUuid') == target.uuid);
}

/**
 * Consistent (Cobra Codex, Silver Medal Syndrome Origin, p.46): "When you roll a Critical Success on
 * a Skill Test with a benefit for Critical Successes, you can choose to treat it as a regular
 * success and gain ↑1 on your next Skill Test."
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether the Critical Success is given up.
 */
export async function askConsistent(actor) {
  if (!actorHasPerk(actor, RIDER.consistent)) {
    return false;
  }

  return !!(await foundry.applications.api.DialogV2.confirm({
    window: { title: findPerk(actor, RIDER.consistent)?.name ?? 'Consistent' },
    content: `<p>${game.i18n.localize('E20.ConsistentPrompt')}</p>`,
    rejectClose: false,
  }));
}

export { getPendingBonus };

/* -------------------------------------------- */
/*  Shaping an area                              */
/* -------------------------------------------- */

const AREA_SHAPES = ['circle', 'cone', 'line'];

/**
 * Concentrated Explosion (Cobra Codex, Saboteur, 10th level, p.51): "When you use an explosive, you
 * can make the area of effect 5 feet larger or smaller, or change its shape (from a 10-foot cone
 * to a 10-foot blast, for example)."
 *
 * Concentrated Fire (Cobra Codex, Pyro, 6th level, p.58): "when attempting an Area of Effect or
 * Multiple Target attack with a weapon with the Fire trait, you can choose to target a single
 * creature instead. If you do, the attack treats Fire Immunity as Fire Resistance, and can score a
 * Critical Success on the d2."
 *
 * Asked before the area is placed, from documents/item.mjs.
 * @param {Actor} actor
 * @param {Item} effect   The weaponEffect being rolled.
 * @returns {Promise<{radiusDeltaFeet: Number, shape: ?String, single: Boolean}|null>}   null when
 *   there's nothing to ask, or the dialog was closed.
 */
export async function pickConcentratedArea(actor, effect) {
  const weapon = parentWeaponOf(actor, effect);
  const explosive = effect?.system?.classification?.style == 'explosive' && effect.system?.shape
    && actorHasPerk(actor, RIDER.concentratedExplosion);
  const fire = (effect?.system?.shape || (effect?.system?.numTargets ?? 1) > 1)
    && ((weapon?.system?.traits ?? []).includes('fire') || effect?.system?.damageType == 'fire')
    && actorHasPerk(actor, RIDER.concentratedFire);
  if (!explosive && !fire) {
    return null;
  }

  const buttons = [{ action: 'normal', label: game.i18n.localize('E20.ConcentratedNormal'), default: true }];
  if (explosive) {
    buttons.push({ action: 'bigger', label: game.i18n.localize('E20.ConcentratedBigger') });
    if ((effect.system.radius ?? 0) > 5) {
      buttons.push({ action: 'smaller', label: game.i18n.localize('E20.ConcentratedSmaller') });
    }

    for (const shape of AREA_SHAPES.filter(s => s != effect.system.shape)) {
      buttons.push({ action: `shape-${shape}`, label: game.i18n.format('E20.ConcentratedShape', { shape: game.i18n.localize(CONFIG.E20.aoeShapes?.[shape] ?? shape) }) });
    }
  }

  if (fire) {
    buttons.push({ action: 'single', label: game.i18n.localize('E20.ConcentratedSingle') });
  }

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: explosive ? nameOf(actor, RIDER.concentratedExplosion, 'Concentrated Explosion') : nameOf(actor, RIDER.concentratedFire, 'Concentrated Fire') },
    classes: ["window-app", "e20-window"],
    content: `<p>${game.i18n.localize('E20.ConcentratedPrompt')}</p>`,
    buttons,
    rejectClose: false,
  });
  if (!choice) {
    return null;
  }

  return {
    radiusDeltaFeet: choice == 'bigger' ? 5 : choice == 'smaller' ? -5 : 0,
    shape: choice.startsWith('shape-') ? choice.slice(6) : null,
    single: choice == 'single',
  };
}

/**
 * "Any enemies who ... move into it" - a token moved into someone's Suppressing Fire area. Run by the
 * active GM from the updateToken hook; each creature is offered once per area.
 * @param {TokenDocument} tokenDoc
 */
export async function checkSuppressingEntry(tokenDoc) {
  if (!game.user?.isActiveGM || !tokenDoc?.actor) {
    return;
  }

  for (const region of zoneRegions()) {
    const zone = region.flags.essence20[ZONE_FLAG];
    if (zone.kind != 'suppressingFire' || !isZoneLive(zone) || zone.actorUuid == tokenDoc.actor.uuid
      || (zone.notified ?? []).includes(tokenDoc.actor.uuid) || !tokenDoc.testInsideRegion?.(region)) {
      continue;
    }

    const owner = await fromUuid(zone.actorUuid);
    if (!owner) {
      continue;
    }

    await region.setFlag('essence20', ZONE_FLAG, { ...zone, notified: [...(zone.notified ?? []), tokenDoc.actor.uuid] });
    await promptSuppressingAttack(owner, region, [tokenDoc.actor]);
  }
}

/**
 * The start of a turn: areas that ran out go, and "any enemies who start their turn in that area"
 * are offered to the area's owner. Called by the active GM from documents/combat.mjs.
 * @param {Actor} actor   Whose turn is starting.
 */
export async function onTurnStartZones(actor) {
  if (!game.user?.isActiveGM) {
    return;
  }

  await expireZones();
  for (const { region, zone } of suppressingZonesOn(actor)) {
    const owner = await fromUuid(zone.actorUuid);
    if (owner) {
      await promptSuppressingAttack(owner, region, [actor]);
    }
  }
}
