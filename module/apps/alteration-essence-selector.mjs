import { _alterationStatUpdate, _processAlterationSkillIncrease, _showAlterationCostSkillDialog } from "../sheet-handlers/alteration-handler.mjs";
import { getFormData} from "../helpers/application.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class AlterationEssenceSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(choices, actor, alteration, alterationUuid, dropFunc, title, bonusSkill, costEssence){
    super();
    this._choices = choices;
    this._actor = actor;
    this._alteration = alteration;
    this._alterationUuid = alterationUuid;
    this._dropFunc = dropFunc;
    this._title = title;
    this._bonusSkill = bonusSkill;
    this._costEssence = costEssence;
  }

  static DEFAULT_OPTIONS = {
    id: "alteration-essence",
    classes: [
      "essence20",
      "trait-selector",
      "subconfig",
      "window-app",
    ],
    tag: "form",
    title: "E20.SelectDefaultTitle",
    form: {
      handler: AlterationEssenceSelector.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/option-select.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  get title() {
    return game.i18n.localize(this._title) || game.i18n.localize(super.title);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.choices = this._choices;
    context.buttons = [
      { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
    ];
    return context;
  }

  static async myFormHandler(event, form, formData) {
    const selection = getFormData(formData.object);
    if (!this._bonusSkill) {
      _processAlterationSkillIncrease(this._actor, this._alteration, selection, this._alterationUuid, this._dropFunc);
    } else if (!this._costEssence && this._alteration.system.essenceCost.length > 1) {
      _showAlterationCostSkillDialog(this._actor, this._alteration, this._bonusSkill, this._alterationUuid, selection, this._dropFunc);
    } else {
      _alterationStatUpdate(this._actor, this._alteration, this._bonusSkill, this._costEssence, selection, this._alterationUuid, this._dropFunc);
    }
  }
}
