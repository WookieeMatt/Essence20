import { E20 } from "./config.mjs";

/**
 * Action Economy.
 *
 * Essence20 has always known the vocabulary - Standard, Move, Free, Full Action are all defined in
 * E20.actionTypes and have been since long before this file existed - but nothing ever subtracted.
 * This module is the ledger, and it is the ONLY thing that reads or writes it: sheets, item rolls,
 * the Combat document and the Conditions clamp all go through the functions below rather than
 * touching combatant flags themselves. That is what keeps the feature testable and, if it ever
 * comes to it, removable.
 *
 * Three pieces, deliberately kept apart:
 *
 * 1. BUDGET - derived, on the Actor (system.actions.<category>.max, computed in
 *    documents/actor.mjs#_prepareActions). It lives on the actor because Active Effects need
 *    somewhere to target: "you gain an extra Move action" is a one-line AE change on
 *    system.actions.move.bonus rather than another bespoke helper file.
 *
 * 2. LEDGER - stored, on the Combatant (flags.essence20.actions). Spend state is inherently
 *    per-encounter: it's deleted along with the combat, it never goes stale on the actor, and two
 *    unlinked tokens of the same actor get separate ledgers - which matters for exactly the mooks
 *    who need it most. Out of combat there is no ledger and nothing is gated; the action economy
 *    simply doesn't exist outside an encounter, which is correct.
 *
 * 3. MODE - a world setting (off / track / warn / strict). 'track' is the default: the
 *    overwhelming majority of compendium items carry no authored action cost yet, so gating on
 *    absent data would break every table. See E20.actionEconomyModes.
 *
 * There is deliberately NO reaction budget. Essence20 has no reactions: the readied/interrupt
 * mechanism is the Contingency action (GI Joe CRB p.196), which spends a Standard action on your
 * own turn and resolves later. An earlier draft of this module invented a fourth "reaction"
 * resource for the half-dozen "when X happens, you may..." Perks; that was a house rule wearing
 * the rules' clothes, and it's gone. Those Perks keep their own prompts and their own once-per-
 * round gates, which is what RAW actually gives them.
 *
 * The budgets themselves come from the Speed Essence, not from a flat 1/1 - see
 * documents/actor.mjs#_prepareActions. Free actions are finite (Speed - 2), and at Speed 1 a
 * character gets a Move OR a Standard rather than both, which is what `shared` carries.
 *
 * Turn boundaries are handled by documents/combat.mjs#_onStartTurn, not by the combatTurn/
 * combatRound hooks used elsewhere in this system - see resetTurn() below for why.
 */

const FLAG_SCOPE = 'essence20';
const FLAG_KEY = 'actions';

/**
 * A fresh, unspent ledger.
 *
 * Two separate Whole Turn markers, one turn apart. `turnConsumed` is set the moment a Whole Turn
 * action is taken, and means "the turn AFTER this one is already spoken for". resetTurn() reads it
 * once, then replaces it with `turnSkipped` on the following turn, which means "this turn is
 * already gone".
 *
 * turnSkipped is its own flag rather than a ledger pre-filled to the actor's budget, so that
 * "this turn is gone" holds whatever the budget happens to be - including a Speed 1 turn, where
 * the shared Move/Standard pool has no single number to pre-spend. getRemaining() reports zero
 * across the board while it's set.
 * @returns {Object}
 */
export function emptyLedger() {
  return {
    standard: 0,
    move: 0,
    free: 0,
    // Extra Free actions granted this turn by trading away the Standard action - Speed 2's
    // "alternatively, a character may trade in a Standard action for two Free actions"
    // (CRB p.193). Tracked on the ledger rather than the actor because it's a per-turn choice.
    freeGranted: 0,
    turnConsumed: false,
    turnSkipped: false,
    log: [],
  };
}

/**
 * The world's current enforcement mode. Defaults to 'track' wherever the setting isn't registered
 * yet (early init, and unit tests), so no caller ever has to null-check it.
 * @returns {String}   One of E20.actionEconomyModes.
 */
export function getMode() {
  const mode = readSetting('actionEconomyMode');
  return mode in E20.actionEconomyModes ? mode : 'track';
}

/**
 * Read one of this module's own settings without ever throwing. Foundry throws outright on a
 * setting that isn't registered yet, and these functions run from prepareDerivedData and sheet
 * rendering - both of which can fire during 'setup', before registerSettings() has run.
 * @param {String} key
 * @returns {*}   The setting's value, or undefined.
 */
function readSetting(key) {
  try {
    return game?.settings?.get?.(FLAG_SCOPE, key);
  } catch {
    return undefined;
  }
}

/**
 * Whether the action economy is doing anything at all right now.
 * @returns {Boolean}
 */
export function isTracking() {
  return getMode() != 'off';
}

/**
 * Whether a failed affordability check should actually BLOCK, as opposed to being recorded and
 * reported. GMs always bypass - they're the ones cleaning up after the unauthored long tail.
 * @returns {Boolean}
 */
export function isBlocking() {
  if (game?.user?.isGM) {
    return false;
  }

  return getMode() == 'strict';
}

/**
 * Whether an unaffordable spend should stop and ask before going through. GMs skip the prompt for
 * the same reason they bypass blocking - they're the ones driving every NPC through the unauthored
 * long tail, and a confirmation on each one is noise rather than a safety net.
 * @returns {Boolean}
 */
export function isConfirming() {
  if (game?.user?.isGM) {
    return false;
  }

  return getMode() == 'warn';
}

/**
 * Ask whether to go ahead with a spend the actor can't afford. Resolves false when the player
 * backs out, and - deliberately - true if the dialog can't be shown at all, so a missing dialog
 * degrades to 'track' behaviour rather than silently swallowing the action.
 * @param {Actor} actor
 * @param {Object} check   The failed result of canSpend().
 * @returns {Promise<Boolean>}
 */
async function confirmOverspend(actor, check) {
  const confirm = foundry.applications?.api?.DialogV2?.confirm;
  if (!confirm) {
    return true;
  }

  return !!await confirm({
    window: { title: game.i18n.localize('E20.ActionEconomyConfirmTitle') },
    content: `<p>${game.i18n.format('E20.ActionEconomyConfirmPrompt', {
      name: actor?.name ?? '',
      action: describeCost(Object.fromEntries(check.shortfall.map(category => [category, 1]))),
    })}</p>`,
    rejectClose: false,
    modal: true,
  });
}

/* -------------------------------------------- */
/*  Resolution                                  */
/* -------------------------------------------- */

/**
 * The Combatant whose ledger this actor spends from, or null when the actor isn't in the active
 * encounter (or there isn't one). Uses getCombatantsByActor - the PLURAL form; the singular
 * Combat#getCombatantByActor is deprecated as of Foundry v14 and removed in v15, and the plural
 * one is also the honest answer when an actor has several tokens in the same encounter.
 *
 * For an actor with more than one combatant, the one matching this actor's own token is preferred
 * so each unlinked token spends its own budget; the first is used as a fallback.
 * @param {Actor} actor
 * @returns {Combatant|null}
 */
export function getCombatant(actor) {
  const combat = game?.combat;
  if (!actor || !combat?.getCombatantsByActor) {
    return null;
  }

  const combatants = combat.getCombatantsByActor(actor) ?? [];
  if (!combatants.length) {
    return null;
  }

  const tokenId = actor.token?.id ?? actor.parent?.id ?? null;
  return combatants.find(c => tokenId && c.tokenId == tokenId) ?? combatants[0];
}

/**
 * The document the ledger is actually stored on. Normally the Combatant itself, but when the
 * world has group budgets switched on and the combatant belongs to a CombatantGroup (Foundry
 * v14's own shared-initiative primitive - combat.groups / combatant.group / group.members), the
 * whole group shares one ledger instead.
 *
 * That is the entire implementation of "do a Zord crew share an action economy?" - a lookup, not
 * a schema fork. Whether a given game line SHOULD share is a rules question for the GM, which is
 * why it's a setting rather than a hard-coded rule per actor type.
 * @param {Actor} actor
 * @returns {Combatant|CombatantGroup|null}
 */
export function getLedgerDocument(actor) {
  const combatant = getCombatant(actor);
  if (!combatant) {
    return null;
  }

  const shareGroup = readSetting('actionEconomyGroupBudget');
  return (shareGroup && combatant.group) ? combatant.group : combatant;
}

/* -------------------------------------------- */
/*  Reading                                     */
/* -------------------------------------------- */

/**
 * The actor's derived per-turn budget, as computed from the Speed Essence. A budget of 0 means the
 * actor has none of that category this turn - the ordinary case for Free actions below Speed 3,
 * not an error.
 * @param {Actor} actor
 * @returns {Object}   {standard, move, free}, each a Number.
 */
export function getBudget(actor) {
  const budget = {};
  for (const category of Object.keys(E20.actionCategories)) {
    budget[category] = actor?.system?.actions?.[category]?.max ?? 0;
  }

  return budget;
}

/**
 * The actor's spend ledger for the current encounter, or a fresh empty one when they aren't in
 * combat. Always safe to read - never returns null, so every caller can treat "no combat" as
 * "nothing spent" without branching.
 * @param {Actor} actor
 * @returns {Object}
 */
export function getLedger(actor) {
  const document = getLedgerDocument(actor);
  const stored = document?.getFlag?.(FLAG_SCOPE, FLAG_KEY);
  return stored ? { ...emptyLedger(), ...stored } : emptyLedger();
}

/**
 * How much of each budget the actor has left this turn.
 * @param {Actor} actor
 * @returns {Object}   {standard, move, free}
 */
export function getRemaining(actor) {
  const budget = getBudget(actor);
  const ledger = getLedger(actor);
  const remaining = {};

  // Speed 1: "Move OR Standard action... then ends their turn" (CRB p.193). Spending either one
  // ends the turn's single action, so once either is spent both read as gone.
  const shared = !!actor?.system?.actions?.shared;
  const sharedSpent = shared && ((ledger.standard ?? 0) > 0 || (ledger.move ?? 0) > 0);

  for (const category of Object.keys(E20.actionCategories)) {
    // A turn already consumed by last turn's Whole Turn action has nothing left in any category.
    if (ledger.turnSkipped) {
      remaining[category] = 0;
      continue;
    }

    if (sharedSpent && (category == 'standard' || category == 'move')) {
      remaining[category] = 0;
      continue;
    }

    const granted = category == 'free' ? (ledger.freeGranted ?? 0) : 0;
    const max = (budget[category] ?? 0) + granted;
    remaining[category] = Math.max(0, max - (ledger[category] ?? 0));
  }

  return remaining;
}

/**
 * Speed 2's explicit trade: "a character may trade in a Standard action for two Free actions"
 * (CRB p.193). Spends the Standard and grants two Free actions for the rest of this turn.
 *
 * Offered whenever the actor still has a Standard to give up, not just at Speed 2 - the rules
 * phrase it as an alternative to taking a Standard action, and nothing restricts it to that one
 * Speed. Refusing it to a Speed 3 character would be inventing a limit.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether the trade happened.
 */
export async function tradeStandardForFree(actor) {
  const document = getLedgerDocument(actor);
  if (!document || getRemaining(actor).standard < 1) {
    return false;
  }

  const ledger = getLedger(actor);
  ledger.standard = (ledger.standard ?? 0) + 1;
  ledger.freeGranted = (ledger.freeGranted ?? 0) + 2;
  ledger.log.push({
    id: foundry.utils.randomID(),
    actionType: 'standard',
    cost: { standard: 1 },
    source: game.i18n.localize('E20.ActionEconomyTradeForFree'),
  });

  await writeLedger(document, ledger);
  return true;
}

/**
 * What a given action type costs, as {category: amount}. An unknown type costs nothing rather than
 * throwing - an item whose actionType predates a config change shouldn't break a roll.
 * @param {String} actionType   A key of E20.actionTypes.
 * @returns {Object}
 */
export function getCost(actionType) {
  return E20.actionTypeCosts[actionType] ?? {};
}

/* -------------------------------------------- */
/*  Spending                                    */
/* -------------------------------------------- */

/**
 * Whether the actor can afford the given action type right now, and if not, which categories fell
 * short. Never throws and never writes.
 *
 * Returns ok:true in all the "not applicable" cases - tracking off, actor opted out, not in
 * combat, or a type that costs nothing (passive items, and the tenMinutes/oneHour out-of-combat
 * durations) - so callers can use the same code path everywhere.
 * @param {Actor} actor
 * @param {String} actionType
 * @returns {Object}   {ok, cost, shortfall: [category], remaining}
 */
export function canSpend(actor, actionType) {
  const cost = getCost(actionType);
  const result = { ok: true, cost, shortfall: [], remaining: null };

  if (!isTracking() || !actor?.system?.actions?.enabled || !Object.keys(cost).length) {
    return result;
  }

  if (!getLedgerDocument(actor)) {
    return result;
  }

  const remaining = getRemaining(actor);
  result.remaining = remaining;
  for (const [category, amount] of Object.entries(cost)) {
    if ((remaining[category] ?? 0) < amount) {
      result.shortfall.push(category);
    }
  }

  result.ok = !result.shortfall.length;
  return result;
}

/**
 * Spend an action type's full cost, atomically - a Full Action with a Standard already gone takes
 * NEITHER half rather than silently eating the Move. Records what caused the spend and returns an
 * id, which is what makes refund() possible; without it, a roll that spends here and is then
 * cancelled at the options dialog would quietly eat the player's turn, and cancelling a roll
 * dialog is the common case rather than the edge case.
 *
 * @param {Actor} actor
 * @param {String} actionType
 * @param {Object} options
 * @param {String} [options.source]   Human-readable cause, e.g. an item name, for the log.
 * @param {Boolean} [options.bypass]  Spend nothing and report ok - the "Don't spend" escape hatch.
 * @returns {Promise<Object>}   {ok, spendId, cost, shortfall, blocked}
 */
export async function spend(actor, actionType, { source = null, bypass = false } = {}) {
  const check = canSpend(actor, actionType);
  if (bypass || !Object.keys(check.cost).length) {
    return { ...check, ok: true, spendId: null, blocked: false };
  }

  if (!check.ok) {
    if (isBlocking()) {
      return { ...check, spendId: null, blocked: true };
    }

    // 'warn' stops and asks rather than refusing outright. Backing out is reported as `blocked` so
    // the caller aborts exactly as it would under 'strict' - the difference between the two modes
    // is who decides, not what happens afterwards.
    // `cancelled` separates "you said no" from "the world said no", so the caller can abort
    // quietly instead of telling the player what they already decided.
    if (isConfirming() && !await confirmOverspend(actor, check)) {
      return { ...check, spendId: null, blocked: true, cancelled: true };
    }
  }

  const document = getLedgerDocument(actor);
  if (!document) {
    return { ...check, ok: true, spendId: null, blocked: false };
  }

  const ledger = getLedger(actor);
  const spendId = foundry.utils.randomID();
  for (const [category, amount] of Object.entries(check.cost)) {
    ledger[category] = (ledger[category] ?? 0) + amount;
  }

  ledger.log.push({ id: spendId, actionType, cost: check.cost, source });
  if (E20.actionTypesConsumingNextTurn.includes(actionType)) {
    ledger.turnConsumed = true;
  }

  await writeLedger(document, ledger);
  return { ...check, ok: true, spendId, blocked: false };
}

/**
 * Undo a spend recorded by spend(), by its id. A no-op if the id isn't in the log (already
 * refunded, or the turn has since reset), so a double-cancel can't hand back actions twice.
 * @param {Actor} actor
 * @param {String} spendId
 * @returns {Promise<Boolean>}   Whether anything was actually refunded.
 */
export async function refund(actor, spendId) {
  if (!spendId) {
    return false;
  }

  const document = getLedgerDocument(actor);
  if (!document) {
    return false;
  }

  const ledger = getLedger(actor);
  const index = ledger.log.findIndex(entry => entry.id == spendId);
  if (index < 0) {
    return false;
  }

  const [entry] = ledger.log.splice(index, 1);
  for (const [category, amount] of Object.entries(entry.cost ?? {})) {
    ledger[category] = Math.max(0, (ledger[category] ?? 0) - amount);
  }

  if (E20.actionTypesConsumingNextTurn.includes(entry.actionType)) {
    ledger.turnConsumed = false;
  }

  await writeLedger(document, ledger);
  return true;
}

/**
 * Manually adjust one category, for the sheet's own clickable pips. GMs (and players, for their
 * own actors) will use this constantly for the long tail of items that don't declare an action
 * cost yet, so it's a first-class control rather than a debug affordance.
 * @param {Actor} actor
 * @param {String} category   A key of E20.actionCategories.
 * @param {Number} delta      +1 to spend one, -1 to hand one back.
 * @returns {Promise<Boolean>}
 */
export async function adjust(actor, category, delta) {
  const document = getLedgerDocument(actor);
  if (!document || !(category in E20.actionCategories)) {
    return false;
  }

  const ledger = getLedger(actor);
  ledger[category] = Math.max(0, (ledger[category] ?? 0) + delta);
  await writeLedger(document, ledger);
  return true;
}

/* -------------------------------------------- */
/*  Turn boundaries                             */
/* -------------------------------------------- */

/**
 * Refill a combatant's budget at the start of their turn.
 *
 * Called from documents/combat.mjs#_onStartTurn rather than the combatTurn/combatRound hook pair
 * the rest of this system uses for per-turn upkeep. That's deliberate, and it's a Foundry v14
 * thing: _onStartTurn runs AFTER the Combat document's update has committed (so there's no
 * "combat.combatant is still the OLD turn" workaround to write), it covers the very first turn of
 * a combat as well as every later one (so there's no separate combatStart case to remember), and
 * core only calls it on ONE designated GM client - which means exactly one write reaches the
 * database instead of one per connected player.
 *
 * A turn already consumed by a Whole Turn action taken last turn is skipped: the budget stays at
 * zero and the marker clears, so the turn after that refills normally.
 * @param {Combatant|CombatantGroup} document
 * @returns {Promise<void>}
 */
export async function resetTurn(document) {
  if (!document?.getFlag) {
    return;
  }

  const stored = document.getFlag(FLAG_SCOPE, FLAG_KEY);
  const ledger = emptyLedger();
  ledger.turnSkipped = !!stored?.turnConsumed;
  await writeLedger(document, ledger);
}

/* -------------------------------------------- */
/*  Item funnel                                 */
/* -------------------------------------------- */

/**
 * The single call every item use goes through - see documents/item.mjs#roll, which invokes this
 * before any of its own branching so one insertion covers every weapon, weapon effect, Power and
 * spell in the game.
 *
 * Returns the same shape as spend(), plus the resolved actionType, so the caller can decide
 * whether to continue. In every mode except 'strict' this always reports ok:true - it records the
 * spend and reports it, but doesn't stand in the way.
 * @param {Item} item
 * @param {Object} options
 * @param {Actor} [options.actor]     Overrides item.actor, for a roll made on another actor's
 *   behalf (a Vehicle's inherent attack rolled by its driver, say).
 * @param {Boolean} [options.bypass]  The "Don't spend" escape hatch.
 * @returns {Promise<Object>}   {ok, actionType, spendId, cost, shortfall, blocked}
 */
export async function consumeForItem(item, { actor = null, bypass = false } = {}) {
  const roller = actor || item?.actor;
  const actionType = item?.system?.actionType ?? 'none';
  if (!roller || item?.system?.ignoresEconomy) {
    return { ok: true, actionType, spendId: null, cost: {}, shortfall: [], blocked: false };
  }

  const result = await spend(roller, actionType, { source: item?.name ?? null, bypass });
  return { ...result, actionType };
}

/**
 * Everything the sheet header's pip row needs, or null when there's nothing to show (tracking off,
 * actor opted out, or not in the active encounter - the action economy doesn't exist outside one).
 *
 * Every category renders as one pip per point of budget, which is only readable because the
 * budgets are small: the rules cap Free actions at Speed - 2 (CRB p.193), so even a Speed 5
 * character draws three of them rather than an unbounded row.
 * @param {Actor} actor
 * @returns {Object|null}
 *   {categories: [{key, label, spent, max, pips}], turnSkipped, shared, canTrade}
 */
export function getSheetContext(actor) {
  if (!isTracking() || !actor?.system?.actions?.enabled || !getLedgerDocument(actor)) {
    return null;
  }

  const ledger = getLedger(actor);
  const budget = getBudget(actor);
  const remaining = getRemaining(actor);
  const categories = Object.entries(E20.actionCategories).map(([key, label]) => {
    const spent = ledger[key] ?? 0;
    const max = (budget[key] ?? 0) + (key == 'free' ? (ledger.freeGranted ?? 0) : 0);
    // One pip per point of budget, plus one extra for each point already overspent - 'track' mode
    // lets a spend go through even when nothing is left, and an overdraft the sheet doesn't draw
    // is an overdraft nobody notices.
    const pips = Array.from(
      { length: Math.max(max, spent) },
      (unused, index) => ({ spent: index < spent }),
    );

    return { key, label, spent, max, pips };
  });

  return {
    categories,
    turnSkipped: !!ledger.turnSkipped,
    // Speed 1 - worth saying on the sheet, because two full pips that both vanish when either is
    // spent looks like a bug unless the player knows why.
    shared: !!actor.system.actions.shared,
    canTrade: remaining.standard > 0,
  };
}

/**
 * A localized, comma-separated list of what a cost actually spends, e.g. "Standard, Move" - for
 * chat cards, the roll dialog and notifications.
 * @param {Object} cost   A {category: amount} object from getCost().
 * @returns {String}
 */
export function describeCost(cost) {
  return Object.keys(cost ?? {})
    .map(category => game.i18n.localize(E20.actionCategories[category] ?? category))
    .join(', ');
}

/* -------------------------------------------- */
/*  Internals                                   */
/* -------------------------------------------- */

/**
 * Write a ledger back to its document, going via a GM client when the current user can't modify it
 * themselves. A player always owns their own actor's combatant, so the socket path is only reached
 * for the uncommon cases (spending on an actor someone else owns, a GM-owned NPC acting through a
 * player's click) - but those cases would otherwise fail silently, which is worse than a round
 * trip.
 * @param {Combatant|CombatantGroup} document
 * @param {Object} ledger
 * @returns {Promise<void>}
 */
async function writeLedger(document, ledger) {
  if (document.isOwner || game?.user?.isGM) {
    await document.setFlag(FLAG_SCOPE, FLAG_KEY, ledger);
    return;
  }

  game.socket.emit("system.essence20", {
    action: "setActionLedger",
    uuid: document.uuid,
    ledger,
  });
}

/**
 * GM-side handler for the socket message writeLedger() above emits. Only the designated active GM
 * applies it, so several connected GMs don't each write the same flag.
 * @param {Object} data
 * @returns {Promise<void>}
 */
export async function handleSetActionLedger(data) {
  if (!game.user?.isActiveGM) {
    return;
  }

  const document = await fromUuid(data.uuid);
  await document?.setFlag(FLAG_SCOPE, FLAG_KEY, data.ledger);
}
