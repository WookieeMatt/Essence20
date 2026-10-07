/**
 * Level picks: the General Perk and Grid Power a character chooses at the levels their Role lists
 * (Role `perkLevels.general` and, for Power Rangers, `gridPowerLevels` - user ruling 2026-10-07).
 * The book lists both as Role Perks that say "choose one" (see docs/rules-batches/role-level-picks.md
 * for the pages); the packs carry no item for them, so nothing was granted until this.
 *
 * How it runs:
 * - A level change (role-handler.mjs#onLevelChange) or a Role drop (onRoleDrop) calls updateLevelPicks,
 *   on the one client that made the change. Every listed level crossed upward becomes a pending pick in
 *   flags.essence20.levelPicks; every level crossed downward drops its pending pick and removes the item
 *   chosen for it (as a level down removes Role Perks), so a later level up offers it again cleanly.
 * - The picker (apps/choices-selector.mjs) opens for the first new pick; each pick made opens the next.
 *   Closing it leaves the rest pending, and the character sheet's header shows a button to reopen them.
 * - The pick runs the sheet's own drop handler (sheet-handlers/drop-handler.mjs#onDropItem), so the
 *   item's set-up (a Perk's own choice, a Power's selection limit, the strict-mode GM check) runs as it
 *   does for a drop. The pending pick is cleared only once the chosen item is actually created, so a
 *   choice cancelled half-way stays pending.
 * - An additive Role (Old Hand) runs on its own level track; once it is taken the base Role's General
 *   Perks stop (Hawk's Personnel Files, Old Hand), so the base track only counts levels below the
 *   transition.
 *
 * The level arithmetic and the eligibility filter are pure and run under plain Node (level-picks.test.js).
 */

export const LEVEL_PICK_FLAG = 'levelPicks';
export const LEVEL_PICK_KINDS = {
  generalPerk: { itemType: 'perk', subtype: 'general', label: 'E20.LevelPickGeneralPerk' },
  gridPower: { itemType: 'power', subtype: 'grid', label: 'E20.LevelPickGridPower' },
};

/* -------------------------------------------- */
/*  Pure                                         */
/* -------------------------------------------- */

/**
 * A Role's level list ("level4", "level1optional", 4) as sorted, unique level numbers.
 * @param {Array<String|Number>} levels
 * @returns {Number[]}
 */
export function levelNumbers(levels) {
  const numbers = (Array.isArray(levels) ? levels : [])
    .map(level => parseInt(String(level).replace(/[^0-9]/g, ''), 10))
    .filter(level => Number.isFinite(level) && level > 0);
  return [...new Set(numbers)].sort((a, b) => a - b);
}

/**
 * The listed levels a level change crosses: gained going up (previous < level <= new), lost going down
 * (new < level <= previous). A multi-level jump crosses every level between.
 * @param {Array<String|Number>} levels
 * @param {Number} previousLevel   The last level processed (0 for a Role just dropped).
 * @param {Number} newLevel
 * @param {Object} [options]
 * @param {Number} [options.maxLevel]   Ignore listed levels above this (the base Role under Old Hand).
 * @returns {{gained: Number[], lost: Number[]}}
 */
export function crossedLevels(levels, previousLevel, newLevel, { maxLevel = Infinity } = {}) {
  const from = Number(previousLevel) || 0;
  const to = Number(newLevel) || 0;
  const listed = levelNumbers(levels).filter(level => level <= maxLevel);
  if (to > from) {
    return { gained: listed.filter(level => level > from && level <= to), lost: [] };
  } else if (to < from) {
    return { gained: [], lost: listed.filter(level => level > to && level <= from) };
  }

  return { gained: [], lost: [] };
}

/** One pick's key: kind, track (base / additive Role) and level - unique per character. */
export const pickKey = (kind, track, level) => `${kind}-${track}-${level}`;

/** The picks one Role's lists give on its track. */
function rolePickChanges(role, track, previousLevel, newLevel, options = {}) {
  const changes = { gained: [], lost: [] };
  if (!role?.system) {
    return changes;
  }

  const lists = { generalPerk: role.system.perkLevels?.general };
  // Grid Powers are a Power Rangers Role Perk; the field is only shown (and only read) for that line.
  if (role.system.version == 'powerRangers') {
    lists.gridPower = role.system.gridPowerLevels;
  }

  for (const [kind, levels] of Object.entries(lists)) {
    const { gained, lost } = crossedLevels(levels, previousLevel, newLevel, options);
    changes.gained.push(...gained.map(level => ({ key: pickKey(kind, track, level), kind, track, level })));
    changes.lost.push(...lost.map(level => ({ key: pickKey(kind, track, level), kind, track, level })));
  }

  return changes;
}

/**
 * The picks a level change gives and takes away.
 * @param {Object} params
 * @param {Item} params.baseRole
 * @param {?Item} [params.additiveRole]   An additive Role (Old Hand), on its own level track.
 * @param {Number} [params.transitionLevel]   The character level the additive Role was taken at (its level 1).
 * @param {Number} params.previousLevel
 * @param {Number} params.newLevel
 * @returns {{gained: Array<{key, kind, track, level}>, lost: Array<{key, kind, track, level}>}}
 */
export function levelPickChanges({ baseRole, additiveRole = null, transitionLevel = null, previousLevel, newLevel }) {
  if (!additiveRole) {
    return rolePickChanges(baseRole, 'base', previousLevel, newLevel);
  }

  // Under an additive Role the base Role gives no more General Perks (only levels before the switch count),
  // and the additive Role's own list runs on its own level: character level - transition + 1.
  const transition = Number(transitionLevel) || 1;
  const base = rolePickChanges(baseRole, 'base', previousLevel, newLevel, { maxLevel: transition - 1 });
  const additive = rolePickChanges(additiveRole, 'additive', previousLevel - transition + 1, newLevel - transition + 1);
  return { gained: [...base.gained, ...additive.gained], lost: [...base.lost, ...additive.lost] };
}

/**
 * The pending list after a change: gained picks added (unless pending or already chosen), lost ones removed.
 * @param {Array<{key}>} pending
 * @param {{gained: Array<{key}>, lost: Array<{key}>}} changes
 * @param {Set<String>} chosenKeys   Keys an item on the character was already chosen for.
 * @returns {Array<{key}>}
 */
export function nextPending(pending, changes, chosenKeys = new Set()) {
  const lost = new Set(changes.lost.map(pick => pick.key));
  const result = (Array.isArray(pending) ? pending : []).filter(pick => pick?.key && !lost.has(pick.key));
  const present = new Set(result.map(pick => pick.key));
  for (const pick of changes.gained) {
    if (!present.has(pick.key) && !chosenKeys.has(pick.key)) {
      result.push(pick);
      present.add(pick.key);
    }
  }

  return result.sort((a, b) => a.level - b.level || a.kind.localeCompare(b.kind));
}

const lower = text => String(text ?? '').trim().toLowerCase();

/**
 * Which compendium entries a pick may offer: the kind's item type and subtype, and not already held -
 * unless the entry can be taken more than once (system.selectionLimit), in which case until it's held
 * that many times. A copy counts by its compendium source, or by name for a reprint in another book.
 * @param {Array<{uuid, name, type, system}>} entries   Compendium index entries (uuid added).
 * @param {Array<{source, name, type}>} owned   The character's items.
 * @param {String} kind   A key of LEVEL_PICK_KINDS.
 * @returns {Array}   The eligible entries, sorted by name.
 */
export function eligibleLevelPickEntries(entries, owned, kind) {
  const spec = LEVEL_PICK_KINDS[kind];
  if (!spec) {
    return [];
  }

  const held = (Array.isArray(owned) ? owned : []).filter(item => item?.type == spec.itemType);
  const timesHeld = entry => held.filter(item => (item.source && item.source == entry.uuid)
    || (lower(item.name) && lower(item.name) == lower(entry.name))).length;

  return (Array.isArray(entries) ? entries : [])
    .filter(entry => entry?.type == spec.itemType && entry.system?.type == spec.subtype)
    .filter(entry => timesHeld(entry) < Math.max(1, Number(entry.system?.selectionLimit) || 1))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/* -------------------------------------------- */
/*  In Foundry                                   */
/* -------------------------------------------- */

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
const itemList = actor => (Array.isArray(actor?.items?.contents) ? actor.items.contents : [...(actor?.items ?? [])]);

/** The character's pending picks. */
export function pendingLevelPicks(actor) {
  const pending = actor?.flags?.essence20?.[LEVEL_PICK_FLAG];
  return Array.isArray(pending) ? pending : [];
}

/** The pick a chosen item was taken for (flags.essence20.levelPick), or null. */
const chosenKeyOf = item => item?.flags?.essence20?.levelPick?.key ?? null;

/** A pick's label: "General Perk (4th level)". */
export function levelPickLabel(pick) {
  const level = T(CONFIG.E20?.actorLevels?.[`level${pick.level}`] ?? String(pick.level));
  return T('E20.LevelPickLabel', { kind: T(LEVEL_PICK_KINDS[pick.kind]?.label ?? pick.kind), level });
}

/**
 * Record what a level change (or a Role drop: previousLevel 0) gives and takes away, and remove the items chosen
 * for levels lost. Opens the picker for the first new pick unless `open` is false.
 * @param {Actor} actor
 * @param {Number} previousLevel
 * @param {Number} newLevel
 * @param {Object} [options]
 * @param {Boolean} [options.open=true]
 * @returns {Promise<Array>}   The picks gained.
 */
export async function updateLevelPicks(actor, previousLevel, newLevel, { open = true } = {}) {
  const roles = actor?.items?.documentsByType?.role ?? itemList(actor).filter(item => item.type == 'role');
  const baseRole = roles.find(role => !role.system?.isAdditive);
  if (!baseRole) {
    return [];
  }

  const additiveRole = roles.find(role => role.system?.isAdditive) ?? null;
  const changes = levelPickChanges({
    baseRole, additiveRole, transitionLevel: actor.system?.oldHandTransitionLevel, previousLevel, newLevel,
  });
  if (!changes.gained.length && !changes.lost.length) {
    return [];
  }

  // A level down takes away what was chosen for the levels lost, as it does a Role's own Perks.
  const lostKeys = new Set(changes.lost.map(pick => pick.key));
  await removeChosen(actor, item => lostKeys.has(chosenKeyOf(item)));

  const chosenKeys = new Set(itemList(actor).map(chosenKeyOf).filter(Boolean));
  const before = pendingLevelPicks(actor);
  const pending = nextPending(before, changes, chosenKeys);
  if (JSON.stringify(pending) != JSON.stringify(before)) {
    await actor.setFlag('essence20', LEVEL_PICK_FLAG, pending);
  }

  const beforeKeys = new Set(before.map(pick => pick.key));
  const gained = pending.filter(pick => !beforeKeys.has(pick.key));
  if (open && gained.length) {
    await openLevelPick(actor, gained[0].key, { chain: true });
  }

  return gained;
}

/**
 * A Role is going: its pending picks go, and the items chosen for them, as its Role Perks do.
 * @param {Actor} actor
 * @param {'base'|'additive'} track
 */
export async function clearLevelPicks(actor, track) {
  await removeChosen(actor, item => item?.flags?.essence20?.levelPick?.track == track);
  const pending = pendingLevelPicks(actor);
  const kept = pending.filter(pick => pick.track != track);
  if (kept.length != pending.length) {
    await actor.setFlag('essence20', LEVEL_PICK_FLAG, kept);
  }
}

async function removeChosen(actor, matches) {
  const items = itemList(actor).filter(matches);
  if (!items.length) {
    return;
  }

  const { onPerkDelete } = items.some(item => item.type == 'perk') ? await import("../../sheet-handlers/perk-handler.mjs") : {};
  for (const item of items) {
    if (item.type == 'perk') {
      await onPerkDelete(actor, item);
    }

    await item.delete();
  }
}

/**
 * The compendium choices for a pick, in the ChoicesSelector's shape. Every book the Compendium Browser shows (a GM
 * who switched a book off does not want it offered) from the character's game line - its pack folder - plus the
 * cross-line books that sit in no folder (Field Guide to Action and Adventure's General Perks are written for any
 * setting). Prerequisites are marked by the selector itself (rules/prerequisites.mjs#choicePrerequisites).
 * @param {Actor} actor
 * @param {Object} pick
 * @returns {Promise<Object>}
 */
export async function levelPickChoices(actor, pick) {
  const spec = LEVEL_PICK_KINDS[pick.kind];
  const { getVisibleItemPacks } = await import("../../util/compendium-browser.mjs");
  const roles = actor.items.documentsByType?.role ?? [];
  const role = (pick.track == 'additive' ? roles.find(r => r.system?.isAdditive) : roles.find(r => !r.system?.isAdditive)) ?? roles[0];
  const folder = CONFIG.E20.gameLinePackFolders?.[role?.system?.version];

  const entries = [];
  const groups = {};
  for (const pack of getVisibleItemPacks()) {
    const packFolder = pack.folder?.name ?? null;
    if (folder && packFolder && packFolder != folder) {
      continue;
    }

    const index = await pack.getIndex({ fields: ['system.type', 'system.selectionLimit', 'system.source.book', 'system.prerequisites'] });
    for (const entry of index) {
      if (entry.type != spec.itemType) {
        continue;
      }

      const uuid = `Compendium.${pack.metadata.id}.Item.${entry._id}`;
      entries.push({ uuid, name: entry.name, type: entry.type, system: entry.system ?? {} });
      groups[uuid] = { group: packFolder ?? pack.metadata.label, detail: entry.system?.source?.book || pack.metadata.label };
    }
  }

  const owned = itemList(actor).map(item => ({ source: sourceOf(item), name: item.name, type: item.type }));
  return Object.fromEntries(eligibleLevelPickEntries(entries, owned, pick.kind).map(entry => [entry.uuid, {
    chosen: false,
    value: entry.uuid,
    label: entry.name,
    uuid: entry.uuid,
    ...groups[entry.uuid],
  }]));
}

/**
 * Open the picker for one pending pick.
 * @param {Actor} actor
 * @param {String} key
 * @param {Object} [options]
 * @param {Boolean} [options.chain]   After this pick is made, open the next pending one.
 * @returns {Promise<Boolean>}   Whether a picker opened.
 */
export async function openLevelPick(actor, key, { chain = false } = {}) {
  const pick = pendingLevelPicks(actor).find(entry => entry.key == key);
  if (!pick) {
    return false;
  }

  const choices = await levelPickChoices(actor, pick);
  if (!Object.keys(choices).length) {
    ui.notifications.warn(T('E20.LevelPickNoChoices', { pick: levelPickLabel(pick) }));
    return false;
  }

  const { default: ChoicesSelector } = await import("../../apps/choices-selector.mjs");
  const label = levelPickLabel(pick);
  const selector = new ChoicesSelector(choices, actor, T('E20.LevelPickPrompt', { name: actor.name, pick: label }), label,
    null, null, null, null, null, null, 'choose');
  selector._onChoose = uuid => chooseLevelPick(actor, pick.key, uuid, { chain });
  await selector.render(true);
  return true;
}

/** Hooks waiting for a chosen item to be created, per actor - a new pick replaces the last. */
const waiting = new Map();

/**
 * Make a pick: add the chosen item through the sheet's own drop handler, and clear the pick once the item exists.
 * @param {Actor} actor
 * @param {String} key
 * @param {String} uuid   The chosen compendium item.
 * @param {Object} [options]
 * @param {Boolean} [options.chain]
 */
export async function chooseLevelPick(actor, key, uuid, { chain = false } = {}) {
  // Fresh read: another client (the GM, or the player) may have made this pick already.
  const pick = pendingLevelPicks(actor).find(entry => entry.key == key);
  if (!pick) {
    ui.notifications.info(T('E20.LevelPickAlreadyMade'));
    return;
  }

  const source = await fromUuid(uuid);
  if (!source) {
    return;
  }

  // The chosen item may be created later than the drop returns (a Perk with a choice of its own is created once
  // that is answered), so the pick is closed off when it is created rather than here.
  const previous = waiting.get(actor.id);
  if (previous) {
    Hooks.off('createItem', previous);
  }

  const parsedId = String(uuid).split('.').pop();
  const hookId = Hooks.on('createItem', async (item, options, userId) => {
    if (userId != game.user.id || item.parent?.id != actor.id
      || (sourceOf(item) != uuid && item.system?.originalId != parsedId)) {
      return;
    }

    Hooks.off('createItem', hookId);
    waiting.delete(actor.id);
    await item.setFlag('essence20', 'levelPick', { key: pick.key, kind: pick.kind, track: pick.track, level: pick.level });
    await actor.setFlag('essence20', LEVEL_PICK_FLAG, pendingLevelPicks(actor).filter(entry => entry.key != pick.key));
    if (chain) {
      const next = pendingLevelPicks(actor)[0];
      if (next) {
        await openLevelPick(actor, next.key, { chain: true });
      }
    }
  });
  waiting.set(actor.id, hookId);

  const { onDropItem } = await import("../../sheet-handlers/drop-handler.mjs");
  // The same create the sheet's own drop makes (ActorSheetV2#_onDropItem): a compendium copy with its source set.
  const dropFunc = async () => {
    const keepId = !actor.items.has(source.id);
    const data = source.inCompendium ? game.items.fromCompendium(source, { clearFolder: true, keepId }) : source.toObject();
    const created = await Item.implementation.create(data, { parent: actor, keepId });
    return created ? [created] : [];
  };

  await onDropItem({ type: 'Item', uuid }, actor, dropFunc);
}

/**
 * The sheet header's button: asks which pending pick to make, or to mark them all done (a character whose picks were
 * made by hand before this existed, or a table that doesn't want them).
 * @param {Actor} actor
 */
export async function reviewLevelPicks(actor) {
  const pending = pendingLevelPicks(actor);
  if (!pending.length) {
    return;
  }

  const buttons = pending.map((pick, index) => ({ action: pick.key, label: levelPickLabel(pick), default: index == 0 }));
  buttons.push({ action: '__dismiss', label: T('E20.LevelPickDismissAll'), icon: 'fa-solid fa-check-double' });
  const answer = await foundry.applications.api.DialogV2.wait({
    window: { title: T('E20.LevelPickTitle') },
    classes: ['window-app', 'e20-window'],
    content: `<p>${escape(T('E20.LevelPickPending', { name: actor.name }))}</p>`,
    buttons,
    rejectClose: false,
  });

  if (answer == '__dismiss') {
    await actor.setFlag('essence20', LEVEL_PICK_FLAG, []);
  } else if (answer) {
    await openLevelPick(actor, answer);
  }
}
