import {
  registerChatButton, registerHitRider, registerPreRoll, registerRollSources, registerUse,
} from "../../extensions.mjs";
import { hasSourced } from "../../companion-link.mjs";
import { isRobotic } from "../../creature-tags.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import { CC, T, findSourced, isFrom, itemsOf, parentWeapon, post, sourceOf } from "./shared.mjs";

/**
 * Cobra Codex gear and Perks: Dielectric/Insulator against Electromagnetic attacks, the Deflecting
 * Weapon upgrades, Shield Fighter's Element, Onslaught and the Disenfranchised Hang-Up's Willpower
 * check. (Poison Resistance is its own item rule.)
 */
export const O1_CC = {
  dielectric: CC('A36q5SNroIR8xoyd'),
  insulator: CC('AMIKCJX1DDz1sLVb'),
  limitedDeflecting: CC('KFoF9nEHJrRaJzZA'),
  standardDeflecting: CC('Z1OIoelOdyUdtyl7'),
  shieldFighter: CC('MRbKuQlNI2tOfpLM'),
  onslaught: CC('jtpEn1CAEwCr5J7C'),
  disenfranchised: CC('bLBiNpqobnTDH769'),
  cyberneticPart: CC('wCL3rJOEDZVHVg6g'),
  enhancedPart: CC('eT4g9EfrFtvjMqWu'),
  optimizedPart: CC('zGsTAngJ2HRdKPkz'),
  personalShield: 'Compendium.essence20.gi_joe_crb.Item.84JYgd6kZgY41wge',
  closeCombatBlade: 'Compendium.essence20.gi_joe_crb.Item.8lNIijY5XompKHH7',
  closeCombatBludgeon: 'Compendium.essence20.gi_joe_crb.Item.ZNokHTRBa5aindap',
};

/** An upgrade counts while it is loose on the actor or on something equipped. */
export function isWorn(upgrade) {
  const parentId = upgrade?.flags?.essence20?.parentId;
  return !parentId || !!upgrade.parent?.items?.get?.(parentId)?.system?.equipped;
}

export function wears(actor, uuid) {
  return itemsOf(actor).some(item => item.type == 'upgrade' && sourceOf(item) == uuid && isWorn(item));
}

/* -------------------------------------------- */
/*  Dielectric / Insulator                       */
/* -------------------------------------------- */

/**
 * GI Joe CRB p.207: Electromagnetic effects "are ↑3 against computers, computerized vehicles,
 * characters with computerized equipment, and robots, but ↓3 against all other targets." dice.mjs
 * reads only the Computerized vehicle trait, so a character in computerized gear or with cybernetic
 * parts (or a robot) was getting the ↓3.
 */
export function hasComputerizedGear(actor) {
  if (isRobotic(actor)) {
    return true;
  }

  return itemsOf(actor).some(item => {
    if ([O1_CC.cyberneticPart, O1_CC.enhancedPart, O1_CC.optimizedPart].includes(sourceOf(item))) {
      return true;
    }

    const traits = item.system?.traits ?? [];
    if (!traits.includes?.('computerized')) {
      return false;
    }

    return item.type == 'upgrade' ? isWorn(item) : (item.system?.equipped ?? true);
  });
}

/**
 * The upshift an Electromagnetic attack really gets against this target: 3, or 2 with Insulator
 * ("Electromagnetic attacks gain only ↑2 against you for using computerized equipment, including
 * your cybernetic alterations, rather than the normal ↑3", Cobra Codex p.100) or 1 with Dielectric
 * (p.101, "only ↑1").
 */
export function emUpshiftAgainst(target) {
  if (wears(target, O1_CC.dielectric)) {
    return 1;
  }

  return wears(target, O1_CC.insulator) ? 2 : 3;
}

function isElectromagneticAttack(actor, item) {
  return item?.type == 'weaponEffect'
    && (item.system?.damageType == 'emp' || !!parentWeapon(actor, item)?.system?.traits?.includes?.('electromagnetic'));
}

registerRollSources((actor, target, ctx) => {
  const item = ctx?.item;
  if (!target || !isElectromagneticAttack(actor, item)) {
    return null;
  }

  const label = game.i18n.localize('E20.DamageEmp');
  const sources = [];
  if (!target.system?.traits?.computerized && hasComputerizedGear(target)) {
    // Undo dice.mjs's "all other targets" ↓3, then the real ↑.
    sources.push({ id: 'o1EmNotOther', label: T('O1EmComputerizedGear', { label }), shiftUp: 3 });
    sources.push({ id: 'o1EmVsGear', label: T('O1EmVsGear', { label }), shiftUp: emUpshiftAgainst(target) });
  } else if (target.system?.traits?.computerized && emUpshiftAgainst(target) < 3) {
    sources.push({ id: 'o1EmCoating', label: T('O1EmCoating'), shiftDown: 3 - emUpshiftAgainst(target) });
  }

  return { sources };
});

/* -------------------------------------------- */
/*  Deflecting Weapon                            */
/* -------------------------------------------- */

// Standard/Limited Deflecting Weapon (Cobra Codex, weapon upgrades, p.97): "Choose a Standard
// [Limited] shield (page 98). When wielding a weapon with a... Deflecting Weapon upgrade, the
// weapon counts as both the upgraded weapon and the chosen shield. You cannot attack with the
// weapon when you're actively using it as a shield." The chosen shield is granted as a linked
// shield item that is equipped exactly while the weapon is; attacking with the weapon while that
// shield is raised is refused with a warning.
const DEFLECT = { [O1_CC.standardDeflecting]: 'standard', [O1_CC.limitedDeflecting]: 'limited' };

export function linkedShield(actor, weaponId) {
  return itemsOf(actor).find(item => item.type == 'shield' && item.flags?.essence20?.o1DeflectingWeapon == weaponId) ?? null;
}

async function grantDeflectingShield(upgrade) {
  const actor = upgrade.parent;
  const weapon = actor?.items?.get?.(upgrade.flags?.essence20?.parentId);
  const availability = DEFLECT[sourceOf(upgrade)];
  if (!weapon || !availability || linkedShield(actor, weapon.id)) {
    return null;
  }

  const { findItems, grantCopy, pickOne } = await import("../../grants.mjs");
  const uuid = await pickOne(upgrade.name, await findItems({ type: 'shield', availabilities: [availability] }));
  const source = uuid ? await fromUuid(uuid) : null;
  if (!source) {
    return null;
  }

  return grantCopy(actor, uuid, {
    grantedBy: upgrade,
    name: T('O1DeflectingName', { weapon: weapon.name, shield: source.name }),
    flags: { o1DeflectingWeapon: weapon.id, o1DeflectingUpgrade: upgrade.id },
    system: { equipped: !!weapon.system?.equipped, active: false },
  });
}

Hooks.on('createItem', async (item, options, userId) => {
  if (userId == game.user?.id && item.type == 'upgrade' && DEFLECT[sourceOf(item)] && item.flags?.essence20?.parentId) {
    await grantDeflectingShield(item);
  }
});

registerUse({
  id: 'o1DeflectingWeapon',
  matches: item => !!DEFLECT[sourceOf(item)],
  canUse: item => !!item.flags?.essence20?.parentId && !linkedShield(item.parent, item.flags.essence20.parentId),
  run: async (item) => ((await grantDeflectingShield(item)) ? T('O1DeflectingGranted', { name: item.parent.name }) : null),
});

// The shield is only in hand while the weapon is.
Hooks.on('updateItem', async (item, changes, options, userId) => {
  const equipped = foundry.utils.getProperty(changes, 'system.equipped');
  if (userId != game.user?.id || item.type != 'weapon' || equipped === undefined) {
    return;
  }

  const shield = linkedShield(item.parent, item.id);
  if (!shield || shield.system.equipped == equipped) {
    return;
  }

  if (!equipped && shield.system.active) {
    const update = {};
    for (const defense of Object.keys(CONFIG.E20?.defenses ?? {})) {
      update[`system.defenses.${defense}.shield`] = 0;
    }

    await item.parent.update(update);
  }

  await shield.update({ 'system.equipped': equipped, ...(equipped ? {} : { 'system.active': false }) });
});

Hooks.on('deleteItem', async (item, options, userId) => {
  if (userId != game.user?.id || !item.parent) {
    return;
  }

  const weaponId = item.type == 'weapon' ? item.id : (DEFLECT[sourceOf(item)] ? item.flags?.essence20?.parentId : null);
  const shield = weaponId ? linkedShield(item.parent, weaponId) : null;
  if (shield) {
    await shield.delete();
  }
});

registerPreRoll(async (actor, dataset, item) => {
  const weapon = parentWeapon(actor, item);
  const shield = weapon ? linkedShield(actor, weapon.id) : null;
  if (shield?.system?.active) {
    ui.notifications?.warn?.(T('O1DeflectingRaised', { weapon: weapon.name }));
  }
});

/* -------------------------------------------- */
/*  Shield Fighter                               */
/* -------------------------------------------- */

// Shield Fighter (Cobra Codex, Alley-Viper Focus, p.68): "Your shield also counts as a close combat
// blade and a close combat bludgeon" (the Perk's own item map grants both weapons on the drop).
// "Additionally, as a Free action, you can spend a use of your Personal Shield to give your shield
// an Element trait for 1 minute." The Use button spends the use and records the Element; the
// shield's blade/bludgeon hits then offer the damage as that Element.
const ELEMENT_FLAG = 'o1ShieldElement';

export function shieldElement(actor) {
  const flag = actor?.flags?.essence20?.[ELEMENT_FLAG];
  if (!flag?.type || flag.scene != getSceneEpoch()) {
    return null;
  }

  const combat = game?.combat;
  if (flag.combatId && combat?.id == flag.combatId && combat.round >= flag.round + 10) {
    return null;
  }

  return flag.type;
}

registerUse({
  id: 'o1ShieldFighter',
  matches: isFrom(O1_CC.shieldFighter),
  canUse: item => (findSourced(item.parent, O1_CC.personalShield)?.system?.resource?.value ?? 0) > 0,
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const pool = findSourced(actor, O1_CC.personalShield);
    const { chooseSelect } = await import("../../grants.mjs");
    const types = CONFIG.E20?.elementDamageTypes ?? {};
    const type = await chooseSelect(item.name, T('O1ShieldElementPrompt'),
      Object.entries(types).map(([value, label]) => ({ value, label: game.i18n.localize(label) })));
    if (!type || !(await pay('free'))) {
      return null;
    }

    if (!actor.system?.useUnlimitedResource) {
      await pool.update({ 'system.resource.value': pool.system.resource.value - 1 });
    }

    await actor.setFlag('essence20', ELEMENT_FLAG, {
      type, scene: getSceneEpoch(), combatId: game.combat?.id ?? null, round: game.combat?.round ?? 0,
    });
    return T('O1ShieldElement', { name: actor.name, element: game.i18n.localize(types[type] ?? type) });
  },
});

registerHitRider(async (actor, target, result, rider, tools) => {
  const element = shieldElement(actor);
  if (!element || !hasSourced(actor, O1_CC.shieldFighter)) {
    return;
  }

  const weapon = rider?.weaponId ? actor.items?.get?.(rider.weaponId) : null;
  if (![O1_CC.closeCombatBlade, O1_CC.closeCombatBludgeon].includes(sourceOf(weapon))) {
    return;
  }

  tools.addRiderOption(result, {
    key: 'o1ShieldElement',
    label: T('O1ShieldElementHit'),
    damageValue: Number(result.damageValue) || 0,
    damageType: element,
  });
});

/* -------------------------------------------- */
/*  Onslaught                                    */
/* -------------------------------------------- */

// Onslaught (Cobra Codex, Brute Focus, 6th level, p.69): "when you hit a target with a melee weapon,
// you apply the effects of the attack and one of the attack's alternate effects. If the weapon
// doesn't have a secondary effect, it gains a Maneuver alternate effect." Every other effect of the
// weapon is offered on the hit card as an extra button (pick one); a single-effect weapon offers a
// Maneuver.
export function onslaughtOptions(actor, effect) {
  const weapon = parentWeapon(actor, effect);
  const others = weapon
    ? itemsOf(actor).filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id && item.id != effect?.id)
    : [];
  if (!others.length) {
    return [{ key: 'o1OnslaughtManeuver', label: T('O1OnslaughtManeuver'), damageValue: 1, damageType: 'maneuver' }];
  }

  return others.map(other => ({
    key: `o1Onslaught${other.id}`,
    label: T('O1OnslaughtAlternate', { name: other.name }),
    damageValue: Number(other.system?.damageValue) || 0,
    damageType: other.system?.damageType ?? 'maneuver',
  }));
}

registerHitRider(async (actor, target, result, rider, tools) => {
  if (!hasSourced(actor, O1_CC.onslaught)) {
    return;
  }

  const effect = rider?.itemUuid ? await fromUuid(rider.itemUuid) : null;
  if (effect?.type != 'weaponEffect' || effect.system?.classification?.style != 'melee') {
    return;
  }

  for (const option of onslaughtOptions(actor, effect)) {
    tools.addRiderOption(result, option);
  }
});

/* -------------------------------------------- */
/*  Disenfranchised                              */
/* -------------------------------------------- */

// Disenfranchised (Cobra Codex, Influence Hang-Up, p.30): "If an ally attempts to use an ability for
// your benefit, such as an Officer's Motivate perk, they first have to succeed at a Deception,
// Intimidation, or Persuasion Skill Test targeting your Willpower." Nothing tells the system that an
// ability is "for your benefit", so the Hang-Up's Use button posts the gate: the ally clicks their
// Skill and rolls it against this character's Willpower before applying their help.
registerUse({
  id: 'o1Disenfranchised',
  matches: isFrom(O1_CC.disenfranchised),
  run: async (item) => {
    const actor = item.parent;
    const willpower = Number(actor.system?.defenses?.willpower?.total) || 10;
    const buttons = ['deception', 'intimidation', 'persuasion'].map(skill => `<button type="button" data-e20-ext="o1Disenfranchised" `
      + `data-skill="${skill}" data-dif="${willpower}" data-name="${foundry.utils.escapeHTML?.(actor.name) ?? actor.name}">`
      + `${game.i18n.localize(CONFIG.E20?.skills?.[skill] ?? skill)}</button>`).join('');
    await post(actor, `<p>${T('O1DisenfranchisedGate', { name: actor.name, dif: willpower })}</p>${buttons}`);
    return null;
  },
});

registerChatButton('o1Disenfranchised', async (message, button) => {
  const helper = canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character;
  if (!helper) {
    ui.notifications.warn(T('O1NeedHelper'));
    return;
  }

  const { rollTest } = await import("../../grants.mjs");
  const { success } = await rollTest(helper, button.dataset.skill, Number(button.dataset.dif) || 10);
  await post(helper, T(success ? 'O1DisenfranchisedPass' : 'O1DisenfranchisedFail', { name: helper.name, target: button.dataset.name }));
});
