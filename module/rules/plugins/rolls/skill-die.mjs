import { registerDerived } from "../../../mechanics/item-hooks.mjs";
import { rulesOfType } from "../../index.mjs";
import { linkedEntries } from "../../links.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";
import { resolve } from "../shared/side-and-copy-helpers.mjs";

/**
 * Group F: rule type `SkillDie {skill, edge?, bestOf?}` (scopes self, megaform) - derived data on a Skill itself, among
 * the extensions' derived hooks: `edge: true` gives the Skill a standing Edge (system.skills.<skill>.edge, the sheet's
 * own Edge - not a roll source the player can untick); `bestOf: "participants"` (on a Megaform) raises the Skill's die to
 * the best die its Zord participants have in their own such Skill. `skill: "initiative"` means the Skill the actor rolls
 * Initiative with (system.initiative.skill). Mobile Headquarters: the Zord's own Initiative Edge, and its Megaform's best
 * component Initiative with Edge.
 */

registerRuleType('SkillDie', {
  params: {
    skill: { kind: 'string', required: true },
    edge: { kind: 'bool' },
    bestOf: { kind: 'enum', options: ['participants'] },
  },
  scopes: ['self', 'megaform'],
  validate: rule => [
    ...(rule.edge || rule.bestOf ? [] : ['changes nothing']),
    ...(rule.bestOf && rule.scope != 'megaform' ? ['bestOf: participants needs scope megaform'] : []),
  ],
});

/** The Skill key a rule names on this actor ("initiative" - the actor's Initiative Skill). */
function skillKey(actor, skill) {
  return skill == 'initiative' ? actor?.system?.initiative?.skill ?? 'initiative' : skill;
}

export function skillDieDerived(actor) {
  const system = actor?.system;
  if (!system?.skills) {
    return;
  }

  const own = rulesOfType(actor, 'SkillDie', 'self').map(entry => ({ ...entry, holder: actor }));
  const linked = actor.type == 'megaform' ? linkedEntries(actor, 'SkillDie').filter(entry => entry.rule.scope == 'megaform') : [];
  for (const { rule, item, holder } of [...own, ...linked]) {
    const key = skillKey(actor, rule.skill);
    const skill = system.skills[key];
    if (!skill || evaluate(rule.when, contextFor({ self: actor, holder, ruleItem: item })) !== true) {
      continue;
    }

    if (rule.bestOf == 'participants' && actor.type == 'megaform') {
      const list = globalThis.CONFIG?.E20?.skillShiftList ?? [];
      const zords = Object.values(system.actors ?? {}).map(entry => resolve(entry?.uuid)).filter(other => other?.type == 'zord');
      for (const zord of zords) {
        const theirs = zord.system?.skills?.[skillKey(zord, rule.skill)]?.shift;
        if (list.includes(theirs) && list.indexOf(theirs) < list.indexOf(skill.shift)) {
          skill.shift = theirs;
        }
      }
    }

    if (rule.edge) {
      skill.edge = true;
    }
  }
}

registerDerived(skillDieDerived);
