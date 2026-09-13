/**
 * Mind Beam (MLP CRB, Virtuoso Beam spell, p.139): "Your beam affects your target's mind instead
 * of their body... you target a single creature within range, but instead of damage, your Beam
 * has the following effect: Calm/Confused/Frightened/Impaired/Stunned." (5-option catalog; RAW
 * also has a Mastery-time "default effect" pick, switchable per-cast for an extra ↓1 cost.)
 *
 * Only 3 of the 5 named effects are offered - Frightened, Impaired, and Stunned are all real,
 * already-registered Conditions in this system (`E20.statusEffects`), and RAW's own description of
 * each reads as this system's own existing Condition almost verbatim. Calm ("Social Skill Tests
 * against them gain ↑2... breaks if they are harmed") and Confused ("moves at random... will not
 * attack or harm other creatures") both need a genuinely NEW mechanism - Calm a reactive "clear on
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
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.MindBeamPickEffectLabel')
    }</label><select name="effect">
      <option value="frightened">${game.i18n.localize('E20.StatusFrightened')}</option>
      <option value="impaired">${game.i18n.localize('E20.StatusImpaired')}</option>
      <option value="stunned">${game.i18n.localize('E20.StatusStunned')}</option>
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
