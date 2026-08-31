import { E20 } from "./config.mjs";
import { actorHasPerk } from "./perks.mjs";
import RollOptionsDialog from "../apps/roll-options-dialog.mjs";

// Presence (GI Joe CRB p.76, Commando's Spy Focus, 1st level): "You do not suffer a Snag for
// rolling Skill Tests on Skills you have not spent Skill points on" - negates the base rule
// below (an untrained, still-d20-shift skill always rolling with a Snag).
const PRESENCE_ID = "Compendium.essence20.gi_joe_crb.Item.EdP0LqcYh2tkMygI";

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
   * rule, unless the roller has Presence (GI Joe CRB p.76).
   * @param {Object} skillDataset   { shift, edge, snag } for the skill being rolled.
   * @param {Actor} actor   The actor performing the roll.
   * @returns {Boolean}
   * @private
   */
  _isUntrainedSnag(skillDataset, actor) {
    const isUntrainedShift = E20.skillShiftList.indexOf('d20') == E20.skillShiftList.indexOf(skillDataset.shift);
    return isUntrainedShift && !actorHasPerk(actor, PRESENCE_ID);
  }

  /**
   * Displays the dialog used for skill and specialization rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Actor} actor   The actor performing the roll.
   * @returns {Promise<Object>}   The processed roll options, or { cancelled: true }.
   */
  async getSkillRollOptions(dataset, skillDataset, actor) {
    const snag = skillDataset.snag || this._isUntrainedSnag(skillDataset, actor);
    const edge = skillDataset.edge;
    const context = {
      canCritD2: dataset.canCritD2,
      shiftUp: dataset.shiftUp || 0,
      shiftDown: dataset.shiftDown || 0,
      isSpecialized: dataset.isSpecialized,
      snag: snag && !edge,
      edge: edge && !snag,
      normal: edge == snag,
      rolePoints: dataset.rolePoints,
      damageRolePoints: dataset.damageRolePoints,
      aimBonus: dataset.aimBonus,
      energonAvailable: dataset.energonAvailable,
      defenseType: dataset.defenseType || 'none',
      defenseTypes: { none: 'E20.None', ...E20.defenses },
    };
    const title = this._localize('E20.RollDialogTitle', {
      actor: actor.name, skill: E20.originSkills[dataset.skill], shift: E20.skillShifts[skillDataset.shift],
    });

    return new Promise(resolve => {
      new RollOptionsDialog(context, title, resolve).render(true);
    });
  }
}
