import { poolMax } from "./adapter.mjs";
import { rulesOf, ruleState } from "./index.mjs";
import { interpolate } from "./predicate.mjs";
import { resolveValue } from "./formula.mjs";
import { filterSkills, pickOptions } from "./steps.mjs";
import { legacyValue } from "./legacy-choices.mjs";
import { legacyChoiceOf } from "./choice-read.mjs";
import { queueAsk } from "./ask-queue.mjs";
import { sourceOf } from "../items/shared/item-lookups.mjs";

/**
 * What an item's rules do when it joins or leaves an actor (docs/RULES_ENGINE_PLAN.md §4):
 *  - ChoiceSet asks its question once and stores the answer (flags.essence20.rules.choices);
 *  - Toggle starts at its default (flags.essence20.rules.toggles);
 *  - Pool starts full (flags.essence20.rules.pools);
 *  - Grant adds its item, marked with the granting item's id, and removing the granting item
 *    removes it again.
 *
 * Runs only on the client that made the change, so a choice is asked once, of the person adding it.
 */

const T = (key, data) => (data ? game.i18n.format(`E20.Rules.${key}`, data) : game.i18n.localize(`E20.Rules.${key}`));

/** The actor an item is on, or null. */
const actorOf = item => (item?.parent?.documentName == 'Actor' ? item.parent : null);

/**
 * The options a ChoiceSet offers: [{value, label}]. Its own sources - skill (CONFIG.E20.skills, narrowed by the pick
 * step's essence / minShift / maxShift / specializedOnly), essence, defense, list ({value, label} or text) and text (typed,
 * no list) - and every other `from` the pick step knows, through steps.mjs#pickOptions with the actor as the run's actor
 * (Perk choice P1: config tables, sense, environment, movement, element, damageType...). `only: [...]` narrows any of
 * them. notHeld / held (choice-sources.mjs) are left off with `allOptions` (a label lookup).
 * @param {Object} rule
 * @param {Object} [ctx]   {actor, item, allOptions}
 * @returns {Array<{value: String, label: String}>}
 */
export function choiceOptions(rule, { actor = null, item = null, allOptions = false } = {}) {
  const E20 = globalThis.CONFIG?.E20 ?? {};
  const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;
  const fromConfig = table => Object.entries(table ?? {}).filter(([value]) => value != 'any').map(([value, label]) => ({ value, label: localize(label) }));
  let options;
  switch (rule.from) {
  case 'skill': {
    const keys = filterSkills(Object.keys(E20.skills ?? {}).filter(key => key != 'any'), rule, actor);
    options = fromConfig(E20.skills).filter(option => keys.includes(option.value));
    break;
  }

  case 'essence': options = fromConfig(E20.essences); break;
  case 'defense': options = fromConfig(E20.defenses); break;
  case 'list': options = (Array.isArray(rule.options) ? rule.options : []).map(option => (typeof option == 'object'
    ? { value: String(option.value ?? ''), label: String(option.label ?? option.value ?? '') }
    : { value: String(option), label: String(option) }));
    break;
  case 'text': return [];
  default:
    try {
      return pickOptions(rule, { actor, item, targets: [], vars: {}, chat: [], allOptions });
    } catch (error) {
      return [];
    }
  }

  const only = Array.isArray(rule.only) && rule.only.length ? rule.only.map(String) : null;
  return only ? options.filter(option => only.includes(String(option.value))) : options;
}

/** Whether a ChoiceSet keeps a list (it has a `count`). */
export function isListChoice(rule) {
  return rule?.count !== undefined && rule.count !== null && rule.count !== '';
}

/** A stored pick as a list. */
const asList = value => (Array.isArray(value) ? value : value === undefined || value === null || value === '' ? [] : [value]);

/**
 * excludeCopies: what the actor's other copies of the same book item hold under the rule's key (a list pick gives every
 * entry; `legacy` reads an old copy's pick - GI Joe Expertise's system.choice).
 */
export function copiesHold(rule, item, actor = actorOf(item)) {
  const source = sourceOf(item);
  if (!source || !actor) {
    return [];
  }

  return (actor.items?.contents ?? [...(actor.items ?? [])])
    .filter(other => other !== item && other.id != item.id && sourceOf(other) == source)
    .flatMap(other => {
      const stored = asList(other.flags?.essence20?.rules?.choices?.[rule.key]);
      return stored.length || !rule.legacy ? stored : asList(legacyValue(rule.legacy, other, actor));
    })
    .map(String);
}

/** What a ChoiceSet can offer now: its options less what other copies hold (excludeCopies) and what this ask already took. */
export function offeredOptions(rule, item, actor = actorOf(item), taken = []) {
  const held = new Set([...(rule.excludeCopies ? copiesHold(rule, item, actor) : []), ...taken.map(String)]);
  return choiceOptions(rule, { actor, item }).filter(option => !held.has(String(option.value)));
}

/** A stored pick's words: an option's label, a list's labels joined with ", ", '' for none. */
export function choiceLabel(rule, value, { actor = null, item = null } = {}) {
  const values = asList(value);
  if (!values.length) {
    return '';
  }

  const options = choiceOptions(rule, { actor, item, allOptions: true });
  return values.map(one => options.find(option => option.value == one)?.label ?? String(one)).join(', ');
}

/**
 * rename: the item's name with " (<labels>)" for every ChoiceSet marked `rename` that has a pick, in rule order - the
 * old Perk picker's "Name (Pick)". The name before any suffix is kept in flags.essence20.rules.baseName, so a re-pick
 * replaces the suffix; an old copy without it has its old pick's suffix taken off first.
 * @returns {Object|null}   {name, 'flags.essence20.rules.baseName'}, or null when no rule renames.
 */
export function renameUpdate(item, choices = ruleState(item).choices ?? {}) {
  const sets = rulesOf(item).filter(rule => rule?.type == 'ChoiceSet' && rule.key && rule.rename && !rule.disabled);
  if (!sets.length) {
    return null;
  }

  const ctx = { actor: actorOf(item), item };
  let base = item.flags?.essence20?.rules?.baseName;
  if (!base) {
    base = String(item.name ?? '');
    const old = sets.map(rule => choiceLabel(rule, ruleState(item).choices?.[rule.key] ?? legacyChoiceOf(item), ctx)).filter(Boolean).join(', ');
    if (old && base.endsWith(` (${old})`)) {
      base = base.slice(0, -(old.length + 3));
    }
  }

  const labels = sets.map(rule => choiceLabel(rule, choices[rule.key], ctx)).filter(Boolean);
  return { name: labels.length ? `${base} (${labels.join(', ')})` : base, 'flags.essence20.rules.baseName': base };
}

/** The item update storing one ChoiceSet's pick (and its rename). */
export function choiceUpdate(item, rule, value) {
  const update = { [`flags.essence20.rules.choices.${rule.key}`]: value };
  const renamed = renameUpdate(item, { ...(ruleState(item).choices ?? {}), [rule.key]: value });
  return renamed ? { ...update, ...renamed } : update;
}

function warnTaken(rule, item, value) {
  const label = choiceLabel(rule, value, { actor: actorOf(item), item });
  globalThis.ui?.notifications?.warn?.(T('ChoiceTaken', { choice: label, item: item?.name ?? '' }));
}

/**
 * Ask one ChoiceSet's question the way its rule says: once, or (`count`, a formula - `@choiceCount` reads ChoiceCount
 * rules) that many different values kept as a list. excludeCopies is checked again when each answer comes back, not only
 * when the dialog opens (another copy may have taken it meanwhile): a taken value is refused and asked again. A list that
 * runs out of values keeps what was chosen; cancelling any ask keeps nothing.
 * @param {Object} rule
 * @param {Item} item
 * @param {Actor} [actor]
 * @param {Object} [options]
 * @param {Function} [options.ask]   (rule, item, {options, n, count}) => value | null.
 * @returns {Promise<*>}   The value, a list, or null (cancelled / nothing to pick).
 */
export async function askRule(rule, item, actor = actorOf(item), { ask = askChoice } = {}) {
  const tries = 5;
  if (!isListChoice(rule)) {
    for (let attempt = 0; attempt < tries; attempt++) {
      const value = await ask(rule, item, { options: offeredOptions(rule, item, actor) });
      if (value === null || value === undefined) {
        return null;
      }

      if (!rule.excludeCopies || !copiesHold(rule, item, actor).includes(String(value))) {
        return value;
      }

      warnTaken(rule, item, value);
    }

    return null;
  }

  const count = Math.max(0, Math.round(resolveValue(rule.count, { actor, item }, 1)));
  const picks = [];
  let refused = 0;
  while (picks.length < count && refused < tries) {
    const options = offeredOptions(rule, item, actor, picks);
    if (!options.length && rule.from != 'text') {
      break;
    }

    const value = await ask(rule, item, { options, n: picks.length + 1, count });
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const known = !options.length || options.some(option => option.value == value);
    if (!known || picks.includes(value) || (rule.excludeCopies && copiesHold(rule, item, actor).includes(String(value)))) {
      refused++;
      warnTaken(rule, item, value);
      continue;
    }

    picks.push(value);
  }

  return picks.length ? picks : null;
}

/**
 * Show one ChoiceSet question. Resolves to the value picked, or null if the dialog was closed.
 * @param {Object} rule
 * @param {Item} item
 * @param {Object} [ask]   {options (default: what the rule offers now), n, count (a list pick's place)}.
 */
export async function askChoice(rule, item, { options = null, n = null, count = null } = {}) {
  const offered = options ?? offeredOptions(rule, item);
  if (!offered.length && rule.from != 'text') {
    return null;
  }

  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const stored = ruleState(item).choices?.[rule.key];
  const current = Array.isArray(stored) ? stored[(n ?? 1) - 1] : stored;
  const name = rule.label || rule.key;
  // `from: 'text'` - the player types the answer (a subject studied, a person named).
  const select = rule.from == 'text'
    ? `<input type="text" name="choice" value="${escape(current ?? '')}" autofocus>`
    : `<select name="choice">${offered.map(o => `<option value="${escape(o.value)}"${o.value == current ? ' selected' : ''}>${escape(o.label)}</option>`).join('')}</select>`;
  const prompt = n && count > 1 ? T('ChoicePromptOf', { name, n, count }) : T('ChoicePrompt', { name });
  const { DialogV2 } = foundry.applications.api;
  return DialogV2.prompt({
    window: { title: `${item.name}: ${name}` },
    classes: ['essence20', 'e20-rules-choice'],
    content: `<p>${escape(prompt)}</p><div class="form-group">${select}</div>`,
    ok: { label: T('ChoiceConfirm'), callback: (event, button) => button.form.elements.choice.value.trim() || null },
    rejectClose: false,
  }).catch(() => null);
}

/**
 * The flag update for an item just added to an actor: choices, toggle defaults, full pools (and a `rename` ChoiceSet's
 * name). A `required` ChoiceSet that is cancelled stops it there: its key goes into `cancelled`, for onCreateItem to take
 * the item off again.
 */
export async function initialState(item, actor, { ask = askChoice, cancelled = [] } = {}) {
  const update = {};
  const state = ruleState(item);
  const picked = {};
  for (const rule of rulesOf(item)) {
    if (!rule || rule.disabled) {
      continue;
    }

    if (rule.type == 'ChoiceSet' && rule.key && state.choices?.[rule.key] === undefined) {
      const value = await askRule(rule, item, actor, { ask });
      if (value !== null && value !== undefined) {
        update[`flags.essence20.rules.choices.${rule.key}`] = value;
        picked[rule.key] = value;
      } else if (rule.required) {
        cancelled.push(rule.key);
        return update;
      }
    }

    if (rule.type == 'Toggle' && rule.key && state.toggles?.[rule.key] === undefined) {
      update[`flags.essence20.rules.toggles.${rule.key}`] = !!rule.default;
    }

    if (rule.type == 'Pool' && rule.key && state.pools?.[rule.key]?.value === undefined) {
      update[`flags.essence20.rules.pools.${rule.key}.value`] = poolMax(rule, actor, item);
    }
  }

  const renamed = Object.keys(picked).length ? renameUpdate(item, { ...(state.choices ?? {}), ...picked }) : null;
  return renamed ? { ...update, ...renamed } : update;
}

/** The items a Grant rule adds, as creation data marked with the granter. */
export async function grantData(item, actor, { load = uuid => fromUuid(uuid) } = {}) {
  const created = [];
  const owned = new Set((actor.items?.contents ?? [...(actor.items ?? [])]).map(sourceOf).filter(Boolean));
  for (const rule of rulesOf(item)) {
    if (rule?.type != 'Grant' || rule.disabled || !rule.uuid) {
      continue;
    }

    // "{choice.x}" - the item a ChoiceSet on this item picked (the choices are asked first).
    const uuid = interpolate(String(rule.uuid), item);
    if (!uuid || (rule.skipIfOwned && owned.has(uuid))) {
      continue;
    }

    const source = await load(uuid);
    if (!source) {
      continue;
    }

    const data = source.toObject();
    delete data._id;
    foundry.utils.setProperty(data, '_stats.compendiumSource', uuid);
    foundry.utils.setProperty(data, 'flags.essence20.grantedBy', item.id);
    created.push(data);
  }

  return created;
}

/**
 * A granted weapon, armor or shield arrives with its own attached items - its attacks (weaponEffects)
 * and upgrades - the same as dropping it on the sheet (mechanics/resources/grants.mjs#grantCopy does this too).
 */
export async function attachGrantedChildren(actor, created) {
  const { createItemCopies } = await import("../sheet-handlers/attachment-handler.mjs");
  const ids = () => new Set((actor.items?.contents ?? [...(actor.items ?? [])]).map(other => other.id));
  for (const item of created ?? []) {
    const before = ids();
    if (['armor', 'weapon'].includes(item?.type)) {
      await createItemCopies(item.system?.items ?? {}, actor, 'upgrade', item);
    }

    if (['shield', 'weapon'].includes(item?.type)) {
      await createItemCopies(item.system?.items ?? {}, actor, 'weaponEffect', item);
    }

    // The attached copies carry the host's grant and expiry, so they go with it (rule:granted, onDeleteItem). They're
    // the items the copying just made (their parentId flag is set without waiting, so it can't be read yet).
    const stamp = Object.fromEntries(['grantedBy', 'rulesExpiry'].map(key => [key, item?.flags?.essence20?.[key]]).filter(([, value]) => value));
    if (Object.keys(stamp).length) {
      const children = (actor.items?.contents ?? [...(actor.items ?? [])]).filter(other => !before.has(other.id) && other.id != item.id && !other.flags?.essence20?.grantedBy);
      if (children.length) {
        await actor.updateEmbeddedDocuments?.('Item', children.map(child => ({ _id: child.id, ...Object.fromEntries(Object.entries(stamp).map(([key, value]) => [`flags.essence20.${key}`, value])) })));
      }
    }
  }
}

/** The ids of the items this item granted. */
export function grantedBy(actor, item) {
  return (actor?.items?.contents ?? [...(actor?.items ?? [])]).filter(other => other.flags?.essence20?.grantedBy == item.id).map(other => other.id);
}

/**
 * An item just added: its choices asked and its state stored - queued per actor (ask-queue.mjs), so two items added at
 * once never open two pick dialogs, and the second ask sees the first one's pick. A cancelled `required` ChoiceSet takes
 * a dropped item off again (the old picker never created it); a granted or attached copy (grantedBy / parentId, set by
 * the time the dialog is answered) is kept unpicked, as grants keep it today.
 * @returns {Promise<Boolean>}   false when the item was taken off.
 */
export async function setUpItem(item, actor, { ask = askChoice } = {}) {
  return queueAsk(actor, async () => {
    const cancelled = [];
    const update = await initialState(item, actor, { ask, cancelled });
    const now = actor.items?.get?.(item.id) ?? item;
    if (cancelled.length && !now.flags?.essence20?.grantedBy && !now.flags?.essence20?.parentId) {
      await item.delete?.();
      return false;
    }

    if (Object.keys(update).length) {
      await item.update(update);
    }

    return true;
  });
}

async function onCreateItem(item, options, userId) {
  const actor = item.parent;
  if (userId != game.user.id || actor?.documentName != 'Actor' || !rulesOf(item).length) {
    return;
  }

  if (!(await setUpItem(item, actor))) {
    return;
  }

  const grants = await grantData(item, actor);
  if (grants.length) {
    await attachGrantedChildren(actor, await actor.createEmbeddedDocuments('Item', grants));
  }

  // The item's own 'added' Triggers (rules/triggers.mjs), once its state is set up.
  const { fireItemAdded } = await import("./triggers.mjs");
  await fireItemAdded(actor, item);
}

async function onDeleteItem(item, options, userId) {
  const actor = item.parent;
  if (userId != game.user.id || actor?.documentName != 'Actor') {
    return;
  }

  // The item's own 'removed' Triggers (an undo - Aim Apparatus giving the Skill die back).
  if (rulesOf(item).some(rule => rule?.type == 'Trigger' && rule.event == 'removed')) {
    const { fireItemAdded } = await import("./triggers.mjs");
    await fireItemAdded(actor, item, { event: 'removed' });
  }

  const granted = grantedBy(actor, item).filter(id => actor.items.get(id));
  // And what's attached to those (a granted weapon's attacks made before attachments carried grantedBy).
  const attached = (actor.items?.contents ?? [...(actor.items ?? [])])
    .filter(other => granted.includes(other.flags?.essence20?.parentId) && !granted.includes(other.id)).map(other => other.id);
  const ids = [...granted, ...attached];
  if (ids.length) {
    // A granted Alteration takes back what its drop wrote onto the actor (book check follow-ups: Beast Mode).
    await (await import("./plugins/book/followups.mjs")).undoAlterations(actor, ids);
    await actor.deleteEmbeddedDocuments('Item', ids);
  }
}

globalThis.Hooks?.on?.('createItem', onCreateItem);
globalThis.Hooks?.on?.('deleteItem', onDeleteItem);
