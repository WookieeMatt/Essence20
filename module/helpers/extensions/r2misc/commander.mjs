import { registerUse } from "../../extensions.mjs";

/**
 * Commander (Enigma of Combination, Combiner feature, p.42): "Note your two highest Essence Scores ...
 * and increase each of those Essence Scores of the Combined Form by 1 (increasing two associated Skills
 * accordingly)."
 *
 * Which two Essences get the +1 depends on the whole Combiner (documents/actor.mjs
 * #_prepareMegaformCombinerData works it out), so the holder can't pick "the two Skills" up front - but
 * they can pick, for each Essence, which of its Skills they'd raise. The Use button stores that as a
 * {essence: skill} map on the feature; the Combiner's derived data gives ↑1 to the picked Skill of each
 * Essence it raises.
 */

// Read by documents/actor.mjs - no imports here, so it can.
export const COMMANDER_SKILLS_FLAG = 'commanderSkills';
const ESSENCES = ['strength', 'speed', 'smarts', 'social'];

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));
const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const isCommander = item => item?.type == 'megaformTrait' && item.system?.type == 'commander';

/**
 * Keep only real {essence: skill} pairs - a Skill that belongs to that Essence.
 * @param {Object} picks
 * @returns {Object}
 */
export function cleanCommanderSkills(picks) {
  const out = {};
  for (const essence of ESSENCES) {
    const skill = picks?.[essence];
    if (skill && (CONFIG.E20?.skillsByEssence?.[essence] ?? []).includes(skill)) {
      out[essence] = skill;
    }
  }

  return out;
}

/** The Use: one Skill per Essence, stored on the feature. */
export async function pickCommanderSkills(item) {
  const current = item.flags?.essence20?.[COMMANDER_SKILLS_FLAG] ?? {};
  const rows = ESSENCES.map(essence => {
    const options = (CONFIG.E20?.skillsByEssence?.[essence] ?? [])
      .map(skill => `<option value="${esc(skill)}"${current[essence] == skill ? ' selected' : ''}>${esc(game.i18n.localize(CONFIG.E20.skills?.[skill] ?? skill))}</option>`)
      .join('');
    const label = esc(game.i18n.localize(CONFIG.E20?.originEssences?.[essence] ?? `E20.Essence${essence[0].toUpperCase()}${essence.slice(1)}`));
    return `<div class="form-group"><label>${label}</label><select name="${essence}">${options}</select></div>`;
  }).join('');

  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: `<p>${T('R2CommanderPrompt')}</p>${rows}`,
    buttons: [
      {
        action: 'ok', label: T('DialogConfirmButton'), default: true,
        callback: (event, button) => Object.fromEntries(ESSENCES.map(essence => [essence, button.form.elements[essence]?.value])),
      },
      { action: 'cancel', label: T('DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!picked || typeof picked != 'object') {
    return null;
  }

  const skills = cleanCommanderSkills(picked);
  await item.setFlag('essence20', COMMANDER_SKILLS_FLAG, skills);
  const list = ESSENCES.filter(essence => skills[essence]).map(essence => game.i18n.localize(CONFIG.E20.skills?.[skills[essence]] ?? skills[essence])).join(', ');
  return T('R2CommanderPicked', { name: item.parent?.name ?? '', skills: list });
}

registerUse({ id: 'r2Commander', matches: isCommander, run: pickCommanderSkills });
