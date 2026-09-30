import { registerDerived, registerPostRoll, registerPreRoll } from "../../extensions.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import { D21, T, escape, postLine, sourceOf, writeDoc } from "./common.mjs";

/**
 * Weapon rules for the data21 slice:
 * - "Finesse or Might" weapons (Iron Claw / Hobnailed Boot, Intercontinental Adventures p.29:
 *   "Classification: Finesse or Might integrated melee"; Beneath the Helmet's basic Melee Weapon,
 *   p.66; Finster's Psycho Blade and Psycho Staff, Table 5-8 p.302) - the attack rolls whichever of
 *   the two Skills the attacker is better at.
 * - The Psycho Weapons' Alternate Effects (Finster's Monster-Matic Cookbook, Table 5-8, p.303):
 *   Axe/Blade "Shove 10ft away (↓)", Sword "Halve Movement values (round up) of target until end of
 *   their next turn", Trident "Disarm target of 1 wielded weapon (↓)". (The Staff's "Trip" rides on
 *   data1's generic onHitStatus flag; the Slinger's Impaired is the Impaired damage type.)
 */

const cb = (pack, ids) => ids.map(id => `Compendium.essence20.${pack}.Item.${id}`);

// The core-book melee weapons printed "Finesse or Might" (GI Joe CRB Table 8-3; TF CRB weapon
// entries: Unarmed Combat, Short/Medium/Long Blade, Close Combat Blade and Heavy Blade, Short/Long
// and Close Combat (Heavy) Bludgeon, Energized Close Combat Weapon). The Transformers and Power
// Rangers packs reuse the G.I. Joe effect Items, so these ids cover every printing.
const CORE_BOOK_MELEE_EFFECTS = [
  ...cb('gi_joe_crb', [
    'eDjovjfygGq8dlQy', 'gA0rOFD3lmwzkZq4', 'BSh9BDy2b17XOzYm', // Unarmed Combat
    'hb5fKPK5GNTSlKvY', // Close Combat Blade
    'Ty7ZBubtYM7BIwbT', '2X1w4UM04U6LliE0', // Close Combat Bludgeon
    'SP4uvhATIJanJQQE', 'eJVQOt1PPGCzePPP', // Close Combat Heavy Blade
    'RwpDWPgoIEejm7Fz', 'mCD4bCkChXbq6NzO', // Energized Close Combat Weapon
    'O6FfE5SvgKn7M2ej', // Short Blade
    '7ah23fiimnJq6HIL', 'rMg6ZhYEEHTeZ8Db', // Short Bludgeon
    'pbfLfPqG58y5bu7z', 'qJ2FDEwfZF9R8fQX', // Medium Blade
    '2IRZcCJbUGFuEYMk', 'uYAnV5vfucrRlJlr', // Long Blade
    'Jt5FmeFqopWQkHbb', '91alKZovkgruZU9i', // Long Bludgeon
  ]),
  ...cb('tf_crb', [
    'YODFm2APSGLPdnw0', 'JWm06vX4u4QSDf4D', 'SdBelSCDxdO7XM0j', 'LxYWKuuMrjNjzfkS', '4rgKqfYX9WXvJEX2',
    '4LCgqoy5wE2yHWdx', 'pLatOjUTLhYOup6N', 'm2Wl4D5TxL8vD3BO',
  ]),
  ...cb('pr_crb', ['lX2ckG2qnzekOFXE']),
];

// Welcome to Night Vale Citizens' Guide melee weapons printed "Finesse or Might" (Chapter Three):
// Baseball Bat, Dagger, Fangs, Fire Axe, Fire Extinguisher, Stapler, Unarmed Strike.
const WTNV_MELEE_EFFECTS = cb('wtnv_citizens_guide', [
  'UiASUn7CGDbl0WU3', 'howOD7H4ZmRorW3Z', 'HblDM0jUqE2hBWew', // Baseball Bat
  'fqUy6h0IfAVddBSo', 'EmmWL7UOIKZC9VXn', // Dagger
  'qJqt4NXBSE4bPkQ9', 'NAY1u15P5iIBzuzB', // Fangs
  'Y8GWAUgEnbE0D8dW', '33fNOXpXecDKGP3F', 'QxfydUTy5uSqkSPi', // Fire Axe
  '76HrWvYvaCos5XEM', 'k10zy7W2VPDGzDwo', // Fire Extinguisher
  'VmOUrUrFtMHkAEBr', 'Dy6jy1SL7s5dFqLR', 'oz8pPCrRn018FUkg', // Stapler
  'YNf3WpouTPTQ3HO2', 'Hjszzpi43KrSXRlM', '6hYof6SviGFda7RJ', // Unarmed Strike
]);

// Transformers One Sourcebook tools printed "Finesse or Might" (p.19): Reticulated Sprotchet and
// Turbo-Pliers (main effect and both alternates). Decepticon Directive's Antimatter Close Combat
// Weapon (p.72) is printed "Finesse or Might" too.
const TF_EXTRA_MELEE_EFFECTS = [
  ...cb('transformers_one_sourcebook', ['jNjDCZ972iAt9N8Z', 'FtKYfRmtLtRynYo9', 'bZzV5pWZ7s8hXLbC', 'S2VhBxz48sjDasDZ']),
  ...cb('decepticon_directive', ['D21ckSdkrSJQHu0U', 'k0lZatEqcocJihVz', 'pEQJrNkjutaASGNh']),
];

export const FINESSE_OR_MIGHT = new Set([
  ...D21.hobnailedBootEffects, ...D21.ironClawEffects, ...D21.meleeWeaponEffects,
  ...D21.psychoBladeEffects, ...D21.psychoStaffEffects, ...CORE_BOOK_MELEE_EFFECTS, ...WTNV_MELEE_EFFECTS,
  ...TF_EXTRA_MELEE_EFFECTS,
]);

const PAIR = ['finesse', 'might'];

/** Lower index in skillShiftList = better. */
function shiftRank(actor, skill) {
  const list = CONFIG.E20?.skillShiftList ?? [];
  const index = list.indexOf(actor?.system?.skills?.[skill]?.shift);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

/**
 * Pick the better of Finesse/Might for a "Finesse or Might" weapon. Mutates dataset.
 * @returns {String|null}   The Skill it switched to, if any.
 */
export function finesseOrMight(actor, dataset, item) {
  if (!dataset || !FINESSE_OR_MIGHT.has(sourceOf(item)) || !PAIR.includes(dataset.skill)) {
    return null;
  }

  const other = PAIR.find(skill => skill != dataset.skill);
  if (shiftRank(actor, other) >= shiftRank(actor, dataset.skill)) {
    return null;
  }

  dataset.skill = other;
  dataset.essence = CONFIG.E20?.skillToEssence?.[other] ?? dataset.essence;
  if (dataset.shift) {
    dataset.shift = actor.system.skills[other].shift;
  }

  return other;
}

registerPreRoll(async (actor, dataset, item) => {
  finesseOrMight(actor, dataset, item);
});

/* -------------------------------------------- */
/*  Psycho Weapon Alternate Effects              */
/* -------------------------------------------- */

export const HALVE_KIND = 'd21HalveMovement';

/** Which alternate-effect rider an effect item carries, from its pack flags. */
export function psychoRiderOf(item) {
  const flags = item?.flags?.essence20 ?? {};
  if (flags.d21Shove) {
    return { kind: 'shove', feet: Number(flags.d21Shove) || 10 };
  }

  if (flags.d21HalveMovement) {
    return { kind: 'halve' };
  }

  if (flags.d21Disarm) {
    return { kind: 'disarm' };
  }

  return null;
}

export async function psychoAlternatePostRoll(actor, results, checkContext, { hits, rider } = {}) {
  if (!rider?.itemUuid || !hits?.some(h => h.hit)) {
    return;
  }

  const item = await fromUuid(rider.itemUuid);
  const spec = psychoRiderOf(item);
  if (!spec) {
    return;
  }

  for (const { target, hit } of hits) {
    if (!hit || !target) {
      continue;
    }

    if (spec.kind == 'shove') {
      const { pushActor } = await import("../../forced-movement.mjs");
      const moved = await pushActor(target, actor, spec.feet);
      await postLine(actor, T(moved ? 'D21Shoved' : 'D21ShoveBlocked', { name: escape(target.name), feet: spec.feet }));
    } else if (spec.kind == 'halve') {
      const { untilEndOfNextTurn } = await import("../../target-riders.mjs");
      const marks = (target.flags?.essence20?.riderMarks ?? []).filter(mark => !(mark.kind == HALVE_KIND && mark.by == actor.uuid));
      const mark = { kind: HALVE_KIND, by: actor.uuid, label: item.name, sceneEpoch: getSceneEpoch(), ...untilEndOfNextTurn(target) };
      await writeDoc(target, 'setFlag', ['essence20', 'riderMarks', [...marks, mark]]);
      await postLine(actor, T('D21MovementHalved', { name: escape(target.name) }));
    } else if (spec.kind == 'disarm') {
      const { disarm } = await import("../../target-riders.mjs");
      await disarm(actor, target, { maxHands: 2, source: item.name });
    }
  }
}

registerPostRoll(psychoAlternatePostRoll);

/**
 * "Halve Movement values (round up) of target until end of their next turn" - read off the live
 * mark (target-riders.mjs's riderMarks, same expiry rules).
 */
export function halveMovementDerived(actor) {
  const marks = actor?.flags?.essence20?.riderMarks;
  if (!Array.isArray(marks) || !marks.some(mark => mark?.kind == HALVE_KIND && isLive(mark))) {
    return;
  }

  for (const movement of Object.values(actor.system?.movement ?? {})) {
    if (movement && Number.isFinite(movement.total)) {
      movement.total = Math.ceil(movement.total / 2);
    }
  }
}

function isLive(mark) {
  const combat = game?.combat;
  if (mark.combatId && (!combat || combat.id != mark.combatId)) {
    return false;
  }

  if (mark.sceneEpoch != null && mark.sceneEpoch != getSceneEpoch()) {
    return false;
  }

  if (mark.untilRound != null && combat
    && (combat.round > mark.untilRound || (combat.round == mark.untilRound && combat.turn > mark.untilTurn))) {
    return false;
  }

  return true;
}

registerDerived(halveMovementDerived);
