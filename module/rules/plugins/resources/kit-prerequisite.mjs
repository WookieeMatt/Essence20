import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Group E (round 10): the KitPrerequisite rule type, read by the essence20.kitPrerequisite hook (kits.mjs - Good To Go,
 * Training Through Familiarity). installKitPrerequisite() is called from picks/picks-and-grants-setup.mjs.
 */

registerRuleType('KitPrerequisite', {
  params: { mode: { kind: 'enum', required: true, options: ['lower', 'waive'] }, tiers: { kind: 'strings' }, skipEssenceKits: { kind: 'bool' }, all: { kind: 'bool' } },
  scopes: ['self'],
});

/**
 * `waive` with `all: true` (round 14, uses - Kitbasher): every kit's prerequisite is waived, a Skill Kit's "No Ranks"
 * too - kits.mjs#meetsKitPrerequisite asks this before anything else. Plain `waive` only drops the Skill die (the hook below).
 */
export function ruleWaivesAllKitPrerequisites(actor, info) {
  return rulesOfType(actor, 'KitPrerequisite', 'self').some(({ rule, item }) => rule.mode == 'waive' && rule.all
    && (!Array.isArray(rule.tiers) || !rule.tiers.length || rule.tiers.includes(info?.tier)) && !(rule.skipEssenceKits && info?.essence)
    && evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true);
}

/**
 * The essence20.kitPrerequisite hook (kits.mjs#meetsKitPrerequisite: out.need is the Skill die a kit asks for):
 * `lower` takes it one Rank lower, never past d2 (Good To Go); `waive` drops it (d20 - Training Through Familiarity).
 * `tiers` limits it to kits of those tiers; `skipEssenceKits` leaves Essence kits alone.
 */
export function ruleKitPrerequisite(actor, info, out) {
  if (!out?.need) {
    return;
  }

  const list = globalThis.CONFIG?.E20?.skillShiftList ?? [];
  const live = rulesOfType(actor, 'KitPrerequisite', 'self').filter(({ rule, item }) => (!Array.isArray(rule.tiers) || !rule.tiers.length || rule.tiers.includes(info?.tier))
    && !(rule.skipEssenceKits && info?.essence) && evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true);
  for (let i = live.filter(entry => entry.rule.mode == 'lower').length; i > 0; i--) {
    const index = list.indexOf(out.need);
    const d2 = list.indexOf('d2');
    if (index >= 0 && (d2 < 0 || index < d2)) {
      out.need = list[index + 1];
    }
  }

  if (live.some(entry => entry.rule.mode == 'waive')) {
    out.need = 'd20';
  }
}

export function installKitPrerequisite() {
  const Hooks = globalThis.Hooks;
  if (!Hooks?.on) {
    return;
  }

  Hooks.on('essence20.kitPrerequisite', ruleKitPrerequisite);
}
