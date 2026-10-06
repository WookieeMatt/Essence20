import {
  registerApplyDialog, registerDialogToggles, registerRollSources, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { isAttackItem, S1, terrainOf } from "../shared/terrain-perk-ids-and-readers.mjs";
import { T } from "../shared/item-lang.mjs";
import { findSourced, sourceOf } from "../shared/item-lookups.mjs";

/**
 * Environmental Enforcer (Hawk's Personnel Files, General Perk, p.174): "You gain an Edge on
 * Attack Skill Tests when taking the Maneuver effect in [a chosen] environment." "For each Skill Rank you have in
 * Survival, choose an environment." The environments are chosen with the Use button and stored on the item; on a
 * scene with no terrain set the Roll Options Dialog offers a checkbox instead.
 */
const ENVIRONMENTS_FLAG = 's1Environments';

export function environmentalEnforcerRollSources(actor, target, ctx = {}) {
  const { item } = ctx;
  const isAttack = ctx.isAttack ?? isAttackItem(item);
  const sources = [];
  if (!actor) {
    return { sources, consumes: [] };
  }

  const enforcer = findSourced(actor, S1.environmentalEnforcer);
  if (enforcer && isAttack && (item?.system?.damageType == 'maneuver' || ctx.isShove)) {
    const terrain = terrainOf(actor);
    const chosen = enforcer.flags?.essence20?.[ENVIRONMENTS_FLAG] ?? [];
    if (terrain && chosen.includes(terrain)) {
      sources.push({ id: 's1-environmentalEnforcer', label: enforcer.name ?? S1.environmentalEnforcer, edge: true });
    }
  }

  return { sources: sources.map(s => ({ shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...s })), consumes: [] };
}

/** Environmental Enforcer on a scene with no terrain set. */
export function environmentalEnforcerToggles(actor, ctx = {}) {
  const { item } = ctx;
  const isAttack = isAttackItem(item);
  const toggles = [];
  const enforcer = findSourced(actor, S1.environmentalEnforcer);
  if (enforcer && isAttack && item?.system?.damageType == 'maneuver' && !terrainOf(actor)) {
    toggles.push({ name: 's1EnvironmentalEnforcer', label: T('S1EnvironmentalEnforcerToggle'), type: 'checkbox' });
  }

  return toggles;
}

export async function environmentalEnforcerApplyDialog(actor, options) {
  const ext = options.ext ?? {};
  if (ext.s1EnvironmentalEnforcer) {
    options.edge = true;
  }
}

/* -------------------------------------------- */
/*  Choosing the environments                    */
/* -------------------------------------------- */

/** Environment choosers stored on the item itself. */
async function chooseTerrains(item, max) {
  const env = CONFIG.E20?.environments ?? {};
  const current = item.flags?.essence20?.[ENVIRONMENTS_FLAG] ?? [];
  const boxes = Object.entries(env).map(([key, label]) => `<label class="checkbox"><input type="checkbox" name="${key}" ${current.includes(key) ? 'checked' : ''}/> ${game.i18n.localize(label)}</label>`).join('<br>');
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: `<p>${T('S1ChooseEnvironments', { max })}</p><div class="form-group">${boxes}</div>`,
    buttons: [
      { action: 'ok', label: T('DialogConfirmButton'), default: true,
        callback: (event, button) => Object.keys(env).filter(key => button.form.elements[key]?.checked) },
      { action: 'cancel', label: T('DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!Array.isArray(picked)) {
    return null;
  }

  const chosen = picked.slice(0, max);
  await item.setFlag('essence20', ENVIRONMENTS_FLAG, chosen);
  return chosen;
}

const terrainLabel = key => game.i18n.localize(CONFIG.E20?.environments?.[key] ?? key);

export function survivalRanks(actor) {
  const list = CONFIG.E20?.skillShiftList ?? [];
  const index = list.indexOf(actor?.system?.skills?.survival?.shift);
  const untrained = list.indexOf('d20');
  return index >= 0 && untrained >= 0 ? Math.max(0, untrained - index) : 0;
}

export const ENVIRONMENTAL_ENFORCER_USE = {
  id: 's1-environmentalEnforcer',
  matches: item => sourceOf(item) == S1.environmentalEnforcer,
  run: async (item) => {
    const chosen = await chooseTerrains(item, Math.max(1, survivalRanks(item.parent)));
    return chosen ? T('S1EnvironmentsChosen', { item: item.name, list: chosen.map(terrainLabel).join(', ') || '-' }) : null;
  },
};

registerRollSources(environmentalEnforcerRollSources);
registerDialogToggles(environmentalEnforcerToggles);
registerApplyDialog(environmentalEnforcerApplyDialog);
registerUse(ENVIRONMENTAL_ENFORCER_USE);
