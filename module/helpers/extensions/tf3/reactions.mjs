import { registerAfterDamage, registerChatButton, registerPostRoll, registerTurnStart } from "../../extensions.mjs";
import { hasUsedThisTurn, markUsedThisTurn } from "../../perks.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import { holdersOf, lastApplyContext, registerReaction } from "../react/core.mjs";
import {
  areAllies, areEnemies, esc, feetBetween, flagOf, held, holds, isResponsible, itemsOf, nameOf, ownerIds, say, SCOPE, sourceOf, stampNow,
  T, TF3, tokenOf, writeActor,
} from "./common.mjs";
import { HOLO_FLAG, holoDoubles, MARTYR_FLAG, STOIC_FLAG, UNEXPECTED_FLAG } from "./rolls.mjs";
import { CHOSEN_FLAG, ORDER_FLAG } from "./uses.mjs";

/**
 * What happens to tf3 items outside the dice dialog: being Defeated (Martyr, Last Stand), taking damage
 * (Roll With It), an ally missing (Synch Up), an enemy stepping into Reach (No Escape), converting
 * (Unexpected Alternative), turns starting (Stoic,
 * Irrefutable Order), Holographic doubles popping, Intensive's group Repair, Requisition access
 * (Unassuming, One Bot Over Another), Kit prerequisites (Training Through Familiarity) and Third Dimension's movement.
 */

const SEEN_FLAG = 'tf3SeenModes';
const flagKey = uuid => String(uuid ?? '').replace(/\./g, '-');

function whisper(actor, content) {
  return say(actor, content, { whisper: ownerIds(actor) });
}

/* -------------------------------------------- */
/*  Defeated / damaged                           */
/* -------------------------------------------- */

export async function tf3AfterDamage(actor, dealt, damageType, { newValue, wasAlreadyDefeated } = {}) {
  if (!actor) {
    return;
  }

  const defeated = newValue <= 0 && !wasAlreadyDefeated;
  const context = lastApplyContext?.();
  const attackerUuid = context && (!context.targetUuid || String(context.targetUuid).includes(actor.id)) ? context.attackerUuid : null;

  // Martyr (Commander, 20th level, p.66): "if you are Defeated in combat, your allies gain an Edge on
  // Skill Tests for the rest of this combat." Read back by ./rolls.mjs.
  if (defeated && game.combat && holds(actor, TF3.martyr)) {
    await actor.setFlag(SCOPE, MARTYR_FLAG, game.combat.id);
    await say(actor, T('Tf3MartyrFell', { name: esc(actor.name), perk: esc(nameOf(actor, TF3.martyr)) }));
  }

  // Last Stand (Warrior, 20th level, p.91): "if you are Defeated in combat, you can first immediately
  // take a full turn, as long as you spend your actions doing everything you can to attack the
  // creature that Defeated you."
  if (defeated && game.combat && holds(actor, TF3.lastStand)) {
    await whisper(actor, `<p>${T('Tf3LastStandPrompt', { name: esc(actor.name) })}</p>
      <button type="button" data-e20-ext="tf3LastStand" data-actor="${esc(actor.uuid)}" data-attacker="${esc(attackerUuid ?? '')}">${esc(nameOf(actor, TF3.lastStand))}</button>`);
  }

  // Roll With It (Scout, 10th level, p.86): "once per turn, when you take Damage, you can immediately
  // move 10ft away from the source of the attack."
  if (dealt > 0 && newValue > 0 && holds(actor, TF3.rollWithIt) && !hasUsedThisTurn(actor, 'tf3RollWithIt')) {
    await whisper(actor, `<p>${T('Tf3RollWithItPrompt', { name: esc(actor.name) })}</p>
      <button type="button" data-e20-ext="tf3RollWithIt" data-actor="${esc(actor.uuid)}" data-attacker="${esc(attackerUuid ?? '')}">${esc(nameOf(actor, TF3.rollWithIt))}</button>`);
  }
}

async function targetToken(actor) {
  const token = tokenOf(actor);
  token?.setTarget?.(true, { releaseOthers: true, groupSelection: false });
}

registerChatButton('tf3LastStand', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  if (!actor?.isOwner || flagOf(actor, 'tf3LastStandUsed') == message.id) {
    button.disabled = true;
    return;
  }

  button.disabled = true;
  await actor.setFlag(SCOPE, 'tf3LastStandUsed', message.id);
  // Acting while Defeated: the same once-per-turn stamp dice.mjs and the action budget read for "act as
  // though it has not been Defeated", here without the Story Point, plus a full turn's actions.
  const { ACT_WHILE_DEFEATED_FLAG, grantActionsThisTurn } = await import("../../action-economy.mjs");
  await markUsedThisTurn(actor, ACT_WHILE_DEFEATED_FLAG);
  await grantActionsThisTurn(actor, { standard: 1, move: 1 }, nameOf(actor, TF3.lastStand));
  const attacker = button.dataset.attacker ? await fromUuid(button.dataset.attacker) : null;
  if (attacker) {
    await targetToken(attacker);
  }

  await say(actor, T('Tf3LastStandTaken', { name: esc(actor.name), target: esc(attacker?.name ?? T('Tf3TheirFoe')) }));
});

registerChatButton('tf3RollWithIt', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  if (!actor?.isOwner || hasUsedThisTurn(actor, 'tf3RollWithIt')) {
    button.disabled = true;
    return;
  }

  button.disabled = true;
  await markUsedThisTurn(actor, 'tf3RollWithIt');
  const attacker = button.dataset.attacker ? await fromUuid(button.dataset.attacker) : null;
  const { pushActor } = await import("../../forced-movement.mjs");
  const moved = attacker ? await pushActor(actor, attacker, 10) : false;
  await say(actor, T(moved ? 'Tf3RollWithItMoved' : 'Tf3RollWithItManual', { name: esc(actor.name) }));
});

/* -------------------------------------------- */
/*  After a roll                                 */
/* -------------------------------------------- */

async function loseDouble(target) {
  const count = holoDoubles(target);
  if (count > 0) {
    await writeActor(target, { [`flags.${SCOPE}.${HOLO_FLAG}`]: { count: count - 1, scene: getSceneEpoch() } });
  }
}

export async function tf3PostRoll(actor, results = [], checkContext = {}) {
  // Holographic Doubles: "One Holographic double disappears whenever you're unsuccessfully attacked,
  // and whenever you roll a Skill Test."
  if (holoDoubles(actor) > 0) {
    await loseDouble(actor);
  }

  if (checkContext?.isAttack) {
    for (const result of results ?? []) {
      if (!result?.success && result?.targetUuid && result.targetUuid != actor?.uuid) {
        const target = await fromUuid(result.targetUuid);
        const defender = target?.actor ?? target;
        if (defender && holoDoubles(defender) > 0) {
          await loseDouble(defender);
        }
      }
    }
  }

  // Intensive (Medic, 17th level, p.81): "when you Repair more than one Cybertronian on your turn, you
  // can choose to roll Technology once and apply the result to all injured allies within 30ft." A
  // successful Technology Patch Up offers the same amount to every other injured ally in 30ft.
  const skill = checkContext?.riderContext?.skill ?? checkContext?.skill;
  if (checkContext?.isPatchUpAttempt && results?.[0]?.success && skill == 'technology' && holds(actor, TF3.intensive)) {
    await offerIntensive(actor, Number(checkContext.patchUpAmount) || 0);
  }
}

async function injuredAlliesNear(actor, feet) {
  const { getNearbyAllyTokens } = await import("../../allies.mjs");
  const patched = game.user?.targets?.first?.()?.actor ?? actor;
  return getNearbyAllyTokens(actor, feet).map(token => token.actor)
    .filter(ally => ally && ally !== patched && (ally.system?.health?.value ?? 0) < (ally.system?.health?.max ?? 0))
    .concat(patched !== actor && (actor.system?.health?.value ?? 0) < (actor.system?.health?.max ?? 0) ? [actor] : []);
}

async function offerIntensive(actor, amount) {
  const allies = await injuredAlliesNear(actor, 30);
  if (!amount || !allies.length) {
    return;
  }

  await whisper(actor, `<p>${T('Tf3IntensivePrompt', { name: esc(actor.name), amount, allies: esc(allies.map(a => a.name).join(', ')) })}</p>
    <button type="button" data-e20-ext="tf3Intensive" data-actor="${esc(actor.uuid)}" data-amount="${amount}"
      data-allies="${esc(allies.map(a => a.uuid).join(','))}">${esc(nameOf(actor, TF3.intensive))}</button>`);
}

registerChatButton('tf3Intensive', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  if (!actor?.isOwner || button.disabled) {
    return;
  }

  button.disabled = true;
  const amount = Number(button.dataset.amount) || 0;
  const repaired = [];
  for (const uuid of String(button.dataset.allies ?? '').split(',').filter(Boolean)) {
    const ally = await fromUuid(uuid);
    const health = ally?.system?.health;
    if (!health) {
      continue;
    }

    await writeActor(ally, { 'system.health.value': Math.min(health.max ?? 0, (health.value ?? 0) + amount) });
    repaired.push(ally.name);
  }

  await say(actor, T('Tf3IntensiveDone', { name: esc(actor.name), amount, allies: esc(repaired.join(', ')) }));
});

/* -------------------------------------------- */
/*  Turns                                        */
/* -------------------------------------------- */

export async function tf3TurnStart(actor, combat) {
  // Stoic lasts "until the beginning of your next turn".
  if (flagOf(actor, STOIC_FLAG)) {
    await actor.unsetFlag(SCOPE, STOIC_FLAG);
  }

  // Irrefutable Order: "they use their Move action to follow the command ... on their next turn."
  const order = flagOf(actor, ORDER_FLAG);
  if (order) {
    await actor.unsetFlag(SCOPE, ORDER_FLAG);
    if (!order.combatId || order.combatId == combat?.id) {
      const { isTracking, spend } = await import("../../action-economy.mjs");
      if (isTracking()) {
        await spend(actor, 'move', { source: T('Tf3OrderSource', { by: order.by ?? '' }) });
      }

      await say(actor, T('Tf3OrderObey', { name: esc(actor.name), order: esc(order.order), by: esc(order.by ?? '') }), { whisper: ownerIds(actor) });
    }
  }
}

/* -------------------------------------------- */
/*  Synch Up                                     */
/* -------------------------------------------- */

/** How far an actor can attack: the longest range or Reach of its equipped weapons' attacks. */
export function attackRange(actor) {
  const items = itemsOf(actor);
  const equipped = new Set(items.filter(i => i.type == 'weapon' && i.system?.equipped !== false).map(i => i.id));
  let best = CONFIG.E20?.actorReach?.[actor?.system?.size] ?? 5;
  for (const effect of items.filter(i => i.type == 'weaponEffect')) {
    const parent = flagOf(effect, 'parentId');
    if (parent && !equipped.has(parent)) {
      continue;
    }

    const range = effect.system?.range ?? {};
    best = Math.max(best, Number(range.long ?? 0) || 0, Number(range.value ?? 0) || 0, Number(effect.system?.totalReach ?? 0) || 0);
  }

  return best;
}

// Synch Up (Commander, 5th level, p.64): "once per turn when an ally attacks and misses a target within
// your range, you can immediately attack that target, even though it is not your turn." The button
// targets them and hands over a free attack.
registerReaction({
  id: 'tf3SynchUp',
  reactors: (info, row) => {
    if (!info.isAttack || row.success || !info.attacker) {
      return [];
    }

    const target = row.targetUuid ? fromUuidSync?.(row.targetUuid) : null;
    const defender = target?.actor ?? target;
    return holdersOf(TF3.synchUp).filter(holder => holder !== info.attacker && areAllies(holder, info.attacker)
      && !hasUsedThisTurn(holder, 'tf3SynchUp') && (!defender || feetBetween(holder, defender) <= attackRange(holder)));
  },
  label: actor => nameOf(actor, TF3.synchUp, 'Synch Up'),
  run: async (actor, info, row) => {
    const target = await fromUuid(row.targetUuid);
    const defender = target?.actor ?? target;
    await markUsedThisTurn(actor, 'tf3SynchUp');
    if (defender) {
      await targetToken(defender);
    }

    const { grantBonusAttack } = await import("../../action-economy.mjs");
    await grantBonusAttack(actor, { source: nameOf(actor, TF3.synchUp, 'Synch Up'), cost: 'none' });
    await say(actor, T('Tf3SynchUpUsed', { name: esc(actor.name), target: esc(defender?.name ?? '') }));
    return true;
  },
});

/* -------------------------------------------- */
/*  No Escape                                    */
/* -------------------------------------------- */

function centerOf(position) {
  const size = canvas?.grid?.size ?? 100;
  return { x: (position?.x ?? 0) + ((position?.width ?? 1) * size) / 2, y: (position?.y ?? 0) + ((position?.height ?? 1) * size) / 2 };
}

/** Longest melee Reach among equipped weapons (and unarmed attacks). */
export function meleeReach(actor) {
  const items = itemsOf(actor);
  const equipped = new Set(items.filter(i => i.type == 'weapon' && i.system?.equipped !== false).map(i => i.id));
  let best = CONFIG.E20?.actorReach?.[actor?.system?.size] ?? 5;
  for (const effect of items.filter(i => i.type == 'weaponEffect' && i.system?.classification?.style == 'melee')) {
    const parent = flagOf(effect, 'parentId');
    if (!parent || equipped.has(parent)) {
      best = Math.max(best, Number(effect.system?.totalReach ?? 0) || 0);
    }
  }

  return best;
}

// No Escape (Sentinel, 9th level, p.90): "when an enemy moves within the Reach of your melee weapon, you
// interrupt their movement to immediately attack them." Offered to the holder when an enemy's move ends
// inside their Reach having started outside it.
export async function onMoveToken(tokenDoc, movement) {
  const mover = tokenDoc?.actor;
  if (!mover || !game.combat || !canvas?.grid?.measurePath || !movement?.origin || !movement?.destination) {
    return;
  }

  const from = centerOf(movement.origin);
  const to = centerOf(movement.destination);
  for (const token of canvas.tokens?.placeables ?? []) {
    const holder = token.actor;
    if (!holder || holder === mover || !holds(holder, TF3.noEscape) || !isResponsible(holder) || !areEnemies(holder, mover)) {
      continue;
    }

    const reach = meleeReach(holder);
    const before = canvas.grid.measurePath([token.center, from]).distance;
    const after = canvas.grid.measurePath([token.center, to]).distance;
    if (after <= reach && before > reach) {
      await whisper(holder, `<p>${T('Tf3NoEscapePrompt', { name: esc(holder.name), target: esc(mover.name) })}</p>
        <button type="button" data-e20-ext="tf3NoEscape" data-actor="${esc(holder.uuid)}" data-target="${esc(mover.uuid)}">${esc(nameOf(holder, TF3.noEscape))}</button>`);
    }
  }
}

registerChatButton('tf3NoEscape', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  const target = await fromUuid(button.dataset.target);
  if (!actor?.isOwner || button.disabled) {
    return;
  }

  button.disabled = true;
  if (target) {
    await targetToken(target);
  }

  const { grantBonusAttack } = await import("../../action-economy.mjs");
  await grantBonusAttack(actor, { source: nameOf(actor, TF3.noEscape, 'No Escape'), cost: 'none' });
  await say(actor, T('Tf3NoEscapeUsed', { name: esc(actor.name), target: esc(target?.name ?? '') }));
});

/* -------------------------------------------- */
/*  Converting                                   */
/* -------------------------------------------- */

/**
 * Unexpected Alternative (Triple Changer, 3rd level, p.76): "when an enemy who has seen you Convert into
 * only one of your Alt Modes sees you Convert into your other Alt Mode for the first time, you gain an
 * Edge on Skill Tests targeting them until the end of your next turn." Every enemy token on the scene
 * is taken to see the Convert.
 * @returns {Object|null}   Flag updates to write.
 */
export function unexpectedUpdates(actor, altModeId, enemies) {
  if (!altModeId || !holds(actor, TF3.unexpectedAlternative)) {
    return null;
  }

  const seen = { ...(flagOf(actor, SEEN_FLAG) ?? {}) };
  const surprised = [];
  for (const enemy of enemies) {
    const key = flagKey(enemy.uuid);
    const modes = seen[key] ?? [];
    if (modes.length == 1 && modes[0] != altModeId) {
      surprised.push(enemy.uuid);
    }

    if (!modes.includes(altModeId)) {
      seen[key] = [...modes, altModeId];
    }
  }

  const updates = { [`flags.${SCOPE}.${SEEN_FLAG}`]: seen };
  if (surprised.length) {
    let scene = null;
    try {
      scene = getSceneEpoch();
    } catch {
      scene = null;
    }

    updates[`flags.${SCOPE}.${UNEXPECTED_FLAG}`] = { targets: surprised, stamp: stampNow(scene) };
  }

  return updates;
}

export async function onConverted(actor, changes) {
  const system = changes?.system ?? {};
  if (!('isTransformed' in system) && !('altModeId' in system)) {
    return;
  }

  if (actor.system?.isTransformed && actor.system?.altModeId) {
    const enemies = (canvas?.tokens?.placeables ?? []).map(t => t.actor).filter(other => other && areEnemies(actor, other));
    const updates = unexpectedUpdates(actor, actor.system.altModeId, enemies);
    if (updates) {
      await actor.update(updates);
      if (updates[`flags.${SCOPE}.${UNEXPECTED_FLAG}`]) {
        const names = updates[`flags.${SCOPE}.${UNEXPECTED_FLAG}`].targets.map(uuid => fromUuidSync?.(uuid)?.name ?? '').filter(Boolean);
        await say(actor, T('Tf3UnexpectedEdge', { name: esc(actor.name), targets: esc(names.join(', ')) }));
      }
    }
  }
}

/* -------------------------------------------- */
/*  Requisition access                           */
/* -------------------------------------------- */

const ACCESS_ORDER = ['none', 'unknown', 'trained', 'qualified'];

function weaponEffectsOf(item) {
  const owned = item?.parent?.items?.filter
    ? item.parent.items.filter(other => other.type == 'weaponEffect' && other.flags?.[SCOPE]?.parentId == item.id).map(e => e.system)
    : [];
  return owned.length ? owned : Object.values(item?.system?.items ?? {}).filter(entry => entry?.type == 'weaponEffect');
}

const isOneHanded = item => {
  const effects = weaponEffectsOf(item);
  return effects.length > 0 && effects.every(effect => String(effect?.numHands ?? '1') == '1');
};

/**
 * Unassuming (Infiltrator, 1st level, p.61): "you're Qualified with all one-handed Limited Weapons."
 * One Bot Over Another (Transformers One Sourcebook p.16): the weapons picked on the Perk.
 */
export function tf3Access(actor, item) {
  if (item?.type != 'weapon') {
    return null;
  }

  const availability = item.system?.availability ?? 'standard';
  const source = sourceOf(item) ?? item.uuid;
  const chosen = flagOf(held(actor, TF3.oneBotOverAnother), CHOSEN_FLAG) ?? [];
  if (chosen.some(c => (c.uuid && (c.uuid == source || c.uuid == item.uuid)) || (c.name && c.name == item.name))) {
    return 'qualified';
  }

  if (availability == 'limited' && holds(actor, TF3.unassuming) && isOneHanded(item)) {
    return 'qualified';
  }

  return null;
}

export function onRequisitionAccess(actor, item, out) {
  const extra = tf3Access(actor, item);
  if (extra && ACCESS_ORDER.indexOf(extra) > ACCESS_ORDER.indexOf(out?.access ?? 'unknown')) {
    out.access = extra;
  }
}

/**
 * Training Through Familiarity: "can requisition Standard and Limited Kits even if you don't meet the
 * prerequisite." (Its "You don't suffer a Snag when you Construct a Standard or Limited Kit" has
 * nothing to lift: grants.mjs's Construct doesn't impose that Snag.)
 */
export function onKitPrerequisite(actor, info, out) {
  if (out?.need && !info?.essence && ['standard', 'limited'].includes(info?.tier) && holds(actor, TF3.trainingThroughFamiliarity)) {
    out.need = 'd20';
  }
}

/* -------------------------------------------- */
/*  Third Dimension                              */
/* -------------------------------------------- */

/**
 * Third Dimension (Triple Changer, 17th level, p.76): "when you change Movement types during your move,
 * you do not subtract the distance you have already moved from the new Movement type like you normally
 * would. Instead, you move up to the full distance of your second Movement type." Only the cost walked
 * since the last change of movement action counts against the current type's rating.
 */
export function thirdDimensionUsed(movement) {
  const waypoints = [
    ...(movement?.history?.recorded?.waypoints ?? []), ...(movement?.history?.unrecorded?.waypoints ?? []),
    ...(movement?.passed?.waypoints ?? []), ...(movement?.pending?.waypoints ?? []),
  ];
  const last = [...waypoints].reverse().find(w => w?.action)?.action;
  if (!last) {
    return null;
  }

  let used = 0;
  for (const waypoint of [...waypoints].reverse()) {
    if (waypoint?.action && waypoint.action != last) {
      break;
    }

    used += Number(waypoint?.cost) || 0;
  }

  return used;
}

export function onMovementUsed(actor, movement, out) {
  if (!out || !holds(actor, TF3.thirdDimension)) {
    return;
  }

  const used = thirdDimensionUsed(movement);
  if (Number.isFinite(used)) {
    out.used = Math.min(out.used ?? used, used);
  }
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerAfterDamage(tf3AfterDamage);
registerPostRoll(tf3PostRoll);
registerTurnStart(tf3TurnStart);

const run = promise => promise?.catch?.(error => console.error('Essence20 | tf3 hook failed', error));
globalThis.Hooks?.on?.('moveToken', (tokenDoc, movement) => run(onMoveToken(tokenDoc, movement)));
globalThis.Hooks?.on?.('updateActor', (actor, changes, options, userId) => {
  if (userId == game.user?.id) {
    run(onConverted(actor, changes));
  }
});
globalThis.Hooks?.on?.('essence20.requisitionAccess', onRequisitionAccess);
globalThis.Hooks?.on?.('essence20.kitPrerequisite', onKitPrerequisite);
globalThis.Hooks?.on?.('essence20.movementUsed', onMovementUsed);
