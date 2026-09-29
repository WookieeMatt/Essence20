import { registerApplyDialog, registerConsumer, registerRollSources, registerTurnStart, registerUse } from "../../extensions.mjs";
import { actorHasPerk, getUsesThisScene, hasUsedThisRound, hasUsedThisTurn, markUsedThisRound, markUsedThisScene, markUsedThisTurn } from "../../perks.mjs";
import { getUses, markUsed } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";
import {
  areAllies, arm, bestDefense, choose, damageButton, defenseOf, disarm, distanceBetween, esc, gmDo, holdersOf, holds, isArmed, itemsOf,
  convertRows, lateSnag, negateHit, payPower, registerReaction, rollSkillDie, rollVs, say, SCOPE, skillLabel, sourceOf, targetActor,
} from "./core.mjs";
import { announceBroken } from "./triggers.mjs";

/**
 * Card reactions - buttons on a posted attack/check card for whoever may answer it. Each block
 * quotes its rule. The engine (who sees a button, remembering it was used, turning a hit into "no
 * effect") is ./core.mjs.
 */

const QGTG = "Compendium.essence20.quartermasters_guide_to_gear.Item.";
export const REACT = {
  desperateParry: `${QGTG}ljlMd2MmeF9LEBbz`,
  pointDefense: `${QGTG}QmOeCUODYACCKiWG`,
  advancedAntiAir: `${QGTG}YDv7PPjj6qgqKI9e`,
  legendaryCruelty: "Compendium.essence20.cobra_codex.Item.Lcs6Pz0I0I7QJday",
  projectileDeflector: "Compendium.essence20.intercontinental_adventures.Item.2eWBm6hbiifmySvX",
  steadyFooting: "Compendium.essence20.intercontinental_adventures.Item.U4bVJU5BpT3BTfSx",
  notPerfect: "Compendium.essence20.sgt_slaughter_sourcebook.Item.VtsUIbJm3HfFn12M",
  thatsRight: "Compendium.essence20.sgt_slaughter_sourcebook.Item.dAoJG7ZwVEhOQZY0",
  sidestep: "Compendium.essence20.pr_crb.Item.YhdTm7qhaPCoiDab",
  defender: "Compendium.essence20.pr_crb.Item.4kt5qBpgTEgY8cGF",
  megaformDefender: "Compendium.essence20.across_the_stars.Item.yx7xdDN9HGoYLQ5n",
  tfNotOnMyWatch: "Compendium.essence20.tf_crb.Item.cvgYI2FTjeIrUcLK",
  shootOut: "Compendium.essence20.tf_crb.Item.GiTU07xFJACmUYt2",
  soldierOn: "Compendium.essence20.tf_crb.Item.0fal8jy083wWSy7W",
  ddCounterstrike: "Compendium.essence20.decepticon_directive.Item.PdmiiOmBYzNfXTeh",
};

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));
const nameOf = (actor, uuid, fallback) => itemsOf(actor).find(item => sourceOf(item) == uuid)?.name ?? fallback;

function targetSync(row) {
  return row?.targetUuid ? fromUuidSync?.(row.targetUuid) ?? null : null;
}

/** Row target is the holder of uuid - the reactor is the one being attacked. */
function selfHolder(row, uuid) {
  const target = targetSync(row);
  return target && holds(target, uuid) ? [target] : [];
}

function weaponEffects(actor) {
  return itemsOf(actor).filter(item => item.type == 'weaponEffect');
}

function parentOf(actor, effect) {
  const id = effect?.flags?.essence20?.parentId;
  return id ? itemsOf(actor).find(item => item.id == id) ?? null : null;
}

/** An equipped weapon's effect using this skill (or any unarmed effect when unarmedOk). */
function wieldedEffect(actor, predicate) {
  return weaponEffects(actor).find(effect => {
    const weapon = parentOf(actor, effect);
    return weapon && weapon.system?.equipped !== false && predicate(effect, weapon);
  }) ?? null;
}

/* -------------------------------------------- */
/*  Contingencies                                */
/* -------------------------------------------- */

// Desperate Parry / Point-Defense Reflexes (Quartermaster's Guide p.28/30): "Once per turn as a Free
// action, you can set a special Contingency action..." - a Use button on the Perk sets it; it holds
// until the start of your next turn (turnStart below), and the card button only appears while set.
for (const [key, uuid] of [['desperateParry', REACT.desperateParry], ['pointDefense', REACT.pointDefense]]) {
  registerUse({
    id: `react-arm-${key}`,
    matches: item => sourceOf(item) == uuid,
    canUse: item => !hasUsedThisTurn(item.parent, `react-arm-${key}`),
    run: async (item, economy, pay) => {
      if (!(await pay('free'))) {
        return null;
      }

      await arm(item.parent, key);
      await markUsedThisTurn(item.parent, `react-arm-${key}`);
      return T('ReactContingencySet', { name: item.parent.name, perk: item.name });
    },
  });
}

registerTurnStart(async actor => {
  await disarm(actor);
});

// Desperate Parry: "if a melee attack targeting you would hit, make an Acrobatics or Finesse Skill
// Test against a DIF equal to the incoming attack's Skill Test result. On a success, the incoming
// attack has no effect, and your weapon breaks."
registerReaction({
  id: 'desperateParry',
  reactors: (info, row) => (info.isMelee && row.success
    ? selfHolder(row, REACT.desperateParry).filter(actor => isArmed(actor, 'desperateParry') && wieldedEffect(actor, () => true))
    : []),
  label: actor => nameOf(actor, REACT.desperateParry, 'Desperate Parry'),
  run: async (actor, info, row) => {
    const skill = await choose(T('ReactDesperateParry'), T('ReactPickSkill'), ['acrobatics', 'finesse'].map(s => [s, skillLabel(s)]));
    if (!skill) {
      return false;
    }

    await disarm(actor, 'desperateParry');
    const { success, cancelled } = await rollVs(actor, skill, info.total);
    if (cancelled) {
      return false;
    }

    if (success) {
      const weapon = parentOf(actor, wieldedEffect(actor, () => true));
      await negateHit(info.message, row.targetUuid, T('ReactParried', { name: actor.name, weapon: weapon?.name ?? '' }), actor);
      if (weapon) {
        await weapon.update({ 'system.equipped': false, 'flags.essence20.broken': true });
        await announceBroken(actor, weapon.name);
      }
    }

    return true;
  },
});

// Point-Defense Reflexes: "When an explosive or thrown weapon comes within the normal range of a
// weapon you wield, make a Targeting Skill Test against a DIF equal to the incoming attack's Skill
// Test result. If you want to attack the incoming weapon closer than the normal range of your
// weapon, you suffer Snag... On a success, the incoming weapon is destroyed, missing its original
// target. If the weapon was an explosive, measure its blast radius from the point at which it was
// destroyed." Advanced Anti-Air Training (p.28): "you no longer suffer any penalties when using the
// Point-Defense Reflexes General Perk."
registerReaction({
  id: 'pointDefense',
  scope: 'card',
  reactors: info => {
    if (!info.isAttack || !(info.style == 'explosive' || info.traits.includes('thrown')) || !info.rows.some(r => r.targetUuid)) {
      return [];
    }

    return holdersOf(REACT.pointDefense).filter(actor => actor !== info.attacker && isArmed(actor, 'pointDefense')
      && wieldedEffect(actor, effect => effect.system?.classification?.skill == 'targeting'));
  },
  label: actor => nameOf(actor, REACT.pointDefense, 'Point-Defense Reflexes'),
  run: async (actor, info) => {
    let snag = false;
    if (!actorHasPerk(actor, REACT.advancedAntiAir)) {
      const within = await choose(T('ReactPointDefense'), T('ReactPointDefenseRange'), [['yes', T('ReactYes')], ['no', T('ReactNo')]]);
      if (!within) {
        return false;
      }

      snag = within == 'no';
    }

    await disarm(actor, 'pointDefense');
    const { success, cancelled } = await rollVs(actor, 'targeting', info.total, snag ? { reactSnag: true } : {});
    if (cancelled) {
      return false;
    }

    if (success) {
      for (const row of info.rows.filter(r => r.targetUuid)) {
        await negateHit(info.message, row.targetUuid, null, actor);
      }

      await say(actor, T(info.style == 'explosive' ? 'ReactShotDownBlast' : 'ReactShotDown', { name: actor.name }));
    }

    return true;
  },
});

// A Snag asked for by a reaction's own roll (Point-Defense Reflexes at close range) - rollSkill's
// dataset has no snag of its own, so it is set once the dialog closes.
registerApplyDialog((actor, options, ctx) => {
  if (ctx?.dataset?.reactSnag) {
    options.snag = true;
  }
});

/* -------------------------------------------- */
/*  When an attack misses you                    */
/* -------------------------------------------- */

// Legendary Cruelty (Cobra Codex p.57): "once per turn, when an attack targeting you misses, you can
// immediately make an Intimidation Skill Test against your attacker's Willpower or Cleverness. On a
// success, you deal 1 Psychic Damage." The attacker picks the Defense it defends with - the better.
registerReaction({
  id: 'legendaryCruelty',
  reactors: (info, row) => (info.isAttack && !row.success && info.attacker
    ? selfHolder(row, REACT.legendaryCruelty).filter(actor => !hasUsedThisTurn(actor, 'reactLegendaryCruelty'))
    : []),
  label: actor => nameOf(actor, REACT.legendaryCruelty, 'Legendary Cruelty'),
  run: async (actor, info) => {
    const { success, cancelled } = await rollVs(actor, 'intimidation', bestDefense(info.attacker, ['willpower', 'cleverness']));
    if (cancelled) {
      return false;
    }

    await markUsedThisTurn(actor, 'reactLegendaryCruelty');
    if (success) {
      await damageButton(actor, info.attacker, 1, 'psychic', T('ReactCruelty', { name: actor.name, target: esc(info.attacker.name) }));
    }

    return true;
  },
});

// Counterstrike (Decepticon Directive p.57): "once per round when an enemy within your reach targets
// you with a melee attack and fails by 5 or more, you can make an immediate melee attack against them
// at ↓1." Targets them, grants the free attack and banks the ↓1 for it.
registerReaction({
  id: 'ddCounterstrike',
  reactors: (info, row) => (info.isMelee && !row.success && info.attacker && row.difficulty - info.total >= 5
    ? selfHolder(row, REACT.ddCounterstrike).filter(actor => !hasUsedThisRound(actor, 'reactCounterstrike'))
    : []),
  label: actor => nameOf(actor, REACT.ddCounterstrike, 'Counterstrike'),
  run: async (actor, info) => {
    await markUsedThisRound(actor, 'reactCounterstrike');
    await bankCounter(actor, info.attacker, { shiftDown: 1, melee: true, label: nameOf(actor, REACT.ddCounterstrike, 'Counterstrike') });
    return true;
  },
});

// Steady Footing (Factions in Action Vol. 2 p.95): "If the attempt [to Grapple, Shove, or Trip you]
// Fumbles, you can immediately attempt to Grapple, Shove, or Trip your attacker with a ↑1." The
// ↓1 half is dice.mjs; a Maneuver-damage attack is the Grapple/Shove/Trip proxy it uses too.
registerReaction({
  id: 'steadyFooting',
  reactors: (info, row) => (info.isAttack && info.isFumble && info.damageType == 'maneuver' && info.attacker
    ? selfHolder(row, REACT.steadyFooting) : []),
  label: actor => nameOf(actor, REACT.steadyFooting, 'Steady Footing'),
  run: async (actor, info) => {
    await bankCounter(actor, info.attacker, { shiftUp: 1, maneuver: true, label: nameOf(actor, REACT.steadyFooting, 'Steady Footing') });
    return true;
  },
});

/**
 * An immediate counter-attack: target the attacker, a free attack from the action economy, and
 * the shift banked for that one attack (consumed by the source below).
 */
async function bankCounter(actor, attacker, { shiftUp = 0, shiftDown = 0, melee = false, maneuver = false, label }) {
  await actor.setFlag(SCOPE, 'reactCounter', { targetUuid: attacker.uuid, shiftUp, shiftDown, melee, maneuver, label, combatId: game.combat?.id ?? null });
  targetActor(attacker);
  if (game.combat) {
    const { grantBonusAttack } = await import("../../action-economy.mjs");
    await grantBonusAttack(actor, { source: label, cost: 'free' });
  }

  await say(actor, T('ReactCounterReady', { name: actor.name, target: esc(attacker.name), perk: label }));
}

registerRollSources((actor, target, ctx) => {
  const counter = actor?.getFlag?.(SCOPE, 'reactCounter');
  if (!counter || !ctx?.isAttack || !target || target.uuid != counter.targetUuid
    || (counter.melee && !ctx.isMelee) || (counter.maneuver && ctx.item?.system?.damageType != 'maneuver')) {
    return null;
  }

  return {
    sources: [{ id: 'reactCounter', label: counter.label, shiftUp: counter.shiftUp, shiftDown: counter.shiftDown }],
    consumes: [{ ext: 'reactCounter', actorUuid: actor.uuid }],
  };
});

registerConsumer('reactCounter', async consume => {
  const actor = await fromUuid(consume.actorUuid);
  await actor?.unsetFlag?.(SCOPE, 'reactCounter');
});

/* -------------------------------------------- */
/*  When an attack hits you                      */
/* -------------------------------------------- */

// Projectile Deflector (Factions in Action Vol. 2 p.31): "The first time a Threat successfully hits
// you with a projectile weapon in a Combat scene, you can attempt a Finesse Skill Test against a DIF
// equal to the Attack roll. On a success, you deflect their missile with your blade. On a Critical
// Success, you send the projectile spinning back towards the Threat, dealing its effect to them."
registerReaction({
  id: 'projectileDeflector',
  reactors: (info, row) => (info.isAttack && row.success && info.style == 'projectile' && info.attacker?.type != 'playerCharacter'
    ? selfHolder(row, REACT.projectileDeflector).filter(actor => getUses(actor, 'reactProjectileDeflector', 'encounter') < 1)
    : []),
  label: actor => nameOf(actor, REACT.projectileDeflector, 'Projectile Deflector'),
  run: async (actor, info, row) => {
    const { success, crit, cancelled } = await rollVs(actor, 'finesse', info.total);
    if (cancelled) {
      return false;
    }

    await markUsed(actor, 'reactProjectileDeflector', { window: 'encounter' });
    if (success) {
      await negateHit(info.message, row.targetUuid, T('ReactDeflected', { name: actor.name }), actor);
    }

    if (success && crit && info.attacker && row.damage) {
      await damageButton(actor, info.attacker, row.damage, row.damageType, T('ReactDeflectBack', { name: actor.name, target: esc(info.attacker.name) }));
    }

    return true;
  },
});

// Soldier On (Transformers CRB p.90): "if an attack targeting you scores a Critical Hit, once per
// Combat you may attempt a Brawn Skill Test against a DIF equal to 10+ the Damage dealt to ignore the
// attack."
registerReaction({
  id: 'soldierOn',
  reactors: (info, row) => (info.isAttack && row.success && row.isCrit
    ? selfHolder(row, REACT.soldierOn).filter(actor => getUses(actor, 'reactSoldierOn', 'encounter') < 1)
    : []),
  label: actor => nameOf(actor, REACT.soldierOn, 'Soldier On'),
  run: async (actor, info, row) => {
    const { success, cancelled } = await rollVs(actor, 'brawn', 10 + (row.damage || 0));
    if (cancelled) {
      return false;
    }

    await markUsed(actor, 'reactSoldierOn', { window: 'encounter' });
    if (success) {
      await negateHit(info.message, row.targetUuid, T('ReactIgnored', { name: actor.name }), actor);
    }

    return true;
  },
});

// Shoot Out (Transformers CRB p.70): "once per turn, if an enemy within range of one of your
// ballistic weapons targets you with a ranged attack, instead of targeting one of your Defenses, you
// roll your attack Skill Test against theirs as a contested roll. If you lose, or the contested roll
// is a tie, the attack hits you. If you win, your shot deflects theirs and has no effect."
function ballisticEffect(actor) {
  return wieldedEffect(actor, (effect, weapon) => effect.system?.classification?.style != 'melee'
    && [...(weapon.system?.traits ?? []), ...(weapon.system?.itemAndUpgradeTraits ?? [])].includes('ballistic'));
}

registerReaction({
  id: 'shootOut',
  reactors: (info, row) => (info.isAttack && !info.isMelee && info.attacker
    ? selfHolder(row, REACT.shootOut).filter(actor => !hasUsedThisTurn(actor, 'reactShootOut') && ballisticEffect(actor))
    : []),
  label: actor => nameOf(actor, REACT.shootOut, 'Shoot Out'),
  run: async (actor, info, row) => {
    const effect = ballisticEffect(actor);
    // Winning means beating their result - a tie goes to the attacker.
    const { success, cancelled } = await rollVs(actor, effect?.system?.classification?.skill ?? 'targeting', info.total + 1);
    if (cancelled) {
      return false;
    }

    await markUsedThisTurn(actor, 'reactShootOut');
    if (success && row.success) {
      await negateHit(info.message, row.targetUuid, T('ReactShotDeflected', { name: actor.name }), actor);
    } else if (!success && !row.success) {
      await convertRows(info, [row], { crit: false, speaker: actor, reason: T('ReactShootOutLost', { name: actor.name }) });
    }

    return true;
  },
});

/* -------------------------------------------- */
/*  Lowering someone else's attack               */
/* -------------------------------------------- */

// Sidestep (PR CRB, Green Ranger, 7th level, p.45): "When you are subjected to an attack that has
// an Area of Effect that targets your Evasion, you may spend a point of Personal Power to reduce the
// attack result by the number rolled on your Acrobatics skill die."
registerReaction({
  id: 'sidestep',
  reactors: (info, row) => (info.isArea && row.success && (!info.defenseType || info.defenseType == 'evasion')
    ? selfHolder(row, REACT.sidestep).filter(actor => (actor.system?.powers?.personal?.value ?? 0) >= 1) : []),
  label: actor => nameOf(actor, REACT.sidestep, 'Sidestep'),
  run: async (actor, info, row) => {
    if (!actor.system?.skills?.acrobatics?.shift || actor.system.skills.acrobatics.shift == 'd20') {
      ui.notifications?.warn(T('ReactNoSkillDie', { name: actor.name, skill: skillLabel('acrobatics') }));
      return false;
    }

    if (!(await payPower(actor, 1))) {
      return false;
    }

    const cut = await rollSkillDie(actor, 'acrobatics', nameOf(actor, REACT.sidestep, 'Sidestep')) ?? 0;
    await lowered(info, row, info.total - cut, actor);
    return true;
  },
});

// Defender (PR CRB, General Perk, p.93): "When you are wielding a Finesse-based weapon with which you
// have Specialization in and another creature hits an adjacent ally with a melee attack, you can roll
// your Skill Dice and lower the opponent's Skill Test result by the amount rolled, potentially causing
// the attack to miss."
function finesseSpecialized(actor) {
  const finesse = actor?.system?.skills?.finesse ?? {};
  const specs = itemsOf(actor).filter(item => item.type == 'specialization' && item.system?.skill == 'finesse');
  return !!finesse.isSpecialized || specs.length > 0 || Object.keys(finesse.specializations ?? {}).length > 0;
}

registerReaction({
  id: 'defender',
  reactors: (info, row) => {
    if (!info.isMelee || !row.success) {
      return [];
    }

    const target = targetSync(row);
    return holdersOf(REACT.defender).filter(actor => actor !== target && actor !== info.attacker && areAllies(actor, target)
      && distanceBetween(actor, target) <= 5 && finesseSpecialized(actor)
      && wieldedEffect(actor, effect => effect.system?.classification?.skill == 'finesse'));
  },
  label: (actor, info, row) => `${nameOf(actor, REACT.defender, 'Defender')}: ${targetSync(row)?.name ?? ''}`,
  run: async (actor, info, row) => {
    const cut = await rollSkillDie(actor, 'finesse', nameOf(actor, REACT.defender, 'Defender'));
    if (cut === null) {
      ui.notifications?.warn(T('ReactNoSkillDie', { name: actor.name, skill: skillLabel('finesse') }));
      return false;
    }

    await lowered(info, row, info.total - cut, actor);
    return true;
  },
});

/** Announce a lowered attack result, negating the hit when it now falls short. */
async function lowered(info, row, newTotal, actor) {
  if (newTotal < row.difficulty) {
    await negateHit(info.message, row.targetUuid, T('ReactLoweredMiss', { name: actor.name, total: newTotal, dif: row.difficulty }), actor);
  } else {
    await say(actor, T('ReactLoweredHit', { name: actor.name, total: newTotal, dif: row.difficulty }));
  }
}

// Defender (Megaform Trait, Across the Stars p.105): "the Combiner participant's piloting Power
// Ranger can spend 1 Personal Power when an attack targets the Megaform to impose a Snag on the enemy
// Attack." The dice have landed by the time anyone could click, so the Snag is rolled afterwards: an
// extra d20, the lower one kept - the same result a Snag before the roll would have given.
export function megaformDefenderPilots(megaform) {
  if (megaform?.type != 'megaform') {
    return [];
  }

  const members = Object.values(megaform.system?.actors ?? {}).map(entry => fromUuidSync?.(entry.uuid)).filter(Boolean);
  const defenders = members.filter(member => itemsOf(member).some(item => item.type == 'megaformTrait'
    && (sourceOf(item) == REACT.megaformDefender || item.system?.type == 'defender')));
  return worldActors().filter(pc => pc.type == 'playerCharacter'
    && Object.values(pc.system?.actors ?? {}).some(entry => defenders.some(member => member.uuid == entry.uuid))
    && (pc.system?.powers?.personal?.value ?? 0) >= 1);
}

registerReaction({
  id: 'megaformDefender',
  reactors: (info, row) => (info.isAttack && row.success ? megaformDefenderPilots(targetSync(row)) : []),
  label: () => T('ReactMegaformDefender'),
  run: async (actor, info, row) => {
    if (!(await payPower(actor, 1))) {
      return false;
    }

    const snagged = await lateSnag(info);
    await lowered(info, row, snagged.total, actor);
    return true;
  },
});

// Not On My Watch (Transformers CRB, 17th level, p.66): "once per combat, after an enemy
// successfully rolls a Skill Test without an Edge, you can target them with a Deception,
// Intimidation, or Persuasion Skill Test. On a success, you force them to roll an additional d20 as
// though they had a Snag on the Skill Test."
const SOCIAL_DEFENSE = { deception: 'cleverness', intimidation: 'willpower', persuasion: 'willpower' };

registerReaction({
  id: 'tfNotOnMyWatch',
  scope: 'card',
  reactors: info => {
    if (!info.attacker || info.hadEdge || !info.rows.some(r => r.success)) {
      return [];
    }

    return holdersOf(REACT.tfNotOnMyWatch).filter(actor => actor !== info.attacker && !areAllies(actor, info.attacker)
      && getUses(actor, 'reactTfNotOnMyWatch', 'encounter') < 1);
  },
  label: actor => nameOf(actor, REACT.tfNotOnMyWatch, 'Not On My Watch'),
  run: async (actor, info) => {
    const skill = await choose(nameOf(actor, REACT.tfNotOnMyWatch, 'Not On My Watch'), T('ReactPickSkill'),
      Object.keys(SOCIAL_DEFENSE).map(s => [s, skillLabel(s)]));
    if (!skill) {
      return false;
    }

    const { success, cancelled } = await rollVs(actor, skill, defenseOf(info.attacker, SOCIAL_DEFENSE[skill]));
    if (cancelled) {
      return false;
    }

    await markUsed(actor, 'reactTfNotOnMyWatch', { window: 'encounter' });
    if (!success) {
      return true;
    }

    const snagged = await lateSnag(info);
    await say(actor, T('ReactLateSnag', { name: esc(info.attacker.name), die: snagged.die, total: snagged.total }));
    for (const row of info.rows.filter(r => r.success && r.targetUuid)) {
      if (snagged.total < row.difficulty) {
        await negateHit(info.message, row.targetUuid, T('ReactNowMisses', { target: esc(targetSync(row)?.name ?? '') }), actor);
      }
    }

    return true;
  },
});

/* -------------------------------------------- */
/*  Making an ally's roll better                 */
/* -------------------------------------------- */

function allyHolders(info, uuid) {
  if (!info.attacker) {
    return [];
  }

  return holdersOf(uuid).filter(actor => actor !== info.attacker && areAllies(actor, info.attacker)
    && getUsesThisScene(actor, `react-${uuid}`) < 1);
}

// Not Perfect, But Better (Sgt Slaughter Sourcebook p.10): "once per scene, when an ally fails a
// Skill Test, you can spend a Story Point to treat it as a success instead."
registerReaction({
  id: 'notPerfect',
  scope: 'card',
  reactors: info => (info.rollFailed && info.rows.length ? allyHolders(info, REACT.notPerfect) : []),
  label: actor => nameOf(actor, REACT.notPerfect, 'Not Perfect, But Better'),
  run: async (actor, info) => storyPointConvert(actor, info, REACT.notPerfect, { crit: false }),
});

// That's Right, Perfect (Sgt Slaughter Sourcebook p.10): "once per scene, when an ally fails or
// succeeds at a Skill Test, you can spend a Story Point to treat it as a critical success instead.
// You can use That's Right, Perfect even if you used Not Perfect, But Better this scene."
registerReaction({
  id: 'thatsRight',
  scope: 'card',
  reactors: info => (info.rows.length ? allyHolders(info, REACT.thatsRight) : []),
  label: actor => nameOf(actor, REACT.thatsRight, "That's Right, Perfect"),
  run: async (actor, info) => storyPointConvert(actor, info, REACT.thatsRight, { crit: true }),
});

async function storyPointConvert(actor, info, uuid, { crit }) {
  const { canSpendForActor, spendForActor } = await import("../../story-points.mjs");
  if (!canSpendForActor(actor, 1)) {
    ui.notifications?.warn(T('ReactNoStoryPoint'));
    return false;
  }

  await spendForActor(actor, 1);
  await markUsedThisScene(actor, `react-${uuid}`);
  await convertRows(info, info.rows, { crit, speaker: actor, reason: T(crit ? 'ReactNowCrit' : 'ReactNowSuccess', { name: esc(info.attacker.name), by: actor.name }) });
  return true;
}

export const _test = { finesseSpecialized, lowered, bankCounter, gmDo, disarm };
