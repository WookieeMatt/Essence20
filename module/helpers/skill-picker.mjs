/**
 * Pure essence-spend math backing the Skill Picker app (module/apps/skill-picker.mjs), shared by
 * both NPC-like actors and PCs. Kept here rather than inline in the app class so it's covered by
 * Jest - module/apps/** is excluded from jest.config.js's collectCoverageFrom, module/helpers/**
 * is not.
 */

/**
 * Tally how many essence points an actor has spent per real Essence - works for any actor type,
 * PCs included; this is also what character-sheet.mjs's _prepareSkillRankAllocation now delegates
 * to instead of duplicating the math. Covers every regular skill's upshift-from-default plus
 * Specializations, "any"-essence skills (Spellcasting, Weird), whose spend can be split across
 * more than one real Essence (e.g. a Weird check built from a Strength point and a Speed point)
 * via each skill's own system.skills.<skill>.essenceAttribution, and Conditioning - a bare
 * Strength-essence value that lives outside system.skills entirely (see
 * module/documents/actor.mjs's health.max calculation) - added straight into Strength.
 * @param {Actor} actor The actor to tally.
 * @returns {Object} One entry per real Essence: { value, string } - the same shape as
 *   system.skillRankAllocation, so callers can reuse
 *   templates/actor/parts/misc/skill-rank-allocation.hbs directly.
 */
export function computeEssenceSpend(actor) {
  const system = actor.system;

  const specializationsBySkill = {};
  for (const item of actor.items) {
    if (item.type === 'specialization') {
      const skill = item.system.skill;
      (specializationsBySkill[skill] ??= []).push(item);
    }
  }

  const unrankedIndex = CONFIG.E20.skillShiftList.indexOf('d20');
  const spend = {};

  for (const essence of Object.keys(CONFIG.E20.originEssences)) {
    let value = 0;
    const strings = [];

    for (const skill of CONFIG.E20.skillsByEssence[essence]) {
      // Not every actor type has every skill CONFIG.E20.skillsByEssence knows about - Zord/
      // Megaform's schema (zord-base.mjs), for one, has no `weird` entry at all.
      const skillData = system.skills[skill];
      if (!skillData) {
        continue;
      }

      const skillIndex = Math.max(0, CONFIG.E20.skillShiftList.indexOf(skillData.shift));
      const upshifts = Math.max(0, unrankedIndex - skillIndex);
      if (upshifts) {
        strings.push(`${upshifts} ${CONFIG.E20.skills[skill]}`);
        value += upshifts;
      }

      for (const specialization of specializationsBySkill[skill] || []) {
        value += 1;
        strings.push(`1 ${specialization.name}`);
      }
    }

    for (const anySkill of CONFIG.E20.skillsByEssence.any) {
      const attributed = system.skills[anySkill]?.essenceAttribution?.[essence] || 0;
      if (attributed) {
        strings.push(`${attributed} ${CONFIG.E20.skills[anySkill]}`);
        value += attributed;
      }
    }

    spend[essence] = { value, string: strings.join(' + ') };
  }

  spend.strength.value += system.conditioning;
  spend.strength.string = [
    spend.strength.string,
    `${system.conditioning} ${game.i18n.localize('E20.ActorConditioning')}`,
  ].filter(Boolean).join(' + ');

  return spend;
}

/**
 * For one "any"-essence skill, compare how many points it's actually upshifted against how many
 * points its essenceAttribution has assigned across the four real Essences - a non-blocking hint
 * so the Skill Picker can visually flag a skill whose attribution doesn't (yet) add up, without
 * preventing the GM from saving mid-edit.
 * @param {Object} skillData A system.skills.<anySkill> entry (needs `shift` and
 *   `essenceAttribution`).
 * @returns {{upshifts: number, attributed: number, isBalanced: boolean}}
 */
export function getAnySkillAttributionStatus(skillData) {
  const unrankedIndex = CONFIG.E20.skillShiftList.indexOf('d20');
  const skillIndex = Math.max(0, CONFIG.E20.skillShiftList.indexOf(skillData.shift));
  const upshifts = Math.max(0, unrankedIndex - skillIndex);

  const attribution = skillData.essenceAttribution || {};
  const attributed = Object.values(attribution).reduce((sum, n) => sum + (n || 0), 0);

  return { upshifts, attributed, isBalanced: upshifts === attributed };
}
