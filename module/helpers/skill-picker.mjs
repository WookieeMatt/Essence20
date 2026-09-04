/**
 * Pure essence-spend math backing the Skill Picker app (module/apps/skill-picker.mjs), shared by
 * both NPC-like actors and PCs. Kept here rather than inline in the app class so it's covered by
 * Jest - module/apps/** is excluded from jest.config.js's collectCoverageFrom, module/helpers/**
 * is not.
 */

/**
 * Whether a skill draws its invested points from more than one real Essence - either one of the
 * two built-in "any"-Essence skills (Spellcasting, Weird - all four flags true), or a normal
 * skill a Perk has extended to a second Essence via its own Active Effect (e.g. GI Joe CRB's
 * Terrifying Presence: system.skills.intimidation.essences.social = true, on top of
 * Intimidation's default strength: true - see common.mjs#makeSkillFields).
 * @param {Object} skillData A system.skills.<skill> entry (needs `essences`).
 * @returns {String[]} The real Essence keys (a subset of strength/speed/smarts/social) this
 *   skill is currently flagged for - length > 1 means it's multi-Essence.
 */
export function getSkillEssences(skillData) {
  return Object.entries(skillData.essences || {})
    .filter(([, isTrue]) => isTrue)
    .map(([essence]) => essence);
}

/**
 * Tally how many essence points an actor has spent per real Essence - works for any actor type,
 * PCs included; this is also what character-sheet.mjs's _prepareSkillRankAllocation now delegates
 * to instead of duplicating the math. Covers every regular skill's upshift-from-default plus
 * Specializations, every multi-Essence skill's spend split across whichever real Essences it's
 * currently flagged for (see getSkillEssences above) via each skill's own
 * system.skills.<skill>.essenceAttribution, and Conditioning - a bare Strength-essence value that
 * lives outside system.skills entirely (see module/documents/actor.mjs's health.max calculation)
 * - added straight into Strength.
 *
 * Iterates CONFIG.E20.skillToEssence once (rather than nesting a per-Essence loop over
 * CONFIG.E20.skillsByEssence, the old shape) so a skill that's become multi-Essence at runtime
 * can contribute to more than one Essence's tally without needing to already live in more than
 * one of that static config's lists.
 * @param {Actor} actor The actor to tally.
 * @returns {Object} One entry per real Essence: { value, string } - the same shape as
 *   system.skillRankAllocation, so callers can reuse
 *   templates/actor/parts/misc/skill-rank-allocation.hbs directly.
 */
export function computeEssenceSpend(actor) {
  const system = actor.system;

  const unrankedIndex = CONFIG.E20.skillShiftList.indexOf('d20');
  const spend = {};
  for (const essence of Object.keys(CONFIG.E20.originEssences)) {
    spend[essence] = { value: 0, strings: [] };
  }

  for (const skill of Object.keys(CONFIG.E20.skillToEssence)) {
    // Not every actor type has every skill CONFIG.E20.skillToEssence knows about - Zord/
    // Megaform's schema (zord-base.mjs), for one, has no `weird` entry at all.
    const skillData = system.skills[skill];
    if (!skillData) {
      continue;
    }

    const skillEssences = getSkillEssences(skillData);
    const skillIndex = Math.max(0, CONFIG.E20.skillShiftList.indexOf(skillData.shift));
    const upshifts = Math.max(0, unrankedIndex - skillIndex);

    if (skillEssences.length > 1) {
      for (const essence of skillEssences) {
        const attributed = skillData.essenceAttribution?.[essence] || 0;
        if (attributed) {
          spend[essence].strings.push(`${attributed} ${CONFIG.E20.skills[skill]}`);
          spend[essence].value += attributed;
        }
      }
    } else if (upshifts) {
      const essence = skillEssences[0];
      spend[essence].strings.push(`${upshifts} ${CONFIG.E20.skills[skill]}`);
      spend[essence].value += upshifts;
    }

    // A granted specialization (from a Perk or other Item, not bought with a skill point) is
    // free - only count the ones the player spent a point on. See common.mjs#makeSkillFields
    // for the `granted` field itself. Always credited to the skill's own primary Essence (not
    // split like the skill's own upshifts above) - a Specialization doesn't carry its own
    // essenceAttribution, and multi-Essence Specializations aren't a case any sourcebook needs.
    const primaryEssence = skillEssences[0] || CONFIG.E20.skillToEssence[skill];
    for (const specialization of Object.values(skillData.specializations || {})) {
      if (!specialization.granted) {
        spend[primaryEssence].value += 1;
        spend[primaryEssence].strings.push(`1 ${specialization.name}`);
      }
    }
  }

  const result = {};
  for (const [essence, { value, strings }] of Object.entries(spend)) {
    result[essence] = { value, string: strings.join(' + ') };
  }

  result.strength.value += system.conditioning;
  result.strength.string = [
    result.strength.string,
    `${system.conditioning} ${game.i18n.localize('E20.ActorConditioning')}`,
  ].filter(Boolean).join(' + ');

  return result;
}

/**
 * For one multi-Essence skill (see getSkillEssences above), compare how many points it's
 * actually upshifted against how many points its essenceAttribution has assigned across its own
 * flagged Essences - a non-blocking hint so the Skill Picker can visually flag a skill whose
 * attribution doesn't (yet) add up, without preventing the GM from saving mid-edit.
 * @param {Object} skillData A system.skills.<skill> entry (needs `shift`, `essences`, and
 *   `essenceAttribution`).
 * @returns {{upshifts: number, attributed: number, isBalanced: boolean}}
 */
export function getSkillAttributionStatus(skillData) {
  const unrankedIndex = CONFIG.E20.skillShiftList.indexOf('d20');
  const skillIndex = Math.max(0, CONFIG.E20.skillShiftList.indexOf(skillData.shift));
  const upshifts = Math.max(0, unrankedIndex - skillIndex);

  const attribution = skillData.essenceAttribution || {};
  const attributed = Object.values(attribution).reduce((sum, n) => sum + (n || 0), 0);

  return { upshifts, attributed, isBalanced: upshifts === attributed };
}
