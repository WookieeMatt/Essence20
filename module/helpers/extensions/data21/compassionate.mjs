import { registerApplyDialog, registerDialogToggles, registerUse } from "../../extensions.mjs";
import { D21, T, escape, findSourced, sourceOf, writeDoc } from "./common.mjs";

/**
 * Compassionate (My Little Pony CRB, General Perk, p.123): "You go out of your way to help, gaining
 * the following benefits:
 * • You gain Edge on Diplomacy Skill Tests to suggest non-aggressive solutions.
 * • You can heal a target 1 Damage with a successful DIF 12 Persuasion Skill Test.
 * • You gain Edge on Skill Tests to acquire food, water, medicine, or shelter for other creatures."
 *
 * Both Edges depend on what the test is for, so they're Roll Options Dialog checkboxes (the pack's
 * always-on Persuasion Edge effect is now off). The heal is the Perk's Use button.
 */

export function compassionateToggles(actor, { rolledSkill } = {}) {
  if (!findSourced(actor, D21.compassionate)) {
    return [];
  }

  const toggles = [{ name: 'd21CompassionNeeds', label: T('D21CompassionateNeeds'), type: 'checkbox' }];
  if (rolledSkill == 'persuasion') {
    toggles.unshift({ name: 'd21CompassionPeace', label: T('D21CompassionatePeace'), type: 'checkbox' });
  }

  return toggles;
}

export function compassionateApply(actor, options) {
  if (options?.ext?.d21CompassionPeace || options?.ext?.d21CompassionNeeds) {
    options.edge = true;
  }
}

registerDialogToggles(compassionateToggles);
registerApplyDialog(compassionateApply);

function targetOf(actor) {
  const token = game.user?.targets?.first?.() ?? [...(game.user?.targets ?? [])][0];
  return token?.actor ?? actor;
}

/** Heal 1 Damage: Health back up by 1, never past its maximum. */
export async function healOne(target) {
  const health = target?.system?.health;
  if (!health || !Number.isFinite(Number(health.value))) {
    return false;
  }

  const max = Number(health.max);
  const value = Number(health.value);
  if (Number.isFinite(max) && value >= max) {
    return false;
  }

  await writeDoc(target, 'update', [{ 'system.health.value': Number.isFinite(max) ? Math.min(max, value + 1) : value + 1 }]);
  return true;
}

export async function useCompassionate(item) {
  const actor = item?.parent;
  if (!actor) {
    return null;
  }

  const target = targetOf(actor);
  const { rollTest } = await import("../../grants.mjs");
  const { success } = await rollTest(actor, 'persuasion', 12);
  if (!success) {
    return T('D21CompassionateFailed', { name: escape(actor.name) });
  }

  const healed = await healOne(target);
  return T(healed ? 'D21CompassionateHealed' : 'D21CompassionateFull', { name: escape(actor.name), target: escape(target.name) });
}

registerUse({
  id: 'd21Compassionate',
  matches: item => sourceOf(item) == D21.compassionate,
  run: item => useCompassionate(item),
});
