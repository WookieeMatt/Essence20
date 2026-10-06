import { poolMax } from "./adapter.mjs";
import { rulesOf, ruleState } from "./index.mjs";
import { interpolate } from "./predicate.mjs";

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
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
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
  if (!options.length && rule.from != 'text') {
    return null;
  }

  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const current = ruleState(item).choices?.[rule.key];
  // `from: 'text'` - the player types the answer (a subject studied, a person named).
  const select = rule.from == 'text'
    ? `<input type="text" name="choice" value="${escape(current ?? '')}" autofocus>`
    : `<select name="choice">${options.map(o => `<option value="${escape(o.value)}"${o.value == current ? ' selected' : ''}>${escape(o.label)}</option>`).join('')}</select>`;
  const { DialogV2 } = foundry.applications.api;
  return DialogV2.prompt({
    window: { title: `${item.name}: ${rule.label || rule.key}` },
    classes: ['essence20', 'e20-rules-choice'],
    content: `<p>${escape(T('ChoicePrompt', { name: rule.label || rule.key }))}</p><div class="form-group">${select}</div>`,
    ok: { label: T('ChoiceConfirm'), callback: (event, button) => button.form.elements.choice.value.trim() || null },
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
