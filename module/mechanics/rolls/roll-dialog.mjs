import { pr2NoUntrainedSnag } from "../../items/social/instructor-legacy-students.mjs";
import { skillKitNoUntrainedSnag } from "../resources/kits.mjs";
import { ruleNoUntrainedSnag } from "../../rules/adapter.mjs";
import { useUntrainedSnagImmunity } from "../../rules/plugins/rolls/untrained-snag-immunity.mjs";
import { E20 } from "../../util/config.mjs";
import RollOptionsDialog from "../../apps/roll-options-dialog.mjs";

/**
 * Splits every automatic combat modifier that fired this roll (see
 * dice.mjs#_getAutomaticCombatModifiers's own addSource doc comment) into the shiftUp/shiftDown-
 * granting ones - each gets its own individually-toggleable switch in the dialog (see
 * roll-dialog.hbs) - and the edge/snag-granting ones, which are informational only: their names
 * just annotate the existing Snag/Normal/Edge radio's own labels rather than getting a second,
 * redundant toggle of their own (that radio is already the one interactive control for edge/snag).
 * A small standalone function (rather than inlined into getSkillRollOptions) specifically so it
 * can be unit tested directly - getSkillRollOptions itself opens a real ApplicationV2 dialog and
 * has no test coverage of its own for that reason, the same split this project already draws for
 * sheet-handler UI wiring generally.
 * @param {Array<{id, label, shiftUp, shiftDown, edge, snag}>} [combatModifierSources]
 * @returns {{shiftModifierSources: Array, edgeSourcesText: String, snagSourcesText: String}}
 */
export function buildCombatModifierSourceFields(combatModifierSources) {
  const sources = combatModifierSources || [];
  return {
    shiftModifierSources: sources.filter(source => source.shiftUp || source.shiftDown),
    edgeSourcesText: sources.filter(source => source.edge).map(source => source.label).join(', '),
    snagSourcesText: sources.filter(source => source.snag).map(source => source.label).join(', '),
  };
}

export class RollDialog {
  /**
   * RollDialog constructor.
   * @param {i18n} i18n   The i18n to use for text localization.
   */
  constructor(i18n=null) {
    this._i18n = i18n;
  }

  /**
   * Localizes the given text.
   * @param {String} text   The text to localize.
   * @param {Object} fmtVars   Optional formatting variables.
   * @returns {String}   The localized text.
   * @private
   */
  _localize(text, fmtVars=null) {
    if (fmtVars) {
      return this._i18n ? this._i18n.format(text, fmtVars) : game.i18n.format(text, fmtVars);
    } else {
      return this._i18n ? this._i18n.localize(text) : game.i18n.localize(text);
    }
  }

  /**
   * Whether an untrained (still-d20-shift) Skill Test rolls with an automatic Snag - the base
   * rule, unless something lifts it: an item rule with immune: ["untrainedSnag"] (Presence, I'll
   * Make It Work, the Vehicle Qualifications...), a kit, or one of the checks below. `skill` is
   * optional so every existing 2-arg call site/test keeps working unchanged - the Skill-scoped
   * checks simply never fire without it.
   * @param {Object} skillDataset   { shift, edge, snag } for the skill being rolled.
   * @param {Actor} actor   The actor performing the roll.
   * @param {String} [skill]   dataset.skill - which Skill is being rolled.
   * @returns {Boolean}
   * @private
   */
  async _isUntrainedSnag(skillDataset, actor, skill=null) {
    const isUntrainedShift = E20.skillShiftList.indexOf('d20') == E20.skillShiftList.indexOf(skillDataset.shift);
    if (!isUntrainedShift) {
      return false;
    }

    // Instructor's taught Skill - items/social/instructor-legacy-students.mjs.
    if (pr2NoUntrainedSnag(actor, skill)) {
      return false;
    }

    // Basic / Advanced Skill Kit (Quartermaster's Guide p.41) - mechanics/resources/kits.mjs.
    if (skillKitNoUntrainedSnag(actor, skill)) {
      return false;
    }

    // Item rules with immune: ["untrainedSnag"] (rules/adapter.mjs).
    if (ruleNoUntrainedSnag(actor, skill)) {
      return false;
    }

    // Zord, Phantom Ship, Quantasaurus Rex (driving a Zord) and Leadfoot (Alertness while driving) are item
    // rules now - see just above.

    // Limited lifts - UntrainedSnagImmunity rules (rules/plugins/rolls/untrained-snag-immunity.mjs): Green (Transformers:
    // three per encounter in combat, free out of combat; GI Joe: three per scene). Asked last, so a use is only spent
    // when nothing above lifted the Snag.
    if (await useUntrainedSnagImmunity(actor, skill)) {
      return false;
    }

    return true;
  }

  /**
   * Displays the dialog used for skill and specialization rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Actor} actor   The actor performing the roll.
   * @returns {Promise<Object>}   The processed roll options, or { cancelled: true }.
   */
  async getSkillRollOptions(dataset, skillDataset, actor) {
    const snag = skillDataset.snag || await this._isUntrainedSnag(skillDataset, actor, dataset.skill);
    const edge = skillDataset.edge;
    const { shiftModifierSources, edgeSourcesText, snagSourcesText } =
      buildCombatModifierSourceFields(dataset.combatModifierSources);
    const context = {
      canCritD2: dataset.canCritD2,
      shiftUp: dataset.shiftUp || 0,
      shiftDown: dataset.shiftDown || 0,
      isSpecialized: dataset.isSpecialized,
      snag: snag && !edge,
      edge: edge && !snag,
      normal: edge == snag,
      shiftModifierSources,
      edgeSourcesText,
      snagSourcesText,
      rolePoints: dataset.rolePoints,
      damageRolePoints: dataset.damageRolePoints,
      aimBonus: dataset.aimBonus,
      aimedByAction: dataset.aimedByAction,
      energonAvailable: dataset.energonAvailable,
      storyPointSpecializedAvailable: dataset.storyPointSpecializedAvailable,
      enviroSealedAdverseSituationAvailable: dataset.enviroSealedAdverseSituationAvailable,
      enviroSealedAdverseSituationChecked: dataset.enviroSealedAdverseSituationChecked,
      observerSnagSubstitutionAvailable: dataset.observerSnagSubstitutionAvailable,
      targetVesselSystemAvailable: dataset.targetVesselSystemAvailable,
      wildAnimalKit: dataset.wildAnimalKit,
      // Intimidating (GI Joe CRB/TF CRB p.148 etc) - see dice.mjs's own
      // updatedShiftDataset.intimidatingAvailable comment. Localized here (rather than in the
      // template, which has no `config` in its own context) since the substitute skill is
      // dynamic - unlike every fixed-skill substitution above, this one names whichever skill the
      // player's own equipped Intimidating weapon happens to use.
      intimidatingWeaponSkillLabel: dataset.intimidatingWeaponSkill
        ? game.i18n.localize(E20.skills[dataset.intimidatingWeaponSkill])
        : null,
      // Retrogen / Fanning weapon traits - see dice.mjs's own updatedShiftDataset.retrogenAvailable
      // and fanningMaxShots comments.
      retrogenAvailable: dataset.retrogenAvailable,
      fanningMaxShots: dataset.fanningMaxShots || 0,
      // Kits - mechanics/resources/kits.mjs.
      kitRequiredAvailable: !!dataset.kitRequiredAvailable,
      // Extension controls - mechanics/item-hooks.mjs.
      extToggles: dataset.extToggles || [],
      hardpointMovement: dataset.hardpointMovement,
      defenseType: dataset.defenseType || 'none',
      defenseTypes: { none: 'E20.None', ...E20.defenses },
      availableSkillEffects: dataset.availableSkillEffects || [],
    };
    /* E20.originSkills is conditioning plus E20.skills, and two rollable things are deliberately
       absent from both: Wealth, which is a real `system.skills.wealth` field but which the sheets
       present separately as the Wealth Die (see mechanics/characters/effect-catalog.mjs's own note), and a
       Role's own skill die, which is named by the Role rather than by any enum. Both used to make
       this title read "<actor> <shift> undefined Skill Roll". */
    const skillLabel = E20.originSkills[dataset.skill]
      // preLocalize has already turned the tables above into real strings, so this has to be a
      // localized string too rather than the key.
      ?? (dataset.skill == 'wealth' ? this._localize('E20.Wealth') : null)
      ?? dataset.roleSkillName
      ?? '';

    const title = this._localize('E20.RollDialogTitle', {
      actor: actor.name, skill: skillLabel, shift: E20.skillShifts[skillDataset.shift],
    });

    return new Promise(resolve => {
      new RollOptionsDialog(context, title, resolve).render(true);
    });
  }
}
