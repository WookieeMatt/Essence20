export class Essence20Dialog extends Dialog {
  constructor(dialogData = {}, options = {}) {
    super(dialogData, options);
  }

  activeListeners(html) {
    super.activateListeners(html);

    html.find('.alteration-movement-increase').click(this._onAlterationMovementIncrease.bind(this));

    html.find('.alteration-movement-decrease').click(this._onAlterationMovementDecrease.bind(this));

  }

  _onAlterationMovementIncrease() {
    console.log("Got Here");
  }

  _onAlterationMovementDecrease() {
    console.log("Got Here2");
  }
}
