import { getNearbyAllyTokens } from "./allies.mjs";
import { actorHasPerk, bankPendingBonus, getPendingBonus } from "./perks.mjs";
import { E20 } from "./config.mjs";

// Think Tank (Enigma of Combination, Hub Focus, Analyst, 20th level, p.29): "Your Data Bridge has
// evolved into a veritable superhighway of information. When you use your Data Bridge Role Perk,
// you allow the borrowing of all Languages and all Skill Specializations known by the ally in
// question. Additionally, you have no maximum number of allies that can be part of your Data
// Bridge, as long as you have the Free actions to spend to create the links." The "no maximum
// allies" half is already true of this file's own broadcast-to-every-nearby-ally design (there
// was never a cap to begin with) - only the "borrow ALL of one ally's Specializations, not just
// one" half needs its own picker branch below. Languages stay narrative, same as the base Perk.
const THINK_TANK_ID = "Compendium.essence20.enigma_of_combination.Item.TklqajBQCS7jiwpC";

/**
 * Data Bridge (Enigma of Combination, Hub Focus, Analyst, 1st level, p.29): "If you can directly
 * see any mechanized ally with computing ability in the same scene, you can, as a Free action
 * once per turn, act as though you possess any one Language or Skill Specialization possessed by
 * that ally. Additionally, you can spend additional Free actions to transmit that Language or
 * Skill Specialization to additional mechanized/computerized allies also within line of sight at
 * a rate of 1 ally per Free action spent. This borrowed ability remains until the beginning of
 * your next turn."
 *
 * Only the Skill Specialization half is built - Language-borrowing is pure narrative (Languages
 * are free text, not tracked - see the project's own established Linguistics/Tongues precedent).
 * "Mechanized ally with computing ability"/"line of sight" is approximated down to "any ally on
 * the scene," the same accepted looseness Field Aid's own unscoped ally scan already uses - this
 * system has no per-actor "computerized" classification to check.
 *
 * "Spend additional Free actions to transmit... at a rate of 1 ally per Free action spent" has no
 * action-economy budget to gate against (this project doesn't track one anywhere), the same gap
 * every other "spend more of a tracked action to help more people" clause in this codebase
 * already hits - resolved the same way team-buffs.mjs's own One For All/Power Burst/Shining
 * Leader already resolve an equivalent "broadcast to the team" grant: the borrowed Specialization
 * is shared with the caster AND every nearby ally at once, unconditionally, rather than gating a
 * per-ally spend that has nothing to actually cost. This also gives Tactical Triangulation/Misery
 * Loves Company (this same Focus's own later Perks, both keyed on "allies currently benefitting
 * from your Data Bridge") a real roster to read: getDataBridgedAllyCount below.
 *
 * The borrowed benefit itself is modeled as a plain `isSpecialized` grant (the same "act as though
 * Specialized, no need to copy the exact source Specialization's own bonus values" simplification
 * Student of Divine Manuals/Adaptable's own identical grants already establish) rather than
 * copying the ally's actual Specialization data - `dice.mjs`'s own `specialization` variable is
 * resolved by looking up `dataset.specializationKey` on the ROLLING actor's own specializations
 * table (see its own doc comment), so a borrowed specialization from a DIFFERENT actor couldn't
 * reach that path anyway without deliberately bypassing it - simpler and more consistent to just
 * grant the same "isSpecialized" flag every other borrowed-Specialized Perk already grants.
 */

const PENDING_FLAG = 'pendingDataBridgeSpecialization';

/**
 * Every (ally, skill, specialization name) combination available to borrow from any ally
 * currently on the scene.
 * @param {Actor} actor
 * @returns {Array<{allyName: String, skill: String, name: String}>}
 */
export function getAvailableDataBridgeSpecializations(actor) {
  const allies = getNearbyAllyTokens(actor, Infinity);
  const options = [];
  for (const token of allies) {
    const skills = token.actor?.system.skills ?? {};
    for (const [skill, skillData] of Object.entries(skills)) {
      for (const specData of Object.values(skillData.specializations ?? {})) {
        if (specData?.name) {
          options.push({ allyName: token.actor.name, skill, name: specData.name });
        }
      }
    }
  }

  return options;
}

/**
 * Every ally on the scene holding at least one Skill Specialization - Think Tank's own picker
 * offers a choice of ALLY (borrowing everything they have), not a single Specialization.
 * @param {Actor} actor
 * @returns {Array<{allyName: String, skills: Array<String>}>}
 */
export function getDataBridgeableAllies(actor) {
  const byAlly = new Map();
  for (const option of getAvailableDataBridgeSpecializations(actor)) {
    if (!byAlly.has(option.allyName)) {
      byAlly.set(option.allyName, []);
    }

    byAlly.get(option.allyName).push(option.skill);
  }

  return [...byAlly.entries()].map(([allyName, skills]) => ({ allyName, skills }));
}

/**
 * Prompts for which ally Specialization to borrow - one specific Specialization normally, or
 * (with Think Tank) every Specialization a single chosen ally has.
 * @param {Actor} actor
 * @returns {Promise<{skill: String, name: String}|{skills: Array<String>}|null>}   The chosen
 *   skill/Specialization name (or, for Think Tank, the full list of skills borrowed), or null if
 *   there's nothing to borrow or the picker was cancelled.
 */
export async function pickDataBridgeSpecialization(actor) {
  if (actorHasPerk(actor, THINK_TANK_ID)) {
    const allies = getDataBridgeableAllies(actor);
    if (!allies.length) {
      return null;
    }

    const optionsHtml = allies
      .map((ally, index) => `<option value="${index}">${ally.allyName}</option>`)
      .join('');
    const chosen = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.DataBridgePickSpecializationTitle') },
      classes: ["window-app"],
      content: `<div class="form-group"><label>${
        game.i18n.localize('E20.ThinkTankPickAllyLabel')
      }</label><select name="option">${optionsHtml}</select></div>`,
      modal: true,
      buttons: [
        {
          label: game.i18n.localize('E20.DialogConfirmButton'),
          action: 'confirm',
          callback: (event, button) => button.form.elements.option.value,
        },
        { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
      ],
    });

    return chosen && chosen != 'cancel' ? { skills: allies[Number(chosen)].skills } : null;
  }

  const options = getAvailableDataBridgeSpecializations(actor);
  if (!options.length) {
    return null;
  }

  const optionsHtml = options
    .map((option, index) => `<option value="${index}">${option.name} (${game.i18n.localize(E20.skills[option.skill])}) - ${option.allyName}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.DataBridgePickSpecializationTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.DataBridgePickSpecializationLabel')
    }</label><select name="option">${optionsHtml}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.option.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  if (!chosen || chosen == 'cancel') {
    return null;
  }

  const { skill, name } = options[Number(chosen)];
  return { skill, name };
}

/**
 * Prompts for and banks a borrowed Specialization on the caster and every nearby ally.
 * @param {Actor} actor
 * @returns {Promise<{skill: String, name: String}|null>}   The Specialization borrowed, or null
 *   if there was nothing to borrow or the picker was cancelled.
 */
export async function activateDataBridge(actor) {
  const choice = await pickDataBridgeSpecialization(actor);
  if (!choice) {
    return null;
  }

  await bankPendingBonus(actor, PENDING_FLAG, choice);
  for (const token of getNearbyAllyTokens(actor, Infinity)) {
    if (token.actor) {
      await bankPendingBonus(token.actor, PENDING_FLAG, choice);
    }
  }

  return choice;
}

/**
 * How many currently-Data-Bridged allies (the caster included) are on the scene right now - the
 * roster Tactical Triangulation/Misery Loves Company both read. "Able to see the target of the
 * attack" is dropped, the same unenforceable-narrowing simplification this project already uses
 * throughout (nothing tracks per-target visibility).
 * @param {Actor} actor
 * @returns {Number}
 */
export function getDataBridgedAllyCount(actor) {
  const selfCount = getPendingBonus(actor, PENDING_FLAG) ? 1 : 0;
  const alliesCount = getNearbyAllyTokens(actor, Infinity)
    .filter(token => token.actor && getPendingBonus(token.actor, PENDING_FLAG)).length;
  return selfCount + alliesCount;
}

/**
 * Whether the actor currently has a borrowed Specialization banked for the given Skill - either
 * the normal single-skill shape ({skill}) or Think Tank's own multi-skill shape ({skills: [...]}).
 * @param {Actor} actor
 * @param {String} skill
 * @returns {Boolean}
 */
export function hasBorrowedDataBridgeSpecialization(actor, skill) {
  const pending = getPendingBonus(actor, PENDING_FLAG);
  return !!pending && (pending.skill == skill || !!pending.skills?.includes(skill));
}

/**
 * Whether the actor currently has ANY borrowed Data Bridge Specialization banked, regardless of
 * which Skill - the "currently benefitting from Data Bridge" check Tactical Triangulation/Misery
 * Loves Company both need, as opposed to hasBorrowedDataBridgeSpecialization's own Skill-scoped
 * check.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isDataBridged(actor) {
  return !!getPendingBonus(actor, PENDING_FLAG);
}

export { PENDING_FLAG as DATA_BRIDGE_FLAG };
