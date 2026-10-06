// Rules-engine plug-ins, group J (round 13): the roll:skillSpecialized tag (Mystical Understanding's Spellcialize).
// Registered on import; see module/rules/plugins/index.mjs and docs/rules-batches/slJ13.md. (Group J's other piece - world
// sweeps reaching unlinked tokens' actors - is rules/triggers.mjs#sweepActors.)
import { registerTag } from "../../predicate.mjs";

/**
 * roll:skillSpecialized - the rolled Skill is itself Specialized on the roller (system.skills.<skill>.isSpecialized, the
 * Skill's own flag - not a Specialization being rolled, which is roll:specialized). Unknown (null) with no roller or no
 * rolled Skill.
 */
export function skillSpecializedTag(rest, ctx) {
  if (!ctx?.self || !ctx.rolledSkill) {
    return null;
  }

  return !!ctx.self.system?.skills?.[ctx.rolledSkill]?.isSpecialized;
}

registerTag('roll:skillSpecialized', skillSpecializedTag);
