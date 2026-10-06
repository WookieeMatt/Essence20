/**
 * Be an Example (Across the Stars, Noble Blood Origin, p.40): "You can spend a Free action to reflect on your
 * training and traditions to gain ↑1 to the skill you chose to increase or advance as part of this Origin." A Use
 * button (Free action) banks ↑1 on system.originSkillsIncrease for the next test.
 */
import { registerApplyDialog, registerRollSources, registerUse } from "../../mechanics/item-hooks.mjs";
import { kept, PR1 } from "../shared/pr-jtt-ats-item-ids.mjs";
import { TSafe as T } from "../shared/item-lang.mjs";
import { findSourcedAny as findSourced, flagOf, isItem } from "../shared/item-lookups.mjs";

const pushTo = (list, entry) => {
  list.push({ shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...entry });
};

const EXAMPLE_FLAG = 'pr1BeAnExample';

export function originSkillOf(actor) {
  const skill = actor?.system?.originSkillsIncrease;
  return skill && actor.system?.skills?.[skill] ? skill : null;
}

registerUse({
  id: 'pr1-be-an-example',
  matches: item => isItem(item, PR1.beAnExample),
  canUse: item => !flagOf(item.parent, EXAMPLE_FLAG),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    let skill = originSkillOf(actor);
    if (!skill) {
      const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
      skill = await chooseSelect(item.name, T('Pr1BeAnExamplePick'), Object.keys(actor.system?.skills ?? {})
        .filter(key => CONFIG.E20?.skills?.[key])
        .map(key => ({ value: key, label: game.i18n.localize(CONFIG.E20.skills[key]) })));
    }

    if (!skill || !(await pay('free'))) {
      return null;
    }

    await actor.setFlag('essence20', EXAMPLE_FLAG, { skill });
    return T('Pr1BeAnExampleLine', { name: actor.name, skill: game.i18n.localize(CONFIG.E20?.skills?.[skill] ?? skill) });
  },
});

export function atsSources(actor, target, ctx = {}) {
  const sources = [];
  const { rolledSkill } = ctx;

  const example = flagOf(actor, EXAMPLE_FLAG);
  if (example?.skill && example.skill == rolledSkill) {
    pushTo(sources, { id: 'pr1BeAnExample', label: findSourced(actor, PR1.beAnExample)?.name ?? 'Be an Example', shiftUp: 1 });
  }

  return sources;
}

registerRollSources((actor, target, ctx) => ({ sources: atsSources(actor, target, ctx) }));

registerApplyDialog(async (actor, options, ctx = {}) => {
  const example = flagOf(actor, EXAMPLE_FLAG);
  if (example?.skill && example.skill == ctx.rolledSkill && kept(options, 'pr1BeAnExample')) {
    await actor.unsetFlag('essence20', EXAMPLE_FLAG);
  }
});
