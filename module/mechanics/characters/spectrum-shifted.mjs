/**
 * Spectrum Shifted (A Jump Through Time, Quantum Ranger, 1st level, p.42): "When a player selects this
 * Advanced Spectrum Role at 4th Level or later, they keep the following Role Perks and abilities from
 * their original Role" - Table 2-16:
 *
 *   Black Ranger   Heart of the Team (↑1), You Got This!; (3 Quips and Speeches)
 *   Blue Ranger    Eureka!, Helping Hand; (2 Idea Points)
 *   Green Ranger   Solo Strike (↑1), Survival Boon (retains choice made)
 *   Orange Ranger  Cunning Plan, Think Fast!; (Cunning Skill 1d4)
 *   Pink Ranger    Volley, Hard Target; (2 Volley Shots)
 *   Purple Ranger  Emotional Mastery, Emotional Strength; (Emotional Range 3)
 *   Red Ranger     Power Strike (+1 damage), Weapon Mastery
 *   Yellow Ranger  Triple Strike Attacks, Nimble Fighter; (1d2 Follow-Up die)
 *   Advanced Spectrum Ranger   Any two General Perks
 *   Non-Ranger Role*           Same as Any Core Ranger type above (Player's Choice)
 *
 * sheet-handlers/role-handler.mjs#performSpectrumShift used to keep every level 1-3 Role Perk of the
 * old Role instead. It now asks spectrumShiftedRetains() about each old-Role item (integration patch
 * pr1-patch.cjs) and calls afterSpectrumShifted() once the Role skill die has been reset. The kept
 * pools are frozen at the table's value: they no longer grow with the old Role's level table.
 */
import { T, postLine } from "../../items/shared/crew-allies-turn-stamps.mjs";

const norm = name => String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const SPECTRUM_TABLE = {
  blackranger: { perks: ['Heart of the Team', 'You Got This!'], points: { name: 'Quips & Speeches', value: 3 } },
  blueranger: { perks: ['Eureka!', 'Helping Hand'], points: { name: 'Idea Points', value: 2 } },
  greenranger: { perks: ['Solo Strike', 'Survival Boon'], points: { name: 'Solo Strike', value: 1 } },
  orangeranger: { perks: ['Cunning Plan', 'Think Fast!'], skillDie: 'd4' },
  pinkranger: { perks: ['Volley', 'Hard Target'], points: { name: 'Volley Shots', value: 2 } },
  purpleranger: { perks: ['Emotional Mastery', 'Emotional Strength'], points: { name: 'Emotional Range', value: 3 } },
  redranger: { perks: ['Power Strike', 'Weapon Mastery'], points: { name: 'Power Strike', value: 1 } },
  yellowranger: { perks: ['Triple Strike Attacks', 'Nimble Fighter'], skillDie: 'd2' },
};

/** The Table 2-16 row for an old Role, by name. */
export const spectrumRow = role => SPECTRUM_TABLE[norm(role?.name)] ?? null;

/** The update that freezes a rolePoints pool at a fixed value. */
export function frozenPoints(item, value) {
  const usesResource = item?.system?.resource?.startingMax !== null && item?.system?.resource?.startingMax !== undefined;
  return usesResource
    ? {
      'system.resource.startingMax': value, 'system.resource.max': value, 'system.resource.value': value,
      'system.resource.increase': 0, 'system.resource.increaseLevels': [], 'system.resource.level20Value': null,
    }
    : {
      'system.bonus.startingValue': value, 'system.bonus.value': value,
      'system.bonus.increase': 0, 'system.bonus.increaseLevels': [], 'system.bonus.level20Value': null,
    };
}

/**
 * Whether an item the old Role granted stays with the Spectrum Shifted character.
 * @param {Actor} actor
 * @param {Item} oldRole
 * @param {Item} item   A Perk or rolePoints item parented to the old Role.
 * @param {Object|undefined} oldAttachment   The old Role's own system.items entry for it.
 * @returns {Promise<Boolean>}
 */
export async function spectrumShiftedRetains(actor, oldRole, item, oldAttachment) {
  const row = spectrumRow(oldRole);
  if (!row) {
    // An Advanced Spectrum or non-Ranger Role - no fixed row; keep the old behavior (1st-3rd level
    // Perks) and let afterSpectrumShifted say what the table grants instead.
    return item.type == 'perk' && !!oldAttachment?.level && oldAttachment.level <= 3;
  }

  if (item.type == 'perk') {
    return row.perks.some(name => norm(name) == norm(item.name));
  }

  if (item.type == 'rolePoints' && row.points && norm(row.points.name) == norm(item.name)) {
    await item.update(frozenPoints(item, row.points.value));
    return true;
  }

  return false;
}

/**
 * After the Role skill die has been reset: the Orange/Yellow skill dice, and a note for the rows that
 * need a player's choice.
 * @param {Actor} actor
 * @param {Item} oldRole
 * @param {Object} roleSkillDieBefore   system.skills.roleSkillDie as it was before the shift.
 */
export async function afterSpectrumShifted(actor, oldRole, roleSkillDieBefore = {}) {
  const row = spectrumRow(oldRole);
  if (row?.skillDie) {
    const update = { 'system.skills.roleSkillDie.shift': row.skillDie };
    for (const [essence, on] of Object.entries(roleSkillDieBefore?.essences ?? {})) {
      update[`system.skills.roleSkillDie.essences.${essence}`] = !!on;
    }

    await actor.update(update);
  }

  if (!row) {
    await postLine(actor, T('Pr1SpectrumShiftedOther', { name: actor.name, role: oldRole?.name ?? '' }));
  }
}
