import { setEntryAndAddActor, verifyDropSelection } from "../sheet-handlers/drop-handler.mjs";
import { getFormData } from "../helpers/application.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class VehicleRoleSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(droppedActor, targetActor, choices, title){
    super();
    this._targetActor = targetActor;
    this._droppedActor = droppedActor;
    this._choices = choices;
    this._title = title;
  }

  static DEFAULT_OPTIONS = {
    id: "vehicle-role",
    classes: [
      "essence20",
      "trait-selector",
      "subconfig",
      "window-app",
    ],
    tag: "form",
    title: "E20.SelectDefaultTitle",
    form: {
      handler: VehicleRoleSelector.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/vehicle-role-select.hbs",
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
      { type: "submit", label: "E20.AcceptButton" },
    ];
    return context;
  }

  static async myFormHandler(event, form, formData){
    const newRole = getFormData(formData.object);

    const allowDrop = verifyDropSelection(this._targetActor, newRole);

    if (!allowDrop) {
      throw new Error(game.i18n.localize('E20.VehicleRoleError'));
    }

    setEntryAndAddActor(this._droppedActor, this._targetActor, newRole);
  }
}
