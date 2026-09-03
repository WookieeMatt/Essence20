/**
 * Fixes a real gap in Foundry core: ApplicationV2#_onChangeForm
 * (client/applications/api/application.mjs) fires _onSubmitForm on every form change WITHOUT
 * awaiting it - nothing in core serializes overlapping submissions. Two field changes made in
 * quick succession (well within an ordinary click-click cadence, not just automation) each
 * capture their own FormDataExtended snapshot of the WHOLE form at the moment they fire; if the
 * first submission's document.update() happens to resolve AFTER the second's, its now-stale
 * full-form snapshot overwrites whatever the second change just wrote. This is exactly how a
 * Perk's own Reroll config (module/sheets/item-sheet.mjs) was observed silently reverting/
 * cross-contaminating fields after two rapid dropdown changes - not a bug in that sheet's own
 * code, a race in the form-submission plumbing underneath it.
 *
 * Applied as a mixin (not a base class) so it can wrap whichever mix of DocumentSheetV2/
 * ActorSheetV2/plain ApplicationV2 a given sheet or app already extends. Every one of them shares
 * the exact same _onSubmitForm(formConfig, event) from ApplicationV2 itself - DocumentSheetV2
 * only overrides _onChangeForm, for its own unrelated secret-block special case, and still
 * funnels an ordinary form change into this same _onSubmitForm - so overriding it here once,
 * lower in the chain, covers all of them without needing to know which one a given caller mixes
 * in.
 * @param {typeof foundry.applications.api.ApplicationV2} Base
 * @returns {typeof foundry.applications.api.ApplicationV2}
 */
export function serializeFormSubmits(Base) {
  return class extends Base {
    /** @inheritDoc */
    async _onSubmitForm(formConfig, event) {
      // event (and event.currentTarget) is only guaranteed valid during its own synchronous
      // dispatch - the DOM spec nulls currentTarget out once dispatch ends - so both are read
      // right now, before this submission's own turn in the queue below, rather than held onto
      // across that delay. The real submit logic (ApplicationV2#_onSubmitForm) only ever reads
      // event.preventDefault() and event.currentTarget, so a minimal stand-in exposing just
      // those is enough to hand it later.
      event.preventDefault();
      const form = event.currentTarget;
      const queuedEvent = { currentTarget: form, preventDefault: () => {} };

      const run = () => super._onSubmitForm(formConfig, queuedEvent);
      // .then(run, run) - the next submission runs whether the previous one resolved OR
      // rejected, so one failed/erroring submit never permanently jams the queue for every
      // change after it.
      const queue = (this._formSubmitQueue ?? Promise.resolve()).then(run, run);
      this._formSubmitQueue = queue.catch(err => console.error(err));
      return queue;
    }
  };
}
