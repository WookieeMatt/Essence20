import {
  registerApplyDialog, registerChatButton, registerDamageModifier, registerDialogToggles, registerHitRider, registerPostRoll,
  registerPreRoll, registerSceneAdvanced, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { hasSourced } from "../../companion-link.mjs";
import {
  ATS, BTH, JTT, T, actorsInPlay, combatStamp, damageOrOffer, findSourced, firstTarget, isFrom, itemsOf, parentWeapon, payPower, post,
  safeSetFlag, safeUnsetFlag, safeUpdate, sourceOf,
} from "./shared.mjs";

/**
 * A Jump Through Time (Quantum Ranger and General Perks), Across the Stars and Beneath the Helmet
 * items: Interspatial Pause, Quantum Trigger, Timeslide, Time Strike, Evacuation Vents, Special
 * Program, Lance of Light's strike and Dark Dimension ↓2, Savant Skill's Story Point refund, Good
 * with Both and Unlucky (For You)'s Terror.
 */
export const O1_JTT = {
  interspatialPause: JTT('InterspatialPaus'),
  quantumTrigger: JTT('QuantumTriggerJT'),
  timeslide: JTT('e70Jm3uH5A3mKmSM'),
  timeStrike: JTT('T7nfBj9GjUHz8alo'),
  evacuationVents: JTT('Tft06zzgFsVCx2B7'),
  specialProgram: JTT('wKGrImiofaMrni0m'),
  lanceOfLight: JTT('HUdL1MryICmRmWnP'),
  savantSkill: JTT('ZnuLgh6jdUHi9F75'),
  goodWithBoth: ATS('bUfVm0jmCcAxu2M3'),
  unluckyForYou: BTH('hSzY2uhu3L9nGP6o'),
};

/* -------------------------------------------- */
/*  Pure helpers (tested)                        */
/* -------------------------------------------- */

/** Whether every compared result of a roll failed - "if you fail a Skill Test". */
export function allFailed(results) {
  return Array.isArray(results) && results.length > 0 && results.every(result => result && result.success === false);
}

/** Quantum Trigger's "cumulative ↓1": the nth retry of a chain suffers ↓n. */
export function quantumTriggerShiftDown(baseShiftDown, chain) {
  return (Number(baseShiftDown) || 0) + chain;
}

/** A re-rolled total fails when it reaches none of the original Difficulties. */
export function rerollStillFails(total, checkResults) {
  const difficulties = (checkResults ?? []).map(entry => Number(entry?.difficulty)).filter(Number.isFinite);
  return difficulties.length > 0 && difficulties.every(difficulty => total < difficulty);
}

/** Only plain values survive into a chat-card flag. */
export function plainDataset(dataset) {
  const out = {};
  for (const [key, value] of Object.entries(dataset ?? {})) {
    if (['string', 'number', 'boolean'].includes(typeof value) || value === null) {
      out[key] = value;
    }
  }

  return out;
}

/* -------------------------------------------- */
/*  Shared chat button: damage for the GM        */
/* -------------------------------------------- */

registerChatButton('o1ApplyDamage', async (message, button) => {
  const target = await fromUuid(button.dataset.targetUuid);
  if (!target?.isOwner) {
    ui.notifications.warn(T('O1NotOwner'));
    return;
  }

  const { applyDamage } = await import("../../combat.mjs");
  await applyDamage(target, Number(button.dataset.amount) || 0, button.dataset.damageType);
  button.disabled = true;
});

/* -------------------------------------------- */
/*  Roll bookkeeping                             */
/* -------------------------------------------- */

// The dataset each actor's latest Skill Test started from (Quantum Trigger retries it), and an
// armed Unlucky (For You) watch (this roll is the "next Skill Test").
const lastRoll = new Map();
const armedUnlucky = new Map();
// Time Strike paid for in the dialog, read by the hit rider on the same roll.
const armedTimeStrike = new Map();

registerPreRoll(async (actor, dataset, item) => {
  if (!actor?.uuid) {
    return;
  }

  lastRoll.set(actor.uuid, { dataset: plainDataset(dataset), itemUuid: item?.uuid ?? null });

  armedUnlucky.delete(actor.uuid);
  const watch = actor.flags?.essence20?.o1UnluckyWatch;
  if (watch?.by) {
    armedUnlucky.set(actor.uuid, watch);
    await safeUnsetFlag(actor, 'o1UnluckyWatch');
  }
});

/* -------------------------------------------- */
/*  Quantum Trigger                              */
/* -------------------------------------------- */

// Quantum Trigger (A Jump Through Time, Quantum Ranger, Quantum Power, p.46): "You may spend one
// Personal Power whenever you fail a Skill Test. You may attempt the Skill Test again immediately,
// but with a cumulative ↓1 penalty."
registerPostRoll(async (actor, results) => {
  if (!allFailed(results) || !hasSourced(actor, O1_JTT.quantumTrigger) || (actor.system?.powers?.personal?.value ?? 0) < 1) {
    return;
  }

  const last = lastRoll.get(actor.uuid);
  if (!last) {
    return;
  }

  const chain = (Number(last.dataset.o1QtChain) || 0) + 1;
  const base = last.dataset.o1QtBase ?? last.dataset.shiftDown ?? 0;
  await post(actor, `<p>${T('O1QuantumTriggerOffer', { name: actor.name, shift: chain })}</p>`
    + `<button type="button" data-e20-ext="o1QuantumTrigger">${T('O1QuantumTriggerButton', { shift: chain })}</button>`,
  { o1Retry: { actorUuid: actor.uuid, itemUuid: last.itemUuid, dataset: { ...last.dataset, o1QtBase: base, o1QtChain: chain } } });
});

registerChatButton('o1QuantumTrigger', async (message, button) => {
  const retry = message.flags?.essence20?.o1Retry;
  const actor = retry ? await fromUuid(retry.actorUuid) : null;
  if (!actor?.isOwner) {
    ui.notifications.warn(T('O1NotOwner'));
    return;
  }

  if (!(await payPower(actor, 1))) {
    return;
  }

  button.disabled = true;
  const item = retry.itemUuid ? await fromUuid(retry.itemUuid) : null;
  const dataset = { ...retry.dataset, shiftDown: quantumTriggerShiftDown(retry.dataset.o1QtBase, retry.dataset.o1QtChain) };
  await actor._dice?.rollSkill(dataset, actor, item);
});

/* -------------------------------------------- */
/*  Unlucky (For You) - the Terror half           */
/* -------------------------------------------- */

// Unlucky (For You) (Beneath the Helmet, Dark Ranger, 13th level, p.40): "that character suffers
// Snag on the next Skill Test they make before the start of your next turn. If they fail this Skill
// Test and you are aware of it, you gain 1 Terror. This Role Perk can only affect each target once
// per combat scene." The Snag is dice.mjs's; this watches that same next test.
registerPostRoll(async (actor, results, checkContext, { hits = [] } = {}) => {
  // The watched creature's own next test.
  const watch = armedUnlucky.get(actor.uuid);
  if (watch) {
    armedUnlucky.delete(actor.uuid);
    if (allFailed(results)) {
      await grantUnluckyTerror(watch.by, actor);
    }
  }

  if (!checkContext?.isAttack || !game.combat || !hasSourced(actor, O1_JTT.unluckyForYou)) {
    return;
  }

  const stored = actor.flags?.essence20?.o1UnluckyWatched;
  const ids = stored?.combatId == game.combat.id ? [...(stored.ids ?? [])] : [];
  let changed = false;
  for (const { target, hit } of hits) {
    if (!hit || !target?.uuid || ids.includes(target.uuid)) {
      continue;
    }

    ids.push(target.uuid);
    changed = true;
    await safeSetFlag(target, 'o1UnluckyWatch', { by: actor.uuid, combatId: game.combat.id });
  }

  if (changed) {
    await actor.setFlag('essence20', 'o1UnluckyWatched', { combatId: game.combat.id, ids });
  }
});

async function grantUnluckyTerror(byUuid, victim) {
  const ranger = await fromUuid(byUuid);
  if (!ranger) {
    return;
  }

  const { hasTerror } = await import("../../terror.mjs");
  const { isImmuneToCondition } = await import("../../condition-immunity.mjs");
  // Terror (p.39) only accrues "provided they aren't immune to being Frightened".
  if (!hasTerror(ranger) || isImmuneToCondition(victim, 'frightened')) {
    return;
  }

  const capacity = ranger._getBaseRolePoints?.();
  if (!capacity) {
    return;
  }

  const value = Math.min(capacity.system.resource.max ?? Infinity, (capacity.system.resource.value ?? 0) + 1);
  await safeUpdate(capacity, { 'system.resource.value': value });
  await post(ranger, T('O1UnluckyTerror', { name: ranger.name, target: victim.name }));
}

// "Before the start of your next turn": the Dark Ranger's turn ends every watch they placed.
registerTurnStart(async (actor) => {
  for (const other of await actorsInPlay()) {
    if (other.flags?.essence20?.o1UnluckyWatch?.by == actor.uuid) {
      await safeUnsetFlag(other, 'o1UnluckyWatch');
    }
  }

  for (const [uuid, watch] of armedUnlucky) {
    if (watch.by == actor.uuid) {
      armedUnlucky.delete(uuid);
    }
  }
});

/* -------------------------------------------- */
/*  Interspatial Pause                           */
/* -------------------------------------------- */

// Interspatial Pause (A Jump Through Time, Quantum Power, p.45): "By spending three Personal Power,
// you and all allies within 5 feet move outside the timestream to a temporary pocket dimension for
// up to 1 round. While in this pocket dimension, you can act normally... you re-emerge exactly
// where you were." Their tokens are hidden (nothing can target them) and they take no damage until
// the Ranger's next turn starts, or the Ranger ends it early with the same button.
const PAUSE_FLAG = 'o1InterspatialPause';

export function isPaused(actor) {
  return !!actor?.flags?.essence20?.[PAUSE_FLAG];
}

registerDamageModifier((actor, amount) => (isPaused(actor) ? 0 : amount));

async function setPaused(actor, by, paused) {
  for (const token of actor.getActiveTokens?.() ?? []) {
    await safeUpdate(token.document, { hidden: paused });
  }

  if (paused) {
    await safeSetFlag(actor, PAUSE_FLAG, { by, ...combatStamp() });
  } else {
    await safeUnsetFlag(actor, PAUSE_FLAG);
  }
}

async function releasePause(byUuid) {
  const released = [];
  for (const actor of await actorsInPlay()) {
    if (actor.flags?.essence20?.[PAUSE_FLAG]?.by == byUuid) {
      await setPaused(actor, byUuid, false);
      released.push(actor.name);
    }
  }

  return released;
}

registerUse({
  id: 'o1InterspatialPause',
  matches: isFrom(O1_JTT.interspatialPause),
  canUse: item => isPaused(item.parent) || (item.parent?.system?.powers?.personal?.value ?? 0) >= 3,
  run: async (item) => {
    const actor = item.parent;
    if (isPaused(actor)) {
      const released = await releasePause(actor.uuid);
      return T('O1PauseEnds', { names: released.join(', ') || actor.name });
    }

    if (!(await payPower(actor, 3))) {
      return null;
    }

    const { getNearbyAllyTokens } = await import("../../allies.mjs");
    const group = [actor, ...getNearbyAllyTokens(actor, 5).map(token => token.actor)];
    for (const member of group) {
      await setPaused(member, actor.uuid, true);
    }

    return T('O1PauseStarts', { name: actor.name, names: group.map(member => member.name).join(', ') });
  },
});

registerTurnStart(async (actor) => {
  const released = await releasePause(actor.uuid);
  if (released.length) {
    await post(actor, T('O1PauseEnds', { names: released.join(', ') }));
  }
});

registerSceneAdvanced(async () => {
  if (!game.user?.isGM) {
    return;
  }

  for (const actor of await actorsInPlay()) {
    const pause = actor.flags?.essence20?.[PAUSE_FLAG];
    if (pause) {
      await setPaused(actor, pause.by, false);
    }
  }
});

/* -------------------------------------------- */
/*  Timeslide                                    */
/* -------------------------------------------- */

// Timeslide (A Jump Through Time, Quantum Ranger, 15th level, p.46): "as a Move action, you may
// instantly be placed anywhere within 200 feet of your current location that you could feasibly
// reach with your existing Movement types." Click the spot; "feasibly reach" is the player's call.
export const TIMESLIDE_FEET = 200;

registerUse({
  id: 'o1Timeslide',
  matches: isFrom(O1_JTT.timeslide),
  canUse: item => !!item.parent?.getActiveTokens?.()?.length,
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const token = actor.getActiveTokens()[0];
    const { pickCanvasPoint, distanceFeet } = await import("../../forced-movement.mjs");
    const point = await pickCanvasPoint(T('O1TimeslidePick', { feet: TIMESLIDE_FEET }));
    if (!point) {
      return null;
    }

    if (distanceFeet(token.center, point) > TIMESLIDE_FEET) {
      ui.notifications.warn(T('O1TimeslideTooFar', { feet: TIMESLIDE_FEET }));
      return null;
    }

    if (!(await pay('move'))) {
      return null;
    }

    let position = { x: point.x - token.w / 2, y: point.y - token.h / 2 };
    try {
      position = token.document.getSnappedPosition(position);
    } catch (error) {
      // Gridless scene.
    }

    await safeUpdate(token.document, { x: Math.round(position.x), y: Math.round(position.y) });
    return T('O1Timeslide', { name: actor.name });
  },
});

/* -------------------------------------------- */
/*  Evacuation Vents                             */
/* -------------------------------------------- */

// Evacuation Vents (A Jump Through Time, Morphin Shell modification, p.32): "When spending Free
// actions to enhance your Move action, there is no limit to how high your value can go as long as
// you are moving away from all visible enemies." Declared with the Use button for this turn; the
// Push cap in helpers/token-movement.mjs#getPushRules reads the flag (see other1-patch.cjs).
export function evacuationKey() {
  const combat = game?.combat;
  return combat ? `${combat.id}.${combat.round}.${combat.turn}` : null;
}

registerUse({
  id: 'o1EvacuationVents',
  matches: isFrom(O1_JTT.evacuationVents),
  canUse: item => !!game.combat && !!item.parent?.system?.isMorphed,
  run: async (item) => {
    await item.parent.setFlag('essence20', 'o1Evacuating', { key: evacuationKey() });
    return T('O1EvacuationVents', { name: item.parent.name });
  },
});

/* -------------------------------------------- */
/*  Time Strike                                  */
/* -------------------------------------------- */

// Time Strike (A Jump Through Time, Grid Power, p.58): "When armed with a pair of Chrono Sabers...
// As a Standard action while Morphed, you can spend 1 Personal Power to make a single Attack Skill
// Test with your Chrono Sabers. If it hits, this Attack counts as both Chrono Sabers hitting for
// their base damage, and you can activate one of the Chrono Saber's Alternate Effects as if
// achieving an additional Degree of Success." A Roll Options Dialog checkbox on a Chrono Saber
// attack pays the Power; a hit adds the second saber's base damage and offers each of the saber's
// other effects as a rider button.
const isChronoSaber = weapon => /chrono saber/i.test(String(weapon?.name ?? ''));

registerDialogToggles((actor, ctx) => {
  const item = ctx?.item;
  if (item?.type != 'weaponEffect' || !hasSourced(actor, O1_JTT.timeStrike) || !actor.system?.isMorphed
    || !isChronoSaber(parentWeapon(actor, item)) || (actor.system?.powers?.personal?.value ?? 0) < 1) {
    return [];
  }

  return [{ name: 'o1TimeStrike', label: T('O1TimeStrikeToggle'), type: 'checkbox', value: false }];
});

registerApplyDialog(async (actor, options, ctx) => {
  armedTimeStrike.delete(actor.uuid);
  if (options.ext?.o1TimeStrike && (await payPower(actor, 1))) {
    armedTimeStrike.set(actor.uuid, ctx?.item?.id ?? true);
  }
});

registerHitRider(async (actor, target, result, rider, tools) => {
  if (!armedTimeStrike.has(actor.uuid)) {
    return;
  }

  const effect = rider?.itemUuid ? await fromUuid(rider.itemUuid) : null;
  const base = Number(effect?.system?.damageValue) || 0;
  if (base) {
    tools.damageBonusNote(result, base, T('O1TimeStrikeSecond'));
  }

  const weapon = parentWeapon(actor, effect);
  for (const other of itemsOf(actor)) {
    if (other.type == 'weaponEffect' && weapon && other.flags?.essence20?.parentId == weapon.id && other.id != effect?.id) {
      tools.addRiderOption(result, {
        key: `o1TimeStrike${other.id}`,
        label: T('O1TimeStrikeAlternate', { name: other.name }),
        damageValue: Number(other.system?.damageValue) || 0,
        damageType: other.system?.damageType ?? 'maneuver',
      });
    }
  }
});

registerPostRoll(async (actor) => {
  armedTimeStrike.delete(actor.uuid);
});

/* -------------------------------------------- */
/*  Special Program                              */
/* -------------------------------------------- */

// Special Program (A Jump Through Time, Origin Perk, p.26): "You may choose any General Perk for
// which you meet the prerequisites." Offered when the Origin Perk arrives and from its Use button
// until a pick is made. Prerequisites are free text in the packs, so each option shows its own
// for the player to check.
async function pickSpecialProgram(item) {
  const actor = item.parent;
  const { findItems, grantCopy } = await import("../../grants.mjs");
  const rows = await findItems({ type: 'perk', fields: ['system.prerequisite'], matches: entry => entry.system?.type == 'general' });
  const options = rows
    .map(row => ({ value: row.uuid, label: row.system?.prerequisite ? `${row.name} (${row.system.prerequisite})` : row.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const { chooseSelect } = await import("../../grants.mjs");
  const uuid = await chooseSelect(item.name, T('O1SpecialProgramPrompt'), options);
  if (!uuid) {
    return null;
  }

  const created = await grantCopy(actor, uuid, { grantedBy: item });
  if (created) {
    await item.setFlag('essence20', 'o1Picked', uuid);
  }

  return created ? T('O1SpecialProgramGranted', { name: actor.name, perk: created.name }) : null;
}

registerUse({
  id: 'o1SpecialProgram',
  matches: isFrom(O1_JTT.specialProgram),
  canUse: item => !item.flags?.essence20?.o1Picked,
  run: item => pickSpecialProgram(item),
});

Hooks.on('createItem', async (item, options, userId) => {
  if (userId != game.user?.id || sourceOf(item) != O1_JTT.specialProgram || !item.parent || item.flags?.essence20?.o1Picked) {
    return;
  }

  const line = await pickSpecialProgram(item);
  if (line) {
    await post(item.parent, line);
  }
});

/* -------------------------------------------- */
/*  Lance of Light                               */
/* -------------------------------------------- */

// Lance of Light (A Jump Through Time, General Perk, p.55), while summoned (helpers/lance-of-light.mjs
// holds the toggle and the Resistance): "You may spend your Standard action to inflict 1 Energy
// damage to any target within 10 feet without a Skill Test." and "Enemies with direct ties to the
// Dark Dimensions... suffer ↓2 on any Skill Tests against you." The ↓2 is an incoming rule on the
// pack item (a Dark Dimension creature tag or name, while the lanceOfLightActive flag is set).
const lanceActive = actor => !!actor?.flags?.essence20?.lanceOfLightActive;

registerUse({
  id: 'o1LanceOfLight',
  matches: isFrom(O1_JTT.lanceOfLight),
  canUse: item => lanceActive(item.parent),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const target = firstTarget();
    if (!target) {
      ui.notifications.warn(T('O1NeedTarget'));
      return null;
    }

    const mine = actor.getActiveTokens?.()?.[0];
    const theirs = target.getActiveTokens?.()?.[0];
    if (mine && theirs && canvas?.grid?.measurePath?.([mine.center, theirs.center])?.distance > 10) {
      ui.notifications.warn(T('O1TooFar', { feet: 10 }));
      return null;
    }

    if (!(await pay('standard'))) {
      return null;
    }

    await damageOrOffer(actor, target, 1, 'element', item.name);
    return null;
  },
});

/* -------------------------------------------- */
/*  Good with Both                               */
/* -------------------------------------------- */

// Good with Both (Across the Stars, General Perk, p.69): "When attacking with a one-handed weapon in
// each hand, your primary Attack suffers no penalty and your off-hand Attack only suffers ↓1." The
// system tracks no hands, so the off-hand attack is the player's tick in the Roll Options Dialog;
// the primary attack takes nothing.
const oneHanded = item => String(item?.system?.numHands ?? '1') == '1';

registerDialogToggles((actor, ctx) => {
  const item = ctx?.item;
  if (item?.type != 'weaponEffect' || !oneHanded(item) || !hasSourced(actor, O1_JTT.goodWithBoth)) {
    return [];
  }

  const equipped = itemsOf(actor).filter(weapon => weapon.type == 'weapon' && weapon.system?.equipped);
  if (equipped.length < 2) {
    return [];
  }

  return [{ name: 'o1OffHand', label: T('O1GoodWithBothToggle'), type: 'checkbox', value: false }];
});

registerApplyDialog((actor, options) => {
  if (options.ext?.o1OffHand) {
    options.shiftDown = (Number(options.shiftDown) || 0) + 1;
  }
});

/* -------------------------------------------- */
/*  Savant Skill - the Story Point refund        */
/* -------------------------------------------- */

// Savant Skill (A Jump Through Time, General Perk, p.56): "If you spend a Story Point to re-roll a
// die using this Skill and your second result fails, you regain that Story Point." The d20+d4 half
// is dice.mjs's. A Story Point reroll posts its own card (chat.mjs#rerollMessage); this compares
// its total with the Difficulties on that actor's latest check card.
Hooks.on('createChatMessage', async (message) => {
  const authorId = message.author?.id ?? message.user?.id;
  if (authorId != game.user?.id || message.flags?.essence20?.rerollConfig?.source != 'storyPoint') {
    return;
  }

  const actor = ChatMessage.getSpeakerActor?.(message.speaker);
  const savant = findSourced(actor, O1_JTT.savantSkill);
  if (!savant?.system?.choice) {
    return;
  }

  const messages = game.messages?.contents ?? [];
  const index = messages.findIndex(m => m.id == message.id);
  const earlier = (index >= 0 ? messages.slice(0, index) : messages).reverse();
  const original = earlier.find(m => m.speaker?.actor == message.speaker?.actor && m.flags?.essence20?.checkResults?.length);
  if (!original || original.flags.essence20.skill != savant.system.choice) {
    return;
  }

  const total = message.rolls?.[0]?.total;
  if (!Number.isFinite(total) || !rerollStillFails(total, original.flags.essence20.checkResults)) {
    return;
  }

  const { poolFor, requestStoryPointGrant } = await import("../../story-points.mjs");
  await requestStoryPointGrant(actor, 1, { pool: poolFor(actor) });
  await post(actor, T('O1SavantRefund', { name: actor.name, perk: savant.name }));
});
