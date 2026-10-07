import { findCompendiumItems, pickCompendiumItem } from "../../util/compendium-item-picker.mjs";
import { NO_PICK, searchBoxHtml, searchedValue, searchSelectAttrs, selectSearchRender } from "../../util/select-search.mjs";
import { grantKindOf, imperfectionOf } from "./grant-uses.mjs";
import { getSceneEpoch } from "./scene-clock.mjs";
import { lineOf } from "./game-lines.mjs";
import { ruleEssenceRedirect } from "../../rules/plugins/resources/uses-grant-pieces.mjs";
import { itemsOf, sourceOfOrUndefined as sourceOf } from "../../items/shared/item-lookups.mjs";

/**
 * Items that hand the character something to pick - a free upgrade at Requisition, another Role's
 * Perk, a weapon made on the spot, a light to carry. Each has a Use button (the table is in
 * mechanics/resources/grant-uses.mjs); pressing it asks for the choice and creates the item.
 *
 * Granted items carry flags.essence20.grantedBy (the id of the item that granted them), and the
 * granting item is marked flags.essence20.granted once a one-time grant is made, so its button goes
 * away. Items that only last a while use the same flags.essence20.temporary stamp as the weapon
 * upgrades (items/attacks/weapon-perk-uses.mjs#isExpired) and are swept the same way; 'combat' (until the
 * combat ends) and endsOnFumble were added for Manifest Melee Weapon, Riot Gear, Never Unarmed and
 * Brainstorm.
 *
 * Every rule is quoted where it's implemented. Where a grant has a prerequisite the system can't
 * read ("You must meet the weapon's requirements", "provided you meet its prerequisites"), the
 * picker offers everything and the table decides - the same honor-system drop the rest of the
 * system makes for free-text prerequisites.
 */

const AVAILABILITY = ['standard', 'limited', 'restricted', 'prototype', 'unique', 'theoretical'];
const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/** A kit's availability is in its name ("Limited Burglary Kit"). */
export function kitAvailability(name) {
  const first = String(name ?? '').split(/\s+/)[0]?.toLowerCase();
  return AVAILABILITY.includes(first) ? first : 'standard';
}

/* -------------------------------------------- */
/*  Creating what was picked                     */
/* -------------------------------------------- */

/**
 * Create a copy of a compendium item on the actor, with its attacks and upgrades.
 * @param {Actor} actor
 * @param {String} uuid
 * @param {Object} [options]
 * @param {Item} [options.grantedBy]
 * @param {Object} [options.temporary]   A weapon-perk-uses.mjs temporary stamp.
 * @param {Boolean} [options.integrated]   Give it the Integrated trait.
 * @param {Object} [options.flags]   More flags.essence20 entries.
 * @param {Object} [options.system]   Overrides for system data.
 * @returns {Promise<Item|null>}
 */
/**
 * Built in: a weapon's size becomes Integrated (E20.weaponSizes - free of the hand limit). There is no Integrated
 * trait (weapon / upgrade traits don't list one), and adding one made the weapon fail validation, so the copy was
 * never created. Other item types have nothing to change.
 * @param {Object} data   Item data, changed in place.
 */
export function markIntegrated(data) {
  if (data?.type == 'weapon') {
    foundry.utils.setProperty(data, 'system.classification.size', 'integrated');
  }

  return data;
}

export async function grantCopy(actor, uuid, { grantedBy = null, temporary = null, integrated = false, flags = {}, system = {}, name = null } = {}) {
  const source = await fromUuid(uuid);
  if (!source) {
    return null;
  }

  const data = source.toObject();
  delete data._id;
  if (name) {
    data.name = name;
  }

  foundry.utils.setProperty(data, 'flags.core.sourceId', uuid);
  const stamp = { ...flags, ...(grantedBy ? { grantedBy: grantedBy.id } : {}), ...(temporary ? { temporary } : {}) };
  for (const [key, value] of Object.entries(stamp)) {
    foundry.utils.setProperty(data, `flags.essence20.${key}`, value);
  }

  if (integrated) {
    markIntegrated(data);
  }

  for (const [path, value] of Object.entries(system)) {
    foundry.utils.setProperty(data, `system.${path}`, value);
  }

  const [created] = await actor.createEmbeddedDocuments('Item', [data]);
  if (!created) {
    return null;
  }

  const { createItemCopies } = await import("../../sheet-handlers/attachment-handler.mjs");
  if (['armor', 'weapon'].includes(created.type)) {
    await createItemCopies(created.system.items ?? {}, actor, 'upgrade', created);
  }

  if (['shield', 'weapon'].includes(created.type)) {
    await createItemCopies(created.system.items ?? {}, actor, 'weaponEffect', created);
  }

  // The weapon's own attacks go when it does.
  if (temporary) {
    const children = itemsOf(actor).filter(item => item.flags?.essence20?.parentId == created.id);
    if (children.length) {
      await actor.updateEmbeddedDocuments('Item', children.map(child => ({ _id: child.id, 'flags.essence20.temporary': temporary })));
    }
  }

  return created;
}

function turnStamp() {
  const combat = game?.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : {};
}

/** A temporary stamp, as items/attacks/weapon-perk-uses.mjs#isExpired reads it. */
export function temporary(kind, extra = {}) {
  return { kind, ...turnStamp(), scene: getSceneEpoch(), ...extra };
}

/* -------------------------------------------- */
/*  Pickers                                      */
/* -------------------------------------------- */

export async function pickOne(title, rows) {
  if (!rows.length) {
    ui.notifications.warn(T('E20.GrantNothingToPick', { name: title }));
    return null;
  }

  return pickCompendiumItem(rows, { title, label: 'E20.GrantPickLabel' });
}

/**
 * Compendium weapons, armor, upgrades or gear matching a filter.
 * @param {Object} filter
 * @param {String} filter.type
 * @param {Array<String>} [filter.availabilities]
 * @param {Function} [filter.matches]
 * @param {Array<String>} [filter.fields]
 */
export async function findItems({ type, availabilities = null, matches = null, fields = [] }) {
  const useKitNames = type == 'gear';
  return findCompendiumItems({
    type,
    availabilities: useKitNames ? null : availabilities,
    fields: [...fields, 'system.traits', 'system.type', 'system.gearType', 'system.classification', 'system.items', 'folder'],
    matches: entry => {
      if (useKitNames && availabilities && !availabilities.includes(entry.system?.availability ?? kitAvailability(entry.name))) {
        return false;
      }

      return !matches || matches(entry);
    },
  });
}

/** Pick and grant one item. */
export async function pickAndGrant(actor, grantor, title, filter, options = {}) {
  const rows = await findItems(filter);
  const uuid = await pickOne(title, rows);
  return uuid ? grantCopy(actor, uuid, { grantedBy: grantor, ...options }) : null;
}

export async function chooseButtons(title, prompt, choices) {
  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    content: `<p>${prompt}</p>`,
    buttons: choices.map(([action, label]) => ({ action, label })),
    rejectClose: false,
  });
}

export async function chooseSelect(title, prompt, options) {
  if (!options.length) {
    return null;
  }

  // Options carrying a `group` (rules pickSubPerk's game lines) are shown under one heading per group, in their order.
  const option = o => `<option value="${o.value}">${foundry.utils.escapeHTML(o.label)}</option>`;
  const groups = [...new Set(options.map(o => o.group).filter(Boolean))];
  const list = groups.length
    ? [...options.filter(o => !o.group).map(option), ...groups.map(group => `<optgroup label="${foundry.utils.escapeHTML(group)}">${options.filter(o => o.group == group).map(option).join('')}</optgroup>`)].join('')
    : options.map(option).join('');
  // A long list gets a search box (util/select-search.mjs); nothing visible answers NO_PICK, taken as a cancel.
  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    content: `<p>${prompt}</p>${searchBoxHtml(options.length)}<div class="form-group"><select name="choice"${searchSelectAttrs(options.length)}>${list}</select></div>`,
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => searchedValue(button.form.elements.choice) },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    render: selectSearchRender(),
    rejectClose: false,
  }).then(result => (result && result != 'cancel' && result !== NO_PICK ? result : null));
}

/**
 * A Skill Test against a DIF; resolves to {success, crit}.
 */
export async function rollTest(actor, skill, dif, extra = {}) {
  const essence = CONFIG.E20.skillToEssence?.[skill] ?? 'smarts';
  const result = await actor._dice?.rollSkill({ skill, essence, shiftUp: 0, shiftDown: 0, dif: String(dif), ...extra }, actor);
  const first = result?.outcomes?.[0]?.results?.[0];
  // total: the roll's total (rules/steps.mjs keeps it as @var.rollTotal).
  // multiplier: the Degrees of Success (0 on a failure) - rules/steps.mjs keeps it as @var.multiplier.
  return { success: !!result?.success, crit: !!first && first.multiplier >= 2, total: Number(result?.outcomes?.[0]?.roll?.total ?? first?.total) || 0, multiplier: result?.success ? Math.max(1, Number(first?.multiplier) || 1) : 0 };
}

/* -------------------------------------------- */
/*  Role and Focus Perks from elsewhere          */
/* -------------------------------------------- */

async function roleAndFocusIndex() {
  const { getVisibleItemPacks } = await import("../../util/compendium-browser.mjs");
  const rows = [];
  for (const pack of getVisibleItemPacks()) {
    const index = await pack.getIndex({ fields: ['type', 'system.items', 'system.isAdvanced'] });
    for (const entry of index.values()) {
      if (['role', 'focus'].includes(entry.type)) {
        rows.push(entry);
      }
    }
  }

  return rows;
}

function perkEntries(entry, subtype = 'role') {
  return Object.values(entry.system?.items ?? {}).filter(e => e?.type == 'perk' && (!subtype || e.subtype == subtype) && e.level);
}

/**
 * Pick a Perk from another Role (or Focus) and grant it.
 * @param {Actor} actor
 * @param {Item} grantor
 * @param {Object} rule
 * @param {Function} rule.containers   (index rows, actor) => the Roles/Focuses to offer from.
 * @param {Function} rule.allow   (perk entry, container) => whether it can be chosen.
 * @param {String} [rule.subtype]
 */
async function pickRolePerk(actor, grantor, { containers, allow, subtype = 'role' }) {
  const index = await roleAndFocusIndex();
  const options = [];
  const seen = new Set();
  for (const container of containers(index, actor)) {
    for (const entry of perkEntries(container, subtype)) {
      if (!allow(entry, container) || seen.has(entry.uuid)) {
        continue;
      }

      seen.add(entry.uuid);
      options.push({ value: entry.uuid, label: `${container.name}: ${entry.name} (${entry.level})` });
    }
  }

  options.sort((a, b) => a.label.localeCompare(b.label));
  const uuid = await chooseSelect(grantor.name, T('E20.GrantPickRolePerk'), options);
  if (!uuid) {
    return null;
  }

  const { grantPerkOutright } = await import("../../sheet-handlers/perk-handler.mjs");
  await grantPerkOutright(actor, uuid);
  const created = itemsOf(actor).find(item => sourceOf(item) == uuid);
  await created?.setFlag?.('essence20', 'grantedBy', grantor.id);
  return created;
}

/**
 * The `pickPerk` rule step (rules/steps.mjs): pickRolePerk from a declarative spec.
 * @param {Object} spec
 * @param {String} spec.from   'role' | 'focus' | 'branch' (the Role stored by Branch Leader).
 * @param {String} [spec.line]   'same' (the grantor's own game line) or a line key (gij, pr, tf, mlp, wtnv).
 * @param {Boolean} [spec.notOwn]   Not the actor's own Role / Focus.
 * @param {Boolean} [spec.ofOwnRole]   Focuses only: those belonging to the actor's own Role.
 * @param {Boolean} [spec.notAdvanced]   Not an Advanced Role (Gold, Silver, Phantom... Rangers).
 * @param {Number} [spec.minLevel]
 * @param {Number} [spec.maxLevel]
 * @param {Boolean} [spec.notOwnPerkNames]   Not a Perk sharing a name with one of the actor's own Role's.
 * @param {String} [spec.excludeName]   A case-insensitive pattern of Perk names to leave out.
 * @param {String} [spec.pack]   Only Roles / Focuses from that compendium (its name, e.g. pr_crb).
 * @param {String|null} [spec.subtype]   The Perk subtype offered ('role'; null for any).
 * @returns {Promise<Item|null>}   The granted Perk.
 */
export async function pickPerkFrom(actor, grantor, spec = {}) {
  const role = ownRole(actor);
  const focus = ownFocus(actor);
  const line = spec.line == 'same' ? lineOf(sourceOf(grantor)) : spec.line;
  const own = spec.notOwnPerkNames ? ownRolePerkNames(actor) : new Set();
  const exclude = spec.excludeName ? new RegExp(spec.excludeName, 'i') : null;
  const branch = actor.getFlag?.('essence20', 'exemplarBranch');
  if (spec.from == 'branch' && !branch) {
    ui.notifications.warn(T('E20.GrantNeedsBranch'));
    return null;
  }

  return pickRolePerk(actor, grantor, {
    subtype: spec.subtype === undefined ? (spec.from == 'focus' ? null : 'role') : spec.subtype,
    containers: index => index.filter(e => {
      if (spec.from == 'branch') {
        return e.uuid == branch;
      }

      // pack: only that compendium's Roles / Focuses (pr_crb - the Core Ranger Spectrum Roles).
      if (e.type != spec.from || (line && lineOf(e.uuid) != line) || (spec.notAdvanced && e.system?.isAdvanced)
        || (spec.pack && String(e.uuid ?? '').split('.')[2] != spec.pack)) {
        return false;
      }

      if (spec.notOwn && (spec.from == 'role' ? e.name == role?.name : e.uuid == sourceOf(focus))) {
        return false;
      }

      return !spec.ofOwnRole || Object.values(e.system?.items ?? {}).some(x => x?.type == 'role' && (x.uuid == sourceOf(role) || x.name == role?.name));
    }),
    allow: entry => (spec.minLevel === undefined || entry.level >= spec.minLevel)
      && (spec.maxLevel === undefined || entry.level <= spec.maxLevel)
      && !own.has(entry.name?.toLowerCase()) && !(exclude && exclude.test(entry.name ?? '')),
  });
}

function ownRole(actor) {
  return itemsOf(actor).find(item => item.type == 'role') ?? null;
}

function ownFocus(actor) {
  return itemsOf(actor).find(item => item.type == 'focus') ?? null;
}

function ownRolePerkNames(actor) {
  const role = ownRole(actor);
  return new Set(Object.values(role?.system?.items ?? {}).filter(e => e?.type == 'perk').map(e => e.name?.toLowerCase()));
}

/* -------------------------------------------- */
/*  The Use buttons                              */
/* -------------------------------------------- */

/**
 * Run a grant's Use button.
 * @param {Item} item   The granting item.
 * @param {Object} economy   mechanics/actions/action-economy.mjs.
 * @returns {Promise<String|null>}   The chat line.
 */
export async function runGrant(item, economy) {
  const kind = grantKindOf(item);
  const actor = item?.parent;
  if (!kind || !actor) {
    return null;
  }

  const pay = async (cost) => {
    if (!cost || !game.combat || !economy) {
      return true;
    }

    const paid = await economy.spend(actor, cost, { source: item.name });
    return !paid.blocked;
  };

  const handler = HANDLERS[kind];
  const result = handler ? await handler(actor, item, pay, economy) : null;

  return result === true ? T('E20.GrantDone', { name: actor.name, item: item.name }) : (result || null);
}

const HANDLERS = {
  // (Personal Power Supply's Grid Power pick is a Use rule on the Perk - pickGrant.)

  // (A Hint of Independence's General Perk and imperfection are a Use rule on the Perk; the imperfection is read through
  // grant-uses.mjs#imperfectionOf.)

  // (Glow, Candle, Torch, Headlamp and Candlesprite Lantern are tokenLight rules.)
};

/* -------------------------------------------- */
/*  Shared pieces                                */
/* -------------------------------------------- */

/** Whether a weapon counts as an Adept Armament. */
export function isAdeptArmament(weapon) {
  return !!weapon?.flags?.essence20?.adeptArmament;
}

/* -------------------------------------------- */
/*  Read elsewhere                               */
/* -------------------------------------------- */

/**
 * Where a Role's Essence increase goes: the actor's EssenceRedirect rules (Cordial sends the chosen Essence's
 * increases to Social, Rough and Takes No Guff an Officer's Speed increases to Strength -
 * rules/plugins/resources/uses-grant-pieces.mjs). Called by sheet-handlers/role-handler.mjs#setRoleValues for each
 * Essence it raises.
 * @param {Actor} actor
 * @param {Item} role
 * @param {String} essence
 * @returns {String}
 */
export function essenceRedirect(actor, role, essence) {
  return ruleEssenceRedirect(actor, role, essence) ?? essence;
}

/** A Hint of Independence's imperfection, if the actor has one: {n, imperfectionType} (grant-uses.mjs). */
export { imperfectionOf };

/**
 * A weapon with endsOnFumble goes away on a Fumble (Never Unarmed, Brainstorm). Called by
 * documents/item.mjs after an attack.
 * @param {Actor} actor
 * @param {Item} weapon
 * @param {Object} rollResult
 */
export async function endOnFumble(actor, weapon, rollResult) {
  if (!weapon?.flags?.essence20?.endsOnFumble || !(rollResult?.outcomes ?? []).some(o => o?.isFumble)) {
    return;
  }

  const ids = [weapon.id, ...itemsOf(actor).filter(e => e.flags?.essence20?.parentId == weapon.id).map(e => e.id)];
  await actor.deleteEmbeddedDocuments('Item', ids);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: T('E20.GrantEndedOnFumble', { weapon: weapon.name }) });
}
