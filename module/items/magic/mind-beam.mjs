/**
 * Mind Beam (MLP CRB, Virtuoso Beam spell, p.139): a single-target Beam that hits the mind - no
 * damage, one effect of Calm/Confused/Frightened/Impaired/Stunned instead. (5-option catalog; RAW
 * also has a Mastery-time "default effect" pick, switchable per-cast for an extra ↓1 cost.)
 *
 * Only 3 of the 5 named effects are offered - Frightened, Impaired, and Stunned are all real,
 * already-registered Conditions in this system (`E20.statusEffects`), and RAW's own description of
 * each reads as this system's own existing Condition. Calm (↑2 on Social tests against the target,
 * broken by harm) and Confused (random movement, no attacking anyone) both need a genuinely NEW mechanism - Calm a reactive "clear on
 * next damage taken" hook this system has no generic version of yet, Confused an unenforceable
 * random-movement/behavior-restriction with no numeric effect to hook onto at all - so both are
 * left out of the picker entirely, the same "don't offer a choice with nothing behind it" idiom
 * Grid Surge/Wisdom of the Elders already established, rather than force a half-built entry in.
 *
 * The RAW "Mastery-time default effect, switchable for +1 cost" layer is also dropped - this
 * codebase has no build-time "when you gain this spell, pick X" mechanism for spells at all (spells
 * are auto-granted by Spellcasting Rank increases, never individually "chosen" the way a Perk/
 * Power's own hasChoice picker works), and building one solely for this single item's own cost
 * nuance would be disproportionate - the player simply picks an effect fresh every cast, the same
 * per-cast-choice shape Grid Surge's own picker already uses for an even larger option catalog.
 */
export async function pickMindBeamEffect() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.MindBeamPickEffectTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.MindBeamPickEffectLabel')
    }</label><select name="effect">
      <option value="frightened">${game.i18n.localize('E20.StatusFrightened')}</option>
      <option value="impaired">${game.i18n.localize('E20.StatusImpaired')}</option>
      <option value="stunned">${game.i18n.localize('E20.StatusStunned')}</option>
      <option value="calm">${game.i18n.localize('E20.ReactStatus_calm')}</option>
      <option value="confused">${game.i18n.localize('E20.ReactStatus_confused')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.effect.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}
