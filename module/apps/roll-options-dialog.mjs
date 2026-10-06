import { applyThemeClass } from "../settings.js";

import { serializeFormSubmits } from "./serialize-form-submits.mjs";
import { linkEdgeToggle } from "../helpers/edge-toggle-link.mjs";
/**
 * The extension controls (helpers/extensions.mjs#registerDialogToggles): every ext_* field, by name -
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
    // Enviro-Sealed's switch moves the Snag/Normal/Edge radio with it - see helpers/edge-toggle-link.mjs.
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
    // helpers/skill-effects.mjs), named by the effect's own id rather than a fixed field like
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
      applyDamageDouble: form?.applyDamageDouble?.checked,
      akimbo: form?.akimbo?.checked,
      alphaStrike: form?.alphaStrike?.checked,
      emptyTheMag: form?.emptyTheMag?.checked,
      isAiming: form?.isAiming?.checked,
      spendEnergon: form?.spendEnergon?.checked,
      spendStoryPointSpecialized: form?.spendStoryPointSpecialized?.checked,
      applyPenetratingShot: form?.applyPenetratingShot?.checked,
      applyHobble: form?.applyHobble?.checked,
      applyCripplingBlow: form?.applyCripplingBlow?.checked,
      applyDirtyBlows: form?.applyDirtyBlows?.checked,
      applyGrinder: form?.applyGrinder?.checked,
      applyGuardianStrikes: form?.applyGuardianStrikes?.checked,
      applyStickInTheSpokes: form?.applyStickInTheSpokes?.checked,
      applyInterdiction: form?.applyInterdiction?.checked,
      applyPenetratingAim: form?.applyPenetratingAim?.checked,
      applySavantSkill: form?.applySavantSkill?.checked,
      applyMetallikatoIgnoreArmor: form?.applyMetallikatoIgnoreArmor?.checked,
      applyAnalyzeTarget: form?.applyAnalyzeTarget?.checked,
      applySurging: form?.applySurging?.checked,
      applyPsychoanalyst: form?.applyPsychoanalyst?.checked,
      applyCoaxSurrender: form?.applyCoaxSurrender?.checked,
      applyJackOfAllTrades: form?.applyJackOfAllTrades?.checked,
      spendDemolitionDriver: form?.spendDemolitionDriver?.value ? parseInt(form.spendDemolitionDriver.value) : 0,
      spendProgrammable: form?.spendProgrammable?.value ? parseInt(form.spendProgrammable.value) : 0,
      applyMenacingGlare: form?.applyMenacingGlare?.checked,
      applyNoFactor: form?.applyNoFactor?.checked,
      applyCunningPlan: form?.applyCunningPlan?.checked,
      applyWorthAShot: form?.applyWorthAShot?.checked,
      applyInventor: form?.applyInventor?.checked,
      applyAmbitious: form?.applyAmbitious?.checked,
      applyBeloved: form?.beloved?.value == 'upshift',
      belovedRemoveSnag: form?.beloved?.value == 'removeSnag',
      applyStraightShooter: form?.applyStraightShooter?.checked,
      applyKindButFirm: form?.applyKindButFirm?.checked,
      applySaberToothed: form?.applySaberToothed?.checked,
      applyDeceptiveWarfare: form?.applyDeceptiveWarfare?.checked,
      applyPseudoScience: form?.applyPseudoScience?.checked,
      applyQuantumCut: form?.applyQuantumCut?.checked,
      applySoloShot: form?.applySoloShot?.checked,
      applyObserverSnagSubstitution: form?.applyObserverSnagSubstitution?.checked,
      applyCombatStance: form?.applyCombatStance?.checked,
      applyRetribution: form?.applyRetribution?.checked,
      applyWitheringFire: form?.applyWitheringFire?.checked,
      applyDependable: form?.applyDependable?.checked,
      applyDependableBoth: form?.applyDependableBoth?.checked,
      applyOldReliable: form?.applyOldReliable?.checked,
      applyOldReliableBoth: form?.applyOldReliableBoth?.checked,
      applyLegendaryDependability: form?.applyLegendaryDependability?.checked,
      applyDisarmingShot: form?.applyDisarmingShot?.checked,
      applyTargetVesselSystem: form?.applyTargetVesselSystem?.checked,
      wildAnimalKitSkill: form?.wildAnimalKitSkill?.value || null,
      applyAngry: form?.applyAngry?.checked,
      applyRetrogen: form?.applyRetrogen?.checked,
      // Toggles the dialog template already rendered but nothing read back until 2026-09-25.
      applyPressureCooker: form?.applyPressureCooker?.checked,
      applyEnviroSealedAdverseSituation: form?.applyEnviroSealedAdverseSituation?.checked,
      applyRicochet: form?.applyRicochet?.checked,
      applyPythonized: form?.applyPythonized?.checked,
      applyFastDraw: form?.applyFastDraw?.checked,
      applyDoubleAgent: form?.applyDoubleAgent?.checked,
      applyGetAGrip: form?.applyGetAGrip?.checked,
      applyInstillWeakness: form?.applyInstillWeakness?.checked,
      applyDeconstructionist: form?.applyDeconstructionist?.checked,
      spendSizeMatters: form?.spendSizeMatters ? parseInt(form.spendSizeMatters.value) || 0 : 0,
      spendCautionToTheWind: form?.spendCautionToTheWind ? parseInt(form.spendCautionToTheWind.value) || 0 : 0,
      applyIntimidatingWeapon: form?.applyIntimidatingWeapon?.checked,
      // Fanning - clamped again in dice.mjs (clampFanningShots), so a hand-typed value can't exceed X.
      fanningShots: form?.fanningShots ? parseInt(form.fanningShots.value) || 0 : 0,
      allOutAttackShifts: form?.allOutAttackShifts ? parseInt(form.allOutAttackShifts.value) || 0 : 0,
      evasiveFightingShifts: form?.evasiveFightingShifts ? parseInt(form.evasiveFightingShifts.value) || 0 : 0,
      pinpointCount: form?.pinpointCount ? parseInt(form.pinpointCount.value) || 0 : 0,
      applyMakeAnOpening: form?.applyMakeAnOpening?.checked,
      applySteadyHand: form?.applySteadyHand?.checked,
      kitRequired: form?.kitRequired?.value || 'none',
      applySynapticEdge: form?.applySynapticEdge?.checked,
      // Extension controls (extToggles) - every ext_* field, by its own name.
      ext: readExtensionControls(form),
      applyTwentyPercentCooler: form?.applyTwentyPercentCooler?.checked,
      drivingStrike: form?.drivingStrike?.value,
      hardpointMovePenalty: form?.hardpointMovePenalty ? parseInt(form.hardpointMovePenalty.value) : 0,
      defenseType: form.defenseType.value,
      selectedSkillEffectIds,
      disabledModifierSourceIds,
    });
  }
}
