import {
  registerAfterDamage, registerApplyDialog, registerChatButton, registerDamageModifier, registerHitRider, registerPostRoll, registerRollSources,
  registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { essenceDamageOf } from "../../essence-damage.mjs";
import { hasUsedThisRound, markUsedThisRound } from "../../perks.mjs";
import { worldActors } from "../../companion-link.mjs";
import {
  bestDefense, canAct, choose, confirm, damageButton, esc, gmDo, holds, itemsOf, lastApplyContext, ownerIds, payPower, rollVs, rollVsMany, say,
  SCOPE, skillLabel, sourceOf,
} from "./core.mjs";

/**
 * Reactions tied to a form or a standing state: Monster Morph's per-Path riders, Iron Bravado's
 * shared immunities, Cyborg's damage-to-Essence, and Mind Beam's Calm / Confused, default effect and
 * 3-round duration. (Path of Stone's Resistance is an incoming rule on the Path of Stone Role.)
 */

const FMMC = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.";
export const FORM = {
  monsterMorph: `${FMMC}iDbMl3SS6XnyADN2`,
  ironBravado: "Compendium.essence20.pr_crb.Item.8bmqJ7hyOAcVNB1Y",
  cyborg: "Compendium.essence20.beneath_the_helmet.Item.rqCybOrg7Bth48Pk",
  mindBeam: "Compendium.essence20.mlp_crb.Item.gF8otV8Ag9axRp2Z",
};

const PATH = {
  [`${FMMC}vWie8Dy4u54sf1hy`]: 'cruelty',
  [`${FMMC}4PbR4S3s83Coa0kL`]: 'flame',
  [`${FMMC}GQ5aQWbjmaO9y00w`]: 'frost',
  [`${FMMC}TEjkVjIEFEbRI736`]: 'stone',
  [`${FMMC}0ICOTyVDXK1i6l1S`]: 'thorns',
  [`${FMMC}rWoVOcNc3lXKDbhg`]: 'venom',
};

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

/* -------------------------------------------- */
/*  Monster Morph                                */
/* -------------------------------------------- */

/** The Psycho Path of an actor currently in Monster Form, or null. */
export function monsterPath(actor) {
  if (!actor?.getFlag?.(SCOPE, 'monsterFormActive')) {
    return null;
  }

  const role = itemsOf(actor).find(item => item.type == 'role');
  return PATH[sourceOf(role)] ?? null;
}

// Path of Cruelty (FMMC p.284): "Once per round when you suffer 2 or more damage from a single
// attack, you can attempt an Intimidation Skill Test targeting the Willpower Defense of all creatures
// within 10 feet of you. Upon success, each target suffers 1 Void damage."
// Path of Frost (p.289): "When you suffer 2 or more damage from a single attack, you can freeze all
// those near you in place; attempt a Brawn Skill Test against the Toughness Defense of all creatures
// within 10 feet of you. On a success, that creature is Immobilized until the end of your next turn."
const BURST = {
  cruelty: { skill: 'intimidation', defense: 'willpower', oncePerRound: true },
  frost: { skill: 'brawn', defense: 'toughness', oncePerRound: false },
};

registerAfterDamage(async (actor, dealt) => {
  const path = monsterPath(actor);
  const burst = BURST[path];
  if (!burst || dealt < 2 || !lastApplyContext()?.isAttack || (burst.oncePerRound && hasUsedThisRound(actor, 'reactMonsterBurst'))) {
    return;
  }

  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage.getSpeaker?.({ actor }),
    whisper: ownerIds(actor),
    content: `<p>${T(`ReactMonster_${path}`, { name: esc(actor.name) })}</p>
      <button type="button" data-e20-ext="reactMonsterBurst" data-actor-uuid="${actor.uuid}" data-path="${path}">${esc(skillLabel(burst.skill))}</button>`,
  });
});

registerChatButton('reactMonsterBurst', async (message, button) => {
  const actor = await fromUuid(button.dataset.actorUuid);
  const burst = BURST[button.dataset.path];
  if (!canAct(actor) || !burst || message.getFlag?.(SCOPE, 'reactUsed')) {
    return;
  }

  if (burst.oncePerRound && hasUsedThisRound(actor, 'reactMonsterBurst')) {
    ui.notifications?.warn(T('ReactAlreadyUsed'));
    return;
  }

  const { getAllNearbyTokens } = await import("../../allies.mjs");
  const near = getAllNearbyTokens(actor, 10).map(token => token.actor).filter(Boolean);
  if (!near.length) {
    ui.notifications?.warn(T('ReactNobodyNear'));
    return;
  }

  button.disabled = true;
  if (burst.oncePerRound) {
    await markUsedThisRound(actor, 'reactMonsterBurst');
  }

  const results = await rollVsMany(actor, burst.skill, near, burst.defense);
  for (const result of results.filter(r => r.success)) {
    const target = await fromUuid(result.targetUuid);
    if (!target) {
      continue;
    }

    if (button.dataset.path == 'cruelty') {
      await damageButton(actor, target, 1, 'void', T('ReactMonsterVoid', { name: esc(actor.name), target: esc(target.name) }));
    } else {
      await gmDo({ kind: 'status', uuid: target.uuid, status: 'immobilized', rounds: 1 },
        T('ReactMonsterFrozen', { name: esc(actor.name), target: esc(target.name) }), actor);
    }
  }
});

// Path of Flame (p.292): "When you successfully hit a target with a melee attack, you can spend a
// Free action to make a Might attack Skill Test against the same target. On a success, the target
// takes 1 Fire damage." Thorns (p.298): "...a Might or Finesse attack (your choice)... 1 Acid
// damage." Venom (p.301): "...a Survival attack... 1 Poison damage."
const FOLLOW = {
  flame: { skills: ['might'], type: 'fire' },
  thorns: { skills: ['might', 'finesse'], type: 'acid' },
  venom: { skills: ['survival'], type: 'poison' },
};

registerHitRider(async (actor, target, result, rider) => {
  const path = monsterPath(actor);
  if (!FOLLOW[path] || rider?.style != 'melee' || !target) {
    return;
  }

  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage.getSpeaker?.({ actor }),
    whisper: ownerIds(actor),
    content: `<p>${T(`ReactMonster_${path}`, { name: esc(actor.name), target: esc(target.name) })}</p>
      <button type="button" data-e20-ext="reactMonsterFollow" data-actor-uuid="${actor.uuid}" data-target-uuid="${target.uuid}"
        data-path="${path}">${T('ReactFollowUp')}</button>`,
  });
});

registerChatButton('reactMonsterFollow', async (message, button) => {
  const actor = await fromUuid(button.dataset.actorUuid);
  const target = await fromUuid(button.dataset.targetUuid);
  const follow = FOLLOW[button.dataset.path];
  if (!canAct(actor) || !target || !follow) {
    return;
  }

  const skill = await choose(T('ReactFollowUp'), T('ReactPickSkill'), follow.skills.map(s => [s, skillLabel(s)]));
  if (!skill) {
    return;
  }

  button.disabled = true;
  const { success, cancelled } = await rollVs(actor, skill, bestDefense(target));
  if (!cancelled && success) {
    await damageButton(actor, target, 1, follow.type, T('ReactFollowHit', { name: esc(actor.name), target: esc(target.name) }));
  }
});

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
    const { isImmuneToCondition } = await import("../../condition-immunity.mjs");
    const conditions = (CONFIG.statusEffects ?? []).map(s => s.id).filter(id => id && isImmuneToCondition(actor, id));
    if (!conditions.length) {
      ui.notifications?.warn(T('ReactIronBravadoNone'));
      return null;
    }

    if (!(await pay('free')) || !(await payPower(actor, 1))) {
      return null;
    }

    const { getNearbyAllyTokens } = await import("../../allies.mjs");
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
