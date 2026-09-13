/**
 * Matured (Cobra Codex, General Perk, p.176, prerequisite: at least one Influence Hang-Up):
 * "You've grown as a person and gotten out of the shadows of your past. Ignore one Influence's
 * Hang-Up."
 *
 * Widened findHangUp() itself (helpers/perks.mjs) to skip a Hang-Up item flagged 'maturedIgnored'
 * - that covers every code-driven Hang-Up check automatically (Angry's own Snag, Skeptic's own
 * reciprocal Edge, Indoctrinated's, etc.), without each one needing its own Matured-awareness.
 * A Hang-Up whose mechanic instead lives on a passive compendium Active Effect (rather than being
 * checked in code at all) needs its own effects disabled directly, done here too, so either shape
 * of Hang-Up is actually silenced by one dispatch.
 *
 * Re-picking is allowed at any time (clicking the Perk's "Use" control again) - the previously
 * ignored Hang-Up (if any) is un-ignored first, so only ONE Hang-Up is ever ignored at a time,
 * matching RAW's own "ignore ONE Influence's Hang-Up" wording.
 *
 * A real wrinkle found before shipping: several Hang-Up items (Tragedy is the clearest example)
 * ship MULTIPLE pre-built effects, all `disabled: true` except the ONE the player already
 * enabled via Foundry's own Effects tab (the same "choose one of N" idiom Chemist/Sea Legs use).
 * Blindly flipping every effect back to enabled when un-ignoring one of THESE would silently
 * re-enable options the player never chose. Only a single-effect Hang-Up (the common case for
 * every other Hang-Up in this codebase) has its own effect toggled here; a multi-effect Hang-Up's
 * effects are left alone even while ignored - only the code-level maturedIgnored flag (which
 * findHangUp/actorHasHangUp already respect) suppresses it, a documented, narrower limitation
 * rather than a silently wrong one.
 */

function getIgnorableHangUps(actor) {
  return actor?.items?.filter(item => item.type == 'hangUp') ?? [];
}

/**
 * Prompts for which of the actor's own Hang-Ups to ignore. Returns null (nothing to pick, or
 * picker cancelled) if the actor holds no Hang-Up at all.
 * @param {Actor} actor
 * @returns {Promise<Item|null>}
 */
export async function pickMaturedHangUp(actor) {
  const hangUps = getIgnorableHangUps(actor);
  if (!hangUps.length) {
    return null;
  }

  const options = hangUps.map(hangUp => `<option value="${hangUp.id}">${hangUp.name}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.MaturedPickHangUpTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.MaturedPickHangUpLabel')
    }</label><select name="hangUp">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.hangUp.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  if (!chosen || chosen == 'cancel') {
    return null;
  }

  return hangUps.find(hangUp => hangUp.id == chosen) ?? null;
}

/**
 * Prompts for and applies Matured's ignore - clears any previously-ignored Hang-Up first, then
 * flags the newly-chosen one and disables its own Active Effects (if any).
 * @param {Actor} actor
 * @returns {Promise<Item|null>}   The Hang-Up now being ignored, or null if nothing was picked.
 */
export async function applyMatured(actor) {
  const hangUp = await pickMaturedHangUp(actor);
  if (!hangUp) {
    return null;
  }

  for (const previouslyIgnored of getIgnorableHangUps(actor)) {
    if (previouslyIgnored.id != hangUp.id && previouslyIgnored.getFlag('essence20', 'maturedIgnored')) {
      await previouslyIgnored.unsetFlag('essence20', 'maturedIgnored');
      if (previouslyIgnored.effects.size == 1) {
        await [...previouslyIgnored.effects][0].update({ disabled: false });
      }
    }
  }

  await hangUp.setFlag('essence20', 'maturedIgnored', true);
  if (hangUp.effects.size == 1) {
    await [...hangUp.effects][0].update({ disabled: true });
  }

  return hangUp;
}
