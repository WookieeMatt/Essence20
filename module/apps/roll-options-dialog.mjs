import { applyThemeClass } from "../settings.js";

import { serializeFormSubmits } from "./serialize-form-submits.mjs";
import { linkEdgeToggle } from "../mechanics/rolls/edge-toggle-link.mjs";
/**
 * The extension controls (mechanics/item-hooks.mjs#registerDialogToggles): every ext_* field, by name -
 * a checkbox as true/false, anything else as its value.
 * @param {HTMLFormElement} form
 * @returns {Object}
 */
function readExtensionControls(form) {
  const ext = {};
  for (const element of form?.elements ?? []) {
    if (!element.name?.startsWith?.('ext_')) {
      continue;
    }

    ext[element.name.slice(4)] = element.type == 'checkbox' ? element.checked : element.value;
  }

  return ext;
}

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
      "e20-window",
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
    // Enviro-Sealed's switch moves the Snag/Normal/Edge radio with it - see mechanics/rolls/edge-toggle-link.mjs.
    linkEdgeToggle(this.element, "applyEnviroSealedAdverseSituation");
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
    // Dynamic - one checkbox per currently-disabled effect relevant to this roll (see
    // mechanics/rolls/skill-effects.mjs), named by the effect's own id rather than a fixed field like
    // every option above, so this can't be read by a fixed name the way isAiming/akimbo/etc. are.
    const selectedSkillEffectIds = (this._context.availableSkillEffects ?? [])
      .filter(skillEffect => form[`skillEffect-${skillEffect.id}`]?.checked)
      .map(skillEffect => skillEffect.id);
    // Automatic combat modifier sources (see dice.mjs#_getAutomaticCombatModifiers's own
    // addSource doc comment) - each renders checked by default (see roll-dialog.hbs), so this
    // collects which ones the player unchecked, the inverse of selectedSkillEffectIds above.
    const disabledModifierSourceIds = (this._context.shiftModifierSources ?? [])
      .filter(source => !form[`combatModifierSource-${source.id}`]?.checked)
      .map(source => source.id);
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
      isAiming: form?.isAiming?.checked,
      spendEnergon: form?.spendEnergon?.checked,
      spendStoryPointSpecialized: form?.spendStoryPointSpecialized?.checked,
      applyObserverSnagSubstitution: form?.applyObserverSnagSubstitution?.checked,
      applyTargetVesselSystem: form?.applyTargetVesselSystem?.checked,
      wildAnimalKitSkill: form?.wildAnimalKitSkill?.value || null,
      applyRetrogen: form?.applyRetrogen?.checked,
      // Toggles the dialog template already rendered but nothing read back until 2026-09-25.
      applyEnviroSealedAdverseSituation: form?.applyEnviroSealedAdverseSituation?.checked,
      applyIntimidatingWeapon: form?.applyIntimidatingWeapon?.checked,
      // Fanning - clamped again in dice.mjs (clampFanningShots), so a hand-typed value can't exceed X.
      fanningShots: form?.fanningShots ? parseInt(form.fanningShots.value) || 0 : 0,
      kitRequired: form?.kitRequired?.value || 'none',
      // Extension controls (extToggles) - every ext_* field, by its own name.
      ext: readExtensionControls(form),
      hardpointMovePenalty: form?.hardpointMovePenalty ? parseInt(form.hardpointMovePenalty.value) : 0,
      defenseType: form.defenseType.value,
      selectedSkillEffectIds,
      disabledModifierSourceIds,
    });
  }
}
