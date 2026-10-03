import { legacyChoiceUpdates } from "./legacy-choices.mjs";

/**
 * A copy of a compendium item reads its rules from the original, live - the same arrangement as its
 * automation notes (documents/item.mjs#_prepareAutomation). So a book item's rules can be fixed in
 * the packs and every character that already has it picks the fix up, and an item converted from
 * hand-written code to rules keeps working on characters made before the conversion.
 *
 * A copy keeps its own rules only once someone edits them (the Rules tab writes system.rules on the
 * copy). The drop itself doesn't keep the snapshot (rulesSnapshotToStrip, from Item#_preCreate).
 *
 * The rules ride in the compendium index (CONFIG.Item.compendiumIndexFields), so reading them is
 * synchronous - but v14 only sends the core index fields at world load, so a pack's full index is
 * loaded at `ready` for every pack a copy in the world comes from (loadSourceIndexes), and before
 * creating a copy from a pack that hasn't been loaded yet (ensureSourceIndex).
 */

function sourceUuidOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? null;
}

/** Where a copy's rules come from: the link linkExistingCopies() set, else the item's own source. */
export function rulesSourceOf(item) {
  return item?.flags?.essence20?.rulesSource ?? sourceUuidOf(item);
}

/**
 * The rules this item runs: its own, or its compendium original's when it has none of its own.
 * @param {Item} item
 * @param {Function} [lookup]   uuid => document or index entry (fromUuidSync in Foundry).
 * @returns {Array<Object>}
 */
export function inheritedRules(item, lookup = uuid => globalThis.fromUuidSync?.(uuid, { strict: false })) {
  const stored = item?._source?.system?.rules;
  if (Array.isArray(stored) && stored.length) {
    return stored;
  }

  const sourceUuid = rulesSourceOf(item);
  if (item?.pack || !sourceUuid?.startsWith?.('Compendium.')) {
    return Array.isArray(stored) ? stored : [];
  }

  let original = null;
  try {
    original = lookup(sourceUuid);
  } catch (error) {
    original = null;
  }

  const rules = original?.system?.rules;
  return Array.isArray(rules) && rules.length ? rules : Array.isArray(stored) ? stored : [];
}

/** Whether the rules an item shows are its original's rather than its own. */
export function rulesAreInherited(item) {
  const stored = item?._source?.system?.rules;
  return !(Array.isArray(stored) && stored.length) && inheritedRules(item).length > 0;
}

/** On creating a copy from a compendium: drop the rules snapshot so the copy inherits. */
export function rulesSnapshotToStrip(item) {
  const stored = item?._source?.system?.rules;
  return !!(item?._stats?.compendiumSource && Array.isArray(stored) && stored.length);
}

function packOf(uuid) {
  const collection = globalThis.foundry?.utils?.parseUuid?.(uuid)?.collection;
  return collection?.metadata ? collection : null;
}

/** Load a copy's source pack index (with system.rules) before the copy is created. */
export async function ensureSourceIndex(sourceUuid) {
  const pack = sourceUuid ? packOf(sourceUuid) : null;
  if (pack && !pack.indexed) {
    await pack.getIndex();
  }
}

/**
 * At `ready`: load the full index of every pack a world item or actor item comes from, then
 * re-prepare the actors whose items inherit rules, so their first roll already has them.
 */
export async function loadSourceIndexes() {
  const packs = new Map();
  const actors = new Set();
  const visit = (item, actor) => {
    const uuid = rulesSourceOf(item);
    if (!uuid?.startsWith?.('Compendium.')) {
      return;
    }

    const pack = packOf(uuid);
    if (pack) {
      packs.set(pack.collection, pack);
      if (actor) {
        actors.add(actor);
      }
    }
  };

  for (const item of game.items ?? []) {
    visit(item, null);
  }

  const tokenActors = (globalThis.canvas?.tokens?.placeables ?? []).map(token => token.actor).filter(actor => actor?.isToken);
  for (const actor of [...(game.actors ?? []), ...tokenActors]) {
    for (const item of actor.items ?? []) {
      visit(item, actor);
    }
  }

  await Promise.all([...packs.values()].filter(pack => !pack.indexed).map(pack => pack.getIndex()));
  for (const actor of actors) {
    actor.reset();
  }

  for (const item of game.items ?? []) {
    item.reset?.();
  }
}

/* -------------------------------------------- */
/*  Linking copies made before a conversion       */
/* -------------------------------------------- */

/**
 * Compendium items that carry rules, by "type|lower-case name" - only names that are unique within
 * their type, so a match can't pick the wrong printing.
 * @param {Array<{uuid, name, type, rules}>} entries
 * @returns {Map<String, String>}   key => uuid
 */
export function uniqueRuleItems(entries) {
  const seen = new Map();
  for (const { uuid, name, type, rules } of entries) {
    if (!Array.isArray(rules) || !rules.length) {
      continue;
    }

    const key = `${type}|${String(name ?? '').trim().toLowerCase()}`;
    seen.set(key, seen.has(key) && seen.get(key) != uuid ? null : uuid);
  }

  return new Map([...seen].filter(([, uuid]) => uuid));
}

/**
 * The flag updates that link items to a compendium item with rules: items with no rules of their
 * own and none inherited, matched by type and name. An item that already runs rules is left alone.
 * @param {Iterable<Item>} items
 * @param {Map<String, String>} byName   From uniqueRuleItems().
 * @param {Function} [lookup]            Passed through to inheritedRules (tests).
 * @returns {Array<Object>}   Item updates.
 */
export function linkUpdates(items, byName, lookup = undefined) {
  const updates = [];
  for (const item of items ?? []) {
    if (item?.pack || inheritedRules(item, lookup).length) {
      continue;
    }

    // A copy whose own compendium original still exists is that item, whatever it's called - only
    // homebrew, world-made items and copies of a removed duplicate are matched by name.
    const own = sourceUuidOf(item);
    if (own && (lookup ?? (uuid => globalThis.fromUuidSync?.(uuid, { strict: false })))(own)) {
      continue;
    }

    const uuid = byName.get(`${item.type}|${String(item.name ?? '').trim().toLowerCase()}`);
    if (uuid && item.flags?.essence20?.rulesSource != uuid) {
      updates.push({ _id: item.id, 'flags.essence20.rulesSource': uuid });
    }
  }

  return updates;
}

/**
 * The migration for items converted from code to rules (docs/RULES_ENGINE_PLAN.md §10). A copy that
 * came from its compendium original inherits the rules already; this finds the ones that didn't -
 * imported, rebuilt by hand, or copied from a world item - and links each to the compendium item of
 * the same type and name (flags.essence20.rulesSource). GM only. Runs once per system version - packs
 * only gain rules with a release - so an ordinary load reads one setting and stops. The setting holds
 * "<version>|<signature of the rule-bearing items>"; clear it to force a re-run in development.
 */
export async function linkExistingCopies() {
  if (!game.user?.isGM) {
    return;
  }

  const version = game.system?.version ?? '';
  if (String(game.settings.get('essence20', 'rulesLinkSignature') ?? '').split('|')[0] == version) {
    return;
  }

  const entries = [];
  for (const pack of game.packs ?? []) {
    if (pack.documentName != 'Item') {
      continue;
    }

    const index = await pack.getIndex({ fields: ['system.rules'] });
    for (const entry of index) {
      entries.push({ uuid: entry.uuid ?? `Compendium.${pack.collection}.Item.${entry._id}`, name: entry.name, type: entry.type, rules: entry.system?.rules });
    }
  }

  const withRules = entries.filter(entry => Array.isArray(entry.rules) && entry.rules.length).map(entry => entry.uuid).sort();
  const signature = `${version}|${withRules.length}`;

  const byName = uniqueRuleItems(entries);
  let linked = 0;
  for (const actor of game.actors ?? []) {
    const updates = linkUpdates(actor.items, byName);
    if (updates.length) {
      await actor.updateEmbeddedDocuments('Item', updates);
      linked += updates.length;
    }

    // Picks items stored their own way before they became ChoiceSet rules (rules/legacy-choices.mjs).
    const choices = legacyChoiceUpdates(actor);
    if (choices.length) {
      await actor.updateEmbeddedDocuments('Item', choices);
    }
  }

  const worldItems = linkUpdates(game.items, byName);
  if (worldItems.length) {
    await Item.implementation.updateDocuments(worldItems);
    linked += worldItems.length;
  }

  await game.settings.set('essence20', 'rulesLinkSignature', signature);
  if (linked) {
    console.info(`Essence20 | Linked ${linked} existing item(s) to compendium rules`);
  }
}
