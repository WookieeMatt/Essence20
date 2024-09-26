export class EssenceManager extends FormApplication {
  constructor(actor) {
    super();
    this.actor = actor;
  }

  static get defaultOptions() {
    const defaults = super.defaultOptions
    const overrides = {
      closeOnSubmit: false,
      submitOnChange: true,
      height: 'auto',
      id: 'essence-manager',
      template: 'systems/essence20/templates/app/essence-select.hbs',
      title: 'Spend Initial 12 Essence Points',
    }

    const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
    return mergedOptions;
  }

  getData() {
    console.log(this.actor)
    const essencePoints = this.actor.system.essencePoints;
    return {
      essencePoints: essencePoints,
    }

  }

  activateListeners(html) {

    super.activateListeners(html);

    html.find(".essence-change").change(ev => this.render);
  }

  _updateObject(event, formData) {
    const expandedData = foundry.utils.expandObject(formData);
    const newEssencePoints = 12 - expandedData.system.smarts.max - expandedData.system.social.max - expandedData.system.speed.max - expandedData.system.strength.max
    this.actor.update({
      'system.essences.smarts.max': expandedData.system.smarts.max,
      'system.essences.social.max': expandedData.system.social.max,
      'system.essences.speed.max': expandedData.system.speed.max,
      'system.essences.strength.max': expandedData.system.strength.max,
      'system.essencePoints': newEssencePoints,
    })

  }
}

window.EssenceManager = EssenceManager;
