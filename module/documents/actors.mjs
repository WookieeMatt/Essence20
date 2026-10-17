/**
 * The world Actor collection (`game.actors`), extended with a `party` accessor for the squad
 * the GM has pinned as primary via the `essence20.primaryParty` setting. Registered as
 * CONFIG.Actor.collection in essence20.mjs.
 */
export class Essence20Actors extends foundry.documents.collections.Actors {
  /**
   * The pinned primary Party actor, or null when nothing is pinned, the pinned id no longer
   * resolves, or the pinned actor isn't a Party.
   * @type {Actor|null}
   */
  get party() {
    const id = game.settings.get('essence20', 'primaryParty');
    const actor = id ? this.get(id) : null;
    return actor?.type == 'party' ? actor : null;
  }
}
