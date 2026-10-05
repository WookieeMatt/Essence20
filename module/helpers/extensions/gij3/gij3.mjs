import {
  registerApplyDialog, registerChatButton, registerConsumer, registerDerived, registerDialogToggles, registerHitRider,
  registerPostRoll, registerPreRoll, registerRollSources, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { getSceneEpoch, getUses, markUsed, isActiveForWindow, activateForWindow } from "../../scene-clock.mjs";
import { bankPendingBonus, clearPendingBonus, getPendingBonus } from "../../perks.mjs";
import { worldActors } from "../../companion-link.mjs";
import { getNearbyAllyTokens } from "../../allies.mjs";
import { E20 } from "../../config.mjs";
import {
  csfSource, inoperableWarning, onCsfRepairButton, onRebootButton, SOME_ASSEMBLY_REQUIRED_ID, TECHNICAL_GLITCH_ID,
  useSomeAssemblyRequired, useTechnicalGlitch,
} from "./disrupt.mjs";

/**
 * Item Review, slice gij3 - G.I. Joe Perks, Hang-Ups and an Alteration from the Core Rulebook,
 * Factions in Action 1 & 2, Hawk's Personnel Files, the Sgt Slaughter Sourcebook and the
 * Quartermaster's Guide to Gear. Every rule is quoted where it's implemented.
 *
 * Situational qualifiers the system can't read ("in polite society", "people you haven't met
 * before", "works toward your Syndicate's endgame") are Roll Options Dialog switches, off by
 * default, shown only on the rolls they can apply to - the player (or the GM watching) flips them
 * when the situation holds. Everything with a cost or a choice is a Use button on the item.
 *
 * The roll-internal rules (Better than the Best, Seconds Between Click & Boom's miss clause,
 * Takedown Expert's choice) are in dice-hooks.mjs, called from dice.mjs via
 * SCRATCH/integration/gij3-patch.cjs. Equipment disruption is disrupt.mjs.
 */

const U = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const G3 = {
  secondSkin: U('gi_joe_crb', 'Txn7a7v4gQOCYPhC'),
  stalk: U('gi_joe_crb', 'BOuJREcROMkMjbM1'),
  touchMove: U('gi_joe_crb', 'wv5vpbiCZXiwTpdm'),
  subtleSnake: U('ferocious_fighters', 'ZCgcPAQzeMYTti7g'),
  dreadnokRecruit: U('intercontinental_adventures', 'QIoKmEIelV7it5xE'),
  peakPerformance: U('general_hawk_s_personel_files', 'Uzs2Ms6MgPsxV8uU'),
  oldHand: U('general_hawk_s_personel_files', 'KjGQyRLheKp8zT8v'),
  earlyAdopter: U('quartermasters_guide_to_gear', 'WrRChund2zAcHYfe'),
  fieldTrials: U('quartermasters_guide_to_gear', 'HBSVeVpRVBXiPgSW'),
  junker: U('quartermasters_guide_to_gear', 'VpQqwE8GNeqFAHbg'),
  pillage: U('quartermasters_guide_to_gear', 'G7bEjhamqov7tb9w'),
  pillageFinesse: U('quartermasters_guide_to_gear', 'Gij3PillageFin01'),
  pillageMight: U('quartermasters_guide_to_gear', 'Gij3PillageMgt01'),
  targetingEye: U('quartermasters_guide_to_gear', 'k8OE8GB2ux24SkQo'),
  soundOfAngels: U('quartermasters_guide_to_gear', 'rraj81QR8KEg6nfC'),
  technicalGlitch: TECHNICAL_GLITCH_ID,
  someAssemblyRequired: SOME_ASSEMBLY_REQUIRED_ID,
};

// The Scope upgrade (GI Joe CRB p.148), by _id - the same entry is printed in several books.
const SCOPE_UPGRADE_ID = 'cBiD2lBLRwnxu8Rx';

const FLAG = {
  targetingEye: 'gij3TargetingEye',
  junkerEdge: 'gij3JunkerEdge',
  junkerUsed: 'gij3JunkerUsed',
  earlyAdopterUsed: 'gij3EarlyAdopterUsed',
  fieldTrialsUsed: 'gij3FieldTrialsUsed',
  freePick: 'gij3FreePick',
  dreadnokPresent: 'gij3DreadnokPresent',
  peakGranted: 'gij3PeakPerformanceGranted',
};

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));
const escape = text => foundry.utils.escapeHTML(String(text ?? ''));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

function listOf(collection) {
  if (Array.isArray(collection?.contents)) {
    return collection.contents;
  }

  if (Array.isArray(collection)) {
    return collection;
  }

  return collection && typeof collection[Symbol.iterator] == 'function' ? [...collection] : [];
}

export function findSourced(actor, id) {
  return id ? listOf(actor?.items).find(item => sourceOf(item) == id) ?? null : null;
}

const has = (actor, id) => !!findSourced(actor, id);
const essenceOf = (skill, rolledEssence) => rolledEssence || E20.skillToEssence?.[skill] || null;
const isSocial = ctx => essenceOf(ctx?.rolledSkill, ctx?.rolledEssence) == 'social';
const isAttackItem = item => item?.type == 'weaponEffect';

/** Loaded at setup - heavy modules used from synchronous hooks. */
export const deps = {
  isKnownOutsideEnvironmentOfExpertise: () => false,
};

/* -------------------------------------------- */
/*  Roll Options Dialog switches                 */
/* -------------------------------------------- */

/**
 * Each switch: which item grants it, when it shows, and what it does once ticked.
 * - Pillage (p.25): "Attempts to pillage a two-handed weapon (or item of similar size, at GM
 *   discretion) suffer ↓1." Ticking it also lets the hit take a two-handed weapon.
 */
const SWITCHES = [
  {
    name: 'gij3PillageTwoHanded', id: G3.pillage, label: 'Gij3PillageTwoHandedToggle',
    shows: (actor, ctx) => isPillageEffect(ctx.item),
    apply: (options, actor) => {
      options.shiftDown = (Number(options.shiftDown) || 0) + 1;
      pillageTwoHanded.set(actor?.uuid, true);
    },
    off: actor => pillageTwoHanded.set(actor?.uuid, false),
  },
];

// Subtle Snake Hang-Up (Ferocious Fighters p.44): "If your affiliation is known, you suffer ↓1 on
// Social Skill Tests with non-Python Patrol members of Cobra and Snag on Social Skill Tests with
// non-Cobra personnel." A three-way select rather than a switch.
const SUBTLE_SNAKE = 'gij3SubtleSnake';

/** Whether the Pillage roll in progress was declared against a two-handed weapon, by roller. */
const pillageTwoHanded = new Map();

export function isPillageEffect(item) {
  const source = sourceOf(item);
  return !!source && [G3.pillageFinesse, G3.pillageMight].includes(source);
}

export function gij3Toggles(actor, ctx = {}) {
  const toggles = [];
  for (const entry of SWITCHES) {
    if (has(actor, entry.id) && entry.shows(actor, ctx)) {
      toggles.push({ name: entry.name, type: 'checkbox', value: false, label: T(entry.label, entry.labelData?.(actor) ?? {}) });
    }
  }

  if (has(actor, G3.subtleSnake) && isSocial(ctx)) {
    toggles.push({
      name: SUBTLE_SNAKE,
      type: 'select',
      label: T('Gij3SubtleSnakeToggle'),
      options: [
        { value: '', label: T('Gij3SubtleSnakeNone') },
        { value: 'cobra', label: T('Gij3SubtleSnakeCobra') },
        { value: 'outsider', label: T('Gij3SubtleSnakeOutsider') },
      ],
    });
  }

  return toggles;
}

export function gij3ApplyDialog(actor, options) {
  const ext = options?.ext ?? {};
  for (const entry of SWITCHES) {
    if (ext[entry.name]) {
      entry.apply(options, actor);
    } else if (entry.off) {
      entry.off(actor);
    }
  }

  if (ext[SUBTLE_SNAKE] == 'cobra') {
    options.shiftDown = (Number(options.shiftDown) || 0) + 1;
  } else if (ext[SUBTLE_SNAKE] == 'outsider') {
    options.snag = true;
  }
}

/* -------------------------------------------- */
/*  Automatic roll sources                       */
/* -------------------------------------------- */

export function gij3RollSources(actor, target, ctx = {}) {
  const sources = [];
  const consumes = [];
  const { item, rolledSkill, isMelee, dataset } = ctx;
  const isAttack = ctx.isAttack ?? isAttackItem(item);

  // Stalk (GI Joe CRB, Predator, p.93): "any time you are in your environment of expertise, you ...
  // gain an Edge on Infiltration Skill Tests." Off only where the scene's terrain says the actor is
  // outside every environment of expertise (helpers/environmental-expertise.mjs) - the same gate
  // this Perk's surprise immunity already uses (helpers/condition-immunity.mjs).
  if (rolledSkill == 'infiltration' && has(actor, G3.stalk) && !deps.isKnownOutsideEnvironmentOfExpertise(actor)) {
    sources.push({ id: 'gij3Stalk', label: findSourced(actor, G3.stalk).name, edge: true });
  }

  // Junker (Quartermaster's Guide p.9): "When you requisition gear, you gain an additional
  // requisition attempt. You gain Edge on this attempt." The Use button adds the attempt and banks
  // the Edge; the next Requisition Test spends it.
  if (dataset?.requisitionItemName && getPendingBonus(actor, FLAG.junkerEdge)) {
    sources.push({ id: 'gij3Junker', label: findSourced(actor, G3.junker)?.name ?? 'Junker', edge: true });
    consumes.push({ ext: 'gij3Junker', actorUuid: actor.uuid });
  }

  // Targeting Eye (Quartermaster's Guide p.91) - Cost: "When you use your targeting eye, you
  // suffer ↓1 on Melee attacks until the end of your next turn. Melee attacks targeting you gain ↑1."
  if (isAttack && isMelee && isTargetingEyeLive(actor)) {
    sources.push({ id: 'gij3TargetingEyeSelf', label: T('Gij3TargetingEyeCost'), shiftDown: 1 });
  }

  if (isAttack && isMelee && target && isTargetingEyeLive(target)) {
    sources.push({ id: 'gij3TargetingEyeTarget', label: T('Gij3TargetingEyeTarget', { name: target.name }), shiftUp: 1 });
  }

  // Complete System Failure - disrupt.mjs.
  const csf = csfSource(actor, ctx);
  if (csf) {
    sources.push(csf);
  }

  return { sources, consumes };
}

/* -------------------------------------------- */
/*  Before the roll                              */
/* -------------------------------------------- */

/**
 * Second Skin (GI Joe CRB, Juggernaut, 3rd level, p.112): "You may use Technology or Science
 * instead of Athletics or Acrobatics for armor requisitions during the Equipment Assignment and
 * Requisition phase." helpers/requisition.mjs rolls armor with Athletics or Acrobatics (weapons use
 * Targeting), so a Requisition Test on either of those is an armor requisition.
 */
export async function gij3PreRoll(actor, dataset, item) {
  inoperableWarning(actor, dataset, item);

  if (!dataset?.requisitionItemName || !['athletics', 'acrobatics'].includes(dataset.skill) || !has(actor, G3.secondSkin)) {
    return;
  }

  const { chooseButtons } = await import("../../grants.mjs");
  const skills = [dataset.skill, 'technology', 'science'];
  const picked = await chooseButtons(findSourced(actor, G3.secondSkin).name, T('Gij3SecondSkinPrompt'),
    skills.map(skill => [skill, game.i18n.localize(E20.skills?.[skill] ?? skill)]));
  if (picked && picked != dataset.skill) {
    dataset.skill = picked;
    dataset.essence = E20.skillToEssence[picked];
  }
}

/* -------------------------------------------- */
/*  Targeting Eye                                */
/* -------------------------------------------- */

/** "Until the end of your next turn", stamped like helpers/target-riders.mjs's marks. */
function untilEndOfNextTurn(actor) {
  const combat = game?.combat;
  const stamp = { sceneEpoch: getSceneEpoch() };
  if (!combat) {
    return stamp;
  }

  const theirs = listOf(combat.turns).findIndex(c => c.actor?.id == actor?.id);
  return { ...stamp, combatId: combat.id, untilRound: combat.round + 1, untilTurn: theirs < 0 ? combat.turn : theirs };
}

export function isTargetingEyeLive(actor) {
  const mark = actor?.flags?.essence20?.[FLAG.targetingEye];
  if (!mark) {
    return false;
  }

  if (mark.sceneEpoch != null && mark.sceneEpoch != getSceneEpoch()) {
    return false;
  }

  const combat = game?.combat;
  if (mark.combatId) {
    if (!combat || combat.id != mark.combatId) {
      return false;
    }

    if (combat.round > mark.untilRound || (combat.round == mark.untilRound && combat.turn > mark.untilTurn)) {
      return false;
    }
  }

  return true;
}

/**
 * Targeting Eye - Benefit: "As a Free action, treat a projectile weapon with Range measured in feet
 * that you wield as though it has the Scope weapon upgrade. Weapons with the Scope upgrade gain no
 * additional benefit." Scope (GI Joe CRB p.148): "Double the ranges of the weapon." Applied in
 * derived data to every projectile attack of a weapon without a Scope while the eye is in use,
 * recorded in upgradeTouched so the item sheet keeps editing the stored range.
 */
export function gij3Derived(actor) {
  if (!isTargetingEyeLive(actor) || !has(actor, G3.targetingEye)) {
    return;
  }

  const items = listOf(actor.items);
  const scoped = new Set(items.filter(i => i.type == 'upgrade' && String(sourceOf(i) ?? '').endsWith(SCOPE_UPGRADE_ID))
    .map(i => i.flags?.essence20?.parentId).filter(Boolean));
  for (const effect of items) {
    const system = effect.system;
    if (effect.type != 'weaponEffect' || system?.classification?.style != 'projectile' || !system.range?.value) {
      continue;
    }

    const parentId = effect.flags?.essence20?.parentId;
    if (!parentId || scoped.has(parentId)) {
      continue;
    }

    system.range.value *= 2;
    if (system.range.long) {
      system.range.long *= 2;
    }

    system.upgradeTouched = [...new Set([...(system.upgradeTouched ?? []), 'range.value', 'range.long'])];
  }
}

/* -------------------------------------------- */
/*  After the roll                               */
/* -------------------------------------------- */

/**
 * The Sound of Angels (Quartermaster's Guide, Strafer, 10th level, p.28): "when you attack with a
 * two-handed ballistic weapon, an explosive, or an air vehicle's weapons, you can grant your allies
 * the benefits of Lend Assistance with 1 Free action per ally." After such an attack, the attacker
 * picks allies within Lend Assistance range (50ft, GI Joe CRB p.197); each costs a Free action and
 * banks Lend Assistance's attack benefit on them - the Edge on their first attack against the same
 * target (helpers/lend-assistance.mjs's LEND_ASSISTANCE_EDGE_FLAG).
 */
export async function gij3PostRoll(actor, results, checkContext) {
  if (!checkContext?.isAttack || !checkContext.itemUuid || !has(actor, G3.soundOfAngels)) {
    return;
  }

  const effect = await fromUuid(checkContext.itemUuid);
  if (!qualifiesForSoundOfAngels(actor, effect)) {
    return;
  }

  const targetUuid = (results ?? []).find(result => result.targetUuid)?.targetUuid;
  const target = targetUuid ? await fromUuid(targetUuid) : null;
  const targetActor = target?.documentName == 'Token' ? target.actor : target;
  const allies = getNearbyAllyTokens(actor, 50).map(token => token.actor).filter(ally => ally && ally.id != actor.id);
  if (!targetActor || !allies.length) {
    return;
  }

  const perkName = findSourced(actor, G3.soundOfAngels).name;
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: perkName },
    classes: ["window-app", "e20-window"],
    content: `<p>${T('Gij3SoundOfAngelsPrompt', { target: escape(targetActor.name) })}</p>`
      + allies.map(ally => `<div class="form-group"><label><input type="checkbox" name="${ally.id}" /> ${escape(ally.name)}</label></div>`).join(''),
    buttons: [
      { action: 'ok', label: T('DialogConfirmButton'), default: true, callback: (event, button) => allies.filter(ally => button.form.elements[ally.id]?.checked) },
      { action: 'cancel', label: T('DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!Array.isArray(chosen) || !chosen.length) {
    return;
  }

  const economy = game.combat ? await import("../../action-economy.mjs") : null;
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  const granted = [];
  for (const ally of chosen) {
    if (economy && (await economy.spend(actor, 'free', { source: perkName }))?.blocked) {
      break;
    }

    const data = { targetId: targetActor.id ?? null, edge: true, combatId: game.combat?.id ?? null, round: game.combat?.round ?? null };
    if (needsGmRelay(ally)) {
      await relayToGm(ally, 'setFlag', ['essence20', 'pendingLendAssistanceEdge', data]);
    } else {
      await ally.setFlag('essence20', 'pendingLendAssistanceEdge', data);
    }

    granted.push(ally.name);
  }

  if (granted.length) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: T('Gij3SoundOfAngelsChat', { name: escape(actor.name), allies: escape(granted.join(', ')), target: escape(targetActor.name) }),
    });
  }
}

export function qualifiesForSoundOfAngels(actor, effect) {
  if (effect?.type != 'weaponEffect') {
    return false;
  }

  if (effect.system?.classification?.style == 'explosive') {
    return true;
  }

  const owner = effect.parent ?? actor;
  if (owner?.type == 'vehicle' && (Number(owner.system?.movement?.aerial?.base) || 0) > 0) {
    return true;
  }

  const parentId = effect.flags?.essence20?.parentId;
  const weapon = parentId ? (owner?.items?.get?.(parentId) ?? listOf(owner?.items).find(i => i.id == parentId)) : null;
  const hands = Number(weapon?.system?.derivedHands ?? weapon?.system?.hands ?? effect.system?.numHands ?? 1);
  return !!weapon && (weapon.system?.traits ?? []).includes('ballistic') && hands >= 2;
}

/**
 * Pillage (Quartermaster's Guide, Freebooter, 6th level, p.25): "On a successful pillage attack, you
 * disarm an item or weapon your target is currently holding and gain possession of it, or let it
 * fall in a random space within your target's reach ... You cannot disarm integrated weapons."
 * helpers/target-riders.mjs#disarm already skips integrated weapons; a two-handed one is only
 * offered when the attack was declared against one (and took the ↓1).
 */
export async function gij3HitRider(actor, target, result, rider) {
  if (!target || ![G3.pillageFinesse, G3.pillageMight].includes(rider?.itemSource)) {
    return;
  }

  const { disarm } = await import("../../target-riders.mjs");
  const name = findSourced(actor, G3.pillage)?.name ?? 'Pillage';
  const weapon = await disarm(actor, target, { maxHands: pillageTwoHanded.get(actor.uuid) ? 2 : 1, source: name });
  pillageTwoHanded.delete(actor.uuid);
  if (!weapon) {
    return;
  }

  const { chooseButtons } = await import("../../grants.mjs");
  const keep = await chooseButtons(name, T('Gij3PillageKeepPrompt', { item: escape(weapon.name) }),
    [['take', T('Gij3PillageTake')], ['drop', T('Gij3PillageDrop')]]);
  if (keep == 'take' && weapon.isOwner && actor.isOwner) {
    const data = weapon.toObject();
    delete data._id;
    foundry.utils.setProperty(data, 'system.equipped', false);
    foundry.utils.setProperty(data, 'flags.essence20.disarmed', false);
    await actor.createEmbeddedDocuments('Item', [data]);
    await weapon.delete();
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: T(keep == 'take' ? (weapon.isOwner ? 'Gij3PillageTaken' : 'Gij3PillageTakenGm') : 'Gij3PillageDropped',
      { name: escape(actor.name), target: escape(target.name), item: escape(weapon.name) }),
  });
}

/* -------------------------------------------- */
/*  Turn start                                   */
/* -------------------------------------------- */

/**
 * Dreadnok Recruit Hang-Up (Intercontinental Adventures p.36): "Whenever you're in a scene with a
 * Dreadnok NPC or Contact, you must spend one Free action each turn looking over your shoulder to
 * see if they approve of you." A Dreadnok is any other actor on the scene with "Dreadnok" in its name
 * (every printed Dreadnok Threat and Contact is named that way), or the Hang-Up's own Use button
 * says one is here this scene.
 */
export function dreadnokInScene(actor) {
  if (isActiveForWindow(actor, FLAG.dreadnokPresent, 'scene')) {
    return true;
  }

  const tokens = listOf(canvas?.scene?.tokens ?? game?.scenes?.viewed?.tokens);
  return tokens.some(token => {
    const other = token.actor;
    return other && other.id != actor.id && other.type != 'playerCharacter' && /dreadnok/i.test(other.name ?? '');
  });
}

export async function gij3TurnStart(actor) {
  if (!has(actor, G3.dreadnokRecruit) || !dreadnokInScene(actor)) {
    return;
  }

  const name = findSourced(actor, G3.dreadnokRecruit).name;
  try {
    const economy = await import("../../action-economy.mjs");
    await economy.spend(actor, 'free', { source: name });
  } catch (error) {
    console.error('Essence20 | Dreadnok Recruit spend failed', error);
  }

  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: T('Gij3DreadnokRecruitChat', { name: escape(actor.name), hangUp: escape(name) }) });
}

/**
 * Touch Move (GI Joe CRB, Grandmaster, 6th level, p.87): "when you roll Initiative, all of your
 * teammates who aren't surprised can immediately make a Move Action." Nothing in the action economy
 * can hand out an action before the first turn, so the active GM posts who may move, the moment the
 * holder's Initiative lands.
 */
const touchMovePosted = new Set();
export async function onTouchMoveInitiative(combatant, changes) {
  if (!game.users?.activeGM?.isSelf || changes?.initiative == null || !has(combatant?.actor, G3.touchMove)) {
    return;
  }

  const key = `${combatant.parent?.id}.${combatant.id}`;
  if (touchMovePosted.has(key)) {
    return;
  }

  touchMovePosted.add(key);
  const holder = combatant.actor;
  const disposition = combatant.token?.disposition;
  const allies = listOf(combatant.parent?.combatants).map(other => other.actor)
    .filter(other => other && other.id != holder.id && !other.statuses?.has?.('surprised'))
    .filter(other => {
      const token = listOf(combatant.parent?.combatants).find(c => c.actor?.id == other.id)?.token;
      return disposition != null && token?.disposition != null ? token.disposition == disposition : other.type == 'playerCharacter';
    });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: holder }),
    content: T('Gij3TouchMoveChat', {
      name: escape(holder.name),
      perk: escape(findSourced(holder, G3.touchMove).name),
      allies: escape(allies.map(a => a.name).join(', ') || T('Gij3Nobody')),
    }),
  });
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

function partyMembers() {
  const party = game.actors?.party;
  const members = party?.members ?? [];
  return members.length ? members : worldActors().filter(actor => actor.type == 'playerCharacter' && actor.hasPlayerOwner);
}

function freePickCard(actor, item, kind, recipients) {
  return `<p>${T(`Gij3${kind}Card`, { name: escape(actor.name), perk: escape(item.name) })}</p>`
    + recipients.map(ally => `<button type="button" data-e20-ext="gij3FreePick" data-kind="${kind}" data-actor-uuid="${ally.uuid}">${escape(ally.name)}</button>`).join('');
}

/**
 * The per-ally button on an Early Adopter / Field Trials card - the ally's own player picks.
 * - Early Adopter (Quartermaster's Guide, Futurist, p.17): "During the Equipment Assignment and
 *   Requisition phase, each of your allies gains a Standard Weapon Upgrade, Battledress Upgrade, or
 *   Kit without spending a requisition attempt."
 * - Field Trials (Tech Officer, 3rd level, p.22): "each member of your team gains one free Limited
 *   Weapon Upgrade. However ... the weapons they are attached to gain the Temperamental trait." The
 *   upgrade carries the Temperamental trait itself, which is how an attached upgrade gives its
 *   weapon a trait (documents/item.mjs#_prepareTraits).
 */
export async function onFreePickButton(message, button) {
  const ally = await fromUuid(button.dataset.actorUuid);
  const kind = button.dataset.kind;
  if (!ally?.isOwner) {
    ui.notifications.warn(T('Gij3NotYours'));
    return;
  }

  const usedKey = `${FLAG.freePick}${kind}`;
  if (getUses(ally, usedKey, 'mission') > 0) {
    ui.notifications.warn(T('Gij3AlreadyPicked', { name: ally.name }));
    return;
  }

  const { chooseButtons, pickAndGrant } = await import("../../grants.mjs");
  let granted = null;
  if (kind == 'EarlyAdopter') {
    const what = await chooseButtons(T('Gij3EarlyAdopterCardTitle'), T('Gij3EarlyAdopterPick'),
      [['weapon', T('Gij3WeaponUpgrade')], ['armor', T('Gij3ArmorUpgrade')], ['kit', T('Gij3Kit')]]);
    if (!what) {
      return;
    }

    granted = what == 'kit'
      ? await pickAndGrant(ally, null, T('Gij3Kit'), { type: 'gear', availabilities: ['standard'], matches: e => e.system?.gearType == 'kits' })
      : await pickAndGrant(ally, null, T(what == 'weapon' ? 'Gij3WeaponUpgrade' : 'Gij3ArmorUpgrade'),
        { type: 'upgrade', availabilities: ['standard'], matches: e => e.system?.type == what });
  } else if (kind == 'FieldTrials') {
    granted = await pickAndGrant(ally, null, T('Gij3WeaponUpgrade'),
      { type: 'upgrade', availabilities: ['limited'], matches: e => e.system?.type == 'weapon' });
    if (granted) {
      const traits = [...new Set([...(granted.system?.traits ?? []), 'temperamental'])];
      await granted.update({ 'system.traits': traits, 'flags.essence20.gij3FieldTrials': true });
    }
  }

  if (granted) {
    await markUsed(ally, usedKey, { window: 'mission' });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: ally }), content: T('Gij3FreePickDone', { name: escape(ally.name), item: escape(granted.name) }) });
  }
}

async function writeActor(actor, update) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(actor)) {
    return relayToGm(actor, 'update', [update]);
  }

  await actor.update(update);
  return true;
}

export const USES = [
  {
    id: 'gij3EarlyAdopter',
    matches: item => sourceOf(item) == G3.earlyAdopter,
    canUse: item => getUses(item.parent, FLAG.earlyAdopterUsed, 'mission') < 1,
    async run(item) {
      const actor = item.parent;
      const allies = partyMembers().filter(ally => ally.id != actor.id);
      if (!allies.length) {
        ui.notifications.warn(T('Gij3NoAllies'));
        return null;
      }

      await markUsed(actor, FLAG.earlyAdopterUsed, { window: 'mission' });
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: freePickCard(actor, item, 'EarlyAdopter', allies) });
      return null;
    },
  },
  {
    id: 'gij3FieldTrials',
    matches: item => sourceOf(item) == G3.fieldTrials,
    canUse: item => getUses(item.parent, FLAG.fieldTrialsUsed, 'mission') < 1,
    async run(item) {
      const actor = item.parent;
      const team = partyMembers();
      const recipients = team.some(member => member.id == actor.id) ? team : [actor, ...team];
      await markUsed(actor, FLAG.fieldTrialsUsed, { window: 'mission' });
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: freePickCard(actor, item, 'FieldTrials', recipients) });
      return null;
    },
  },
  {
    // Junker - see gij3RollSources for the Edge. Once per mission (one Equipment Assignment phase).
    id: 'gij3Junker',
    matches: item => sourceOf(item) == G3.junker,
    canUse: item => getUses(item.parent, FLAG.junkerUsed, 'mission') < 1,
    async run(item) {
      const actor = item.parent;
      const party = game.actors?.party;
      if (party?.system?.requisition) {
        await writeActor(party, { 'system.requisition.attempts': (Number(party.system.requisition.attempts) || 0) + 1 });
      }

      await markUsed(actor, FLAG.junkerUsed, { window: 'mission' });
      await bankPendingBonus(actor, FLAG.junkerEdge, { edge: true });
      return T(party ? 'Gij3JunkerUsed' : 'Gij3JunkerUsedNoParty', { name: actor.name, party: party?.name ?? '' });
    },
  },
  {
    // Peak Performance (Hawk's Personnel Files, Old Hand, 16th level, p.165): "regardless of your
    // effective level in your standard Role, you gain its highest level Role Perk (18th level for most
    // Roles, 20th level for Infantry and Ranger). In the case of the Officer, you gain Momentum but not
    // Plan of Action 5." Read off the base Role item's own Perk table.
    id: 'gij3PeakPerformance',
    matches: item => sourceOf(item) == G3.peakPerformance,
    canUse: item => !item.flags?.essence20?.[FLAG.peakGranted],
    async run(item) {
      const actor = item.parent;
      const picks = peakPerformancePerks(actor);
      if (!picks.entries.length) {
        ui.notifications.warn(T('Gij3PeakPerformanceNoRole'));
        return null;
      }

      const { grantCopy } = await import("../../grants.mjs");
      const got = [];
      for (const entry of picks.entries) {
        if (!has(actor, entry.uuid)) {
          got.push(await grantCopy(actor, entry.uuid, { grantedBy: item }));
        }
      }

      await item.setFlag('essence20', FLAG.peakGranted, true);
      const names = got.filter(Boolean).map(i => i.name).join(', ') || picks.entries.map(e => e.name).join(', ');
      return T(picks.role == 'Ranger' ? 'Gij3PeakPerformanceRanger' : 'Gij3PeakPerformanceDone', { name: actor.name, perks: names, role: picks.role });
    },
  },
  {
    // Dreadnok Recruit - mark a Dreadnok present this scene when none is on the map by name.
    id: 'gij3DreadnokRecruit',
    matches: item => sourceOf(item) == G3.dreadnokRecruit,
    canUse: item => !isActiveForWindow(item.parent, FLAG.dreadnokPresent, 'scene'),
    async run(item) {
      await activateForWindow(item.parent, FLAG.dreadnokPresent, 'scene');
      return T('Gij3DreadnokMarked', { name: item.parent.name });
    },
  },
  {
    // Targeting Eye - "As a Free action" (see gij3Derived / gij3RollSources).
    id: 'gij3TargetingEye',
    matches: item => sourceOf(item) == G3.targetingEye,
    canUse: item => !isTargetingEyeLive(item.parent),
    async run(item, economy, pay) {
      const actor = item.parent;
      if (!(await pay('free'))) {
        return null;
      }

      await actor.setFlag('essence20', FLAG.targetingEye, untilEndOfNextTurn(actor));
      return T('Gij3TargetingEyeUsed', { name: actor.name });
    },
  },
  {
    id: 'gij3TechnicalGlitch',
    matches: item => sourceOf(item) == G3.technicalGlitch,
    run: (item, economy, pay) => useTechnicalGlitch(item, pay),
  },
  {
    id: 'gij3SomeAssemblyRequired',
    matches: item => sourceOf(item) == G3.someAssemblyRequired,
    canUse: () => !game.combat,
    run: item => useSomeAssemblyRequired(item),
  },
];

/** The base Role's highest-level Role Perk(s), for Peak Performance. */
export function peakPerformancePerks(actor) {
  const role = listOf(actor?.items).find(item => item.type == 'role' && sourceOf(item) != G3.oldHand && item.name != 'Old Hand');
  if (!role) {
    return { role: null, entries: [] };
  }

  const perks = Object.values(role.system?.items ?? {}).filter(entry => entry?.type == 'perk' && entry.subtype == 'role' && entry.uuid);
  const top = Math.max(0, ...perks.map(entry => Number(entry.level) || 0));
  const entries = perks.filter(entry => (Number(entry.level) || 0) == top && !/^Plan of Action/i.test(entry.name ?? ''));
  return { role: role.name, entries };
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

export async function loadDeps() {
  const expertise = await import("../../environmental-expertise.mjs");
  deps.isKnownOutsideEnvironmentOfExpertise = expertise.isKnownOutsideEnvironmentOfExpertise;
}

/** Takedown Expert's "silenced" - no such Condition in the system before this. */
export function addSilencedStatus() {
  const list = CONFIG?.statusEffects;
  if (Array.isArray(list) && !list.some(effect => effect.id == 'silenced')) {
    list.push({ id: 'silenced', name: 'E20.Gij3StatusSilenced', img: 'icons/svg/silenced.svg', changes: [] });
  }
}

registerDialogToggles(gij3Toggles);
registerApplyDialog(gij3ApplyDialog);
registerRollSources(gij3RollSources);
registerPreRoll(gij3PreRoll);
registerDerived(gij3Derived);
registerPostRoll(gij3PostRoll);
registerHitRider(gij3HitRider);
registerTurnStart(gij3TurnStart);
registerConsumer('gij3Junker', async consume => {
  const actor = consume?.actorUuid ? await fromUuid(consume.actorUuid) : null;
  if (actor) {
    await clearPendingBonus(actor, FLAG.junkerEdge);
  }
});
registerChatButton('gij3FreePick', onFreePickButton);
registerChatButton('gij3Reboot', onRebootButton);
registerChatButton('gij3CsfRepair', onCsfRepairButton);
USES.forEach(use => registerUse(use));

if (typeof Hooks != 'undefined') {
  Hooks.once('setup', () => {
    addSilencedStatus();
    loadDeps().catch(error => console.error('Essence20 | gij3 deps failed', error));
  });
  Hooks.on('updateCombatant', (combatant, changes) => {
    onTouchMoveInitiative(combatant, changes).catch(error => console.error('Essence20 | Touch Move', error));
  });
}
