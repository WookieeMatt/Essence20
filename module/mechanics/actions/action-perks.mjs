import { extCostRules, findExtUse } from "../item-hooks.mjs";
import { canUseCompanion, isCompanionUse } from "../companions/companion-uses.mjs";
import { commandIsMove } from "../companions/companions.mjs";
import { contactKindOf } from "../companions/contacts.mjs";
import { summonKindOf } from "../companions/summons.mjs";
import { teamKindOf } from "./team-actions.mjs";
import { isBondUse } from "../companions/bonded-partners.mjs";
import { CMD } from "./commands.mjs";
import { sourceOfOrUndefined as sourceOf } from "../../items/shared/item-lookups.mjs";
import { isUnarmedAttack } from "../../items/shared/unarmed-attacks.mjs";

// Issue Command and Loyal Minions' Use button (mechanics/actions/commands.mjs).
const isCommandUse = item => sourceOf(item) == CMD.issueCommand;
import { canUseKit, kitUseKind } from "../resources/kits.mjs";
import { canUseRider, isRiderUse } from "../combat/rider-uses.mjs";
import { canUseGrant, imperfectionOf, isGrantUse } from "../resources/grant-uses.mjs";
import { combineWeapons, isCombinedWeapon } from "./combined-weapons.mjs";
import { E20 } from "../../util/config.mjs";
import { getUses, markUsed } from "../resources/scene-clock.mjs";
import { isPowerAdaptationActive } from "../../items/forms/power-adaptation.mjs";
import { isWisdomOfTheEldersActive } from "../../items/forms/wisdom-of-the-elders.mjs";
import { ruleAttackCounts } from "../../rules/adapter.mjs";
import { contextFor, evaluate } from "../../rules/predicate.mjs";

/**
 * The Perks that bend the action economy.
 *
 * mechanics/actions/action-economy.mjs is the ledger - what an action costs and what is left. This file is
 * everything a Perk (or an Upgrade, a Feature, a Power) does to that: make one action cheaper, let
 * one Attack action make several attacks, hand out a free attack, or give an ally an action now or
 * on their next turn. action-economy.mjs calls in here; nothing in here writes the ledger itself,
 * which keeps the two apart the same way named-actions.mjs is kept apart from it.
 *
 * Three shapes, one table each:
 *
 * 1. COST_RULES - Perks that make some action cheaper (a Free action instead of a Standard one). Matched against what
 *    is being spent (a named action's key, or a kind such as 'attack' or 'conversion'). A rule the
 *    system can verify on its own applies automatically; one that depends on the fiction ("an
 *    action related to Kindness", "a Contingency that will be used to Attack") is OFFERED in a
 *    small dialog, and the player says whether it applies. Picking "normal cost" there is always
 *    possible, because using a once-per-turn discount on the wrong action would waste it.
 *
 * 2. ATTACK_RULES - Perks that let one Attack action make two (or more) attacks.
 *    The first qualifying attack pays for the Attack action; the rest ride on it for free (see
 *    action-economy.mjs#consumeForItem).
 *
 * 3. Use buttons - Perks that grant actions on demand (Motivate, Adrenaline Surge...). Listed in
 *    ACTION_PERK_USES and dispatched from banked-buffs.mjs#canUsePerk/onPerkUse like every other
 *    Perk with a Use control.
 *
 * Usage windows: "once per turn" and "once per round" are both counted on the turn's ledger - in
 * Essence20 an actor only acts on its own turn, so the two can't come apart. Once per scene uses
 * the scene clock (mechanics/resources/scene-clock.mjs), and once per encounter the encounter clock. "Per day"
 * is counted on the actor and given back by a Rest (resetDailyActionPerkUses).
 */

// (ACTION_PERK_IDS - Extra Attack, Rough and Tough, Bang Bang... - went with the AttackCount rules that replaced them:
// no COST_RULES / ATTACK_RULES entry used any of its ids. Audit fix 2026-10-07.)

/* -------------------------------------------- */
/*  Lookups                                     */
/* -------------------------------------------- */

/**
 * The actor's copy of an item by compendium source - any item type, since several of these are
 * Upgrades, Features, Powers or Spells rather than Perks (perks.mjs#findPerk only finds Perks).
 * An Upgrade counts wherever it sits: loose on the actor, or embedded as an attachment entry.
 * @param {Actor} actor
 * @param {String} uuid
 * @returns {Item|undefined}
 */
export function findSourced(actor, uuid) {
  // No id (a table entry that names one it never defined) matches nothing, not every unsourced item.
  if (!uuid) {
    return undefined;
  }

  return actor?.items?.find?.(item => item.flags?.core?.sourceId == uuid || item._stats?.compendiumSource == uuid || item?.flags?.essence20?.rulesSource == uuid);
}

export function hasSourced(actor, uuid) {
  return !!findSourced(actor, uuid);
}

/**
 * The weapon behind an attack - a Weapon Effect's parent Weapon, or null for a weaponless one.
 * Passed in by the caller where it's known; looked up by the Effect's own parentId flag otherwise.
 */
function parentWeaponOf(actor, item) {
  if (item?.type != 'weaponEffect') {
    return null;
  }

  const parentId = item.getFlag?.('essence20', 'parentId') ?? item.flags?.essence20?.parentId;
  return parentId ? actor?.items?.get?.(parentId) ?? null : null;
}

/**
 * The attack's own shape, for the rules that care which weapon is in hand.
 * @returns {{weapon: ?Item, traits: String[], skill: ?String, melee: Boolean, unarmed: Boolean, size: ?String}}
 */
export function describeAttack(actor, item, weapon = undefined) {
  const parent = weapon === undefined ? parentWeaponOf(actor, item) : weapon;
  return {
    weapon: parent,
    traits: parent?.system?.traits ?? [],
    skill: item?.system?.classification?.skill ?? null,
    melee: item?.system?.classification?.style == 'melee',
    // The shared definition: no weapon, or a printed unarmed one (items/shared/unarmed-attacks.mjs).
    unarmed: isUnarmedAttack(item, actor, weapon),
    // A weapon's size is its classification's (system.size never existed - Snap Shots' pistols were never recognised).
    size: parent?.system?.classification?.size ?? null,
  };
}

/* -------------------------------------------- */
/*  Cost ranking                                */
/* -------------------------------------------- */

// Cheapest first. 'twoFree' (Canny Combatant, Snap Shots) sits between one Free and a Move.
const COST_RANK = ['none', 'free', 'twoFree', 'move', 'standard', 'contingency', 'standardAndMove', 'fullAction', 'wholeTurn'];

function rank(actionType) {
  const index = COST_RANK.indexOf(actionType);
  return index < 0 ? COST_RANK.length : index;
}

/* -------------------------------------------- */
/*  1. Cost rules                               */
/* -------------------------------------------- */

/**
 * Each rule: {id, has(actor), matches(ctx), to(actionType, ctx, ledger, actor), limit?, ask?}.
 *   ctx      {key} for a named action (E20.namedActions), or {kind, item, attack} otherwise.
 *   to       the action type to pay instead; a rule that returns the same or a dearer type is
 *            simply not offered.
 *   limit    {window: 'turn'|'round'|'scene'|'encounter'|'day', max: Number|fn(actor)} - omitted = unlimited.
 *   ask      a localization key for the question the player answers - omitted = applies itself.
 *   blocks   rule ids this one shares a limit with (Mobility's once per turn covers Sprint AND Hide).
 */
const named = (...keys) => ctx => keys.includes(ctx?.key);
const kind = (...kinds) => ctx => kinds.includes(ctx?.kind);
const always = to => () => to;

export const COST_RULES = [
  // A Hint of Independence's Slow Conversion (Decepticon Directive, Table 2-11): converting takes a
  // whole turn's actions.
  { id: 'slowConversion', has: actor => imperfectionOf(actor)?.n == 6, matches: kind('conversion'), to: always('wholeTurn') },
  // Favorite Command (Animal Perk): commanding the pet in the chosen Skill is a Move action, not a
  // Standard one (for an Attack pet, commanding it to Attack).
  { id: 'favoriteCommand', has: actor => commandIsMove(actor), matches: named('commandPet'), to: always('move'), ask: 'E20.ActionPerkAskFavoriteCommand' },
  // (BFF's Free-action assist is an ActionCost rule on the Perk, limit key bffAssist - rules/conv15-items2.test.js.)
  // (Accelerate Conversion's Free-action Conversion is an ActionCost rule on the Perk, after its Use marks accelerateConvert.)
  // (Here To Help and Desperate Times are ActionCost rules reading the turn's ledger - self:actionLog:lendAssistance...:
  // rules/conv15-systems.test.js.)
  // A.I. / Autopilot / Computerized (GI Joe CRB, Vehicle Traits, p.172): the vehicle's computers
  // Lend Assistance as a Free action.
  {
    id: 'vehicleAssist', has: actor => actor?.type == 'vehicle' && ['ai', 'autopilot', 'computerized'].some(t => actor.system?.traits?.includes?.(t)),
    matches: named('lendAssistance'), to: always('free'),
  },
  // (Quick Fix, Quick Study, Swift Study, Rousing Presence and Quick Shield are ActionCost rules on their Perks - cost kinds
  // vehicleRepair, analyzeTarget, rouse, personalShield: rules/conv15-systems.test.js.)
  // (Sling is an ActionCost rule on the upgrade with always: true - its rules count while its weapon is stowed, which is
  // exactly when it gets drawn.)
  // (Snap Shots and Ground and Pound are rules on their Perks - self:actionLog:flag:snapShotWeapon, @ledger.perkUses.)
  // (Detail Oriented's Finesse Use a Skill as a Move action, three times a day, is an ActionCost rule on the Perk -
  // limit {per: day, key: detailOriented}, the counter Sensitive spends too: rules/conv12-slI12.test.js. Mobility and
  // Balance Your Enthusiasm are ActionCost rules as well: rules/conv14-systems.test.js.)
  // (Harmony Unleashed, the six "A Talent for <Spirit>" Perks and Talented are ActionCost rules on their items - action
  // any, to free / downgrade, the Talents' limit.freeIsUnlimited: rules/conv15-systems.test.js.)
];

/**
 * How many times a rule has been used in its window.
 */
const DAILY_FLAG = 'actionPerkDailyUses';

function usesOf(actor, rule, ledger) {
  if (!rule.limit) {
    return 0;
  }

  if (rule.limit.window == 'turn') {
    return ledger?.perkUses?.[rule.id] ?? 0;
  }

  if (rule.limit.window == 'day') {
    return actor?.getFlag?.('essence20', DAILY_FLAG)?.[rule.id] ?? 0;
  }

  if (rule.limit.window == 'round') {
    return roundUsesOf(actor, rule.id);
  }

  return getUses(actor, `actionPerk.${rule.id}`, rule.limit.window);
}

/* "Once per round" (the Talents - book check 2026-10-06, docs/rules-batches/book-limits.md): counted on the actor, stamped
   with the started combat and its round; outside a started combat it never runs out (as "per turn" with no ledger). */
const ROUND_FLAG = 'actionPerkRoundUses';

function roundStamp() {
  const combat = globalThis.game?.combat;
  return combat?.started ? { combatId: combat.id, round: combat.round } : null;
}

function roundUsesOf(actor, id) {
  const stamp = roundStamp();
  const record = actor?.getFlag?.('essence20', ROUND_FLAG)?.[id];
  return stamp && record && record.combatId == stamp.combatId && record.round == stamp.round ? Number(record.count) || 0 : 0;
}

/**
 * A Rest is the new day: every "per day" action discount is available again. Called from the
 * sheet's Rest action alongside the nanomite powers' own daily reset.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether anything had been used.
 */
export async function resetDailyActionPerkUses(actor) {
  const used = actor?.getFlag?.('essence20', DAILY_FLAG);
  if (!used || !Object.keys(used).length) {
    return false;
  }

  await actor.unsetFlag('essence20', DAILY_FLAG);
  return true;
}

function limitOf(actor, rule) {
  const max = rule.limit?.max;
  return typeof max == 'function' ? max(actor) : max ?? Infinity;
}

/**
 * Every cheaper way this actor could pay for this action right now.
 * @param {Actor} actor
 * @param {String} actionType   What the action normally costs.
 * @param {Object} ctx          {key} or {kind, item, attack}.
 * @param {Object} ledger       The actor's current ledger.
 * @returns {{auto: ?Object, offers: Object[]}}   Each option: {rule, actionType, label, question}.
 */
export function getCostOptions(actor, actionType, ctx, ledger) {
  const options = [];
  const asking = promptsEnabled();
  for (const rule of [...COST_RULES, ...extCostRules(actor)]) {
    if (!rule.has(actor) || !rule.matches(ctx)) {
      continue;
    }

    if (rule.ask && !asking) {
      continue;
    }

    const to = rule.to(actionType, ctx, ledger, actor);
    if (!to || rank(to) >= rank(actionType)) {
      continue;
    }

    // A Talent's "Free actions ... take no actions" has no once-per-round cap; only its
    // Standard->Move and Move->Free halves do.
    const limited = rule.limit && !(rule.limit.freeIsUnlimited && actionType == 'free');
    if (limited && usesOf(actor, rule, ledger) >= limitOf(actor, rule)) {
      continue;
    }

    // The same question for the same cost is one offer, not two (two rules asking the same thing - Favorite Command's
    // WTNV printing once carried a commander-side ActionCost beside the code entry above).
    if (rule.ask && options.some(option => option.rule.ask == rule.ask && option.actionType == to)) {
      continue;
    }

    options.push({
      rule, actionType: to, counts: !!limited,
      label: labelFor(actor, rule),
      question: rule.ask ? game.i18n.localize(rule.ask) : null,
    });
  }

  options.sort((a, b) => rank(a.actionType) - rank(b.actionType));
  const auto = options.find(option => !option.question) ?? null;
  const offers = options.filter(option => option.question && (!auto || rank(option.actionType) < rank(auto.actionType)));
  return { auto, offers };
}

// The per-client "ask me about situational discounts" switch - see settings.js. On unless turned off.
function promptsEnabled() {
  try {
    return game.settings.get('essence20', 'actionPerkPrompts') !== false;
  } catch {
    return true;
  }
}

function labelFor(actor, rule) {
  if (rule.label) {
    return rule.label;
  }

  return game.i18n.localize(`E20.ActionPerk.${rule.id}`);
}

function costLabel(actionType) {
  if (actionType == 'twoFree') {
    return game.i18n.localize('E20.ActionTypeTwoFree');
  }

  if (actionType == 'none') {
    return game.i18n.localize('E20.ActionPerkNoCost');
  }

  return game.i18n.localize(E20.actionTypes[actionType] ?? actionType);
}

/**
 * Decide what this action actually costs, asking the player when a cheaper option depends on the
 * fiction. Returns null when the player closes the dialog - the action isn't taken at all.
 * @returns {Promise<{actionType: String, option: ?Object}|null>}
 */
export async function resolveCost(actor, actionType, ctx, ledger) {
  const { auto, offers } = getCostOptions(actor, actionType, ctx, ledger);
  if (!offers.length) {
    return { actionType: auto?.actionType ?? actionType, option: auto };
  }

  const base = auto ?? { actionType, rule: null, label: null };
  const buttons = [
    {
      action: 'base', default: true,
      label: base.rule
        ? game.i18n.format('E20.ActionPerkPayVia', { cost: costLabel(base.actionType), source: base.label })
        : game.i18n.format('E20.ActionPerkPayNormal', { cost: costLabel(actionType) }),
    },
    ...offers.map((offer, index) => ({
      action: `offer${index}`,
      label: game.i18n.format('E20.ActionPerkPayVia', { cost: costLabel(offer.actionType), source: offer.label }),
    })),
  ];
  const questions = offers.map(offer => `<li><b>${foundry.utils.escapeHTML(offer.label)}:</b> ${offer.question}</li>`).join('');

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ActionPerkDialogTitle') },
    classes: ["window-app", "e20-window"],
    position: { width: 420 },
    content: `<p>${game.i18n.format('E20.ActionPerkDialogIntro', { name: actor.name })}</p><ul>${questions}</ul>`,
    buttons,
    rejectClose: false,
  });

  if (!choice) {
    return null;
  }

  if (choice == 'base') {
    return { actionType: base.actionType, option: base.rule ? base : null };
  }

  const offer = offers[Number(choice.replace('offer', ''))];
  return { actionType: offer.actionType, option: offer };
}

/**
 * Count one use of the rule that paid for an action. Turn-window uses go on the ledger the caller is
 * about to write; scene/encounter uses are stamped on the actor.
 */
export async function recordRuleUse(actor, option, ledger) {
  if (!option?.rule || !option.counts) {
    return;
  }

  const { rule } = option;
  if (rule.limit.window == 'turn') {
    ledger.perkUses = { ...(ledger.perkUses ?? {}), [rule.id]: (ledger.perkUses?.[rule.id] ?? 0) + 1 };
    return;
  }

  if (rule.limit.window == 'day') {
    const used = actor.getFlag?.('essence20', DAILY_FLAG) ?? {};
    await actor.setFlag('essence20', DAILY_FLAG, { ...used, [rule.id]: (used[rule.id] ?? 0) + 1 });
    return;
  }

  if (rule.limit.window == 'round') {
    const stamp = roundStamp();
    if (stamp) {
      await actor.setFlag('essence20', `${ROUND_FLAG}.${rule.id}`, { ...stamp, count: roundUsesOf(actor, rule.id) + 1 });
    }

    return;
  }

  await markUsed(actor, `actionPerk.${rule.id}`, { window: rule.limit.window });
}

/* -------------------------------------------- */
/*  2. Several attacks per Attack action        */
/* -------------------------------------------- */

/**
 * Each: {id, count(actor) -> total attacks, has(actor), filter}. count is the TOTAL number of
 * attacks one Attack action makes; filter (see attackMatchesFilter) says which weapons it works
 * with, and the free attacks that follow must match it too. The best one applies.
 */
export const ATTACK_RULES = [
  // Extra Attack (both), Rough and Tough, Bang Bang / Bang Bang Bang, Throwing Lead, Blink of an Eye and
  // the Zord Extra Attack are AttackCount item rules now (rules/adapter.mjs#ruleAttackCounts).
  // (Bullet Barrage and Chrono-Trigger are AttackCount item rules too.)
  // Power Adaptation - Fast Trigger (Across the Stars, p.57): "Make one additional ranged Attack per
  // Attack action"; Wisdom of the Elders - Ferocious Strikes (Through the Shattered Grid, p.73): "one
  // additional melee Attack per Attack action". While switched on; they add to Extra Attack rather
  // than competing with it.
  { id: 'fastTrigger', additional: 1, has: actor => isPowerAdaptationActive(actor, 'fastTrigger'), filter: { ranged: true } },
  { id: 'ferociousStrikes', additional: 1, has: actor => isWisdomOfTheEldersActive(actor, 'ferociousStrikes'), filter: { melee: true } },
];

/**
 * How many attacks one Attack action makes with this attack, and what grants it.
 * @returns {{count: Number, source: ?String}}
 */
export function getAttacksPerAction(actor, item, attack = describeAttack(actor, item)) {
  let best = { count: 1, source: null, filter: null };
  const extras = [];
  for (const rule of ATTACK_RULES) {
    if (!rule.has(actor) || !attackMatchesFilter(rule.filter, attack)) {
      continue;
    }

    if (rule.additional) {
      extras.push(rule);
      continue;
    }

    const count = rule.count(actor);
    if (count > best.count) {
      best = { count, source: rule.label ?? rule.id, filter: rule.filter };
    }
  }

  // AttackCount item rules (rules/adapter.mjs#ruleAttackCounts) - the same "best count, then extras".
  for (const granted of ruleAttackCounts(actor, item)) {
    // The rule's own condition is the filter the chained attacks must match too (plain data - it's
    // kept in the turn ledger).
    const filter = granted.when ? { when: granted.when } : null;
    if (granted.additional) {
      extras.push({ additional: granted.additional, ruleLabel: granted.label, filter });
    } else if (granted.count > best.count) {
      best = { count: granted.count, source: granted.label, filter };
    }
  }

  for (const rule of extras) {
    best = {
      count: best.count + rule.additional,
      source: best.source ?? rule.ruleLabel ?? game.i18n.localize(`E20.ActionPerk.${rule.id}`),
      filter: best.filter ?? rule.filter,
    };
  }

  return best;
}

/**
 * Whether a free attack (a chain from the Attack action, or a granted bonus attack) can be spent
 * on this attack.
 * @param {Object} filter   {ballistic, melee, unarmed, might, silentMartialArts} - all optional.
 */
/** A weapon effect shaped enough for item:/weapon:/attack: tags, from describeAttack's summary. */
function attackStandIn(attack) {
  const weapon = attack.weapon ?? null;
  return {
    type: 'weaponEffect',
    flags: { essence20: { parentId: weapon?.id ?? null } },
    parent: { items: { get: id => (weapon && id == weapon.id ? weapon : null) } },
    system: { classification: { style: attack.melee ? 'melee' : 'ranged', skill: attack.skill } },
  };
}

export function attackMatchesFilter(filter, attack) {
  if (!filter || !attack) {
    return true;
  }

  const checks = {
    ballistic: () => attack.traits.includes('ballistic'),
    ballisticOrComputerized: () => ['ballistic', 'computerized'].some(t => attack.traits.includes(t)),
    melee: () => attack.melee,
    ranged: () => !attack.melee,
    mightOrFinesse: () => ['might', 'finesse'].includes(attack.skill),
    unarmed: () => attack.unarmed,
    mightMelee: () => attack.melee && attack.skill == 'might',
    silentMartialArts: () => attack.traits.includes('silent') && attack.traits.includes('martialArts'),
    // An AttackCount rule's condition, asked of a stand-in for this attack (its weapon, style and skill).
    // Anything the attack alone can't answer (who's rolling) doesn't refuse it.
    when: () => evaluate(filter.when, contextFor({ item: attackStandIn(attack), isAttack: true, isMelee: attack.melee, combat: null })) !== false,
  };

  return Object.entries(filter).every(([key, wanted]) => !wanted || !checks[key] || checks[key]());
}

/* -------------------------------------------- */
/*  Timed switches                              */
/* -------------------------------------------- */


/* -------------------------------------------- */
/*  3. Use buttons                              */
/* -------------------------------------------- */

/**
 * Perks whose Use button grants actions. `self` grants go to the user of the Perk; `targetOrSelf` to the
 * targeted token, or the user with nothing targeted.
 *
 *   cost        what using the Perk itself costs (a named action type), if anything
 *   bonusAttack a free attack granted now: {cost, filter}
 *   limit       {window, max}
 *   available   fn(actor) - extra precondition for the button to show
 */
export const ACTION_PERK_USES = {
  // (Motivate, Mobilize, Momentum and Shoot, You Fools! are Use rules on the Perks - rules/conv14-systems.test.js.)
  // (New Plan and Barrage Attack are Use rules on their items - @ledger.lastTurnContingency, @rangedWeapons.)
  // (Laughtracting is a Use rule and Distraughter a hit Trigger rule on their Perks - rules/conv15-systems.test.js.)
  // (Beatdown, Jackhammer, Motor Lancer, Explosive Ammo, Kitbash Upgrade, Knuckle Up, HUD... - weapons changed for a while -
  // are their items' own Use rules: rules/conv17-Split1.test.js and earlier.)
};

// Set by action-economy.mjs so this file doesn't import it back (the two would be circular).
let economy = null;
export function bindEconomy(api) {
  economy = api;
}

// A weapon with the Combined trait gets a Use button to combine with allies (combined-weapons.mjs).
const COMBINE_USE = { id: 'combine', target: 'self', custom: 'combine', outOfCombat: true };

// Checkmate, Suppressing Fire, poisons, Jammer and the rest of mechanics/combat/target-riders.mjs's table.
const RIDER_USE = { id: 'rider', target: 'self', custom: 'rider', outOfCombat: true };

// Free picks, Role Perks from elsewhere, made-on-the-spot items and lights - mechanics/resources/grants.mjs.
const GRANT_USE = { id: 'grant', target: 'self', custom: 'grant', outOfCombat: true };

// Kits used up, scrounged or re-specialized, and the gear that heals or recharges - mechanics/resources/kits.mjs.
const KIT_USE = { id: 'kit', target: 'self', custom: 'kit', outOfCombat: true };

// Pets, drones, Mini-Cons and companions (mechanics/companions/companions.mjs); Contacts (contacts.mjs); personal
// vehicles, Battlizers and summons (summons.mjs); team Perks (team-actions.mjs); bonded partners
// (bonded.mjs). (The BFF Perk's pick is its own Use rule.)
const COMPANION_USE = { id: 'companion', target: 'self', custom: 'companion', outOfCombat: true };
const CONTACT_USE = { id: 'contact', target: 'self', custom: 'contact', outOfCombat: true };
const SUMMON_USE = { id: 'summon', target: 'self', custom: 'summon', outOfCombat: true };
const TEAM_USE = { id: 'team', target: 'self', custom: 'team', outOfCombat: true };
const BOND_USE = { id: 'bond', target: 'self', custom: 'bond', outOfCombat: true };
const COMMAND_USE = { id: 'issueCommand', target: 'self', custom: 'issueCommand', outOfCombat: true };
// Extension Use buttons (mechanics/item-hooks.mjs#registerUse).
const EXT_USE = { id: 'ext', target: 'self', custom: 'ext', outOfCombat: true };

function useFor(item) {
  return ACTION_PERK_USES[sourceOf(item)] ?? (isCombinedWeapon(item) ? COMBINE_USE : null)
    ?? (isRiderUse(item) ? RIDER_USE : null)
    ?? (isGrantUse(item) ? GRANT_USE : null)
    ?? (kitUseKind(item) ? KIT_USE : null)
    ?? (isCompanionUse(item) ? COMPANION_USE : null)
    ?? (contactKindOf(item) ? CONTACT_USE : null)
    ?? (summonKindOf(item) ? SUMMON_USE : null)
    ?? (teamKindOf(item) ? TEAM_USE : null)
    ?? (isBondUse(item) ? BOND_USE : null)
    ?? (isCommandUse(item) ? COMMAND_USE : null)
    ?? (findExtUse(item) ? EXT_USE : null);
}

export function isActionPerkUse(item) {
  return !!useFor(item);
}

function usesKey(use) {
  return `actionPerkUse.${use.id}`;
}

function useCount(actor, use) {
  if (!use.limit) {
    return 0;
  }

  return use.limit.window == 'turn'
    ? (economy?.getLedger(actor)?.perkUses?.[usesKey(use)] ?? 0)
    : getUses(actor, usesKey(use), use.limit.window);
}

/**
 * Whether the Use button shows. Only in combat - every one of these is about turns and actions.
 */
export function canUseActionPerk(item) {
  const use = useFor(item);
  const actor = item?.parent;
  if (!use || !actor || (!game?.combat && !use.outOfCombat)) {
    return false;
  }

  if (use.available && !use.available(actor)) {
    return false;
  }

  if (use.custom == 'rider') {
    return canUseRider(item);
  }

  if (use.custom == 'grant') {
    return canUseGrant(item);
  }

  if (use.custom == 'kit') {
    return canUseKit(item);
  }

  if (use.custom == 'companion') {
    return canUseCompanion(item);
  }

  if (use.custom == 'ext') {
    const ext = findExtUse(item);
    return !ext?.canUse || !!ext.canUse(item);
  }

  return !use.limit || useCount(actor, use) < use.limit.max;
}

/**
 * Run a Perk's Use button. Returns the chat line to post, or null if nothing happened.
 */
export async function useActionPerk(item) {
  const use = useFor(item);
  const actor = item?.parent;
  if (!use || !actor || !economy) {
    return null;
  }

  if (use.target == 'enemy' && !game.user?.targets?.size) {
    ui.notifications.warn(game.i18n.format('E20.ActionPerkNeedsTarget', { perk: item.name }));
    return null;
  }

  let recipient = actor;
  if (use.target == 'targetOrSelf') {
    recipient = game.user?.targets?.first?.()?.actor ?? actor;
  }

  if (use.powerCost) {
    const value = Number(actor.system?.powers?.personal?.value) || 0;
    if (value < use.powerCost) {
      ui.notifications.warn(game.i18n.format('E20.ActionPerkNoPower', { name: actor.name }));
      return null;
    }

    await actor.update({ 'system.powers.personal.value': value - use.powerCost });
  }

  if (use.cost) {
    const paid = await economy.spend(actor, use.cost, { source: item.name });
    if (paid.blocked) {
      return null;
    }
  }

  if (use.custom == 'rider') {
    const { useRider } = await import("../combat/target-riders.mjs");
    return useRider(item, economy);
  }

  if (use.custom == 'grant') {
    const { runGrant } = await import("../resources/grants.mjs");
    return runGrant(item, economy);
  }

  if (use.custom == 'kit') {
    const { runKitUse } = await import("../resources/kits.mjs");
    return runKitUse(item, economy);
  }

  if (use.custom == 'companion') {
    const { runCompanionUse } = await import("../companions/companions.mjs");
    return runCompanionUse(item, economy);
  }

  if (use.custom == 'contact') {
    const { runContactUse } = await import("../companions/contacts.mjs");
    return runContactUse(item, economy);
  }

  if (use.custom == 'summon') {
    const { runSummonUse } = await import("../companions/summons.mjs");
    return runSummonUse(item, economy);
  }

  if (use.custom == 'team') {
    const { runTeamUse } = await import("./team-actions.mjs");
    return runTeamUse(item, economy);
  }

  if (use.custom == 'bond') {
    const { runBondUse } = await import("../companions/bonded-partners.mjs");
    const pay = async (cost) => !cost || !game.combat || !(await economy.spend(actor, cost, { source: item.name })).blocked;
    return runBondUse(item, pay);
  }

  if (use.custom == 'ext') {
    const ext = findExtUse(item);
    // context: the named action a Use rule's cost is for (cost.kind - Rouse), for the economy's cost changers.
    const pay = async (cost, context = null) => !cost || !game.combat || !(await economy.spend(actor, cost, { source: item.name, ...(context ? { context } : {}) })).blocked;
    return ext ? ext.run(item, economy, pay) : null;
  }

  if (use.custom == 'issueCommand') {
    const { issueCommand } = await import("./commands.mjs");
    const pay = async (cost) => !cost || !game.combat || !(await economy.spend(actor, cost, { source: item.name })).blocked;
    return issueCommand(actor, { pay });
  }

  if (use.custom == 'combine') {
    return combineWeapons(actor, item, economy);
  }

  const granted = [];
  if (use.bonusAttack) {
    const count = typeof use.bonusAttack.count == 'function' ? use.bonusAttack.count(actor) : use.bonusAttack.count ?? 1;
    for (let i = 0; i < count; i++) {
      await economy.grantBonusAttack(recipient, { source: item.name, cost: use.bonusAttack.cost, filter: use.bonusAttack.filter ?? null });
    }

    granted.push(game.i18n.format(count > 1 ? 'E20.ActionPerkBonusAttacks' : 'E20.ActionPerkBonusAttack', { count }));
  }

  if (use.selfStatus && !actor.statuses?.has?.(use.selfStatus)) {
    await actor.toggleStatusEffect?.(use.selfStatus, { active: true });
  }

  if (use.limit) {
    if (use.limit.window == 'turn') {
      await economy.markTurnUse(actor, usesKey(use));
    } else {
      await markUsed(actor, usesKey(use), { window: use.limit.window });
    }
  }

  return game.i18n.format(recipient.id == actor.id ? 'E20.ActionPerkUsedSelf' : 'E20.ActionPerkUsedAlly', {
    name: actor.name, perk: item.name, ally: recipient.name, grant: granted.join(', '),
  });
}

// (Relentless Blows' two unarmed strikes are its own powerUsed rule - rules/conv15-systems.test.js.)

/* -------------------------------------------- */
/*  Lend Assistance variants                    */
/* -------------------------------------------- */

// (Here, Let Me's and No, I Insist's next-turn grants are Assist {effect: nextTurnGrant} rules -
// rules/plugins/rolls/assist-next-turn.mjs, read by lend-assistance.mjs.)

// (What Secret Helper costs the helper next turn - and Subtle / Stealth Helper's lighter prices - is grantNextTurn steps
// on its CardOffer rule.)
