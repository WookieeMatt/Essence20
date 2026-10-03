import { registerApplyDialog, registerDialogToggles } from "../../extensions.mjs";
import { actorHasPerk, findPerk } from "../../perks.mjs";
import { isInfiltrating } from "../../infiltrating.mjs";

/**
 * Shadow (GI Joe CRB, Infiltrator Focus, p.75): those who "attempt to detect you" while you are
 * Infiltrating suffer ↓2. Only detection rolls qualify, so this is a Roll Options Dialog switch on
 * the roller's side rather than an automatic ↓2 on every roll at the holder. Offered on any roll at
 * an Infiltrating holder; on by default for a non-attack Alertness test (the detection Skill), off
 * otherwise. (Martial Artist's matching switch is an item rule on the Hang-Up.)
 */

export const SHADOW_ID = "Compendium.essence20.gi_joe_crb.Item.PDiRwnTcNCtzJbDn";
export const SHADOW_SWITCH = 'fix3dShadow';

// Localized when the key exists, otherwise the English fallback.
function L(key, data, fallback) {
  const i18n = globalThis.game?.i18n;
  const full = `E20.${key}`;
  if (i18n?.has?.(full)) {
    return i18n.format(full, data);
  }

  return fallback;
}

function currentTarget() {
  return globalThis.game?.user?.targets?.first?.()?.actor ?? null;
}

export function shadowToggles(actor, { item, rolledSkill } = {}) {
  const target = currentTarget();
  if (!target || target == actor || !rolledSkill || !actorHasPerk(target, SHADOW_ID) || !isInfiltrating(target)) {
    return [];
  }

  const name = findPerk(target, SHADOW_ID)?.name ?? 'Shadow';
  return [{
    name: SHADOW_SWITCH,
    type: 'checkbox',
    value: item?.type != 'weaponEffect' && rolledSkill == 'alertness',
    label: L('Fix3ShadowToggle', { name, target: target.name }, `${name}: this roll tries to detect ${target.name} (↓2)`),
  }];
}

export function shadowApplyDialog(actor, options) {
  if (options.ext?.[SHADOW_SWITCH]) {
    options.shiftDown = (options.shiftDown ?? 0) + 2;
  }
}

registerDialogToggles(shadowToggles);
registerApplyDialog(shadowApplyDialog);
