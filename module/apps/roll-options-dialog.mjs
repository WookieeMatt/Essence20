import { applyThemeClass } from "../settings.js";

import { serializeFormSubmits } from "./serialize-form-submits.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The skill/attack/initiative roll options popup (shift up/down, snag/edge, specialization,
 * crit-on-2). Resolves the Promise passed in by RollDialog.getSkillRollOptions with either the
 * processed form options, or { cancelled: true } if closed/cancelled.
 */
export default class RollOptionsDialog extends serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2)) {
  constructor(context, title, resolve) {
    super();
    this._context = context;
    this._dialogTitle = title;
    this._resolve = resolve;
    this._resolved = false;
  }

  static DEFAULT_OPTIONS = {
    id: "roll-options",
    classes: [
      "essence20",
      "theme-wrapper",
      "roll-dialog-app",
      "subconfig",
      "window-app",
    ],
    tag: "form",
    form: {
      handler: RollOptionsDialog.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    actions: {
      cancel: RollOptionsDialog.onCancel,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/dialog/roll-dialog.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  get title() {
    return this._dialogTitle;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    Object.assign(context, this._context);
    context.buttons = [
      { type: "submit", label: "E20.RollDialogRollButton" },
      { type: "button", action: "cancel", label: "E20.DialogCancelButton" },
    ];
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    applyThemeClass(this.element);
  }

  _onClose(options) {
    super._onClose(options);

    if (!this._resolved) {
      this._resolved = true;
      this._resolve({ cancelled: true });
    }
  }

  static onCancel() {
    this.close();
  }

  static myFormHandler(event, form) {
    this._resolved = true;
    this._resolve({
      canCritD2: form.canCritD2.checked,
      edge: form.snagEdge.value == 'edge',
      shiftDown: parseInt(form.shiftDown.value),
      shiftUp: parseInt(form.shiftUp.value),
      snag: form.snagEdge.value == 'snag',
      isSpecialized: form.isSpecialized.checked,
      // No longer a player-facing field (removed from roll-dialog.hbs) - always a single roll.
      timesToRoll: 1,
      applyRolePointsUpshift: form?.applyRolePointsUpshift?.checked,
      applyRolePointsDamage: form?.applyRolePointsDamage?.checked,
      applyDamageDouble: form?.applyDamageDouble?.checked,
      akimbo: form?.akimbo?.checked,
      alphaStrike: form?.alphaStrike?.checked,
      emptyTheMag: form?.emptyTheMag?.checked,
      isAiming: form?.isAiming?.checked,
      spendEnergon: form?.spendEnergon?.checked,
      drivingStrike: form?.drivingStrike?.value,
      defenseType: form.defenseType.value,
    });
  }
}
