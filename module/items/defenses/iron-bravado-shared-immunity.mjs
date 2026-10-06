import { registerTurnStart, registerUse } from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { payPower, SCOPE, sourceOf } from "../../mechanics/combat/reaction-engine.mjs";
import { T } from "../shared/item-lang.mjs";

/**
 * Iron Bravado's shared immunities (its own Frightened immunity on attacking is ./iron-bravado.mjs). The other
 * form reactions of this slice are item rules: Path of Stone's Resistance is an incoming rule on the Path of Stone
 * Role, and Monster Morph's per-Path riders (Cruelty and Frost's burst when an attack deals 2 or more, Flame, Thorns
 * and Venom's melee follow-up) are rules on the six Path Role items (rules/ext/b/: damage:attack, rollFlat).
 */

export const IRON_BRAVADO = "Compendium.essence20.pr_crb.Item.8bmqJ7hyOAcVNB1Y";

// Iron Bravado (A Jump Through Time, Black Spectrum Modification, p.45): "As a Free action, you may
// spend 1 Personal Power to make all allies within 30 feet of you immune to all the same conditions
// you are at that time until the beginning of your next turn." Kept on the holder (the allies'
// sheets needn't be written) and enforced in preCreateActiveEffect, the same place essence20.mjs
// refuses a Condition to an immune actor.
const SHARE_FLAG = 'ironBravadoShare';

registerUse({
  id: 'react-iron-bravado',
  matches: item => sourceOf(item) == IRON_BRAVADO,
  canUse: item => (item.parent?.system?.powers?.personal?.value ?? 0) >= 1,
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const { isImmuneToCondition } = await import("../../mechanics/combat/condition-immunity.mjs");
    const conditions = (CONFIG.statusEffects ?? []).map(s => s.id).filter(id => id && isImmuneToCondition(actor, id));
    if (!conditions.length) {
      ui.notifications?.warn(T('ReactIronBravadoNone'));
      return null;
    }

    if (!(await pay('free')) || !(await payPower(actor, 1))) {
      return null;
    }

    const { getNearbyAllyTokens } = await import("../../mechanics/combat/nearby-allies.mjs");
    const allies = getNearbyAllyTokens(actor, 30).map(token => token.actor?.uuid).filter(Boolean);
    await actor.setFlag(SCOPE, SHARE_FLAG, { conditions, allies, combatId: game.combat?.id ?? null });
    const names = conditions.map(id => game.i18n.localize(CONFIG.statusEffects.find(s => s.id == id)?.name ?? id)).join(', ');
    return T('ReactIronBravadoShared', { name: actor.name, count: allies.length, conditions: names });
  },
});

registerTurnStart(async actor => {
  if (actor?.getFlag?.(SCOPE, SHARE_FLAG)) {
    await actor.unsetFlag(SCOPE, SHARE_FLAG);
  }
});

/** Whether a nearby Iron Bravado has made this actor immune to the status. */
export function sharedImmunity(actor, statusId) {
  if (!actor?.uuid) {
    return null;
  }

  return worldActors().find(giver => {
    const share = giver.getFlag?.(SCOPE, SHARE_FLAG);
    return share && share.allies?.includes(actor.uuid) && share.conditions?.includes(statusId)
      && (!game.combat || !share.combatId || share.combatId == game.combat.id);
  }) ?? null;
}

globalThis.Hooks?.on('preCreateActiveEffect', effect => {
  const actor = effect?.parent;
  if (actor?.documentName != 'Actor') {
    return true;
  }

  for (const statusId of effect.statuses ?? effect._source?.statuses ?? []) {
    const giver = sharedImmunity(actor, statusId);
    if (giver) {
      ui.notifications?.warn(T('ReactIronBravadoBlocked', { name: actor.name, giver: giver.name }));
      return false;
    }
  }

  return true;
});
