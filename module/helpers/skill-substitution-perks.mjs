import { actorHasHangUp, actorHasPerk, bankPendingBonus, getUsesThisScene, markUsedThisScene } from "./perks.mjs";
import { findRolePointsItem } from "./reroll.mjs";

/**
 * A family of Perks that lift the normal "wrong skill for this task" restriction a limited
 * number of times, letting the holder roll ONE named skill for a Skill Test that would ordinarily
 * call for a different one. The roll itself needs no dice-pipeline change - this system already
 * lets a player roll any of their own skills for any Skill Test (which skill narratively applies
 * to a given task is a GM/player call this codebase has never computed), so what RAW actually
 * gates is the PERMISSION, a limited number of times. Modeled as a plain Use-button counter, the
 * same "no live mechanical hook, just a tracked grant of permission" idiom this codebase already
 * accepts elsewhere for a narrative-only benefit (e.g. Dirty Trick).
 *
 * "X/day" is approximated as X/scene throughout, this project's own standard idiom for lack of a
 * day-boundary hook anywhere in this codebase (see helpers/trade-school.mjs's own doc comment).
 */
// Reverse Engineer's own compendium id - named ahead of the table below (rather than inlined
// like its SKILL_SUBSTITUTION_PERKS peers) so activateSkillSubstitutionPerk further down can
// single it out for the Laypony Terms Hang-Up hook.
export const REVERSE_ENGINEER_ID = "Compendium.essence20.mlp_crb.Item.ESXOYPJ6FSPGeNHb";

// Thesis's own compendium id - named ahead of the table (same reason as REVERSE_ENGINEER_ID above)
// so canUseSkillSubstitutionPerk below can single it out for Technobabble's own maxUses bump.
const THESIS_ID = "Compendium.essence20.tf_crb.Item.4AyMZ0h6YkKv8vbj";

const SKILL_SUBSTITUTION_PERKS = {
  // Infiltrator (Transformers CRB, Prowler Focus, 10th level, p.86): "At 10th level, once per
  // scene outside of Combat, you can roll Infiltration in place of another Skill Test."
  "Compendium.essence20.tf_crb.Item.CHkXJNjrvZUPxV7J": {
    maxUses: 1, flagKey: 'infiltratorUsedThisScene',
  },
  // Chatter Flashback (MLP CRB, Chatty Influence, p.48): "Three times per day, you can substitute
  // a Smarts Skill with Persuasion for a Skill Test."
  "Compendium.essence20.mlp_crb.Item.L18ewA90Q1MqaQlC": {
    maxUses: 3, flagKey: 'chatterFlashbackUsedThisScene',
  },
  // Muscle Over Panache (MLP CRB, Powerhouse Influence, p.57): "Three times per day, you can use
  // Brawn in place of a Speed skill on a Skill Test."
  "Compendium.essence20.mlp_crb.Item.JxScHzozoGYU6P46": {
    maxUses: 3, flagKey: 'muscleOverPanacheUsedThisScene',
  },
  // Reverse Engineer (MLP CRB, Futurist Influence, p.50): "Three times per day, when you need to
  // roll a Skill Test outside of a conflict, you can take twice the time and substitute the Skill
  // Test for Technology instead." The "outside a conflict"/"twice the time" clauses are left
  // GM-enforced, same convention this codebase already accepts for narrative timing constraints
  // it has no hook for (e.g. Thesis's own "takes longer" clause, banked-buffs.mjs).
  [REVERSE_ENGINEER_ID]: {
    maxUses: 3, flagKey: 'reverseEngineerUsedThisScene',
  },
  // Thesis (Transformers CRB, Scientist, 5th level, p.79): "outside of Combat, once per scene, you
  // can use Science in place of another Smarts-based Skill for a Skill Test, but the Skill Test
  // takes longer." The "outside of Combat"/"takes longer" clauses are left GM-enforced, same
  // narrative-timing looseness this table already accepts for Reverse Engineer's own "outside a
  // conflict"/"twice the time" wording above.
  [THESIS_ID]: {
    maxUses: 1, flagKey: 'thesisUsedThisScene',
  },
};

// Technobabble (Transformers CRB, Scientist, 16th level, p.80): "you can use Thesis in place of
// Social-Based Skills as well, you can use Thesis three times per scene outside of Combat, or
// once per Combat, and Thesis no longer takes extra time to use." The "Social Skills as well" and
// "no longer takes extra time" clauses need no code - Thesis's own substitution was never
// restricted to a specific skill CATEGORY by anything in this codebase to begin with (see this
// file's own doc comment: the engine already lets any skill roll for any Skill Test, the only real
// gate is the tracked-uses permission), so Technobabble's only concretely-checkable effect is
// raising Thesis's own maxUses from 1 to 3 per scene. "Or once per Combat" is dropped as the same
// unenforceable in-vs-out-of-combat split this table's own "outside of Combat" clauses already
// leave GM-enforced.
const TECHNOBABBLE_ID = "Compendium.essence20.tf_crb.Item.efrhpDsdXPUKVEWt";
const TECHNOBABBLE_THESIS_MAX_USES = 3;

// Laypony Terms (MLP CRB, Futurist Influence Hang-Up, p.50): "Other ponies find you hard to
// understand. When you use Technology instead of a Social Essence Skill, you suffer Snag." A
// Hang-Up riding on Reverse Engineer above rather than a Perk of its own - RAW's substitution is
// always Technology, so "instead of a Social Essence Skill" is the one fact this codebase has no
// other way to learn (dice.mjs has no concept of what the UN-substituted skill would have been),
// so the player is asked once, at the moment they invoke Reverse Engineer. A "yes" banks a Snag on
// their own next Skill Test the same way Angry's own pendingAngrySnag flag does (helpers/angry.mjs)
// - read back (and cleared) at dice.mjs's own rolledSkill == 'technology' check.
const LAYPONY_TERMS_ID = "Compendium.essence20.mlp_crb.Item.ZD7uEmKIlQbyoFz7";
const PENDING_LAYPONY_TERMS_SNAG_FLAG = 'pendingLayponyTermsSnag';

/**
 * Prompts whether this Reverse Engineer use is substituting for a Social Essence Skill - only
 * asked when the actor also holds Laypony Terms, since it's meaningless otherwise.
 * @returns {Promise<Boolean>}
 */
async function pickIsSocialSubstitution() {
  const chosen = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize('E20.LayponyTermsPromptTitle') },
    content: `<p>${game.i18n.localize('E20.LayponyTermsPromptLabel')}</p>`,
    modal: true,
  });

  return !!chosen;
}

/**
 * @param {String} sourceId
 * @returns {Boolean}
 */
export function isSkillSubstitutionPerk(sourceId) {
  return !!SKILL_SUBSTITUTION_PERKS[sourceId];
}

/**
 * @param {Actor} actor
 * @param {String} sourceId
 * @returns {Boolean}
 */
export function canUseSkillSubstitutionPerk(actor, sourceId) {
  const config = SKILL_SUBSTITUTION_PERKS[sourceId];
  if (!config) {
    return false;
  }

  // Technobabble - see TECHNOBABBLE_ID's own comment above.
  const maxUses = sourceId == THESIS_ID && actorHasPerk(actor, TECHNOBABBLE_ID)
    ? TECHNOBABBLE_THESIS_MAX_USES
    : config.maxUses;
  return getUsesThisScene(actor, config.flagKey) < maxUses;
}

/**
 * @param {Actor} actor
 * @param {String} sourceId
 */
export async function activateSkillSubstitutionPerk(actor, sourceId) {
  const config = SKILL_SUBSTITUTION_PERKS[sourceId];
  if (config) {
    await markUsedThisScene(actor, config.flagKey);
  }

  // Laypony Terms - see this file's own doc comment above.
  if (sourceId == REVERSE_ENGINEER_ID && actorHasHangUp(actor, LAYPONY_TERMS_ID)) {
    const isSocial = await pickIsSocialSubstitution();
    if (isSocial) {
      await bankPendingBonus(actor, PENDING_LAYPONY_TERMS_SNAG_FLAG, {});
    }
  }
}

// Acting! (MLP CRB, Laugh Tactic, p.86): "Spend 1 Cheer to use Performance in place of Persuasion,
// Deception, or Infiltration checks involving disguises." Same "the game already lets you roll any
// skill for any Skill Test; the only real gate is a limited resource" reasoning as
// SKILL_SUBSTITUTION_PERKS above, but gated by a Cheer Point SPEND rather than a per-scene count -
// so it's its own tiny cost-gated sibling table rather than joining SKILL_SUBSTITUTION_PERKS
// (whose shape only tracks a count, never a cost).
const ACTING_ID = "Compendium.essence20.mlp_crb.Item.oA8DrnUOOqc1mrd0";
const CHEER_POINTS_NAME = "Cheer Points";
const COST_GATED_SUBSTITUTION_PERKS = {
  [ACTING_ID]: { cost: 1 },
};

/**
 * @param {String} sourceId
 * @returns {Boolean}
 */
export function isCostGatedSubstitutionPerk(sourceId) {
  return !!COST_GATED_SUBSTITUTION_PERKS[sourceId];
}

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseCostGatedSubstitutionPerk(actor) {
  return (findRolePointsItem(actor, CHEER_POINTS_NAME)?.system.resource.value ?? 0) >= 1;
}

/**
 * Spends 1 Cheer Point, if available.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether the Cheer Point was actually spent.
 */
export async function activateCostGatedSubstitutionPerk(actor) {
  const rolePoints = findRolePointsItem(actor, CHEER_POINTS_NAME);
  if (!rolePoints?.system.resource.value) {
    ui.notifications.warn(game.i18n.localize('E20.RolePointsOverSpent'));
    return false;
  }

  await rolePoints.update({ 'system.resource.value': rolePoints.system.resource.value - 1 });
  return true;
}
