import {
  registerApplyDialog, registerConsumer, registerDefenseAdjust, registerDerived, registerDialogToggles, registerHitRider, registerRollSources,
} from "../../extensions.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";
import {
  areAllies, flagOf, gearOfWeapon, held, holds, inAltMode, inBotMode, itemsOf, nameOf, parentWeapon, SCOPE, stampOpen, substitutionShifts, T, TF3,
} from "./common.mjs";

/**
 * Transformers CRB / Transformers One Sourcebook - everything the Roll Options Dialog and derived data
 * need for the tf3 slice: automatic sources (Holographic Doubles, Siren, Martyr, The Right Of
 * All Sentient Beings, Unexpected Alternative, Target Breakdown, Rotor Blades), self-declared toggles
 * (Hindsight, Mimicry Vocoder, Nose for Trouble, Subordinate, Ladder, Tow Cable & Hook, Water Cannon),
 * Stoic's Defenses, and the Alt Mode Gear's movement/reach/hardpoint changes.
 */

export const HOLO_FLAG = 'tf3HoloDoubles';
export const STOIC_FLAG = 'tf3Stoic';
export const MARTYR_FLAG = 'tf3Martyred';
export const RIGHT_OF_ALL_FLAG = 'tf3RightOfAllFallen';
export const UNEXPECTED_FLAG = 'tf3UnexpectedEdge';
export const BREAKDOWN_FLAG = 'tf3TargetBreakdown';
export const LADDER_FLAG = 'tf3LadderOut';

const safeEpoch = () => {
  try {
    return getSceneEpoch();
  } catch {
    return null;
  }
};

const SIZES = ['small', 'common', 'large', 'long', 'huge', 'extended', 'gigantic', 'extended2', 'towering', 'extended3', 'titanic'];

/** Holographic doubles standing around an actor right now (they "last until the end of the scene"). */
export function holoDoubles(actor) {
  const record = flagOf(actor, HOLO_FLAG);
  return record && record.scene === safeEpoch() ? Math.max(0, Number(record.count) || 0) : 0;
}

/** Stoic's Evasion penalty while it lasts (until the start of the holder's next turn). */
export function stoicPenalty(actor) {
  const record = flagOf(actor, STOIC_FLAG);
  return record && game.combat && record.combatId == game.combat.id ? Math.max(0, Math.min(3, Number(record.penalty) || 0)) : 0;
}

/** A generated Alt Mode Gear weapon (Rotor Blades, Tow Cable, Water Cannon) - its gear's uuid. */
function gearKind(actor, effect) {
  const weapon = parentWeapon(actor, effect);
  return weapon ? gearOfWeaponUuid(actor, weapon) : null;
}

function gearOfWeaponUuid(actor, weapon) {
  const gear = gearOfWeapon(actor, weapon);
  const uuid = gear?.flags?.core?.sourceId ?? gear?._stats?.compendiumSource ?? null;
  return [TF3.rotorBlades, TF3.towCable, TF3.waterCannon].includes(uuid) ? uuid : null;
}

/** Actors on the same side who died a Martyr's death in this combat. */
function martyrs(actor) {
  const combat = game.combat;
  if (!combat) {
    return [];
  }

  const actors = (combat.combatants?.contents ?? [...(combat.combatants ?? [])]).map(c => c.actor).filter(Boolean);
  return actors.filter(other => flagOf(other, MARTYR_FLAG) == combat.id && holds(other, TF3.martyr) && areAllies(other, actor));
}

function trainedWith(actor, type) {
  return !!(actor?.system?.trained?.weapons?.[type] || actor?.system?.qualified?.weapons?.[type]);
}

/* -------------------------------------------- */
/*  Automatic sources                            */
/* -------------------------------------------- */

export function tf3RollSources(actor, target, ctx = {}) {
  const { item, rolledSkill, isAttack } = ctx;
  const sources = [];
  const consumes = [];

  // Holographic Doubles (TF CRB, Infiltrator, 10th level, p.61): "Attacks that target you suffer ↓1
  // for each Holographic double."
  const doubles = target ? holoDoubles(target) : 0;
  if (isAttack && doubles) {
    sources.push({ id: 'tf3Holo', label: nameOf(target, TF3.holographicDoubles, 'Holographic Doubles'), shiftDown: doubles });
  }

  // Siren (TF CRB p.135): "Bot Mode: You gain ↑2 on Intimidation Skill Tests."
  if (rolledSkill == 'intimidation' && holds(actor, TF3.siren) && actor.system?.canTransform && inBotMode(actor)) {
    sources.push({ id: 'tf3Siren', label: nameOf(actor, TF3.siren), shiftUp: 2 });
  }

  // Martyr (Commander, 20th level, p.66): "if you are Defeated in combat, your allies gain an Edge on
  // Skill Tests for the rest of this combat."
  const fallen = martyrs(actor)[0];
  if (fallen) {
    sources.push({ id: 'tf3Martyr', label: T('Tf3MartyrSource', { perk: nameOf(fallen, TF3.martyr), name: fallen.name }), edge: true });
  }

  // The Right Of All Sentient Beings (Commander, 10th level, p.66): "If they are Defeated during the
  // Combat, you gain an Edge on Skill Tests for the rest of Combat."
  if (game.combat && flagOf(actor, RIGHT_OF_ALL_FLAG) == game.combat.id && holds(actor, TF3.rightOfAll)) {
    sources.push({ id: 'tf3RightOfAll', label: nameOf(actor, TF3.rightOfAll), edge: true });
  }

  // Unexpected Alternative (Triple Changer, 3rd level, p.76): "you gain an Edge on Skill Tests
  // targeting them until the end of your next turn."
  const unexpected = flagOf(actor, UNEXPECTED_FLAG);
  if (target?.uuid && unexpected?.targets?.includes(target.uuid) && stampOpen(unexpected.stamp, safeEpoch())) {
    sources.push({ id: 'tf3Unexpected', label: nameOf(actor, TF3.unexpectedAlternative, 'Unexpected Alternative'), edge: true });
  }

  // Target Breakdown (Analyst, 13th level, p.60), banked on this attacker by the Analyst: "↑ on an
  // attack against that target equal to that number".
  const banked = (flagOf(actor, BREAKDOWN_FLAG) ?? []).find(entry => entry?.targetUuid && entry.targetUuid == target?.uuid);
  if (isAttack && banked) {
    sources.push({ id: 'tf3Breakdown', label: T('Tf3BreakdownSource', { name: banked.by ?? '' }), shiftUp: Number(banked.shiftUp) || 0 });
    consumes.push({ ext: 'tf3TargetBreakdown', actorUuid: actor.uuid, targetUuid: target.uuid });
  }

  // Rotor Blades (TF CRB p.135), Bot Mode: "If you are Trained to use a Close Combat Heavy Blade, you
  // gain ↑1 on Finesse or Might Skill Tests to attack with your Rotor Blades."
  if (isAttack && ['finesse', 'might'].includes(rolledSkill) && gearKind(actor, item) == TF3.rotorBlades
    && trainedWith(actor, 'closeCombatHeavyBlade')) {
    sources.push({ id: 'tf3RotorTrained', label: nameOf(actor, TF3.rotorBlades), shiftUp: 1 });
  }

  return { sources, consumes };
}

/** Target Breakdown's bank is spent by the attack that used it. */
export async function consumeBreakdown(consume) {
  const actor = consume?.actorUuid ? await fromUuid(consume.actorUuid) : null;
  if (!actor) {
    return;
  }

  const left = (flagOf(actor, BREAKDOWN_FLAG) ?? []).filter(entry => entry?.targetUuid != consume.targetUuid);
  await actor.setFlag(SCOPE, BREAKDOWN_FLAG, left);
}

/* -------------------------------------------- */
/*  Self-declared toggles                        */
/* -------------------------------------------- */

/** A world actor on the same side with its Ladder out, in Alt Mode, no smaller than the climber. */
export function ladderFor(actor) {
  const size = SIZES.indexOf(actor?.system?.size ?? 'common');
  return worldActors().find(other => other !== actor && holds(other, TF3.ladder) && inAltMode(other)
    && flagOf(other, LADDER_FLAG)?.scene === safeEpoch() && areAllies(other, actor)
    && (size < 0 || SIZES.indexOf(other.system?.size ?? 'common') < 0 || size <= SIZES.indexOf(other.system?.size ?? 'common'))) ?? null;
}

export function tf3Toggles(actor, { item, rolledSkill } = {}) {
  const toggles = [];
  const add = (name, label) => toggles.push({ name, label, type: 'checkbox' });

  // Hindsight (Scout, 7th level, p.85): "when discussing a previous scene, you can make new Alertness
  // Skill Tests about it as though you were still there. You gain an Edge on these Skill Tests."
  if (rolledSkill == 'alertness' && holds(actor, TF3.hindsight)) {
    add('tf3Hindsight', T('Tf3ToggleHindsight', { perk: nameOf(actor, TF3.hindsight) }));
  }

  // Mimicry Vocoder (Scout, 9th level, p.85): "You gain an Edge on Deception Skill Tests to convince
  // creatures more familiar with the individual you're imitating."
  if (rolledSkill == 'deception' && holds(actor, TF3.mimicryVocoder)) {
    add('tf3Mimicry', T('Tf3ToggleMimicry', { perk: nameOf(actor, TF3.mimicryVocoder) }));
  }

  // Nose for Trouble (General Perk, p.110): "You can use Streetwise in place of Alertness to search for
  // clues or looking for traps; You gain an Edge when setting or disarming traps".
  if (holds(actor, TF3.noseForTrouble)) {
    if (rolledSkill == 'alertness') {
      add('tf3NoseSearch', T('Tf3ToggleNoseSearch', { perk: nameOf(actor, TF3.noseForTrouble) }));
    }

    add('tf3NoseTrap', T('Tf3ToggleNoseTrap', { perk: nameOf(actor, TF3.noseForTrouble) }));
  }

  // Subordinate (Hang-Up, p.43): "Take a ↓1 on any Skill Test that is not directly related to your
  // mission as stated."
  if (holds(actor, TF3.subordinate)) {
    add('tf3Subordinate', T('Tf3ToggleSubordinate', { name: nameOf(actor, TF3.subordinate) }));
  }

  // The Right Of All Sentient Beings: "if the safety of a non-combatant is threatened during a Combat,
  // you gain an Edge on Skill Tests to protect them until they are out of harm's way."
  if (game.combat && holds(actor, TF3.rightOfAll) && flagOf(actor, RIGHT_OF_ALL_FLAG) != game.combat.id) {
    add('tf3Protect', T('Tf3ToggleProtect', { perk: nameOf(actor, TF3.rightOfAll) }));
  }

  // Ladder (TF CRB p.134), Alt Mode: "Allies of your Size Class or smaller using your ladder gain ↑2
  // on Athletics and Acrobatics Skill Tests."
  const ladder = ['athletics', 'acrobatics'].includes(rolledSkill) ? ladderFor(actor) : null;
  if (ladder) {
    add('tf3Ladder', T('Tf3ToggleLadder', { name: ladder.name }));
  }

  // Tow Cable & Hook (TF CRB p.135). Bot Mode: "If you are Trained to use a Grappler, you gain ↑1 on
  // Finesse or Might Skill Tests to attack with your Tow Cable." Alt Mode: "You gain an Edge on Brawn
  // Skill Tests to pull anything attached to your Tow Cable."
  if (holds(actor, TF3.towCable)) {
    if (gearKind(actor, item) == TF3.towCable && ['finesse', 'might'].includes(rolledSkill)) {
      add('tf3TowTrained', T('Tf3ToggleTowTrained', { gear: nameOf(actor, TF3.towCable) }));
    }

    if (rolledSkill == 'brawn' && inAltMode(actor)) {
      add('tf3TowPull', T('Tf3ToggleTowPull', { gear: nameOf(actor, TF3.towCable) }));
    }
  }

  // Water Cannon (TF CRB p.135), Alt Mode: "You can use Targeting to put out fires, and you gain an Edge
  // on Skill Tests involving fire."
  if (holds(actor, TF3.waterCannon) && inAltMode(actor)) {
    add('tf3WaterFire', T('Tf3ToggleWaterFire', { gear: nameOf(actor, TF3.waterCannon) }));
  }

  return toggles;
}

export async function tf3ApplyDialog(actor, options) {
  const ext = options.ext ?? {};
  const edge = () => (options.snag ? (options.snag = false) : (options.edge = true));
  options.shiftUp = options.shiftUp ?? 0;
  options.shiftDown = options.shiftDown ?? 0;

  for (const key of ['tf3Hindsight', 'tf3Mimicry', 'tf3NoseTrap', 'tf3Protect', 'tf3TowPull', 'tf3WaterFire']) {
    if (ext[key]) {
      edge();
    }
  }

  if (ext.tf3Subordinate) {
    options.shiftDown += 1;
  }

  if (ext.tf3Ladder) {
    options.shiftUp += 2;
  }

  if (ext.tf3TowTrained) {
    options.shiftUp += 1;
  }

  // Streetwise's die in place of Alertness's - the same shift-position delta Worth A Shot uses.
  if (ext.tf3NoseSearch) {
    const { shiftUp, shiftDown } = substitutionShifts(actor, 'alertness', 'streetwise');
    options.shiftUp += shiftUp;
    options.shiftDown += shiftDown;
  }
}

/* -------------------------------------------- */
/*  Defenses and derived data                    */
/* -------------------------------------------- */

/**
 * Stoic (Commander, 7th level, p.65): "You take a penalty to Evasion up to -3 and can't defend with
 * Toughness until the beginning of your next turn." An attack against the Stoic's Toughness is met
 * with their (lowered) Evasion instead.
 */
export function stoicDefense(attacker, defender, defenseType) {
  if (defenseType != 'toughness' || !stoicPenalty(defender)) {
    return 0;
  }

  const total = d => Number(defender.system?.defenses?.[d]?.total ?? 0) || 0;
  return total('evasion') - total('toughness');
}

function addToDefense(system, type, amount, label) {
  const defense = system?.defenses?.[type];
  if (!defense || !amount) {
    return;
  }

  defense.total = (Number(defense.total) || 0) + amount;
  if (typeof defense.string == 'string') {
    defense.string += ` ${amount < 0 ? '-' : '+'} ${Math.abs(amount)} (${label})`;
  }
}

export function tf3Derived(actor) {
  const system = actor?.system;
  if (!system) {
    return;
  }

  // Stoic's Evasion penalty.
  const penalty = stoicPenalty(actor);
  if (penalty) {
    addToDefense(system, 'evasion', -penalty, nameOf(actor, TF3.stoic, 'Stoic'));
  }

  // Rotor Blades, Alt Mode: "You gain an Aerial Movement equal to half your Ground Movement."
  if (holds(actor, TF3.rotorBlades) && system.canTransform && inAltMode(actor) && system.movement?.aerial && system.movement?.ground) {
    const half = Math.floor((Number(system.movement.ground.total) || 0) / 2);
    system.movement.aerial.total = Math.max(Number(system.movement.aerial.total) || 0, half);
  }

  // Ladder, Bot Mode: "The Reach of your Unarmed Combat increases to Reach ×2."
  if (holds(actor, TF3.ladder) && system.canTransform && inBotMode(actor)) {
    const reach = CONFIG.E20?.actorReach?.[system.size] ?? 5;
    for (const effect of itemsOf(actor)) {
      if (effect.type == 'weaponEffect' && !flagOf(effect, 'parentId') && effect.system?.classification?.style == 'melee') {
        effect.system.totalReach = Math.max(Number(effect.system.totalReach) || 0, reach * 2);
      }
    }
  }

  // Water Cannon, Bot Mode: "only requires one hardpoint to operate (instead of 2)".
  const waterCannon = held(actor, TF3.waterCannon);
  if (waterCannon && system.hardpoints) {
    for (const weapon of itemsOf(actor)) {
      if (weapon.type != 'weapon' || !weapon.system?.equipped || flagOf(weapon, 'grantedBy') != waterCannon.id) {
        continue;
      }

      const type = weapon.system.hardpoint?.type ?? 'external';
      const slot = system.hardpoints[type];
      const extra = Math.max(1, Number(weapon.system.derivedHands ?? weapon.system.hands ?? 1) || 1) - 1;
      if (slot && extra > 0) {
        slot.used = Math.max(0, (Number(slot.used) || 0) - extra);
        slot.over = slot.used > (Number(slot.max) || 0);
      }
    }
  }
}

/* -------------------------------------------- */
/*  Hits                                         */
/* -------------------------------------------- */

const NOT_ORGANIC = ['robot', 'mechanical', 'vehicle', 'structure', 'object', 'cybertronian', 'drone', 'zord'];

/** Organic lifeform: no robot/vehicle/structure tag (helpers/creature-tags.mjs). */
export async function isOrganic(target) {
  const { creatureTagsOf } = await import("../../creature-tags.mjs");
  const tags = creatureTagsOf(target);
  return !NOT_ORGANIC.some(tag => tags.has(tag)) && !target?.system?.canTransform;
}

/** Rotor Blades, Bot Mode: "against organic targets, you deal +1 Damage." */
export async function rotorHit(actor, target, result, rider, tools) {
  const weapon = rider?.weaponId ? itemsOf(actor).find(item => item.id == rider.weaponId) : null;
  if (!weapon || gearOfWeaponUuid(actor, weapon) != TF3.rotorBlades || !target || !(await isOrganic(target))) {
    return;
  }

  tools?.damageBonusNote?.(result, 1, nameOf(actor, TF3.rotorBlades));
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(tf3RollSources);
registerConsumer('tf3TargetBreakdown', consumeBreakdown);
registerDialogToggles(tf3Toggles);
registerApplyDialog(tf3ApplyDialog);
registerDefenseAdjust(stoicDefense);
registerDerived(tf3Derived);
registerHitRider(rotorHit);
