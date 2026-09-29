import { findCompendiumItems, pickCompendiumItem } from "./item-picker.mjs";
import { GRANT, grantKindOf, ONCE } from "./grant-uses.mjs";
import { getSceneEpoch, markUsed } from "./scene-clock.mjs";
import { actorHasPerk, findPerk } from "./perks.mjs";

/**
 * Items that hand the character something to pick - a free upgrade at Requisition, another Role's
 * Perk, a weapon made on the spot, a light to carry. Each has a Use button (the table is in
 * helpers/grant-uses.mjs); pressing it asks for the choice and creates the item.
 *
 * Granted items carry flags.essence20.grantedBy (the id of the item that granted them), and the
 * granting item is marked flags.essence20.granted once a one-time grant is made, so its button goes
 * away. Items that only last a while use the same flags.essence20.temporary stamp as the weapon
 * upgrades (helpers/weapon-perk-uses.mjs#isExpired) and are swept the same way; 'combat' (until the
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

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
}

function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  if (Array.isArray(items.contents)) {
    return items.contents;
  }

  return typeof items[Symbol.iterator] == 'function' ? [...items] : [];
}

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

  if (integrated && Array.isArray(data.system?.traits) && !data.system.traits.includes('integrated')) {
    data.system.traits = [...data.system.traits, 'integrated'];
  }

  for (const [path, value] of Object.entries(system)) {
    foundry.utils.setProperty(data, `system.${path}`, value);
  }

  const [created] = await actor.createEmbeddedDocuments('Item', [data]);
  if (!created) {
    return null;
  }

  const { createItemCopies } = await import("../sheet-handlers/attachment-handler.mjs");
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

/** A temporary stamp, as helpers/weapon-perk-uses.mjs#isExpired reads it. */
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

const effectsOfEntry = entry => Object.values(entry.system?.items ?? {}).filter(e => e?.type == 'weaponEffect');
const isMeleeEntry = entry => effectsOfEntry(entry).some(e => e.classification?.style == 'melee' || e.range?.reachMultiplier > 0);
const isRangedEntry = entry => effectsOfEntry(entry).some(e => e.classification?.style && e.classification.style != 'melee');
const oneHanded = entry => effectsOfEntry(entry).every(e => String(e.numHands ?? '1') == '1');
const hasTrait = trait => entry => (entry.system?.traits ?? []).includes(trait);

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

  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    content: `<p>${prompt}</p><div class="form-group"><select name="choice">${
      options.map(o => `<option value="${o.value}">${foundry.utils.escapeHTML(o.label)}</option>`).join('')
    }</select></div>`,
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => button.form.elements.choice.value },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  }).then(result => (result && result != 'cancel' ? result : null));
}

/**
 * A Skill Test against a DIF; resolves to {success, crit}.
 */
export async function rollTest(actor, skill, dif, extra = {}) {
  const essence = CONFIG.E20.skillToEssence?.[skill] ?? 'smarts';
  const result = await actor._dice?.rollSkill({ skill, essence, shiftUp: 0, shiftDown: 0, dif: String(dif), ...extra }, actor);
  const first = result?.outcomes?.[0]?.results?.[0];
  return { success: !!result?.success, crit: !!first && first.multiplier >= 2 };
}

/* -------------------------------------------- */
/*  Role and Focus Perks from elsewhere          */
/* -------------------------------------------- */

async function roleAndFocusIndex() {
  const { getVisibleItemPacks } = await import("./compendium-browser.mjs");
  const rows = [];
  for (const pack of getVisibleItemPacks()) {
    const index = await pack.getIndex({ fields: ['type', 'system.items'] });
    for (const entry of index.values()) {
      if (['role', 'focus'].includes(entry.type)) {
        rows.push(entry);
      }
    }
  }

  return rows;
}

function lineOf(uuid) {
  const pack = String(uuid ?? '').split('.')[2] ?? '';
  if (/^(gi_joe|cobra|quartermaster|general_hawk|intercontinental|ferocious|sgt_slaughter)/.test(pack)) return 'gij';
  if (/^(pr_|across_the_stars|jump_through|through_the_shattered|finster|beneath)/.test(pack)) return 'pr';
  if (/^(tf_|decepticon|enigma|technorganic|transformers)/.test(pack)) return 'tf';
  if (/^(mlp|knights_of)/.test(pack)) return 'mlp';
  if (/^wtnv/.test(pack)) return 'wtnv';
  return 'other';
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

  const { grantPerkOutright } = await import("../sheet-handlers/perk-handler.mjs");
  await grantPerkOutright(actor, uuid);
  const created = itemsOf(actor).find(item => sourceOf(item) == uuid);
  await created?.setFlag?.('essence20', 'grantedBy', grantor.id);
  return created;
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
 * @param {Object} economy   helpers/action-economy.mjs.
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
  if (result && ONCE.has(kind)) {
    await item.setFlag('essence20', 'granted', true);
  }

  return result === true ? T('E20.GrantDone', { name: actor.name, item: item.name }) : (result || null);
}

const level = actor => Number(actor?.system?.level) || 0;
const done = (actor, item, what) => T('E20.GrantGained', { name: actor.name, item: item.name, what: what.filter(Boolean).map(i => i.name).join(', ') });

const HANDLERS = {
  // Custom Gear (GI Joe CRB, Infantry, 2nd level, p.79): "you can requisition light or medium armor once
  // without spending one of your requisition attempts. Additionally, you can choose one free Limited
  // Armor Upgrade, and one Free Limited Weapon Upgrade."
  async customGear(actor, item) {
    const armor = await pickAndGrant(actor, item, item.name, { type: 'armor', matches: e => ['light', 'medium'].includes(e.system?.classification) });
    const armorUpgrade = await pickAndGrant(actor, item, item.name, { type: 'upgrade', availabilities: ['limited'], matches: e => e.system?.type == 'armor' });
    const weaponUpgrade = await pickAndGrant(actor, item, item.name, { type: 'upgrade', availabilities: ['limited'], matches: e => e.system?.type == 'weapon' });
    return armor || armorUpgrade || weaponUpgrade ? done(actor, item, [armor, armorUpgrade, weaponUpgrade]) : null;
  },

  // Forage (GI Joe CRB, Ranger, 3rd level, p.92): "spend 10 minutes and roll a Survival Skill Test to
  // gain the benefits of a Standard kit. The DIF is equal to the kit's Requisition DIF. This kit lasts
  // until you spend it or until you forage for another kit." Limited at 7th, Restricted at 13th;
  // Forage (Fast) at 15th makes it 1 minute. Kitbasher (Exposure): "You can forage for and use a kit,
  // even if you do not meet its prerequisite" - the picker never filters on prerequisites.
  async forage(actor, item) {
    return forageFor(actor, item, 'gear', e => e.system?.gearType == 'kits');
  },

  // Weapon Forage (Ferocious Fighters, General Perk, p.39): "When you forage, you can forage for
  // weapons. The availability of the weapon you can forage for matches the availability of the kit
  // the Role Perk lets you forage for ... you can choose to forage a weapon with the Salvaged weapon
  // upgrade."
  async weaponForage(actor, item) {
    if (!findPerk(actor, GRANT.forage)) {
      ui.notifications.warn(T('E20.WeaponForageNeedsForage'));
      return null;
    }

    const result = await forageFor(actor, item, 'weapon', () => true);
    const weapon = itemsOf(actor).filter(i => i.type == 'weapon' && i.flags?.essence20?.foraged && i.flags?.essence20?.grantedBy == item.id).at(-1);
    if (weapon && await chooseButtons(item.name, T('E20.WeaponForageSalvaged', { weapon: weapon.name }), [['yes', T('Yes')], ['no', T('No')]]) == 'yes') {
      const source = await fromUuid(GRANT.salvaged);
      if (source) {
        const data = source.toObject();
        delete data._id;
        foundry.utils.setProperty(data, 'flags.core.sourceId', GRANT.salvaged);
        foundry.utils.setProperty(data, 'flags.essence20.parentId', weapon.id);
        foundry.utils.setProperty(data, 'flags.essence20.grantedBy', item.id);
        const [created] = await actor.createEmbeddedDocuments('Item', [data]);
        const { setEntryAndAddItem } = await import("../sheet-handlers/attachment-handler.mjs");
        const key = created ? await setEntryAndAddItem(created, weapon) : null;
        if (key) {
          await created.setFlag('essence20', 'collectionId', key);
        }
      }
    }

    return result;
  },

  // Environmental Weapon (GI Joe CRB, Ranger Exposure, p.91): "In your environment of expertise, you
  // can forage for a melee weapon, just like you would a kit. You may use Survival to attack with
  // foraged weapons instead of Might or Finesse."
  async environmentalWeapon(actor, item) {
    return forageFor(actor, item, 'weapon', isMeleeEntry, { attackSkill: 'survival' });
  },

  // Primary Tech (GI Joe CRB, Technician, 1st level, p.102).
  async primaryTech(actor, item) {
    return techGrant(actor, item, false);
  },

  // Secondary Tech (11th level, p.103): "choose either a second item from the Primary Tech list, or
  // enhance your Primary Tech."
  async secondaryTech(actor, item) {
    return techGrant(actor, item, true);
  },

  // Customized Armor (GI Joe CRB, Juggernaut, 6th level, p.112): "you gain 2 Limited or 1 Restricted
  // armor upgrades. These picks do not count against the mission budget."
  async customizedArmor(actor, item) {
    const tier = await chooseButtons(item.name, T('E20.GrantCustomizedArmorPrompt'), [['limited', T('E20.GrantTwoLimited')], ['restricted', T('E20.GrantOneRestricted')]]);
    if (!tier) {
      return null;
    }

    const got = [];
    for (let i = 0; i < (tier == 'limited' ? 2 : 1); i++) {
      got.push(await pickAndGrant(actor, item, item.name, { type: 'upgrade', availabilities: [tier], matches: e => e.system?.type == 'armor' }));
    }

    return got.some(Boolean) ? done(actor, item, got) : null;
  },

  // Safety First (GI Joe CRB, Combat Medic, 1st level, p.82): "You are assigned a Limited medicine kit
  // that does not count against your requisition budget".
  async safetyFirst(actor, item) {
    const got = await pickAndGrant(actor, item, item.name, { type: 'gear', matches: e => e.system?.gearType == 'kits' && /medic/i.test(e.name) }, { system: { availability: 'limited' } });
    return got ? done(actor, item, [got]) : null;
  },

  // Spotter's Scope (GI Joe CRB, Sniper, 1st level, p.75): "You gain access to a limited weapon with the
  // Sniper trait and a Limited upgrade for it".
  async spottersScope(actor, item) {
    const weapon = await pickAndGrant(actor, item, item.name, { type: 'weapon', availabilities: ['standard', 'limited'], matches: hasTrait('sniper') });
    const upgrade = weapon ? await pickAndGrant(actor, item, item.name, { type: 'upgrade', availabilities: ['standard', 'limited'], matches: e => e.system?.type == 'weapon' }) : null;
    return weapon ? done(actor, item, [weapon, upgrade]) : null;
  },

  // Ghillie Suit Sniping (GI Joe CRB, Sniper, 10th level, p.75): "You may choose a weapon with the sniper
  // quality up to Restricted availability and a Restricted upgrade for free" - and, in the first round,
  // "replace the Battle Cry benefit to place yourself prone and hidden in any natural environment within
  // 100 feet of your team regardless of where you started the turn."
  async ghillieSuitSniping(actor, item) {
    if (!item.flags?.essence20?.granted) {
      const weapon = await pickAndGrant(actor, item, item.name, { type: 'weapon', availabilities: ['standard', 'limited', 'restricted'], matches: hasTrait('sniper') });
      const upgrade = weapon ? await pickAndGrant(actor, item, item.name, { type: 'upgrade', availabilities: ['standard', 'limited', 'restricted'], matches: e => e.system?.type == 'weapon' }) : null;
      if (weapon) {
        await item.setFlag('essence20', 'granted', true);
        return done(actor, item, [weapon, upgrade]);
      }

      return null;
    }

    const { pickCanvasPoint, placeActorAt } = await import("./forced-movement.mjs");
    const point = await pickCanvasPoint(T('E20.GhillieSuitPick'));
    if (!point) {
      return null;
    }

    const token = actor.getActiveTokens?.()?.[0];
    if (token) {
      await token.document.update({ x: Math.round(point.x - token.w / 2), y: Math.round(point.y - token.h / 2) });
    } else {
      await placeActorAt(actor, point);
    }

    await actor.toggleStatusEffect('prone', { active: true });
    await actor.toggleStatusEffect('invisible', { active: true });
    return T('E20.GhillieSuitDone', { name: actor.name });
  },

  // Integrated Offense (GI Joe CRB, Think Tank, 6th level, p.105): "you gain a combined number of
  // Microtech Weapon and Microtech Battledress upgrades equal to half your Technician level."
  async integratedOffense(actor, item) {
    const which = await chooseButtons(item.name, T('E20.GrantMicrotechPrompt'), [['weapon', T('E20.GrantMicrotechWeapon')], ['armor', T('E20.GrantMicrotechBattledress')]]);
    if (!which) {
      return null;
    }

    const uuid = which == 'weapon' ? 'Compendium.essence20.gi_joe_crb.Item.ihSql0Px1kNgTBfP' : 'Compendium.essence20.gi_joe_crb.Item.ERqpa98s445vypnL';
    const got = await grantCopy(actor, uuid, { grantedBy: item });
    if (!got) {
      return null;
    }

    await item.setFlag('essence20', 'grantedCount', (item.flags?.essence20?.grantedCount ?? 0) + 1);
    return done(actor, item, [got]);
  },

  // Kitbash Equipment (GI Joe CRB, Tinkerer, 10th level, p.105): "As a Standard action, make a
  // Technology Skill Test against the availability DIF of a piece of equipment that takes no more
  // than two hands to operate. On a success, you gain the equipment for 1 minute, multiplied on a
  // critical success."
  async kitbashEquipment(actor, item, pay) {
    return kitbash(actor, item, pay, 'standard', { kind: 'rounds', rounds: 10 }, { kind: 'rounds', rounds: 20 });
  },

  // Quickbash (17th level): "you can kitbash equipment and upgrades as a Free action instead of a
  // Standard action. Quickbashed equipment and upgrades last for 1 turn, multiplied on a critical
  // success."
  async quickbash(actor, item, pay) {
    const what = await chooseButtons(item.name, T('E20.GrantQuickbashPrompt'), [['equipment', T('E20.GrantEquipment')], ['upgrade', T('E20.GrantUpgrade')]]);
    if (what == 'upgrade') {
      return kitbashUpgrade(actor, item, pay);
    }

    return what ? kitbash(actor, item, pay, 'free', { kind: 'turn' }, { kind: 'nextTurn' }) : null;
  },

  // Cross-Training (GI Joe CRB p.130, TF CRB p.108): "Choose a Role other than your own. You may
  // select one of that Role's Perks with a level requirement no higher than half your current level.
  // You cannot choose a Role Perk with the same name as one in your own Role..., a Focus Perk, or a
  // level 1 Role Perk."
  async crossTrainingGij(actor, item) {
    return crossTraining(actor, item);
  },
  async crossTrainingTf(actor, item) {
    return crossTraining(actor, item);
  },

  // Split Focus (GI Joe CRB p.134): "Choose one of your Role's available Focus options that is not your
  // own. You may select one of that Focus's Perks with a level requirement no higher than half your
  // current level."
  async splitFocus(actor, item) {
    const role = ownRole(actor);
    const focus = ownFocus(actor);
    const roleSource = sourceOf(role);
    const got = await pickRolePerk(actor, item, {
      subtype: null,
      containers: index => index.filter(e => e.type == 'focus' && e.uuid != sourceOf(focus)
        && Object.values(e.system?.items ?? {}).some(x => x?.type == 'role' && (x.uuid == roleSource || x.name == role?.name))),
      allow: entry => entry.level <= Math.floor(level(actor) / 2),
    });
    return got ? done(actor, item, [got]) : null;
  },

  // Branch Leader (Cobra Codex, Exemplar, 1st level, p.56): "Choose another Role. This is your Branch."
  async branchLeader(actor, item) {
    const index = await roleAndFocusIndex();
    const role = ownRole(actor);
    const options = index.filter(e => e.type == 'role' && lineOf(e.uuid) == 'gij' && e.name != role?.name).map(e => ({ value: e.uuid, label: e.name }));
    const branch = await chooseSelect(item.name, T('E20.GrantPickBranch'), options);
    if (!branch) {
      return null;
    }

    await actor.setFlag('essence20', 'exemplarBranch', branch);
    return T('E20.GrantBranchSet', { name: actor.name, branch: options.find(o => o.value == branch)?.label ?? '' });
  },

  // Branch Perk (3rd, 6th, 10th, 17th, 20th): "Choose one of the Perks your Branch grants by that level
  // ... Branch Perk does not grant you your Branch's Focus Perks or General Perks." Each copy of Branch
  // Perk grants one.
  async branchPerk(actor, item) {
    const branch = actor.getFlag?.('essence20', 'exemplarBranch');
    if (!branch) {
      ui.notifications.warn(T('E20.GrantNeedsBranch'));
      return null;
    }

    const got = await pickRolePerk(actor, item, {
      containers: index => index.filter(e => e.uuid == branch),
      allow: entry => entry.level <= level(actor),
    });
    if (got) {
      await item.setFlag('essence20', 'granted', true);
    }

    return got ? done(actor, item, [got]) : null;
  },

  // Grid Spectrum Echo (Across the Stars, p.69): "Choose any Role Perk you once accessed in your
  // previous Spectrum Role(s); you now possess that Role Perk."
  async gridSpectrumEcho(actor, item) {
    const role = ownRole(actor);
    const got = await pickRolePerk(actor, item, {
      containers: index => index.filter(e => e.type == 'role' && lineOf(e.uuid) == 'pr' && e.name != role?.name),
      allow: entry => entry.level <= level(actor) && !/extra attack|general perk|grid power|zord/i.test(entry.name),
    });
    return got ? done(actor, item, [got]) : null;
  },

  // Prismatic Boon (Across the Stars, Grid Power, p.73): "gain one Role Perk from any standard
  // Spectrum Role (not Advanced Spectrum Roles). You must choose a Perk from a Level at least 3 levels
  // lower than your current level ... You cannot choose Extra Attack, General Perk, Grid Power, Zord,
  // or Zord Feature."
  async prismaticBoon(actor, item) {
    const got = await pickRolePerk(actor, item, {
      containers: index => index.filter(e => e.type == 'role' && lineOf(e.uuid) == 'pr' && !e.system?.isAdvanced),
      allow: entry => entry.level <= level(actor) - 3 && !/extra attack|general perk|grid power|zord/i.test(entry.name),
    });
    return got ? done(actor, item, [got]) : null;
  },

  // Cybertronian Perk (Field Guide, p.70): "Pick a Transformers Role. You gain the benefits of that
  // Role's Cybertronian Perk, including any cost associated with it."
  async cybertronianPerkFg(actor, item) {
    const perks = await findCompendiumItems({ type: 'perk', fields: ['system.isRoleVariant', 'system.items'], matches: e => e.system?.isRoleVariant && /cybertronian/i.test(e.name) });
    const options = [];
    for (const row of perks) {
      const perk = await fromUuid(row.uuid);
      for (const entry of Object.values(perk?.system?.items ?? {})) {
        if (entry?.uuid && entry.role) {
          options.push({ value: entry.uuid, label: `${entry.role}: ${entry.name}` });
        }
      }
    }

    const uuid = await chooseSelect(item.name, T('E20.GrantPickRolePerk'), options);
    if (!uuid) {
      return null;
    }

    const { grantPerkOutright } = await import("../sheet-handlers/perk-handler.mjs");
    await grantPerkOutright(actor, uuid);
    return true;
  },

  // On-The-Job Training (Intercontinental Adventures, p.95): "You gain the Origin Benefit of an Origin
  // other than the one you chose".
  async onTheJobTraining(actor, item) {
    return originBenefit(actor, item, 'gij', () => true);
  },

  // Cybertronian Military (Field Guide, p.52): "You gain the Origin Benefit of a G.I. JOE Origin that
  // isn't a Non-Military Origin."
  async cybertronianMilitary(actor, item) {
    return originBenefit(actor, item, 'gij', (origin) => !/civilian|non-military/i.test(origin.name));
  },

  // Cybertronian with Attitude (Field Guide, p.52): "You gain the Origin Benefit of a Power Rangers
  // Origin, though you can't choose an Origins that provides a General Perk as its Origin Benefit."
  async cybertronianWithAttitude(actor, item) {
    return originBenefit(actor, item, 'pr', () => true, perk => perk.system?.type != 'general');
  },

  // Grid Power (Field Guide, Grid Psychic, 6th level, p.68): "You gain a Grid Power. Additionally, you
  // gain +1 Personal Power per day."
  async gridPowerFg(actor, item) {
    const got = await pickAndGrant(actor, item, item.name, { type: 'power', matches: e => e.system?.type == 'grid' });
    if (!got) {
      return null;
    }

    await actor.update({ 'system.powers.personal.regeneration': (Number(actor.system?.powers?.personal?.regeneration) || 0) + 1 });
    return done(actor, item, [got]);
  },

  // Personal Power Supply (Field Guide, General Perk, p.71): "you can choose Grid Powers as General
  // Perks. You can never have more Grid Powers than your Personal Power Point capacity."
  async personalPowerSupply(actor, item) {
    const got = await pickAndGrant(actor, item, item.name, { type: 'power', matches: e => e.system?.type == 'grid' });
    return got ? done(actor, item, [got]) : null;
  },

  // Integrated Basic/Advanced/Specialized Weapon (GI Joe CRB, drone upgrades, p.168-169): "The drone
  // gains a Standard weapon" / "a Limited weapon" / "The drone replaces its weapon. It gains a weapon
  // with an Availability one step less Available than the drone's Availability."
  async droneBasicWeapon(actor, item) {
    return droneWeapon(actor, item, ['standard']);
  },
  async droneAdvancedWeapon(actor, item) {
    return droneWeapon(actor, item, ['limited']);
  },
  async droneSpecializedWeapon(actor, item) {
    const own = AVAILABILITY.indexOf(actor.system?.availability ?? 'standard');
    return droneWeapon(actor, item, [AVAILABILITY[Math.min(AVAILABILITY.length - 1, Math.max(0, own) + 1)]], true);
  },

  // Animalize (Cobra Codex, Standard Alteration, p.84): "Gain an Animal Perk (from the Pets sections...).
  // When you gain General Perks, you can choose Animal Perks instead."
  async animalize(actor, item) {
    const { getVisibleItemPacks } = await import("./compendium-browser.mjs");
    const rows = [];
    for (const pack of getVisibleItemPacks()) {
      const petFolders = new Set((pack.folders?.contents ?? [...(pack.folders ?? [])]).filter(f => /^pets?$/i.test(f.name)).map(f => f.id));
      if (!petFolders.size) {
        continue;
      }

      const index = await pack.getIndex({ fields: ['folder', 'type'] });
      for (const entry of index.values()) {
        if (entry.type == 'perk' && petFolders.has(entry.folder)) {
          rows.push({ uuid: entry.uuid, name: entry.name });
        }
      }
    }

    const uuid = await pickOne(item.name, rows.sort((a, b) => a.name.localeCompare(b.name)));
    if (!uuid) {
      return null;
    }

    const { grantPerkOutright } = await import("../sheet-handlers/perk-handler.mjs");
    await grantPerkOutright(actor, uuid);
    return true;
  },

  // Skin Tempering / Zeta Skin Transplant (Cobra Codex p.84-87): "Gain the benefits of a Standard
  // [Limited, Restricted, Prototypical] Battledress Upgrade, whether you're wearing armor or not. You
  // need not meet the prerequisites of the Upgrade to gain its benefits." The upgrade is kept loose on
  // the actor and counted as worn (documents/actor.mjs#_prepareDefenses).
  async standardSkinTempering(actor, item) {
    return skinUpgrade(actor, item, 'standard');
  },
  async limitedSkinTempering(actor, item) {
    return skinUpgrade(actor, item, 'limited');
  },
  async restrictedSkinTempering(actor, item) {
    return skinUpgrade(actor, item, 'restricted');
  },
  async zetaSkinTransplant(actor, item) {
    return skinUpgrade(actor, item, 'prototype');
  },

  // Weaponization (Cobra Codex p.84-87). Standard/Limited: "Gain a Standard [Limited] Weapon with a Range
  // of Reach as an Integrated weapon." Martial: "Gain a ranged weapon as an Integrated weapon. The
  // weapon must be Standard or Limited availability, Medium or Sidearm sized, and take one hand to
  // wield." Y-Series: "Gain a weapon as an Integrated weapon. The weapon can be of any availability,
  // any size, and take one or two hands to wield."
  async standardWeaponization(actor, item) {
    return integratedWeapon(actor, item, { type: 'weapon', availabilities: ['standard'], matches: isMeleeEntry });
  },
  async limitedWeaponization(actor, item) {
    return integratedWeapon(actor, item, { type: 'weapon', availabilities: ['limited'], matches: isMeleeEntry });
  },
  async martialWeaponization(actor, item) {
    return integratedWeapon(actor, item, {
      type: 'weapon', availabilities: ['standard', 'limited'],
      matches: e => isRangedEntry(e) && ['medium', 'sidearm'].includes(e.system?.classification?.size) && oneHanded(e),
    });
  },
  async ySeriesWeaponization(actor, item) {
    return integratedWeapon(actor, item, { type: 'weapon' });
  },

  // Armed (Cobra Codex, Trooper, 1st level, p.52): "You gain the Weapon Training General Perk. The three
  // Limited weapons, or one Restricted weapon, you choose are considered your Adept Armaments."
  async armed(actor, item) {
    const { grantPerkOutright } = await import("../sheet-handlers/perk-handler.mjs");
    await grantPerkOutright(actor, GRANT.weaponTraining);
    const count = await designateAdept(actor, item, 3);
    return count != null ? T('E20.AdeptDesignated', { name: actor.name, count }) : null;
  },

  // Quick Draw (3rd level) / Steady Hand (10th level): "Additionally, another weapon of your choice that
  // you are trained in counts as one of your Adept Armaments."
  async adeptQuickDraw(actor, item) {
    const count = await designateAdept(actor, item, 1);
    return count != null ? T('E20.AdeptDesignated', { name: actor.name, count }) : null;
  },
  async steadyHand(actor, item) {
    const count = await designateAdept(actor, item, 1);
    return count != null ? T('E20.AdeptDesignated', { name: actor.name, count }) : null;
  },

  // Multifaceted (Ferocious Fighters, Influence Perk, p.8): "During Equipment Requisition, you can ignore
  // a benefit of your current Faction Perk and instead gain a benefit of another Faction you qualify
  // for." Its Hang-Up: "your GM also chooses a benefit of your current Faction Perk to swap out for the
  // benefit of another Faction Perk you qualify for." Both run the same swap.
  async multifaceted(actor, item) {
    return swapFactionPerk(actor, item);
  },
  async multifacetedHangUp(actor, item) {
    return swapFactionPerk(actor, item);
  },

  // Faction Reservist (Ferocious Fighters, General Perk, p.9): "Choose a Faction for which you meet the
  // requirements. Once per mission, you can use the Faction's benefits for 1 scene."
  async factionReservist(actor, item) {
    const faction = await pickFaction(item.name);
    if (!faction) {
      return null;
    }

    const perks = await grantFactionPerks(actor, faction, item, temporary('scene'));
    await markUsed(actor, 'factionReservist', { window: 'scene' });
    return T('E20.FactionBorrowed', { name: actor.name, faction: faction.name, perks: perks.map(p => p.name).join(', ') });
  },

  // Field Promotion (Ferocious Fighters, General Perk, p.9): "You may spend a Story Point to grant your
  // faction's perks to an ally who is not a member of your faction for the duration of the scene."
  async fieldPromotion(actor, item) {
    const ally = game.user?.targets?.first?.()?.actor;
    const faction = itemsOf(actor).find(i => i.type == 'faction');
    if (!ally || !faction) {
      ui.notifications.warn(T(ally ? 'E20.FactionNone' : 'E20.GrantNeedsAlly'));
      return null;
    }

    const { canSpendForActor, spendForActor } = await import("./story-points.mjs");
    if (!canSpendForActor(actor, 1)) {
      ui.notifications.warn(T('E20.ActionPerkNoStoryPoint', { perk: item.name }));
      return null;
    }

    await spendForActor(actor, 1);
    const perks = await grantFactionPerks(ally, faction, item, temporary('scene'));
    return T('E20.FactionBorrowed', { name: ally.name, faction: faction.name, perks: perks.map(p => p.name).join(', ') });
  },

  // Factions (Field Guide, Envoy, 1st level, p.64): "Choose two factions, such as Power Rangers, G.I.
  // Joe, or Autobots. You gain the Faction Benefits of both factions."
  async factionsEnvoy(actor, item) {
    const got = [];
    for (let i = 0; i < 2; i++) {
      const faction = await pickFaction(item.name, got.map(f => f.uuid));
      if (!faction) {
        break;
      }

      const created = await grantCopy(actor, faction.uuid, { grantedBy: item });
      if (created) {
        const { onFactionDrop } = await import("../sheet-handlers/faction-handler.mjs");
        await onFactionDrop(actor, null, created);
        got.push({ uuid: faction.uuid, name: faction.name });
      }
    }

    return got.length ? done(actor, item, got) : null;
  },

  // Cordial (Ferocious Fighters, Explorer, 3rd level, p.14): "choose an Essence Score other than
  // Social. Whenever your Role increases your chosen Essence Score, you can instead increase your
  // Social Essence Score." Read by sheet-handlers/role-handler.mjs#setRoleValues.
  async cordial(actor, item) {
    const essence = await chooseSelect(item.name, T('E20.GrantPickEssence'), ['strength', 'speed', 'smarts']
      .map(value => ({ value, label: T(CONFIG.E20.essences?.[value] ?? value) })));
    if (!essence) {
      return null;
    }

    await item.setFlag('essence20', 'redirectFrom', essence);
    return T('E20.EssenceRedirectSet', { name: actor.name, item: item.name, from: T(CONFIG.E20.essences?.[essence] ?? essence), to: T(CONFIG.E20.essences?.social ?? 'social') });
  },

  // Rough and Takes No Guff (Sgt. Slaughter Sourcebook, p.10): "When the Table 5-13: Officer ... lists
  // a Speed Essence Boost, you can choose to invest it into Strength or Speed". A switch.
  async roughAndTakesNoGuff(actor, item) {
    const on = !item.flags?.essence20?.redirectFrom;
    await item.setFlag('essence20', 'redirectFrom', on ? 'speed' : null);
    return T(on ? 'E20.EssenceRedirectSet' : 'E20.EssenceRedirectOff', {
      name: actor.name, item: item.name, from: T(CONFIG.E20.essences?.speed ?? 'speed'), to: T(CONFIG.E20.essences?.strength ?? 'strength'),
    });
  },

  // Thick Skulls (Intercontinental Adventures, Dreadnoks, p.36): "Whenever you increase your Smarts
  // Essence Score, you can choose to increase your Toughness instead of your Willpower." How many of
  // the Smarts increases went to Toughness; documents/actor.mjs moves that much.
  async thickSkulls(actor, item) {
    const max = Number(actor.system?.essences?.smarts?.max) || 0;
    const options = Array.from({ length: max + 1 }, (_, n) => ({ value: String(n), label: String(n) }));
    const picked = await chooseSelect(item.name, T('E20.ThickSkullsPrompt'), options);
    if (picked == null) {
      return null;
    }

    await item.setFlag('essence20', 'toToughness', Number(picked));
    return T('E20.ThickSkullsSet', { name: actor.name, count: picked });
  },

  // Brainstorm (A Jump Through Time, Green Spectrum Modification, p.45): "spend one hour to attempt a
  // Technology Skill Test to craft a weapon or piece of gear [that] will last until a Fumble is rolled
  // on a Skill Test using that item ... You cannot have more than 3 working items made with Brainstorm
  // at any given time. Standard items require no Skill Test, Limited DIF 10, Restricted DIF 15,
  // Prototype DIF 20, Unique or Theoretical DIF 30 and the expenditure of a Story Point."
  async brainstorm(actor, item) {
    const made = itemsOf(actor).filter(i => i.flags?.essence20?.brainstorm);
    if (made.length >= 3) {
      ui.notifications.warn(T('E20.BrainstormLimit'));
      return null;
    }

    const type = await chooseButtons(item.name, T('E20.GrantQuickbashPrompt'), [['weapon', T('E20.GrantWeapon')], ['gear', T('E20.GrantGear')]]);
    if (!type) {
      return null;
    }

    const rows = await findItems({ type });
    const uuid = await pickOne(item.name, rows);
    const source = uuid ? await fromUuid(uuid) : null;
    if (!source) {
      return null;
    }

    const availability = source.system?.availability ?? kitAvailability(source.name);
    const dif = { standard: 0, limited: 10, restricted: 15, prototype: 20, unique: 30, theoretical: 30 }[availability] ?? 0;
    if (['unique', 'theoretical'].includes(availability)) {
      const { canSpendForActor, spendForActor } = await import("./story-points.mjs");
      if (!canSpendForActor(actor, 1)) {
        ui.notifications.warn(T('E20.ActionPerkNoStoryPoint', { perk: item.name }));
        return null;
      }

      await spendForActor(actor, 1);
    }

    if (dif && !(await rollTest(actor, 'technology', dif)).success) {
      return T('E20.GrantFailed', { name: actor.name, item: item.name });
    }

    const got = await grantCopy(actor, uuid, { grantedBy: item, flags: { brainstorm: true, endsOnFumble: true } });
    return got ? done(actor, item, [got]) : null;
  },

  // S.P.D. Asset (Across the Stars, p.71): "the S.P.D. awards you access to one of the following: A set
  // of five Delta Blasters, DeltaMax Striker, Delta Patrol Cycle, R.I.C. (Robotic Interactive Canine),
  // Confiscated Xenotech (one Limited item, per GM's approval)."
  async spdAsset(actor, item) {
    const asset = await chooseButtons(item.name, T('E20.SpdAssetPrompt'), [
      ['blasters', 'Delta Blasters (5)'], ['striker', 'DeltaMax Striker'], ['cycle', 'Delta Patrol Cycle'], ['ric', 'R.I.C.'], ['xenotech', 'Xenotech'],
    ]);
    const ids = {
      blasters: 'Compendium.essence20.across_the_stars.Item.4oahai24Cxroir20',
      striker: 'Compendium.essence20.across_the_stars.Item.jUWANIOv9MCwKnN9',
      ric: 'Compendium.essence20.across_the_stars.Item.GGu11SYwOALYkJ61',
    };
    if (!asset) {
      return null;
    }

    if (asset == 'cycle') {
      return T('E20.SpdAssetCycle', { name: actor.name });
    }

    if (asset == 'xenotech') {
      const got = await pickAndGrant(actor, item, item.name, { type: 'weapon', availabilities: ['limited'] });
      return got ? done(actor, item, [got]) : null;
    }

    const got = await grantCopy(actor, ids[asset], { grantedBy: item, ...(asset == 'blasters' ? { system: { quantity: 5 } } : {}) });
    return got ? done(actor, item, [got]) : null;
  },

  // I Can Do That (A Jump Through Time, Orange Ranger, 2nd level, p.33): "After witnessing a teammate
  // using a General Perk or Grid Power, you may spend a Personal Power to gain the use of that General
  // Perk or Grid Power until the end of your next turn."
  async iCanDoThat(actor, item) {
    const options = [];
    for (const token of canvas?.tokens?.placeables ?? []) {
      const ally = token.actor;
      if (!ally || ally.id == actor.id) {
        continue;
      }

      for (const other of itemsOf(ally)) {
        if ((other.type == 'perk' && other.system?.type == 'general') || (other.type == 'power' && other.system?.type == 'grid')) {
          const src = sourceOf(other);
          if (src && !options.some(o => o.value == src)) {
            options.push({ value: src, label: `${ally.name}: ${other.name}` });
          }
        }
      }
    }

    return copyAbility(actor, item, options);
  },

  // I Can Still Do That (10th level, p.34): "You may spend a Personal Power to copy a General Perk or
  // Grid power you previously copied with the I Can Do That Role Perk in the same scene."
  async iCanStillDoThat(actor, item) {
    const copied = actor.getFlag?.('essence20', 'copiedAbilities');
    const list = copied?.scene == getSceneEpoch() ? copied.list : [];
    return copyAbility(actor, item, list);
  },

  // Inventive Application 1 and 2 (A Jump Through Time, Orange Ranger, 5th/18th level, p.34).
  async inventiveApplication1(actor, item) {
    return inventiveApplication(actor, item);
  },
  async inventiveApplication2(actor, item) {
    return inventiveApplication(actor, item);
  },

  // Construct (TF CRB, Scientist, 3rd level, p.81): "you can build any Weapon, any Armor Upgrade, and
  // any Kit. As a Standard action, spend 1 Energon Point and make a Technology Skill Test against the
  // Requisition Difficulty of the item you are building ... On a failure, your attempt is wasted but
  // you do not spend your Energon Point." Perpetual Power Source: it costs no Energon.
  async construct(actor, item, pay) {
    const what = await chooseButtons(item.name, T('E20.ConstructPrompt'), [['weapon', T('E20.GrantWeapon')], ['upgrade', T('E20.GrantArmorUpgrade')], ['kit', T('E20.GrantKit')]]);
    if (!what) {
      return null;
    }

    const filter = what == 'weapon' ? { type: 'weapon' } : what == 'upgrade' ? { type: 'upgrade', matches: e => e.system?.type == 'armor' } : { type: 'gear', matches: e => e.system?.gearType == 'kits' };
    const rows = await findItems(filter);
    const uuid = await pickOne(item.name, rows);
    const source = uuid ? await fromUuid(uuid) : null;
    if (!source) {
      return null;
    }

    const free = !!itemsOf(actor).some(i => sourceOf(i) == GRANT.perpetualPowerSource);
    const energon = Number(actor.system?.energon?.normal?.value) || 0;
    if (!free && energon < 1) {
      ui.notifications.warn(T('E20.ConstructNoEnergon'));
      return null;
    }

    if (!await pay('standard')) {
      return null;
    }

    const dif = CONFIG.E20.availabilityDifficulties?.[source.system?.availability ?? kitAvailability(source.name)] ?? 0;
    const { success } = await rollTest(actor, 'technology', dif);
    if (!success) {
      return T('E20.GrantFailed', { name: actor.name, item: item.name });
    }

    if (!free) {
      await actor.update({ 'system.energon.normal.value': energon - 1 });
    }

    const got = await grantCopy(actor, uuid, { grantedBy: item });
    return got ? done(actor, item, [got]) : null;
  },

  // Manifest Melee Weapon (TF CRB, Warrior, 1st level, p.89): "As a Free action once per combat, you can
  // create an integrated Energon Weapon ... based on a Standard Melee weapon. This weapon lasts until
  // the end of Combat, or until you are Defeated." Expanded Arsenal (7th): Limited. Instruments of
  // Destruction (16th): Restricted.
  async manifestMeleeWeapon(actor, item, pay) {
    const tiers = manifestTiers(actor);
    const rows = await findItems({ type: 'weapon', availabilities: tiers, matches: isMeleeEntry });
    const uuid = await pickOne(item.name, rows);
    if (!uuid || !await pay('free')) {
      return null;
    }

    const got = await grantCopy(actor, uuid, { grantedBy: item, integrated: true, temporary: temporary('combat'), name: `${(await fromUuid(uuid))?.name} (Energon)` });
    await markUsed(actor, 'manifestMeleeWeapon', { window: 'encounter' });
    return got ? done(actor, item, [got]) : null;
  },

  // Manifest Enhancement (TF CRB, Warrior Sentinel, 3rd level, p.89): "as a Free action once per round,
  // you can manifest a Weapon Upgrade for a Melee weapon ... as long as the Weapon Upgrade you create is
  // based on an Upgrade with an Availability equal to the Availability of a Weapon you can use Manifest
  // Melee Weapon to create. This Weapon Upgrade lasts until the end of your turn."
  async manifestEnhancement(actor, item, pay) {
    const melee = itemsOf(actor).filter(i => i.type == 'weapon'
      && itemsOf(actor).some(e => e.type == 'weaponEffect' && e.flags?.essence20?.parentId == i.id && e.system?.classification?.style == 'melee'));
    const weaponId = await chooseSelect(item.name, T('E20.WeaponUsePickWeapon'), melee.map(w => ({ value: w.id, label: w.name })));
    const weapon = actor.items.get(weaponId);
    if (!weapon) {
      return null;
    }

    const rows = await findItems({ type: 'upgrade', availabilities: manifestTiers(actor), matches: e => e.system?.type == 'weapon' });
    const uuid = await pickOne(item.name, rows);
    if (!uuid || !await pay('free')) {
      return null;
    }

    const { attachTemporaryUpgrade } = await import("./weapon-perk-uses.mjs");
    const got = await attachTemporaryUpgrade(actor, weapon, uuid, { kind: 'turn', source: item.name });
    return got ? T('E20.WeaponUseTemporaryUpgrade', { name: actor.name, perk: item.name, weapon: weapon.name, upgrade: got.name }) : null;
  },

  // Minor Tweak (Decepticon Directive, Cyber Engineer, 1st level, p.52): "With 10 minutes of tinkering on
  // a willing ally and a successful DIF 14 Technology (Engineering) Skill Test, you can grant that ally a
  // temporary Skill Rank in a single Strength or Speed Essence skill ... The benefit lasts for 1 day."
  // Major Augments (10th): "DIF 18 ... two temporary Skill Ranks that can be spent on any skills."
  // Extensive Enhancements (17th): DIF 20, four.
  async minorTweak(actor, item) {
    const ally = game.user?.targets?.first?.()?.actor ?? actor;
    const tiers = [{ dif: 14, ranks: 1, any: false }];
    if (actorHasPerk(actor, GRANT.majorAugments)) tiers.push({ dif: 18, ranks: 2, any: true });
    if (actorHasPerk(actor, GRANT.extensiveEnhancements)) tiers.push({ dif: 20, ranks: 4, any: true });
    const pick = tiers.length == 1 ? '0' : await chooseSelect(item.name, T('E20.MinorTweakPrompt'), tiers.map((t, i) => ({ value: String(i), label: T('E20.MinorTweakTier', { dif: t.dif, ranks: t.ranks }) })));
    const tier = tiers[Number(pick)];
    if (!tier) {
      return null;
    }

    if (!(await rollTest(actor, 'technology', tier.dif)).success) {
      return T('E20.GrantFailed', { name: actor.name, item: item.name });
    }

    const skills = Object.keys(CONFIG.E20.skills ?? {}).filter(skill => tier.any || ['strength', 'speed'].includes(CONFIG.E20.skillToEssence?.[skill]));
    const changes = {};
    for (let i = 0; i < tier.ranks; i++) {
      const skill = await chooseSelect(item.name, T('E20.MinorTweakPickSkill', { n: i + 1, of: tier.ranks }), skills.map(s => ({ value: s, label: T(CONFIG.E20.skills[s]) })));
      if (!skill) {
        break;
      }

      changes[skill] = (changes[skill] ?? 0) + 1;
    }

    if (!Object.keys(changes).length) {
      return null;
    }

    const existing = (ally.effects?.contents ?? []).filter(e => e.flags?.essence20?.minorTweak);
    if (existing.length) {
      await ally.deleteEmbeddedDocuments('ActiveEffect', existing.map(e => e.id));
    }

    await ally.createEmbeddedDocuments('ActiveEffect', [{
      name: item.name, img: item.img,
      changes: Object.entries(changes).map(([skill, n]) => ({ key: `system.skills.${skill}.shiftUp`, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: String(n) })),
      flags: { essence20: { minorTweak: true } },
    }]);
    return T('E20.MinorTweakDone', { name: actor.name, ally: ally.name, skills: Object.entries(changes).map(([s, n]) => `${T(CONFIG.E20.skills[s])} +${n}`).join(', ') });
  },

  // A Hint of Independence (Decepticon Directive, Drone Origin, p.33): "choose any General Perk you meet
  // the qualifications for ... Choose or roll randomly on the following table to determine what your
  // specific imperfection is." The imperfection is kept on the Perk and read where it applies.
  async hintOfIndependence(actor, item) {
    const { activateWhyDoIKnowThat } = await import("./why-do-i-know-that.mjs");
    await activateWhyDoIKnowThat(actor);
    const roll = await chooseButtons(item.name, T('E20.ImperfectionPrompt'), [['roll', T('E20.ImperfectionRoll')], ...Array.from({ length: 8 }, (_, i) => [String(i + 1), T(`E20.Imperfection.${i + 1}`)])]);
    if (!roll) {
      return true;
    }

    const n = roll == 'roll' ? (await new Roll('1d8').evaluate()).total : Number(roll);
    const extra = {};
    if ([3, 4].includes(n)) {
      extra.imperfectionType = await chooseSelect(item.name, T('E20.ImperfectionPickType'), Object.entries(CONFIG.E20.damageTypes ?? {}).map(([value, label]) => ({ value, label: T(label) })));
    }

    await item.setFlag('essence20', 'imperfection', { n, ...extra });
    return T('E20.ImperfectionSet', { name: actor.name, imperfection: T(`E20.Imperfection.${n}`) });
  },

  // Monstrous Attack (Decepticon Directive, General Perk, p.66): "You have an additional Unarmed Combat
  // attack that doubles your reach and deals 2 Blunt or Sharp damage. You can choose this General Perk
  // multiple times, gaining a new kind of Unarmed Combat attack with each instance."
  async monstrousAttack(actor, item) {
    const type = await chooseButtons(item.name, T('E20.MonstrousAttackPrompt'), [['blunt', T('E20.DamageBlunt')], ['sharp', T('E20.DamageSharp')]]);
    if (!type) {
      return null;
    }

    const [created] = await actor.createEmbeddedDocuments('Item', [{
      name: `${item.name} (${T(type == 'blunt' ? 'E20.DamageBlunt' : 'E20.DamageSharp')})`, type: 'weaponEffect',
      system: { classification: { skill: 'might', style: 'melee' }, damageType: type, damageValue: 2, numTargets: 1, numHands: '1', range: { reachMultiplier: 2 } },
      flags: { essence20: { grantedBy: item.id } },
    }]);
    return created ? done(actor, item, [created]) : null;
  },

  // Never Unarmed (Decepticon Directive, Brawler, 3rd level, p.57): "spend a Move action to turn any
  // mundane object ... within reach into a makeshift one-handed melee weapon that lasts until an attack
  // roll using it Fumbles or the end of the scene ... The weapon uses Finesse or Might and your natural
  // reach, deals 1 Blunt or Sharp damage, and has the Silent trait."
  async neverUnarmed(actor, item, pay) {
    const skill = await chooseButtons(item.name, T('E20.NeverUnarmedSkill'), [['might', T('E20.SkillMight')], ['finesse', T('E20.SkillFinesse')]]);
    const type = skill ? await chooseButtons(item.name, T('E20.MonstrousAttackPrompt'), [['blunt', T('E20.DamageBlunt')], ['sharp', T('E20.DamageSharp')]]) : null;
    if (!type || !await pay('move')) {
      return null;
    }

    const stamp = temporary('scene');
    const [weapon] = await actor.createEmbeddedDocuments('Item', [{
      name: T('E20.NeverUnarmedWeapon'), type: 'weapon',
      system: { traits: ['silent'], classification: { size: 'sidearm' }, availability: 'standard', equipped: true },
      flags: { essence20: { grantedBy: item.id, temporary: stamp, endsOnFumble: true } },
    }]);
    await actor.createEmbeddedDocuments('Item', [{
      name: T('E20.NeverUnarmedWeapon'), type: 'weaponEffect',
      system: { classification: { skill, style: 'melee' }, damageType: type, damageValue: 1, numTargets: 1, numHands: '1', range: { reachMultiplier: 1 } },
      flags: { essence20: { parentId: weapon.id, temporary: stamp } },
    }]);
    return done(actor, item, [weapon]);
  },

  // Volatile Delivery (Decepticon Directive, Elementalist, 6th level, p.53): "once per scene as a Free
  // action, you can create an element grenade that deals the type of damage chosen for your Energy
  // Affinity. The grenade becomes inert if not used before the end of the scene."
  async volatileDelivery(actor, item, pay) {
    if (!await pay('free')) {
      return null;
    }

    const affinity = findPerk(actor, 'Compendium.essence20.decepticon_directive.Item.DgFY0ZmAtClAobiA')?.system?.choice ?? 'fire';
    const got = await grantCopy(actor, 'Compendium.essence20.gi_joe_crb.Item.pcBbvGPdjOoeUnnj', {
      grantedBy: item, temporary: temporary('scene'), system: { elementChoice: affinity, quantity: 1 },
    });
    await markUsed(actor, 'volatileDelivery', { window: 'scene' });
    return got ? done(actor, item, [got]) : null;
  },

  // Augur (Enigma of Combination, alt mode feature, p.56): "Bot Mode: One of your External Hardpoints is
  // replaced by a close combat blade that exchanges the Silent trait for the Armor Piercing trait." The
  // Alt Mode half is applied to the Flyby/Ram/Bash attacks themselves (helpers/weapon-traits.mjs).
  async augur(actor, item) {
    if (itemsOf(actor).some(i => i.flags?.essence20?.grantedBy == item.id)) {
      ui.notifications.info(T('E20.AugurHasBlade'));
      return null;
    }

    const got = await grantCopy(actor, 'Compendium.essence20.tf_crb.Item.8lNIijY5XompKHH7', {
      grantedBy: item, integrated: true, name: `${item.name} Blade`,
    });
    if (got) {
      await got.update({ 'system.traits': [...(got.system.traits ?? []).filter(t => t != 'silent'), 'armorPiercing'] });
    }

    return got ? done(actor, item, [got]) : null;
  },

  // Candle / Torch (MLP CRB p.154), Headlamp (Knights of Canterlot p.20), Candlesprite Lantern (p.52),
  // Glow (p.42). Light on the carrier's token.
  async candle(actor, item) {
    return toggleLight(actor, item, { bright: 10, dim: 25 });
  },
  async torch(actor, item) {
    return toggleLight(actor, item, { bright: 25, dim: 50 });
  },
  async headlamp(actor, item) {
    return toggleLight(actor, item, { bright: 10, dim: 20, angle: 60 });
  },
  async candlespriteLantern(actor, item) {
    return toggleLight(actor, item, { bright: 10, dim: 20 });
  },
  // Glow: "you can extinguish it at will with a free action. Once extinguished, the spell must be cast
  // again." Casting it lights it (dice.mjs); this puts it out.
  async glow(actor, item) {
    const { isGlowActive, removeGlow } = await import("./glow.mjs");
    if (!isGlowActive(actor)) {
      ui.notifications.info(T('E20.GlowCastFirst'));
      return null;
    }

    await removeGlow(actor);
    return T('E20.LightOff', { name: actor.name, item: item.name });
  },

  // Riot Gear (WTNV Citizen's Guide, Secret Police, 1st level, p.37): "Once per session, you can spend
  // a Standard action in combat to summon a weapon used by the Sheriff's Secret Police ... This weapon
  // remains in your possession for the remainder of combat."
  async riotGear(actor, item, pay) {
    const ids = {
      blowGun: 'Compendium.essence20.wtnv_citizens_guide.Item.pSsHrG2Bpd3mQnBD',
      pistol: 'Compendium.essence20.wtnv_citizens_guide.Item.5LaTMHTRv4kT9eJD',
      shotgun: 'Compendium.essence20.wtnv_citizens_guide.Item.8AEIEs18V1gbcRDs',
      star: 'Compendium.essence20.wtnv_citizens_guide.Item.JqxNIRYvDcOVmkhw',
    };
    const pick = await chooseButtons(item.name, T('E20.RiotGearPrompt'), [['blowGun', 'Blow Gun (5 darts)'], ['pistol', 'Pistol'], ['shotgun', 'Shotgun'], ['star', 'Throwing Stars (5)']]);
    if (!pick || !await pay('standard')) {
      return null;
    }

    const got = await grantCopy(actor, ids[pick], { grantedBy: item, temporary: temporary('combat'), ...(['blowGun', 'star'].includes(pick) ? { system: { quantity: 5 } } : {}) });
    await markUsed(actor, 'riotGear', { window: 'scene' });
    return got ? done(actor, item, [got]) : null;
  },
};

/* -------------------------------------------- */
/*  Shared pieces                                */
/* -------------------------------------------- */

async function forageFor(actor, item, type, matches, flags = {}) {
  const forage = findPerk(actor, GRANT.forage);
  const lvl = level(actor);
  // Forage opens Limited at 7th and Restricted at 13th (GI Joe CRB, Table 5-17).
  const tiers = ['standard', ...(lvl >= 7 ? ['limited'] : []), ...(lvl >= 13 ? ['restricted'] : [])];
  if (!forage && type == 'gear') {
    return null;
  }

  const rows = await findItems({ type, availabilities: tiers, matches });
  const uuid = await pickOne(item.name, rows);
  const source = uuid ? await fromUuid(uuid) : null;
  if (!source) {
    return null;
  }

  const dif = CONFIG.E20.availabilityDifficulties?.[source.system?.availability ?? kitAvailability(source.name)] ?? 0;
  // Forage Familiarity (Ferocious Fighters, General Perk, p.14): "You gain an Edge on Skill Tests made
  // when using Forage."
  const familiar = itemsOf(actor).some(i => (i.flags?.core?.sourceId ?? i._stats?.compendiumSource) == GRANT.forageFamiliarity);
  if (!(await rollTest(actor, 'survival', dif, familiar ? { edge: true } : {})).success) {
    return T('E20.GrantFailed', { name: actor.name, item: item.name });
  }

  // "until you spend it or until you forage for another".
  const previous = itemsOf(actor).filter(i => i.flags?.essence20?.foraged && i.type == type);
  if (previous.length) {
    await actor.deleteEmbeddedDocuments('Item', previous.map(i => i.id));
  }

  const got = await grantCopy(actor, uuid, { grantedBy: item, flags: { foraged: true, ...flags } });
  return got ? done(actor, item, [got]) : null;
}

async function techGrant(actor, item, secondary) {
  const primary = findPerk(actor, GRANT.primaryTech)?.flags?.essence20?.techChoice;
  const choices = [['armor', T('E20.TechArmor')], ['drone', T('E20.TechDrone')], ['gear', T('E20.TechGear')], ['weapon', T('E20.TechWeapon')]]
    .filter(([key]) => !secondary || key != primary);
  if (secondary && primary) {
    choices.push(['enhance', T('E20.TechEnhance')]);
  }

  const choice = await chooseButtons(item.name, T('E20.TechPrompt'), choices);
  if (!choice) {
    return null;
  }

  await item.setFlag('essence20', 'techChoice', choice);
  const enhanced = choice == 'enhance';
  const kind = enhanced ? primary : choice;
  const SLR = ['standard', 'limited', 'restricted'];
  const got = [];
  switch (kind) {
  // Armor: "trained in heavy armor, gain a suit of Standard or Limited light, medium, or heavy armor as
  // personal gear, and can choose a Standard armor upgrade ... one Standard Sidearm weapon as an
  // integrated weapon". Enhanced: "trained in super heavy armor, and gain a suit of Standard, Limited,
  // or Restricted ... armor ... two Standard, Limited, or Restricted armor upgrades ... one Standard or
  // Limited Sidearm weapon as an Integrated weapon".
  case 'armor':
    await actor.update({ [`system.trained.armors.${enhanced ? 'ultraHeavy' : 'heavy'}`]: true });
    got.push(await pickAndGrant(actor, item, item.name, { type: 'armor', availabilities: enhanced ? SLR : SLR.slice(0, 2), matches: e => enhanced || ['light', 'medium', 'heavy'].includes(e.system?.classification) }));
    for (let i = 0; i < (enhanced ? 2 : 1); i++) {
      got.push(await pickAndGrant(actor, item, item.name, { type: 'upgrade', availabilities: enhanced ? SLR : ['standard'], matches: e => e.system?.type == 'armor' }));
    }

    got.push(await pickAndGrant(actor, item, item.name, { type: 'weapon', availabilities: enhanced ? SLR.slice(0, 2) : ['standard'], matches: e => e.system?.classification?.size == 'sidearm' }, { integrated: true }));
    break;
    // Drone: "You gain a Limited drone pet. You can choose a Standard upgrade". Enhanced: "a Restricted
    // drone as a pet ... two Standard or Limited upgrades".
  case 'drone': {
    const drone = await Actor.create({
      name: T('E20.TechDroneName', { name: actor.name }), type: 'companion',
      system: { type: 'drone', availability: enhanced ? 'restricted' : 'limited' },
      ownership: foundry.utils.deepClone(actor.ownership ?? {}),
    });
    got.push(drone);
    for (let i = 0; i < (enhanced ? 2 : 1); i++) {
      got.push(await pickAndGrant(drone ?? actor, item, item.name, { type: 'upgrade', availabilities: enhanced ? SLR.slice(0, 2) : ['standard'], matches: e => e.system?.type == 'drone' }));
    }

    break;
  }

  // Gear: "an integrated HTB Access Pad as personal gear, as well as a Standard or Limited kit. You can
  // choose a Standard or Limited upgrade of any type". Enhanced: "a Restricted kit ... two Standard,
  // Limited, or Restricted upgrades of any type".
  case 'gear':
    if (!enhanced) {
      got.push(await grantCopy(actor, 'Compendium.essence20.gi_joe_crb.Item.KiDQM6Sgsm1jsjcS', { grantedBy: item, integrated: true }));
    }

    got.push(await pickAndGrant(actor, item, item.name, { type: 'gear', availabilities: enhanced ? ['restricted'] : SLR.slice(0, 2), matches: e => e.system?.gearType == 'kits' }));
    for (let i = 0; i < (enhanced ? 2 : 1); i++) {
      got.push(await pickAndGrant(actor, item, item.name, { type: 'upgrade', availabilities: enhanced ? SLR : SLR.slice(0, 2) }));
    }

    break;
    // Weapon: "You are Qualified in a limited weapon of your choice, and can choose a Standard weapon
    // upgrade". Enhanced: "Qualified in a Restricted weapon of your choice, gain that weapon as personal
    // gear, and can choose a Standard, Limited, or Restricted weapon upgrade".
  case 'weapon':
    got.push(await pickAndGrant(actor, item, item.name, { type: 'weapon', availabilities: enhanced ? ['restricted'] : ['limited'] }, { flags: { qualified: true } }));
    got.push(await pickAndGrant(actor, item, item.name, { type: 'upgrade', availabilities: enhanced ? SLR : ['standard'], matches: e => e.system?.type == 'weapon' }));
    break;
  default:
    break;
  }

  return done(actor, item, got);
}

async function kitbash(actor, item, pay, cost, time, critTime) {
  const which = await chooseButtons(item.name, T('E20.GrantQuickbashPrompt'), [['weapon', T('E20.GrantWeapon')], ['gear', T('E20.GrantGear')]]);
  if (!which) {
    return null;
  }

  const rows = await findItems({ type: which, matches: e => which != 'weapon' || effectsOfEntry(e).every(x => Number(x.numHands ?? 1) <= 2) });
  const uuid = await pickOne(item.name, rows);
  const source = uuid ? await fromUuid(uuid) : null;
  if (!source || !await pay(cost)) {
    return null;
  }

  const dif = CONFIG.E20.availabilityDifficulties?.[source.system?.availability ?? kitAvailability(source.name)] ?? 0;
  const { success, crit } = await rollTest(actor, 'technology', dif);
  if (!success) {
    return T('E20.GrantFailed', { name: actor.name, item: item.name });
  }

  const got = await grantCopy(actor, uuid, { grantedBy: item, temporary: temporary(crit ? critTime.kind : time.kind, crit ? critTime : time) });
  return got ? done(actor, item, [got]) : null;
}

async function kitbashUpgrade(actor, item, pay) {
  const weapons = itemsOf(actor).filter(i => i.type == 'weapon');
  const weaponId = await chooseSelect(item.name, T('E20.WeaponUsePickWeapon'), weapons.map(w => ({ value: w.id, label: w.name })));
  const weapon = actor.items.get(weaponId);
  const rows = weapon ? await findItems({ type: 'upgrade', matches: e => e.system?.type == 'weapon' }) : [];
  const uuid = weapon ? await pickOne(item.name, rows) : null;
  const source = uuid ? await fromUuid(uuid) : null;
  if (!source || !await pay('free')) {
    return null;
  }

  const { success, crit } = await rollTest(actor, 'technology', CONFIG.E20.availabilityDifficulties?.[source.system?.availability] ?? 0);
  if (!success) {
    return T('E20.GrantFailed', { name: actor.name, item: item.name });
  }

  const { attachTemporaryUpgrade } = await import("./weapon-perk-uses.mjs");
  await attachTemporaryUpgrade(actor, weapon, uuid, { kind: crit ? 'nextTurn' : 'turn', source: item.name });
  return T('E20.WeaponUseTemporaryUpgrade', { name: actor.name, perk: item.name, weapon: weapon.name, upgrade: source.name });
}

async function crossTraining(actor, item) {
  const role = ownRole(actor);
  const own = ownRolePerkNames(actor);
  const line = lineOf(sourceOf(item));
  const got = await pickRolePerk(actor, item, {
    containers: index => index.filter(e => e.type == 'role' && e.name != role?.name && lineOf(e.uuid) == line),
    allow: entry => entry.level > 1 && entry.level <= Math.floor(level(actor) / 2) && !own.has(entry.name?.toLowerCase()),
  });
  return got ? done(actor, item, [got]) : null;
}

async function originBenefit(actor, item, line, originOk, perkOk = () => true) {
  const origins = await findCompendiumItems({ type: 'origin', fields: ['system.items'] });
  const ownOrigin = itemsOf(actor).find(i => i.type == 'origin');
  const options = [];
  for (const row of origins) {
    if (lineOf(row.uuid) != line || row.name == ownOrigin?.name || !originOk(row)) {
      continue;
    }

    const origin = await fromUuid(row.uuid);
    for (const entry of Object.values(origin?.system?.items ?? {})) {
      if (entry?.type != 'perk') {
        continue;
      }

      const perk = await fromUuid(entry.uuid);
      if (perk && perkOk(perk)) {
        options.push({ value: entry.uuid, label: `${origin.name}: ${entry.name}` });
      }
    }
  }

  const uuid = await chooseSelect(item.name, T('E20.GrantPickOriginBenefit'), options.sort((a, b) => a.label.localeCompare(b.label)));
  if (!uuid) {
    return null;
  }

  const { grantPerkOutright } = await import("../sheet-handlers/perk-handler.mjs");
  await grantPerkOutright(actor, uuid);
  return true;
}

async function droneWeapon(actor, item, availabilities, replace = false) {
  if (replace) {
    const old = itemsOf(actor).filter(i => i.type == 'weapon' && i.flags?.essence20?.droneWeapon);
    if (old.length) {
      await actor.deleteEmbeddedDocuments('Item', [...old.map(i => i.id), ...itemsOf(actor).filter(e => old.some(w => e.flags?.essence20?.parentId == w.id)).map(e => e.id)]);
    }
  }

  const got = await pickAndGrant(actor, item, item.name, { type: 'weapon', availabilities }, { integrated: true, flags: { droneWeapon: true } });
  return got ? done(actor, item, [got]) : null;
}

async function skinUpgrade(actor, item, availability) {
  const got = await pickAndGrant(actor, item, item.name, { type: 'upgrade', availabilities: [availability], matches: e => e.system?.type == 'armor' }, { flags: { alterationWorn: true } });
  return got ? done(actor, item, [got]) : null;
}

async function integratedWeapon(actor, item, filter) {
  const got = await pickAndGrant(actor, item, item.name, filter, { integrated: true });
  return got ? done(actor, item, [got]) : null;
}

/**
 * Pick owned weapons to count as Adept Armaments (Cobra Codex, Trooper). Returns how many are now
 * designated, or null when cancelled.
 */
async function designateAdept(actor, item, count) {
  const weapons = itemsOf(actor).filter(i => i.type == 'weapon' && !i.flags?.essence20?.adeptArmament);
  if (!weapons.length) {
    ui.notifications.warn(T('E20.AdeptNoWeapons'));
    return null;
  }

  const boxes = weapons.map(w => `<label class="checkbox"><input type="checkbox" name="w-${w.id}" /> ${foundry.utils.escapeHTML(w.name)}</label>`).join('<br>');
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: `<p>${T('E20.AdeptPrompt', { count })}</p>${boxes}`,
    buttons: [{
      action: 'ok', label: T('E20.DialogConfirmButton'), default: true,
      callback: (event, button) => weapons.filter(w => button.form.elements[`w-${w.id}`]?.checked).map(w => w.id),
    }],
    rejectClose: false,
  });
  if (!Array.isArray(picked)) {
    return null;
  }

  const chosen = picked.slice(0, count);
  if (chosen.length) {
    await actor.updateEmbeddedDocuments('Item', chosen.map(id => ({ _id: id, 'flags.essence20.adeptArmament': true })));
  }

  return itemsOf(actor).filter(i => i.flags?.essence20?.adeptArmament).length;
}

/** Whether a weapon counts as an Adept Armament. */
export function isAdeptArmament(weapon) {
  return !!weapon?.flags?.essence20?.adeptArmament;
}

async function pickFaction(title, exclude = []) {
  const rows = (await findCompendiumItems({ type: 'faction' })).filter(r => !exclude.includes(r.uuid));
  const uuid = await pickOne(title, rows);
  return uuid ? rows.find(r => r.uuid == uuid) : null;
}

async function grantFactionPerks(actor, faction, grantor, stamp) {
  const source = await fromUuid(faction.uuid ?? sourceOf(faction));
  const perks = Object.values((source ?? faction)?.system?.items ?? {}).filter(e => e?.type == 'perk');
  const got = [];
  for (const entry of perks) {
    if (itemsOf(actor).some(i => sourceOf(i) == entry.uuid)) {
      continue;
    }

    got.push(await grantCopy(actor, entry.uuid, { grantedBy: grantor, temporary: stamp }));
  }

  return got.filter(Boolean);
}

async function swapFactionPerk(actor, item) {
  const faction = itemsOf(actor).find(i => i.type == 'faction');
  const own = itemsOf(actor).filter(i => i.type == 'perk' && Object.values(faction?.system?.items ?? {}).some(e => e?.uuid == sourceOf(i)));
  const dropId = await chooseSelect(item.name, T('E20.MultifacetedDrop'), own.map(p => ({ value: p.id, label: p.name })));
  const dropped = actor.items.get(dropId);
  const other = dropped ? await pickFaction(item.name, [sourceOf(faction)]) : null;
  if (!other) {
    return null;
  }

  const source = await fromUuid(other.uuid);
  const options = Object.values(source?.system?.items ?? {}).filter(e => e?.type == 'perk').map(e => ({ value: e.uuid, label: e.name }));
  const gain = await chooseSelect(item.name, T('E20.MultifacetedGain'), options);
  if (!gain) {
    return null;
  }

  // The set-aside benefit's effects are switched off until the next Requisition swap.
  await dropped.updateEmbeddedDocuments?.('ActiveEffect', (dropped.effects?.contents ?? []).map(e => ({ _id: e.id, disabled: true })));
  await dropped.setFlag('essence20', 'setAside', true);
  const previous = itemsOf(actor).filter(i => i.flags?.essence20?.multifacetedSwap);
  if (previous.length) {
    await actor.deleteEmbeddedDocuments('Item', previous.map(i => i.id));
  }

  const got = await grantCopy(actor, gain, { grantedBy: item, flags: { multifacetedSwap: true } });
  return T('E20.MultifacetedDone', { name: actor.name, dropped: dropped.name, gained: got?.name ?? '' });
}

async function copyAbility(actor, item, options) {
  const power = Number(actor.system?.powers?.personal?.value) || 0;
  if (power < 1) {
    ui.notifications.warn(T('E20.ActionPerkNoPower', { name: actor.name }));
    return null;
  }

  const uuid = await chooseSelect(item.name, T('E20.ICanDoThatPrompt'), options);
  if (!uuid) {
    return null;
  }

  await actor.update({ 'system.powers.personal.value': power - 1 });
  const got = await grantCopy(actor, uuid, { grantedBy: item, temporary: temporary('nextTurn') });
  const copied = actor.getFlag?.('essence20', 'copiedAbilities');
  const list = copied?.scene == getSceneEpoch() ? copied.list : [];
  const label = options.find(o => o.value == uuid)?.label ?? got?.name ?? '';
  if (!list.some(o => o.value == uuid)) {
    await actor.setFlag('essence20', 'copiedAbilities', { scene: getSceneEpoch(), list: [...list, { value: uuid, label }] });
  }

  return got ? done(actor, item, [got]) : null;
}

async function inventiveApplication(actor, item) {
  const choice = await chooseButtons(item.name, T('E20.InventivePrompt'), [
    ['sidearm', T('E20.InventiveSidearm')], ['powerWeapon', T('E20.InventivePowerWeapon')], ['armor', T('E20.InventiveArmor')], ['upgrade', T('E20.InventiveUpgrade')],
  ]);
  if (!choice) {
    return null;
  }

  const weaponsByTrait = trait => itemsOf(actor).filter(i => i.type == 'weapon' && (trait ? (i.system?.traits ?? []).includes(trait) : true));
  const baseDamage = e => Math.max(0, ...effectsOfEntry(e).map(x => Number(x.damageValue) || 0));
  if (choice == 'sidearm' || choice == 'powerWeapon') {
    // "Replace your Energy-based Sidearm with any other Sidearm that inflicts a base of 2 damage or
    // less" / "Replace your Versatile Power Weapon with any Power Weapon that inflicts a base of 2
    // damage or less."
    const got = await pickAndGrant(actor, item, item.name, {
      type: 'weapon',
      matches: e => baseDamage(e) <= 2 && (choice == 'sidearm' ? e.system?.classification?.size == 'sidearm' : (e.system?.traits ?? []).includes('powerWeapon')),
    });
    if (!got) {
      return null;
    }

    const old = choice == 'sidearm'
      ? weaponsByTrait(null).find(w => w.id != got.id && w.system?.classification?.size == 'sidearm' && !w.flags?.essence20?.grantedBy)
      : weaponsByTrait('powerWeapon').find(w => w.id != got.id && !w.flags?.essence20?.grantedBy);
    if (old) {
      await actor.deleteEmbeddedDocuments('Item', [old.id, ...itemsOf(actor).filter(e => e.flags?.essence20?.parentId == old.id).map(e => e.id)]);
    }

    return done(actor, item, [got]);
  }

  if (choice == 'armor') {
    // "Increase the Armor provided from Light to Medium, or Medium to Heavy."
    const trained = actor.system?.trained?.armors ?? {};
    const next = trained.medium ? 'heavy' : 'medium';
    await actor.update({ [`system.trained.armors.${next}`]: true });
    const { setMorphedToughnessBonus } = await import("../sheet-handlers/perk-handler.mjs");
    await setMorphedToughnessBonus(actor);
    return T('E20.InventiveArmorDone', { name: actor.name, armor: T(CONFIG.E20.armorTypes?.[next] ?? next) });
  }

  // "Choose one free Upgrade to apply to your Sidearm or Power Weapon."
  const got = await pickAndGrant(actor, item, item.name, { type: 'upgrade', matches: e => e.system?.type == 'weapon' });
  return got ? done(actor, item, [got]) : null;
}

function manifestTiers(actor) {
  const has = id => itemsOf(actor).some(i => sourceOf(i) == id);
  return ['standard', ...(has(GRANT.expandedArsenal) || has(GRANT.instrumentsOfDestruction) ? ['limited'] : []), ...(has(GRANT.instrumentsOfDestruction) ? ['restricted'] : [])];
}

async function toggleLight(actor, item, light) {
  const token = actor.getActiveTokens?.()?.[0]?.document;
  const on = !item.flags?.essence20?.lit;
  if (token) {
    if (on) {
      await item.setFlag('essence20', 'previousLight', token.light?.toObject?.() ?? { bright: token.light?.bright ?? 0, dim: token.light?.dim ?? 0, angle: token.light?.angle ?? 360 });
      await token.update({ 'light.bright': light.bright, 'light.dim': light.dim, 'light.angle': light.angle ?? 360 });
    } else {
      const previous = item.flags?.essence20?.previousLight ?? { bright: 0, dim: 0, angle: 360 };
      await token.update({ 'light.bright': previous.bright ?? 0, 'light.dim': previous.dim ?? 0, 'light.angle': previous.angle ?? 360 });
    }
  }

  await item.setFlag('essence20', 'lit', on);
  return T(on ? 'E20.LightOn' : 'E20.LightOff', { name: actor.name, item: item.name });
}

/* -------------------------------------------- */
/*  Read elsewhere                               */
/* -------------------------------------------- */

/**
 * Where a Role's Essence increase goes: Cordial sends the chosen Essence's increases to Social,
 * Rough and Takes No Guff an Officer's Speed increases to Strength. Called by
 * sheet-handlers/role-handler.mjs#setRoleValues for each Essence it raises.
 * @param {Actor} actor
 * @param {Item} role
 * @param {String} essence
 * @returns {String}
 */
export function essenceRedirect(actor, role, essence) {
  const cordial = itemsOf(actor).find(i => sourceOf(i) == GRANT.cordial);
  if (cordial?.flags?.essence20?.redirectFrom == essence) {
    return 'social';
  }

  const rough = itemsOf(actor).find(i => sourceOf(i) == GRANT.roughAndTakesNoGuff);
  if (rough?.flags?.essence20?.redirectFrom == essence && essence == 'speed' && /officer/i.test(role?.name ?? '')) {
    return 'strength';
  }

  return essence;
}

/**
 * Thick Skulls: how much of the Smarts-driven Willpower moves to Toughness.
 */
export function thickSkullsShift(actor) {
  return itemsOf(actor).find(i => sourceOf(i) == GRANT.thickSkulls)?.flags?.essence20?.toToughness ?? 0;
}

/**
 * A Hint of Independence's imperfection, if the actor has one: {n, imperfectionType}.
 */
export function imperfectionOf(actor) {
  return itemsOf(actor).find(i => sourceOf(i) == GRANT.hintOfIndependence)?.flags?.essence20?.imperfection ?? null;
}

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
