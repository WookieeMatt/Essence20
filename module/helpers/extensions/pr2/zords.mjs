/**
 * Beneath the Helmet's new Zord Features (p.71-73): Dino Gem Integration, Energem Infusion, Dino
 * Drive Mode and Dedicated Carrier. The two "enhance one ranged energy attack" Features are applied
 * at drop time as a one-off mutation of the chosen weaponEffect - the same idiom
 * sheet-handlers/zord-feature-handler.mjs uses for Enhance (Attack).
 */
import {
  registerDamageModifier, registerRollSources, registerSceneAdvanced, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { worldActors } from "../../companion-link.mjs";
import { activateForWindow, isActiveForWindow } from "../../scene-clock.mjs";
import { hasUsedThisRound, markUsedThisRound } from "../../perks.mjs";
import { getAllNearbyTokens } from "../../allies.mjs";
import { PR2, T, findSourced, holds, isActiveGm, isRangedAttack, itemsOf, parentOf, sourceOf } from "./common.mjs";
import { postLine } from "../zord1/common.mjs";

// Kept local (combat.mjs is heavy): the Element/"Energy" family, as helpers/combat.mjs defines it.
export const ENERGY_TYPES = new Set(['element', 'acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic']);

/* -------------------------------------------- */
/*  Spectrum colour -> attack change             */
/* -------------------------------------------- */

// Both Features: "You may change the energy type dependent on your Ranger's spectrum color: Black:
// Cold / Blue: Energy type, increase range by 50 ft. / Green: Energy type, 1 additional damage /
// Pink: Electric / Red: Fire / Yellow: Sonic / Advanced Spectrum: Any of the above."
export const GEM_COLOURS = {
  black: { damageType: 'cold' },
  blue: { range: 50 },
  green: { damage: 1 },
  pink: { damageType: 'electric' },
  red: { damageType: 'fire' },
  yellow: { damageType: 'sonic' },
};

export const GEM_FLAG = 'pr2GemBoost';

/**
 * The weaponEffect update for a colour (plus Energem Infusion's own flat +1 damage).
 * @returns {Object}
 */
export function gemUpdate(effect, colour, { extraDamage = 0, flag } = {}) {
  const change = GEM_COLOURS[colour] ?? {};
  const update = {};
  const damage = extraDamage + (change.damage ?? 0);
  if (damage) {
    update['system.damageValue'] = (Number(effect.system?.damageValue) || 0) + damage;
  }

  if (change.damageType) {
    update['system.damageType'] = change.damageType;
  }

  if (change.range) {
    update['system.range.value'] = (Number(effect.system?.range?.value) || 0) + change.range;
    update['system.range.long'] = (Number(effect.system?.range?.long) || 0) + change.range;
  }

  if (flag) {
    update[`flags.essence20.${GEM_FLAG}.${flag}`] = colour || true;
  }

  return update;
}

/** The Zord's ranged attacks, energy ones first choice (RAW: "one of the Zord's ranged energy attacks"). */
export function rangedEnergyAttacks(actor) {
  const ranged = itemsOf(actor).filter(isRangedAttack);
  const energy = ranged.filter(effect => ENERGY_TYPES.has(effect.system?.damageType));
  return energy.length ? energy : ranged;
}

async function pickGemAttack(feature, { optional }) {
  const actor = feature.parent;
  const { chooseSelect } = await import("../../grants.mjs");
  const attacks = rangedEnergyAttacks(actor);
  if (!attacks.length) {
    ui.notifications?.warn(T('Pr2GemNoAttack', { name: feature.name }));
    return null;
  }

  const effectId = attacks.length == 1 ? attacks[0].id : await chooseSelect(feature.name, T('Pr2GemPickAttack'),
    attacks.map(effect => ({ value: effect.id, label: parentOf(actor, effect) ? `${parentOf(actor, effect).name} - ${effect.name}` : effect.name })));
  const effect = attacks.find(a => a.id == effectId);
  if (!effect) {
    return null;
  }

  const colours = Object.keys(GEM_COLOURS).map(value => ({ value, label: T(`Pr2GemColour.${value}`) }));
  const colour = await chooseSelect(feature.name, T('Pr2GemPickColour'),
    optional ? [{ value: 'none', label: T('Pr2GemColour.none') }, ...colours] : colours);
  if (!colour) {
    return null;
  }

  return { effect, colour: colour == 'none' ? null : colour };
}

// Dino Gem Integration (p.71): "This integration grants ↑1 Targeting on one of the Zord's ranged
// energy attacks" (+ the colour change). The ↑1 is read at roll time off the flag.
export async function applyDinoGem(feature) {
  const picked = await pickGemAttack(feature, { optional: false });
  if (!picked) {
    return null;
  }

  await picked.effect.update(gemUpdate(picked.effect, picked.colour, { flag: 'dinoGem' }));
  await feature.setFlag('essence20', GEM_FLAG, { effectId: picked.effect.id, colour: picked.colour });
  return picked;
}

// Energem Infusion (p.72): "increasing the damage of one of their ranged energy attacks by +1 and
// optionally may change the energy type of that ranged energy attack dependent on your Ranger's
// spectrum color."
export async function applyEnergem(feature) {
  const picked = await pickGemAttack(feature, { optional: true });
  if (!picked) {
    return null;
  }

  await picked.effect.update(gemUpdate(picked.effect, picked.colour, { extraDamage: 1, flag: 'energem' }));
  await feature.setFlag('essence20', GEM_FLAG, { effectId: picked.effect.id, colour: picked.colour });
  return picked;
}

export function dinoGemSources(actor, target, ctx = {}) {
  const item = ctx.item;
  if (!ctx.isAttack || !item?.flags?.essence20?.[GEM_FLAG]?.dinoGem || !holds(actor, PR2.dinoGemIntegration)) {
    return null;
  }

  return { sources: [{ id: 'pr2-dinoGem', label: findSourced(actor, PR2.dinoGemIntegration)?.name ?? 'Dino Gem Integration', shiftUp: 1 }] };
}

registerRollSources(dinoGemSources);

/* -------------------------------------------- */
/*  Dedicated Carrier                            */
/* -------------------------------------------- */

// Dedicated Carrier (p.73): "The Zord loses the Combiner Zord Feature and instead gains the Carrier
// Zord Feature / +3 to their Armor Plating Bonus / 2 additional health." The plating and Health
// are the Feature's own Active Effect; the swap happens here.
export async function applyDedicatedCarrier(feature) {
  const actor = feature.parent;
  const combiner = itemsOf(actor).filter(i => sourceOf(i) == PR2.combiner);
  if (combiner.length) {
    await actor.deleteEmbeddedDocuments('Item', combiner.map(i => i.id));
  }

  if (!holds(actor, PR2.carrier)) {
    const { grantCopy } = await import("../../grants.mjs");
    await grantCopy(actor, PR2.carrier, { grantedBy: feature });
  }

  await postLine(actor, T('Pr2DedicatedCarrierDone', { name: actor.name }));
}

/* -------------------------------------------- */
/*  Dino Drive Mode                              */
/* -------------------------------------------- */

// Dino Drive Mode (p.72): "Engaging Dino Drive Mode requires a Standard action, imposing a −3
// penalty (minimum 1) to the Speed Essence of their Zord until the start of its next turn. The Zord
// then receives the following benefits for the remainder of the scene: Dino Steel Plating: Increase
// the armor plating by 1. Reflective Armor: Once per round, decrease the damage of a ranged energy
// Attack by d2. Amplified Dino Strength: Gains Edge on energy Attacks when within 30 feet of
// another Zord with the Energem Infusion feature. Speed Surge: Increase one of the Zord's movement
// types by 10 feet."
export const DRIVE_FLAG = 'pr2DinoDrive';
export const DRIVE_EFFECT_FLAG = 'pr2DinoDriveEffect';
export const DRIVE_SLOW_FLAG = 'pr2DinoDriveSlow';
const REFLECT_FLAG = 'pr2DinoDriveReflect';

export const isDinoDriveActive = actor => holds(actor, PR2.dinoDriveMode) && isActiveForWindow(actor, DRIVE_FLAG, 'scene');

/** Speed penalty: −3, but never below 1. */
export const speedPenalty = speed => Math.max(0, Math.min(3, (Number(speed) || 0) - 1));

export async function engageDinoDrive(item, pay) {
  const actor = item.parent;
  const { chooseSelect } = await import("../../grants.mjs");
  const movementTypes = Object.entries(actor.system?.movement ?? {}).filter(([, m]) => (m?.base ?? 0) > 0).map(([key]) => key);
  const movementType = await chooseSelect(item.name, T('Pr2DinoDrivePickMovement'),
    (movementTypes.length ? movementTypes : ['ground']).map(value => ({ value, label: T(`Pr2Movement.${value}`) })));
  if (!movementType) {
    return null;
  }

  if (pay && (await pay('standard')) === false) {
    return null;
  }

  const penalty = speedPenalty(actor.system?.essences?.speed?.value);
  const ADD = globalThis.CONST?.ACTIVE_EFFECT_MODES?.ADD ?? 2;
  const effects = [{
    name: item.name, img: item.img,
    changes: [
      { key: 'system.defenses.toughness.armor', mode: ADD, value: '1' },
      { key: `system.movement.${movementType}.bonus`, mode: ADD, value: '10' },
    ],
    flags: { essence20: { [DRIVE_EFFECT_FLAG]: true } },
  }];
  if (penalty) {
    effects.push({
      name: T('Pr2DinoDriveSlowName'), img: item.img,
      changes: [{ key: 'system.essences.speed.value', mode: ADD, value: String(-penalty) }],
      flags: { essence20: { [DRIVE_EFFECT_FLAG]: true, [DRIVE_SLOW_FLAG]: true } },
    });
  }

  await removeDriveEffects(actor);
  await actor.createEmbeddedDocuments('ActiveEffect', effects);
  await activateForWindow(actor, DRIVE_FLAG, 'scene');
  return T('Pr2DinoDriveEngaged', { name: actor.name, penalty });
}

async function removeDriveEffects(actor, { slowOnly = false } = {}) {
  const effects = (actor?.effects?.contents ?? [...(actor?.effects ?? [])])
    .filter(e => e.flags?.essence20?.[slowOnly ? DRIVE_SLOW_FLAG : DRIVE_EFFECT_FLAG]);
  if (effects.length) {
    await actor.deleteEmbeddedDocuments('ActiveEffect', effects.map(e => e.id));
  }
}

registerUse({
  id: 'pr2DinoDrive',
  matches: item => sourceOf(item) == PR2.dinoDriveMode,
  canUse: item => !isDinoDriveActive(item.parent),
  run: (item, economy, pay) => engageDinoDrive(item, pay),
});

// "Until the start of its next turn."
registerTurnStart(async actor => {
  if (actor) {
    await removeDriveEffects(actor, { slowOnly: true });
  }
});

// "For the remainder of the scene."
registerSceneAdvanced(async () => {
  if (!isActiveGm()) {
    return;
  }

  const actors = new Set(worldActors());
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (token.actor) {
      actors.add(token.actor);
    }
  }

  for (const actor of actors) {
    await removeDriveEffects(actor);
  }
});

// Reflective Armor. applyDamage doesn't say whether the hit was ranged, so every Energy hit counts -
// the Zord only ever spends this once per round.
export async function reflectiveArmor(actor, amount, damageType) {
  if (!(amount > 0) || !ENERGY_TYPES.has(damageType) || !isDinoDriveActive(actor) || hasUsedThisRound(actor, REFLECT_FLAG)) {
    return amount;
  }

  const roll = await new Roll('1d2').evaluate();
  await markUsedThisRound(actor, REFLECT_FLAG);
  await postLine(actor, T('Pr2DinoDriveReflect', { name: actor.name, n: roll.total }));
  return Math.max(0, amount - roll.total);
}

registerDamageModifier(reflectiveArmor);

// Amplified Dino Strength.
export function amplifiedSources(actor, target, ctx = {}) {
  const item = ctx.item;
  if (!ctx.isAttack || !ENERGY_TYPES.has(item?.system?.damageType) || !isDinoDriveActive(actor)) {
    return null;
  }

  const partner = getAllNearbyTokens(actor, 30).some(token => token.actor?.type == 'zord' && token.actor.id != actor.id
    && holds(token.actor, PR2.energemInfusion));
  return partner ? { sources: [{ id: 'pr2-amplifiedDino', label: T('Pr2AmplifiedDino'), edge: true }] } : null;
}

registerRollSources(amplifiedSources);

/* -------------------------------------------- */
/*  Drop hook                                    */
/* -------------------------------------------- */

export async function onZordFeatureCreated(item, options, userId) {
  if (userId != globalThis.game?.user?.id || item?.type != 'feature' || item.parent?.documentName != 'Actor') {
    return;
  }

  const source = sourceOf(item);
  if (source == PR2.dedicatedCarrier) {
    await applyDedicatedCarrier(item);
  } else if (source == PR2.dinoGemIntegration && !item.flags?.essence20?.[GEM_FLAG]) {
    await applyDinoGem(item);
  } else if (source == PR2.energemInfusion && !item.flags?.essence20?.[GEM_FLAG]) {
    await applyEnergem(item);
  }
}

globalThis.Hooks?.on?.('createItem', (...args) => onZordFeatureCreated(...args).catch(error => console.error('Essence20 | pr2', error)));
