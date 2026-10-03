import { creatureTagsOf } from "../helpers/creature-tags.mjs";
import { isExpired } from "./expiry.mjs";

/**
 * The `when` condition language for item rules (docs/RULES_ENGINE_PLAN.md §5.1).
 *
 * A rule's `when` is a list of tags that must all hold. An entry can also be `{any: [...]}` (at
 * least one holds) or a string starting `not:` (the tag doesn't hold).
 *
 * Every tag answers one of three ways:
 *  - true / false - known;
 *  - null - unknown. An `ask:` tag is always unknown, and so is any tag this file doesn't know.
 *    An unknown condition is never guessed: the rule is offered as a Roll Options Dialog switch
 *    instead (rules/adapter.mjs), and the player decides.
 *
 * Evaluated against a context built by contextFor() - the same facts the roll pipeline already
 * hands the extension hooks (helpers/extensions.mjs), so nothing new is computed per roll.
 *
 * Plain Node safe: no Foundry globals at import time, so the CI validator and Jest can use TAGS.
 */

/** Tag families for the editor's picker and the validator. `param` is what follows the prefix. */
export const TAGS = {
  // The roll
  'skill': { family: 'roll', param: 'skill' },
  'essence': { family: 'roll', param: 'essence' },
  'attack': { family: 'roll', param: 'attackKind', optionalParam: true },
  'defense': { family: 'roll', param: 'defense' },
  'roll': { family: 'roll', param: 'rollKind' },
  // The item being used for the roll
  'item': { family: 'item', param: 'itemTag' },
  // The item an Upgrade attaches to (prerequisites)
  'host': { family: 'item', param: 'itemTag' },
  // The weapon a rolled weapon effect belongs to
  'weapon': { family: 'item', param: 'itemTag' },
  // The item carrying the rule (its own stored values)
  'rule': { family: 'self', param: 'ruleTag' },
  // The rule's own actor
  'self': { family: 'self', param: 'selfTag' },
  // The actor holding the rule's item - another actor for an aura / party / vehicle Trigger
  'holder': { family: 'self', param: 'holderTag' },
  // The other side: the roll's target, or for an `incoming` rule, the roller
  'target': { family: 'target', param: 'targetTag' },
  // The situation
  'combat': { family: 'situation', optionalParam: true },
  'vehicle': { family: 'situation', param: 'vehicleTag' },
  'ally': { family: 'situation', param: 'distance' },
  'enemy': { family: 'situation', param: 'distance' },
  'scene': { family: 'situation', param: 'sceneTag' },
  'terrain': { family: 'situation', param: 'terrain' },
  'environment': { family: 'situation', param: 'environment' },
  'ownTurn': { family: 'situation' },
  // Which kind of Lend Assistance a lendAssistance / assisted Trigger answers
  'assist': { family: 'roll', param: 'assistKind' },
  // The hit a damage Trigger answers
  'damage': { family: 'roll', param: 'damageTag' },
  // Who set a mark (step mark): on this actor by the other party, or on the other party by this actor
  'markedBy': { family: 'roll', param: 'key' },
  'markedByMe': { family: 'roll', param: 'key' },
  // A named test the system's own code answers (CHECKS below) - state that lives in a helper, not data
  'check': { family: 'situation', param: 'check' },
  'ask': { family: 'ask', param: 'text' },
};

/** Tags whose answer doesn't depend on the roll - safe to evaluate in derived data. */
export const STATIC_FAMILIES = ['self', 'situation'];

/**
 * Builds the evaluation context. Every field is optional; a tag whose fact is missing answers false
 * (for a fact that's simply absent, like no target) - never null, which is reserved for "can't know".
 * @param {Object} parts
 * @param {Actor} parts.self        The rule's own actor.
 * @param {Item} [parts.ruleItem]   The item carrying the rule.
 * @param {Actor} [parts.other]     The target (self scope) or the roller (incoming scope).
 * @param {Item} [parts.item]       The item the roll is made with.
 * @param {String} [parts.rolledSkill]
 * @param {String} [parts.rolledEssence]
 * @param {Boolean} [parts.isAttack]
 * @param {Boolean} [parts.isMelee]
 * @param {String} [parts.defenseType]
 * @param {Object} [parts.dataset]
 * @param {Object} [parts.combat]   game.combat, passed in so tests don't need globals.
 * @returns {Object}
 */
export function contextFor(parts = {}) {
  return { ...parts, combat: parts.combat === undefined ? globalThis.game?.combat ?? null : parts.combat };
}

const lower = value => String(value ?? '').toLowerCase();

function itemTraits(item) {
  const own = item?.system?.traits;
  const parent = item?.flags?.essence20?.parentId ? item.parent?.items?.get?.(item.flags.essence20.parentId) : null;
  return new Set([...(Array.isArray(own) ? own : []), ...(Array.isArray(parent?.system?.traits) ? parent.system.traits : [])].map(lower));
}

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
}

function hasItem(actor, uuid) {
  const items = actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);
  return items.some(item => sourceOf(item) == uuid || item.uuid == uuid);
}

function statusOf(actor, status) {
  return !!actor?.statuses?.has?.(status);
}

const isArea = item => !!(item?.system?.shape || Number(item?.system?.radius) > 0);

/** Distance in feet between two actors' first tokens, or null off the canvas. */
export function feetBetween(a, b) {
  const ta = a?.getActiveTokens?.()?.[0];
  const tb = b?.getActiveTokens?.()?.[0];
  if (!ta || !tb || !globalThis.canvas?.grid?.measurePath) {
    return null;
  }

  return globalThis.canvas.grid.measurePath([ta.center, tb.center]).distance;
}

/**
 * The actors of the given side (same disposition as self, or the opposite) whose tokens are within
 * range. Empty off the canvas.
 * @param {Actor} self
 * @param {Number} feet
 * @param {String} side   'ally' or 'enemy'
 * @returns {Array<Actor>}
 */
export function sideActorsWithin(self, feet, side) {
  // Allies the way the rest of the system counts them (helpers/allies.mjs#getNearbyAllyTokens):
  // Frenemy, Betrayal and Ally Awareness included.
  if (side == 'ally' && worldLookups.alliesWithin) {
    return [...new Set(worldLookups.alliesWithin(self, feet).filter(actor => actor && actor !== self))];
  }

  const own = self?.getActiveTokens?.()?.[0];
  const tokens = globalThis.canvas?.tokens?.placeables;
  if (!own || !Array.isArray(tokens)) {
    return [];
  }

  const mine = own.document?.disposition ?? 0;
  const found = new Set();
  for (const token of tokens) {
    if (!token.actor || token.actor === self || token === own || found.has(token.actor)) {
      continue;
    }

    const theirs = token.document?.disposition ?? 0;
    const match = side == 'any' || (side == 'ally' ? theirs == mine : theirs != mine && theirs != 0);
    const distance = match ? feetBetween(self, token.actor) : null;
    if (distance !== null && distance <= feet) {
      found.add(token.actor);
    }
  }

  return [...found];
}

/** Whether any token of the given side is within range. */
function sideWithin(self, feet, side) {
  return sideActorsWithin(self, feet, side).length > 0;
}

/**
 * Whether an actor carries a mark (the `mark` rule step, flags.essence20.ruleMarks.<key>) that
 * hasn't run out.
 */
export function markOf(actor, key) {
  const mark = actor?.flags?.essence20?.ruleMarks?.[key];
  return !!mark && !isExpired(mark);
}

/**
 * Where an actor is: its terrain (an E20.environments biome key, or null when nothing set one) and
 * its environment ("normal", "lowGravity", "vacuum"...). Read through lookups the system hands in at
 * start-up (essence20.mjs, from helpers/environment.mjs) - that file extends Foundry classes, so it
 * can't be imported here, where plain Node has to load.
 */
let worldLookups = {};
export function setWorldLookups(lookups) {
  worldLookups = { ...worldLookups, ...lookups };
}

/**
 * Named checks: `check:<name>` (or `check:<name>:<option>`; also `self:check:`, `target:check:`) asks a
 * test the system's own code answers - a toggle a helper keeps, an aura it measures. The names are
 * fixed here so the validator knows them; essence20.mjs registers what each one runs, as
 * (actor, option, ctx) => true / false / null. An unregistered one is unknown (null).
 */
export const CHECK_NAMES = [
  'environmentalExpertise', 'cannoneerDugIn', 'bulwark', 'rushTheLine', 'sprinterBoost', 'skiing', 'nearbyDefeatedAlly',
  'frictionlessMovement', 'gravityOptional', 'wisdomOfTheElders', 'monsterForm', 'warriorMode', 'powerAdaptation',
  'highGear', 'theToughGetGoing', 'energyAffinityAttack', 'equippedFireWeapon',
  'defeatedAllyInReach', 'decepticonNemesis', 'nemesisInScene', 'multipleTargetsWeapon', 'favoriteWeaponEquipped',
  'favoriteWeaponRolled', 'zordHasDriver', 'personalShield',
];
const CHECKS = new Map();
export function registerCheck(name, fn) {
  if (!CHECK_NAMES.includes(name)) {
    throw new Error(`Essence20 | unknown rule check "${name}" - add it to CHECK_NAMES`);
  }

  CHECKS.set(name, fn);
}

function runCheck(rest, actor, ctx) {
  const [name, ...option] = rest.split(':');
  const fn = CHECKS.get(name);
  if (!fn || !actor) {
    return null;
  }

  try {
    const answer = fn(actor, option.join(':') || undefined, ctx);
    return answer === null || answer === undefined ? null : !!answer;
  } catch (error) {
    console.error(`Essence20 | rule check "${name}" failed`, error);
    return null;
  }
}

/** The vehicle or Zord an actor is crewing, and how (read lazily - rules/links.mjs). */
let crewLookup = null;
export function setCrewLookup(fn) {
  crewLookup = fn;
}

/** Compare `a op b` for "level>=5"-style tags. */
function compare(a, op, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }

  return { '>=': x >= y, '<=': x <= y, '>': x > y, '<': x < y, '=': x == y }[op] ?? false;
}

/**
 * `data:<path>` (truthy), or `data:<path><op><value>` with >=, <=, >, <, = or != - any stored
 * value on an actor or item: `self:data:system.energon.dark.value>0`, `item:data:system.isPoison`.
 * Numbers compare as numbers, anything else as text. The value may be another stored value on the
 * same document, written `$path`: `self:data:system.power.value<$system.power.max`. Undefined when
 * the tag isn't a data tag.
 */
function dataTag(doc, rest) {
  const match = /^data:([\w.-]+?)(?:(>=|<=|!=|>|<|=)(.*))?$/.exec(rest);
  if (!match) {
    return undefined;
  }

  const read = path => path.split('.').reduce((at, key) => (at === null || at === undefined ? at : at[key]), doc);
  const value = read(match[1]);
  if (!match[2]) {
    return !!value;
  }

  if (match[3]?.startsWith('$')) {
    match[3] = String(read(match[3].slice(1)) ?? '');
  }

  if (match[2] == '=' || match[2] == '!=') {
    const same = Number.isFinite(Number(value)) && Number.isFinite(Number(match[3])) && match[3] !== ''
      ? Number(value) == Number(match[3]) : lower(value) == lower(match[3]);
    return match[2] == '=' ? same : !same;
  }

  return compare(value, match[2], match[3]);
}

/** Skill shifts by trained rank, untrained first; and actor sizes, smallest first. */
export const SKILL_RANKS = ['d20', 'd2', 'd4', 'd6', 'd8', 'd10', 'd12', '2d8', '3d6'];

/** Ranks above untrained in a Skill, plus one for a Specialization (combat.mjs#getSkillRanks). */
function skillRanksOf(actor, skill) {
  const data = actor?.system?.skills?.[skill];
  return Math.max(0, SKILL_RANKS.indexOf(data?.shift ?? 'd20')) + (data?.isSpecialized ? 1 : 0);
}

/** Availability tiers, cheapest first. */
export const AVAILABILITY_TIERS = ['automatic', 'standard', 'limited', 'restricted', 'prototype', 'unique', 'theoretical', 'other'];

/** Armor classifications, lightest first (E20.armorClassifications). */
export const ARMOR_CLASSES = ['non', 'light', 'medium', 'heavy', 'ultraHeavy'];

export const SIZES = ['small', 'common', 'large', 'long', 'huge', 'extended', 'gigantic', 'extended2', 'towering', 'extended3', 'titanic'];

/**
 * sizeDiff<op>N: how many places one actor's size sits above another's in SIZES (the same index
 * compare the hand-written size Perks use). Undefined when the tag isn't one; null when either size is unknown.
 */
/** An actor's combatant in a combat. */
function combatantOf(combat, actor) {
  const list = combat?.combatants?.contents ?? (combat?.combatants ? [...combat.combatants] : []);
  return actor ? list.find(c => c.actor === actor || (!!actor.uuid && c.actor?.uuid == actor.uuid)) ?? null : null;
}

/**
 * Turn order and level, between this actor and the other party (undefined when the tag isn't one):
 *   notActed           this actor's turn comes later this round than the current one (in any combat)
 *   levelDiff>=N       this actor's level (Threat Level for an NPC) minus the other party's
 */
function versusTag(rest, actor, other, combat) {
  if (rest == 'notActed') {
    const mine = combatantOf(combat, actor);
    return !!combat && !!mine && (combat.turns ?? []).indexOf(mine) > Number(combat.turn ?? -1);
  }

  const level = /^levelDiff(>=|<=|>|<|=)(-?\d+)$/.exec(rest);
  if (level) {
    const levelOf = who => Number(who?.system?.level ?? who?.system?.threatLevel ?? 0) || 0;
    return actor && other ? compare(levelOf(actor) - levelOf(other), level[1], level[2]) : null;
  }

  return undefined;
}

function sizeDiff(rest, actor, other) {
  const match = /^sizeDiff(>=|<=|>|<|=)(-?\d+)$/.exec(rest);
  if (!match) {
    return undefined;
  }

  const mine = SIZES.indexOf(actor?.system?.size);
  const theirs = SIZES.indexOf(other?.system?.size);
  return mine < 0 || theirs < 0 ? null : compare(mine - theirs, match[1], match[2]);
}

/**
 * The facts prerequisites ask about (docs/PREREQUISITES_PLAN.md §2), on an actor:
 *   skill:<key>>=<die>   a Skill's trained rank (d20 untrained ... d12, 2d8, 3d6); also <=, >, <, =
 *   essence:<key>>=N     an Essence score
 *   size>=<size>         size class (small ... titanic)
 *   has:<name>           owns an item of that name, any printing
 *   hasType:<type>:<name>  the same, of that item type only
 *   count:<type>>=N      how many items of a type (alteration, contact, perk...)
 *   trained:<group>.<key>  Trained in it (system.trained.armors.heavy, weapons.<type>...)
 * Undefined when the tag isn't one of these.
 */
function prerequisiteTag(actor, rest) {
  const skill = /^skill:([\w-]+)(>=|<=|>|<|=)(\w+)$/.exec(rest);
  if (skill) {
    const have = SKILL_RANKS.indexOf(actor.system?.skills?.[skill[1]]?.shift ?? 'd20');
    const need = SKILL_RANKS.indexOf(skill[3]);
    return need < 0 ? null : compare(Math.max(0, have), skill[2], need);
  }

  const essence = /^essence:([\w-]+)(>=|<=|>|<|=)(\d+)$/.exec(rest);
  if (essence) {
    const value = actor.system?.essences?.[essence[1]];
    return compare(typeof value == 'object' ? value?.max ?? value?.value : value, essence[2], essence[3]);
  }

  const size = /^size(>=|<=|>|<|=)(\w+)$/.exec(rest);
  if (size) {
    const need = SIZES.indexOf(size[2]);
    return need < 0 ? null : compare(SIZES.indexOf(actor.system?.size ?? 'common'), size[1], need);
  }

  const items = () => actor.items?.contents ?? [...(actor.items ?? [])];
  // hasType:<itemType>:<name> - the same, but only an item of that type (an Influence, not an Origin).
  const hasType = /^hasType:([\w-]+):(.+)$/.exec(rest);
  if (hasType) {
    return items().some(item => item.type == hasType[1] && lower(item.name) == lower(hasType[2]));
  }

  const has = /^has:(.+)$/.exec(rest);
  if (has) {
    return items().some(item => lower(item.name) == lower(has[1]));
  }

  const count = /^count:([\w-]+)(>=|<=|>|<|=)(\d+)$/.exec(rest);
  if (count) {
    return compare(items().filter(item => item.type == count[1]).length, count[2], count[3]);
  }

  // wearing:<class> / wearing>=<class> - equipped armor of that classification (light ... ultraHeavy).
  const wearing = /^wearing(:|>=|<=)(\w+)$/.exec(rest);
  if (wearing) {
    const need = ARMOR_CLASSES.indexOf(wearing[2]);
    if (need < 0) {
      return null;
    }

    return items().some(item => {
      if (item.type != 'armor' || item.system?.equipped === false) {
        return false;
      }

      const have = ARMOR_CLASSES.indexOf(item.system?.classification ?? 'light');
      return wearing[1] == ':' ? have == need : wearing[1] == '>=' ? have >= need : have <= need && have > 0;
    });
  }

  const trained = /^trained:([\w.-]+)$/.exec(rest);
  if (trained) {
    return !!trained[1].split('.').reduce((at, key) => at?.[key], actor.system?.trained);
  }

  return undefined;
}

/** Facts about an actor, shared by `self:` and `target:`. Returns undefined for an unknown tag. */
function actorTag(actor, ruleItem, rest) {
  const [key, ...more] = rest.split(':');
  const arg = more.join(':');
  if (!actor) {
    return false;
  }

  const named = /^name~(.+)$/.exec(rest);
  if (named) {
    return lower(actor.name).includes(lower(named[1]));
  }

  const level = /^level(>=|<=|>|<|=)(\d+)$/.exec(rest);
  if (level) {
    return compare(actor.system?.level, level[1], level[2]);
  }

  const data = dataTag(actor, rest);
  if (data !== undefined) {
    return data;
  }

  const prerequisite = prerequisiteTag(actor, rest);
  if (prerequisite !== undefined) {
    return prerequisite;
  }

  switch (key) {
  case 'morphed': return !!actor.system?.isMorphed;
  case 'transformed': return !!actor.system?.isTransformed;
  case 'canTransform': return !!actor.system?.canTransform;
  case 'status': return statusOf(actor, arg);
  case 'type': return actor.type == arg;
  case 'hasItem': return hasItem(actor, arg);
  // specializedIn:<skill> - the actor has a Specialization in that Skill (system.skills.<skill>.specializations,
  // where migration.mjs puts them; a not-yet-migrated Specialization item counts too).
  case 'specializedIn': {
    if (Object.values(actor.system?.skills?.[arg]?.specializations ?? {}).some(spec => spec?.name)) {
      return true;
    }

    const items = actor.items?.contents ?? (actor.items ? [...actor.items] : []);
    return items.some(item => item.type == 'specialization' && item.system?.skill == arg);
  }

  case 'tag': return creatureTagsOf(actor).has(lower(arg));
  case 'hp<half': {
    const health = actor.system?.health;
    return !!health && Number(health.value) < Number(health.max) / 2;
  }

  case 'toggle': return !!toggleOf(ruleItem, arg);
  case 'marked': return markOf(actor, arg);
  // Acting with Reckless Abandon (helpers/reckless-abandon.mjs, handed in at start-up).
  case 'recklessAbandon': return !!worldLookups.recklessAbandon?.(actor);
  }

  return undefined;
}

/**
 * A toggle's state on the rule's item (flags.essence20.rules.toggles). Kept here, not in index.mjs,
 * so the predicate has no import loop.
 */
export function toggleOf(item, key) {
  const state = item?.flags?.essence20?.rules;
  const value = state?.toggles?.[key] ?? null;
  // A state switched on for a while (setToggle with `until`, rules/expiry.mjs) reads as off once that runs out.
  return value && isExpired(state?.toggleUntil?.[key]) ? false : value;
}

/**
 * `skill:{choice.skill}` - a ChoiceSet's pick on the rule's item, filled in. Null when the choice
 * hasn't been made yet, so the tag answers false rather than matching the literal braces.
 * @param {String} text
 * @param {Item} ruleItem
 * @returns {String|null}
 */
export function interpolate(text, ruleItem) {
  let missing = false;
  // {choice.<key>} is a ChoiceSet pick; {item.choice} is the item's own system.choice (the pick made
  // through a Perk's built-in choice field, from before rules).
  const filled = text.replace(/\{(choice\.[\w-]+|item\.choice)\}/g, (match, ref) => {
    const value = ref == 'item.choice' ? ruleItem?.system?.choice : ruleItem?.flags?.essence20?.rules?.choices?.[ref.slice(7)];
    if (value === undefined || value === null || value === '') {
      missing = true;
      return '';
    }

    return String(value);
  });

  return missing ? null : filled;
}

/**
 * One tag.
 * @param {String} tag
 * @param {Object} ctx   From contextFor().
 * @returns {Boolean|null}
 */
export function evaluateTag(tag, ctx) {
  const text = interpolate(String(tag ?? '').trim(), ctx.ruleItem);
  if (text === null) {
    return false;
  }

  if (!text) {
    return true;
  }

  if (text.startsWith('not:')) {
    const inner = evaluateTag(text.slice(4), ctx);
    return inner === null ? null : !inner;
  }

  const separator = text.indexOf(':');
  // "damage>=3" carries its comparison straight after the family name.
  const compared = /^(damage)(>=|<=|>|<|=)(\d+)$/.exec(text);
  const family = compared ? compared[1] : separator < 0 ? text : text.slice(0, separator);
  const rest = compared ? `${compared[2]}${compared[3]}` : separator < 0 ? '' : text.slice(separator + 1);
  const { item } = ctx;

  switch (family) {
  // skill:<key>; skill:choiceOf:<uuid> - the Skill chosen on the actor's copy of that item (a Field...).
  case 'skill': {
    if (rest.startsWith('choiceOf:')) {
      const uuid = rest.slice(9);
      const items = ctx.self?.items?.contents ?? (ctx.self?.items ? [...ctx.self.items] : []);
      const chosen = items.find(item => sourceOf(item) == uuid || item.uuid == uuid)?.system?.choice;
      return ctx.rolledSkill === undefined ? null : !!chosen && ctx.rolledSkill == chosen;
    }

    return ctx.rolledSkill == rest;
  }

  case 'essence': return ctx.rolledEssence == rest;
  case 'defense': return (ctx.defenseType ?? item?.system?.defenseType) == rest;
  case 'attack':
    if (!ctx.isAttack) {
      return false;
    }

    switch (rest) {
    case '': return true;
    case 'melee': return !!ctx.isMelee;
    case 'ranged': return !ctx.isMelee;
    case 'area': return isArea(item);
    // An attack with no weapon behind it - the system's own reading of "unarmed" (target-riders.mjs).
    case 'unarmed': return item?.type == 'weaponEffect' && !item.flags?.essence20?.parentId;
    // A Ram attack (weapon-effect.mjs's isRam).
    case 'ram': return !!item?.system?.isRam;
    }

    return null;
  case 'roll': {
    // dataset:<key> - the roll's dataset has that flag set (dataset:<key>=<value> for a value).
    const flag = /^dataset:([\w.-]+)(?:=(.+))?$/.exec(rest);
    if (flag) {
      const value = ctx.dataset ? globalThis.foundry?.utils?.getProperty?.(ctx.dataset, flag[1]) ?? ctx.dataset[flag[1]] : undefined;
      return ctx.dataset ? (flag[2] === undefined ? !!value && value !== 'false' : lower(value) == lower(flag[2])) : null;
    }

    // specialization~<name> - rolled with a Specialization whose name contains that text.
    // switch:<key> - a rule switch with that key was ticked for this roll (DialogSwitch key).
    if (rest.startsWith('switch:')) {
      return Array.isArray(ctx.switches) ? ctx.switches.includes(rest.slice(7)) : null;
    }

    // specialization=<name> - exactly that name (ignoring case).
    const specialized = /^specialization(~|=)(.+)$/.exec(rest);
    if (specialized) {
      const key = ctx.dataset?.specializationKey;
      const name = ctx.dataset?.specializationName ?? ctx.dataset?.specialization
        ?? (key ? ctx.self?.system?.skills?.[ctx.rolledSkill]?.specializations?.[key]?.name : null);
      if (!ctx.dataset) {
        return null;
      }

      return !!name && (specialized[1] == '=' ? lower(name).trim() == lower(specialized[2]).trim() : lower(name).includes(lower(specialized[2])));
    }

    switch (rest) {
    case 'initiative': return ctx.rolledSkill == 'initiative' || !!ctx.dataset?.isInitiative;
    case 'specialized': return !!(ctx.dataset?.isSpecialized || ctx.dataset?.specializationKey);
    case 'shove': return !!(ctx.isShove || ctx.dataset?.isShove);
    // The roll already carries a downshift from somewhere else (ctx.pendingShiftDown, dice.mjs).
    case 'downshifted': return (Number(ctx.pendingShiftDown) || 0) > 0;
    // edge: the roll has an Edge (ctx.edge, known once the roll's own Edge is worked out).
    case 'edge': return ctx.edge === undefined ? null : !!ctx.edge;
    // snag: the roll has a Snag (ctx.snag, once the dialog has settled it).
    case 'snag': return ctx.snag === undefined ? null : !!ctx.snag;
    // aimed: a ranged attack the actor took the Aim action for (helpers/action-economy.mjs#isAiming);
    // ctx.aimed when the roll already knows (the dialog's Aiming switch).
    case 'aimed': {
      if (ctx.aimed !== undefined) {
        return !!ctx.aimed;
      }

      const ranged = (ctx.isAttack ?? ctx.item?.type == 'weaponEffect') && !(ctx.isMelee ?? ctx.item?.system?.classification?.style == 'melee');
      return !!ranged && !!worldLookups.isAiming?.(ctx.self);
    }

    // The rolled Skill is untrained: still at its d20 shift.
    case 'untrained': return ctx.self && ctx.rolledSkill ? (ctx.self.system?.skills?.[ctx.rolledSkill]?.shift ?? 'd20') == 'd20' : null;
    // More Skill ranks than the other party in the rolled Skill (a Specialization counts one).
    case 'outranks': return ctx.self && ctx.other && ctx.rolledSkill ? skillRanksOf(ctx.self, ctx.rolledSkill) > skillRanksOf(ctx.other, ctx.rolledSkill) : null;
    }

    return null;
  }

  case 'item': {
    const [key, ...more] = rest.split(':');
    const arg = more.join(':');
    if (key == 'data') {
      return item ? dataTag(item, rest) : false;
    }

    const named = /^name~(.+)$/.exec(rest);
    if (named) {
      return !!item && lower(item.name).includes(lower(named[1]));
    }

    // availability<=standard (also >=, <, >, =, !=): the Availability it's requisitioned at - lowered for
    // Qualified upgrades (rules/adapter.mjs#requisitionTier) when that's known, else its combined total.
    const tier = /^availability(>=|<=|!=|>|<|=)(\w+)$/.exec(rest);
    if (tier) {
      const have = AVAILABILITY_TIERS.indexOf(ctx.effectiveAvailability ?? item?.system?.totalAvailability ?? item?.system?.availability ?? 'standard');
      const want = AVAILABILITY_TIERS.indexOf(tier[2]);
      return item && have >= 0 && want >= 0 ? compare(have, tier[1], want) : null;
    }

    // id:<16-char _id> - printed from this compendium entry, in any book (reprints share the _id).
    if (key == 'id') {
      const source = sourceOf(item) ?? item?.uuid ?? '';
      return !!item && String(source).split('.').pop() == arg;
    }

    // For an upgrade's rules (ItemModifier): the item it's attached to (isHost), or another item on
    // that same host - the host weapon's own effects (onHost).
    const hostId = ctx.ruleItem?.flags?.essence20?.parentId;
    if (rest == 'isHost') {
      return !!item && !!hostId && item.id == hostId;
    }

    // The roll is made with the rule's own item (a weapon), or one of its own weapon effects.
    if (rest == 'own') {
      const own = ctx.ruleItem;
      return !!item && !!own && (item === own || (item.id && item.id == own.id) || item.flags?.essence20?.parentId == own.id);
    }

    if (rest == 'onHost') {
      return !!item && !!hostId && item !== ctx.ruleItem && item.flags?.essence20?.parentId == hostId;
    }

    switch (key) {
    case 'type': return item?.type == arg;
    case 'trait': return itemTraits(item).has(lower(arg));
    case 'damageType': return lower(ctx.damageType ?? item?.system?.damageType) == lower(arg);
    case 'source': return sourceOf(item) == arg || item?.uuid == arg;
    case 'equipped': return ctx.ruleItem?.system?.equipped !== false;
    case 'element': {
      const weapon = item?.flags?.essence20?.parentId ? item.parent?.items?.get?.(item.flags.essence20.parentId) : null;
      return lower(item?.system?.damageType == 'element' ? weapon?.system?.elementChoice : item?.system?.damageType) == lower(arg);
    }
    }

    return null;
  }

  // The item carrying the rule: rule:data:system.choice=heavy - its own stored values.
  case 'rule':
    // rule:altMode - the rule's item is the Alt Mode the actor is converted into right now.
    if (rest == 'altMode') {
      return !!ctx.ruleItem && !!ctx.self?.system?.isTransformed && ctx.self.system.altModeId == ctx.ruleItem.id;
    }

    // rule:banked - a bonus this item banked on the actor (rules/bank.mjs) is still unspent.
    if (rest == 'banked') {
      const bank = ctx.self?.flags?.essence20?.ruleBank;
      return !!ctx.ruleItem && (Array.isArray(bank) ? bank : []).some(entry => entry?.source == ctx.ruleItem.id && entry.uses > 0 && !isExpired(entry));
    }

    return ctx.ruleItem ? dataTag(ctx.ruleItem, rest) ?? null : false;
  // The weapon a rolled weapon effect belongs to: any item: tag, asked of the weapon.
  case 'weapon': {
    const parentId = item?.flags?.essence20?.parentId;
    const weapon = parentId ? (item.parent ?? item.actor)?.items?.get?.(parentId) ?? null : null;
    return weapon ? evaluateTag(`item:${rest}`, { ...ctx, item: weapon }) : false;
  }

  // The item an Upgrade is attached to (prerequisites): any item: tag, asked of that item.
  case 'host':
    return ctx.host ? evaluateTag(`item:${rest}`, { ...ctx, item: ctx.host }) : null;
  case 'check': return runCheck(rest, ctx.self, ctx);
  case 'self': {
    if (rest.startsWith('check:')) {
      return runCheck(rest.slice(6), ctx.self, ctx);
    }

    const versus = versusTag(rest, ctx.self, ctx.other, ctx.combat);
    if (versus !== undefined) {
      return versus;
    }

    // sizeDiff>=N - this actor's size is at least N places above the other party's (SIZES order).
    const bigger = sizeDiff(rest, ctx.self, ctx.other);
    if (bigger !== undefined) {
      return bigger;
    }

    const answer = actorTag(ctx.self, ctx.ruleItem, rest);
    return answer === undefined ? null : answer;
  }

  // holder:<actor tag> - the actor whose item the rule is on (self, unless the rule reached this actor
  // from another one); holder:protects - this actor is the holder's Protected Target.
  case 'holder': {
    const holder = ctx.holder ?? ctx.self;
    if (rest == 'protects') {
      const uuid = holder?.getFlag?.('essence20', 'protectedTargetUuid') ?? holder?.flags?.essence20?.protectedTargetUuid;
      return !!uuid && uuid == ctx.self?.uuid;
    }

    const answer = actorTag(holder, ctx.ruleItem, rest);
    return answer === undefined ? null : answer;
  }

  case 'target': {
    if (!ctx.other) {
      return false;
    }

    // within:N - this target is within N feet of the rule's actor (null off the canvas).
    const near = /^within:(\d+)$/.exec(rest);
    if (near) {
      const feet = feetBetween(ctx.self, ctx.other);
      return feet === null ? null : feet <= Number(near[1]);
    }

    if (rest.startsWith('check:')) {
      return runCheck(rest.slice(6), ctx.other, { ...ctx, self: ctx.other, other: ctx.self });
    }

    const versus = versusTag(rest, ctx.other, ctx.self, ctx.combat);
    if (versus !== undefined) {
      return versus;
    }

    // sizeDiff>=N - the target's size is at least N places above this actor's (SIZES order).
    const bigger = sizeDiff(rest, ctx.other, ctx.self);
    if (bigger !== undefined) {
      return bigger;
    }

    const answer = actorTag(ctx.other, null, rest);
    return answer === undefined ? null : answer;
  }

  case 'combat':
    if (!rest) {
      return !!ctx.combat?.started;
    }

    if (rest.startsWith('round:')) {
      return Number(ctx.combat?.round) == Number(rest.slice(6));
    }

    // aheadOfTarget - this actor's Initiative is higher than the other party's (both rolled), in any combat.
    if (rest == 'aheadOfTarget') {
      const mine = combatantOf(ctx.combat, ctx.self)?.initiative;
      const theirs = combatantOf(ctx.combat, ctx.other)?.initiative;
      return mine != null && theirs != null && mine > theirs;
    }

    // highestInitiative - no other combatant has rolled a higher Initiative (ties count), in any combat.
    if (rest == 'highestInitiative') {
      const mine = combatantOf(ctx.combat, ctx.self);
      const list = ctx.combat?.combatants?.contents ?? (ctx.combat?.combatants ? [...ctx.combat.combatants] : []);
      return mine?.initiative != null && list.every(c => c === mine || c.initiative == null || c.initiative <= mine.initiative);
    }

    // first - this actor is first in the Initiative order.
    if (rest == 'first') {
      const first = ctx.combat?.turns?.[0]?.actor ?? null;
      return ctx.combat?.started ? !!first && !!ctx.self && (first === ctx.self || (!!first.uuid && first.uuid == ctx.self.uuid)) : false;
    }

    return null;
  // markedBy:<key> - this actor carries that mark, set by the other party (the roll's target / the roller);
  // markedByMe:<key> - the other party carries that mark, set by this actor.
  case 'markedBy':
  case 'markedByMe': {
    const [holder, setter] = family == 'markedBy' ? [ctx.self, ctx.other] : [ctx.other, ctx.self];
    if (!holder || !setter) {
      return null;
    }

    const mark = holder.flags?.essence20?.ruleMarks?.[rest];
    return !!mark && !isExpired(mark) && !!setter.uuid && mark.by == setter.uuid;
  }

  // The kind of Lend Assistance a lendAssistance / assisted Trigger is answering.
  case 'assist': return ctx.assistKind ? ctx.assistKind == rest : null;
  // The hit a takesDamage / wouldBeDefeated Trigger is answering: damage:<type>, damage:crit,
  // damage>=N (also <=, >, <, =).
  case 'damage': {
    if (ctx.damageAmount === undefined && ctx.damageType === undefined) {
      return null;
    }

    if (rest == 'crit') {
      return !!ctx.damageCrit;
    }

    const amount = /^(>=|<=|>|<|=)(\d+)$/.exec(rest);
    return amount ? compare(ctx.damageAmount, amount[1], amount[2]) : lower(ctx.damageType) == lower(rest);
  }

  case 'ownTurn': return !!ctx.combat?.started && ctx.combat.combatant?.actor?.id == ctx.self?.id;
  case 'vehicle': {
    const crewed = crewLookup?.(ctx.self) ?? null;
    switch (rest) {
    case 'crew': return !!crewed;
    case 'driving': return crewed?.role == 'driver';
    }

    // type:<zord|vehicle> - what kind of actor is being crewed.
    const kind = /^type:(\w+)$/.exec(rest);
    if (kind) {
      return !!crewed && crewed.vehicle?.type == kind[1];
    }

    // moves:<aerial|ground|swim...> - the vehicle being crewed has that kind of Movement.
    const moves = /^moves:(\w+)$/.exec(rest);
    if (moves) {
      return !!crewed && (Number(crewed.vehicle?.system?.movement?.[moves[1]]?.base) || 0) > 0;
    }

    return null;
  }

  case 'ally':
  case 'enemy': {
    const within = /^within:(\d+)$/.exec(rest);
    return within ? sideWithin(ctx.self, Number(within[1]), family) : null;
  }

  case 'terrain': {
    // No terrain set anywhere is unknown, not "no" - the rule becomes a switch (the old Tracking
    // Outfit/Bookworm reading). "wild" is any terrain that isn't urban.
    const terrain = worldLookups.terrain?.(ctx.self) ?? null;
    if (!terrain) {
      return null;
    }

    return rest == 'wild' ? terrain != 'urban' : terrain == rest;
  }

  case 'environment': {
    const environment = worldLookups.environment?.(ctx.self);
    return environment ? environment == rest : null;
  }

  case 'scene': {
    const name = /^name~(.+)$/.exec(rest);
    return name ? lower(globalThis.game?.scenes?.active?.name ?? globalThis.game?.scenes?.current?.name).includes(lower(name[1])) : null;
  }

  case 'ask': return null;
  }

  return null;
}

/**
 * A whole `when` list. Known-false anywhere wins over unknown; otherwise any unknown makes the whole
 * thing unknown.
 * @param {Array<String|Object>} when
 * @param {Object} ctx
 * @returns {Boolean|null}
 */
export function evaluate(when, ctx) {
  let unknown = false;
  for (const entry of Array.isArray(when) ? when : []) {
    let answer;
    if (entry && typeof entry == 'object' && Array.isArray(entry.any)) {
      const answers = entry.any.map(inner => evaluate([inner], ctx));
      answer = answers.some(a => a === true) ? true : answers.some(a => a === null) ? null : false;
    } else {
      answer = evaluateTag(entry, ctx);
    }

    if (answer === false) {
      return false;
    }

    if (answer === null) {
      unknown = true;
    }
  }

  return unknown ? null : true;
}

/** A tag's family name - "damage>=2" has its comparison straight after the name. */
function familyOf(tag) {
  return /^damage(>=|<=|>|<|=)/.test(tag) ? 'damage' : tag.split(':')[0];
}

/** Whether every tag in a `when` can be answered without a roll (so it can apply in derived data). */
export function isStatic(when) {
  const flat = [];
  const walk = list => {
    for (const entry of Array.isArray(list) ? list : []) {
      if (entry && typeof entry == 'object' && Array.isArray(entry.any)) {
        walk(entry.any);
      } else {
        flat.push(String(entry ?? '').replace(/^not:/, ''));
      }
    }
  };

  walk(when);
  return flat.every(tag => STATIC_FAMILIES.includes(TAGS[familyOf(tag)]?.family) || tag == 'item:equipped');
}

/** Validator: the tags in a `when` this file doesn't recognise. */
export function unknownTags(when) {
  const bad = [];
  const checkName = tag => /(?:^|:)check:([^:]+)/.exec(tag)?.[1];
  const walk = list => {
    for (const entry of Array.isArray(list) ? list : []) {
      if (entry && typeof entry == 'object') {
        if (Array.isArray(entry.any)) {
          walk(entry.any);
        } else {
          bad.push(JSON.stringify(entry));
        }

        continue;
      }

      const tag = String(entry ?? '').replace(/^not:/, '');
      if (!TAGS[familyOf(tag)] || (checkName(tag) && !CHECK_NAMES.includes(checkName(tag)))) {
        bad.push(tag);
      }
    }
  };

  walk(when);
  return bad;
}
