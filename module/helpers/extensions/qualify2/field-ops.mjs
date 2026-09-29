import { registerChatButton, registerPostRoll, registerRest, registerRoundStart, registerTurnEnd, registerUse } from "../../extensions.mjs";
import { escape, has, itemOf, Q2, sourceOf, T, traitsOf } from "./common.mjs";

/**
 * qualify2 Use buttons and reactions that aren't about Qualification:
 * At Ease, Disease; Cascading Failure; Destructive Overcharge; Morale Booster; Opportunist; Sensitive.
 */

const CASCADE_FLAG = 'q2Cascades';
const OVERCHARGE_FLAG = 'q2Overcharges';
const MORALE_FLAG = 'q2MoraleUses';
const SENSITIVE_IGNORE_FLAG = 'q2SensitiveIgnore';

/* -------------------------------------------- */
/*  Shared: a blast around a point               */
/* -------------------------------------------- */

function sceneTokens(sceneId) {
  if (!canvas?.grid || (sceneId && canvas.scene?.id != sceneId)) {
    return [];
  }

  return canvas.tokens?.placeables ?? [];
}

/** Tokens with an actor within `radius` feet of a point. */
export function tokensWithin(point, radius, sceneId = null) {
  if (!point) {
    return [];
  }

  return sceneTokens(sceneId).filter(token => token.actor
    && canvas.grid.measurePath([{ x: point.x, y: point.y }, token.center]).distance <= radius);
}

function damageButton(actor, key, amount, damageType, label = null) {
  const typeLabel = T(CONFIG.E20.damageTypes?.[damageType] ?? damageType);
  return `<button type="button" class="e20-check-damage-button" data-action="apply-damage" data-key="${actor.uuid}:${key}"
    data-target-uuid="${actor.uuid}" data-damage="${amount}" data-damage-type="${damageType}">
    ${escape(label ?? actor.name)}: ${amount} ${escape(typeLabel)}</button>`;
}

/**
 * A Skill Test against a Defense of everyone in the blast, through the normal roll pipeline (the
 * roll dialog, the check card), then an Apply Damage button for each creature it succeeded against.
 * @returns {Promise<Number>}   How many were hit.
 */
export async function blastTest(actor, { point, radius, sceneId, skill, defense, damage, damageType, title }) {
  const tokens = tokensWithin(point, radius, sceneId);
  if (!tokens.length) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${escape(T('E20.Q2BlastEmpty', { name: title }))}</p>` });
    return 0;
  }

  canvas.tokens?.setTargets?.(tokens.map(token => token.id));
  const essence = CONFIG.E20.skillToEssence?.[skill] ?? 'smarts';
  const rolled = await actor._dice?.rollSkill({ skill, essence, shiftUp: 0, shiftDown: 0, defenseType: defense }, actor);
  const results = (rolled?.outcomes ?? []).flatMap(outcome => outcome.results ?? []);
  const buttons = [];
  for (const [index, result] of results.entries()) {
    const target = result.success && result.targetUuid ? await fromUuid(result.targetUuid) : null;
    if (target) {
      buttons.push(damageButton(target, `q2blast:${index}`, damage * Math.max(1, result.multiplier ?? 1), damageType));
    }
  }

  if (buttons.length) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="e20-check-card"><p>${escape(title)}</p>${buttons.join('')}</div>`,
    });
  }

  return buttons.length;
}

function hereOf(actor) {
  const target = game.user?.targets?.first?.();
  const token = actor.getActiveTokens?.()?.[0];
  return { target, point: target?.center ?? token?.center ?? null, sceneId: canvas?.scene?.id ?? null };
}

async function payInCombat(actor, cost, source) {
  if (!game.combat) {
    return true;
  }

  const { spend } = await import("../../action-economy.mjs");
  const paid = await spend(actor, cost, { source });
  return !paid?.blocked;
}

/* -------------------------------------------- */
/*  At Ease, Disease                             */
/* -------------------------------------------- */

// At Ease, Disease (Sgt Slaughter Sourcebook, Officer, 10th level, p.10): "during combat, you can use
// Intimidation instead of Science to heal living creatures, and you don't need a Standard Science
// (Medicine) Kit to heal damage." Healing Skill Test (Core Rules p.209-210): a Standard action, "The
// DIF ... is equal to 5 + 5 per Health you want to restore." The targeted creature, or yourself.
async function atEaseDisease(item, pay) {
  const actor = item.parent;
  if (!game.combat) {
    ui.notifications.warn(T('E20.Q2AtEaseCombatOnly'));
    return null;
  }

  const target = game.user?.targets?.first?.()?.actor ?? actor;
  if (['vehicle', 'zord', 'megaform'].includes(target.type)) {
    ui.notifications.warn(T('E20.Q2AtEaseLiving'));
    return null;
  }

  const { pickHealSkillTestAmount, computeRestoreHealthDif, applyHealSkillTestResult } = await import("../../heal-skill-test.mjs");
  const amount = await pickHealSkillTestAmount();
  if (!amount || !(await pay('standard'))) {
    return null;
  }

  const { rollTest } = await import("../../grants.mjs");
  const { success } = await rollTest(actor, 'intimidation', computeRestoreHealthDif(amount));
  if (!success) {
    return T('E20.Q2AtEaseFailed', { name: actor.name, target: target.name });
  }

  await applyHealSkillTestResult(target, amount);
  return T('E20.Q2AtEaseHealed', { name: actor.name, target: target.name, amount });
}

/* -------------------------------------------- */
/*  Destructive Overcharge                       */
/* -------------------------------------------- */

// Destructive Overcharge (Quartermaster's Guide p.30): "As a Standard action, you can rig a weapon or
// item that has the Computerized or Element trait to overload ... At the end of your next turn, it
// explodes in a 20ft-radius blast. This deals 3 Fire damage to the surface or object it was resting
// on, or to a living target if they were holding it. Additionally, make a Technology Skill Test
// against the Toughness or Evasion of all creatures in the blast. Success deals 1 Fire damage."
// The rigged item is one of yours, or - with a token targeted - the item that creature is holding.
export function overchargeable(item) {
  const traits = traitsOf(item);
  return traits.includes('computerized') || traits.includes('element');
}

async function destructiveOvercharge(item, pay) {
  const actor = item.parent;
  const { target, point, sceneId } = hereOf(actor);
  const holder = target?.actor && target.actor.id != actor.id ? target.actor : null;
  let name;
  if (holder) {
    name = T('E20.Q2OverchargeHeldBy', { name: holder.name });
  } else {
    const { chooseSelect } = await import("../../grants.mjs");
    const own = actor.items.filter(other => overchargeable(other));
    const id = await chooseSelect(item.name, T('E20.Q2OverchargePick'), own.map(other => ({ value: other.id, label: other.name })));
    if (!id) {
      if (!own.length) {
        ui.notifications.warn(T('E20.Q2OverchargeNothing'));
      }

      return null;
    }

    name = actor.items.get(id)?.name;
  }

  if (!point || !(await pay('standard'))) {
    return null;
  }

  const combat = game.combat;
  const rig = {
    id: foundry.utils.randomID(), name, holderUuid: holder?.uuid ?? null, sceneId, x: point.x, y: point.y,
    combatId: combat?.id ?? null, turnEnds: 0,
  };
  await actor.setFlag('essence20', OVERCHARGE_FLAG, [...(actor.getFlag('essence20', OVERCHARGE_FLAG) ?? []), rig]);
  // Out of combat there are no turns to count - the button is there straight away.
  if (!combat) {
    await postOverchargeCard(actor, rig, 'E20.Q2OverchargeDue');
  }

  return T('E20.Q2OverchargeRigged', { name: actor.name, item: name });
}

async function postOverchargeCard(actor, rig, key) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${escape(T(key, { name: actor.name, item: rig.name }))}</p>
      <button type="button" class="e20-chat-action-button" data-e20-ext="q2Overcharge" data-actor-uuid="${actor.uuid}" data-rig-id="${rig.id}">${escape(T('E20.Q2Explode'))}</button>`,
  });
}

/** The rigger's turn ends: the one it was rigged in, then "the end of your next turn". */
export async function overchargeTurnEnd(actor, combat) {
  const rigs = actor?.getFlag?.('essence20', OVERCHARGE_FLAG) ?? [];
  if (!rigs.length || !combat) {
    return;
  }

  const due = [];
  const next = rigs.map(rig => {
    if (rig.combatId != combat.id || rig.announced) {
      return rig;
    }

    const turnEnds = (rig.turnEnds ?? 0) + 1;
    if (turnEnds >= 2) {
      due.push(rig);
      return { ...rig, turnEnds, announced: true };
    }

    return { ...rig, turnEnds };
  });
  await actor.setFlag('essence20', OVERCHARGE_FLAG, next);
  for (const rig of due) {
    await postOverchargeCard(actor, rig, 'E20.Q2OverchargeDue');
  }
}

export async function onOverchargeButton(message, button) {
  const actor = await fromUuid(button.dataset.actorUuid);
  const rig = (actor?.getFlag?.('essence20', OVERCHARGE_FLAG) ?? []).find(r => r.id == button.dataset.rigId);
  if (!actor?.isOwner || !rig) {
    ui.notifications.warn(T('E20.Q2RigGone'));
    return;
  }

  const { chooseButtons } = await import("../../grants.mjs");
  const defense = await chooseButtons(T('E20.Q2Explode'), T('E20.Q2OverchargeDefense'), [['toughness', T('E20.DefenseToughness')], ['evasion', T('E20.DefenseEvasion')]]);
  if (!defense) {
    return;
  }

  await actor.setFlag('essence20', OVERCHARGE_FLAG, (actor.getFlag('essence20', OVERCHARGE_FLAG) ?? []).filter(r => r.id != rig.id));
  button.disabled = true;
  const holder = rig.holderUuid ? await fromUuid(rig.holderUuid) : null;
  const point = holder?.getActiveTokens?.()?.[0]?.center ?? { x: rig.x, y: rig.y };
  if (holder) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="e20-check-card"><p>${escape(T('E20.Q2OverchargeHolder', { item: rig.name }))}</p>${damageButton(holder, 'q2overcharge', 3, 'fire')}</div>`,
    });
  }

  await blastTest(actor, {
    point, radius: 20, sceneId: rig.sceneId, skill: 'technology', defense, damage: 1, damageType: 'fire',
    title: T('E20.Q2OverchargeBlast', { item: rig.name }),
  });
}

/* -------------------------------------------- */
/*  Cascading Failure                            */
/* -------------------------------------------- */

// Cascading Failure (Quartermaster's Guide p.26-27, Technician, 17th level): "when you succeed at a
// Technology Skill Test to use Some Assembly Required, you can allow it to continue to operate
// normally for either a set amount of time or, if you are adjacent to it in combat, until you use a
// Free action to disable it. Doing so does not require an additional Skill Test. You may instead spend
// a Standard action to disable it disastrously, causing it to explode. The effects of the explosion
// are determined by the item's size: small items are equivalent to a grenade, while larger items use
// Table 9-4: Vehicle Explosions." A grenade (G.I. Joe CRB frag grenade): Technology vs Evasion, 1 Sharp,
// 10ft blast. Table 9-4 (helpers/vehicle-defeat.mjs): 15ft/2d2, 30ft/2d4 or 45ft/2d6 Fire, a DIF 14
// Athletics or Acrobatics Skill Test for half. A targeted vehicle explodes as itself.
const EXPLOSION_TIERS = { large1: { radius: 15, formula: '2d2' }, large2: { radius: 30, formula: '2d4' }, large3: { radius: 45, formula: '2d6' } };

async function cascadingFailure(item) {
  const actor = item.parent;
  const { target, point, sceneId } = hereOf(actor);
  const vehicle = target?.actor && ['vehicle', 'zord'].includes(target.actor.type) ? target.actor : null;
  const { chooseButtons } = await import("../../grants.mjs");
  const size = vehicle ? 'vehicle' : await chooseButtons(item.name, T('E20.Q2CascadeSize'), [
    ['small', T('E20.Q2CascadeSmall')], ['large1', T('E20.Q2CascadeLarge', { radius: 15 })],
    ['large2', T('E20.Q2CascadeLarge', { radius: 30 })], ['large3', T('E20.Q2CascadeLarge', { radius: 45 })],
  ]);
  if (!size || !point) {
    return null;
  }

  const rounds = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: `<p>${escape(T('E20.Q2CascadeTimer'))}</p><div class="form-group"><input type="number" name="rounds" value="0" min="0" step="1"></div>`,
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => Number(button.form.elements.rounds.value) || 0 },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (rounds === null || rounds == 'cancel') {
    return null;
  }

  const name = vehicle?.name ?? target?.actor?.name ?? T('E20.Q2CascadeDevice');
  const combat = game.combat;
  const rig = {
    id: foundry.utils.randomID(), name, size, vehicleUuid: vehicle?.uuid ?? null, sceneId, x: point.x, y: point.y,
    combatId: combat?.id ?? null, dueRound: rounds > 0 && combat ? combat.round + rounds : null,
  };
  await actor.setFlag('essence20', CASCADE_FLAG, [...(actor.getFlag('essence20', CASCADE_FLAG) ?? []), rig]);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${escape(T(rounds > 0 ? 'E20.Q2CascadeRiggedTimed' : 'E20.Q2CascadeRigged', { name: actor.name, item: name, rounds }))}</p>
      <button type="button" class="e20-chat-action-button" data-e20-ext="q2Cascade" data-mode="disable" data-actor-uuid="${actor.uuid}" data-rig-id="${rig.id}">${escape(T('E20.Q2CascadeDisable'))}</button>
      <button type="button" class="e20-chat-action-button" data-e20-ext="q2Cascade" data-mode="explode" data-actor-uuid="${actor.uuid}" data-rig-id="${rig.id}">${escape(T('E20.Q2Explode'))}</button>`,
  });
  return null;
}

/** A timed device stops working once its time is up (GM client, new round). */
export async function cascadeRoundStart(combat) {
  if (!game.user?.isActiveGM || !combat) {
    return;
  }

  const { worldActors } = await import("../../companion-link.mjs");
  for (const actor of worldActors()) {
    const rigs = actor.getFlag?.('essence20', CASCADE_FLAG) ?? [];
    const due = rigs.filter(rig => rig.combatId == combat.id && rig.dueRound != null && combat.round >= rig.dueRound);
    if (!due.length) {
      continue;
    }

    await actor.setFlag('essence20', CASCADE_FLAG, rigs.filter(rig => !due.includes(rig)));
    for (const rig of due) {
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${escape(T('E20.Q2CascadeFailed', { item: rig.name }))}</p>` });
    }
  }
}

async function flatSave(actor, dif) {
  const best = [];
  for (const skill of ['athletics', 'acrobatics']) {
    const data = actor.system?.skills?.[skill];
    if (!data) {
      continue;
    }

    const formula = data.shift && data.shift != 'd20' ? `d20 + ${data.shift}` : 'd20';
    const roll = await new Roll(`${formula} + ${Number(data.modifier) || 0}`).evaluate();
    best.push(roll.total);
  }

  return Math.max(0, ...best) >= dif;
}

export async function onCascadeButton(message, button) {
  const actor = await fromUuid(button.dataset.actorUuid);
  const rig = (actor?.getFlag?.('essence20', CASCADE_FLAG) ?? []).find(r => r.id == button.dataset.rigId);
  if (!actor?.isOwner || !rig) {
    ui.notifications.warn(T('E20.Q2RigGone'));
    return;
  }

  const explode = button.dataset.mode == 'explode';
  if (!(await payInCombat(actor, explode ? 'standard' : 'free', T('E20.Q2CascadingFailure')))) {
    return;
  }

  await actor.setFlag('essence20', CASCADE_FLAG, (actor.getFlag('essence20', CASCADE_FLAG) ?? []).filter(r => r.id != rig.id));
  button.parentElement?.querySelectorAll?.(`[data-rig-id="${rig.id}"]`)?.forEach(b => {
    b.disabled = true; 
  });
  if (!explode) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${escape(T('E20.Q2CascadeDisabled', { name: actor.name, item: rig.name }))}</p>` });
    return;
  }

  if (rig.vehicleUuid) {
    const vehicle = await fromUuid(rig.vehicleUuid);
    if (vehicle) {
      const { explodeVehicle } = await import("../../vehicle-defeat.mjs");
      await explodeVehicle(vehicle);
      return;
    }
  }

  if (rig.size == 'small') {
    await blastTest(actor, {
      point: rig, radius: 10, sceneId: rig.sceneId, skill: 'technology', defense: 'evasion', damage: 1, damageType: 'sharp',
      title: T('E20.Q2CascadeBlast', { item: rig.name }),
    });
    return;
  }

  const tier = EXPLOSION_TIERS[rig.size] ?? EXPLOSION_TIERS.large1;
  const roll = await new Roll(tier.formula).evaluate();
  const buttons = [];
  for (const [index, token] of tokensWithin(rig, tier.radius, rig.sceneId).entries()) {
    const saved = await flatSave(token.actor, 14);
    const amount = saved ? Math.ceil(roll.total / 2) : roll.total;
    buttons.push(damageButton(token.actor, `q2cascade:${index}`, amount, 'fire', `${token.name}${saved ? ` (${T('E20.Q2Half')})` : ''}`));
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls: [roll],
    content: `<div class="e20-check-card"><p>${escape(T('E20.Q2CascadeExploded', { item: rig.name, damage: roll.total, radius: tier.radius }))}</p>${buttons.join('')}</div>`,
  });
}

/* -------------------------------------------- */
/*  Morale Booster                               */
/* -------------------------------------------- */

// Morale Booster (Enigma of Combination, Influence Perk, p.23): "As a Standard action, you can remove
// the Frightened or Impaired condition from all allies within 30 feet that can hear you; you can do
// this a number of times per day equal to your Social Essence Score." A Rest is the new day.
export function moraleUsesLeft(actor, item) {
  const social = Number(actor?.system?.essences?.social?.max ?? actor?.system?.essences?.social?.value ?? actor?.system?.essences?.social) || 0;
  return Math.max(0, social - (Number(item?.flags?.essence20?.[MORALE_FLAG]) || 0));
}

async function moraleBooster(item, pay) {
  const actor = item.parent;
  if (moraleUsesLeft(actor, item) <= 0) {
    ui.notifications.warn(T('E20.Q2MoraleNoUses'));
    return null;
  }

  const { getNearbyAllyTokens } = await import("../../allies.mjs");
  const allies = getNearbyAllyTokens(actor, 30).filter(token => token.actor?.statuses?.has?.('frightened') || token.actor?.statuses?.has?.('impaired'));
  if (!(await pay('standard'))) {
    return null;
  }

  await item.setFlag('essence20', MORALE_FLAG, (Number(item.flags?.essence20?.[MORALE_FLAG]) || 0) + 1);
  // Targeted, so a player's client may have the GM clear another player's Conditions (gm-relay).
  canvas.tokens?.setTargets?.(allies.map(token => token.id));
  for (const token of allies) {
    for (const status of ['frightened', 'impaired']) {
      if (token.actor.statuses.has(status)) {
        await token.actor.toggleStatusEffect(status, { active: false });
      }
    }
  }

  return T('E20.Q2MoraleUsed', { name: actor.name, allies: allies.map(token => token.name).join(', ') || T('E20.Q2Nobody'), left: moraleUsesLeft(actor, item) - 1 });
}

export async function moraleRest(actor) {
  const item = itemOf(actor, Q2.moraleBooster);
  if (item?.flags?.essence20?.[MORALE_FLAG]) {
    await item.unsetFlag('essence20', MORALE_FLAG);
  }
}

/* -------------------------------------------- */
/*  Opportunist                                  */
/* -------------------------------------------- */

// Opportunist (Transformers CRB, Infiltrator, 17th level, p.61): "when you successfully attack a
// Stunned target, you extend the Stun effect by 1 round." Stun here is either the Stunned Condition
// (its round count, when it has one) or a Stun-damage count (system.stun.value, which counts down the
// denied Move actions a turn at a time - helpers/combat.mjs#healStunAtTurnStart).
export function isStunned(actor) {
  return !!actor?.statuses?.has?.('stunned') || (Number(actor?.system?.stun?.value) || 0) > 0;
}

export async function opportunistPostRoll(actor, results, checkContext, extra = {}) {
  if (!has(actor, Q2.opportunist) || !checkContext?.isAttack) {
    return;
  }

  for (const { target, hit } of extra.hits ?? []) {
    if (!hit || !isStunned(target)) {
      continue;
    }

    const effect = target.effects?.find?.(e => e.statuses?.has?.('stunned') && e.duration?.rounds);
    if (effect) {
      await effect.update({ 'duration.rounds': effect.duration.rounds + 1 });
    } else if ((Number(target.system?.stun?.value) || 0) > 0) {
      await target.update({ 'system.stun.value': target.system.stun.value + 1 });
    }

    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${escape(T('E20.Q2OpportunistExtended', { name: target.name }))}</p>` });
  }
}

/* -------------------------------------------- */
/*  Sensitive                                    */
/* -------------------------------------------- */

// Sensitive (MLP CRB, Precise Hang-Up, p.58): "When you take Damage, you also suffer Snag on Skill
// Tests for the next round. You can expend one of your daily uses of Detail Oriented to ignore this
// effect for one round." The Snag is banked by helpers/combat.mjs (pendingSensitiveSnag); Detail
// Oriented's three uses a day are counted by helpers/action-perks.mjs (actionPerkDailyUses).
const DAILY_FLAG = 'actionPerkDailyUses';

export function detailOrientedLeft(actor) {
  if (!has(actor, Q2.detailOriented)) {
    return 0;
  }

  return Math.max(0, 3 - (Number(actor.getFlag?.('essence20', DAILY_FLAG)?.detailOriented) || 0));
}

function roundStamp() {
  return { combatId: game.combat?.id ?? null, round: game.combat?.round ?? null };
}

export function sensitiveIgnored(actor) {
  const record = actor?.getFlag?.('essence20', SENSITIVE_IGNORE_FLAG);
  if (!record) {
    return false;
  }

  const now = roundStamp();
  return record.combatId == now.combatId && record.round == now.round;
}

async function ignoreSensitive(item) {
  const actor = item.parent;
  if (detailOrientedLeft(actor) <= 0) {
    ui.notifications.warn(T('E20.Q2SensitiveNoUses'));
    return null;
  }

  const used = actor.getFlag('essence20', DAILY_FLAG) ?? {};
  await actor.setFlag('essence20', DAILY_FLAG, { ...used, detailOriented: (Number(used.detailOriented) || 0) + 1 });
  await actor.setFlag('essence20', SENSITIVE_IGNORE_FLAG, roundStamp());
  if (actor.getFlag('essence20', 'pendingSensitiveSnag')) {
    await actor.unsetFlag('essence20', 'pendingSensitiveSnag');
  }

  return T('E20.Q2SensitiveIgnored', { name: actor.name });
}

/** A Snag banked while the ignore is in force is dropped (on the client that banked it). */
export async function sensitiveOnUpdate(actor, changes, options, userId) {
  if (userId != game.user?.id || !changes?.flags?.essence20?.pendingSensitiveSnag || !sensitiveIgnored(actor)) {
    return;
  }

  await actor.unsetFlag('essence20', 'pendingSensitiveSnag');
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

const USES = {
  [Q2.atEaseDisease]: atEaseDisease,
  [Q2.destructiveOvercharge]: destructiveOvercharge,
  [Q2.cascadingFailure]: cascadingFailure,
  [Q2.moraleBooster]: moraleBooster,
  [Q2.sensitive]: ignoreSensitive,
};

export const FIELD_OPS_USE = {
  id: 'q2FieldOps',
  matches: item => !!USES[sourceOf(item)],
  canUse: item => {
    const source = sourceOf(item);
    if (source == Q2.moraleBooster) {
      return moraleUsesLeft(item.parent, item) > 0;
    }

    if (source == Q2.sensitive) {
      return detailOrientedLeft(item.parent) > 0;
    }

    return true;
  },
  async run(item, economy, pay) {
    const fn = USES[sourceOf(item)];
    return fn ? fn(item, pay ?? (async () => true)) : null;
  },
};

registerUse(FIELD_OPS_USE);
registerChatButton('q2Overcharge', onOverchargeButton);
registerChatButton('q2Cascade', onCascadeButton);
registerTurnEnd(overchargeTurnEnd);
registerRoundStart(cascadeRoundStart);
registerRest(moraleRest);
registerPostRoll(opportunistPostRoll);
if (globalThis.Hooks?.on) {
  Hooks.on('updateActor', sensitiveOnUpdate);
}
