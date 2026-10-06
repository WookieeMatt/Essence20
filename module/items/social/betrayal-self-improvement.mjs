/**
 * My Little Pony CRB - Betrayal (Hang-Up) and Self Improvement (spell). (Dabbler is an item rule - rules/conv10-slE10.test.js.)
 */
import {
  registerChatButton, registerDerived, registerPostRoll, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import {
  O3, T, escape, has, isItem, myActor, say, targetedActors, worldActors, writeActor,
} from "../shared/turn-stamps-and-sides.mjs";

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
 * mechanics/combat/nearby-allies.mjs#getNearbyAllyTokens (the one ally test Perks use), patched to skip a pair
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

  const { canSpendForActor, spendForActor } = await import("../../mechanics/resources/story-points.mjs");
  if (!canSpendForActor(healer, 1)) {
    ui.notifications.warn(T('O3NoFriendshipPoint'));
    return;
  }

  await spendForActor(healer, 1);
  await healer.setFlag('essence20', HEALED_FLAG, { assister: assisterUuid, epoch: getSceneEpoch(), at: Date.now() });
  await say(healer, T('O3BetrayalHealed', { name: escape(healer.name), other: escape(assister.name) }));
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
    const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
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
