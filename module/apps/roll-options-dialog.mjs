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
      twoHandedAssault: form?.twoHandedAssault?.checked,
      alphaStrike: form?.alphaStrike?.checked,
      emptyTheMag: form?.emptyTheMag?.checked,
      isAiming: form?.isAiming?.checked,
      spendEnergon: form?.spendEnergon?.checked,
      spendStoryPointSpecialized: form?.spendStoryPointSpecialized?.checked,
      applyStrikeBonus: form?.applyStrikeBonus?.checked,
      applyHeavyForce: form?.applyHeavyForce?.checked,
      spendIdeaPoint: form?.spendIdeaPoint?.checked,
      applyPrecisionAim: form?.applyPrecisionAim?.checked,
      applySneakAttackKoc: form?.applySneakAttackKoc?.checked,
      applyWowTheAudience10: form?.applyWowTheAudience10?.checked,
      applyWowTheAudience100: form?.applyWowTheAudience100?.checked,
      applyWowTheAudience1000: form?.applyWowTheAudience1000?.checked,
      applyAllINeedIsOneShot: form?.applyAllINeedIsOneShot?.checked,
      applyPenetratingShot: form?.applyPenetratingShot?.checked,
      applyHobble: form?.applyHobble?.checked,
      applyCripplingBlow: form?.applyCripplingBlow?.checked,
      applyDirtyBlows: form?.applyDirtyBlows?.checked,
      applyGrinder: form?.applyGrinder?.checked,
      applyCryogenicTouch: form?.applyCryogenicTouch?.checked,
      applyGuardianStrikes: form?.applyGuardianStrikes?.checked,
      applyStickInTheSpokes: form?.applyStickInTheSpokes?.checked,
      applyInterdiction: form?.applyInterdiction?.checked,
      applyPenetratingAim: form?.applyPenetratingAim?.checked,
      applySavantSkill: form?.applySavantSkill?.checked,
      applyMetallikatoIgnoreArmor: form?.applyMetallikatoIgnoreArmor?.checked,
      applyAnalyzeTarget: form?.applyAnalyzeTarget?.checked,
      applyPsychoanalyst: form?.applyPsychoanalyst?.checked,
      applyCoaxSurrender: form?.applyCoaxSurrender?.checked,
      applyCharge: form?.applyCharge?.checked,
      applyBumpAndRun: form?.applyBumpAndRun?.checked,
      applyUnshakeableAim: form?.applyUnshakeableAim?.checked,
      applyJackOfAllTrades: form?.applyJackOfAllTrades?.checked,
      applyTargetVulnerability: form?.applyTargetVulnerability?.checked,
      spendTerror: form?.spendTerror?.value ? parseInt(form.spendTerror.value) : 0,
      spendDemolitionDriver: form?.spendDemolitionDriver?.value ? parseInt(form.spendDemolitionDriver.value) : 0,
      spendProgrammable: form?.spendProgrammable?.value ? parseInt(form.spendProgrammable.value) : 0,
      spendSolusCharge: form?.spendSolusCharge?.value ? parseInt(form.spendSolusCharge.value) : 0,
      applyMenacingGlare: form?.applyMenacingGlare?.checked,
      applyNoFactor: form?.applyNoFactor?.checked,
      applyCunningPlan: form?.applyCunningPlan?.checked,
      applyWorthAShot: form?.applyWorthAShot?.checked,
      applyMachinist: form?.applyMachinist?.checked,
      applyBootlicker: form?.applyBootlicker?.checked,
      applyInventor: form?.applyInventor?.checked,
      applyGoodSociety: form?.applyGoodSociety?.checked,
      applyTongues: form?.applyTongues?.checked,
      applyHuntersProwess: form?.applyHuntersProwess?.checked,
      applyAmbitious: form?.applyAmbitious?.checked,
      applyIsolated: form?.applyIsolated?.checked,
      applyIRememberReadingAbout: form?.applyIRememberReadingAbout?.checked,
      applyGutterChampion: form?.applyGutterChampion?.checked,
      applyBeloved: form?.applyBeloved?.checked,
      applyThrillseeker: form?.applyThrillseeker?.checked,
      applyStraightShooter: form?.applyStraightShooter?.checked,
      applyHowStrange: form?.applyHowStrange?.checked,
      applyKindButFirm: form?.applyKindButFirm?.checked,
      applyWireWork: form?.applyWireWork?.checked,
      applyAmbushPredator: form?.applyAmbushPredator?.checked,
      applyCitySlicker: form?.applyCitySlicker?.checked,
      applyHesher: form?.applyHesher?.checked,
      applyBruteForceIaf2: form?.applyBruteForceIaf2?.checked,
      applyRoaringEngine: form?.applyRoaringEngine?.checked,
      applyWhipIntoShape: form?.applyWhipIntoShape?.checked,
      applyTechnicallyCorrect: form?.applyTechnicallyCorrect?.checked,
      applySaberToothed: form?.applySaberToothed?.checked,
      applyEverVigilant: form?.applyEverVigilant?.checked,
      applyNoseForTrouble: form?.applyNoseForTrouble?.checked,
      applyDangerSense: form?.applyDangerSense?.checked,
      applyNeedleDrop: form?.applyNeedleDrop?.checked,
      applyRapidDeploymentDrillsAlertness: form?.applyRapidDeploymentDrillsAlertness?.checked,
      applyRapidDeploymentDrillsInfiltration: form?.applyRapidDeploymentDrillsInfiltration?.checked,
      applyTf1sDeceptiveWarfareDeception: form?.applyTf1sDeceptiveWarfareDeception?.checked,
      applyTf1sDeceptiveWarfareInfiltration: form?.applyTf1sDeceptiveWarfareInfiltration?.checked,
      applyYourReputationPrecedesYou: form?.applyYourReputationPrecedesYou?.checked,
      applyDeceptiveWarfare: form?.applyDeceptiveWarfare?.checked,
      applyBrainPower: form?.applyBrainPower?.checked,
      applySeeingTheMatrix: form?.applySeeingTheMatrix?.checked,
      applyMightierThanTheSword: form?.applyMightierThanTheSword?.checked,
      applyPseudoScience: form?.applyPseudoScience?.checked,
      applyQuantumCut: form?.applyQuantumCut?.checked,
      applySoloShot: form?.applySoloShot?.checked,
      spendEltarianTech: form?.spendEltarianTech?.checked,
      applySpellcialize: form?.applySpellcialize?.checked,
      applyObserverSnagSubstitution: form?.applyObserverSnagSubstitution?.checked,
      spendSupremeGuardianTech: form?.spendSupremeGuardianTech?.value ? parseInt(form.spendSupremeGuardianTech.value) : 0,
      applyCombatStance: form?.applyCombatStance?.checked,
      applyRetribution: form?.applyRetribution?.checked,
      applyWitheringFire: form?.applyWitheringFire?.checked,
      applyDependableTanker: form?.applyDependableTanker?.checked,
      applyHackingAlgorithms: form?.applyHackingAlgorithms?.checked,
      applyDependable: form?.applyDependable?.checked,
      applyDependableBoth: form?.applyDependableBoth?.checked,
      applyOldReliable: form?.applyOldReliable?.checked,
      applyOldReliableBoth: form?.applyOldReliableBoth?.checked,
      applyLegendaryDependability: form?.applyLegendaryDependability?.checked,
      applyExplosiveEngineerScience: form?.applyExplosiveEngineerScience?.checked,
      applyExplosiveEngineerTechnology: form?.applyExplosiveEngineerTechnology?.checked,
      applyAlwaysReady: form?.applyAlwaysReady?.checked,
      applyDisarmingShot: form?.applyDisarmingShot?.checked,
      applyStreetSmarts: form?.applyStreetSmarts?.checked,
      applyPrimalFear: form?.applyPrimalFear?.checked,
      applyNaturalScienceToSurvival: form?.applyNaturalScienceToSurvival?.checked,
      applyNaturalScienceToScience: form?.applyNaturalScienceToScience?.checked,
      applyScienceFixesAll: form?.applyScienceFixesAll?.checked,
      applyUrbanJungle: form?.applyUrbanJungle?.checked,
      applyFearIsUniversal: form?.applyFearIsUniversal?.checked,
      applyCobraBattleCryDeception: form?.applyCobraBattleCryDeception?.checked,
      applyCobraBattleCryIntimidation: form?.applyCobraBattleCryIntimidation?.checked,
      applyAngry: form?.applyAngry?.checked,
      drivingStrike: form?.drivingStrike?.value,
      hardpointMovePenalty: form?.hardpointMovePenalty ? parseInt(form.hardpointMovePenalty.value) : 0,
      defenseType: form.defenseType.value,
      selectedSkillEffectIds,
      disabledModifierSourceIds,
    });
  }
}
