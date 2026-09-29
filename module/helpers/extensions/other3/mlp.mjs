/**
 * My Little Pony CRB - Betrayal (Hang-Up), Dabbler (General Perk) and Self Improvement (spell).
 */
import {
  registerChatButton, registerDerived, registerPostRoll, registerRest, registerUse,
} from "../../extensions.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import {
  O3, T, escape, has, isItem, myActor, say, targetedActors, worldActors, writeActor,
} from "./shared.mjs";

/* -------------------------------------------- */
/*  Betrayal                                     */
/* -------------------------------------------- */

/*
 * Betrayal (MLP CRB, Hang-Up, p.59): "If you Lend Assistance to a creature and they fail their Skill
 * Test, you are no longer considered an ally for the purpose of using Perks and other abilities with
 * the rest of the PCs. This lasts for the rest of the scene/encounter, or until one of the other PCs
 * spends a Friendship Point to heal the breach of trust."
 *
 * Every write lands on an actor the writer owns: the pony who failed records who betrayed them on
 * their OWN actor (flags.essence20.o3Betrayal), and the pony who heals the breach records it on
 * theirs (o3BetrayalHealed). isBetrayed reads both across the world. The "not an ally" half is
 * helpers/allies.mjs#getNearbyAllyTokens (the one ally test Perks use), patched to skip a pair
 * split by betrayalSplits - see SCRATCH/integration/other3-patch.cjs.
 */
const BETRAYAL_FLAG = 'o3Betrayal';
const HEALED_FLAG = 'o3BetrayalHealed';

export function isBetrayed(actor) {
  if (!actor?.uuid) {
    return false;
  }

  const epoch = getSceneEpoch();
  const records = worldActors().map(other => other.flags?.essence20?.[BETRAYAL_FLAG])
    .filter(record => record?.assister == actor.uuid && record.epoch == epoch);
  if (!records.length) {
    return false;
  }

  const latest = Math.max(...records.map(record => record.at ?? 0));
  const healed = worldActors().some(other => {
    const heal = other.flags?.essence20?.[HEALED_FLAG];
    return heal?.assister == actor.uuid && heal.epoch == epoch && (heal.at ?? 0) >= latest;
  });
  return !healed;
}

/** Whether two PCs are kept from counting as allies by a Betrayal. */
export function betrayalSplits(actor, other) {
  if (!actor || !other || actor === other || actor.uuid == other.uuid) {
    return false;
  }

  if (actor.type != 'playerCharacter' || other.type != 'playerCharacter') {
    return false;
  }

  return isBetrayed(actor) || isBetrayed(other);
}

registerPostRoll(async (actor, results, checkContext) => {
  const assisterUuid = checkContext?.lendAssistanceAssisterUuid;
  if (!assisterUuid || results?.[0]?.success !== false || !actor?.isOwner) {
    return;
  }

  const assister = await fromUuid(assisterUuid);
  if (!assister || !has(assister, O3.betrayal)) {
    return;
  }

  await actor.setFlag('essence20', BETRAYAL_FLAG, { assister: assister.uuid, epoch: getSceneEpoch(), at: Date.now() });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: assister }),
    content: `<p>${T('O3BetrayalLine', { name: escape(assister.name), ally: escape(actor.name) })}</p>`
      + `<button type="button" data-e20-ext="o3BetrayalHeal" data-assister="${assister.uuid}">${T('O3BetrayalHeal')}</button>`,
  });
});

registerChatButton('o3BetrayalHeal', async (message, button) => {
  const assisterUuid = button.dataset.assister;
  const assister = assisterUuid ? await fromUuid(assisterUuid) : null;
  if (!assister || !isBetrayed(assister)) {
    ui.notifications.info(T('O3BetrayalNothing'));
    return;
  }

  const healer = myActor();
  if (!healer || healer.uuid == assisterUuid || !healer.isOwner) {
    ui.notifications.warn(T('O3BetrayalNeedPc'));
    return;
  }

  const { canSpendForActor, spendForActor } = await import("../../story-points.mjs");
  if (!canSpendForActor(healer, 1)) {
    ui.notifications.warn(T('O3NoFriendshipPoint'));
    return;
  }

  await spendForActor(healer, 1);
  await healer.setFlag('essence20', HEALED_FLAG, { assister: assisterUuid, epoch: getSceneEpoch(), at: Date.now() });
  await say(healer, T('O3BetrayalHealed', { name: escape(healer.name), other: escape(assister.name) }));
});

/* -------------------------------------------- */
/*  Dabbler                                      */
/* -------------------------------------------- */

/*
 * Dabbler (MLP CRB, General Perk, p.123): "Every morning, you can choose to lower a Skill by 1 Rank
 * and increase another Skill of the same Essence Score (or your Spellcasting skill) by 1 Rank. This
 * change reverts back to normal when you wake the next day."
 *
 * The Use button makes the swap on the actor's real ranks and stamps it on the Perk; the next Rest
 * ("when you wake the next day") undoes it, one step each way, so any advancement taken meanwhile
 * survives. Pressing Use again while a swap stands undoes it early.
 */
const DABBLER_FLAG = 'o3Dabbler';
const LADDER = () => CONFIG.E20?.skillShiftList ?? [];
const UNTRAINED = 'd20';
const BEST = 'd12';

export function stepShift(shift, steps) {
  const ladder = LADDER();
  const index = ladder.indexOf(shift);
  if (index < 0) {
    return shift;
  }

  // The ladder runs best-to-worst: an increase is a LOWER index.
  const next = Math.min(Math.max(0, index - steps), ladder.length - 1);
  return ladder[next];
}

export function canLower(shift) {
  const ladder = LADDER();
  return ladder.indexOf(shift) >= 0 && ladder.indexOf(shift) < ladder.indexOf(UNTRAINED);
}

export function canRaise(shift) {
  const ladder = LADDER();
  return ladder.indexOf(shift) > ladder.indexOf(BEST);
}

export function dabblerRaiseOptions(actor, lowered) {
  const essence = CONFIG.E20.skillToEssence[lowered];
  return Object.keys(actor.system?.skills ?? {}).filter(skill => skill != lowered && skill != 'conditioning'
    && (CONFIG.E20.skillToEssence[skill] == essence || skill == 'spellcasting')
    && canRaise(actor.system.skills[skill]?.shift));
}

async function revertDabbler(perk) {
  const swap = perk?.flags?.essence20?.[DABBLER_FLAG];
  const actor = perk?.parent;
  if (!swap || !actor) {
    return false;
  }

  const skills = actor.system.skills ?? {};
  const updates = {};
  if (skills[swap.lower]) {
    updates[`system.skills.${swap.lower}.shift`] = stepShift(skills[swap.lower].shift, 1);
  }

  if (skills[swap.raise]) {
    updates[`system.skills.${swap.raise}.shift`] = stepShift(skills[swap.raise].shift, -1);
  }

  await actor.update(updates);
  await perk.unsetFlag('essence20', DABBLER_FLAG);
  return true;
}

registerUse({
  id: 'o3Dabbler',
  matches: item => isItem(item, O3.dabbler),
  run: async (item) => {
    const actor = item.parent;
    const label = skill => game.i18n.localize(CONFIG.E20.skills?.[skill] ?? skill);
    if (item.flags?.essence20?.[DABBLER_FLAG]) {
      await revertDabbler(item);
      return T('O3DabblerReverted', { name: escape(actor.name) });
    }

    const { chooseSelect } = await import("../../grants.mjs");
    const lowerable = Object.keys(actor.system?.skills ?? {})
      .filter(skill => skill != 'conditioning' && canLower(actor.system.skills[skill]?.shift) && dabblerRaiseOptions(actor, skill).length);
    const lower = await chooseSelect(item.name, T('O3DabblerLower'), lowerable.map(skill => ({ value: skill, label: label(skill) })));
    if (!lower) {
      return null;
    }

    const raise = await chooseSelect(item.name, T('O3DabblerRaise'),
      dabblerRaiseOptions(actor, lower).map(skill => ({ value: skill, label: label(skill) })));
    if (!raise) {
      return null;
    }

    await actor.update({
      [`system.skills.${lower}.shift`]: stepShift(actor.system.skills[lower].shift, -1),
      [`system.skills.${raise}.shift`]: stepShift(actor.system.skills[raise].shift, 1),
    });
    await item.setFlag('essence20', DABBLER_FLAG, { lower, raise });
    return T('O3DabblerSwapped', { name: escape(actor.name), lower: label(lower), raise: label(raise) });
  },
});

registerRest(async (actor) => {
  for (const perk of (actor?.items ?? []).filter(item => isItem(item, O3.dabbler) && item.flags?.essence20?.[DABBLER_FLAG])) {
    await revertDabbler(perk);
    await say(actor, T('O3DabblerReverted', { name: escape(actor.name) }));
  }
});

/* -------------------------------------------- */
/*  Self Improvement                             */
/* -------------------------------------------- */

/*
 * Self Improvement (MLP CRB, Enchantment spell, p.140): "The target creature within range improves
 * one of their Strength, Speed, Smarts, or Social Essence Scores by 1, for the duration of the spell.
 * The creature gains a Skill Point and an increase to Defense, as they usually do for an Essence
 * Score Increase, but only for the duration of the spell. One creature can be targeted multiple
 * times with Self-Improvement, each time improving a different Essence and Skill." Duration 1 scene.
 *
 * Cast the spell as usual, then press Use: the choice is stored on the target (flags, keyed to the
 * scene clock so it lapses with the scene) and applied in derived data - the Essence, every Defense
 * built on it, and the chosen Skill's point as an upshift on that Skill.
 */
const SELF_IMPROVEMENT_FLAG = 'o3SelfImprovement';
const IMPROVABLE = ['strength', 'speed', 'smarts', 'social'];

export function selfImprovements(actor) {
  const record = actor?.flags?.essence20?.[SELF_IMPROVEMENT_FLAG];
  return record?.epoch == getSceneEpoch() ? (record.entries ?? []) : [];
}

export function applySelfImprovement(actor) {
  const system = actor?.system;
  if (!system?.essences) {
    return;
  }

  for (const { essence, skill } of selfImprovements(actor)) {
    const score = system.essences[essence];
    if (!score) {
      continue;
    }

    if (score.max != null) {
      score.max = (Number(score.max) || 0) + 1;
    }

    score.value = (Number(score.value) || 0) + 1;
    for (const defense of Object.values(system.defenses ?? {})) {
      if (defense?.essence == essence) {
        defense.total = (Number(defense.total) || 0) + 1;
        defense.string = `${defense.string ?? ''} + 1 (Self Improvement)`;
      }
    }

    if (skill && system.skills?.[skill]) {
      system.skills[skill].shiftUp = (Number(system.skills[skill].shiftUp) || 0) + 1;
    }
  }
}

registerDerived(applySelfImprovement);

registerUse({
  id: 'o3SelfImprovement',
  matches: item => isItem(item, O3.selfImprovement),
  run: async (item) => {
    const caster = item.parent;
    const target = targetedActors()[0] ?? caster;
    const already = selfImprovements(target).map(entry => entry.essence);
    const essences = IMPROVABLE.filter(e => !already.includes(e) && target.system?.essences?.[e]);
    const { chooseSelect } = await import("../../grants.mjs");
    const essence = await chooseSelect(item.name, T('O3SelfImprovementEssence', { name: escape(target.name) }),
      essences.map(e => ({ value: e, label: game.i18n.localize(CONFIG.E20.originEssences?.[e] ?? CONFIG.E20.essences?.[e] ?? e) })));
    if (!essence) {
      return null;
    }

    const usedSkills = selfImprovements(target).map(entry => entry.skill);
    const skills = (CONFIG.E20.skillsByEssence?.[essence] ?? []).filter(skill => !usedSkills.includes(skill));
    const skill = await chooseSelect(item.name, T('O3SelfImprovementSkill'),
      skills.map(s => ({ value: s, label: game.i18n.localize(CONFIG.E20.skills?.[s] ?? s) })));
    const entries = [...selfImprovements(target), { essence, skill: skill ?? null }];
    const ok = await writeActor(target, 'setFlag', ['essence20', SELF_IMPROVEMENT_FLAG, { epoch: getSceneEpoch(), entries }]);
    if (!ok) {
      ui.notifications.warn(T('O3NeedTarget'));
      return null;
    }

    return T('O3SelfImprovementLine', { name: escape(target.name), essence: game.i18n.localize(CONFIG.E20.originEssences?.[essence] ?? essence) });
  },
});
