import { registerRollSources } from "../../mechanics/item-hooks.mjs";
import { hasSourced } from "../../mechanics/companions/companion-link.mjs";
import { G1, T, wornUpgrade } from "../shared/cobra-codex-item-lookups.mjs";

/**
 * Cobra Codex gear: the Battledress upgrade Anonymous (Table 3-5, p.100-101). Uniform is an item rule (an incoming
 * switch on rolls against its wearer - rules/conv10-slE10.test.js).
 * Adjustable Faceplate, Ceremonial and the Recoil Brace weapon upgrade are item rules now
 * (rules/conversions-uses.test.js, rules/conv3-slC3.test.js, rules/conv7-slC7.test.js). The armors that come pre-fitted with
 * Anonymous (Ballistic/Tactical Armor (Anonymous)) carry the upgrade as an embedded entry, so they
 * work through these too.
 */

/* -------------------------------------------- */
/*  Anonymous                                    */
/* -------------------------------------------- */

// Anonymous (p.100): "You are resistant to abilities that have a different effect when used
// multiple times against the same target, such as the Inundation Perk from the Officer
// Battlefield Psychology Focus." Resistance is a Snag on the roll. Covers the two such abilities
// this system tracks per target: Inundation (GI Joe CRB p.86, the Edge on a repeat Outwit - the
// dice.mjs outwittedTargets flag) and Informed Accuracy (TF CRB p.59, ↑ per earlier Analyze
// Target - the analyzeTargetCounts flag; its first use is not a repeat, so from the second on).
const flagKey = target => String(target?.uuid ?? '').replace(/\./g, '-');

export function anonymousSnag(actor, target, ctx = {}) {
  if (!target?.uuid || !actor) {
    return null;
  }

  const upgrade = wornUpgrade(target, G1.anonymous);
  if (!upgrade) {
    return null;
  }

  const key = flagKey(target);
  const repeatOutwit = ['deception', 'intimidation'].includes(ctx.rolledSkill) && hasSourced(actor, G1.inundation)
    && !!actor.getFlag?.('essence20', 'outwittedTargets')?.[key];
  const repeatAnalyze = !!ctx.isAttack && hasSourced(actor, G1.informedAccuracy)
    && (Number(actor.getFlag?.('essence20', 'analyzeTargetCounts')?.[key]) || 0) >= 2;
  return repeatOutwit || repeatAnalyze ? { id: 'gij1Anonymous', label: T('G1AnonymousLabel', { name: upgrade.name }), snag: true } : null;
}

registerRollSources((actor, target, ctx) => {
  const source = anonymousSnag(actor, target, ctx);
  return { sources: source ? [source] : [], consumes: [] };
});
