/**
 * Resolves the essence20 Automation Ledger's "Cross-actor permanent grant chosen at build time"
 * gap for its simplest shape: a Perk phrased "you OR one member of your Power Ranger team," chosen
 * once at Perk-acquisition time (not a later click, not a scene/token-based ally scan - the
 * existing getNearbyAllyTokens/pickAllyTargets idiom Helping Hand/Plan of Action already use needs
 * an active scene with placed tokens, which won't exist while a player is simply leveling up).
 * This scans every playerCharacter Actor that exists in the world (the same "search everything,
 * offer a picker" idiom Torozord Feature's own compendium-wide Zord Feature scan already
 * established, just over game.actors instead of game.packs) - there's no "party roster" concept
 * this project's own Party/Squad actor type is assumed to always be populated with, so this is the
 * more universally-correct source of "your team."
 * @param {Actor} actor   The Perk holder - always offered as the first, default choice ("Yourself").
 * @param {String} title   Dialog window title (the Perk's own name reads well here).
 * @returns {Promise<Actor|null>}   The chosen target Actor, or null if cancelled.
 */
export async function pickSelfOrTeamMember(actor, title) {
  const teammates = (game.actors ?? []).filter(candidate =>
    candidate.type == 'playerCharacter' && candidate.uuid != actor.uuid);

  const options = [
    `<option value="${actor.uuid}">${game.i18n.localize('E20.Yourself')}</option>`,
    ...teammates.map(teammate => `<option value="${teammate.uuid}">${teammate.name}</option>`),
  ].join('');

  const chosenUuid = await foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.SelectSelfOrTeamMember')
    }</label><select name="target">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.target.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  if (!chosenUuid || chosenUuid == 'cancel') {
    return null;
  }

  return chosenUuid == actor.uuid ? actor : fromUuidSync(chosenUuid);
}
