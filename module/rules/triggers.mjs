import {
  registerAfterDamage, registerMissionAdvanced, registerPostRoll, registerRest, registerRoundStart,
  registerSceneAdvanced, registerTurnEnd, registerTurnStart, registerUse,
} from "../mechanics/item-hooks.mjs";
import { isItemActive, ruleLabel, rulesOf, rulesOfType } from "./index.mjs";
import { recordUse, restClears, usesLeft } from "./limits.mjs";
import { LINK_SCOPES, linkedEntries } from "./links.mjs";
import { contextFor, evaluate, isStatic, sideActorsWithin } from "./predicate.mjs";
import { canAfford, changeResource, runSteps, stepContext } from "./steps.mjs";
import { resolveValue } from "./formula.mjs";

/**
 * Phase 2 of the rules engine (docs/RULES_ENGINE_PLAN.md §4.12-4.13): Use buttons and Triggers.
 *
 * A **Use** rule puts a Use button on its item - the same button every hand-written Use has
 * (mechanics/actions/action-perks.mjs, through mechanics/item-hooks.mjs#registerUse). Pressing it checks the
 * rule's condition and limit, pays its cost (an action, then a resource), runs its steps and posts
 * what happened. An item with several Use rules asks which.
 *
 * A **Trigger** rule runs its steps when something happens to its actor: a turn starts or ends, a
 * round, a rest, a new scene or mission, damage taken, about to be Defeated (its steps can stop the
 * damage), Defeated, Morph or Alt Mode changes, or a roll. `prompt: true` asks first.
 *
 * A Trigger with `watch` (ally | enemy | any, optionally `within` feet) runs when the event happens
 * to SOMEONE ELSE on the canvas - an ally's hit, an enemy's Fumble, an ally being Defeated, another
 * creature's turn ending. Its steps act as the holder; `target` is the one it happened to (or, with
 * `watchTarget: "theirTarget"`, the one they rolled against / that hit them). `self:` tags read the
 * holder, `target:` tags the one it happened to; roll tags (item:, skill:, attack:) read their roll.
 */

/* -------------------------------------------- */
/*  Use                                          */
/* -------------------------------------------- */

/** An item's Use rules, with their positions. */
export function useRulesOf(item) {
  if (!isItemActive(item)) {
    return [];
  }

  return rulesOf(item).map((rule, index) => ({ rule, index })).filter(({ rule }) => rule?.type == 'Use' && !rule.disabled);
}

/**
 * Whether one Use can be pressed now: its condition isn't known false, its limit has a use left
 * and its resource can be paid.
 */
export function useAvailable(item, rule, index) {
  const actor = item?.parent;
  if (!actor) {
    return false;
  }

  if (isStatic(rule.when) && evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === false) {
    return false;
  }

  if (usesLeft(actor, rule, item, index) <= 0) {
    return false;
  }

  const amount = Math.round(resolveValue(rule.cost?.amount ?? 1, { actor, item }, 1));
  return canAfford(rule.cost?.resource, amount, { actor, item });
}

async function pickUse(item, available) {
  if (available.length == 1) {
    return available[0];
  }

  const { DialogV2 } = foundry.applications.api;
  const picked = await DialogV2.wait({
    window: { title: item.name },
    classes: ['essence20', 'e20-window'],
    buttons: available.map(({ rule }, i) => ({ action: String(i), label: rule.label || `${item.name} ${i + 1}` })),
    rejectClose: false,
  });
  return picked === null || picked === undefined ? null : available[Number(picked)];
}

/**
 * Press an item's Use button. Resolves to the chat line, or null when nothing happened.
 * @param {Item} item
 * @param {Function} pay   (actionType) => Promise<Boolean> - spends the action in combat.
 * @param {Object} [options]
 * @param {Function} [options.pick]   Which Use, when there are several (tests).
 */
/**
 * Whether a finished run uses up its limit. `limit.onlyOnSuccess`: only when the run's last roll
 * step succeeded - a failed attempt leaves the button free to try again.
 */
export function countsTowardLimit(rule, ctx) {
  return !rule.limit?.onlyOnSuccess || ctx.vars.lastRoll?.success !== false;
}

/** Steps that only choose who a Use is for - run before its cost is paid. (A `target` step keeps its old place: its "needs a target" card is posted after paying.) */
const PICK_FIRST = ['pickAlly'];

export async function runUse(item, pay, { pick = pickUse, ask = null } = {}) {
  const actor = item?.parent;
  const available = useRulesOf(item).filter(({ rule, index }) => useAvailable(item, rule, index));
  if (!actor || !available.length) {
    return null;
  }

  const chosen = await pick(item, available);
  if (!chosen) {
    return null;
  }

  const { rule, index } = chosen;
  const ctx = stepContext({ actor, item, rule, ask });
  // Picking the ally it's for comes first (pickAlly): a cancelled pick costs nothing.
  const steps = Array.isArray(rule.steps) ? rule.steps : [];
  // beforeCost: any leading step may ask to run first too (a require gate, a target, an askNumber).
  const picks = steps.findIndex(step => !PICK_FIRST.includes(step?.do) && !step?.beforeCost);
  const leading = picks < 0 ? steps : steps.slice(0, picks);
  if (leading.length && !(await runSteps(leading, ctx))) {
    const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    return ctx.chat.length ? [`<strong>${escape(rule.label ? `${item.name}: ${rule.label}` : item.name)}</strong>`, ...ctx.chat].join('<br>') : null;
  }

  const action = rule.cost?.action;
  if (action && action != 'none' && !(await pay(action))) {
    return null;
  }

  if (rule.cost?.resource) {
    const amount = Math.round(resolveValue(rule.cost.amount ?? 1, { actor, item }, 1));
    if (!(await changeResource(rule.cost.resource, -amount, ctx))) {
      return null;
    }
  }

  const finished = await runSteps(steps.slice(leading.length), ctx);
  if (finished && countsTowardLimit(rule, ctx)) {
    await recordUse(actor, rule, item, index);
  }

  // A run that stopped with nothing to say (a refused cost, a cancelled pick) posts no card.
  if (!finished && !ctx.chat.length) {
    return null;
  }

  const title = rule.label ? `${item.name}: ${rule.label}` : item.name;
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  return [`<strong>${escape(title)}</strong>`, ...ctx.chat].join('<br>');
}

registerUse({
  id: 'rules',
  matches: item => useRulesOf(item).length > 0,
  canUse: item => useRulesOf(item).some(({ rule, index }) => useAvailable(item, rule, index)),
  run: (item, economy, pay) => runUse(item, pay),
});

/* -------------------------------------------- */
/*  Trigger                                      */
/* -------------------------------------------- */

async function confirm(item, rule) {
  const { DialogV2 } = foundry.applications.api;
  return DialogV2.confirm({
    window: { title: item.name },
    content: `<p>${game.i18n.format('E20.Rules.TriggerPrompt', { name: ruleLabel(rule, item) })}</p>`,
    rejectClose: false,
  });
}

async function post(actor, lines) {
  if (lines.length && globalThis.ChatMessage?.create) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: lines.join('<br>') });
  }
}

/**
 * Run every Trigger on this actor for one event.
 * @param {Actor} actor
 * @param {String} event
 * @param {Object} [extra]   {roll: tag context, outcome, damage: {amount}, ask, prompt}
 * @returns {Promise<Object|null>}   The damage object, for wouldBeDefeated.
 */
export async function fireTriggers(actor, event, { roll = {}, outcome = null, facts = null, damage = null, targets = [], ask = null, prompt = confirm, vars = null, skipItem = null } = {}) {
  // An aura / party / vehicle Trigger fires for the actor it reaches, never for its holder; its
  // limit is the holder's ("once per encounter" for whoever holds the Perk).
  const own = rulesOfType(actor, 'Trigger').filter(entry => !LINK_SCOPES.includes(entry.rule.scope) && !entry.rule.watch).map(entry => ({ ...entry, holder: actor }));
  const reaching = linkedEntries(actor, 'Trigger');
  for (const { rule, item, index, holder } of [...own, ...reaching]) {
    if (rule.event != event || (skipItem && item === skipItem)) {
      continue;
    }

    if (['afterRoll', 'hit', 'targeted'].includes(event) && !outcomeMatches(rule.outcome, outcome, facts)) {
      continue;
    }

    // A roll with nothing to compare against reaches only Triggers that ask for outcome "any" in so many words.
    if (facts?.open && rule.outcome != 'any') {
      continue;
    }

    // results: the roll's rows (hit / targeted / afterRoll) - roll:damaging reads them.
    if (evaluate(rule.when, contextFor({ ...roll, results: facts?.results, self: actor, holder, ruleItem: item, other: targets[0] ?? null, vars: vars ?? {} })) !== true) {
      continue;
    }

    if (usesLeft(holder, rule, item, index) <= 0) {
      continue;
    }

    if (rule.prompt && !(await prompt(item, rule))) {
      continue;
    }

    const ctx = stepContext({ actor, item, rule, targets, damage, ask });
    // Numbers the event hands the steps (@var.margin for targeted).
    Object.assign(ctx.vars, vars ?? {});
    const finished = await runSteps(rule.steps, ctx);
    // A value the event handed in that a step changed (setVar) is what the next Trigger sees.
    for (const key of Object.keys(vars ?? {})) {
      vars[key] = ctx.vars[key];
    }

    if (finished && countsTowardLimit(rule, ctx)) {
      await recordUse(holder, rule, item, index);
    }

    await post(actor, ctx.chat.length ? [`<strong>${ruleLabel(rule, item)}</strong>`, ...ctx.chat] : []);
  }

  if (event != 'wouldBeDefeated') {
    await fireWatchers(actor, event, { roll, outcome, facts, damage, targets, ask, prompt, vars });
  }

  return damage;
}

/** Actors on the canvas holding a `watch` Trigger for this event, with those rules. */
function watchersOf(event) {
  const seen = new Set();
  const found = [];
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    const actor = token?.actor;
    if (!actor || seen.has(actor)) {
      continue;
    }

    seen.add(actor);
    const entries = rulesOfType(actor, 'Trigger').filter(entry => entry.rule.watch && entry.rule.event == event);
    if (entries.length) {
      found.push({ watcher: actor, entries });
    }
  }

  return found;
}

/** Whether `other` is on the side a watch Trigger watches, within its range. */
export function watches(watcher, other, rule) {
  if (!watcher || !other || watcher === other) {
    return false;
  }

  const feet = Number(rule.within) > 0 ? Number(rule.within) : 100000;
  return sideActorsWithin(watcher, feet, rule.watch == 'any' ? 'any' : rule.watch).includes(other);
}

/** Run every other actor's `watch` Triggers for an event that happened to `actor`. */
async function fireWatchers(actor, event, { roll = {}, outcome = null, facts = null, damage = null, targets = [], ask = null, prompt = confirm, vars = null } = {}) {
  for (const { watcher, entries } of watchersOf(event)) {
    for (const { rule, item, index } of entries) {
      if (!watches(watcher, actor, rule)) {
        continue;
      }

      if (['afterRoll', 'hit', 'targeted'].includes(event) && !outcomeMatches(rule.outcome, outcome, facts)) {
        continue;
      }

      const aim = rule.watchTarget == 'theirTarget' ? targets[0] ?? null : actor;
      if (evaluate(rule.when, contextFor({ ...roll, self: watcher, holder: watcher, ruleItem: item, other: aim, vars: vars ?? {} })) !== true) {
        continue;
      }

      if (usesLeft(watcher, rule, item, index) <= 0 || (rule.prompt && !(await prompt(item, rule)))) {
        continue;
      }

      const ctx = stepContext({ actor: watcher, item, rule, targets: aim ? [aim] : [], damage, ask });
      Object.assign(ctx.vars, vars ?? {});
      const finished = await runSteps(rule.steps, ctx);
      if (finished && countsTowardLimit(rule, ctx)) {
        await recordUse(watcher, rule, item, index);
      }

      await post(watcher, ctx.chat.length ? [`<strong>${ruleLabel(rule, item)}</strong>`, ...ctx.chat] : []);
    }
  }
}

/**
 * Every actor a world-wide sweep reaches, once each: the world's actors, plus the synthetic actors of UNLINKED tokens
 * on the viewed scene and the active scene (they aren't in game.actors). A linked token's actor is its world actor, so
 * it never counts twice. The callers run on the active GM only (sceneAdvanced / missionAdvanced / the session hook).
 */
export function sweepActors() {
  const found = [];
  const seen = new Set();
  const add = actor => {
    const key = actor?.uuid ?? actor;
    if (actor && !seen.has(actor) && !seen.has(key)) {
      seen.add(actor);
      seen.add(key);
      found.push(actor);
    }
  };

  for (const actor of globalThis.game?.actors ?? []) {
    add(actor);
  }

  const unlinked = token => token && !(token.actorLink ?? token.document?.actorLink) ? token.actor : null;
  for (const scene of new Set([globalThis.canvas?.scene, globalThis.game?.scenes?.active].filter(Boolean))) {
    for (const token of scene.tokens ?? []) {
      add(unlinked(token));
    }
  }

  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    add(unlinked(token));
  }

  return found;
}

/** The actor's actors-with-Triggers sweep, for world-wide events. */
function worldActors() {
  return sweepActors().filter(actor => rulesOfType(actor, 'Trigger').length);
}

/**
 * Damage about to land: a hit that would Defeat runs `wouldBeDefeated`, whose steps may change it.
 * Called by combat.mjs at the head of its Defeat-save chain - after immunity and every reduction, so
 * a save only spends itself on a hit that really would Defeat.
 */
export async function wouldBeDefeated(actor, amount, damageType, { isCrit = false } = {}) {
  const health = Number(actor?.system?.health?.value);
  const watching = [...rulesOfType(actor, 'Trigger'), ...linkedEntries(actor, 'Trigger')].some(e => e.rule.event == 'wouldBeDefeated');
  if (damageType == 'stun' || !(health > 0) || amount < health || !watching) {
    return amount;
  }

  const damage = { amount, damageType };
  await fireTriggers(actor, 'wouldBeDefeated', { damage, roll: { damageType, damageAmount: amount, damageCrit: !!isCrit } });
  return damage.amount;
}

/** A Trigger's `outcome`: "success" takes a Critical Success too, "failure" a Fumble too. */
/**
 * Whether a roll's result is the outcome a Trigger asks for. The first six read the summary
 * outcome (a crit counts before anything else); the rest read the results themselves (facts):
 *  - x2: some result succeeded by double the DIF (Degrees of Success x2+), a crit or not;
 *  - anyFailed / allFailed: some / every result failed, whatever the dice showed;
 *  - fumbled: a Fumble, even on a roll that also crit.
 */
function outcomeMatches(wanted, outcome, facts = null) {
  // A list: every one must hold ("fumbled" and "allFailed").
  if (Array.isArray(wanted)) {
    return wanted.every(one => outcomeMatches(one, outcome, facts));
  }

  if (!wanted || wanted == 'any') {
    return true;
  }

  // plainSuccess: a success that isn't a Critical Success or double the DIF. plainFailure: a failure, not a Fumble.
  if (wanted == 'plainSuccess') {
    return outcome == 'success';
  }

  if (wanted == 'plainFailure') {
    return outcome == 'failure';
  }

  // notDouble: no row reached double its DIF and it isn't a Critical Success (pairs with fumble in a list).
  if (wanted == 'notDouble') {
    return !['crit', 'double'].includes(outcome) && !(Array.isArray(facts?.results) ? facts.results : []).some(result => result?.success && Number(result.multiplier) >= 2);
  }

  // anySucceeded: some result beat its DIF, whatever the dice showed (pairs with fumble / crit in a list).
  if (wanted == 'anySucceeded') {
    return (Array.isArray(facts?.results) ? facts.results : []).some(result => result?.success);
  }

  const results = Array.isArray(facts?.results) ? facts.results : [];
  switch (wanted) {
  case 'x2': return results.some(result => result?.success && Number(result.multiplier) >= 2);
  case 'anyFailed': return results.some(result => result && !result.success);
  case 'allFailed': return results.length > 0 && results.every(result => result && !result.success);
  case 'fumbled': return !!facts?.isFumble;
  }

  // double: a success by at least double the DIF (Degrees of Success x2 or more) - a crit counts too.
  return wanted == outcome || (wanted == 'success' && ['crit', 'double'].includes(outcome))
    || (wanted == 'double' && outcome == 'crit') || (wanted == 'failure' && outcome == 'fumble');
}

function rollOutcome(results, { isCrit, isFumble } = {}) {
  if (isCrit) {
    return 'crit';
  }

  if (isFumble) {
    return 'fumble';
  }

  const list = Array.isArray(results) ? results : [];
  if (!list.length) {
    return null;
  }

  if (list.some(result => result?.success && Number(result.multiplier) >= 2)) {
    return 'double';
  }

  return list.some(result => result?.success) ? 'success' : 'failure';
}

/** One target's outcome: its own Degrees of Success. */
function hitOutcome(hit, result, isCrit) {
  if (!hit) {
    return 'failure';
  }

  return isCrit ? 'crit' : Number(result?.multiplier) >= 2 ? 'double' : 'success';
}

/**
 * Items a step gave for a while (grant with `until`) go once that runs out. Swept when turns and
 * rounds change and scenes start - the points at which one can run out.
 */
export async function sweepExpired(actor) {
  const { isExpired } = await import("./expiry.mjs");
  const items = actor?.items?.contents ?? [...(actor?.items ?? [])];
  const ids = items.filter(item => item.flags?.essence20?.rulesExpiry && isExpired(item.flags.essence20.rulesExpiry)).map(item => item.id);
  if (ids.length && actor.isOwner) {
    await actor.deleteEmbeddedDocuments('Item', ids);
  }

  return ids;
}

function holdsTimedItems(actor) {
  return (actor?.items?.contents ?? [...(actor?.items ?? [])]).some(item => item.flags?.essence20?.rulesExpiry);
}

async function sweepWorld() {
  for (const actor of sweepActors()) {
    if (holdsTimedItems(actor)) {
      await sweepExpired(actor);
    }
  }
}

registerTurnStart(async actor => {
  await sweepWorld();
  await fireTriggers(actor, 'turnStart');
});
registerTurnEnd(actor => fireTriggers(actor, 'turnEnd'));
registerRoundStart(async combat => {
  for (const combatant of combat?.combatants ?? []) {
    if (combatant.actor) {
      await fireTriggers(combatant.actor, 'roundStart');
    }
  }
});
registerRest(async actor => {
  const clears = restClears(actor);
  if (clears.length) {
    await actor.update(Object.fromEntries(clears.map(key => [key, null])));
  }

  await fireTriggers(actor, 'rest');
});
registerSceneAdvanced(async () => {
  await sweepWorld();
  for (const actor of worldActors()) {
    await fireTriggers(actor, 'sceneStart');
  }
});
// sessionStart: the Story Points app's New Session moved the session counter (essence20.q2SessionEpoch). The GM's client.
globalThis.Hooks?.on?.('updateSetting', async setting => {
  if (setting?.key != 'essence20.q2SessionEpoch' || !globalThis.game?.user?.isActiveGM) {
    return;
  }

  for (const actor of worldActors()) {
    await fireTriggers(actor, 'sessionStart');
  }
});

// Game-world time moving on (worldTime:<seconds> durations): timed items that ran out go.
globalThis.Hooks?.on?.('updateWorldTime', () => {
  // One GM's client only (two connected GMs would each run it).
  if (globalThis.game?.user?.isActiveGM) {
    sweepWorld();
  }
});

registerMissionAdvanced(async () => {
  for (const actor of worldActors()) {
    await fireTriggers(actor, 'missionStart');
  }
});
registerAfterDamage(async (actor, dealt, damageType, { newValue, wasAlreadyDefeated, source = null } = {}) => {
  if (dealt > 0) {
    await fireTriggers(actor, 'takesDamage', { damage: { amount: dealt, damageType }, roll: { damageType, damageAmount: dealt }, targets: source ? [source] : [] });
  }

  // The one who dealt it: dealtDamage, and defeatedEnemy when this hit Defeated them (target = who took it).
  if (source && source !== actor && dealt > 0) {
    await fireTriggers(source, 'dealtDamage', { damage: { amount: dealt, damageType }, roll: { damageType, damageAmount: dealt }, targets: [actor] });
  }

  if (!wasAlreadyDefeated && Number(newValue) <= 0) {
    // The one whose damage Defeated it (when known) is the target (Last Stand's "the creature that Defeated you").
    await fireTriggers(actor, 'defeated', { targets: source && source !== actor ? [source] : [] });
    if (source && source !== actor) {
      await fireTriggers(source, 'defeatedEnemy', { targets: [actor] });
    }
  }
});
registerPostRoll(async (actor, results, checkContext, extra = {}) => {
  const rider = extra.rider ?? checkContext?.riderContext ?? {};
  const item = rider.itemUuid ? globalThis.fromUuidSync?.(rider.itemUuid) ?? null : null;
  const roll = { item, rolledSkill: rider.skill, isAttack: item?.type == 'weaponEffect', isMelee: rider.style == 'melee', switches: rider.switches ?? [], targetCount: (extra.hits ?? []).length, ...(rider.dataset ? { dataset: rider.dataset } : {}) };
  const facts = { results: Array.isArray(results) ? results : [], isCrit: !!extra.isCrit, isFumble: !!extra.isFumble };
  // @var.total: the roll's total (the first result's - every row shares the dice); @var.dif its DIF. A roll with
  // nothing to compare against (extra.open) has a total and no outcome - only outcome "any" Triggers hear it.
  const first = (Array.isArray(results) ? results : [])[0];
  const total = Number(first?.total ?? extra.total);
  const dif = Number(first?.difficulty);
  await fireTriggers(actor, 'afterRoll', {
    roll, outcome: extra.open ? null : rollOutcome(results, extra), facts,
    vars: { ...(Number.isFinite(total) ? { total } : {}), ...(Number.isFinite(dif) ? { dif } : {}), targets: (extra.hits ?? []).length, skill: rider.skill ?? '', itemUuid: item?.uuid ?? '' },
  });

  // Each target rolled against, hit or missed - its steps land on that target with `to: "target"`.
  // Any roll against a target's Defense counts: an attack, a spell, an Intimidation test...
  // (`attack` tags stay weapon-only; `item:own` / `skill:` narrow it down).
  for (const { target, hit, result } of extra.hits ?? []) {
    if (target) {
      const hitFacts = { results: [result ?? { success: !!hit }], isCrit: !!extra.isCrit, isFumble: !!extra.isFumble };
      // @var.rolledItem: the attack rolled (a follow-up `attack` step with item: "rolled" makes it again).
      await fireTriggers(actor, hit ? 'hit' : 'miss', { roll, outcome: hitOutcome(hit, result, extra.isCrit), targets: [target], facts: hitFacts, vars: rider.itemUuid ? { rolledItem: rider.itemUuid } : null });
      // The defender's side: "an attack against you" - outcome success means it hit them; the target of its
      // steps is the attacker; @var.margin is how far the roll beat (or missed) the Defense.
      const margin = Number.isFinite(Number(result?.total)) && Number.isFinite(Number(result?.difficulty)) ? Number(result.total) - Number(result.difficulty) : 0;
      await fireTriggers(target, 'targeted', { roll, outcome: hitOutcome(hit, result, extra.isCrit), targets: [actor], facts: hitFacts, vars: { margin } });
    }
  }
});

// Combat starting and ending, Initiative being rolled, and Story Points being spent.
globalThis.Hooks?.on?.('combatStart', async combat => {
  for (const combatant of combat?.combatants ?? []) {
    if (combatant.actor) {
      await fireTriggers(combatant.actor, 'combatStart');
    }
  }
});
globalThis.Hooks?.on?.('deleteCombat', async (combat, options, userId) => {
  if (userId != globalThis.game?.user?.id || !combat?.started) {
    return;
  }

  for (const combatant of combat.combatants ?? []) {
    if (combatant.actor) {
      await fireTriggers(combatant.actor, 'combatEnd');
    }
  }
});
globalThis.Hooks?.on?.('updateCombatant', (combatant, changed, options, userId) => {
  if (userId == globalThis.game?.user?.id && changed?.initiative !== undefined && changed.initiative !== null && combatant.actor) {
    fireTriggers(combatant.actor, 'initiativeRolled');
  }
});
globalThis.Hooks?.on?.('essence20.storyPointSpent', (actor, amount) => {
  if (actor && amount > 0) {
    fireTriggers(actor, 'storyPointSpent');
  }
});

// A Condition arriving on an actor this user changed - 'conditionGained', with the Condition's id in
// the roll context so a Trigger can ask for it with self:status:<id>.
globalThis.Hooks?.on?.('createActiveEffect', (effect, options, userId) => {
  const actor = effect?.parent;
  if (userId != globalThis.game?.user?.id || actor?.documentName != 'Actor' || !effect.statuses?.size) {
    return;
  }

  fireTriggers(actor, 'conditionGained');
});

// equipped / unequipped: the item's own rules (and anything else on its actor watching for it), with the item in hand.
globalThis.Hooks?.on?.('updateItem', (item, changed, options, userId) => {
  const actor = item?.parent;
  if (userId != globalThis.game?.user?.id || actor?.documentName != 'Actor' || changed?.system?.equipped === undefined) {
    return;
  }

  // The item's own rules whether it counts right now or not (unequipping switches them off), then everyone else's.
  const event = changed.system.equipped ? 'equipped' : 'unequipped';
  fireItemAdded(actor, item, { event }).then(() => fireTriggers(actor, event, { roll: { item }, skipItem: item }));
});

// itemAdded: another item arrived on the actor (the item's own rules have 'added'); the new item is the roll item.
globalThis.Hooks?.on?.('createItem', (item, options, userId) => {
  const actor = item?.parent;
  if (userId == globalThis.game?.user?.id && actor?.documentName == 'Actor') {
    fireTriggers(actor, 'itemAdded', { roll: { item }, skipItem: item });
  }
});

// movedOnTurn: a token moved on its own actor's turn in a running combat.
globalThis.Hooks?.on?.('updateToken', (tokenDoc, changes, options, userId) => {
  const combat = globalThis.game?.combat;
  const actor = tokenDoc?.actor;
  if (userId != globalThis.game?.user?.id || !actor || !combat?.started || !('x' in (changes ?? {}) || 'y' in (changes ?? {}))) {
    return;
  }

  if (combat.combatant?.tokenId == tokenDoc.id || combat.combatant?.actor === actor) {
    fireTriggers(actor, 'movedOnTurn');
  }
});

// The values essenceChanged / resourceSpent compare against, taken before the update lands.
const SPENDABLE = ['system.powers.personal.value', 'system.energon.normal.value', 'system.energon.dark.value', 'system.health.value'];
const ESSENCE_KEYS = ['strength', 'speed', 'smarts', 'social'];
globalThis.Hooks?.on?.('preUpdateActor', (actor, changed, options) => {
  const get = path => Number(globalThis.foundry?.utils?.getProperty?.(actor, path));
  options.e20RulesBefore = Object.fromEntries([...SPENDABLE, ...ESSENCE_KEYS.map(key => `system.essences.${key}.value`)].map(path => [path, get(path)]));
});

globalThis.Hooks?.on?.('updateActor', (actor, changed, options, userId) => {
  if (userId != globalThis.game?.user?.id) {
    return;
  }

  const before = options?.e20RulesBefore ?? {};
  // Drained, refunded or rested values aren't spends (the writers flag them, as the resource slice's own hooks read).
  const notSpent = !!(options?.essence20Loss || options?.essence20Refund || options?.essence20Rest || options?.isRest);
  const now = path => Number(globalThis.foundry?.utils?.getProperty?.(actor, path));
  const touched = path => globalThis.foundry?.utils?.hasProperty?.(changed ?? {}, path);
  // resourceSpent: one of the spendable values went down (@var.spent, @var.resource = power | energon | darkEnergon | health).
  for (const path of SPENDABLE) {
    if (!notSpent && touched(path) && Number.isFinite(before[path]) && now(path) < before[path]) {
      const resource = { 'system.powers.personal.value': 'power', 'system.energon.normal.value': 'energon', 'system.energon.dark.value': 'darkEnergon', 'system.health.value': 'health' }[path];
      fireTriggers(actor, 'resourceSpent', { vars: { spent: before[path] - now(path), resource } });
    }
  }

  // droppedToZero: Health or Personal Power reached 0 from above (@var.resource = health | power) - any write, not only
  // applyDamage.
  for (const [path, resource] of [['system.health.value', 'health'], ['system.powers.personal.value', 'power']]) {
    if (touched(path) && Number(before[path]) > 0 && now(path) <= 0) {
      fireTriggers(actor, 'droppedToZero', { vars: { resource } });
    }
  }

  // essenceChanged: @var.essence, @var.change (+/-).
  for (const key of ESSENCE_KEYS) {
    const path = `system.essences.${key}.value`;
    if (touched(path) && Number.isFinite(before[path]) && now(path) != before[path]) {
      fireTriggers(actor, 'essenceChanged', { vars: { essence: key, change: now(path) - before[path] } });
    }
  }

  const has = path => globalThis.foundry?.utils?.hasProperty?.(changed ?? {}, path);
  if (has('system.isMorphed')) {
    fireTriggers(actor, actor.system?.isMorphed ? 'morph' : 'unmorph');
  }

  if (has('system.isTransformed')) {
    fireTriggers(actor, actor.system?.isTransformed ? 'transform' : 'untransform');
  }
});

/** An item just added to an actor runs its own 'added' Triggers - only that item's, not the actor's others. */
export async function fireItemAdded(actor, item, options = {}) {
  const event = options.event ?? 'added';
  const own = rulesOf(item).filter(rule => rule?.type == 'Trigger' && rule.event == event && !rule.disabled);
  for (const rule of own) {
    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item, item })) !== true) {
      continue;
    }

    const ctx = stepContext({ actor, item, rule, targets: [], ask: options.ask ?? null });
    await runSteps(rule.steps, ctx);
    await post(actor, ctx.chat.length ? [`<strong>${ruleLabel(rule, item)}</strong>`, ...ctx.chat] : []);
  }
}

/** A roll with nothing to compare against (dice.mjs): afterRoll Triggers with outcome "any", and @var.total. */
export async function fireOpenRoll(actor, total, skill = null) {
  await fireTriggers(actor, 'afterRoll', { roll: { rolledSkill: skill }, outcome: null, facts: { results: [], open: true }, vars: Number.isFinite(Number(total)) ? { total: Number(total) } : null });
}

export { rollOutcome };
