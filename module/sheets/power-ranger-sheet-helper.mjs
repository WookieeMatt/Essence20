export class PowerRangerSheetHandler {
  /**
   * Constructor
   * @param {Essence20ActorSheet} actorSheet The actor sheet
   */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  /**
   * Prepare Zords for MFZs.
   * @param {Object} context The actor data to prepare
   */
  prepareZords(context) {
    if (this._actor.type == 'megaformZord') {
      let zords = [];

      for (let zordId of this._actor.system.zordIds) {
        zords.push(game.actors.get(zordId));
      }

      context.zords = zords;
    }
  }

  /**
   * Handle deleting Zords from MFZs
   * @param {Event} event The originating click event
   */
  async onZordDelete(event) {
    const li = $(event.currentTarget).parents(".zord");
    const zordId = li.data("zordId");
    const zordIds = this._actor.system.zordIds.filter(x => x !== zordId);
    this._actor.update({ "system.zordIds": zordIds });
    li.slideUp(200, () => this._actorSheet.render(false));
  }

  /**
   * Handle morphing an Actor
   */
  async onMorph() {
    await this._actor.update({
      "system.isMorphed": !this._actor.system.isMorphed,
    }).then(this._actorSheet.render(false));
  }
}
