import { zord2WeaponUnusable } from "../../items/attacks/shield-mode-unusable-weapons.mjs";
import { ruleCriticalOptions } from "../../rules/adapter.mjs";
import { ruleConditionRounds } from "../../rules/plugins/combat/condition-duration.mjs";
import { ruleManeuverOption } from "../../rules/plugins/combat/maneuver-option.mjs";
import { ruleSwapShrug } from "../../rules/plugins/combat/swap-shrug.mjs";
import { ruleLateHitRiders } from "../../rules/plugins/combat/late-hit-rider.mjs";
import { extDefenseAdjust, extRollSources, runConsumer, runHitRiders, runPostRoll } from "../item-hooks.mjs";
import { socialDamageBonus, socialDefenseAdjust, socialRollSources } from "../../items/social/social-rolls.mjs";
import { noteRolledAgainst } from "../companions/companions.mjs";
import { actorHasPerk, getPendingBonus } from "../characters/perks.mjs";
import { getSceneEpoch } from "../resources/scene-clock.mjs";
import { applyTimedCondition } from "./timed-status.mjs";
import {
  isImmuneToSkill, isMechanical,
} from "../characters/creature-tags.mjs";
import { distanceFeet, pushActor } from "./forced-movement.mjs";
import { resolveSaveRoll } from "./save-riders.mjs";
import {
  coatingOf, isHackerPoison, poisonAffects, resolveCoatingRoll, startCoating,
} from "../../items/gear/poison-coating.mjs";
import { checkPrimaryQuarry } from "../../items/rolls/primary-quarry.mjs";
import { RIDER, riderUseFor } from "./rider-uses.mjs";
import { imperfectionOf } from "../resources/grant-uses.mjs";
import { skillImmunityOverrideOf } from "../../rules/plugins/combat/subsystem-readers.mjs";
import { sourceOfOrUndefined as sourceOf } from "../../items/shared/item-lookups.mjs";

/**
 * Per-target modifiers, on-hit riders and the Conditions that go with them - the Perks, weapons and
 * spells whose effect depends on WHO is being hit, or does something to them once they are.
 *
 * dice.mjs calls into this file at five points and nowhere else:
 * - rollRiderSources: the shifts/Edge/Snag a roll picks up from the target, the roller's own state
 *   and anything nearby, as labeled sources for the Roll Options Dialog;
 * - riderDefenseAdjust: what the target's Defense gains or loses for this attack;
 * - riderDialogFlags: what the dialog shows for this attack (Concentrated Fire's d2 Critical);
 * - applyRollRiders: everything that happens once the dice have landed.
 * chat.mjs hands the card buttons it doesn't know to handleRiderButton, and the sheet's Use button
 * reaches the RIDER_USES table through mechanics/actions/action-perks.mjs.
 *
 * Every rule is quoted where it is implemented below.
 */

export { RIDER };

const SOCIAL_SKILLS = ['animalHandling', 'deception', 'intimidation', 'performance', 'persuasion', 'streetwise', 'culture'];
const MARKS_FLAG = 'riderMarks';
const STANCE_FLAG = 'riderStance';
const ZONE_FLAG = 'riderZone';

/* -------------------------------------------- */
/*  Lookups                                     */
/* -------------------------------------------- */

export { sourceOf };

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
  const isSocial = rolledEssence == 'social' || SOCIAL_SKILLS.includes(rolledSkill);
  const add = (id, label, mods) => sources.push({ id: `rider-${id}`, label, shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...mods });

  // Monster Hunter's Critical Effect landed on this roller: "Target suffers Snag on their next
  // Attack Skill Test."
  if (isAttack && findMark(actor, 'nextAttackSnag')) {
    const mark = findMark(actor, 'nextAttackSnag');
    add('monsterHunterSnag', mark.label ?? 'Monster Hunter', { snag: true });
    consumes.push({ actorUuid: actor.uuid, kind: 'nextAttackSnag' });
  }

  // (Loader's Alt Mode shove ↑2 is a RollModifier rule on the Loader.)

  // (Perfect Disguise's Edge on attacks, its end once seen attacking and its sneak attacks - a SneakAttackGrant bypass -
  // are rules on the Perk.)

  // (Co-Dependent, Highly Effective and Flurry of Attacks are rules on their items.)

  // Companions, commands, bonded partners, BFFs and team Perks - items/social/social-rolls.mjs.
  const social = socialRollSources(actor, target, { item, rolledSkill, isAttack, isShove: ctx.isShove });
  sources.push(...social.sources);
  consumes.push(...social.consumes);

  // Extensions (mechanics/item-hooks.mjs).
  const extended = extRollSources(actor, target, ctx);
  sources.push(...extended.sources);
  consumes.push(...extended.consumes);

  if (!target) {
    return { sources, consumes };
  }

  // A Hint of Independence's Weak-Willed (Decepticon Directive, Table 2-11): Edge on any Deception or
  // Persuasion aimed at the holder.
  if (['deception', 'persuasion'].includes(rolledSkill) && imperfectionOf(target)?.n == 8) {
    add('weakWilled', game.i18n.localize('E20.Imperfection.8'), { edge: true });
  }

  // (Concentrated Fire's Snag against a Fire-immune target is a RollModifier rule on the Perk.)

  // All Out Attack (GI Joe CRB, General Perk, p.129): enemies get as many upshifts to attack the
  // holder until their next turn. Evasive Fighting (p.131): enemies take as many downshifts instead.
  const stance = stanceOf(target);
  if (isAttack && stance.allOutAttack) {
    add('allOutAttack', nameOf(target, RIDER.allOutAttack, 'All Out Attack'), { shiftUp: stance.allOutAttack });
  }

  if (isAttack && stance.evasiveFighting) {
    add('evasiveFighting', nameOf(target, RIDER.evasiveFighting, 'Evasive Fighting'), { shiftDown: stance.evasiveFighting });
  }

  // Mesmerized (GI Joe CRB p.225): the mesmerizer's Social tests on the mesmerized have Edge.
  if (isSocial && hasConditionFrom(target, 'mesmerized', actor)) {
    add('mesmerized', game.i18n.localize('E20.StatusMesmerized'), { edge: true });
  }

  // Blazing Strikes (Across the Stars, p.72): "Critical Effect: Next ally gains ↑2 against this foe."
  const blazing = getMarks(target).find(mark => mark.kind == 'blazingStrikes' && mark.by != actor.uuid);
  if (isAttack && blazing) {
    add('blazingStrikes', blazing.label ?? 'Blazing Strikes', { shiftUp: 2 });
    consumes.push({ actorUuid: target.uuid, kind: 'blazingStrikes', by: blazing.by });
  }

  return { sources, consumes };
}

/** A Hint of Independence's imperfection (Decepticon Directive, Table 2-11), kept on the Perk (grant-uses.mjs). */
export { imperfectionOf };

/* -------------------------------------------- */
/*  The target's Defense                         */
/* -------------------------------------------- */

/**
 * What this target's Defense gains or loses against this roll.
 * @param {Actor} actor   The roller.
 * @param {Actor} target
 * @param {String} defenseType
 * @param {Object} ctx   {item, isAttack}
 * @returns {Number}   Added to the difficulty.
 */
export function riderDefenseAdjust(actor, target, defenseType, ctx = {}) {
  // Shield Companion, Issue Command, Hit Someone Your Own Size! - items/social/social-rolls.mjs.
  let adjust = target ? socialDefenseAdjust(actor, target, defenseType) + extDefenseAdjust(actor, target, defenseType, ctx) : 0;
  const { item, isAttack } = ctx;

  // (On My Mark!'s -5 is an outgoing Defense rule - check:markTarget.)

  // Suppressing Fire (GI Joe CRB, Heavy Gunner, 3rd level, p.111): enemies starting a turn in, or
  // entering, the area lose 5 Toughness and Evasion until the gunner's next turn.
  if (['toughness', 'evasion'].includes(defenseType) && suppressingZonesOn(target).length) {
    adjust -= 5;
  }

  // (Make an Opening's penalty and Pinpoint's ignored upgrades - rules/plugins/combat/armor-upgrades.mjs.)

  // A Hint of Independence's Vulnerability: Toughness is halved (rounded up) against one chosen
  // damage type.
  const imperfection = imperfectionOf(target);
  if (isAttack && defenseType == 'toughness' && imperfection?.n == 4 && imperfection.imperfectionType == item?.system?.damageType
    && Number.isFinite(ctx.difficulty)) {
    adjust -= ctx.difficulty - Math.ceil(ctx.difficulty / 2);
  }

  return adjust;
}

/* -------------------------------------------- */
/*  Roll Options Dialog                          */
/* -------------------------------------------- */

// (Concentrated Fire's d2 Critical Success is a CritOnD2 rule on the Perk; Pinpoint, Steady Hand and Make an Opening are
// DialogSwitch rules on their Perks.)

// (The dialog's downshift choices - All Out Attack / Evasive Fighting, Make an Opening - are StanceSwitch / DialogSwitch
// rules now.)

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
    // A roll launched by an item's Use carries that item's uuid in its dataset (rules/steps.mjs roll).
    itemUuid: item?.uuid ?? dataset?.itemUuid ?? null,
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
    // Disarming Shot's DialogSwitch (key disarmingShot) ticked - its disarm-on-hit and Critical discharge below.
    disarmingShot: (options?.ruleKeys ?? []).includes('disarmingShot'),
    allOutAttack: Number(options?.allOutAttackShifts) || 0,
    consumes,
    // Rule switches ticked for this roll (DialogSwitch key) - the roll:switch: tag.
    switches: options?.ruleKeys ?? [],
    // The roll's own dataset flags (plain values) - the roll:dataset:<key> tag in hit / miss / afterRoll Triggers.
    dataset: Object.fromEntries(Object.entries(dataset ?? {}).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))),
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
    // Rule-banked bonuses were already spent when the roll was made (dice.mjs, next to clearPendingBonus).
    if (['rulesBank', 'rulesLimit', 'rulesMark', 'rulesMarkOwn', 'rulesMarkOne'].includes(consume.ext)) {
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
    await resolveTargetedSpec(actor, spec, results);
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
  // Who rolled against whom this round (Pack Attack, Automatic Harmonics) - mechanics/companions/companions.mjs. (A BFF's
  // failure for Leave It To Me is a rollSeen Trigger on the Perk.)
  await noteRolledAgainst(actor, hits.map(h => h.target), !!rider.style);

  // (Scapegoat's Hang-Up is a targeted Trigger rule: roll:entry:scapegoatSwapped.)

  // A Hint of Independence's Stress Leak: on a Fumble, 1 damage of a chosen Element to a random
  // adjacent creature or object.
  const leak = imperfectionOf(actor);
  if (isFumble && leak?.n == 3) {
    const { getAllNearbyTokens } = await import("./nearby-allies.mjs");
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
 * A creature immune to the Skill rolled against it isn't affected - unless one of the roller's SkillImmunityOverride rules
 * is paid for (Fear Is Universal's Story Point - rules/plugins/combat/subsystem-readers.mjs).
 */
async function skillImmunity(actor, hits, checkContext) {
  const skill = checkContext?.riderContext?.skill;
  const immune = hits.filter(({ target, hit }) => hit && skill && isImmuneToSkill(target, skill));
  for (const { result, target } of immune) {
    let overcome = false;
    const override = skillImmunityOverrideOf(actor, target);
    if (override) {
      const { canSpendForActor, spendForActor } = await import("../resources/story-points.mjs");
      if (canSpendForActor(actor, override.storyPoints)) {
        overcome = await foundry.applications.api.DialogV2.confirm({
          window: { title: override.item?.name ?? '' },
          content: `<p>${game.i18n.format('E20.FearIsUniversalPrompt', { name: target.name })}</p>`,
          rejectClose: false,
        });
        if (overcome) {
          await spendForActor(actor, override.storyPoints);
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

/* -------------------------------------------- */
/*  After an attack                              */
/* -------------------------------------------- */

async function attackRiders(actor, hits, checkContext, rider, { isCrit }) {
  const localize = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  const damageBonusNote = (result, amount, source) => {
    result.damageValue += amount;
    result.damageBonusLabel = [result.damageBonusLabel, localize('E20.CheckDamageBonusFrom', { value: amount, sources: source })].filter(Boolean).join(' ');
  };

  let allOutAttackLeft = rider.allOutAttack;
  const disarmed = [];

  for (const { result, target, entry, hit } of hits) {
    if (!hit) {
      continue;
    }

    // A SwapShrug rule on the target (Unstoppable Force: Toughness used against an Evasion attack, in heavy armor) -
    // only the damage itself lands (rules/plugins/combat/swap-shrug.mjs).
    const shrugs = !!ruleSwapShrug(target, entry?.defenseType, checkContext.suggestedDefenseType, actor);
    if (shrugs) {
      result.secondaryDamage = null;
      result.riderNote = localize('E20.UnstoppableForceNote', { name: target.name });
    }

    if (result.damageValue) {
      // (Reveal Weakness's +1 is a HitRider rule, scope markedTarget.)

      // Targetmaster (Enigma of Combination p.41): "it deals 1 additional damage".
      const partnerDamage = socialDamageBonus(actor, rider.weaponId);
      if (partnerDamage) {
        damageBonusNote(result, partnerDamage, localize('E20.Targetmaster'));
      }

      // Extensions (mechanics/item-hooks.mjs).
      await runHitRiders(actor, target, result, rider, { damageBonusNote, addRiderOption, isCrit, entry, checkContext });

      // All Out Attack: +1 damage to one hit target per downshift taken.
      if (allOutAttackLeft) {
        damageBonusNote(result, allOutAttackLeft, nameOf(actor, RIDER.allOutAttack, 'All Out Attack'));
        allOutAttackLeft = 0;
      }

      // (Shaped Charges' double damage to objects and structures is a HitMultiplier rule.)

      // Hacker (Cobra Codex p.80): the poisons work only on robots and Computerized targets.
      if (rider.isPoison && rider.hackerPoison && !isMechanical(target)) {
        result.damageValue = null;
        result.criticalOptions = [];
        result.riderNote = localize('E20.HackerPoisonNoEffect', { name: target.name });
        continue;
      }
    }

    // The late HitRider rules, once the hit's damage is settled (Concentrated Fire's Fire Immunity as Resistance -
    // rules/plugins/combat/late-hit-rider.mjs).
    ruleLateHitRiders(actor, target, result, rider, { isCrit });

    // A poison on the weapon (Cobra Codex p.93): the next hit with it adds the poison's effect to the
    // weapon's own.
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

    // Disarming Shot (Hawk's Personnel Files, p.174): a hit knocks the weapon to the target's feet; on
    // a Critical Success it also fires into its holder.
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

    // (Disarming Shot - Decepticon Directive - is a hit Trigger rule: disarm {payFree}.)
  }
}

/**
 * On-hit Conditions that come with the attack itself.
 */
async function conditionRiders(actor, target, result, rider) {
  // An Impaired effect lasts until the end of the target's next turn, unless the attack's own ConditionDuration rule says
  // otherwise (Gyro-Gun Alternate Effect's 1d2 - rules/plugins/combat/condition-duration.mjs).
  if (rider.damageType == 'impaired') {
    const item = rider.itemUuid ? globalThis.fromUuidSync?.(rider.itemUuid) ?? null : null;
    const rounds = await ruleConditionRounds(item, 'impaired', 1);

    await applyTimedCondition(target, 'impaired', rounds);
    result.riderNote = [result.riderNote, game.i18n.format('E20.RiderImpairedFor', { name: target.name, rounds })].filter(Boolean).join(' ');
  }
}

/**
 * Critical Effects added to what a Critical Success can do.
 */
function critRiders(actor, target, result, rider) {
  const own = [];
  // Mauler, Arm Claws, Chest Blast, Blazing Strikes, Machinist Revolutionary, Monster Hunter and
  // Ravaging Critical are CriticalOption item rules (rules/adapter.mjs#ruleCriticalOptions).
  const item = rider.itemUuid ? globalThis.fromUuidSync?.(rider.itemUuid) ?? null : null;
  const fromRules = ruleCriticalOptions(actor, target, item);
  own.push(...fromRules.options);

  result.criticalOptions = [...(result.criticalOptions ?? []), ...own.map(option => ({
    ...option,
    damageTypeLabel: option.damageTypeLabel ?? (option.essence
      ? game.i18n.localize(CONFIG.E20.essences?.[option.essence] ?? option.essence)
      : option.defense ? game.i18n.localize(CONFIG.E20.defenses?.[option.defense] ?? option.defense)
        : option.status ? game.i18n.localize(CONFIG.statusEffects?.find?.(s => s.id == option.status)?.name ?? option.status)
          : game.i18n.localize(CONFIG.E20.damageTypes?.[option.damageType] ?? option.damageType)),
  }))];

  // A step is one more point of a damage option (never an Essence, Condition or effect one).
  if (fromRules.improve > 0) {
    const by = fromRules.improvedBy.join(', ');
    result.criticalOptions = result.criticalOptions.map(option => (option.essence || option.status || option.rider
      ? option : { ...option, damageValue: option.damageValue + fromRules.improve, label: `${option.label} (${by})` }));
  }
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

/**
 * What an Ablative Matrix has lost - read by documents/item.mjs when upgrades are prepared. The upgrade's own
 * `targeted` Trigger rule counts it up on each Critical Success that hits its wearer.
 */
export function ablativeLossOf(upgrade) {
  return Number(upgrade?.flags?.essence20?.ablativeLoss) || 0;
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
    const { spend } = await import("../actions/action-economy.mjs");
    const hands = Math.max(1, weapon.system?.derivedHands ?? weapon.system?.hands ?? 1);
    for (let i = 0; i < hands; i++) {
      const paid = await spend(actor, 'free', { source });
      if (paid.blocked) {
        return null;
      }
    }
  }

  await weapon.update({ 'system.equipped': false, 'flags.essence20.disarmed': true });

  // A ManeuverOption {option: dismantle} rule (Dismantle Firearm, for a gun): the weapon may be pulled apart instead -
  // useless for the rest of the combat until a DIF 20 Technology test puts it back together (the chat button).
  let dismantled = false;
  const dismantler = ruleManeuverOption(actor, 'dismantle', weapon);
  if (dismantler) {
    dismantled = await foundry.applications.api.DialogV2.confirm({
      window: { title: dismantler.name },
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

  // Shield modes and once-per-scene Megaform attacks - items/attacks/shield-mode-unusable-weapons.mjs.
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

// (Spells: Barreling Beam's push and Teleporting Beam's move are hit Trigger rules on the spells - push / pickPoint + moveTo;
// Scarefying Appearance's size, save card and benefits are its afterRoll Trigger and rules.)

/* -------------------------------------------- */
/*  Shoves                                       */
/* -------------------------------------------- */

const SIZE_ORDER = () => Object.keys(CONFIG.E20.actorSizes ?? {});
export const BOWL_OVER_FLAG = 'bowlOver';

/**
 * Push or Shove (GI Joe CRB p.118, PR CRB p.110): a Standard action against an adjacent target - a
 * DIF 12 Might test, ↑1 per Size Class bigger than the target and ↓1 per Size Class smaller; each
 * success pushes it back by the pusher's natural Reach or knocks it Prone, and a critical failure
 * leaves the pusher Prone.
 *
 * Bowl-Over (PR CRB, General Perk, p.93): a Free-action Push on an adjacent creature at any point of
 * a Sprint; a successful Push always knocks the target Prone where it can be.
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

    const { grantBonusAttack } = await import("../actions/action-economy.mjs");
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

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

/**
 * Run a Use button from this file's table.
 * @param {Item} item
 * @param {Object} economy   mechanics/actions/action-economy.mjs.
 * @returns {Promise<String|null>}   The chat line to post.
 */
export async function useRider(item, economy) {
  const kind = riderUseFor(item);
  const actor = item.parent;
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
    // (Poison Prodigy is a Use rule on its Perk.)

  // Suppressing Fire (GI Joe CRB, Heavy Gunner, 3rd level, p.111): a Standard action lays the zone
  // over the heavy weapon's Multiple Targets area.
  case 'suppressingFire':
    return placeSuppressingFire(actor, item, pay);

    // (Wrecking Ball, Muzzle Punch and Bowl-Over are Use rules on their Perks.)
  default:
    return null;
  }
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

  // A Targeting attack on the Willpower of enemies in the zone - the ones in it now.
  await promptSuppressingAttack(actor, region);
  return game.i18n.format('E20.SuppressingFireOn', { name: actor.name });
}

/**
 * Offer the zone's owner the Willpower attack against whoever is in it. A hit leaves the enemy
 * Frightened of the gunner until the end of the gunner's next turn.
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
 * What the Use-button rolls do once they land, per target: Suppressing Fire.
 */
export async function resolveTargetedSpec(actor, spec, results) {
  for (const result of results ?? []) {
    if (!result.success || !result.targetUuid) {
      continue;
    }

    const target = await fromUuid(result.targetUuid);
    if (!target) {
      continue;
    }

    if (spec.kind == 'suppress') {
      noteRoller(actor);
      await applyTimedCondition(target, 'frightened', 2);
    }
  }
}

/* -------------------------------------------- */
/*  Primary Quarry                               */
/* -------------------------------------------- */

/**
 * Whether the roll is against the actor's Primary Quarry - either of them with Secondary Mark.
 * All Too Predictable (Decepticon Directive, Tracker, 20th level, p.56): once a turn, reroll one die
 * on a test involving or targeting the Primary Mark.
 */
export function isVsPrimaryQuarry(actor, target) {
  if (!target) {
    return false;
  }

  return checkPrimaryQuarry(actor, target)
    || (actorHasPerk(actor, RIDER.secondaryQuarry) && actor.getFlag?.('essence20', 'secondaryQuarryUuid') == target.uuid);
}

// (Consistent is a CritDowngrade rule on the Silver Medal Syndrome item - rules/plugins/rolls/crit-downgrade.mjs.)

export { getPendingBonus };

// (Concentrated Explosion / Concentrated Fire / Shaped Charges: BeforeArea rules - rules/plugins/combat/before-area.mjs.)

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
