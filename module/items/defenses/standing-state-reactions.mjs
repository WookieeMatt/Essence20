import {
  registerAfterDamage, registerApplyDialog, registerDamageModifier, registerPostRoll, registerRollSources,
  registerTurnStart, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { essenceDamageOf } from "../../mechanics/combat/essence-damage.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import {
  choose, confirm, esc, gmDo, holds, payPower, say, SCOPE, sourceOf,
} from "../../mechanics/combat/reaction-engine.mjs";

/**
 * Reactions tied to a form or a standing state: Iron Bravado's
 * shared immunities, Cyborg's damage-to-Essence, and Mind Beam's Calm / Confused, default effect and
 * 3-round duration. (Path of Stone's Resistance is an incoming rule on the Path of Stone Role.)
 */

export const FORM = {
  ironBravado: "Compendium.essence20.pr_crb.Item.8bmqJ7hyOAcVNB1Y",
  cyborg: "Compendium.essence20.beneath_the_helmet.Item.rqCybOrg7Bth48Pk",
  mindBeam: "Compendium.essence20.mlp_crb.Item.gF8otV8Ag9axRp2Z",
};

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

// Monster Morph's per-Path riders (Cruelty and Frost's burst when an attack deals 2 or more, Flame, Thorns and Venom's
// melee follow-up) are rules on the six Path Role items (rules/ext/b/: damage:attack, rollFlat).

/* -------------------------------------------- */
/*  Iron Bravado                                 */
/* -------------------------------------------- */

// Iron Bravado (A Jump Through Time, Black Spectrum Modification, p.45): "As a Free action, you may
// spend 1 Personal Power to make all allies within 30 feet of you immune to all the same conditions
// you are at that time until the beginning of your next turn." Kept on the holder (the allies'
// sheets needn't be written) and enforced in preCreateActiveEffect, the same place essence20.mjs
// refuses a Condition to an immune actor.
const SHARE_FLAG = 'ironBravadoShare';

registerUse({
  id: 'react-iron-bravado',
  matches: item => sourceOf(item) == FORM.ironBravado,
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

/* -------------------------------------------- */
/*  Cyborg                                       */
/* -------------------------------------------- */

// Cyborg (Beneath the Helmet, 1st level alternate Spectrum Perk, p.48): "Whenever you take damage,
// you may instead have the damage applied as Essence damage. While this may temporarily give you a
// boost in combat, you may not recover any lost Health until your Essence damage is healed." Asked
// where damage lands (the GM's Apply Damage); the Health lock is a preUpdateActor guard.
registerDamageModifier(async (actor, amount) => {
  if (!(amount > 0) || !holds(actor, FORM.cyborg) || !game.user?.isGM) {
    return amount;
  }

  const essences = Object.entries(actor.system?.essences ?? {}).filter(([, e]) => Number(e?.value) > 0);
  if (!essences.length || !(await confirm(T('ReactCyborg'), T('ReactCyborgAsk', { name: esc(actor.name), amount })))) {
    return amount;
  }

  const essence = await choose(T('ReactCyborg'), T('ReactCyborgPick'),
    essences.map(([key]) => [key, game.i18n.localize(CONFIG.E20?.essences?.[key] ?? key)]));
  if (!essence) {
    return amount;
  }

  const current = Number(actor.system.essences[essence].value) || 0;
  const taken = Math.min(current, amount);
  await actor.update({ [`system.essences.${essence}.value`]: current - taken });
  await say(actor, T('ReactCyborgTaken', { name: esc(actor.name), amount: taken, essence: game.i18n.localize(CONFIG.E20?.essences?.[essence] ?? essence) }));
  return amount - taken;
});

globalThis.Hooks?.on('preUpdateActor', (actor, changes) => {
  const next = foundry.utils.getProperty(changes, 'system.health.value');
  if (next === undefined || !holds(actor, FORM.cyborg) || !(Number(next) > Number(actor.system?.health?.value ?? 0))) {
    return true;
  }

  if (essenceDamageOf(actor) > 0) {
    delete changes.system.health.value;
    ui.notifications?.warn(T('ReactCyborgNoHeal', { name: actor.name }));
  }

  return true;
});

/* -------------------------------------------- */
/*  Mind Beam                                    */
/* -------------------------------------------- */

// Mind Beam (MLP CRB p.139-140): "When you Master Mind Beam, pick one of the following effects: Calm,
// Confuse, Frighten, Impair, or Stunned. This is the default effect... You may use any of the other
// effects of this spell instead but doing so increases the cost by ↓1." 3 rounds. "Calm: ... Social
// Skill Tests against them gain ↑2. This effect breaks if they are harmed." "Confused: The target
// forgets what they were doing and moves at random... They will not attack or harm other creatures."
globalThis.Hooks?.once('setup', () => {
  const list = CONFIG.statusEffects;
  if (!Array.isArray(list)) {
    return;
  }

  for (const [id, img] of [['calm', 'icons/svg/heal.svg'], ['confused', 'icons/svg/daze.svg']]) {
    if (!list.some(s => s.id == id)) {
      list.push({ id, name: `E20.ReactStatus_${id}`, img, changes: [] });
    }
  }
});

registerApplyDialog(async (actor, options, ctx) => {
  const effect = ctx?.dataset?.mindBeamEffect;
  if (!effect || sourceOf(ctx?.item) != FORM.mindBeam) {
    return;
  }

  // The first effect cast is taken as the one Mastered - it's stored on the spell and can be
  // changed by clearing the flag.
  const chosen = ctx.item.getFlag?.(SCOPE, 'mindBeamDefault');
  if (!chosen) {
    await ctx.item.setFlag?.(SCOPE, 'mindBeamDefault', effect);
  } else if (chosen != effect) {
    options.shiftDown = (Number(options.shiftDown) || 0) + 1;
  }
});

registerPostRoll(async (actor, results, checkContext) => {
  const effect = checkContext?.mindBeamEffect;
  if (checkContext?.spellSourceId != FORM.mindBeam || !effect) {
    return;
  }

  for (const result of (results ?? []).filter(r => r.success && r.targetUuid)) {
    const target = await fromUuid(result.targetUuid);
    await gmDo({ kind: 'status', uuid: result.targetUuid, status: effect, rounds: 3 },
      T('ReactMindBeamLasts', { target: esc(target?.name ?? ''), effect: game.i18n.localize(CONFIG.statusEffects?.find(s => s.id == effect)?.name ?? effect) }), actor);
  }
});

registerRollSources((actor, target, ctx) => {
  const social = CONFIG.E20?.skillsByEssence?.social ?? [];
  if (!target?.statuses?.has?.('calm') || !social.includes(ctx?.rolledSkill)) {
    return null;
  }

  return { sources: [{ id: 'reactCalm', label: T('ReactStatus_calm'), shiftUp: 2 }] };
});

registerAfterDamage(async (actor, dealt) => {
  if (dealt > 0 && actor?.statuses?.has?.('calm')) {
    await actor.toggleStatusEffect('calm', { active: false });
  }
});
