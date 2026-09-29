import { worldActors } from "./companion-link.mjs";
/**
 * Bonded partners - Headmasters, Powermasters and Targetmasters (Enigma of Combination p.33, 40-41,
 * 55).
 *
 * - The Perk that makes the bond (Headmaster Body, Headmaster Head, Powermaster, Targetmaster) has a
 *   Use button: the first time it names the partner - any actor, or a new companion "created by the
 *   GM" - after that it links or unlinks the pair.
 * - The bond is kept on the Perk holder only (flags.essence20.bond = {partner, linked}), so nothing
 *   has to write to a partner the player may not own; bondOf() finds it from either side.
 * - What it gives: Headmaster Body's ↑1, Headmaster Head's ↓2 to attackers, Targetmaster's Edge and +1
 *   damage, Powermaster's module Energon, Synaptic Linkage, and the Bonded Master Focus (Hit Someone
 *   Your Own Size!, Advanced/Perfect Link, Bonded Proficiency, Armored Connection).
 */

const uuid = id => `Compendium.essence20.enigma_of_combination.Item.${id}`;
export const BOND = {
  headmasterBody: uuid('LY8HGN112nSRlhZ3'),
  headmasterHead: uuid('8Oicjt2r9oW1aycj'),
  powermaster: uuid('RUlNdBVlWqFvkYLv'),
  targetmaster: uuid('f1QCcxbjf3Y3kskE'),
  synapticLinkage: uuid('3JCZlRjXovAMXmko'),
  advancedLink: uuid('fTRSvbpJrCWUY6wU'),
  perfectLink: uuid('i3yGBZd2y7jT1SWm'),
  armoredConnection: uuid('V7yh8guXzkF1qqAK'),
  bondedProficiency: uuid('ZMs9cLu6O89Lv7Oo'),
  hitSomeoneYourOwnSize: uuid('zDeWS4koDbfN98hB'),
  transtectorRig: uuid('bdgThhk7atm9XMet'),
  rigReinforcement: uuid('Sof6OR5q1AnUaPDK'),
  linkLock: uuid('0Ub2QRx8AcakJj97'),
};

const MAKERS = [BOND.headmasterBody, BOND.headmasterHead, BOND.powermaster, BOND.targetmaster];
const FLAG = 'bond';
const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
}

function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return Array.isArray(items.contents) ? items.contents : (typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

const has = (actor, id) => itemsOf(actor).some(item => sourceOf(item) == id);

function resolve(id) {
  try {
    return id ? globalThis.fromUuidSync?.(id) ?? null : null;
  } catch (error) {
    return null;
  }
}

export function isBondUse(item) {
  return MAKERS.includes(sourceOf(item)) || sourceOf(item) == BOND.synapticLinkage;
}

/**
 * The bond this actor is in, from either side.
 * @param {Actor} actor
 * @returns {{holder: Actor, partner: Actor, linked: Boolean}|null}
 */
export function bondOf(actor) {
  const own = actor?.flags?.essence20?.[FLAG];
  if (own?.partner) {
    const partner = resolve(own.partner);
    return partner ? { holder: actor, partner, linked: !!own.linked } : null;
  }

  for (const other of worldActors()) {
    const bond = other?.flags?.essence20?.[FLAG];
    if (actor?.uuid && bond?.partner && bond.partner == actor.uuid) {
      return { holder: other, partner: actor, linked: !!bond.linked };
    }
  }

  return null;
}

/** The other one. */
export function bondedAlly(actor) {
  const bond = bondOf(actor);
  if (!bond) {
    return null;
  }

  return bond.holder.uuid == actor.uuid ? bond.partner : bond.holder;
}

export function isLinked(actor) {
  return !!bondOf(actor)?.linked;
}

/** Holds a Perk on either side of a linked pair. */
function pairHas(actor, id) {
  const bond = bondOf(actor);
  return !!bond && (has(bond.holder, id) || has(bond.partner, id));
}

/* -------------------------------------------- */
/*  Use button                                   */
/* -------------------------------------------- */

/**
 * @param {Item} item   Headmaster Body/Head, Powermaster, Targetmaster, or Synaptic Linkage.
 * @param {Function} pay
 * @returns {Promise<String|null>}
 */
export async function runBondUse(item, pay) {
  const actor = item?.parent;
  if (!actor) {
    return null;
  }

  if (sourceOf(item) == BOND.synapticLinkage) {
    return passCondition(actor, pay);
  }

  const bond = actor.flags?.essence20?.[FLAG];
  if (!bond?.partner) {
    return choosePartner(actor, item);
  }

  const { chooseButtons } = await import("./grants.mjs");
  const options = [['link', T(bond.linked ? 'E20.BondUnlink' : 'E20.BondLink')]];
  if (sourceOf(item) == BOND.targetmaster) {
    options.push(['weapon', T('E20.TargetmasterPickWeapon')]);
  }

  if (sourceOf(item) == BOND.powermaster) {
    options.push(['energon', T('E20.PowermasterDraw', { left: moduleEnergon(actor) })]);
  }

  options.push(['partner', T('E20.BondNewPartner')]);
  const choice = options.length == 1 ? 'link' : await chooseButtons(item.name, T('E20.BondPrompt', { partner: resolve(bond.partner)?.name ?? '?' }), options);
  if (choice == 'link') {
    await actor.setFlag('essence20', FLAG, { ...bond, linked: !bond.linked });
    return T(bond.linked ? 'E20.BondUnlinked' : 'E20.BondLinked', { name: actor.name, partner: resolve(bond.partner)?.name ?? '' });
  }

  if (choice == 'weapon') {
    return pickTargetmasterWeapon(actor, item);
  }

  if (choice == 'energon') {
    return drawModuleEnergon(actor, pay);
  }

  return choice == 'partner' ? choosePartner(actor, item) : null;
}

async function choosePartner(actor, item) {
  const { chooseSelect } = await import("./grants.mjs");
  const candidates = worldActors().filter(a => a.uuid != actor.uuid && ['playerCharacter', 'npc', 'companion'].includes(a.type));
  const picked = await chooseSelect(item.name, T('E20.BondPickPartner'), [
    { value: '__new', label: T('E20.BondNewCompanion') },
    ...candidates.map(a => ({ value: a.uuid, label: a.name })),
  ]);
  if (!picked) {
    return null;
  }

  let partner = picked == '__new' ? null : await fromUuid(picked);
  if (picked == '__new') {
    const { createCompanion } = await import("./companions.mjs");
    partner = await createCompanion(actor, { name: T('E20.BondedAllyName', { name: actor.name }), system: { type: 'human', availability: 'standard' } }, item);
  }

  if (!partner) {
    return null;
  }

  await actor.setFlag('essence20', FLAG, { partner: partner.uuid, linked: true });
  return T('E20.BondMade', { name: actor.name, partner: partner.name });
}

async function pickTargetmasterWeapon(actor, item) {
  const { chooseSelect } = await import("./grants.mjs");
  const weapons = itemsOf(actor).filter(i => i.type == 'weapon');
  const picked = await chooseSelect(item.name, T('E20.TargetmasterPickWeapon'), weapons.map(w => ({ value: w.id, label: w.name })));
  if (!picked) {
    return null;
  }

  await actor.setFlag('essence20', 'targetmasterWeapon', picked);
  return T('E20.TargetmasterWeaponSet', { name: actor.name, weapon: actor.items.get(picked)?.name ?? '' });
}

/* -------------------------------------------- */
/*  Powermaster                                  */
/* -------------------------------------------- */

/**
 * Powermaster: "You may draw upon a secondary, additional pool of 3 Energon Points created by the
 * module per day. If you are hit by Energy or Laser damage, the module regains 1 Energon Point, up to
 * its maximum of 3."
 */
export function moduleEnergon(actor) {
  const value = actor?.flags?.essence20?.powermasterEnergon;
  return value == null ? 3 : Number(value);
}

async function drawModuleEnergon(actor, pay) {
  const left = moduleEnergon(actor);
  if (left <= 0 || !isLinked(actor)) {
    ui.notifications.warn(T('E20.PowermasterEmpty'));
    return null;
  }

  if (!(await pay(null))) {
    return null;
  }

  const energon = actor.system?.energon?.normal ?? {};
  await actor.update({ 'system.energon.normal.value': (Number(energon.value) || 0) + 1, 'flags.essence20.powermasterEnergon': left - 1 });
  return T('E20.PowermasterDrawn', { name: actor.name, left: left - 1 });
}

/** Called by helpers/combat.mjs#applyDamage when an actor is hit. */
export async function onBondedHit(actor, damageType) {
  if (['energy', 'laser'].includes(damageType) && has(actor, BOND.powermaster) && isLinked(actor) && moduleEnergon(actor) < 3) {
    await actor.setFlag('essence20', 'powermasterEnergon', moduleEnergon(actor) + 1);
  }
}

/** A rest refills the module ("per day"). */
export async function restBond(actor) {
  if (actor?.flags?.essence20?.powermasterEnergon != null) {
    await actor.unsetFlag('essence20', 'powermasterEnergon');
  }
}

/* -------------------------------------------- */
/*  Synaptic Linkage                             */
/* -------------------------------------------- */

/**
 * Synaptic Linkage: "once per scene at the beginning of your turn, you can pass one Condition you are
 * suffering from to your bonded being."
 */
async function passCondition(actor, pay) {
  const ally = bondedAlly(actor);
  const { getUses, markUsed } = await import("./scene-clock.mjs");
  if (!ally || getUses(actor, 'synapticPass', 'scene') >= 1) {
    ui.notifications.warn(T(ally ? 'E20.OncePerScene' : 'E20.BondNone'));
    return null;
  }

  const statuses = [...(actor.statuses ?? [])].filter(s => !['defeated', 'dead'].includes(s));
  const { chooseSelect } = await import("./grants.mjs");
  const status = await chooseSelect(T('E20.SynapticLinkage'), T('E20.SynapticPassPrompt'), statuses.map(s => ({
    value: s, label: T(CONFIG.statusEffects?.find?.(e => e.id == s)?.name ?? s),
  })));
  if (!status || !(await pay(null))) {
    return null;
  }

  await actor.toggleStatusEffect(status, { active: false });
  await ally.toggleStatusEffect(status, { active: true });
  await markUsed(actor, 'synapticPass', { window: 'scene' });
  return T('E20.SynapticPassed', { name: actor.name, ally: ally.name, status: T(CONFIG.statusEffects?.find?.(e => e.id == status)?.name ?? status) });
}

/* -------------------------------------------- */
/*  What the bond gives                          */
/* -------------------------------------------- */

/**
 * Health and Defenses the bond adds, applied in documents/actor.mjs with the companion bonuses.
 * @param {Actor} actor
 * @returns {{health: Number, defenses: Object}}
 */
export function bondBonuses(actor) {
  const out = { health: 0, defenses: {} };
  const bond = bondOf(actor);
  if (!bond) {
    return out;
  }

  const holder = bond.holder;
  // Advanced Link / Perfect Link: "your bonded ally gains 2 Essence Increases (along with associated
  // Skills) and +1 Health." The Essence Increases are the partner's to assign.
  if (bond.partner.uuid == actor.uuid) {
    out.health += (has(holder, BOND.advancedLink) ? 1 : 0) + (has(holder, BOND.perfectLink) ? 1 : 0);
  }

  // Armored Connection: "you and your bonded ally gain +2 to your Toughness Defenses while linked".
  if (bond.linked && has(holder, BOND.armoredConnection)) {
    out.defenses.toughness = (out.defenses.toughness ?? 0) + 2;
  }

  return out;
}

function tokenOf(actor) {
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

function distanceBetween(a, b) {
  const ta = tokenOf(a);
  const tb = tokenOf(b);
  if (!ta || !tb || !canvas?.grid) {
    return null;
  }

  return canvas.grid.measurePath([ta.center, tb.center]).distance;
}

function reachOf(actor) {
  return 5 * Math.max(1, tokenOf(actor)?.document?.width ?? 1);
}

/**
 * Roll sources the bond gives - for helpers/target-riders.mjs#rollRiderSources.
 * @param {Actor} actor   The roller.
 * @param {Actor|null} target
 * @param {Object} ctx   {rolledSkill, isAttack, weaponId}
 * @returns {Array<Object>}
 */
export function bondRollSources(actor, target, { rolledSkill, isAttack, weaponId } = {}) {
  const sources = [];
  const add = (id, label, mods) => sources.push({ id, label, shiftUp: mods.shiftUp ?? 0, shiftDown: mods.shiftDown ?? 0, edge: !!mods.edge, snag: false });
  const bond = bondOf(actor);
  const ally = bondedAlly(actor);

  // Headmaster Body: "While in Bot Mode and linked to the being using the Headmaster Rig, you gain ↑1
  // to Skill Tests with Skills that being has at your Skill Rank or higher."
  if (bond?.linked && has(actor, BOND.headmasterBody) && !actor.system?.isTransformed && ally && rolledSkill) {
    const rank = s => CONFIG.E20.skillShiftList.indexOf(s?.system?.skills?.[rolledSkill]?.shift ?? 'd20');
    if (rank(ally) <= rank(actor)) {
      add('headmasterBody', T('E20.HeadmasterBody'), { shiftUp: 1 });
    }
  }

  // Targetmaster: "When using your Targetmaster partner's Special Attack, you always have Edge on the
  // attack Skill Test."
  if (isAttack && bond?.linked && has(actor, BOND.targetmaster) && weaponId && actor.flags?.essence20?.targetmasterWeapon == weaponId) {
    add('targetmaster', T('E20.Targetmaster'), { edge: true });
  }

  if (isAttack && target) {
    // Headmaster Head: "While linked ... [you] can't be targeted directly without the attacker
    // suffering ↓2."
    const targetBond = bondOf(target);
    if (targetBond?.linked && has(target, BOND.headmasterHead) && !bondedAlly(target)?.system?.isTransformed) {
      add('headmasterHead', T('E20.HeadmasterHead'), { shiftDown: 2 });
    }

    // Hit Someone Your Own Size!: "all attacks that target your bonded ally when within your natural
    // Reach suffer a ↓2 penalty."
    const protector = targetBond && (targetBond.partner.uuid == target.uuid ? targetBond.holder : null);
    if (protector && has(protector, BOND.hitSomeoneYourOwnSize) && protector.uuid != actor.uuid) {
      const distance = distanceBetween(protector, target);
      if (distance != null && distance <= reachOf(protector)) {
        add('hitSomeoneYourOwnSize', T('E20.HitSomeoneYourOwnSize'), { shiftDown: 2 });
      }
    }
  }

  return sources;
}

/**
 * Hit Someone Your Own Size!: "when within 5 feet of you, your bonded ally can use your Toughness
 * Defense instead of their own." The better of the two.
 * @returns {Number}   How much to add to the defender's Toughness.
 */
export function bondDefenseAdjust(defender, defense) {
  if (defense != 'toughness') {
    return 0;
  }

  const bond = bondOf(defender);
  if (!bond || bond.partner.uuid != defender.uuid || !has(bond.holder, BOND.hitSomeoneYourOwnSize)) {
    return 0;
  }

  const distance = distanceBetween(bond.holder, defender);
  const mine = Number(defender.system?.defenses?.toughness?.total) || 0;
  const theirs = Number(bond.holder.system?.defenses?.toughness?.total) || 0;
  return distance != null && distance <= 5 && theirs > mine ? theirs - mine : 0;
}

/** Targetmaster: "it deals 1 additional damage of the appropriate type." */
export function bondDamageBonus(actor, weaponId) {
  return isLinked(actor) && has(actor, BOND.targetmaster) && weaponId && actor.flags?.essence20?.targetmasterWeapon == weaponId ? 1 : 0;
}

/**
 * Bonded Proficiency: "you and your bonded ally can use each other's Skill Specializations while
 * linked." A roll in a Skill the ally is Specialized in is Specialized.
 */
export function bondSpecializes(actor, skill) {
  if (!isLinked(actor) || !pairHas(actor, BOND.bondedProficiency)) {
    return false;
  }

  const skillData = bondedAlly(actor)?.system?.skills?.[skill];
  return !!skillData && (skillData.isSpecialized || Object.values(skillData.specializations ?? {}).some(s => s?.name));
}

/**
 * Synaptic Linkage: "Once per scene, you gain Edge on any Skill Test in which both of you have at
 * least a d2 Skill Level." Offered in the Roll Options Dialog.
 */
export function synapticEdgeAvailable(actor, skill) {
  if (!has(actor, BOND.synapticLinkage)) {
    return false;
  }

  const ally = bondedAlly(actor);
  const trained = a => CONFIG.E20.skillShiftList.indexOf(a?.system?.skills?.[skill]?.shift ?? 'd20') <= CONFIG.E20.skillShiftList.indexOf('d2');
  return !!ally && trained(actor) && trained(ally);
}
