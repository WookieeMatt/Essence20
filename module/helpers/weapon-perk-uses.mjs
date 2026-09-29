import { getSceneEpoch } from "./scene-clock.mjs";
import { ELEMENTS } from "./weapon-upgrades.mjs";

/**
 * The Perks and Upgrades that change a weapon for a while, from a Use button.
 *
 * Two kinds of change, both undone on their own:
 *
 * - A MUTATION, kept on the weapon's own flags (flags.essence20.mutation) and read by
 *   helpers/weapon-upgrades.mjs#applyToEffect: Explosive Ammo's blast, Utility Loaders' damage type,
 *   Backblast's halved range. "This effect lasts until you roll a Fumble with the weapon" -
 *   documents/item.mjs clears it on a Fumble; the one-shot parts (Firestorm, Airburst) clear after
 *   the next attack with the weapon.
 * - A TEMPORARY UPGRADE (or, for Knuckle Up, a temporary unarmed effect): a real Item, created on
 *   the actor and attached, stamped with when it goes away (flags.essence20.temporary).
 *   sweepTemporary() removes it; it runs at every turn start (documents/combat.mjs).
 *
 * Every entry here is reached through helpers/action-perks.mjs's Use-button table (custom:
 * 'weaponUse'), which has already checked the button may show.
 */

const ID = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const WEAPON_USE_IDS = {
  explosiveAmmo: ID('decepticon_directive', 'UkpZPsRt0YoBHcQl'),
  firestorm: ID('decepticon_directive', '6AoPBHXLoPhbAR8M'),
  tooledMunitions: ID('decepticon_directive', 'g3hbfgEElXvJP6x9'),
  utilityLoaders: ID('decepticon_directive', 'mbY2W9jiPWsDvyMt'),
  backblast: ID('decepticon_directive', 'mDG1CXQA04xKfONn'),
  airburst: ID('decepticon_directive', 'OoZKK4FARbTreck7'),
  kitbashUpgrade: ID('gi_joe_crb', '7JNvIGhT0awimmtY'),
  armamentUpgrade: ID('intercontinental_adventures', 'rmQqGaQ3sqPwEQZy'),
  trapsAndObstacles: ID('enigma_of_combination', 'mNVPUeKWqlQo3QIB'),
  gridConnection: ID('field_guide_action_adventure', 'UDs3dGehEYL5dgbr'),
  beatdown: ID('cobra_codex', '38zFS75lhzBWiurT'),
  jackhammer: ID('cobra_codex', 'sBoZ2KrzmKlWIlYu'),
  knuckleUp: ID('sgt_slaughter_sourcebook', 'MViU1s9KdZ1A51Qe'),
  hammerItOut: ID('sgt_slaughter_sourcebook', 'umLteVFW35otffjg'),
  hud: ID('cobra_codex', 'cx6cVaHALQlwBrnD'),
  motorLancer: ID('intercontinental_adventures', 'YaFY9NhcpZPXdvv0'),
  weaponCustomizer: ID('intercontinental_adventures', 'UWEU7hfmtRxlkWJB'),
};
const U = WEAPON_USE_IDS;
const PROXIMITY_BOMB = 'Compendium.essence20.tf_crb.Item.I2nS9xXN8ioV5jJ5';

const MUTATION_FLAG = 'mutation';
const TEMPORARY_FLAG = 'temporary';
const HUD_FLAG = 'hudSkill';
const GRID_SHELL_FLAG = 'gridShell';
const AVAILABILITY_ORDER = ['standard', 'limited', 'restricted', 'prototype'];

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
}

function has(actor, uuid) {
  return !!actor?.items?.find?.(item => sourceOf(item) == uuid);
}

function turnStamp() {
  const combat = game.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : { combatId: null, round: 0, turn: 0 };
}

function isStampCurrent(stamp) {
  const combat = game?.combat;
  return !!stamp && !!combat && stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn;
}

/* -------------------------------------------- */
/*  Pickers                                     */
/* -------------------------------------------- */

async function pick(title, prompt, options, extraHtml = '') {
  if (!options.length) {
    return null;
  }

  const choices = options.map(o => `<option value="${o.value}">${foundry.utils.escapeHTML(o.label)}</option>`).join('');
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    position: { width: 440 },
    content: `<p>${prompt}</p><div class="form-group"><select name="choice">${choices}</select></div>${extraHtml}`,
    buttons: [
      {
        action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true,
        callback: (event, button) => ({ choice: button.form.elements.choice.value, extra: button.form.elements.extra?.value ?? null }),
      },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  return result && result != 'cancel' ? result : null;
}

function weaponOptions(actor, filter = () => true) {
  return actor.items.filter(item => item.type == 'weapon' && filter(item)).map(item => ({ value: item.id, label: item.name }));
}

function isRanged(actor, weapon) {
  return actor.items.some(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id
    && item.system.classification?.style != 'melee');
}

function hasBlast(actor, weapon) {
  return actor.items.some(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id
    && item.system.radius > 0);
}

/**
 * Compendium weapon upgrades up to an availability, deduplicated by name.
 * @param {String[]} availabilities
 * @returns {Promise<Array<{value, label}>>}
 */
export async function weaponUpgradeOptions(availabilities) {
  const options = new Map();
  for (const pack of game.packs.filter(p => p.documentName == 'Item' && p.metadata.system == 'essence20')) {
    const index = await pack.getIndex({ fields: ['type', 'system.type', 'system.availability'] });
    for (const entry of index) {
      if (entry.type == 'upgrade' && entry.system?.type == 'weapon' && availabilities.includes(entry.system?.availability)
        && !options.has(entry.name)) {
        options.set(entry.name, { value: entry.uuid, label: `${entry.name} (${game.i18n.localize(CONFIG.E20.availabilities[entry.system.availability])})`, availability: entry.system.availability });
      }
    }
  }

  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
}

async function meleeWeaponOptions(availabilities) {
  const options = new Map();
  for (const pack of game.packs.filter(p => p.documentName == 'Item' && p.metadata.system == 'essence20')) {
    const index = await pack.getIndex({ fields: ['type', 'system.availability', 'system.items'] });
    for (const entry of index) {
      if (entry.type != 'weapon' || !availabilities.includes(entry.system?.availability) || options.has(entry.name)) {
        continue;
      }

      const effects = Object.values(entry.system?.items ?? {}).filter(e => e?.type == 'weaponEffect');
      if (effects.some(e => e.classification?.style == 'melee')) {
        options.set(entry.name, { value: entry.uuid, label: entry.name, availability: entry.system.availability });
      }
    }
  }

  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/* -------------------------------------------- */
/*  Temporary upgrades and effects              */
/* -------------------------------------------- */

/**
 * Attach a copy of a compendium upgrade to a weapon for a while.
 * @param {Actor} actor
 * @param {Item} weapon
 * @param {String} upgradeUuid
 * @param {Object} temporary   {kind: 'turn'|'nextTurn'|'rounds'|'scene'|'untilUsed', rounds, source}
 * @returns {Promise<Item|null>}
 */
export async function attachTemporaryUpgrade(actor, weapon, upgradeUuid, temporary) {
  const source = await fromUuid(upgradeUuid);
  if (!source) {
    return null;
  }

  const data = source.toObject();
  delete data._id;
  foundry.utils.setProperty(data, 'flags.core.sourceId', upgradeUuid);
  foundry.utils.setProperty(data, 'flags.essence20.parentId', weapon.id);
  foundry.utils.setProperty(data, `flags.essence20.${TEMPORARY_FLAG}`, { ...temporary, ...turnStamp(), scene: getSceneEpoch() });
  const [created] = await actor.createEmbeddedDocuments('Item', [data]);
  const { setEntryAndAddItem } = await import("../sheet-handlers/attachment-handler.mjs");
  const key = await setEntryAndAddItem(created, weapon);
  if (key) {
    await created.setFlag('essence20', 'collectionId', key);
  }

  return created;
}

/**
 * Whether a temporary Item's time is up.
 * @param {Object} temp   Its flags.essence20.temporary.
 * @returns {Boolean}
 */
export function isExpired(temp) {
  if (!temp) {
    return false;
  }

  const combat = game?.combat;
  if (temp.kind == 'scene') {
    return temp.scene != getSceneEpoch();
  }

  if (temp.kind == 'untilUsed') {
    return false;
  }

  if (!combat || combat.id != temp.combatId) {
    // The combat it was counted against is over.
    return !!temp.combatId || temp.kind != 'rounds';
  }

  if (temp.kind == 'turn') {
    return combat.round != temp.round || combat.turn != temp.turn;
  }

  if (temp.kind == 'nextTurn') {
    return combat.round > temp.round + 1 || (combat.round == temp.round + 1 && combat.turn > temp.turn);
  }

  if (temp.kind == 'rounds') {
    return combat.round >= temp.round + (temp.rounds ?? 10);
  }

  return false;
}

/**
 * Remove every expired temporary upgrade and effect from an actor, and any mutation or Grid
 * shell whose time is up.
 * @param {Actor} actor
 * @returns {Promise<Number>}   How many Items were removed.
 */
export async function sweepTemporary(actor) {
  if (!actor?.items) {
    return 0;
  }

  const expired = actor.items.filter(item => isExpired(item.flags?.essence20?.[TEMPORARY_FLAG]));
  if (expired.length) {
    await removeTemporaryItems(actor, expired);
  }

  const shell = actor.getFlag?.('essence20', GRID_SHELL_FLAG);
  if (shell && shell.scene != getSceneEpoch()) {
    await actor.unsetFlag('essence20', GRID_SHELL_FLAG);
  }

  return expired.length;
}

async function removeTemporaryItems(actor, items) {
  for (const item of items) {
    const weapon = actor.items.get(item.flags?.essence20?.parentId);
    const key = item.flags?.essence20?.collectionId;
    if (weapon && key && weapon.system.items?.[key]) {
      await weapon.update({ [`system.items.-=${key}`]: null });
    }
  }

  await actor.deleteEmbeddedDocuments('Item', items.map(item => item.id));
}

/**
 * A temporary "until used" upgrade is spent by the next attack with its weapon (Traps and
 * Obstacles' one-use trap). Called by documents/item.mjs after an attack.
 */
export async function spendUntilUsed(actor, weapon) {
  const used = actor?.items?.filter(item => item.flags?.essence20?.parentId == weapon?.id
    && item.flags?.essence20?.[TEMPORARY_FLAG]?.kind == 'untilUsed') ?? [];
  if (used.length) {
    await removeTemporaryItems(actor, used);
  }
}

/* -------------------------------------------- */
/*  Mutations                                   */
/* -------------------------------------------- */

export function getMutation(weapon) {
  return weapon?.flags?.essence20?.[MUTATION_FLAG] ?? null;
}

async function mutate(weapon, changes) {
  const current = getMutation(weapon) ?? {};
  await weapon.setFlag('essence20', MUTATION_FLAG, { ...current, ...changes });
}

/**
 * After an attack with a mutated weapon: the one-shot parts are spent, and a Fumble ends the rest -
 * "This effect lasts until you roll a Fumble with the weapon, at which point the altered
 * ammunition runs out."
 * @param {Item} weapon
 * @param {Boolean} fumbled
 */
export async function afterMutatedAttack(weapon, fumbled) {
  const mutation = getMutation(weapon);
  if (!mutation) {
    return;
  }

  if (fumbled) {
    await weapon.unsetFlag('essence20', MUTATION_FLAG);
    return;
  }

  if (mutation.tripleNext || mutation.airburstNext) {
    await weapon.setFlag('essence20', MUTATION_FLAG, { ...mutation, tripleNext: false, airburstNext: false });
  }
}

/* -------------------------------------------- */
/*  HUD and Motor Lancer                        */
/* -------------------------------------------- */

/**
 * HUD (Cobra Codex, armor upgrade, p.101): "Choose a skill. As a Move action once per turn during
 * combat, you can give yourself ↑1 to that skill until the end of your turn."
 * @returns {?String}   The skill, while it lasts.
 */
export function getHudSkill(actor) {
  const hud = actor?.getFlag?.('essence20', HUD_FLAG);
  return hud && isStampCurrent(hud) ? hud.skill : null;
}

export function isGridShellActive(actor) {
  const shell = actor?.getFlag?.('essence20', GRID_SHELL_FLAG);
  return !!shell && shell.scene == getSceneEpoch();
}

/* -------------------------------------------- */
/*  The Use buttons                             */
/* -------------------------------------------- */

async function spendEnergon(actor, amount = 1) {
  const value = actor.system?.energon?.normal?.value ?? 0;
  if (value < amount) {
    ui.notifications.warn(game.i18n.format('E20.WeaponUseNoEnergon', { name: actor.name }));
    return false;
  }

  await actor.update({ 'system.energon.normal.value': value - amount });
  return true;
}

async function rollTechnology(actor, dif) {
  const result = await actor._dice.rollSkill({ skill: 'technology', essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: String(dif) }, actor);
  return !!result?.success;
}

/**
 * Run one of these Use buttons. Returns the chat line, or null when nothing happened.
 * @param {String} id      A key of WEAPON_USE_IDS.
 * @param {Actor} actor
 * @param {Item} item      The Perk or Upgrade used.
 * @param {Object} economy {spend} from helpers/action-economy.mjs.
 * @returns {Promise<?String>}
 */
export async function runWeaponUse(id, actor, item, economy) {
  const i18n = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  const pay = async (type, times = 1) => {
    for (let i = 0; i < times; i++) {
      const paid = await economy.spend(actor, type, { source: item.name });
      if (paid.blocked) {
        return false;
      }
    }

    return true;
  };

  switch (id) {
  case 'explosiveAmmo': {
    // Explosive Ammo (Decepticon Directive, Thunderblast, 1st level, p.45): "As a Free action, you can
    // spend an Energon Point to add an area of effect of a 10-foot-radius blast to a single ranged
    // weapon or increase the existing radius of a weapon that deals damage in a blast by 5 feet."
    // Tooled Munitions (6th level): "you can also change the type of damage the weapon does to any
    // kind of Element damage."
    const tooled = has(actor, U.tooledMunitions);
    const extra = tooled
      ? `<div class="form-group"><label>${i18n('E20.WeaponUseElement')}</label><select name="extra"><option value="">—</option>${Object.keys(ELEMENTS).map(k => `<option value="${k}">${i18n(CONFIG.E20.damageTypes[k])}</option>`).join('')}</select></div>`
      : '';
    const picked = await pick(item.name, i18n('E20.WeaponUsePickWeapon'), weaponOptions(actor, w => isRanged(actor, w)), extra);
    if (!picked || !await pay('free') || !await spendEnergon(actor)) {
      return null;
    }

    const weapon = actor.items.get(picked.choice);
    await mutate(weapon, { explosiveAmmo: true, blastAdd: hasBlast(actor, weapon) ? 5 : 0, blastSet: hasBlast(actor, weapon) ? 0 : 10, damageType: picked.extra || getMutation(weapon)?.damageType || null, untilFumble: true });
    return i18n('E20.WeaponUseMutated', { name: actor.name, perk: item.name, weapon: weapon.name });
  }

  case 'firestorm': {
    // Firestorm (20th level): "spend an Energon Point as a Free action to further augment any weapon
    // that you've already altered with your Explosive Ammo Perk. The next time you attack with this
    // weapon, you triple the radius of its blast area."
    const picked = await pick(item.name, i18n('E20.WeaponUsePickWeapon'), weaponOptions(actor, w => !!getMutation(w)?.explosiveAmmo));
    if (!picked || !await pay('free') || !await spendEnergon(actor)) {
      return null;
    }

    const weapon = actor.items.get(picked.choice);
    await mutate(weapon, { tripleNext: true });
    return i18n('E20.WeaponUseMutated', { name: actor.name, perk: item.name, weapon: weapon.name });
  }

  case 'utilityLoaders': {
    // Utility Loaders (Decepticon Directive, Raider, 18th level, p.62): "As a Free action, you can
    // change the damage type of a single ranged attack weapon you wield to Blunt, Sharp, or any
    // Element; add the Anti-Tank, Armor Piercing, or Wrecker trait; or cause the weapon to deal an
    // amount of Stun equal to its normal damage. This adjustment lasts until you change it again, or
    // until you roll a Fumble."
    const modes = [
      ...['blunt', 'sharp', ...Object.keys(ELEMENTS)].map(k => ({ value: `type:${k}`, label: `${i18n('E20.WeaponUseDamageType')}: ${i18n(CONFIG.E20.damageTypes[k])}` })),
      ...['antiTank', 'armorPiercing', 'wrecker'].map(t => ({ value: `trait:${t}`, label: `${i18n('E20.WeaponUseAddTrait')}: ${i18n(CONFIG.E20.weaponTraits[t])}` })),
      { value: 'stun', label: i18n('E20.WeaponUseStunInstead') },
    ];
    const weaponPick = await pick(item.name, i18n('E20.WeaponUsePickWeapon'), weaponOptions(actor, w => isRanged(actor, w)));
    const modePick = weaponPick ? await pick(item.name, i18n('E20.WeaponUsePickAdjustment'), modes) : null;
    if (!modePick || !await pay('free')) {
      return null;
    }

    const weapon = actor.items.get(weaponPick.choice);
    const [kind, value] = modePick.choice.split(':');
    // "Until you change it again" - a new choice replaces the old one.
    await weapon.setFlag('essence20', MUTATION_FLAG, {
      ...(getMutation(weapon)?.explosiveAmmo ? getMutation(weapon) : {}),
      damageType: kind == 'type' ? value : null, addTraits: kind == 'trait' ? [value] : [], stunInstead: kind == 'stun', untilFumble: true,
    });
    return i18n('E20.WeaponUseMutated', { name: actor.name, perk: item.name, weapon: weapon.name });
  }

  case 'backblast': {
    // Backblast (Decepticon Directive, Thunderblast, 17th level, p.46): "reduce the range of any weapon
    // that deals damage in a blast area of effect by half (round up). When you do so, all creatures
    // within 5 feet of you when you attack with that weapon take 1 Fire damage unless the attack
    // Fumbles, in which case you take the 1 Fire damage." A switch - use it again to stop.
    const picked = await pick(item.name, i18n('E20.WeaponUsePickWeapon'), weaponOptions(actor, w => hasBlast(actor, w)));
    if (!picked) {
      return null;
    }

    const weapon = actor.items.get(picked.choice);
    const on = !getMutation(weapon)?.backblast;
    await mutate(weapon, { backblast: on });
    return i18n(on ? 'E20.WeaponUseBackblastOn' : 'E20.WeaponUseBackblastOff', { name: actor.name, weapon: weapon.name });
  }

  case 'airburst': {
    // Airburst (Decepticon Directive, Thunderblast, 17th level, p.64): "spend an Energon Point when you
    // make a ranged attack with a burst area of effect. The radius of the burst increases by 10 feet.
    // Any creature within the radius that takes damage from the attack is knocked Prone, and any
    // creature within the radius that doesn't take damage gains the Impaired Condition."
    const picked = await pick(item.name, i18n('E20.WeaponUsePickWeapon'), weaponOptions(actor, w => hasBlast(actor, w)));
    if (!picked || !await spendEnergon(actor)) {
      return null;
    }

    const weapon = actor.items.get(picked.choice);
    await mutate(weapon, { airburstNext: true });
    return i18n('E20.WeaponUseMutated', { name: actor.name, perk: item.name, weapon: weapon.name });
  }

  case 'kitbashUpgrade':
  case 'armamentUpgrade':
  case 'beatdown':
  case 'jackhammer':
  case 'gridConnection':
    return temporaryUpgradeUse(id, actor, item, pay, i18n);

  case 'trapsAndObstacles': {
    // Traps and Obstacles (Enigma of Combination, 6th level, p.36): "by spending 1 Energon Point and
    // using one non-Integrated weapon ... you may add the Proximity Bomb Weapon Upgrade to the weapon
    // in question, ignoring the upgrade's Prerequisite. This process takes 2d2 Standard actions."
    // The 2d2 actions are the first one here; the trap is used up when it goes off.
    const picked = await pick(item.name, i18n('E20.WeaponUsePickWeapon'),
      weaponOptions(actor, w => (w.system.classification?.size ?? 'integrated') != 'integrated'));
    if (!picked || !await pay('standard') || !await spendEnergon(actor)) {
      return null;
    }

    const weapon = actor.items.get(picked.choice);
    await attachTemporaryUpgrade(actor, weapon, PROXIMITY_BOMB, { kind: 'untilUsed', source: item.name });
    return i18n('E20.WeaponUseTemporaryUpgrade', { name: actor.name, perk: item.name, weapon: weapon.name, upgrade: 'Proximity Bomb' });
  }

  case 'knuckleUp':
    return knuckleUp(actor, item, pay, i18n);

  case 'hud': {
    const skill = await pick(item.name, i18n('E20.WeaponUsePickSkill'),
      Object.keys(CONFIG.E20.skills).map(key => ({ value: key, label: i18n(CONFIG.E20.skills[key]) })));
    if (!skill || !await pay('move')) {
      return null;
    }

    await actor.setFlag('essence20', HUD_FLAG, { skill: skill.choice, ...turnStamp() });
    return i18n('E20.WeaponUseHud', { name: actor.name, skill: i18n(CONFIG.E20.skills[skill.choice]) });
  }

  case 'weaponCustomizer': {
    // Weapon Customizer (Intercontinental Adventures p.64): ignoring an upgrade's prerequisites "gives
    // your upgraded weapon the Temperamental trait." Marks (or unmarks) the weapon that was customized.
    const picked = await pick(item.name, i18n('E20.WeaponUsePickWeapon'), weaponOptions(actor));
    if (!picked) {
      return null;
    }

    const weapon = actor.items.get(picked.choice);
    const on = !weapon.flags?.essence20?.customized;
    await weapon.setFlag('essence20', 'customized', on);
    return i18n(on ? 'E20.WeaponUseCustomized' : 'E20.WeaponUseUncustomized', { name: actor.name, weapon: weapon.name });
  }

  case 'motorLancer': {
    // Motor Lancer (Intercontinental Adventures p.64): "while driving or riding in a vehicle, you can
    // spend a Free action to treat a 2-handed melee weapon as a 1-handed melee weapon until the end
    // of your turn."
    if (!await pay('free')) {
      return null;
    }

    const { MOTOR_LANCER_FLAG } = await import("./weapon-upgrades.mjs");
    await actor.setFlag('essence20', MOTOR_LANCER_FLAG, turnStamp());
    return i18n('E20.WeaponUseMotorLancer', { name: actor.name });
  }

  default:
    return null;
  }
}

/**
 * Kitbash Upgrade (GI Joe CRB, Technician, 3rd level, p.105): "As a Standard action, make a
 * Technology Skill Test against the availability DIF of the upgrade. On a success, the equipment
 * gains the benefits of the upgrade for 1 minute, multiplied on a critical success."
 * Armament Upgrade (Intercontinental Adventures, 6th level, p.71): "as a Standard action, you can
 * apply temporary Standard and Limited weapon upgrades to a weapon with a Technology Skill Test. The
 * DIF equals 10 plus the Requisition DIF ... The upgrade lasts until the end of your next turn."
 * Beatdown / Jackhammer (Cobra Codex, p.69): "as a Free action, you can add a Standard Weapon Upgrade
 * to your integrated close combat heavy bludgeon [power tool] until the end of your turn" - Limited
 * at 10th, Restricted at 17th.
 * Grid Connection (Field Guide, Grid Psychic, 1st level, p.67): "As a Standard action, you can summon
 * your Power Weapon with a Standard weapon upgrade of your choice" - Limited at 10th, Restricted at
 * 20th - "you gain a light armor shell from the Grid, granting a +1 bonus to Toughness."
 */
async function temporaryUpgradeUse(id, actor, item, pay, i18n) {
  const level = Number(actor.system?.level) || 0;
  const upTo = (limitedAt, restrictedAt) => AVAILABILITY_ORDER.slice(0, level >= restrictedAt ? 3 : level >= limitedAt ? 2 : 1);
  const setup = {
    kitbashUpgrade: { availabilities: AVAILABILITY_ORDER, cost: 'standard', roll: 'availability', temporary: { kind: 'rounds', rounds: 10 } },
    armamentUpgrade: { availabilities: ['standard', 'limited'], cost: 'standard', roll: 'requisition', temporary: { kind: 'nextTurn' } },
    beatdown: { availabilities: upTo(10, 17), cost: 'free', temporary: { kind: 'turn' } },
    jackhammer: { availabilities: upTo(10, 17), cost: 'free', temporary: { kind: 'turn' } },
    gridConnection: { availabilities: upTo(10, 20), cost: 'standard', temporary: { kind: 'scene' }, shell: true },
  }[id];

  const weaponPick = await pick(item.name, i18n('E20.WeaponUsePickWeapon'), weaponOptions(actor));
  const upgradePick = weaponPick ? await pick(item.name, i18n('E20.WeaponUsePickUpgrade'), await weaponUpgradeOptions(setup.availabilities)) : null;
  if (!upgradePick || !await pay(setup.cost)) {
    return null;
  }

  const weapon = actor.items.get(weaponPick.choice);
  const upgrade = await fromUuid(upgradePick.choice);
  const temporary = { ...setup.temporary, source: item.name };
  if (setup.roll) {
    const base = CONFIG.E20.availabilityDifficulties?.[upgrade?.system?.availability] ?? 10;
    const dif = setup.roll == 'requisition' ? 10 + base : base;
    if (!await rollTechnology(actor, dif)) {
      return i18n('E20.WeaponUseFailed', { name: actor.name, perk: item.name });
    }
  }

  await attachTemporaryUpgrade(actor, weapon, upgradePick.choice, temporary);
  if (setup.shell) {
    await actor.setFlag('essence20', GRID_SHELL_FLAG, { scene: getSceneEpoch() });
  }

  return i18n('E20.WeaponUseTemporaryUpgrade', { name: actor.name, perk: item.name, weapon: weapon.name, upgrade: upgrade?.name ?? '' });
}

/**
 * Knuckle Up (Sgt. Slaughter Sourcebook, 6th level, p.12): "you can grant your unarmed combat Attacks
 * the effects and alternate effects of a melee weapon of your choice by spending Free actions
 * (Standard 1, Limited 3, Restricted 5). These benefits last until the end of your turn."
 * Hammer It Out (17th level): "spend a use of Reckless Abandon to gain the benefits of Knuckle Up
 * until the end of the scene."
 */
async function knuckleUp(actor, item, pay, i18n) {
  const options = await meleeWeaponOptions(['standard', 'limited', 'restricted']);
  const hammer = has(actor, U.hammerItOut);
  const extra = hammer
    ? `<div class="form-group"><label>${i18n('E20.WeaponUseHammerItOut')}</label><select name="extra"><option value="">${i18n('E20.WeaponUseUntilTurnEnd')}</option><option value="scene">${i18n('E20.WeaponUseUntilSceneEnd')}</option></select></div>`
    : '';
  const picked = await pick(item.name, i18n('E20.WeaponUsePickMeleeWeapon'), options, extra);
  if (!picked) {
    return null;
  }

  const weapon = await fromUuid(picked.choice);
  const cost = { standard: 1, limited: 3, restricted: 5 }[weapon?.system?.availability] ?? 1;
  if (!await pay('free', cost)) {
    return null;
  }

  let kind = 'turn';
  if (picked.extra == 'scene') {
    const reckless = actor.items.find(i => i.type == 'rolePoints' && (i.system.resource?.value ?? 0) > 0 && /reckless/i.test(i.name));
    if (reckless) {
      await reckless.update({ 'system.resource.value': reckless.system.resource.value - 1 });
      kind = 'scene';
    }
  }

  const created = [];
  for (const entry of Object.values(weapon?.system?.items ?? {}).filter(e => e?.type == 'weaponEffect')) {
    const effect = await fromUuid(entry.uuid);
    if (!effect) {
      continue;
    }

    const data = effect.toObject();
    delete data._id;
    data.name = `${effect.name} (${item.name})`;
    foundry.utils.setProperty(data, 'flags.essence20.parentId', null);
    foundry.utils.setProperty(data, `flags.essence20.${TEMPORARY_FLAG}`, { kind, source: item.name, ...turnStamp(), scene: getSceneEpoch() });
    created.push(data);
  }

  if (created.length) {
    await actor.createEmbeddedDocuments('Item', created);
  }

  return i18n('E20.WeaponUseKnuckleUp', { name: actor.name, weapon: weapon?.name ?? '' });
}

/**
 * Everything a changed weapon does once an attack with it has been rolled. Called by
 * documents/item.mjs with the roll's result ({success, outcomes: [{isFumble, results}]}).
 * @param {Actor} actor
 * @param {Item} weapon
 * @param {Object} rollResult
 */
export async function resolveWeaponChangesAfterAttack(actor, weapon, rollResult) {
  const mutation = getMutation(weapon);
  const outcomes = rollResult?.outcomes ?? [];
  const fumbled = outcomes.some(outcome => outcome?.isFumble);
  const { applyDamage } = await import("./combat.mjs");

  if (mutation?.backblast) {
    const token = actor.getActiveTokens?.()?.[0];
    const near = token && canvas?.grid
      ? canvas.tokens.placeables.filter(other => other !== token && other.actor
        && canvas.grid.measurePath([token.center, other.center]).distance <= 5)
      : [];
    const victims = fumbled ? [actor] : near.map(other => other.actor);
    for (const victim of victims) {
      await applyDamage(victim, 1, 'fire');
    }

    if (victims.length) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: game.i18n.format('E20.WeaponUseBackblastHit', { weapon: weapon.name, names: victims.map(v => v.name).join(', ') }),
      });
    }
  }

  if (mutation?.airburstNext) {
    for (const result of outcomes.flatMap(outcome => outcome?.results ?? [])) {
      const target = result.targetUuid ? await fromUuid(result.targetUuid) : null;
      if (target) {
        await target.toggleStatusEffect?.(result.success ? 'prone' : 'impaired', { active: true });
      }
    }
  }

  await afterMutatedAttack(weapon, fumbled);
  await spendUntilUsed(actor, weapon);
}
