/**
 * Extension points - where a Perk's automation plugs into the system without editing dice.mjs,
 * documents/actor.mjs, helpers/combat.mjs and the rest for every item.
 *
 * A feature module imports this file and calls the register* functions at load; the module itself is
 * imported once from helpers/extensions/index.mjs. Each hook is called from exactly one place in the
 * system (named in its doc comment), every call is wrapped so one broken extension can't stop a roll,
 * and none of this file imports anything, so any module can use it without an import loop.
 */

const REGISTRY = {
  preRoll: [],
  rollSources: [],
  defenseAdjust: [],
  specializes: [],
  dialogToggles: [],
  applyDialog: [],
  postRoll: [],
  hitRiders: [],
  consumers: {},
  damageModifiers: [],
  afterDamage: [],
  turnStart: [],
  turnEnd: [],
  roundStart: [],
  rest: [],
  sceneAdvanced: [],
  missionAdvanced: [],
  derived: [],
  chatDecorators: [],
  chatButtons: {},
  uses: [],
  costRules: [],
  costRuleProviders: [],
  namedActions: {},
  spellCost: [],
  rerollGrants: [],
};

function warn(where, error) {
  console.error(`Essence20 | extension failed in ${where}`, error);
}

function each(list, where, fn) {
  for (const entry of list) {
    try {
      fn(entry);
    } catch (error) {
      warn(where, error);
    }
  }
}

async function eachAsync(list, where, fn) {
  for (const entry of list) {
    try {
      await fn(entry);
    } catch (error) {
      warn(where, error);
    }
  }
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

/**
 * Before anything reads the roll: may change the dataset (a Skill substitution, a forced
 * Specialization). fn(actor, dataset, item) - mutate dataset. From dice.mjs#rollSkill.
 */
export const registerPreRoll = fn => REGISTRY.preRoll.push(fn);

/**
 * Automatic ↑/↓/Edge/Snag sources, listed in the Roll Options Dialog.
 * fn(actor, target, ctx) => {sources: [{id, label, shiftUp, shiftDown, edge, snag}], consumes: [{ext, ...}]}
 * ctx: {item, rolledSkill, rolledEssence, isAttack, isMelee, isShove, dataset}. A consume carrying
 * `ext: key` goes to the consumer registered under that key once the roll happens.
 * From helpers/target-riders.mjs#rollRiderSources (with or without a target).
 */
export const registerRollSources = fn => REGISTRY.rollSources.push(fn);

/** fn(key, async consume) - spends a once-per-something source a roll used. */
export const registerConsumer = (key, fn) => {
  REGISTRY.consumers[key] = fn;
};

/**
 * The defender's Defense when attacked. fn(attacker, defender, defenseType, ctx) => Number to add.
 * From helpers/target-riders.mjs#riderDefenseAdjust.
 */
export const registerDefenseAdjust = fn => REGISTRY.defenseAdjust.push(fn);

/** Whether the roll counts as Specialized. fn(actor, skill, item, dataset) => Boolean. From dice.mjs. */
export const registerSpecializes = fn => REGISTRY.specializes.push(fn);

/**
 * Controls for the Roll Options Dialog. fn(actor, ctx) => Array of {name, label, type: 'checkbox'|
 * 'number'|'select', options?: [{value, label}], max?, value?}. The dialog returns them as
 * options.ext[name]. From dice.mjs, alongside the other dialog flags.
 */
export const registerDialogToggles = fn => REGISTRY.dialogToggles.push(fn);

/**
 * What the dialog's choices do once it closes. fn(actor, options, ctx) - mutate options (shiftUp,
 * shiftDown, edge, snag...). ctx: {item, rolledSkill, dataset}. From dice.mjs.
 */
export const registerApplyDialog = fn => REGISTRY.applyDialog.push(fn);

/**
 * After the roll. fn(actor, results, checkContext, {isCrit, isFumble, hits}) - hits are
 * [{result, target, entry, hit}]. From helpers/target-riders.mjs#applyRollRiders.
 */
export const registerPostRoll = fn => REGISTRY.postRoll.push(fn);

/**
 * On each successful attack hit, before the card is drawn. fn(actor, target, result, rider, tools)
 * where tools = {damageBonusNote(result, amount, label), addRiderOption(result, option), isCrit}.
 * From helpers/target-riders.mjs#attackRiders.
 */
export const registerHitRider = fn => REGISTRY.hitRiders.push(fn);

/**
 * Damage about to land. fn(actor, amount, damageType, ctx) => new amount. From
 * helpers/combat.mjs#applyDamage, after Immunity.
 */
export const registerDamageModifier = fn => REGISTRY.damageModifiers.push(fn);

/** Damage landed. fn(actor, dealt, damageType, {newValue, previousValue, wasAlreadyDefeated}). */
export const registerAfterDamage = fn => REGISTRY.afterDamage.push(fn);

/** fn(actor, combat, context) - a combatant's turn starts / ends (GM client). documents/combat.mjs. */
export const registerTurnStart = fn => REGISTRY.turnStart.push(fn);
export const registerTurnEnd = fn => REGISTRY.turnEnd.push(fn);
/** fn(combat) - a new round's first turn (GM client). */
export const registerRoundStart = fn => REGISTRY.roundStart.push(fn);

/** fn(actor) - the sheet's Rest. sheet-handlers/listener-misc-handler.mjs. */
export const registerRest = fn => REGISTRY.rest.push(fn);

/** fn(epoch) - the GM started a new scene / mission (active GM client). */
export const registerSceneAdvanced = fn => REGISTRY.sceneAdvanced.push(fn);
export const registerMissionAdvanced = fn => REGISTRY.missionAdvanced.push(fn);

/**
 * Derived data, last thing in Essence20Actor#prepareDerivedData. fn(actor) - mutate actor.system
 * (health.max, defenses.<x>.total and .string, movement...). Must be synchronous and cheap.
 */
export const registerDerived = fn => REGISTRY.derived.push(fn);

/** fn(message, element) - every chat message as it renders. */
export const registerChatDecorator = fn => REGISTRY.chatDecorators.push(fn);

/**
 * A button on a chat card: <button data-e20-ext="key" ...>. fn(message, button) runs on click.
 */
export const registerChatButton = (key, fn) => {
  REGISTRY.chatButtons[key] = fn;
};

/**
 * A Use button on an item. {id, matches(item) => Boolean, canUse?(item) => Boolean,
 * run(item, economy, pay) => Promise<String|null>} - run's return is the chat line. pay(cost) spends
 * 'standard' | 'move' | 'free' in combat and resolves false if blocked.
 */
export const registerUse = use => REGISTRY.uses.push(use);

/**
 * A cheaper way to pay for an action - same shape as helpers/action-perks.mjs COST_RULES, plus a
 * `label` for the dialog: {id, label, has(actor), matches(ctx), to(actionType, ctx, ledger, actor),
 * limit?, ask?}.
 */
export const registerCostRule = rule => REGISTRY.costRules.push(rule);

/**
 * Cost rules that depend on the actor - fn(actor) => rules of the registerCostRule shape. The rules
 * engine's ActionCost rules (rules/actions.mjs) come through here, one per rule on the actor's items.
 */
export const registerCostRuleProvider = fn => REGISTRY.costRuleProviders.push(fn);

/**
 * A spell's casting cost, just before it's cast. async fn(item, cost, dataset) => new cost, or null to
 * cancel the cast. documents/item.mjs (the spell branch of roll()).
 */
export const registerSpellCost = fn => REGISTRY.spellCost.push(fn);

/**
 * Reroll options added from code, for things whose item type carries no system.reroll (Dark Energon
 * is gear). fn(actor) => configs; helpers/reroll.mjs#getRerollConfigs reads them.
 */
export const registerRerollGrant = fn => REGISTRY.rerollGrants.push(fn);
export const rerollGrants = () => REGISTRY.rerollGrants;

/** A named action's effect: fn(actor) => {message} | {cancelled: true}. helpers/named-actions.mjs. */
export const registerNamedAction = (key, fn) => {
  REGISTRY.namedActions[key] = fn;
};

/* -------------------------------------------- */
/*  Calling them                                 */
/* -------------------------------------------- */

export async function runPreRoll(actor, dataset, item) {
  await eachAsync(REGISTRY.preRoll, 'preRoll', fn => fn(actor, dataset, item));
}

export function extRollSources(actor, target, ctx) {
  const out = { sources: [], consumes: [] };
  each(REGISTRY.rollSources, 'rollSources', fn => {
    const result = fn(actor, target, ctx);
    out.sources.push(...(result?.sources ?? []).map(s => ({ shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...s, id: `ext-${s.id}` })));
    out.consumes.push(...(result?.consumes ?? []));
  });
  return out;
}

export async function runConsumer(consume) {
  const fn = REGISTRY.consumers[consume?.ext];
  if (fn) {
    try {
      await fn(consume);
    } catch (error) {
      warn(`consumer ${consume.ext}`, error);
    }
  }
}

export function extDefenseAdjust(attacker, defender, defenseType, ctx) {
  let total = 0;
  each(REGISTRY.defenseAdjust, 'defenseAdjust', fn => {
    total += Number(fn(attacker, defender, defenseType, ctx)) || 0;
  });
  return total;
}

export function extSpecializes(actor, skill, item, dataset) {
  let yes = false;
  each(REGISTRY.specializes, 'specializes', fn => {
    yes ||= !!fn(actor, skill, item, dataset);
  });
  return yes;
}

export function extDialogToggles(actor, ctx) {
  const toggles = [];
  each(REGISTRY.dialogToggles, 'dialogToggles', fn => toggles.push(...(fn(actor, ctx) ?? [])));
  return toggles;
}

export async function runApplyDialog(actor, options, ctx) {
  options.ext ??= {};
  await eachAsync(REGISTRY.applyDialog, 'applyDialog', fn => fn(actor, options, ctx));
}

export async function runPostRoll(actor, results, checkContext, extra) {
  await eachAsync(REGISTRY.postRoll, 'postRoll', fn => fn(actor, results, checkContext, extra));
}

export async function runHitRiders(actor, target, result, rider, tools) {
  await eachAsync(REGISTRY.hitRiders, 'hitRiders', fn => fn(actor, target, result, rider, tools));
}

export async function runDamageModifiers(actor, amount, damageType, ctx) {
  let value = amount;
  await eachAsync(REGISTRY.damageModifiers, 'damageModifiers', async fn => {
    const next = await fn(actor, value, damageType, ctx);
    if (Number.isFinite(next)) {
      value = Math.max(0, next);
    }
  });
  return value;
}

export async function runAfterDamage(actor, dealt, damageType, ctx) {
  await eachAsync(REGISTRY.afterDamage, 'afterDamage', fn => fn(actor, dealt, damageType, ctx));
}

export async function runTurnStart(actor, combat, context) {
  await eachAsync(REGISTRY.turnStart, 'turnStart', fn => fn(actor, combat, context));
}

export async function runTurnEnd(actor, combat, context) {
  await eachAsync(REGISTRY.turnEnd, 'turnEnd', fn => fn(actor, combat, context));
}

export async function runRoundStart(combat) {
  await eachAsync(REGISTRY.roundStart, 'roundStart', fn => fn(combat));
}

export async function runRest(actor) {
  await eachAsync(REGISTRY.rest, 'rest', fn => fn(actor));
}

export async function runSceneAdvanced(epoch) {
  await eachAsync(REGISTRY.sceneAdvanced, 'sceneAdvanced', fn => fn(epoch));
}

export async function runMissionAdvanced(epoch) {
  await eachAsync(REGISTRY.missionAdvanced, 'missionAdvanced', fn => fn(epoch));
}

export function runDerived(actor) {
  each(REGISTRY.derived, 'derived', fn => fn(actor));
}

export function runChatDecorators(message, element) {
  each(REGISTRY.chatDecorators, 'chatDecorators', fn => fn(message, element));
  for (const button of element?.querySelectorAll?.('[data-e20-ext]') ?? []) {
    if (button.dataset.e20ExtWired) {
      continue;
    }

    button.dataset.e20ExtWired = '1';
    button.addEventListener('click', async event => {
      event.preventDefault();
      const fn = REGISTRY.chatButtons[button.dataset.e20Ext];
      if (fn) {
        try {
          await fn(message, button);
        } catch (error) {
          warn(`chat button ${button.dataset.e20Ext}`, error);
        }
      }
    });
  }
}

export function findExtUse(item) {
  return REGISTRY.uses.find(use => {
    try {
      return use.matches(item);
    } catch (error) {
      return false;
    }
  }) ?? null;
}

export function extCostRules(actor = null) {
  if (!actor || !REGISTRY.costRuleProviders.length) {
    return REGISTRY.costRules;
  }

  const provided = [];
  each(REGISTRY.costRuleProviders, 'costRuleProviders', fn => provided.push(...(fn(actor) ?? [])));
  return [...REGISTRY.costRules, ...provided];
}

export async function runSpellCost(item, cost, dataset) {
  let value = cost;
  for (const fn of REGISTRY.spellCost) {
    try {
      const next = await fn(item, value, dataset);
      if (next === null) {
        return null;
      }

      if (Number.isFinite(next)) {
        value = Math.max(0, next);
      }
    } catch (error) {
      warn('spellCost', error);
    }
  }

  return value;
}

export function extNamedAction(key) {
  return REGISTRY.namedActions[key] ?? null;
}

/** For tests: what's registered. */
export function registrySnapshot() {
  return REGISTRY;
}
