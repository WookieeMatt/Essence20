import { poolMax } from "./adapter.mjs";
import { rulesOf, ruleState } from "./index.mjs";

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

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? null;
}

/** The options a ChoiceSet offers: [{value, label}]. */
export function choiceOptions(rule) {
  const E20 = globalThis.CONFIG?.E20 ?? {};
  const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;
  const fromConfig = table => Object.entries(table ?? {}).filter(([value]) => value != 'any').map(([value, label]) => ({ value, label: localize(label) }));
  switch (rule.from) {
  case 'skill': return fromConfig(E20.skills);
  case 'essence': return fromConfig(E20.essences);
  case 'defense': return fromConfig(E20.defenses);
  case 'list': return (Array.isArray(rule.options) ? rule.options : []).map(option => (typeof option == 'object'
    ? { value: String(option.value ?? ''), label: String(option.label ?? option.value ?? '') }
    : { value: String(option), label: String(option) }));
  }

  return [];
}

/** Ask one ChoiceSet's question. Resolves to the value picked, or null if the dialog was closed. */
export async function askChoice(rule, item) {
  const options = choiceOptions(rule);
  if (!options.length) {
    return null;
  }

  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const current = ruleState(item).choices?.[rule.key];
  const select = `<select name="choice">${options.map(o => `<option value="${escape(o.value)}"${o.value == current ? ' selected' : ''}>${escape(o.label)}</option>`).join('')}</select>`;
  const { DialogV2 } = foundry.applications.api;
  return DialogV2.prompt({
    window: { title: `${item.name}: ${rule.label || rule.key}` },
    classes: ['essence20', 'e20-rules-choice'],
    content: `<p>${escape(T('ChoicePrompt', { name: rule.label || rule.key }))}</p><div class="form-group">${select}</div>`,
    ok: { label: T('ChoiceConfirm'), callback: (event, button) => button.form.elements.choice.value },
    rejectClose: false,
  }).catch(() => null);
}

/** The flag update for an item just added to an actor: choices, toggle defaults, full pools. */
export async function initialState(item, actor, { ask = askChoice } = {}) {
  const update = {};
  const state = ruleState(item);
  for (const rule of rulesOf(item)) {
    if (!rule || rule.disabled) {
      continue;
    }

    if (rule.type == 'ChoiceSet' && rule.key && state.choices?.[rule.key] === undefined) {
      const value = await ask(rule, item);
      if (value !== null && value !== undefined) {
        update[`flags.essence20.rules.choices.${rule.key}`] = value;
      }
    }

    if (rule.type == 'Toggle' && rule.key && state.toggles?.[rule.key] === undefined) {
      update[`flags.essence20.rules.toggles.${rule.key}`] = !!rule.default;
    }

    if (rule.type == 'Pool' && rule.key && state.pools?.[rule.key]?.value === undefined) {
      update[`flags.essence20.rules.pools.${rule.key}.value`] = poolMax(rule, actor, item);
    }
  }

  return update;
}

/** The items a Grant rule adds, as creation data marked with the granter. */
export async function grantData(item, actor, { load = uuid => fromUuid(uuid) } = {}) {
  const created = [];
  const owned = new Set((actor.items?.contents ?? [...(actor.items ?? [])]).map(sourceOf).filter(Boolean));
  for (const rule of rulesOf(item)) {
    if (rule?.type != 'Grant' || rule.disabled || !rule.uuid) {
      continue;
    }

    if (rule.skipIfOwned && owned.has(rule.uuid)) {
      continue;
    }

    const source = await load(rule.uuid);
    if (!source) {
      continue;
    }

    const data = source.toObject();
    delete data._id;
    foundry.utils.setProperty(data, '_stats.compendiumSource', rule.uuid);
    foundry.utils.setProperty(data, 'flags.essence20.grantedBy', item.id);
    created.push(data);
  }

  return created;
}

/** The ids of the items this item granted. */
export function grantedBy(actor, item) {
  return (actor?.items?.contents ?? [...(actor?.items ?? [])]).filter(other => other.flags?.essence20?.grantedBy == item.id).map(other => other.id);
}

async function onCreateItem(item, options, userId) {
  const actor = item.parent;
  if (userId != game.user.id || actor?.documentName != 'Actor' || !rulesOf(item).length) {
    return;
  }

  const update = await initialState(item, actor);
  if (Object.keys(update).length) {
    await item.update(update);
  }

  const grants = await grantData(item, actor);
  if (grants.length) {
    await actor.createEmbeddedDocuments('Item', grants);
  }
}

async function onDeleteItem(item, options, userId) {
  const actor = item.parent;
  if (userId != game.user.id || actor?.documentName != 'Actor') {
    return;
  }

  const ids = grantedBy(actor, item).filter(id => actor.items.get(id));
  if (ids.length) {
    await actor.deleteEmbeddedDocuments('Item', ids);
  }
}

globalThis.Hooks?.on?.('createItem', onCreateItem);
globalThis.Hooks?.on?.('deleteItem', onDeleteItem);
