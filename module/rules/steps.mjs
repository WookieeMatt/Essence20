import { isValidUntil, UNTIL } from "./expiry.mjs";
import { formulaError, resolveValue } from "./formula.mjs";
import { LIMIT_WINDOWS } from "./limits.mjs";
import { flattenPaths } from "./rule-paths.mjs";
import { contextFor, evaluate, interpolate, sideActorsWithin, unknownTags as unknownTagsOf, wieldedAttacks } from "./predicate.mjs";
import { sourceOf as sourceOfItem } from "../items/shared/item-lookups.mjs";
import { chosenOf } from "./choice-read.mjs";

/**
 * The step language (docs/RULES_ENGINE_PLAN.md §5.5) - what a Use button or a Trigger does, as a
 * list of `{do, ...}` steps run in order. Each step may carry its own `when`, checked as it runs.
 *
 * Who a step lands on is its `to`: "self" (the default), "target" (the first target) or "targets"
 * (all of them). Targets come from a `target` step, or the user's targeted tokens.
 *
 * A run carries a context: {actor, item, rule, targets, damage, chat, vars}. A step that can't go
 * ahead (no target, not enough of a resource) stops the run, and says why in chat.
 *
 * Writes to an actor this user doesn't own go through the GM (mechanics/world/gm-relay.mjs), the same as the
 * hand-written Perks do. Heavy helpers are imported lazily, so this file loads under plain Node.
 */

export const STEP_TYPES = [
  'chat', 'spend', 'gainResource', 'heal', 'loseHealth', 'damage', 'applyCondition', 'removeCondition', 'roll', 'grant', 'bank',
  'grantActions', 'setToggle', 'choose', 'target', 'negateDamage', 'leaveAt', 'mark', 'unmark', 'askNumber', 'pickGrant', 'bonusAttack', 'setForm', 'save', 'pickAlly', 'pickPerk', 'fitAttack',
  'createItem', 'deleteItem', 'updateItem', 'spendQuantity', 'pick', 'button',
  'negateHit', 'lowerTotal', 'lateSnag', 'convertRows', 'rerollCard',
  'essenceDamage', 'healEssence', 'extendCondition',
  'updateActor', 'require', 'setTargets', 'writeInitiative', 'table', 'setVar',
  'spendAction', 'rollVsEach', 'disarm', 'takeItem',
];

const ESSENCES = ['strength', 'speed', 'smarts', 'social'];

/* Plug-in points (module/rules/ext/*.mjs): new steps, recipients and pick sources live in their own files. */
const STEP_VALIDATORS = new Map();
const EXTRA_RECIPIENTS = [];
const PICK_SOURCES = new Map();

/**
 * Add a step type. `handler(step, ctx)` runs it (false stops the run); `errors(step, where)` lists its problems;
 * `branches` names the keys holding nested step lists the validator should walk.
 */
export function registerStep(name, handler, { errors = null, branches = [] } = {}) {
  if (!STEP_TYPES.includes(name)) {
    STEP_TYPES.push(name);
  }

  HANDLERS[name] = handler;
  STEP_VALIDATORS.set(name, { errors, branches });
}

/** Add a `to:` recipient. `pattern` is a name or a RegExp; `fn(match, ctx, step)` returns a list of actors. */
export function registerRecipient(pattern, fn) {
  EXTRA_RECIPIENTS.push({ pattern, fn });
}

/**
 * Add an item selector for the item steps' `item:` (round 15): `prefix` is a name ("host") or a prefix ending in ":"
 * ("where:"); `fn(rest, actor, ctx, items)` returns the matching items of `actor` (rest: what follows the prefix).
 */
const ITEM_SELECTORS = [];
export function registerItemSelector(prefix, fn) {
  ITEM_SELECTORS.push({ prefix, fn });
}

/**
 * Add how a pickGrant {viaDrop: true} of an item type is given (round 15): `fn(actor, uuid, {grantedBy, flags, system})`
 * goes through that type's own drop handling (an Alteration's benefit / cost dialogs) and returns the created item, or
 * null when nothing was made (the run then stops).
 */
const DROP_GRANTS = new Map();
export function registerDropGrant(type, fn) {
  DROP_GRANTS.set(type, fn);
}

/**
 * Add a text placeholder `{<head>.<rest>}` for step texts (chat, updateItem / updateActor text, names...) (round 15):
 * `fn(rest, ctx)` returns the text, or undefined to leave the placeholder as written.
 */
const TEXT_REFS = new Map();
export function registerTextRef(head, fn) {
  TEXT_REFS.set(head, fn);
}

function fillTextRefs(text, ctx) {
  if (!TEXT_REFS.size || !String(text).includes('{')) {
    return text;
  }

  return String(text).replace(/\{([A-Za-z]+)\.([^{}]+)\}/g, (match, head, rest) => {
    const value = TEXT_REFS.has(head) ? TEXT_REFS.get(head)(rest, ctx) : undefined;
    return value === undefined ? match : String(value);
  });
}

/** Add a `pick from:` source. `fn(step, ctx)` returns [{value, label}]. */
export function registerPickSource(name, fn) {
  if (!PICK_FROM.includes(name)) {
    PICK_FROM.push(name);
  }

  PICK_SOURCES.set(name, fn);
}

/** The steps that change a posted check card - only inside a Reaction rule (rules/reactions.mjs). */
export const CARD_STEPS = ['negateHit', 'lowerTotal', 'lateSnag', 'convertRows', 'rerollCard'];

/**
 * A created item's name: {choice.x} filled; an E20. key is localized, and with `nameData` ({key: text}, each an E20. key or
 * text) formatted - "E20.ZordFeatureAttackEffectName" + {name: "E20.ZordFeatureAttackMelee"} (round 16, part b). The
 * nameData key is taken off the data.
 */
function createdName(data, ctx) {
  const name = interpolate(String(data.name), ctx.item) ?? String(data.name);
  const extra = data.nameData && typeof data.nameData == 'object' ? data.nameData : null;
  delete data.nameData;
  const i18n = globalThis.game?.i18n;
  if (!name.startsWith('E20.') || !i18n) {
    return name;
  }

  const local = text => (String(text ?? '').startsWith('E20.') ? i18n.localize?.(String(text)) ?? String(text) : String(text ?? ''));
  return extra ? i18n.format?.(name, Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, local(value)]))) ?? name : local(name);
}

/** createItem `knownTraits`: system.traits keeps only the weapon traits the system knows (CONFIG.E20.weaponTraits). */
function keepKnownTraits(data) {
  const known = globalThis.CONFIG?.E20?.weaponTraits ?? {};
  if (Array.isArray(data.system?.traits)) {
    data.system.traits = data.system.traits.filter(trait => trait && Object.hasOwn(known, trait));
  }
}

/**
 * A created item's children (createItem's `children`): each made on the actor with the host as its
 * parentId and the host's grantedBy / expiry, then entered in the host's system.items like an attached
 * item, so the sheet lists it under the host and removing the host takes it along.
 */
async function createChildren(actor, host, children, hostFlags, ctx) {
  const datas = children.filter(child => child?.name && child?.type).map(child => {
    const data = fillData(globalThis.foundry?.utils?.deepClone?.(child) ?? JSON.parse(JSON.stringify(child)), ctx);
    data.name = createdName(data, ctx);
    for (const [key, value] of Object.entries({ parentId: host.id, grantedBy: hostFlags.grantedBy ?? null, rulesExpiry: hostFlags.rulesExpiry })) {
      if (value !== undefined) {
        globalThis.foundry?.utils?.setProperty?.(data, `flags.essence20.${key}`, value);
      }
    }

    return data;
  });
  const made = datas.length ? await write(actor, 'createEmbeddedDocuments', ['Item', datas]) : [];
  if (!host.isOwner && !globalThis.game?.user?.isGM) {
    return made;
  }

  const { setEntryAndAddItem } = await import("../sheet-handlers/attachment-handler.mjs");
  for (const child of made ?? []) {
    const key = await setEntryAndAddItem(child, host);
    if (key) {
      await child.setFlag?.('essence20', 'collectionId', key);
    }
  }

  return made;
}

/** The card rows a card step acts on: its own row, or (rows: "all", or a card-wide Reaction) every row. */
function cardRows(step, ctx, filter = () => true) {
  const { info, row } = ctx.card;
  return (row && step.rows != 'all' ? [row] : info.rows).filter(r => r.targetUuid && filter(r));
}

/** A lowered total: rows that no longer reach their DIF miss, the others say they still hit. */
async function lowerCardTotal(step, ctx, total) {
  const core = await import("../mechanics/combat/reaction-engine.mjs");
  const { info } = ctx.card;
  for (const row of cardRows(step, ctx, r => r.success && !core.isNegated(info.message, r.targetUuid))) {
    const target = globalThis.fromUuidSync?.(row.targetUuid, { strict: false });
    const name = escape(target?.name ?? '');
    if (total < row.difficulty) {
      await core.negateHit(info.message, row.targetUuid, null, ctx.actor);
      ctx.chat.push(T('CardNowMisses', { target: name, total, dif: row.difficulty }));
    } else {
      ctx.chat.push(T('CardStillHits', { target: name, total, dif: row.difficulty }));
    }
  }

  info.total = total;
  ctx.vars.total = total;
}

/**
 * A text with {choice.<key>} (a pick), {var.<key>} (a value stored in the run) and {@<formula>} (worked out now:
 * {@mark.questions}, {@item.system.uses.value}) filled in. A missing pick leaves the text as written.
 */
function fillText(text, ctx) {
  return fillTextRefs(interpolate(text, ctx.item) ?? text, ctx)
    .replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''))
    // {rolled.<path>}: the rolled item, where the run has one (BeforeRoll - rules/plugins/rolls/before-roll-rolled-item.mjs).
    .replace(/\{rolled\.([\w.-]+)\}/g, (match, path) => String(globalThis.foundry?.utils?.getProperty?.(ctx.rolled ?? {}, path) ?? ''))
    .replace(/\{(@[^}]+)\}/g, (match, formula) => String(Math.round(resolveValue(formula, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null, rolled: ctx.rolled ?? null }, 0))));
}

/**
 * createItem's data (and its children): every text with a {choice.<key>} / {var.<key>} / {@formula} filled (fillText). A text
 * that is only one {var.<key>} or {choice.<key>} takes that value as it is - a number stays a number (an unset one is null) -
 * so a designed weapon's fields can come from earlier picks (Unique Strike: its Skill, damage type, Range, Alternate Effect).
 */
function fillData(data, ctx) {
  if (typeof data == 'string') {
    const whole = /^\{(var|choice)\.([\w-]+)\}$/.exec(data);
    if (whole) {
      const value = whole[1] == 'var' ? ctx.vars?.[whole[2]] : ctx.item?.flags?.essence20?.rules?.choices?.[whole[2]];
      return value === undefined || value === '' ? null : value;
    }

    return data.includes('{') ? fillText(data, ctx) : data;
  }

  if (Array.isArray(data)) {
    return data.map(value => fillData(value, ctx));
  }

  if (data && typeof data == 'object') {
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, fillData(value, ctx)]));
  }

  return data;
}

/** The actor's wielded attacks, narrowed by a tag asked of each (as self:wielding:<tag>). */
function wieldedFor(actor, narrow, ctx) {
  const attacks = wieldedAttacks(actor);
  // Several tags joined by & must all hold on the same attack.
  return narrow ? attacks.filter(attack => evaluate(narrow.split('&'), contextFor({ self: actor, ruleItem: ctx.item, item: attack, other: ctx.targets[0] ?? null })) === true) : attacks;
}

/** A roll step's Skill: a key, or "wielded[:<tag>]" - the Skill of the first matching wielded attack. */
function skillFor(step, ctx) {
  const skill = String(step.skill ?? '');
  if (skill == 'wielded' || skill.startsWith('wielded:')) {
    return wieldedFor(ctx.actor, skill.slice(8), ctx)[0]?.system?.classification?.skill ?? null;
  }

  // actor:<path> - a Skill named on the actor (system.originSkillsIncrease, the Origin Skill); choiceOf:<uuid> - the Skill
  // chosen on the actor's copy of that book item (the Empathy Perk's pick, rules/choice-read.mjs). Null when there's none.
  if (skill.startsWith('actor:')) {
    return String(globalThis.foundry?.utils?.getProperty?.(ctx.actor, skill.slice(6)) ?? '') || null;
  }

  if (skill.startsWith('choiceOf:')) {
    const uuid = skill.slice(9);
    const items = ctx.actor?.items?.contents ?? (ctx.actor?.items ? [...ctx.actor.items] : []);
    return chosenOf(items.find(item => sourceOfItem(item) == uuid || item.uuid == uuid)) || null;
  }

  // {var.<key>} too - a Skill an earlier step stored (a picked entry's Requisition Skill).
  return fillText(skill, ctx);
}

/** The Essence an essence step names: a key, {choice.<key>}, or "choose" (asked). Null when there's none. */
async function essenceFor(step, ctx) {
  const named = interpolate(String(step.essence ?? ''), ctx.item) ?? '';
  if (named == 'choose') {
    const options = ESSENCES.map(key => ({ value: key, label: essenceLabel(key) }));
    const value = await (ctx.askPick ?? askPick)({ prompt: step.prompt }, options, ctx);
    return ESSENCES.includes(value) ? value : null;
  }

  return ESSENCES.includes(named) ? named : null;
}

function essenceLabel(key) {
  const label = globalThis.CONFIG?.E20?.essences?.[key];
  return label ? globalThis.game?.i18n?.localize?.(label) ?? key : key;
}

/**
 * More `untilOf` values (book check 2026-10-06, follow-ups 2): `fn(ctx, recipient)` returns whose turns count, or null
 * for the holder (rules/plugins/book/followups2.mjs: `user` - the crew member using a vehicle's Use).
 */
const UNTIL_OF = new Map();
export function registerUntilOf(name, fn) {
  UNTIL_OF.set(name, fn);
}

/** Whose turns a step's `until` counts: the rule's holder, or (untilOf: "recipient") the one it lands on. */
function untilActor(step, ctx, recipient) {
  if (UNTIL_OF.has(step.untilOf)) {
    return UNTIL_OF.get(step.untilOf)(ctx, recipient) ?? ctx.actor;
  }

  // untilOf: target - the run's first target's turns, whoever it lands on (Better Together: "until the end of your next
  // turn" counted on the partner who assisted, for both marks).
  if (step.untilOf == 'target') {
    return ctx.targets?.[0] ?? ctx.actor;
  }

  // untilOf: holder - the rule item's owner, even when the step runs for someone else (a marked creature's Trigger).
  if (step.untilOf == 'holder') {
    return ctx.item?.parent ?? ctx.actor;
  }

  return step.untilOf == 'recipient' ? recipient ?? ctx.actor : ctx.actor;
}

/**
 * Round 18 (convA): `fn(recipient, condition, {until, rounds, untilActor}, ctx)` may change how long an applyCondition
 * step's Condition lasts on one recipient, returning {until, rounds} (rules/plugins/effects/condition-halving.mjs -
 * Gallantry's halved Frightened).
 */
const CONDITION_DURATIONS = [];
export function registerConditionDuration(fn) {
  CONDITION_DURATIONS.push(fn);
}

function conditionDurationFor(recipient, condition, spec, ctx) {
  return CONDITION_DURATIONS.reduce((at, fn) => ({ ...at, ...(fn(recipient, condition, at, ctx) ?? {}) }), spec);
}

const PICK_FROM = ['skill', 'essence', 'damageType', 'ownedItem', 'ally', 'enemy', 'target', 'list', 'team', 'actors', 'targetItem'];

/** Every `from:` a pick step (and a ChoiceSet - rules/lifecycle.mjs#choiceOptions) can name, plug-in sources included. */
export function pickSources() {
  return [...PICK_FROM];
}

/**
 * A Skill list narrowed by a pick's Skill settings: essence (only that Essence's Skills), minShift / maxShift (only Skills
 * whose die on the actor is at least / at most that), specializedOnly (only Skills the actor is Specialized in - all,
 * when none is). Shared by the pick step and a ChoiceSet `from: skill`.
 */
export function filterSkills(keys, step, actor) {
  const E20 = globalThis.CONFIG?.E20 ?? {};
  let list = [...keys];
  if (step.essence) {
    list = list.filter(key => (E20.skillToEssence?.[key] ?? null) == step.essence);
  }

  // minShift / maxShift: only Skills whose die is at least / at most that (d4, d8...).
  const RANKS = ['d20', 'd2', 'd4', 'd6', 'd8', 'd10', 'd12', '2d8', '3d6'];
  const rank = key => RANKS.indexOf(actor?.system?.skills?.[key]?.shift ?? 'd20');
  if (step.minShift) {
    list = list.filter(key => rank(key) >= RANKS.indexOf(step.minShift));
  }

  if (step.maxShift) {
    list = list.filter(key => rank(key) <= RANKS.indexOf(step.maxShift));
  }

  if (step.specializedOnly) {
    const specialized = list.filter(key => Object.keys(actor?.system?.skills?.[key]?.specializations ?? {}).length);
    list = specialized.length ? specialized : list;
  }

  return list;
}

/**
 * What a pick step offers: [{value, label}]. `only: [...]` narrows any source to those values (Perk choice P1 - the
 * same list a ChoiceSet offers, docs/PERK_CHOICE_MIGRATION_PLAN.md §2.2).
 */
export function pickOptions(step, ctx) {
  const all = sourceOptions(step, ctx);
  const only = Array.isArray(step.only) && step.only.length ? step.only.map(String) : null;
  return only ? all.filter(option => only.includes(String(option.value))) : all;
}

function sourceOptions(step, ctx) {
  const E20 = globalThis.CONFIG?.E20 ?? {};
  const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;
  const table = (keys, names = {}) => keys.map(key => ({ value: key, label: localize(names[key] ?? key) }));
  const actor = ctx.actor;
  switch (step.from) {
  // essence: only that Essence's Skills; specializedOnly: only Skills the actor is Specialized in (all, when none is).
  case 'skill': return table(filterSkills(Object.keys(actor?.system?.skills ?? {}), step, actor), E20.skills);

  // targetItem: one of the first target's items (itemType, equipped, filter) - stored as its uuid (Pillage, Disruptor).
  case 'targetItem': {
    const target = ctx.targets[0];
    const types = [step.itemType ?? []].flat();
    const tags = Array.isArray(step.filter) ? step.filter : [];
    const items = target?.items?.contents ?? (target?.items ? [...target.items] : []);
    return items.filter(item => (!types.length || types.includes(item.type)) && (!step.equipped || item.system?.equipped)
      && (!tags.length || evaluate(tags, contextFor({ self: actor, other: target, ruleItem: ctx.item, item })) === true))
      .map(item => ({ value: item.uuid, label: item.name }));
  }

  // actors: every world actor of actorType (zord, vehicle, npc...), the actor too unless notSelf.
  case 'actors': return worldList(globalThis.game?.actors).filter(other => other && (!step.actorType || other.type == step.actorType) && !(step.notSelf && other === actor))
    .map(other => ({ value: other.uuid, label: other.name }));

  // team: every Player Character in the world (not only those on the canvas), the actor too unless notSelf.
  case 'team': return worldList(globalThis.game?.actors).filter(other => other?.type == 'playerCharacter' && !(step.notSelf && other === actor))
    .map(other => ({ value: other.uuid, label: other.name }));
  case 'essence': return table(['strength', 'speed', 'smarts', 'social'], E20.essences);
  case 'damageType': return table(Object.keys(E20.damageTypes ?? {}), E20.damageTypes);
  case 'ownedItem': {
    const types = [step.itemType ?? []].flat();
    const items = actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);
    // filter: item tags each candidate must meet (item:trait:x, item:data:..., weapon:..., not:...).
    const tags = Array.isArray(step.filter) ? step.filter : [];
    return items.filter(item => (!types.length || types.includes(item.type)) && (!step.equipped || item.system?.equipped)
      && (!tags.length || evaluate(tags, contextFor({ self: actor, ruleItem: ctx.item, item })) === true))
      .map(item => ({ value: item.id, label: item.name }));
  }

  case 'ally':
  case 'enemy':
    return sideActorsWithin(actor, Number(step.within) || 100000, step.from).map(other => ({ value: other.uuid, label: other.name }));
  case 'target': return ctx.targets.map(other => ({ value: other.uuid, label: other.name }));
  case 'list': return (Array.isArray(step.options) ? step.options : []).map(option => (Array.isArray(option)
    ? { value: option[0], label: localize(option[1] ?? option[0]) } : { value: option, label: localize(option) }));
  }

  return PICK_SOURCES.get(step.from)?.(step, ctx) ?? [];
}

async function askPick(step, options, ctx) {
  const { chooseSelect } = await import("../mechanics/resources/grants.mjs");
  // An E20. key prompt is localized (round 16, part b - A Hint of Independence's E20.ImperfectionPickType).
  return chooseSelect(ctx.item?.name ?? '', escape(step.prompt ? localizedText(String(step.prompt)) : T('PickPrompt')), options);
}

/** A text that is an E20. key, localized (else as it is). */
function localizedText(text) {
  const i18n = globalThis.game?.i18n;
  return text.startsWith('E20.') && i18n?.localize ? i18n.localize(text) : text;
}

/**
 * The items an item step acts on, on one actor. `item` picks them:
 *   "self"            the rule's own item (on another actor: their copy of the same book item)
 *   "granted"         items this rule's item granted (grant / createItem)
 *   "source:<uuid>"   copies of that book item
 *   "name~<text>"     a name containing the text
 *   "type:<type>"     items of that type (weapon, armor, upgrade...)
 *   "choice:<key>"    the item whose id a pick step stored under that key
 * The first match, or every match with `all: true`.
 * @returns {Array<Item>}
 */
export function itemsFor(step, actor, ctx) {
  const items = actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);
  const pick = String(step.item ?? 'self');
  const own = ctx.item;
  let found = [];
  if (pick == 'self') {
    found = actor === ctx.actor && own ? items.filter(item => item === own || item.id == own.id) : items.filter(item => sourceOfItem(own) && sourceOfItem(item) == sourceOfItem(own));
  } else if (pick == 'granted') {
    found = items.filter(item => own?.id && item.flags?.essence20?.grantedBy == own.id);
  } else if (pick.startsWith('source:')) {
    found = items.filter(item => sourceOfItem(item) == pick.slice(7) || item.uuid == pick.slice(7));
  } else if (pick.startsWith('name~')) {
    const text = pick.slice(5).toLowerCase();
    found = items.filter(item => String(item.name ?? '').toLowerCase().includes(text));
  } else if (pick.startsWith('type:')) {
    found = items.filter(item => item.type == pick.slice(5));
  } else if (pick.startsWith('choice:')) {
    const id = own?.flags?.essence20?.rules?.choices?.[pick.slice(7)];
    // A pickMany stores a list: every item in it.
    const ids = Array.isArray(id) ? id : [id];
    found = items.filter(item => id && (ids.includes(item.id) || ids.includes(item.uuid)));
  } else if (pick == 'wielded' || pick.startsWith('wielded:')) {
    // The weapons the actor is wielding (wielded:<tag> - asked of each weapon's attacks, as self:wielding:<tag>).
    const ids = new Set(wieldedFor(actor, pick.slice(8), ctx).map(attack => attack.flags?.essence20?.parentId));
    found = items.filter(item => ids.has(item.id));
  } else {
    // A plug-in selector (registerItemSelector): "host", "where:<tags>"...
    const plugged = ITEM_SELECTORS.find(({ prefix }) => (prefix.endsWith(':') ? pick.startsWith(prefix) : pick == prefix));
    found = plugged ? plugged.fn(pick.slice(plugged.prefix.length), actor, ctx, items) ?? [] : [];
  }

  return step.all ? found : found.slice(0, 1);
}

const T = (key, data) => {
  const i18n = globalThis.game?.i18n;
  const full = `E20.Rules.Step.${key}`;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : `${key}${data ? ` ${JSON.stringify(data)}` : ''}`;
};

// The last mark `keep` order stamp handed out (step mark, keep: N).
let markOrder = 0;

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The user's targeted actors. */
export function targetedActors() {
  const targets = globalThis.game?.user?.targets;
  return targets ? [...targets].map(token => token.actor).filter(Boolean) : [];
}

/** Who a step lands on. */
export function recipients(step, ctx) {
  const list = baseRecipients(step, ctx);
  // filter: tags each recipient must meet, asked as the target (target:..., self: is the rule's actor).
  const met = !Array.isArray(step.filter) || !step.filter.length ? list
    : list.filter(other => evaluate(step.filter, contextFor({ self: ctx.actor, holder: ctx.actor, ruleItem: ctx.item, other })) === true);
  // first: only the first N of them (a formula, after the filter) - "up to three enemies" (Rallying Cry).
  return step.first === undefined ? met : met.slice(0, Math.max(0, amountOf(step.first, ctx, 0)));
}

function baseRecipients(step, ctx) {
  for (const { pattern, fn } of EXTRA_RECIPIENTS) {
    const match = typeof pattern == 'string' ? (step.to == pattern ? [pattern] : null) : pattern.exec(step.to ?? '');
    if (match) {
      return fn(match, ctx, step) ?? [];
    }
  }

  switch (step.to ?? 'self') {
  case 'target': return ctx.targets.slice(0, 1);
  case 'targets': return ctx.targets;
  // The first target, or the actor when nothing is targeted ("Reach", including yourself).
  case 'targetOrSelf': return [ctx.targets[0] ?? ctx.actor];
  // party: the members of the actor's Party (the primary Party it's on, else any Party roster holding it); team: every
  // Player Character in the world. Both include the actor; party+others / team+others leave it out.
  case 'party':
  case 'party+others':
    return withoutSelf(step.to, partyOf(ctx.actor), ctx.actor);
  // partyActor: the Party document itself (its Requisition, its pool) - the one the actor is on, primary first.
  case 'partyActor': {
    const party = partyDocOf(ctx.actor);
    return party ? [party] : [];
  }

  // combatAllies: the running combat's combatants on the actor's side (not the actor); +self includes it.
  case 'combatAllies':
  case 'combatAllies+self': {
    const combatants = globalThis.game?.combat?.combatants;
    const list = worldList(combatants).map(combatant => combatant.actor).filter(other => other && other !== ctx.actor && sameSideOf(ctx.actor, other));
    return step.to == 'combatAllies+self' ? [ctx.actor, ...new Set(list)] : [...new Set(list)];
  }

  case 'team':
  case 'team+others':
    return withoutSelf(step.to, worldList(globalThis.game?.actors).filter(actor => actor?.type == 'playerCharacter'), ctx.actor);
  }

  // allies:<ft> / enemies:<ft> - every allied or enemy token's actor within that range (not self);
  // allies+self:<ft> includes the actor too; all:<ft> is everyone else in range, either side.
  // alliesOfTarget:<ft> / enemiesOfTarget:<ft> - around the first target: its own allies (not it) or its enemies,
  // within that range of it (Brutal Display, Make An Example).
  const around = /^(allies|enemies)OfTarget:(\d+)$/.exec(step.to ?? '');
  if (around) {
    const target = ctx.targets[0];
    return target ? sideActorsWithin(target, Number(around[2]), around[1] == 'allies' ? 'ally' : 'enemy') : [];
  }

  const picked = /^picked:([\w-]+)$/.exec(step.to ?? '');
  if (picked) {
    const stored = ctx.item?.flags?.essence20?.rules?.choices?.[picked[1]];
    const actor = stored ? globalThis.fromUuidSync?.(stored, { strict: false }) ?? globalThis.game?.actors?.get?.(stored) ?? null : null;
    return actor ? [actor] : [];
  }

  const near = /^(allies|enemies|allies\+self|all):(\d+)$/.exec(step.to ?? '');
  if (near) {
    const side = { enemies: 'enemy', all: 'any' }[near[1]] ?? 'ally';
    const others = sideActorsWithin(ctx.actor, Number(near[2]), side);
    return near[1] == 'allies+self' ? [ctx.actor, ...others] : others;
  }

  return [ctx.actor];
}

function worldList(collection) {
  return collection?.contents ?? (collection ? [...collection] : []);
}

/** The actors (world, and unlinked tokens on the canvas) carrying a mark under `key` that `setter` put there. */
function markedBy(setter, key) {
  const found = new Set();
  const consider = actor => {
    if (actor?.flags?.essence20?.ruleMarks?.[key]?.by == setter.uuid) {
      found.add(actor);
    }
  };

  worldList(globalThis.game?.actors).forEach(consider);
  (globalThis.canvas?.tokens?.placeables ?? []).forEach(token => consider(token.actor));
  return [...found];
}

/** Same side: token dispositions on the canvas, else PC vs not. */
function sameSideOf(a, b) {
  const ta = a?.getActiveTokens?.()?.[0];
  const tb = b?.getActiveTokens?.()?.[0];
  if (ta && tb) {
    return (ta.document?.disposition ?? 0) == (tb.document?.disposition ?? 0);
  }

  return (a?.type == 'playerCharacter') == (b?.type == 'playerCharacter');
}

function withoutSelf(to, list, self) {
  return String(to).endsWith('+others') ? list.filter(actor => actor !== self) : list;
}

/** The users who own an actor, and the GMs. */
function ownerIdsOf(actor) {
  return worldList(globalThis.game?.users).filter(user => user.isGM || actor?.testUserPermission?.(user, 'OWNER')).map(user => user.id);
}

/** The Party actor an actor is on (the primary Party first), or null. */
function partyDocOf(actor) {
  const parties = worldList(globalThis.game?.actors).filter(other => other?.type == 'party');
  const primary = globalThis.game?.actors?.party ?? null;
  const ordered = primary ? [primary, ...parties.filter(p => p !== primary)] : parties;
  return ordered.find(party => (party.members ?? []).includes(actor)) ?? null;
}

/** The Party roster an actor is on (the primary Party first); just the actor when it's on none. */
function partyOf(actor) {
  const parties = worldList(globalThis.game?.actors).filter(other => other?.type == 'party');
  const primary = globalThis.game?.actors?.party ?? null;
  const ordered = primary ? [primary, ...parties.filter(p => p !== primary)] : parties;
  const holding = ordered.find(party => (party.members ?? []).includes(actor));
  return holding ? holding.members : [actor];
}

/** Update a document, through the GM when this user can't write to it. */
async function write(doc, method, args) {
  const { needsGmRelay, relayToGm } = await import("../mechanics/world/gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, method, args);
  }

  return doc[method](...args);
}

/* -------------------------------------------- */
/*  Resources                                    */
/* -------------------------------------------- */

/**
 * The Story Point helpers (mechanics/resources/story-points.mjs), handed in at start-up by essence20.mjs - that file
 * pulls in the settings module, which plain Node can't load. {canSpendForActor, spendForActor,
 * requestStoryPointGrant, poolFor}. Without them (tests), Story Point costs are treated as payable.
 */
let storyPoints = null;
export function setStoryPointHelpers(helpers) {
  storyPoints = helpers;
}

/**
 * The actor's base Role Points item (Cheer Points, Terror, Energon...), as the sheet shows it - or, given
 * a name ({rolePoints: "Moxie"}), the Role Points item of that name (an additive Role's own).
 */
export function rolePointsOf(actor, name = null) {
  if (typeof name == 'string' && name) {
    const all = actor?.items?.contents ?? [...(actor?.items ?? [])];
    return all.find(item => item.type == 'rolePoints' && item.name?.toLowerCase() == name.toLowerCase()) ?? null;
  }

  const base = actor?._getBaseRolePoints?.();
  if (base) {
    return base;
  }

  const items = actor?.items?.contents ?? [...(actor?.items ?? [])];
  return items.find(item => item.type == 'rolePoints' && !item.flags?.essence20?.parentId)
    ?? items.find(item => item.type == 'rolePoints') ?? null;
}

/**
 * A resource reference: {pool: key} (a Pool on the rule's item), {path: "system.x.value"} (a number
 * on the actor), {rolePoints: true} (the actor's Role Points - Cheer, Terror...; {rolePoints: "Moxie"} for
 * the Role Points item of that name), or
 * {storyPoints: true} (the party's Story Points).
 */
export function readResource(resource, ctx) {
  if (resource?.rolePoints) {
    return Number(rolePointsOf(ctx.actor, resource.rolePoints)?.system?.resource?.value) || 0;
  }

  if (resource?.pool) {
    return Number(ctx.item?.flags?.essence20?.rules?.pools?.[resource.pool]?.value) || 0;
  }

  if (resource?.path) {
    return Number(globalThis.foundry?.utils?.getProperty?.(ctx.actor, resource.path)) || 0;
  }

  return 0;
}

/** Whether the actor can pay this resource cost. Story Points are checked by their own spend. */
export function canAfford(resource, amount, ctx) {
  if (!resource || !amount) {
    return true;
  }

  // The same gate the hand-written Story Point spends use: this client can spend for the actor, and
  // the actor's own pool (the Party's, or the GM's for a Threat) can afford it.
  if (resource.storyPoints) {
    return storyPoints ? !!storyPoints.canSpendForActor(ctx.actor, amount) : true;
  }

  return readResource(resource, ctx) >= amount;
}

/** Add (or with a negative amount, take) a resource. Resolves false when it couldn't be paid. */
export async function changeResource(resource, amount, ctx, { overMax = false } = {}) {
  if (!resource || !amount) {
    return true;
  }

  if (resource.storyPoints) {
    if (!storyPoints) {
      return true;
    }

    if (amount > 0) {
      // A player's grant is relayed to the GM, so with no GM connected it would go nowhere: warn and
      // stop, leaving the Use (and its limit) untouched - the same as the hand-written grants.
      if (storyPoints.canWriteStoryPoints && !storyPoints.canWriteStoryPoints()) {
        globalThis.ui?.notifications?.warn?.(T('NoGmForStoryPoints'));
        return false;
      }

      await storyPoints.requestStoryPointGrant(ctx.actor, amount, { pool: storyPoints.poolFor(ctx.actor) });
      return true;
    }

    // requestStoryPointSpend answers nothing (a player's spend is relayed to the GM), so check first.
    if (!storyPoints.canSpendForActor(ctx.actor, -amount)) {
      return false;
    }

    await storyPoints.spendForActor(ctx.actor, -amount);
    return true;
  }

  const current = readResource(resource, ctx);
  if (amount < 0 && current < -amount) {
    return false;
  }

  if (resource.rolePoints) {
    const points = rolePointsOf(ctx.actor, resource.rolePoints);
    if (!points) {
      return false;
    }

    const max = Number(points?.system?.resource?.max);
    const next = Math.max(0, current + amount);
    await write(points, 'update', [{ 'system.resource.value': Number.isFinite(max) && max > 0 ? Math.min(max, next) : next }]);
    return true;
  }

  if (resource.pool) {
    const { poolMax } = await import("./adapter.mjs");
    const rule = (ctx.item?.system?.rules ?? []).find(r => r?.type == 'Pool' && r.key == resource.pool);
    const max = rule ? poolMax(rule, ctx.actor, ctx.item) : Infinity;
    await ctx.item.update({ [`flags.essence20.rules.pools.${resource.pool}.value`]: Math.max(0, Math.min(max, current + amount)) });
    return true;
  }

  // A gain stops at the matching .max beside a .value path (system.powers.personal.value -> .max),
  // without taking away anything already above it.
  const maxPath = /\.value$/.test(resource.path) ? resource.path.replace(/\.value$/, '.max') : null;
  const max = maxPath ? Number(globalThis.foundry?.utils?.getProperty?.(ctx.actor, maxPath)) : NaN;
  const next = amount > 0 && !overMax && Number.isFinite(max) && max > 0 ? Math.max(current, Math.min(max, current + amount)) : current + amount;
  await write(ctx.actor, 'update', [{ [resource.path]: Math.max(0, next) }]);
  return true;
}

/* -------------------------------------------- */
/*  Steps                                        */
/* -------------------------------------------- */

/**
 * A step's number. @target reads the run's first target; dice it rolls (1d2) are told in its chat and
 * kept as @var.rolled.
 */
const amountOf = (value, ctx, fallback = 0, recipient = null) => {
  const dice = [];
  const amount = Math.round(resolveValue(value, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null, recipient, dice, random: ctx.random, rolled: ctx.rolled ?? null }, fallback));
  if (dice.length) {
    ctx.vars.rolled = dice.reduce((sum, roll) => sum + roll.total, 0);
    // quiet: the step's dice aren't told in chat (Fuel Efficient's d4s, with nothing to show when no 4 comes up).
    if (ctx.quiet) {
      return amount;
    }

    ctx.chat.push(T('DiceRolled', { dice: dice.map(roll => `${roll.formula} (${roll.results.join(', ')})`).join(' + '), total: amount }));
  }

  return amount;
};

/**
 * A spend whose amount the player picks: `amount: {min, max}` (each a number or formula). Asks for
 * the number; null when they back out.
 */
async function pickAmount(step, ctx) {
  const min = Math.max(0, amountOf(step.amount.min ?? 1, ctx, 1));
  const max = Math.max(min, amountOf(step.amount.max ?? min, ctx, min));
  if (min == max) {
    return min;
  }

  if (ctx.askNumber) {
    return ctx.askNumber(step, min, max, ctx);
  }

  const { DialogV2 } = foundry.applications.api;
  const start = step.value === undefined ? min : Math.min(max, Math.max(min, Math.round(amountOf(step.value, ctx, min))));
  const value = await DialogV2.prompt({
    window: { title: ctx.item?.name ?? '' },
    classes: ['essence20', 'e20-window'],
    content: `<p>${escape(step.prompt ?? T('HowMany'))}</p><input type="number" name="amount" min="${min}" max="${max}" value="${start}" autofocus>`,
    ok: { callback: (event, button) => Number(button.form.elements.amount.value) },
    rejectClose: false,
  });
  return value === null || value === undefined || !Number.isFinite(value) ? null : Math.min(max, Math.max(min, Math.round(value)));
}

const HANDLERS = {
  // {name} the actor, {target} the first target, {var.<key>} a value an earlier step stored (@var.<key>),
  // {choice.<key>} a pick on the rule's item.
  async chat(step, ctx) {
    const text = escape(fillText(String(step.text ?? ''), ctx));
    ctx.chat.push(text.replace(/\{name\}/g, escape(ctx.actor?.name)).replace(/\{target\}/g, escape(ctx.targets[0]?.name ?? '')));
  },

  async spend(step, ctx) {
    const ranged = step.amount && typeof step.amount == 'object';
    const amount = ranged ? await pickAmount(step, ctx) : amountOf(step.amount ?? 1, ctx, 1);
    if (amount === null) {
      return false;
    }

    if (await changeResource(step.resource, -amount, ctx)) {
      // What was taken - later steps read it as @spent.
      ctx.vars.spent = amount;
      return true;
    }

    ctx.chat.push(T('NotEnough', { name: escape(ctx.actor?.name) }));
    if (step.onFail) {
      await runSteps(step.onFail, ctx);
    }

    return false;
  },

  async gainResource(step, ctx) {
    // False (stop the run) when it couldn't be given - Story Points with no GM to receive them. overMax: past the .max.
    return changeResource(step.resource, amountOf(step.amount ?? 1, ctx, 1), ctx, { overMax: !!step.overMax });
  },

  async loseHealth(step, ctx) {
    const amount = Math.max(0, amountOf(step.amount ?? 1, ctx, 1));
    for (const actor of recipients(step, ctx)) {
      const value = Number(actor.system?.health?.value);
      if (!Number.isFinite(value) || !amount) {
        continue;
      }

      await write(actor, 'update', [{ 'system.health.value': Math.max(0, value - amount) }]);
      ctx.chat.push(T('LostHealth', { name: escape(actor.name), amount }));
    }
  },

  async heal(step, ctx) {
    const amount = amountOf(step.amount ?? 1, ctx, 1);
    for (const actor of recipients(step, ctx)) {
      const health = actor.system?.health;
      if (!health) {
        continue;
      }

      // tracked: temporary Health through the resource slice's ledger (mechanics/resources/temporary-resources.mjs) -
      // raises the bonus and the value, and is taken back when it runs out (scene end, or damage with untilDamage).
      if (step.temporary && step.tracked) {
        const { grantTemp } = await import("../mechanics/resources/temporary-resources.mjs");
        await grantTemp(actor, { kind: 'health', amount, source: ctx.item?.name ?? '', by: ctx.actor?.uuid ?? null, untilDamage: !!step.untilDamage });
        ctx.chat.push(T('TempHealth', { name: escape(actor.name), amount }));
        continue;
      }

      // Temporary Health: added on top (system.health.bonus), as You Got This! and Boosted Vigor do.
      if (step.temporary) {
        await write(actor, 'update', [{ 'system.health.bonus': (Number(health.bonus) || 0) + amount }]);
        ctx.chat.push(T('TempHealth', { name: escape(actor.name), amount }));
        continue;
      }

      const max = Number(health.max);
      const value = Number(health.value) || 0;
      // Capped at the maximum, but never below where it started - a heal must not lower Health (an
      // actor whose maximum works out to 0, or one already above it, keeps what it has).
      const capped = Number.isFinite(max) && max > 0 ? Math.min(max, value + amount) : value + amount;
      const next = Math.max(value, capped);
      const wasDefeated = !!actor.statuses?.has?.('defeated');
      await write(actor, 'update', [{ 'system.health.value': next }]);
      // A real-Health heal brings the Defeated back, as the hand-written heal Skill Test does
      // (items/healing/heal-skill-test.mjs#applyHealSkillTestResult).
      if (wasDefeated && next > 0) {
        await write(actor, 'toggleStatusEffect', ['defeated', { active: false }]);
      }

      ctx.chat.push(T('Healed', { name: escape(actor.name), amount: next - value }));
    }
  },

  async damage(step, ctx) {
    let amount = amountOf(step.amount ?? 1, ctx, 1);
    // damageType may read a pick ({choice.<key>}) or a value stored in the run ({var.<key>}).
    const type = fillText(String(step.damageType ?? 'blunt'), ctx) || 'blunt';
    // asCastHit (round 15, items2 - Temper Tempest's lightning): the damage counts as one of the rule item's (a spell's)
    // cast hits - the actor's cast HitRider rules for it add their part (plugins/combat/cast-hit-damage.mjs).
    if (step.asCastHit) {
      const { castHitDamage } = await import("./plugins/combat/cast-hit-damage.mjs");
      amount = await castHitDamage(ctx.actor, ctx.item, amount, type);
      ctx.vars.damage = amount;
    }

    const { applyDamage } = await import("../mechanics/combat/combat.mjs");
    for (const actor of recipients(step, ctx)) {
      if (actor.isOwner) {
        await applyDamage(actor, amount, type);
        ctx.chat.push(T('Damaged', { name: escape(actor.name), amount, type }));
      } else {
        ctx.chat.push(T('DamageForGm', { name: escape(actor.name), amount, type }));
      }
    }
  },

  // Essence damage: `essence` (strength, speed, smarts, social, {choice.<key>}, or "choose" to ask), amount
  // points, never below 0 - the same system.essences.<x>.value a Rest restores (mechanics/world/environment-hazards.mjs).
  async essenceDamage(step, ctx) {
    const amount = Math.max(0, amountOf(step.amount ?? 1, ctx, 1));
    const essence = await essenceFor(step, ctx);
    if (!essence) {
      return false;
    }

    for (const actor of recipients(step, ctx)) {
      const value = Number(actor.system?.essences?.[essence]?.value);
      if (!Number.isFinite(value) || value <= 0 || !amount) {
        continue;
      }

      const { needsGmRelay } = await import("../mechanics/world/gm-relay.mjs");
      let dealt = 0;
      if (needsGmRelay(actor)) {
        dealt = Math.min(value, amount);
        await write(actor, 'update', [{ [`system.essences.${essence}.value`]: value - dealt }]);
      } else {
        const { applyEssenceDamage } = await import("../mechanics/world/environment-hazards.mjs");
        for (let i = 0; i < amount; i++) {
          dealt += (await applyEssenceDamage(actor, [essence])).length;
        }
      }

      ctx.chat.push(T('EssenceDamaged', { name: escape(actor.name), amount: dealt, essence: escape(essenceLabel(essence)) }));
    }
  },

  // Heal Essence damage: one Essence (as essenceDamage), or with none named the most-damaged first.
  async healEssence(step, ctx) {
    const amount = Math.max(0, amountOf(step.amount ?? 1, ctx, 1));
    const essence = step.essence ? await essenceFor(step, ctx) : null;
    if (step.essence && !essence) {
      return false;
    }

    for (const actor of recipients(step, ctx)) {
      let healed = 0;
      if (essence) {
        const { max, value } = actor.system?.essences?.[essence] ?? {};
        healed = Math.max(0, Math.min(Number(max) - Number(value), amount)) || 0;
        if (healed) {
          await write(actor, 'update', [{ [`system.essences.${essence}.value`]: Number(value) + healed }]);
        }
      } else {
        const { healEssenceDamage } = await import("../mechanics/combat/essence-damage.mjs");
        healed = await healEssenceDamage(actor, amount);
      }

      ctx.chat.push(T('EssenceHealed', { name: escape(actor.name), amount: healed }));
    }
  },

  // A Condition the recipient already has lasts `rounds` longer (a timed one; an untimed one is left alone).
  async extendCondition(step, ctx) {
    const rounds = amountOf(step.rounds ?? 1, ctx, 1);
    for (const actor of recipients(step, ctx)) {
      const effects = actor.effects?.contents ?? (actor.effects ? [...actor.effects] : []);
      const effect = effects.find(candidate => candidate.statuses?.has?.(step.condition));
      if (!effect || !(Number(effect.duration?.rounds) > 0)) {
        continue;
      }

      await write(effect, 'update', [{ 'duration.rounds': Number(effect.duration.rounds) + rounds }]);
      ctx.chat.push(T('ConditionExtended', { name: escape(actor.name), condition: escape(step.condition), rounds }));
    }
  },

  // Change numbers or values on actors (any recipient): set {path: value | formula | true/false}, add {path: formula},
  // with min / max limits on the result.
  async updateActor(step, ctx) {
    for (const actor of recipients(step, ctx)) {
      const update = {};
      // min / max may be formulas, worked out for each recipient (@recipient.system.powers.personal.max).
      const low = step.min === undefined ? -Infinity : amountOf(step.min, ctx, -Infinity, actor);
      const high = step.max === undefined ? Infinity : amountOf(step.max, ctx, Infinity, actor);
      const clamp = value => Math.min(high, Math.max(low, value));
      // set / add paths may read a pick too (system.essences.{choice.essence}.max); with no pick, left alone.
      for (const [rawPath, value] of Object.entries(flattenPaths(step.set))) {
        const path = interpolate(rawPath, ctx.item);
        if (path) {
          update[path] = typeof value == 'boolean' ? value : typeof value == 'number' || /^[\d@(-]/.test(String(value)) ? clamp(amountOf(value, ctx, 0, actor)) : fillText(String(value), ctx);
        }
      }

      for (const [rawPath, value] of Object.entries(flattenPaths(step.add))) {
        const path = interpolate(rawPath, ctx.item);
        if (!path) {
          continue;
        }

        const current = Number(globalThis.foundry?.utils?.getProperty?.(actor, path)) || 0;
        update[path] = clamp(current + amountOf(value, ctx, 0, actor));
      }

      // ladder: {path: steps} - move a Skill die along d20, d2, d4 ... 3d6 (Dabbler's "one step up"); ladderMax caps it
      // (d12), ladderMin floors it.
      // A path may read a pick (system.skills.{choice.lower}.shift); with no pick it's left alone.
      for (const [rawPath, value] of Object.entries(step.ladder ?? {})) {
        const path = interpolate(rawPath, ctx.item);
        if (!path) {
          continue;
        }

        const ranks = ['d20', 'd2', 'd4', 'd6', 'd8', 'd10', 'd12', '2d8', '3d6'];
        const at = Math.max(0, ranks.indexOf(String(globalThis.foundry?.utils?.getProperty?.(actor, path) ?? 'd20')));
        const top = step.ladderMax && ranks.includes(step.ladderMax) ? ranks.indexOf(step.ladderMax) : ranks.length - 1;
        const bottom = step.ladderMin && ranks.includes(step.ladderMin) ? ranks.indexOf(step.ladderMin) : 0;
        update[path] = ranks[Math.min(top, Math.max(bottom, at + amountOf(value, ctx, 0, actor)))];
      }

      // notSpent (round 18, convB): the write is a loss / refund, not a spend - resourceSpent Triggers and the
      // resource slice's spend hooks skip it (Body of Energy's split on leaving Morph).
      if (Object.keys(update).length) {
        await write(actor, 'update', step.notSpent ? [update, { essence20Loss: true, essence20Refund: true }] : [update]);
      }
    }
  },

  // Spend an action (free | move | standard) through the action economy - a Trigger's own cost. Stops when it can't.
  async spendAction(step, ctx) {
    const { spend } = await import("../mechanics/actions/action-economy.mjs");
    const paid = await spend(ctx.actor, step.action ?? 'free', { source: ctx.item?.name ?? null });
    return paid?.blocked ? false : undefined;
  },

  // One Skill Test against each recipient's own Defense, on one card (react/core.mjs#rollVsMany); onHit / onMiss steps
  // run for each recipient with it as the target. @var.hits counts the hits.
  async rollVsEach(step, ctx) {
    const others = recipients({ ...step, to: step.to ?? 'targets' }, ctx);
    if (!others.length) {
      ctx.chat.push(T('NeedsTarget', { item: escape(ctx.item?.name) }));
      return false;
    }

    const skill = skillFor(step, ctx);
    if (!skill) {
      ctx.chat.push(T('NoWieldedSkill', { item: escape(ctx.item?.name) }));
      return false;
    }

    const { rollVsMany } = await import("../mechanics/combat/reaction-engine.mjs");
    // essence: roll with that Essence instead of the Skill's own (an older Use rolled Intimidation as Social).
    // damage {value, type}: the card carries Apply Damage buttons (x Degrees of Success) - dice.mjs's dataset.stepDamage;
    // dataset: flags the roll carries (roll:dataset:<key> in Triggers - Takedown's isTakedown).
    const extra = { ...(step.dataset && typeof step.dataset == 'object' ? step.dataset : {}) };
    if (step.damage && typeof step.damage == 'object') {
      extra.stepDamage = { value: amountOf(step.damage.value ?? 1, ctx, 1), type: fillText(String(step.damage.type ?? 'blunt'), ctx) || 'blunt' };
    }

    const more = Object.keys(extra).length ? [step.essence ?? null, extra] : step.essence ? [step.essence] : [];
    // defense fills {var.x} / {choice.x} (round 16: a Defense chosen or worked out earlier in the run - Ground Suppression,
    // Tech Specs' highest Defense).
    const rows = await rollVsMany(ctx.actor, skill, others, fillText(String(step.defense ?? 'toughness'), ctx) || 'toughness', ...more);
    const saved = ctx.targets;
    ctx.vars.hits = 0;
    for (const other of others) {
      const row = rows.find(r => r.targetUuid == other.uuid);
      if (!row) {
        continue;
      }

      ctx.vars.hits += row.success ? 1 : 0;
      ctx.targets = [other];
      // onDouble: a success by double the DIF or more (Degrees of Success x2+, the plain Skill Test's Critical Success)
      // runs instead of onHit.
      const branch = row.success && Number(row.multiplier) >= 2 && Array.isArray(step.onDouble) ? step.onDouble : row.success ? step.onHit : step.onMiss;
      if (Array.isArray(branch)) {
        await runSteps(branch, ctx);
      }
    }

    ctx.targets = saved;
  },

  // Knock a held weapon out of each recipient's hands (mechanics/combat/target-riders.mjs#disarm - the owner picks it back up by
  // equipping it): maxHands (weapons held in that many hands or fewer), optional (the player may skip).
  async disarm(step, ctx) {
    const { disarm } = await import("../mechanics/combat/target-riders.mjs");
    let dropped = 0;
    for (const other of recipients({ ...step, to: step.to ?? 'target' }, ctx)) {
      // payFree (round 15): one Free action per hand of the weapon picked, paid before it drops (in a combat).
      const weapon = await disarm(ctx.actor, other, { maxHands: amountOf(step.maxHands ?? 2, ctx, 2), optional: !!step.optional, payFree: !!step.payFree, source: ctx.item?.name ?? '' });
      if (weapon) {
        dropped++;
        ctx.chat.push(T('Disarmed', { name: escape(other.name), item: escape(weapon.name) }));
      }
    }

    ctx.vars.disarmed = dropped;
    if (!dropped && step.required) {
      return false;
    }
  },

  // Take an item from someone: `item` is choice:<key> (a pick from: targetItem) or an item selector asked of the first
  // target; the actor gets a copy and the target loses it (Pillage, Takedown Expert).
  async takeItem(step, ctx) {
    const from = ctx.targets[0];
    let item = null;
    const pick = /^choice:([\w-]+)$/.exec(String(step.item ?? ''));
    if (pick) {
      const stored = ctx.item?.flags?.essence20?.rules?.choices?.[pick[1]];
      item = stored ? globalThis.fromUuidSync?.(stored, { strict: false }) ?? null : null;
    } else if (from) {
      [item] = itemsFor(step, from, ctx);
    }

    const owner = item?.parent;
    if (!item || !owner) {
      ctx.chat.push(T('NoSuchItem', { name: escape(from?.name ?? '') }));
      return false;
    }

    const data = item.toObject();
    delete data._id;
    await write(ctx.actor, 'createEmbeddedDocuments', ['Item', [data]]);
    await write(owner, 'deleteEmbeddedDocuments', ['Item', [item.id]]);
    ctx.chat.push(T('ItemTaken', { name: escape(ctx.actor?.name), item: escape(item.name), from: escape(owner.name) }));
  },

  // Store a value for later steps (@var.<key>) - and, in a Trigger, for the Triggers after it on the same event
  // (a refund lowering @var.spent for the next resourceSpent Trigger).
  async setVar(step, ctx) {
    ctx.vars[step.key] = typeof step.value == 'string' && !/^[\d@(-]/.test(step.value) && !/\(/.test(step.value) ? fillText(step.value, ctx) : amountOf(step.value ?? 0, ctx, 0);
  },

  // Stop here unless `when` holds (with `message` posted). With beforeCost it runs before a Use's cost is paid.
  async require(step, ctx) {
    const holds = evaluate(step.check ?? [], contextFor({ self: ctx.actor, ruleItem: ctx.item, other: ctx.targets[0] ?? null, vars: ctx.vars })) === true;
    if (!holds) {
      if (step.message) {
        ctx.chat.push(escape(fillText(String(step.message), ctx)));
      }

      return false;
    }
  },

  // Make the recipients the user's targets (a counter-attack at the one who attacked).
  async setTargets(step, ctx) {
    const ids = recipients(step, ctx).map(actor => actor.getActiveTokens?.()?.[0]?.id).filter(Boolean);
    globalThis.canvas?.tokens?.setTargets?.(ids);
    ctx.targets = recipients(step, ctx);
  },

  // Set the recipients' Initiative in the running combat (a formula).
  async writeInitiative(step, ctx) {
    const combat = globalThis.game?.combat;
    if (!combat) {
      return false;
    }

    for (const actor of recipients(step, ctx)) {
      const combatant = (combat.combatants?.contents ?? [...(combat.combatants ?? [])]).find(c => c.actor === actor || c.actorId == actor.id);
      if (combatant) {
        // exact: the value as worked out, not rounded ("just after them" - their Initiative - 0.01).
        const value = step.exact ? Number(resolveValue(step.value ?? 0, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null, recipient: actor }, 0)) || 0 : amountOf(step.value ?? 0, ctx, 0);
        await write(combatant, 'update', [{ initiative: value }]);
        ctx.chat.push(T('InitiativeSet', { name: escape(actor.name), value }));
      }
    }
  },

  // Roll `formula` and use the row it lands in: rows [{min, max, text, steps}] (text posted, steps run). @var.rolled.
  async table(step, ctx) {
    const value = amountOf(step.formula ?? '1d6', ctx, 0);
    ctx.vars.rolled = value;
    const row = (Array.isArray(step.rows) ? step.rows : []).find(r => value >= Number(r.min ?? -Infinity) && value <= Number(r.max ?? r.min ?? Infinity));
    if (!row) {
      return;
    }

    // Row text may be an i18n key (E20.Rules.Table...), so no book text needs to sit in pack data.
    if (row.text) {
      const text = String(row.text);
      ctx.chat.push(escape(fillText(globalThis.game?.i18n?.has?.(text) ? globalThis.game.i18n.localize(text) : text, ctx)));
    }

    return Array.isArray(row.steps) ? runSteps(row.steps, ctx) : undefined;
  },

  async applyCondition(step, ctx) {
    const rounds = amountOf(step.rounds ?? 0, ctx, 0);
    // condition may read a pick or a run value, as removeCondition's does (round 17, split3 - Synaptic Linkage passes the
    // Condition it took off).
    const condition = fillText(String(step.condition ?? ''), ctx);
    if (!condition) {
      return;
    }

    for (const actor of recipients(step, ctx)) {
      const { needsGmRelay, relayToGm } = await import("../mechanics/world/gm-relay.mjs");
      // until: nextTurn | endOfNextTurn (+ untilOf) - ends with the holder's (or recipient's) next turn (book check
      // 2026-10-06, durations: timed-status.mjs#turnBoundTiming); not in the turn order: 1 round.
      let timing = null;
      // A registered duration change for this recipient (registerConditionDuration - Gallantry's halving).
      const lasts = conditionDurationFor(actor, condition, { until: step.until, rounds, untilActor: untilActor(step, ctx, actor) }, ctx);
      let roundsHere = lasts.rounds;
      if (lasts.until) {
        const { turnBoundTiming } = await import("../mechanics/combat/timed-status.mjs");
        timing = typeof turnBoundTiming == 'function' ? turnBoundTiming(lasts.until, lasts.untilActor) : null;
        roundsHere = timing || lasts.rounds ? lasts.rounds : 1;
      }

      if (needsGmRelay(actor) && (roundsHere || timing)) {
        // Through the GM with its rounds (react/core.mjs's status op runs applyTimedCondition there).
        const { gmDo } = await import("../mechanics/combat/reaction-engine.mjs");
        await gmDo({ kind: 'status', uuid: actor.uuid, status: condition, rounds: roundsHere, ...(timing ? { timing } : {}) }, null, ctx.actor);
      } else if (needsGmRelay(actor)) {
        await relayToGm(actor, 'toggleStatusEffect', [condition, { active: true }]);
      } else {
        const { applyTimedCondition } = await import("../mechanics/combat/timed-status.mjs");
        await (timing ? applyTimedCondition(actor, condition, roundsHere, timing) : applyTimedCondition(actor, condition, roundsHere));
      }

      ctx.chat.push(T('Condition', { name: escape(actor.name), condition: escape(condition) }));
    }
  },

  async removeCondition(step, ctx) {
    // condition may read a pick ({choice.<key>} - a pick from: conditions) or a run value ({var.<key>}).
    const condition = fillText(String(step.condition ?? ''), ctx);
    for (const actor of recipients(step, ctx)) {
      if (condition && actor.statuses?.has?.(condition)) {
        await write(actor, 'toggleStatusEffect', [condition, { active: false }]);
      }
    }
  },

  async roll(step, ctx) {
    const { rollTest } = await import("../mechanics/resources/grants.mjs");
    // difDefense: the target's Defense is the DIF (Toughness, Evasion...), like an attack.
    let dif = amountOf(step.dif ?? 10, ctx, 10);
    if (step.difDefense) {
      // difDefenseSelf: with no target, the actor's own Defense (Eat the Weak on itself).
      const target = ctx.targets[0] ?? (step.difDefenseSelf ? ctx.actor : null);
      if (!target) {
        ctx.chat.push(T('NeedsTarget', { item: escape(ctx.item?.name) }));
        return false;
      }

      dif = Number(target.system?.defenses?.[step.difDefense]?.total) || dif;
    }

    // An Edge on this roll: always (edge), or when edgeWhen's tags hold (target: = the first target).
    let edge = !!step.edge;
    if (!edge && Array.isArray(step.edgeWhen) && step.edgeWhen.length) {
      const { contextFor, evaluate } = await import("./predicate.mjs");
      edge = evaluate(step.edgeWhen, contextFor({ self: ctx.actor, other: ctx.targets[0] ?? null, ruleItem: ctx.item, rolledSkill: step.skill })) === true;
    }

    // itemUuid: the roll belongs to this Use's item, for afterRoll / hit Triggers' `item:own`.
    // In a Reaction (ctx.card) the DIF is flat: react/core.mjs#rollVs clears the user's targets first (dice.mjs compares
    // against targets before a flat DIF), and a cancelled roll stops the run, so nothing is spent or claimed.
    // essence: roll with that Essence instead of the Skill's own.
    // dataset: flags the roll carries (roll:dataset:<key> - Brutal Verbalities' Rouse attempt).
    // Dataset values fill {var.x} / {choice.x} as createItem's data does - a lone one keeps its value, a number stays a
    // number (round 15: markedItemUuid - the item a repair test is about; Patch Up's patchUpAmount).
    const extra = {
      ...(step.dataset && typeof step.dataset == 'object' ? fillData(step.dataset, ctx) : {}),
      ...(edge ? { edge: true } : {}), ...(step.snag ? { snag: true } : {}), ...(ctx.item?.uuid ? { itemUuid: ctx.item.uuid } : {}), ...(step.essence ? { essence: step.essence } : {}),
      // downshift (round 16, part b): ↓ on the roll, a formula (Dominate's cumulative ↓1 per command so far).
      ...(step.downshift !== undefined ? { shiftDown: Math.max(0, amountOf(step.downshift, ctx, 0)) } : {}),
    };
    // open: an ordinary roll with no DIF of its own (against whoever is targeted, as from the sheet); then: steps after.
    if (step.open) {
      const openSkill = skillFor(step, ctx);
      const essence = globalThis.CONFIG?.E20?.skillToEssence?.[openSkill] ?? 'smarts';
      // The Skill's own standing shifts and Specialized flag, as a sheet roll passes them - sheetShifts: false leaves them
      // out (the hand-written "rollSkill({skill, shiftUp: 0, shiftDown: 0})" a Use button made - On Target).
      const fields = ctx.actor?.system?.skills?.[openSkill] ?? {};
      const sheet = step.sheetShifts === false
        ? { shiftUp: 0, shiftDown: 0 }
        : { shift: fields.shift, shiftUp: fields.shiftUp ?? 0, shiftDown: fields.shiftDown ?? 0, isSpecialized: fields.isSpecialized };
      const result = await ctx.actor?._dice?.rollSkill?.({ rollType: 'skill', skill: openSkill, essence, ...sheet, ...extra }, ctx.actor);
      if (!result || result.cancelled) {
        return false;
      }

      // A roll with nothing to compare against has no results - its total is the outcome's roll (dice.mjs#_rollSkillHelper).
      const outcome = result.outcomes?.[0];
      ctx.vars.lastRoll = { success: !!result.success, total: Number(result.total ?? outcome?.roll?.total ?? outcome?.results?.[0]?.total) || 0 };
      ctx.vars.rollTotal = ctx.vars.lastRoll.total;
      return step.then ? runSteps(step.then, ctx) : undefined;
    }

    const skill = skillFor(step, ctx);
    if (!skill) {
      ctx.chat.push(T('NoWieldedSkill', { item: escape(ctx.item?.name) }));
      return false;
    }

    // sheetShifts: true - the Skill's own standing shifts and Specialized flag come with the DIF roll too (a hand-written
    // rollSkillTotal(actor, skill, {dif}) Use - the Scramble Field Generator's), as the open roll passes them.
    if (step.sheetShifts === true) {
      const fields = ctx.actor?.system?.skills?.[skill] ?? {};
      Object.assign(extra, { shift: fields.shift, shiftUp: fields.shiftUp ?? 0, shiftDown: fields.shiftDown ?? 0, isSpecialized: fields.isSpecialized, rollType: 'skill' }, { ...extra });
    }

    const result = ctx.card
      ? await (await import("../mechanics/combat/reaction-engine.mjs")).rollVs(ctx.actor, skill, dif, extra)
      : await rollTest(ctx.actor, skill, dif, extra);
    if (ctx.card && result.cancelled) {
      return false;
    }

    ctx.vars.lastRoll = result;
    // @var.rollTotal: the roll's total (Best-Laid Plans' pool size).
    ctx.vars.rollTotal = Number(result?.total) || 0;
    // @var.multiplier: the Degrees of Success (0 on a failure) - "1 Health, multiplied on a high degree of success".
    ctx.vars.multiplier = Number.isFinite(Number(result?.multiplier)) ? Number(result.multiplier) : (result?.success ? 1 : 0);
    const branch = result.crit && step.onCrit ? step.onCrit : result.success ? step.onSuccess : step.onFail;
    if (branch) {
      return runSteps(branch, ctx);
    }
  },

  // Choose something and store it on the rule's item under `key` (flags.essence20.rules.choices): a Skill,
  // an Essence, a damage type, one of the actor's items (itemType, equipped), an ally / enemy (within), a
  // target, or a list. Read back with {choice.<key>}, item:picked:<key>, self: / target:picked:<key> and the
  // item steps' choice:<key>. ifUnset keeps an earlier pick. @var.picked is the value.
  async pick(step, ctx) {
    const key = String(step.key ?? '');
    const own = ctx.item;
    if (!key || !own) {
      return false;
    }

    // legacy: where an older version of this item kept the pick (rules/legacy-choices.mjs).
    let stored = own.flags?.essence20?.rules?.choices?.[key];
    if (!stored && step.legacy) {
      const { legacyValue } = await import("./legacy-choices.mjs");
      stored = legacyValue(step.legacy, own, ctx.actor);
    }

    if (step.ifUnset && stored) {
      ctx.vars.picked = stored;
      return;
    }

    const options = pickOptions(step, ctx);
    // optional (round 16, part b): nothing to pick, or a cancelled pick, leaves the choice unmade and the run goes on.
    if (!options.length) {
      if (step.optional) {
        return;
      }

      ctx.chat.push(T('NothingToPick', { item: escape(own.name) }));
      return false;
    }

    // auto: a lone option is taken without asking.
    const value = step.auto && options.length == 1 ? options[0].value : await (ctx.askPick ?? askPick)(step, options, ctx);
    const chosen = options.find(option => option.value == value);
    if (!chosen) {
      return step.optional ? undefined : false;
    }

    await write(own, 'update', [{ [`flags.essence20.rules.choices.${key}`]: chosen.value }]);
    globalThis.foundry?.utils?.setProperty?.(own, `flags.essence20.rules.choices.${key}`, chosen.value);
    ctx.vars.picked = chosen.value;
    ctx.chat.push(T('Picked', { item: escape(own.name), choice: escape(chosen.label) }));
  },

  // A chat card with a button that runs `steps` when pressed (rules/buttons.mjs): who may press it (owner,
  // gm, anyone, targets, others), runAs (holder, or the clicker's own character), once (default true).
  // The current targets go with it.
  async button(step, ctx) {
    if (!globalThis.ChatMessage?.create || !Array.isArray(step.steps)) {
      return false;
    }

    // Label and intro fill {name}, {target}, {var.x}, {choice.x} and {@formula}, as chat text does.
    const fill = text => fillText(String(text), ctx).replace(/\{name\}/g, ctx.actor?.name ?? '').replace(/\{target\}/g, ctx.targets[0]?.name ?? '');
    const label = step.label ? fill(step.label) : ctx.item?.name || '';
    const intro = step.intro ? `<p>${escape(fill(step.intro))}</p>` : '';
    // whisper: owners - only the rule's actor's owners (and the GM) see the card.
    const whisper = step.whisper == 'owners' ? ownerIdsOf(ctx.actor) : undefined;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker?.({ actor: ctx.actor }),
      ...(whisper ? { whisper } : {}),
      content: `<div class="e20-rule-button-card">${intro}<button type="button" data-e20-rule-button>${escape(label)}</button></div>`,
      flags: { essence20: { ruleButton: {
        actorUuid: ctx.actor?.uuid ?? null, itemUuid: ctx.item?.uuid ?? null, targets: ctx.targets.map(target => target.uuid),
        steps: step.steps, label, who: step.who ?? 'owner', runAs: step.runAs ?? 'holder', once: step.once !== false, used: false,
        ...(step.usedWhenDone ? { usedWhenDone: true } : {}),
        // The run's numbers so far (@var.margin, @var.damage...), for the pressed steps to read.
        vars: Object.fromEntries(Object.entries(ctx.vars ?? {}).filter(([, value]) => ['number', 'string', 'boolean'].includes(typeof value))),
        ...(step.limit?.per ? { limit: step.limit } : {}),
      } } },
    });
  },

  // An item made from inline data (a temporary natural weapon, a token of an effect...), like a grant.
  // children: items made with it and attached to it - a weapon's attacks (weaponEffect), an armor's
  // upgrades - the way a compendium weapon brings its own. "{choice.<key>}" in names reads a pick.
  async createItem(step, ctx) {
    if (!step.data || typeof step.data != 'object' || !step.data.name || !step.data.type) {
      return false;
    }

    for (const actor of recipients(step, ctx)) {
      const data = fillData(globalThis.foundry?.utils?.deepClone?.(step.data) ?? JSON.parse(JSON.stringify(step.data)), ctx);
      // unlinked (round 16, part b): no grantedBy - the item (and its children) stays when the rule's item goes
      // (Additional Attack Type's attack). knownTraits: only the weapon traits the system knows are kept.
      if (!step.unlinked) {
        globalThis.foundry?.utils?.setProperty?.(data, 'flags.essence20.grantedBy', ctx.item?.id ?? null);
      }

      if (step.knownTraits) {
        keepKnownTraits(data);
      }

      if (step.until) {
        const { stampFor } = await import("./expiry.mjs");
        globalThis.foundry?.utils?.setProperty?.(data, 'flags.essence20.rulesExpiry', { until: step.until, stamp: stampFor(step.until, undefined, untilActor(step, ctx, actor)) });
      }

      data.name = createdName(data, ctx);
      const created = await write(actor, 'createEmbeddedDocuments', ['Item', [data]]);
      const host = created?.[0] ?? null;
      ctx.vars.granted = host;
      if (host && Array.isArray(step.children) && step.children.length) {
        await createChildren(actor, host, step.children, data.flags?.essence20 ?? {}, ctx);
      }

      ctx.chat.push(T('Granted', { name: escape(actor.name), item: escape(data.name) }));
    }
  },

  // Remove items (its own grants, a target's weapon...). keepGrants (round 15, systems): what the removed items granted
  // stays - unlinked first, since removing a granting item takes its grants with it (Metamorphosis keeps Colony
  // Changeling's Infatuated).
  async deleteItem(step, ctx) {
    for (const actor of recipients(step, ctx)) {
      const items = itemsFor(step, actor, ctx);
      if (items.length && step.keepGrants) {
        const ids = new Set(items.map(item => item.id));
        const owned = actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);
        for (const granted of owned.filter(item => ids.has(item.flags?.essence20?.grantedBy))) {
          await granted.unsetFlag?.('essence20', 'grantedBy');
        }
      }

      if (items.length) {
        await write(actor, 'deleteEmbeddedDocuments', ['Item', items.map(item => item.id)]);
        ctx.chat.push(T('ItemRemoved', { name: escape(actor.name), item: items.map(item => escape(item.name)).join(', ') }));
      } else if (step.required) {
        ctx.chat.push(T('NoSuchItem', { name: escape(actor.name) }));
        return false;
      }
    }
  },

  // Change numbers or values on items: set {path: value} (a formula for numbers), add {path: formula}.
  async updateItem(step, ctx) {
    for (const actor of recipients(step, ctx)) {
      // parent: the selected items' weapons instead (a weaponEffect's parentId - Weapon Conversion's Inaccurate trait).
      const selected = itemsFor(step, actor, ctx);
      const items = step.parent ? selected.map(item => actor.items?.get?.(item.flags?.essence20?.parentId)).filter(Boolean) : selected;
      for (const item of items) {
        const update = {};
        // multiply: {path: factor} - the number there times the factor, rounded down; an empty value stays empty.
        for (const [path, value] of Object.entries(step.multiply ?? {})) {
          const current = globalThis.foundry?.utils?.getProperty?.(item, path);
          if (current !== null && current !== undefined && current !== '') {
            update[path] = Math.floor((Number(current) || 0) * Number(resolveValue(value, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
          }
        }

        // appendTraits: traits the item gains (system.traits), each once.
        if (Array.isArray(step.appendTraits) && step.appendTraits.length) {
          const traits = Array.isArray(item.system?.traits) ? item.system.traits : [];
          if (step.appendTraits.some(trait => !traits.includes(trait))) {
            update['system.traits'] = [...new Set([...traits, ...step.appendTraits])];
          }
        }

        for (const [path, value] of Object.entries(step.set ?? {})) {
          // Text fills {choice.x} / {var.x} / {@formula} (the rolled Skill stored for a later tag).
          update[path] = typeof value == 'number' || /^[\d@(]/.test(String(value)) ? amountOf(value, ctx, 0) : typeof value == 'string' ? fillText(value, ctx) : value;
        }

        for (const [path, value] of Object.entries(step.add ?? {})) {
          const current = Number(globalThis.foundry?.utils?.getProperty?.(item, path)) || 0;
          update[path] = current + amountOf(value, ctx, 0);
        }

        if (Object.keys(update).length) {
          await write(item, 'update', [update]);
        }
      }
    }
  },

  // Use up some of an item's quantity (a dart, a charge); deleteAtZero removes it once none are left.
  async spendQuantity(step, ctx) {
    const amount = Math.max(0, amountOf(step.amount ?? 1, ctx, 1));
    for (const actor of recipients(step, ctx)) {
      const [item] = itemsFor(step, actor, ctx);
      const have = Number(item?.system?.quantity) || 0;
      if (!item || have < amount) {
        ctx.chat.push(T('NoSuchItem', { name: escape(actor.name) }));
        return false;
      }

      if (have - amount <= 0 && step.deleteAtZero) {
        await write(actor, 'deleteEmbeddedDocuments', ['Item', [item.id]]);
      } else {
        await write(item, 'update', [{ 'system.quantity': have - amount }]);
      }

      ctx.chat.push(T('QuantitySpent', { name: escape(actor.name), item: escape(item.name), amount, left: Math.max(0, have - amount) }));
    }
  },

  async grant(step, ctx) {
    // "{choice.x}" - the item picked through a ChoiceSet.
    // {var.<key>} too - a recorded pick granted later ("uuid": "{var.picked}").
    const uuid = interpolate(String(step.uuid ?? ''), ctx.item)?.replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''));
    const source = uuid ? await globalThis.fromUuid?.(uuid) : null;
    if (!source) {
      return;
    }

    for (const actor of recipients(step, ctx)) {
      const data = source.toObject();
      delete data._id;
      globalThis.foundry.utils.setProperty(data, '_stats.compendiumSource', uuid);
      // unlinked (round 15): the copy is the actor's own - not tied to the granting item, so it outlives it (Poison Prodigy).
      if (!step.unlinked) {
        globalThis.foundry.utils.setProperty(data, 'flags.essence20.grantedBy', ctx.item?.id ?? null);
      }

      if (step.until) {
        const { stampFor } = await import("./expiry.mjs");
        globalThis.foundry.utils.setProperty(data, 'flags.essence20.rulesExpiry', { until: step.until, stamp: stampFor(step.until, undefined, untilActor(step, ctx, actor)) });
      }

      // flags / system: values the granted copy carries (flags under flags.essence20). A flag's text is filled
      // (round 15, items2 - "{ruleItem.id}" for the Drone chassis' parentId).
      for (const [path, value] of Object.entries(step.flags ?? {})) {
        globalThis.foundry.utils.setProperty(data, `flags.essence20.${path}`, typeof value == 'string' ? fillText(value, ctx) : value);
      }

      for (const [path, value] of Object.entries(step.system ?? {})) {
        globalThis.foundry.utils.setProperty(data, `system.${path}`, value);
      }

      // systemFormulas: system values worked out now (a number formula, or "true"/"false" from a tag list).
      for (const [path, value] of Object.entries(step.systemFormulas ?? {})) {
        const worked = Array.isArray(value)
          ? evaluate(value, contextFor({ self: ctx.actor, holder: ctx.actor, ruleItem: ctx.item, other: ctx.targets[0] ?? null })) === true
          : amountOf(value, ctx, 0);
        globalThis.foundry.utils.setProperty(data, `system.${path}`, worked);
      }

      // name: the copy's own name ({choice.<key>} reads a pick); integrated: a weapon becomes Integrated size.
      if (step.name) {
        // {var.<key>} too - a picked entry's name ("{var.pickedName} (Energon)", Manifest Melee Weapon).
        data.name = fillText(String(step.name), ctx);
      }

      if (step.integrated) {
        const { markIntegrated } = await import("../mechanics/resources/grants.mjs");
        markIntegrated(data);
      }

      // appendTraits: traits the copy gains (a granted upgrade made Temperamental).
      if (Array.isArray(step.appendTraits) && Array.isArray(data.system?.traits)) {
        data.system.traits = [...new Set([...data.system.traits, ...step.appendTraits])];
      }

      // removeTraits (round 15): traits the copy loses (Augur's blade trades Silent for Armor Piercing).
      if (Array.isArray(step.removeTraits) && Array.isArray(data.system?.traits)) {
        data.system.traits = data.system.traits.filter(trait => !step.removeTraits.includes(trait));
      }

      const created = await actor.createEmbeddedDocuments('Item', [data]);
      ctx.vars.granted = created?.[0] ?? null;
      // {var.grantedId}: the copy's id, for a flag that points back at it (round 15, items2 - They Called It a Glitch!).
      ctx.vars.grantedId = created?.[0]?.id ?? '';
      // A weapon / armor / shield arrives with its own attacks and upgrades.
      const { attachGrantedChildren } = await import("./lifecycle.mjs");
      await attachGrantedChildren(actor, created);
      ctx.chat.push(T('Granted', { name: escape(actor.name), item: escape(data.name) }));
    }
  },

  async bank(step, ctx) {
    const { bankRollBonus } = await import("./bank.mjs");
    for (const actor of recipients(step, ctx)) {
      // replace: this rule's item keeps one banked bonus on the actor - a new one takes the old one's place. key: only its
      // banks under that key (an item with two kinds of bank - Grid Surge's Edge and its Toughness Boost). stackMax (a
      // formula): the Defense bonus of the bank it replaces is added to the new one, up to that much ("stacking to +3").
      let stacked = 0;
      if ((step.replace || step.stackMax !== undefined) && ctx.item?.id) {
        const { bankedEntries } = await import("./bank.mjs");
        const replaced = entry => entry?.source == ctx.item.id && (step.key === undefined || entry.key == step.key);
        stacked = bankedEntries(actor).filter(replaced).reduce((sum, entry) => sum + (Number(entry.defenseBonus) || 0), 0);
        const kept = bankedEntries(actor).filter(entry => !replaced(entry));
        await write(actor, 'update', [{ 'flags.essence20.ruleBank': kept }]);
      }

      // grantDouble: upshifts banked on another actor first offer the granter's GrantDouble rules (the hand-written
      // perks.mjs#bankPendingBonus `granter` - This, I Command doubling Augment Power's ↑).
      let shiftUp = amountOf(step.upshift ?? 0, ctx, 0);
      if (step.grantDouble && shiftUp > 0 && actor !== ctx.actor) {
        const { offerGrantDouble } = await import("./plugins/resources/grant-double.mjs");
        if (await offerGrantDouble(ctx.actor, actor, 'upshift', globalThis.game?.i18n?.format?.('E20.RulesExtH.Upshift', { n: shiftUp }) ?? `↑${shiftUp}`)) {
          shiftUp *= 2;
        }
      }

      // Each number worked out once (a rolled Defense bonus - @skillDie.acrobatics - is the one banked and the one told).
      const shiftDown = amountOf(step.downshift ?? 0, ctx, 0);
      const damage = amountOf(step.damage ?? 0, ctx, 0);
      const ownBonus = step.defense ? amountOf(step.defenseBonus ?? 0, ctx, 0) : 0;
      const defenseBonus = step.defense && step.stackMax !== undefined ? Math.min(amountOf(step.stackMax, ctx, 0), stacked + ownBonus) : ownBonus;
      const defenseMultiply = step.defense && step.defenseMultiply !== undefined ? amountOf(step.defenseMultiply, ctx, 1) : 0;
      await bankRollBonus(actor, {
        label: step.label || ctx.item?.name,
        shiftUp,
        shiftDown,
        edge: !!step.edge,
        snag: !!step.snag,
        specialize: !!step.specialize,
        damage,
        // {var.x} / {choice.x} in a tag are filled now (target:uuid:{var.foe} - "an attack against that target").
        when: (step.appliesWhen ?? []).map(tag => (typeof tag == 'string' && tag.includes('{var.') ? fillText(tag, ctx) : tag)),
        uses: amountOf(step.uses ?? 1, ctx, 1),
        until: step.until ?? null,
        source: ctx.item?.id ?? null,
        ...(step.key !== undefined ? { key: String(step.key) } : {}),
        untilActor: untilActor(step, ctx, actor),
        // defenseMultiply: that Defense is multiplied against the next attack instead (rules/bank.mjs#bankedDefenseMultiplier).
        ...(step.defense ? { defense: step.defense, defenseBonus, persist: !!step.persist, ...(defenseMultiply ? { defenseMultiply } : {}) } : {}),
      }, write);
      const defenses = step.defense == 'any' ? 'Defenses' : [step.defense].flat().join('/');
      const bonus = [step.defense && (defenseMultiply ? `x${defenseMultiply} ${defenses}` : `+${defenseBonus} ${defenses}`), step.upshift && `↑${shiftUp}`, step.downshift && `↓${shiftDown}`, step.edge && 'Edge', step.snag && 'Snag', step.specialize && 'Specialized', step.damage && `+${damage} damage`].filter(Boolean).join(', ');
      ctx.chat.push(T('Banked', { name: escape(actor.name), bonus }));
    }
  },

  async grantActions(step, ctx) {
    const { grantActionsThisTurn } = await import("../mechanics/actions/action-economy.mjs");
    const grants = { free: amountOf(step.free ?? 0, ctx), move: amountOf(step.move ?? 0, ctx), standard: amountOf(step.standard ?? 0, ctx) };
    for (const actor of recipients(step, ctx)) {
      await grantActionsThisTurn(actor, grants, ctx.item?.name, { granter: ctx.actor });
    }
  },

  async setToggle(step, ctx) {
    const { toggleOf } = await import("./predicate.mjs");
    const { stampFor } = await import("./expiry.mjs");
    const current = !!toggleOf(ctx.item, step.key);
    const value = step.value === 'toggle' || step.value === undefined ? !current : step.value === true || step.value === 'true';
    await ctx.item.update({
      [`flags.essence20.rules.toggles.${step.key}`]: value,
      // untilOf: whose turns the until counts (Electronic Countermeasures: the crew member who used it).
      [`flags.essence20.rules.toggleUntil.${step.key}`]: value && step.until ? { until: step.until, stamp: stampFor(step.until, undefined, untilActor(step, ctx, ctx.actor)) } : null,
    });
  },

  // An option may carry its own `when` (only offered while it holds); auto: a lone remaining option runs unasked.
  async choose(step, ctx) {
    const all = Array.isArray(step.options) ? step.options : [];
    const options = all.filter(option => !option?.when || evaluate(option.when, contextFor({ self: ctx.actor, ruleItem: ctx.item, other: ctx.targets[0] ?? null, vars: ctx.vars })) === true);
    if (!options.length) {
      return false;
    }

    const picked = step.auto && options.length == 1 ? 0 : await (ctx.ask ?? askOption)(step, options, ctx);
    if (picked === null || picked === undefined || !options[picked]) {
      return false;
    }

    return runSteps(options[picked].steps ?? [], ctx);
  },

  // A Perk from another Role or Focus, granted outright (mechanics/resources/grants.mjs#pickPerkFrom): {from: role |
  // focus | branch, line?: same | <line>, notOwn?, ofOwnRole?, minLevel?, maxLevel? (formulas),
  // notOwnPerkNames?, excludeName?, subtype?, notAdvanced?}. The granted Perk's uuid is @var.picked's source.
  async pickPerk(step, ctx) {
    const { pickPerkFrom } = await import("../mechanics/resources/grants.mjs");
    const spec = { ...step };
    for (const key of ['minLevel', 'maxLevel']) {
      if (step[key] !== undefined) {
        spec[key] = amountOf(step[key], ctx, 0);
      }
    }

    const granted = await pickPerkFrom(ctx.actor, ctx.item, spec);
    if (!granted) {
      return false;
    }

    ctx.vars.picked = granted.uuid;
    ctx.chat.push(T('Granted', { name: escape(ctx.actor.name), item: escape(granted.name) }));
  },

  // Fit the weapon the last grant step made to what gave it (mechanics/resources/weapon-fit.mjs): its Blunt hit's
  // damage, and Blunt or Sharp / Finesse or Might asked when offered. {damage?, types?, skills?}
  async fitAttack(step, ctx) {
    const weapon = ctx.vars.granted;
    if (weapon?.type != 'weapon') {
      return;
    }

    const { fitGrantedWeapon } = await import("../mechanics/resources/weapon-fit.mjs");
    await fitGrantedWeapon(weapon.parent ?? ctx.actor, weapon, {
      title: ctx.item?.name ?? '', damage: step.damage ?? null, types: step.types ?? [], skills: step.skills ?? [],
    });
  },

  // An ally to act on: the targeted one(s) when there are 1..max, else a picker over the allies within
  // `within` feet (default: anywhere on the scene) whose `filter` tags (target: ...) hold - and the actor
  // too with `includeSelf`. Sets the targets.
  async pickAlly(step, ctx) {
    const { getNearbyAllyTokens, pickAllyTargets } = await import("../mechanics/combat/nearby-allies.mjs");
    const { contextFor, evaluate } = await import("./predicate.mjs");
    const within = step.within === undefined ? Infinity : amountOf(step.within, ctx, 0);
    const candidates = [...(step.includeSelf ? [ctx.actor] : []), ...getNearbyAllyTokens(ctx.actor, within).map(token => token.actor)].filter(Boolean)
      .filter(ally => !step.filter?.length || evaluate(step.filter, contextFor({ self: ctx.actor, other: ally, ruleItem: ctx.item })) === true);
    // all: every one of them, no picker (Superb Soloist).
    const picked = step.all ? [...new Set(candidates)]
      : await pickAllyTargets(ctx.actor, [...new Set(candidates)], ctx.item?.name ?? '', Math.max(1, Number(step.max) || 1));
    if (!picked.length) {
      return false;
    }

    ctx.targets = picked;
  },

  async target(step, ctx) {
    const targets = targetedActors();
    const min = step.min ?? 1;
    if (targets.length < min) {
      ctx.chat.push(T('NeedsTarget', { item: escape(ctx.item?.name) }));
      globalThis.ui?.notifications?.warn?.(T('NeedsTarget', { item: ctx.item?.name }));
      return false;
    }

    ctx.targets = step.max ? targets.slice(0, step.max) : targets;
  },

  // Pick a compendium item and give it (mechanics/resources/grants.mjs): from {type, availabilities?, tags?} -
  // `tags` are item: tags tested against each compendium entry (item:trait:x, item:data:system.y=z).
  // integrated: give it the Integrated trait; until: it goes when that runs out. The picked uuid is
  // kept as @var.picked for later steps' text.
  async pickGrant(step, ctx) {
    const helpers = ctx.grantHelpers ?? await import("../mechanics/resources/grants.mjs");
    const from = step.from ?? {};
    const tags = Array.isArray(from.tags) ? from.tags : [];
    // notOwned: leave out what the recipient (the first one; else the actor) already holds - with selectionLimit, only
    // once it holds as many copies as the entry's system.selectionLimit allows (Reprogrammable may be taken again).
    const holder = from.notOwned ? recipients(step, ctx)[0] ?? ctx.actor : null;
    const held = new Map();
    const originals = new Set();
    for (const owned of holder ?(holder.items?.contents ?? [...(holder.items ?? [])]) : []) {
      const source = owned.flags?.core?.sourceId ?? owned._stats?.compendiumSource ?? owned.flags?.essence20?.rulesSource;
      held.set(source, (held.get(source) ?? 0) + 1);
      // byOriginalId (round 15): an Alteration's system.originalId (the id its drop recorded) counts as held too.
      if (from.byOriginalId && owned.system?.originalId) {
        originals.add(String(owned.system.originalId));
      }
    }

    const free = entry => !holder || ((held.get(entry.uuid) ?? 0) < (from.selectionLimit ? Number(entry.system?.selectionLimit) || 1 : 1)
      && !originals.has(String(entry.uuid).split('.').pop()));
    const fields = [...(Array.isArray(from.fields) ? from.fields : []), ...(from.selectionLimit ? ['system.selectionLimit'] : [])];
    const rows = await helpers.findItems({
      type: from.type,
      availabilities: Array.isArray(from.availabilities) && from.availabilities.length ? from.availabilities : null,
      // from.fields: more index fields the tags read (system.tier, system.level...).
      ...(fields.length ? { fields } : {}),
      matches: tags.length || holder ? entry => free(entry) && (!tags.length || evaluate(tags, contextFor({ self: ctx.actor, item: entry, ruleItem: ctx.item })) === true) : null,
    });
    const uuid = await helpers.pickOne(step.title || ctx.item?.name || '', rows);
    // optional (round 15): a cancelled pick only skips this grant - the run goes on (Primary Tech's "can choose" upgrades).
    if (!uuid) {
      return step.optional ? undefined : false;
    }

    // record: keep the pick on the rule's item (choices.<key>, a list - several picks build it up) instead of granting
    // a copy; a Qualification reads it with item:pickedSource:<key>. max: how many it holds (the oldest go).
    if (step.record) {
      const key = String(step.key ?? 'picked');
      const row = rows.find(entry => entry.uuid == uuid);
      const old = ctx.item?.flags?.essence20?.rules?.choices?.[key];
      const list = [...(Array.isArray(old) ? old : []).filter(entry => entry?.uuid != uuid), { uuid, name: row?.name ?? '' }];
      const kept = Number(step.max) > 0 ? list.slice(-Number(step.max)) : list;
      await write(ctx.item, 'update', [{ [`flags.essence20.rules.choices.${key}`]: kept }]);
      globalThis.foundry?.utils?.setProperty?.(ctx.item, `flags.essence20.rules.choices.${key}`, kept);
      ctx.vars.picked = uuid;
      ctx.chat.push(T('Picked', { item: escape(ctx.item?.name ?? ''), choice: escape(row?.name ?? uuid) }));
      return;
    }

    // replace: what this rule's item granted before goes - only now a new pick is made (a cancelled pick keeps it).
    if (step.replace && ctx.item?.id) {
      for (const actor of recipients(step, ctx)) {
        const old = itemsFor({ item: 'granted', all: true }, actor, ctx).map(item => item.id);
        if (old.length) {
          await write(actor, 'deleteEmbeddedDocuments', ['Item', old]);
        }
      }
    }

    // flags / system: values the granted copy carries (flags under flags.essence20) - alterationWorn, droneWeapon...
    // A text flag fills {choice.x} / {var.x} (Weapon Enthusiast's chosen type on the weapon it takes).
    const { stampFor } = await import("./expiry.mjs");
    for (const actor of recipients(step, ctx)) {
      const flags = Object.fromEntries(Object.entries(step.flags ?? {}).map(([key, value]) => [key, typeof value == 'string' ? fillText(value, ctx) : value]));
      if (step.until) {
        flags.rulesExpiry = { until: step.until, stamp: stampFor(step.until, undefined, untilActor(step, ctx, actor)) };
      }

      // viaDrop (round 15): through the item type's own drop handling (registerDropGrant); nothing made stops the run.
      const viaDrop = step.viaDrop ? DROP_GRANTS.get(String(from.type ?? '')) : null;
      const created = viaDrop
        ? await viaDrop(actor, uuid, { grantedBy: ctx.item, flags, system: step.system ?? {} })
        : await helpers.grantCopy(actor, uuid, { grantedBy: ctx.item, integrated: !!step.integrated, flags, system: step.system ?? {} });
      if (viaDrop && !created) {
        return false;
      }

      // appendTraits: traits the copy gains once it's made (Field Trials' Temperamental upgrade).
      if (created && Array.isArray(step.appendTraits) && step.appendTraits.length) {
        await write(created, 'update', [{ 'system.traits': [...new Set([...(created.system?.traits ?? []), ...step.appendTraits])] }]);
      }

      if (created) {
        ctx.chat.push(T('Granted', { name: escape(actor.name), item: escape(created.name) }));
      }
    }

    ctx.vars.picked = uuid;
  },

  // Extra attacks this turn (mechanics/actions/action-economy.mjs#grantBonusAttack): each costs `cost` (none,
  // free, move, standard) when taken; `when` is the attack it has to be (weapon:trait:ballistic,
  // attack:melee...); psychicOnMiss adds that much Psychic damage on a miss. Needs a combat.
  async bonusAttack(step, ctx) {
    const economy = ctx.economy ?? await import("../mechanics/actions/action-economy.mjs");
    const count = Math.max(0, amountOf(step.count ?? 1, ctx, 1));
    // only: one of the action economy's own attack filters (action-perks.mjs#attackMatchesFilter - unarmed, melee...).
    const named = typeof step.only == 'string' && step.only ? { [step.only]: true } : {};
    const filter = Array.isArray(step.when) && step.when.length ? { ...named, when: step.when } : Object.keys(named).length ? named : null;
    let granted = 0;
    for (const actor of recipients(step, ctx)) {
      for (let i = 0; i < count; i++) {
        if (await economy.grantBonusAttack(actor, {
          source: ctx.item?.name ?? null, cost: step.cost ?? 'free', filter, psychicOnMiss: Number(step.psychicOnMiss) || 0,
        })) {
          granted++;
        }
      }
    }

    // optional: no combat to take it in doesn't stop the run.
    if (count && !granted && !step.optional) {
      ctx.chat.push(T('NeedsCombat', { item: escape(ctx.item?.name) }));
      return false;
    }
  },

  // The player picks a number (within min-max); later steps read it as @var.<var>.
  // value: the number the dialog starts on (a formula - @item.flags.essence20.x, kept from last time; round 15, items2).
  async askNumber(step, ctx) {
    const value = await pickAmount({ ...step, amount: { min: step.min ?? 1, max: step.max ?? step.min ?? 1 } }, ctx);
    if (value === null) {
      return false;
    }

    ctx.vars[step.var || 'n'] = value;
  },

  // Tag an actor for other rules to test (`target:marked:<key>`, `self:marked:<key>`), for a while.
  // count: a number kept on the mark (@mark.<key>, @target.mark.<key>); add: true adds it to a mark that's still
  // running instead of starting over (a stacking counter - the duration restarts).
  async mark(step, ctx) {
    const { isExpired, stampFor } = await import("./expiry.mjs");
    // perSetter: each setter keeps its own mark under the key (<key>--<setter id>), so two holders don't share one.
    const markKey = step.perSetter && ctx.actor?.id ? `${step.key}--${ctx.actor.id}` : step.key;
    // exclusive: this actor's mark under the key moves - it comes off anyone else it was on ("last hit by").
    if (step.exclusive && ctx.actor?.uuid) {
      const now = new Set(recipients(step, ctx));
      for (const other of markedBy(ctx.actor, markKey)) {
        if (!now.has(other)) {
          await write(other, 'update', [{ [`flags.essence20.ruleMarks.-=${markKey}`]: null }]);
        }
      }
    }

    for (const actor of recipients(step, ctx)) {
      const mark = {
        // by: holder (round 17, perm) - set on the rule holder's behalf (a marked Trigger running on the carrier: Trade School).
        by: (step.by == 'holder' ? ctx.item?.parent ?? ctx.actor : ctx.actor)?.uuid ?? null, until: step.until ?? null, stamp: step.until ? stampFor(step.until, undefined, untilActor(step, ctx, actor)) : null,
      };
      if (step.count !== undefined) {
        const old = actor.flags?.essence20?.ruleMarks?.[markKey];
        const running = step.add && old && !isExpired(old) ? Number(old.count) || 0 : 0;
        mark.count = running + amountOf(step.count, ctx, 1);
      }

      // text: a word the mark keeps ({choice.x} / {var.x} filled) - target:markText:<key>=... reads it
      // (rules/plugins/marks/mark-value.mjs).
      if (step.text !== undefined) {
        mark.text = fillText(String(step.text), ctx);
      }

      // keep: the order it was set in (the newest are kept) - strictly increasing, so two marks set in the same
      // millisecond still have an order.
      if (step.keep !== undefined) {
        markOrder = Math.max(Date.now(), markOrder + 1);
        mark.at = markOrder;
      }

      await write(actor, 'update', [{ [`flags.essence20.ruleMarks.${markKey}`]: mark }]);
      if (mark.at) {
        globalThis.foundry?.utils?.setProperty?.(actor, `flags.essence20.ruleMarks.${markKey}`, mark);
      }
    }

    // keep: N (a formula) - this actor's mark under the key stays on the newest N creatures only, the oldest come off
    // ("up to five Mark Targets at a time": Additional Marks).
    if (step.keep !== undefined && ctx.actor?.uuid) {
      const keep = Math.max(1, amountOf(step.keep, ctx, 1));
      const carriers = markedBy(ctx.actor, markKey).map(other => ({ other, at: Number(other.flags?.essence20?.ruleMarks?.[markKey]?.at) || 0 }))
        .sort((a, b) => b.at - a.at);
      for (const { other } of carriers.slice(keep)) {
        await write(other, 'update', [{ [`flags.essence20.ruleMarks.-=${markKey}`]: null }]);
      }
    }
  },

  // perSetter: only this actor's own mark under the key.
  async unmark(step, ctx) {
    const markKey = step.perSetter && ctx.actor?.id ? `${step.key}--${ctx.actor.id}` : step.key;
    for (const actor of recipients(step, ctx)) {
      await write(actor, 'update', [{ [`flags.essence20.ruleMarks.-=${markKey}`]: null }]);
    }
  },

  // Card steps (a Reaction rule's run, ctx.card = {info, row}): cancel the hit on the row(s); lower the
  // card's total by `amount` (rows that drop below their DIF miss); a Snag after the dice landed (roll
  // another d20, keep the lower); turn the row(s) into successes (crit: Critical Successes) with their
  // damage as Apply buttons.
  async negateHit(step, ctx) {
    if (!ctx.card) {
      return false;
    }

    const core = await import("../mechanics/combat/reaction-engine.mjs");
    for (const row of cardRows(step, ctx, r => r.success && !core.isNegated(ctx.card.info.message, r.targetUuid))) {
      await core.negateHit(ctx.card.info.message, row.targetUuid, null, ctx.actor);
      ctx.chat.push(T('CardNegated', { target: escape(globalThis.fromUuidSync?.(row.targetUuid, { strict: false })?.name ?? '') }));
    }
  },

  async lowerTotal(step, ctx) {
    if (!ctx.card) {
      return false;
    }

    await lowerCardTotal(step, ctx, ctx.card.info.total - amountOf(step.amount ?? 0, ctx, 0));
  },

  async lateSnag(step, ctx) {
    if (!ctx.card) {
      return false;
    }

    const core = await import("../mechanics/combat/reaction-engine.mjs");
    const snagged = await core.lateSnag(ctx.card.info);
    ctx.chat.push(T('CardLateSnag', { die: snagged.die, total: snagged.total }));
    await lowerCardTotal(step, ctx, snagged.total);
  },

  async convertRows(step, ctx) {
    if (!ctx.card) {
      return false;
    }

    const core = await import("../mechanics/combat/reaction-engine.mjs");
    // Rows with no target too: a plain Skill Test against a flat DIF still says it now succeeds (core.convertRows).
    const { info, row } = ctx.card;
    const rows = (row && step.rows != 'all' ? [row] : info.rows).filter(r => !!step.crit || !r.success);
    if (!rows.length) {
      return;
    }

    const reason = T(step.crit ? 'CardNowCrit' : 'CardNowSuccess', { name: escape(ctx.card.info.attacker?.name ?? ''), by: escape(ctx.actor?.name ?? '') });
    await core.convertRows(ctx.card.info, rows, { crit: !!step.crit, speaker: ctx.actor, reason });
  },

  // Reroll the card's roll (mechanics/rolls/reroll.mjs): target d20 (default) | allDice | anyDie | skillDice, mode all |
  // ones | onesAndTwos, keepBetter. Rows the new total no longer reaches miss; rows it now reaches become hits.
  async rerollCard(step, ctx) {
    if (!ctx.card) {
      return false;
    }

    const { info } = ctx.card;
    const { applyReroll, normalizeRerollConfig } = await import("../mechanics/rolls/reroll.mjs");
    const config = normalizeRerollConfig({ mode: step.mode ?? 'all', target: step.target ?? 'd20', keepBetter: !!step.keepBetter, maxUses: 0 });
    const rerolled = globalThis.Roll.fromData(info.roll.toJSON());
    if (!(await applyReroll(rerolled, config))) {
      return false;
    }

    const total = Number(rerolled.total ?? rerolled._total);
    await rerolled.toMessage?.({ speaker: globalThis.ChatMessage?.getSpeaker?.({ actor: info.attacker }), flavor: T('CardRerolled', { by: escape(ctx.actor?.name ?? '') }) });
    const core = await import("../mechanics/combat/reaction-engine.mjs");
    const gained = cardRows(step, ctx, r => !r.success && total >= r.difficulty);
    await lowerCardTotal(step, ctx, total);
    if (gained.length) {
      await core.convertRows(info, gained, { crit: false, speaker: ctx.actor, reason: T('CardNowSuccess', { name: escape(info.attacker?.name ?? ''), by: escape(ctx.actor?.name ?? '') }) });
    }
  },

  async negateDamage(step, ctx) {
    if (ctx.damage) {
      ctx.damage.amount = 0;
    }
  },

  // A save card (mechanics/combat/save-riders.mjs): everyone it reaches rolls one of `skills` against `dif`,
  // a failure gives `status` (for `rounds`) and/or `damage`; `removeOnSuccess` makes it an escape.
  async save(step, ctx) {
    const { postSaveCard } = await import("../mechanics/combat/save-riders.mjs");
    const spec = {
      title: step.title || ctx.item?.name || '',
      skills: [step.skills ?? []].flat().filter(Boolean),
      dif: amountOf(step.dif ?? 10, ctx, 10),
    };
    if (step.status) {
      spec.status = step.status;
    }

    if (step.rounds !== undefined) {
      spec.rounds = amountOf(step.rounds, ctx, 0);
    }

    for (const key of ['damage', 'damageAlways']) {
      if (step[key]) {
        spec[key] = { value: amountOf(step[key].value ?? 0, ctx, 0), type: step[key].type };
      }
    }

    if (step.removeOnSuccess) {
      spec.removeOnSuccess = true;
    }

    await postSaveCard(ctx.actor, recipients(step, ctx), spec);
  },

  // Morph / Alt Mode on or off: { do: 'setForm', form: 'morphed' | 'transformed', value: true | false }.
  async setForm(step, ctx) {
    const path = step.form == 'transformed' ? 'system.isTransformed' : 'system.isMorphed';
    const value = step.value === true || step.value === 'true';
    for (const actor of recipients(step, ctx)) {
      if (!!foundry.utils.getProperty(actor, path) == value) {
        continue;
      }

      const { needsGmRelay, relayToGm } = await import("../mechanics/world/gm-relay.mjs");
      // silent: no Morph / Alt Mode chat line, badge or status (the update option morph-state.mjs reads).
      const args = step.silent ? [{ [path]: value }, { essence20: { silentState: true } }] : [{ [path]: value }];
      await (needsGmRelay(actor) ? relayToGm(actor, 'update', args) : actor.update(...args));
    }
  },

  async leaveAt(step, ctx) {
    if (ctx.damage) {
      const health = Number(ctx.actor?.system?.health?.value) || 0;
      ctx.damage.amount = Math.max(0, Math.min(ctx.damage.amount, health - amountOf(step.value ?? 1, ctx, 1)));
    }
  },
};

/** Ask which of a `choose` step's options to take. Resolves to its index, or null. */
async function askOption(step, options, ctx) {
  const { DialogV2 } = foundry.applications.api;
  const result = await DialogV2.wait({
    window: { title: ctx.item?.name ?? '' },
    classes: ['essence20', 'e20-window'],
    // The prompt names who it's for ({target}: a forEach step's member) and fills {choice} / {var}.
    // An E20. key prompt or option label is localized (round 16, part b), so no book text needs to sit in pack data.
    content: step.prompt ? `<p>${escape(fillText(localizedText(String(step.prompt)), ctx).replace(/\{target\}/g, ctx.targets[0]?.name ?? '').replace(/\{name\}/g, ctx.actor?.name ?? ''))}</p>` : '',
    buttons: options.map((option, index) => ({ action: String(index), label: option.label ? localizedText(String(option.label)) : String(index + 1) })),
    rejectClose: false,
  });
  return result === null || result === undefined ? null : Number(result);
}

/**
 * Run a list of steps. Resolves false if a step stopped the run.
 * @param {Array<Object>} steps
 * @param {Object} ctx   {actor, item, rule, targets, damage, chat, vars, ask?}
 * @returns {Promise<Boolean>}
 */
export async function runSteps(steps, ctx) {
  for (const step of Array.isArray(steps) ? steps : []) {
    const handler = HANDLERS[step?.do];
    if (!handler) {
      continue;
    }

    if (step.when && step.do != 'bonusAttack' && evaluate(step.when, contextFor({ self: ctx.actor, ruleItem: ctx.item, other: ctx.targets[0] ?? null, vars: ctx.vars })) !== true) {
      continue;
    }

    try {
      ctx.quiet = !!step.quiet;
      const result = await handler(step, ctx);
      ctx.quiet = false;
      if (result === false) {
        return false;
      }
    } catch (error) {
      console.error(`Essence20 | rule step "${step.do}" failed on ${ctx.item?.name}`, error);
      return false;
    }
  }

  return true;
}

/** A fresh run context. */
export function stepContext({ actor, item, rule, targets = null, damage = null, ask = null, askNumber = null } = {}) {
  return { actor, item, rule, targets: targets ?? targetedActors(), damage, chat: [], vars: {}, ask, askNumber };
}

/** Validator: problems in a step list. */
export function stepErrors(steps, path = 'steps') {
  const errors = [];
  if (!Array.isArray(steps)) {
    return [`${path} must be a list`];
  }

  steps.forEach((step, index) => {
    const where = `${path}[${index}]`;
    if (!step || typeof step != 'object') {
      errors.push(`${where} is not a step`);
      return;
    }

    if (!STEP_TYPES.includes(step.do)) {
      errors.push(`${where}: unknown step "${step.do ?? ''}"`);
      return;
    }

    if (step.until && !isValidUntil(step.until)) {
      errors.push(`${where}: until must be ${UNTIL.join(', ')} or rounds:N`);
    }

    // A Condition's until ends with a creature's next turn (book check 2026-10-06, durations), or (endOfTurn, follow-ups
    // 2) as its current turn ends - its next one when it isn't acting now.
    if (step.do == 'applyCondition' && step.until && !['endOfTurn', 'nextTurn', 'endOfNextTurn', 'nextTurnOrScene', 'endOfNextTurnOrScene'].includes(step.until)) {
      errors.push(`${where}: applyCondition until must be endOfTurn, nextTurn or endOfNextTurn`);
    }

    if (['essenceDamage', 'healEssence'].includes(step.do) && (step.do == 'essenceDamage' || step.essence)
      && !(ESSENCES.includes(step.essence) || step.essence == 'choose' || /^\{choice\.[\w-]+\}$/.test(String(step.essence ?? '')))) {
      errors.push(`${where}: essence must be ${ESSENCES.join(', ')}, choose or {choice.<key>}`);
    }

    if (step.do == 'extendCondition' && !step.condition) {
      errors.push(`${where}: extendCondition needs a condition`);
    }

    if (step.do == 'rerollCard' && step.target && !['d20', 'allDice', 'anyDie', 'skillDice'].includes(step.target)) {
      errors.push(`${where}: rerollCard target must be d20, allDice, anyDie or skillDice`);
    }

    if (step.do == 'spendAction' && step.action && !['free', 'move', 'standard', 'fullAction'].includes(step.action)) {
      errors.push(`${where}: spendAction's action must be free, move, standard or fullAction`);
    }

    if (step.do == 'rollVsEach' && !step.skill) {
      errors.push(`${where}: rollVsEach needs a skill`);
    }

    if (step.do == 'rollVsEach' && step.damage !== undefined && (typeof step.damage != 'object' || formulaError(step.damage.value ?? 1))) {
      errors.push(`${where}: rollVsEach damage must be {value, type}`);
    }

    if (step.do == 'rollVsEach' && step.dataset !== undefined && (typeof step.dataset != 'object' || Array.isArray(step.dataset))) {
      errors.push(`${where}: rollVsEach dataset must be an object of flags`);
    }

    for (const key of ['onHit', 'onMiss', 'onDouble']) {
      if (step.do == 'rollVsEach' && step[key] !== undefined) {
        errors.push(...stepErrors(step[key], `${where}.${key}`));
      }
    }

    if (step.do == 'setVar' && !step.key) {
      errors.push(`${where}: setVar needs a key`);
    }

    if (step.do == 'require' && !Array.isArray(step.check)) {
      errors.push(`${where}: require needs check (a list of tags)`);
    }

    if (step.do == 'choose' && step.options?.some?.(option => option?.when !== undefined && !Array.isArray(option.when))) {
      errors.push(`${where}: a choose option's when must be a list of tags`);
    }

    if (step.do == 'table' && !(Array.isArray(step.rows) && step.rows.length)) {
      errors.push(`${where}: table needs rows [{min, max, text, steps}]`);
    }

    if (step.do == 'table') {
      for (const [i, row] of (Array.isArray(step.rows) ? step.rows : []).entries()) {
        if (Array.isArray(row?.steps)) {
          errors.push(...stepErrors(row.steps, `${where}.rows[${i}].steps`));
        }
      }
    }

    if (step.filter !== undefined && !Array.isArray(step.filter)) {
      errors.push(`${where}: filter must be a list of tags`);
    }

    if (CARD_STEPS.includes(step.do) && step.rows && !['this', 'all'].includes(step.rows)) {
      errors.push(`${where}: rows must be this or all`);
    }

    if (step.do == 'lowerTotal' && (step.amount === undefined || formulaError(step.amount))) {
      errors.push(`${where}: lowerTotal needs an amount${step.amount === undefined ? '' : ` (${formulaError(step.amount)})`}`);
    }

    if (step.untilOf && !['holder', 'recipient', 'target', ...UNTIL_OF.keys()].includes(step.untilOf)) {
      errors.push(`${where}: untilOf must be holder, recipient or target`);
    }

    if (step.to && !['self', 'target', 'targets', 'targetOrSelf', 'party', 'party+others', 'team', 'team+others', 'combatAllies', 'combatAllies+self', 'partyActor'].includes(step.to)
      && !/^(allies|enemies|allies\+self|all):\d+$/.test(step.to) && !/^(allies|enemies)OfTarget:\d+$/.test(step.to) && !/^picked:[\w-]+$/.test(step.to)
      && !EXTRA_RECIPIENTS.some(({ pattern }) => (typeof pattern == 'string' ? step.to == pattern : pattern.test(step.to)))) {
      errors.push(`${where}: to must be self, target, targets, targetOrSelf, allies:<ft>, enemies:<ft>, allies+self:<ft> or all:<ft>`);
    }

    if (step.difDefense && !['toughness', 'evasion', 'willpower', 'cleverness'].includes(step.difDefense)) {
      errors.push(`${where}: difDefense must be toughness, evasion, willpower or cleverness`);
    }

    // A plug-in selector (registerItemSelector) is accepted too.
    if (['deleteItem', 'updateItem', 'spendQuantity'].includes(step.do) && step.item !== undefined
      && !/^(self|granted|wielded(:.+)?|(source|type|choice):.+|name~.+)$/.test(String(step.item))
      && !ITEM_SELECTORS.some(({ prefix }) => (prefix.endsWith(':') ? String(step.item).startsWith(prefix) : String(step.item) == prefix))) {
      errors.push(`${where}: item must be self, granted, source:<uuid>, name~<text>, type:<type> or choice:<key>`);
    }

    if (step.do == 'button') {
      if (!Array.isArray(step.steps) || !step.steps.length) {
        errors.push(`${where}: button needs steps`);
      } else {
        errors.push(...stepErrors(step.steps, `${where}.steps`));
      }

      if (step.who && !['owner', 'gm', 'anyone', 'targets', 'others'].includes(step.who)) {
        errors.push(`${where}: who must be owner, gm, anyone, targets or others`);
      }

      if (step.limit !== undefined && !LIMIT_WINDOWS.includes(step.limit?.per)) {
        errors.push(`${where}: button limit.per must be ${LIMIT_WINDOWS.join(', ')}`);
      }

      if (step.runAs && !['holder', 'clicker'].includes(step.runAs)) {
        errors.push(`${where}: runAs must be holder or clicker`);
      }
    }

    const extra = STEP_VALIDATORS.get(step.do);
    if (extra) {
      errors.push(...(extra.errors?.(step, where) ?? []));
      for (const key of extra.branches) {
        if (step[key] !== undefined) {
          errors.push(...stepErrors(step[key], `${where}.${key}`));
        }
      }
    }

    if (step.do == 'pick' && (!step.key || !PICK_FROM.includes(step.from))) {
      errors.push(`${where}: pick needs a key and from: ${PICK_FROM.join(', ')}`);
    }

    if (step.do == 'createItem' && step.children !== undefined && !(Array.isArray(step.children) && step.children.every(child => child?.name && child?.type))) {
      errors.push(`${where}: createItem children must be a list of item data (name, type)`);
    }

    if (step.do == 'createItem' && !(step.data?.name && step.data?.type)) {
      errors.push(`${where}: createItem needs data with a name and a type`);
    }

    if (step.do == 'pickGrant' && step.from?.tags) {
      for (const tag of unknownTagsOf(step.from.tags)) {
        errors.push(`${where}: unknown tag "${tag}" in from.tags`);
      }
    }

    const needs = {
      applyCondition: 'condition', removeCondition: 'condition', roll: 'skill', grant: 'uuid', setToggle: 'key',
      spend: 'resource', gainResource: 'resource', mark: 'key', unmark: 'key',
    }[step.do];
    if (step.do == 'bank' && step.defense && ![step.defense].flat().every(defense => ['toughness', 'evasion', 'willpower', 'cleverness', 'any'].includes(defense))) {
      errors.push(`${where}: defense must be toughness, evasion, willpower, cleverness or any`);
    }

    if (step.do == 'pickPerk' && !['role', 'focus', 'branch'].includes(step.from)) {
      errors.push(`${where}: pickPerk needs from: role, focus or branch`);
    }

    if (step.do == 'roll' && step.edgeWhen) {
      for (const tag of unknownTagsOf(step.edgeWhen)) {
        errors.push(`${where}: unknown tag "${tag}" in edgeWhen`);
      }
    }

    if (step.do == 'pickAlly' && step.filter) {
      for (const tag of unknownTagsOf(step.filter)) {
        errors.push(`${where}: unknown tag "${tag}" in filter`);
      }
    }

    if (step.do == 'save' && ![step.skills ?? []].flat().filter(Boolean).length) {
      errors.push(`${where}: save needs skills`);
    }

    if (step.do == 'save' && !step.status && !step.damage && !step.damageAlways) {
      errors.push(`${where}: save needs a status or damage for a failure`);
    }

    if (step.do == 'setForm' && !['morphed', 'transformed'].includes(step.form)) {
      errors.push(`${where}: form must be morphed or transformed`);
    }

    if (step.do == 'pickGrant' && !step.from?.type) {
      errors.push(`${where}: pickGrant needs from.type`);
    }

    if (needs && !step[needs]) {
      errors.push(`${where}: ${step.do} needs ${needs}`);
    }

    if (step.do == 'spend' && step.amount && typeof step.amount == 'object') {
      for (const end of ['min', 'max']) {
        const error = formulaError(step.amount[end]);
        if (error) {
          errors.push(`${where}.amount.${end}: ${error}`);
        }
      }
    }

    if (step.do == 'bonusAttack' && step.cost && !['none', 'free', 'move', 'standard'].includes(step.cost)) {
      errors.push(`${where}: cost must be none, free, move or standard`);
    }

    if (step.do == 'askNumber' && step.var && !/^[\w-]+$/.test(step.var)) {
      errors.push(`${where}: var must be a plain name`);
    }

    for (const key of ['amount', 'dif', 'rounds', 'value', 'uses', 'upshift', 'downshift', 'min', 'max', 'defenseBonus', 'defenseMultiply', 'minLevel', 'maxLevel', 'first', 'keep', 'stackMax']) {
      const objectAmount = key == 'amount' && step.do == 'spend' && step.amount && typeof step.amount == 'object';
      // Not formulas: a setVar text value (the handler's own test - no leading digit / @ / ( / -, no call), and
      // shiftSize's min / max (sizes: "huge").
      const textVar = key == 'value' && step.do == 'setVar' && typeof step.value == 'string' && !/^[\d@(-]/.test(step.value) && !/\(/.test(step.value);
      const sizeBound = ['min', 'max'].includes(key) && step.do == 'shiftSize';
      // keep is a formula only on a mark (pickAlteration's keep is its own setting).
      const otherKeep = key == 'keep' && step.do != 'mark';
      const error = (key == 'value' && ['setToggle', 'setForm'].includes(step.do)) || objectAmount || textVar || sizeBound || otherKeep ? null : formulaError(step[key]);
      if (error) {
        errors.push(`${where}.${key}: ${error}`);
      }
    }

    for (const branch of ['onSuccess', 'onFail', 'onCrit']) {
      if (step[branch]) {
        errors.push(...stepErrors(step[branch], `${where}.${branch}`));
      }
    }

    if (step.do == 'choose') {
      if (!Array.isArray(step.options) || !step.options.length) {
        errors.push(`${where}: choose needs options`);
      } else {
        step.options.forEach((option, i) => errors.push(...stepErrors(option?.steps ?? [], `${where}.options[${i}].steps`)));
      }
    }
  });

  return errors;
}
