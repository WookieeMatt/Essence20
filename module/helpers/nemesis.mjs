export const NEMESIS_ID = "Compendium.essence20.across_the_stars.Item.bxGgq6PpfxeSRr7Q";
const NEMESIS_FLAG = 'nemesisUuid';

/**
 * Nemesis (Specific Threat) (Across the Stars, General Perk, p.70, prerequisite "must have
 * Defeated an enemy of Threat Level 12 or higher"): "select a TL 12 or higher Threat you have
 * previously Defeated to be your Nemesis. When facing your Nemesis, you gain ↑2 to all Skill
 * Tests. Once per scene involving your Nemesis, you may reroll a Skill Test and choose which
 * results to keep."
 *
 * Resolves the Ledger's own "Favored-enemy / nemesis targeting tag" gap for this shape - a plain
 * actor flag marking whichever token is currently targeted, the same "designate, no roll involved"
 * pattern Mark Target's own identical shape already established (helpers/mark-target.mjs), rather
 * than a novel actor-identity picker. "Must have previously Defeated" a TL 12+ Threat is a
 * build-time/GM-adjudicated precondition on taking the Perk at all (already carried as this item's
 * own plain-text system.prerequisite, never coded - the same as every other Prerequisite in this
 * project) - re-verifying it at declare time isn't attempted, matching that established split.
 *
 * Only the ↑2 half is built. "Once per scene... reroll and choose which results to keep" needs a
 * genuinely new reroll-engine capability this project doesn't have: canMeetRerollScope
 * (helpers/reroll.mjs) only ever scopes a reroll grant by skill/essence, and the chat message's own
 * stashed context (chat.mjs#getRerollContext) never records WHO was targeted on that roll at all -
 * "only when the target IS a specific actor" would need a new context field threaded all the way
 * from dice.mjs's own buildCheckChatData through to the reroll button's own render-time filter, a
 * real (if bounded) widening left for its own pass rather than rushed in here.
 */
export async function declareNemesis(actor) {
  const target = game.user.targets.first()?.actor;
  if (!target) {
    ui.notifications.warn(game.i18n.localize('E20.NemesisNoTarget'));
    return false;
  }

  await actor.setFlag('essence20', NEMESIS_FLAG, target.uuid);
  return true;
}

/**
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {Boolean}
 */
export function checkNemesis(actor, target) {
  const nemesisUuid = actor.getFlag?.('essence20', NEMESIS_FLAG);
  return !!nemesisUuid && !!target?.uuid && nemesisUuid == target.uuid;
}
