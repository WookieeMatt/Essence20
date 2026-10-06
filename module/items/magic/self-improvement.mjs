/**
 * My Little Pony CRB - Self Improvement (spell).
 */
import { registerDerived, registerUse } from "../../mechanics/item-hooks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { O3 } from "../shared/mlp-pr-tf-ids-and-skill-total.mjs";
import { T } from "../shared/item-lang.mjs";
import { escapeHtml as escape } from "../shared/chat-lines.mjs";
import { isItem } from "../shared/item-lookups.mjs";
import { targetedActors } from "../shared/sides.mjs";
import { writeDocResult as writeActor } from "../shared/relayed-writes.mjs";

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
