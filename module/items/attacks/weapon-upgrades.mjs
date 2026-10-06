import { hostOf, rulesOfType } from "../../rules/index.mjs";
import { contextFor, evaluate } from "../../rules/predicate.mjs";
import { resolveValue } from "../../rules/formula.mjs";
import { applyItemStage } from "../../rules/plugins/effects/item-modifier-stage.mjs";
/**
 * Weapon Upgrades that change the weapon they're attached to.
 *
 * An attached Upgrade has always been able to add or remove a trait (documents/item.mjs
 * #_prepareTraits). This file does everything else the upgrade tables print: double a range, grow a
 * blast, swap the attack skill, add a target, shrink the weapon, add a damage rider, and grant new
 * alternate effects. It works in three places:
 *
 * 1. applyToEffect() - called from a weaponEffect's prepareDerivedData. Adjusts the effect's own
 *    numbers in DERIVED data only; the paths it touched are recorded on the effect so the item
 *    sheet can keep editing the stored values (sheets/item-sheet.mjs) - an upgraded range must
 *    never be saved back as the base range.
 * 2. applyToWeapon() - called from the weapon's own prepareDerivedData: size steps, and the
 *    element a weapon deals once chosen.
 * 3. syncGeneratedEffects() - the alternate effects an upgrade GRANTS (Nonlethal's Stun, Tracer
 *    Rounds' Spot, the Laser trait's Stun and Spot...). Those are real weaponEffect Items, created
 *    when the upgrade arrives and deleted when it leaves, each tagged with the key that made it -
 *    the same "a granted effect is a real effect" shape linkedWeaponEffect (Explosive Rounds) uses.
 *
 * Upgrades are matched by compendium _id rather than full uuid: the same upgrade is printed in the
 * G.I. Joe, Transformers and Power Rangers core books under one _id.
 */

// Scope, Aerodynamics, Eruptive, Deadly, Lingering, Swift, Tossable Vial and Chrono-Trigger are item rules
// (ItemModifier / RollModifier / AttackCount on the upgrade - rules/conv14-systems.test.js); the grips, Automated,
// Biomechanical Weapon, Extended, Chemical Sprayer, Power Weapon Element Damage Assignment, Microtech Weapon, Bullpup's
// size, Pill / Salve / Mist Form and Hyperkinetic Support Harness are ItemModifier stage item rules on theirs
// (rules/plugins/effects/item-modifier-stage.mjs, applied below - rules/conv15-systems.test.js).
export const UPGRADE = {
  timeBomb: 'VMZ8PDom0sJGyofl',
  proximityBomb: 'I2nS9xXN8ioV5jJ5',
  detonatorBomb: 'DMl6kKJe0iwW430D',
  elementalProjector: '9j0Qkz1o201pJ6uW',
  modularStandard: 'YiQEwRAKA8k5aswJ',
  modularLimited: 'nx3HyAPnwVWIKPVZ',
  modularRestricted: 'iddkqqgyaPpTmuiy',
};

// (Scramble Wave's and Rust Derivatives' extra damage, Bullpup's free reload, Fluid Motion's Maneuver and Motor Lancer's
// one hand are rules on those items - rules/conv17-Split1.test.js.)

// The Elements a weapon can deal (GI Joe CRB p.207), keyed by damage type, with the trait each
// one is written as. Electromagnetic's damage type is 'emp'.
export const ELEMENTS = {
  acid: 'acid', cold: 'cold', electric: 'electric', emp: 'electromagnetic', fire: 'fire', laser: 'laser', sonic: 'sonic',
};
const ELEMENT_TRAITS = Object.values(ELEMENTS);

// Effects that don't deal damage - Deadly leaves them alone.
export const NON_DAMAGE_TYPES = [
  'stun', 'cover', 'spot', 'maneuver', 'grapple', 'intimidate', 'knocProne', 'blindingBlast', 'frightened',
  'impaired', 'mesmerized', 'restrained', 'unconscious', 'modelock', 'special', 'deafened',
];

const FIREBALL = 'Compendium.essence20.cobra_codex.Item.20lv1ecNs4ORVwWu';

/* -------------------------------------------- */
/*  Lookups                                     */
/* -------------------------------------------- */

export function idOf(uuid) {
  return String(uuid ?? '').split('.').pop();
}

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
}

/**
 * The Upgrade Items attached to a weapon (on its actor, carrying the weapon's id as parentId).
 * @param {Item} weapon
 * @returns {Item[]}
 */
export function getAttachedUpgrades(weapon) {
  const actor = weapon?.parent;
  if (!actor?.items || !weapon?.id) {
    return [];
  }

  return actor.items.filter(item => item.type == 'upgrade' && item.flags?.essence20?.parentId == weapon.id);
}

/**
 * How many copies of an upgrade (by compendium _id) a weapon carries.
 */
export function countUpgrade(weapon, upgradeId) {
  return getAttachedUpgrades(weapon).filter(item => idOf(sourceOf(item)) == upgradeId).length;
}

export function hasUpgrade(weapon, upgradeId) {
  return countUpgrade(weapon, upgradeId) > 0;
}

function findUpgrade(weapon, upgradeId) {
  return getAttachedUpgrades(weapon).find(item => idOf(sourceOf(item)) == upgradeId) ?? null;
}

function actorHas(actor, uuid) {
  return !!actor?.items?.find?.(item => sourceOf(item) == uuid);
}

/**
 * The weapon an effect belongs to.
 */
export function parentWeaponOf(effect) {
  const parentId = effect?.flags?.essence20?.parentId;
  return parentId ? effect.parent?.items?.get?.(parentId) ?? null : null;
}

/**
 * The element a weapon deals once chosen: its own choice ("When receiving an Element weapon for a
 * mission, you must first choose the type of element the weapon uses", GI Joe CRB p.207), an
 * Elemental Projector's choice, or none.
 * @returns {?String}   A damage type key of ELEMENTS.
 */
export function chosenElement(weapon) {
  const projector = findUpgrade(weapon, UPGRADE.elementalProjector);
  const projected = projector?.flags?.essence20?.elementChoice;
  return (projected && ELEMENTS[projected] ? projected : null)
    ?? (weapon?.system?.elementChoice && ELEMENTS[weapon.system.elementChoice] ? weapon.system.elementChoice : null);
}

/**
 * The Element traits a weapon has GAINED - from upgrades or from its chosen element - as opposed
 * to the ones printed on it. Printed Element weapons already list their own alternate effects; a
 * gained trait is what needs them generated.
 * @param {Item} weapon
 * @returns {String[]}   Trait keys.
 */
export function gainedElementTraits(weapon) {
  const own = weapon?._source?.system?.traits ?? [];
  const gained = new Set();
  for (const upgrade of getAttachedUpgrades(weapon)) {
    for (const trait of upgrade.system?.traits ?? []) {
      if (ELEMENT_TRAITS.includes(trait) && !own.includes(trait)) {
        gained.add(trait);
      }
    }
  }

  const element = chosenElement(weapon);
  if (element && !own.includes(ELEMENTS[element])) {
    gained.add(ELEMENTS[element]);
  }

  return [...gained];
}

/* -------------------------------------------- */
/*  1. The effect's own numbers                 */
/* -------------------------------------------- */

/**
 * Adjust a weaponEffect's derived numbers for the upgrades on its weapon. Records every path it
 * touched in system.upgradeTouched, for the item sheet.
 * @param {Object} system   The effect's system data (derived - mutated in place).
 * @param {Item} effect     The effect Item.
 */
export function applyToEffect(system, effect) {
  const actor = effect?.parent;
  const weapon = parentWeaponOf(effect);
  const touched = new Set();
  const set = (path, value) => {
    foundry.utils.setProperty(system, path, value);
    touched.add(path);
  };

  // Item rules' ItemModifier stage item, slot start (Scramble Wave, Robust Ram, Slashing Wings, the Biotech Performance Enhancer's +1).
  applyItemStage(system, effect, 'start', set);

  if (!weapon) {
    applyItemStage(system, effect, 'end', set);
    system.upgradeTouched = [...touched];
    return;
  }

  const count = id => countUpgrade(weapon, id);
  const damaging = !NON_DAMAGE_TYPES.includes(system.damageType);

  // The chosen element replaces a printed "Element" damage.
  const element = chosenElement(weapon);
  if (element && system.damageType == 'element') {
    set('damageType', element);
  }

  // Elemental Projector (Decepticon Directive p.75): "Changes damage type to a chosen Element type."
  const projector = findUpgrade(weapon, UPGRADE.elementalProjector)?.flags?.essence20?.elementChoice;
  if (projector && ELEMENTS[projector] && damaging) {
    set('damageType', projector);
  }

  // Item rules' ItemModifier stage item, slot element (Power Weapon Element Damage Assignment, Chemical Sprayer).
  applyItemStage(system, effect, 'element', set);

  // (Smart Scope's ranges are ItemModifier stage item rules too; Scope's and Aerodynamics' doubling and Tossable Vial's
  // 20/50ft are actor-pass ItemModifier rules on those upgrades.)

  // Time / Proximity / Detonator Bomb (p.116-118): "The grenade's range becomes Reach."
  if ([UPGRADE.timeBomb, UPGRADE.proximityBomb, UPGRADE.detonatorBomb].some(count)) {
    set('range.value', null);
    set('range.long', null);
    set('range.reachMultiplier', 1);
  }

  // (Eruptive's doubled blast is an ItemModifier rule on the upgrade, worked out as if it came before the changes below.)
  // A weapon changed for a while by a Perk (items/attacks/weapon-perk-uses.mjs): Explosive Ammo's blast,
  // Firestorm's tripled radius, Airburst's +10ft, Backblast's halved range, Utility Loaders' and
  // Tooled Munitions' damage type, or Stun instead of damage.
  const mutation = weapon.flags?.essence20?.mutation;
  if (mutation) {
    if (mutation.stunInstead && damaging) {
      set('damageType', 'stun');
    } else if (mutation.damageType && damaging) {
      set('damageType', mutation.damageType);
    }

    if (mutation.blastSet && !(system.radius > 0) && system.range?.value) {
      set('shape', 'circle');
      set('radius', mutation.blastSet);
    } else if (mutation.blastAdd && system.radius > 0) {
      set('radius', system.radius + mutation.blastAdd);
    }

    if (mutation.tripleNext && system.radius > 0) {
      set('radius', system.radius * 3);
    }

    if (mutation.airburstNext && system.radius > 0) {
      set('radius', system.radius + 10);
    }

    if (mutation.backblast && system.range?.value) {
      set('range.value', Math.ceil(system.range.value / 2));
      if (system.range.long) {
        set('range.long', Math.ceil(system.range.long / 2));
      }
    }
  }

  // Fireball (Cobra Codex p.59): Fire weapons' "main effect gains a 5-foot radius Blast area of
  // effect."
  if (actorHas(actor, FIREBALL) && (weapon.system?.traits ?? []).includes('fire') && damaging
    && !(system.radius > 0) && primaryEffect(weapon)?.id == effect.id) {
    set('shape', 'circle');
    set('radius', 5);
  }

  // (Swift's extra target, Deadly's +1 damage and Lingering's +1 turn are ItemModifier rules on those upgrades.)
  // Cold gained: "If the weapon already has a Stun effect, increase the Stun effect by 1" (p.207).
  if (system.damageType == 'stun' && gainedElementTraits(weapon).includes('cold') && !effect.flags?.essence20?.generatedKey) {
    set('damageValue', (system.damageValue ?? 0) + 1);
  }

  // Item rules' ItemModifier stage item, slot end (Rust Derivatives first, then Extended, the grips, Automated,
  // Biomechanical Weapon).
  applyItemStage(system, effect, 'end', set);
  system.upgradeTouched = [...touched];
}

/* -------------------------------------------- */
/*  2. The weapon itself                        */
/* -------------------------------------------- */

/**
 * Size steps and hands. Called after the weapon's own effectiveSize/derivedHands are prepared.
 *
 * Item rules' ItemModifier stage item on the weapon (Microtech Weapon, Bullpup, Hyperkinetic Support Harness, Pill /
 * Salve / Mist Form, Motor Lancer's one hand).
 * @param {Item} weapon
 */
export function applyToWeapon(weapon) {
  applyItemStage(weapon.system, weapon);
}

/* -------------------------------------------- */
/*  3. Granted alternate effects                */
/* -------------------------------------------- */

const MODULAR = [UPGRADE.modularStandard, UPGRADE.modularLimited, UPGRADE.modularRestricted];

/**
 * The key a generated alternate effect was made under - or undefined for a printed one. Effects made
 * before Pistol Whip and Specialty Flexibility became rules carry the same key as o3GeneratedKey.
 */
export function generatedKeyOf(item) {
  return item?.flags?.essence20?.generatedKey ?? item?.flags?.essence20?.o3GeneratedKey;
}

/**
 * The weapon's own printed effect every generated alternate is modelled on: its first damaging
 * effect, else its first effect.
 */
export function primaryEffect(weapon) {
  const effects = (weapon?.parent?.items ?? []).filter(item => item.type == 'weaponEffect'
    && item.flags?.essence20?.parentId == weapon.id && !generatedKeyOf(item));
  return effects.find(effect => !NON_DAMAGE_TYPES.includes(effect._source?.system?.damageType ?? effect.system.damageType))
    ?? effects[0] ?? null;
}

/**
 * Every alternate effect this weapon should carry because of its upgrades, gained traits and its
 * wielder's Perks. Each is {key, name, changes} - changes are applied over a copy of the primary.
 * Modular weapons are resolved separately (they copy another weapon's own effects).
 * @param {Item} weapon
 * @returns {Array<Object>}
 */
export function desiredGeneratedEffects(weapon) {
  const primary = primaryEffect(weapon);
  if (!primary) {
    return [];
  }

  const actor = weapon.parent;
  const base = primary._source?.system ?? primary.system;
  const i18n = key => game.i18n.localize(key);
  const wanted = [];
  const add = (key, label, changes) => wanted.push({ key, name: `${label} (${weapon.name})`, changes });
  // The weapon's own printed effects only - a generated one may be about to go (a Laser Stun when the
  // element changes to Cold), and must not stop its replacement being made.
  const existingTypes = (actor?.items ?? []).filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id
    && !generatedKeyOf(item))
    .map(item => item._source?.system?.damageType ?? item.system.damageType);

  // Item rules (AlternateEffect): Nonlethal, Strobe, Covering, Heavy Hitting, Folding Stock,
  // Manipulative and Tracer Rounds on the weapon's upgrades; Big Swing on the wielder.
  for (const want of ruleAlternateEffects(weapon, primary, base, existingTypes)) {
    add(want.key, want.label, want.changes);
  }

  // Laser (p.207): "Laser weapons gain Stun 1 as an alternate effect, and can be used to Spot targets
  // as an alternate effect." Only for a GAINED Laser trait - printed laser weapons already list both.
  // (Tracer Rounds' Spot is its rule, under the same key.)
  const gained = gainedElementTraits(weapon);
  if (gained.includes('laser')) {
    add('spot', i18n('E20.DamageSpot'), { damageType: 'spot', damageValue: 1, 'secondaryDamage.type': null, 'secondaryDamage.value': 0 });
  }

  if (gained.includes('laser') && !existingTypes.includes('stun')) {
    add('laserStun', i18n('E20.DamageStun'), { damageType: 'stun', damageValue: 1, 'secondaryDamage.type': null, 'secondaryDamage.value': 0 });
  }

  // Cold (p.207): "Cold weapons add Stun 1 as an alternate effect of the weapon. If the weapon
  // already has a Stun effect, increase the Stun effect by 1" - the second half is applyToEffect.
  if (gained.includes('cold') && !existingTypes.includes('stun')) {
    add('coldStun', i18n('E20.DamageStun'), { damageType: 'stun', damageValue: 1, 'secondaryDamage.type': null, 'secondaryDamage.value': 0 });
  }

  // Sonic (p.207): "Sonic weapons gain an alternative effect identical to the weapon's primary
  // effect, but it targets Willpower with a ↓2."
  if (gained.includes('sonic')) {
    add('sonic', `${primary.name} - ${i18n('E20.DefenseWillpower')}`, { defenseType: 'willpower', shiftDown: (base.shiftDown ?? 0) + 2 });
  }

  // Versatile (Across the Stars p.79): "A weapon that has two methods of being wielded" - for a melee
  // weapon, Might or Finesse (PR CRB, "Versatile Melee (Might or Finesse, chosen at attack)"). The
  // other one is offered as an alternate; ranged Versatile weapons print their alternates already.
  const versatileSkill = { might: 'finesse', finesse: 'might' }[base.classification?.skill];
  if ((weapon.system?.traits ?? []).includes('versatile') && base.classification?.style == 'melee' && versatileSkill) {
    add('versatile', `${primary.name} - ${i18n(CONFIG.E20.skills?.[versatileSkill] ?? versatileSkill)}`, { 'classification.skill': versatileSkill });
  }

  // One effect per key (a rule and the code above may both ask for Spot).
  return wanted.filter((want, index) => wanted.findIndex(other => other.key == want.key) == index);
}

/**
 * The alternates AlternateEffect rules ask for on this weapon: host-scoped ones on its own upgrades, and
 * the wielder's own (self) ones whose `items` tags match it.
 * @returns {Array<{key, label, changes}>}
 */
function ruleAlternateEffects(weapon, primary, base, existingTypes) {
  const actor = weapon.parent;
  const out = [];
  for (const { rule, item } of rulesOfType(actor, 'AlternateEffect')) {
    const scope = rule.scope ?? 'self';
    if (scope == 'host' ? hostOf(item)?.id != weapon.id : scope != 'self') {
      continue;
    }

    const ctx = contextFor({ self: actor, ruleItem: item, item: weapon });
    if ((scope == 'self' && evaluate(rule.items ?? [], ctx) !== true) || evaluate(rule.when, ctx) !== true) {
      continue;
    }

    if ((rule.baseTypes?.length && !rule.baseTypes.includes(base.damageType)) || (rule.unlessType && existingTypes.includes(rule.unlessType))) {
      continue;
    }

    const changes = { ...(rule.changes ?? {}) };
    for (const [path, formula] of Object.entries(rule.formulas ?? {})) {
      changes[path] = resolveValue(formula, { actor, item, base }, 0);
    }

    const label = String(rule.name ?? rule.key)
      .replace(/\{primary\}/g, primary.name)
      .replace(/\{(E20\.[\w.]+)\}/g, (match, key) => game.i18n.localize(key));
    out.push({ key: rule.key, label: /^E20\.[\w.]+$/.test(label) ? game.i18n.localize(label) : label, changes });
  }

  return out;
}

/**
 * The compendium weapon a Modular upgrade was set to (chosen when it was attached).
 */
function modularChoices(weapon) {
  return getAttachedUpgrades(weapon)
    .filter(upgrade => MODULAR.includes(idOf(sourceOf(upgrade))) && upgrade.flags?.essence20?.modularWeaponUuid)
    .map(upgrade => ({ upgrade, uuid: upgrade.flags.essence20.modularWeaponUuid }));
}

// One sync at a time per actor, so two triggers can't both create the same effect.
const running = new Map();

/**
 * Bring the actor's generated alternate effects in line with what its upgrades now grant: create
 * the missing ones, delete the ones whose reason is gone. Idempotent.
 * @param {Actor} actor
 * @returns {Promise<{created: Number, deleted: Number}>}
 */
export async function syncGeneratedEffects(actor) {
  if (!actor?.items) {
    return { created: 0, deleted: 0 };
  }

  const previous = running.get(actor.uuid) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => doSync(actor));
  running.set(actor.uuid, next);
  try {
    return await next;
  } finally {
    if (running.get(actor.uuid) === next) {
      running.delete(actor.uuid);
    }
  }
}

async function doSync(actor) {
  const weapons = actor.items.filter(item => item.type == 'weapon');
  const existing = actor.items.filter(item => item.type == 'weaponEffect' && generatedKeyOf(item));
  const keep = new Set();
  const toCreate = [];

  for (const weapon of weapons) {
    const primary = primaryEffect(weapon);
    for (const want of desiredGeneratedEffects(weapon)) {
      const key = `${weapon.id}:${want.key}`;
      keep.add(key);
      if (!existing.some(item => generatedKeyOf(item) == key) && primary) {
        const data = primary.toObject();
        delete data._id;
        data.name = want.name;
        for (const [path, value] of Object.entries(want.changes)) {
          foundry.utils.setProperty(data.system, path, value);
        }

        foundry.utils.setProperty(data, 'flags.essence20.generatedKey', key);
        foundry.utils.setProperty(data, 'flags.essence20.parentId', weapon.id);
        toCreate.push({ weapon, data });
      }
    }

    // Modular weapons: "the weapon counts as both the upgraded weapon and the chosen weapon" - the
    // chosen weapon's own effects become this one's alternates.
    for (const { upgrade, uuid } of modularChoices(weapon)) {
      const chosen = await fromUuid(uuid);
      const entries = Object.values(chosen?.system?.items ?? {}).filter(entry => entry?.type == 'weaponEffect');
      for (const [index, entry] of entries.entries()) {
        const key = `${weapon.id}:modular:${upgrade.id}:${index}`;
        keep.add(key);
        if (existing.some(item => generatedKeyOf(item) == key)) {
          continue;
        }

        const source = await fromUuid(entry.uuid);
        if (!source) {
          continue;
        }

        const data = source.toObject();
        delete data._id;
        data.name = `${source.name} (${chosen.name})`;
        foundry.utils.setProperty(data, 'flags.essence20.generatedKey', key);
        foundry.utils.setProperty(data, 'flags.essence20.parentId', weapon.id);
        toCreate.push({ weapon, data });
      }
    }
  }

  const stale = existing.filter(item => !keep.has(generatedKeyOf(item)));
  if (stale.length) {
    await removeFromWeapons(actor, stale);
    await actor.deleteEmbeddedDocuments('Item', stale.map(item => item.id));
  }

  if (toCreate.length) {
    const created = await actor.createEmbeddedDocuments('Item', toCreate.map(entry => entry.data));
    const { setEntryAndAddItem } = await import("../../sheet-handlers/attachment-handler.mjs");
    for (const [index, effect] of created.entries()) {
      const key = await setEntryAndAddItem(effect, toCreate[index].weapon);
      if (key) {
        await effect.setFlag('essence20', 'collectionId', key);
      }
    }
  }

  return { created: toCreate.length, deleted: stale.length };
}

/**
 * Take deleted generated effects back out of their weapons' attachment lists.
 */
async function removeFromWeapons(actor, effects) {
  const byWeapon = new Map();
  for (const effect of effects) {
    const weapon = actor.items.get(effect.flags.essence20.parentId);
    const collectionId = effect.flags.essence20.collectionId;
    if (weapon && collectionId && weapon.system.items?.[collectionId]) {
      byWeapon.set(weapon, [...(byWeapon.get(weapon) ?? []), collectionId]);
    }
  }

  for (const [weapon, keys] of byWeapon) {
    await weapon.update(Object.fromEntries(keys.map(key => [`system.items.-=${key}`, null])));
  }
}

/**
 * Whether a change to this Item can change what effects are generated - an Upgrade on a weapon, a
 * weapon's element, or one of the Perks that grant alternates.
 */
export function affectsGeneratedEffects(item, changes = null) {
  if (item?.type == 'upgrade') {
    return !!item.flags?.essence20?.parentId || !!changes?.flags?.essence20;
  }

  if (item?.type == 'weapon') {
    return !changes || changes.system?.elementChoice !== undefined || changes.system?.traits !== undefined
      || changes.system?.hardpoint !== undefined;
  }

  if (item?.type == 'perk') {
    return sourceOf(item) == FIREBALL
      || (item.system?.rules ?? []).some(rule => rule?.type == 'AlternateEffect');
  }

  return false;
}

/* -------------------------------------------- */
/*  Roll-time                                   */
/* -------------------------------------------- */

/**
 * The Essence damage a critical hit with this weapon can deal instead of repeating its effect -
 * Bewildering, Traumatic, Maiming, Surgical. "If this weapon has both ..., the attacker chooses."
 * @param {Item} weapon
 * @returns {Array<{essence: String, source: String}>}
 */
/* -------------------------------------------- */
/*  Choices made when an upgrade is attached    */
/* -------------------------------------------- */

const MODULAR_AVAILABILITY = {
  [UPGRADE.modularStandard]: 'standard',
  [UPGRADE.modularLimited]: 'limited',
  [UPGRADE.modularRestricted]: 'restricted',
};

async function pickFromList(title, prompt, options) {
  const choices = options.map(o => `<option value="${o.value}">${foundry.utils.escapeHTML(o.label)}</option>`).join('');
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    position: { width: 420 },
    content: `<p>${prompt}</p><div class="form-group"><select name="choice">${choices}</select></div>`,
    buttons: [
      { action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true, callback: (event, button) => button.form.elements.choice.value },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  return result && result != 'cancel' ? result : null;
}

/**
 * The weapons a Modular upgrade can build in - every compendium weapon of its availability.
 * @param {String} availability
 * @returns {Promise<Array<{value: String, label: String}>>}
 */
export async function modularWeaponOptions(availability) {
  const options = new Map();
  for (const pack of game.packs.filter(p => p.documentName == 'Item' && p.metadata.system == 'essence20')) {
    const index = await pack.getIndex({ fields: ['type', 'system.availability'] });
    for (const entry of index) {
      if (entry.type == 'weapon' && entry.system?.availability == availability && !options.has(entry.name)) {
        options.set(entry.name, { value: entry.uuid, label: entry.name });
      }
    }
  }

  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Ask for whatever an upgrade needs decided when it goes on: Elemental Projector's Element, the weapon a
 * Modular upgrade builds in. (Biomechanical Weapon's Skill is its own rule's pick.) Stored on the upgrade's own
 * flags; closing the question leaves it unset (the upgrade then does nothing until set).
 * @param {Item} upgrade   The attached upgrade Item.
 * @returns {Promise<Boolean>}   Whether anything was chosen.
 */
export async function promptUpgradeChoice(upgrade) {
  const id = idOf(sourceOf(upgrade));
  if (id == UPGRADE.elementalProjector) {
    const choice = await pickFromList(upgrade.name, game.i18n.localize('E20.UpgradeChooseElement'),
      Object.keys(ELEMENTS).map(key => ({ value: key, label: game.i18n.localize(CONFIG.E20.damageTypes[key]) })));
    if (choice) {
      await upgrade.setFlag('essence20', 'elementChoice', choice);
    }

    return !!choice;
  }

  const availability = MODULAR_AVAILABILITY[id];
  if (availability) {
    const options = await modularWeaponOptions(availability);
    const choice = options.length
      ? await pickFromList(upgrade.name, game.i18n.localize('E20.UpgradeChooseModularWeapon'), options)
      : null;
    if (choice) {
      await upgrade.setFlag('essence20', 'modularWeaponUuid', choice);
    }

    return !!choice;
  }

  return false;
}
