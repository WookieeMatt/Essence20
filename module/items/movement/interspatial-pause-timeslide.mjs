import {
  registerChatButton, registerDamageModifier, registerPostRoll, registerPreRoll, registerSceneAdvanced, registerTurnStart, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { hasSourced } from "../../mechanics/companions/companion-link.mjs";
import {
  BTH, JTT, T, actorsInPlay, combatStamp, isFrom, payPower, post,
  safeSetFlag, safeUnsetFlag, safeUpdate, sourceOf,
} from "../shared/power-pay-safe-writes.mjs";

/**
 * A Jump Through Time (Quantum Ranger and General Perks) and Beneath the Helmet
 * items: Interspatial Pause, Timeslide, Special Program and Unlucky (For You)'s Terror. (Time Strike, Evacuation
 * Vents, Lance of Light, Across the Stars' Good with Both, Quantum Trigger and Savant Skill's Story Point refund are
 * item rules on their pack items.)
 */
export const O1_JTT = {
  interspatialPause: JTT('InterspatialPaus'),
  timeslide: JTT('e70Jm3uH5A3mKmSM'),
  specialProgram: JTT('wKGrImiofaMrni0m'),
  unluckyForYou: BTH('hSzY2uhu3L9nGP6o'),
};

/* -------------------------------------------- */
/*  Pure helpers (tested)                        */
/* -------------------------------------------- */

/** Whether every compared result of a roll failed - "if you fail a Skill Test". */
export function allFailed(results) {
  return Array.isArray(results) && results.length > 0 && results.every(result => result && result.success === false);
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

  const { applyDamage } = await import("../../mechanics/combat/combat.mjs");
  await applyDamage(target, Number(button.dataset.amount) || 0, button.dataset.damageType);
  button.disabled = true;
});

/* -------------------------------------------- */
/*  Roll bookkeeping                             */
/* -------------------------------------------- */

// An armed Unlucky (For You) watch (this roll is the "next Skill Test").
const armedUnlucky = new Map();

registerPreRoll(async actor => {
  if (!actor?.uuid) {
    return;
  }

  armedUnlucky.delete(actor.uuid);
  const watch = actor.flags?.essence20?.o1UnluckyWatch;
  if (watch?.by) {
    armedUnlucky.set(actor.uuid, watch);
    await safeUnsetFlag(actor, 'o1UnluckyWatch');
  }
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

  const { hasTerror } = await import("../resources/terror.mjs");
  const { isImmuneToCondition } = await import("../../mechanics/combat/condition-immunity.mjs");
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

    const { getNearbyAllyTokens } = await import("../../mechanics/combat/nearby-allies.mjs");
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
    const { pickCanvasPoint, distanceFeet } = await import("../../mechanics/combat/forced-movement.mjs");
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
/*  Special Program                              */
/* -------------------------------------------- */

// Special Program (A Jump Through Time, Origin Perk, p.26): "You may choose any General Perk for
// which you meet the prerequisites." Offered when the Origin Perk arrives and from its Use button
// until a pick is made. Prerequisites are free text in the packs, so each option shows its own
// for the player to check.
async function pickSpecialProgram(item) {
  const actor = item.parent;
  const { findItems, grantCopy } = await import("../../mechanics/resources/grants.mjs");
  const rows = await findItems({ type: 'perk', fields: ['system.prerequisite'], matches: entry => entry.system?.type == 'general' });
  const options = rows
    .map(row => ({ value: row.uuid, label: row.system?.prerequisite ? `${row.name} (${row.system.prerequisite})` : row.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
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

// Lance of Light (A Jump Through Time, General Perk, p.55): its strike is a Use rule on the pack item (a Standard
// action while summoned - items/defenses/lance-of-light.mjs holds the toggle - against a target within 10 ft, the 1 Energy
// damage as a button for whoever owns the target), and its Dark Dimension ↓2 an incoming RollModifier there.

// (Good with Both, Across the Stars p.69, is its own DialogSwitch rule: the off-hand ↓1 on a one-handed attack
// while two or more weapons are equipped.)
