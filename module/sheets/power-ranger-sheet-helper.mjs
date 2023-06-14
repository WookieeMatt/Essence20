/**
 * Prepare Zords for MFZs.
 *
 * @param {Object} context The actor data to prepare
 * @param {Actor} actor    The actor
 */
export function prepareZords(context, actor) {
  if (actor.type == 'megaformZord') {
    let zords = [];

    for (let zordId of actor.system.zordIds) {
      zords.push(game.actors.get(zordId));
    }

    context.zords = zords;
  }
}

/**
 * Handle deleting Zords from MFZs
 * @param {Event} event The originating click event
 */
export async function onZordDelete(event) {
  const li = $(event.currentTarget).parents(".zord");
  const zordId = li.data("zordId");
  const zordIds = this.actor.system.zordIds.filter(x => x !== zordId);
  this.actor.update({ "system.zordIds": zordIds });
  li.slideUp(200, () => this.render(false));
}

/**
 * Handle morphing an Actor
 */
export async function onMorph() {
  await this.actor.update({
    "system.isMorphed": !this.actor.system.isMorphed,
  }).then(this.render(false));
}
