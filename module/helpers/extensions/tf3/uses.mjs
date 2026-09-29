import { registerChatButton, registerUse } from "../../extensions.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";
import {
  areAllies, esc, flagOf, inAltMode, itemsOf, say, SCOPE, sourceOf, T, TF3, TF3_WEAPON, writeActor,
} from "./common.mjs";
import { BREAKDOWN_FLAG, HOLO_FLAG, holoDoubles, LADDER_FLAG, RIGHT_OF_ALL_FLAG, STOIC_FLAG } from "./rolls.mjs";

/**
 * Use buttons for the tf3 slice (Transformers CRB / Transformers One Sourcebook).
 */

export const ORDER_FLAG = 'tf3Ordered';
export const CHOSEN_FLAG = 'tf3Chosen';
const MAX_DOUBLES = 8;

const firstTarget = () => game.user?.targets?.first?.()?.actor ?? null;

async function grantsApi() {
  return import("../../grants.mjs");
}

function combatantOf(actor) {
  const combat = game.combat;
  return combat?.combatants?.find?.(c => c.actor?.id == actor?.id) ?? null;
}

function combatActors() {
  const combat = game.combat;
  return combat ? (combat.combatants?.contents ?? [...(combat.combatants ?? [])]).map(c => c.actor).filter(Boolean) : [];
}

/* -------------------------------------------- */
/*  Holographic Doubles                          */
/* -------------------------------------------- */

/**
 * Holographic Doubles (TF CRB, Infiltrator, 10th level, p.61): "as a Standard action, you can create a
 * Holographic copy of yourself adjacent to you. Once activated, you can spend a Free action to create an
 * additional Holographic double, until you run out of unoccupied adjacent spaces ... they last until
 * the end of the scene." The first costs a Standard action, each more a Free action (up to the eight
 * squares around a Common-sized bot).
 */
export async function useHoloDoubles(item, economy, pay) {
  const actor = item.parent;
  const count = holoDoubles(actor);
  if (count >= MAX_DOUBLES) {
    ui.notifications.warn(T('Tf3HoloFull'));
    return null;
  }

  if (!(await pay(count ? 'free' : 'standard'))) {
    return null;
  }

  await actor.setFlag(SCOPE, HOLO_FLAG, { count: count + 1, scene: getSceneEpoch() });
  return T('Tf3HoloMade', { name: actor.name, count: count + 1 });
}

/* -------------------------------------------- */
/*  Irrefutable Order                            */
/* -------------------------------------------- */

/**
 * Irrefutable Order (Commander, 2nd level, p.64): "as a Standard action, you can make a Persuasion Skill
 * Test against a target whose level is no higher than yours. On a success, you give the target a one
 * word order ... they use their Move action to follow the command to the best of their ability on
 * their next turn." The target's Move action is spent for it when that turn starts (./reactions.mjs).
 */
export async function useIrrefutableOrder(item, economy, pay) {
  const actor = item.parent;
  const target = firstTarget();
  if (!target) {
    ui.notifications.warn(T('Tf3PickTarget'));
    return null;
  }

  if ((Number(target.system?.level) || 0) > (Number(actor.system?.level) || 0)) {
    ui.notifications.warn(T('Tf3OrderTooHigh', { name: target.name }));
    return null;
  }

  const defenses = ['willpower', 'cleverness'];
  const answer = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${T('Tf3OrderWord')}</label><input type="text" name="order" value="" /></div>
      <div class="form-group"><label>${T('Tf3OrderDefense')}</label><select name="defense">${
  defenses.map(d => `<option value="${d}">${esc(game.i18n.localize(CONFIG.E20?.defenses?.[d] ?? d))}</option>`).join('')
}</select></div>`,
    buttons: [
      { action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true, callback: (event, button) => ({
        order: String(button.form.elements.order.value ?? '').trim().split(/\s+/)[0] ?? '', defense: button.form.elements.defense.value,
      }) },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!answer || answer == 'cancel' || !answer.order || !(await pay('standard'))) {
    return null;
  }

  const dif = Number(target.system?.defenses?.[answer.defense]?.total ?? 0) || 0;
  const { rollTest } = await grantsApi();
  const { success } = await rollTest(actor, 'persuasion', dif);
  if (!success) {
    return T('Tf3OrderFailed', { name: actor.name, target: target.name });
  }

  await writeActor(target, { [`flags.${SCOPE}.${ORDER_FLAG}`]: { order: answer.order, by: actor.name, combatId: game.combat?.id ?? null } });
  return T('Tf3OrderGiven', { name: actor.name, target: target.name, order: esc(answer.order) });
}

/* -------------------------------------------- */
/*  Ladder                                       */
/* -------------------------------------------- */

/** Ladder, Alt Mode: "You can extend your ladder as a Free action." A second click stows it. */
export async function useLadder(item, economy, pay) {
  const actor = item.parent;
  if (flagOf(actor, LADDER_FLAG)?.scene === getSceneEpoch()) {
    await actor.unsetFlag(SCOPE, LADDER_FLAG);
    return T('Tf3LadderStowed', { name: actor.name });
  }

  if (!inAltMode(actor)) {
    ui.notifications.warn(T('Tf3AltModeOnly', { gear: item.name }));
    return null;
  }

  if (!(await pay('free'))) {
    return null;
  }

  await actor.setFlag(SCOPE, LADDER_FLAG, { scene: getSceneEpoch() });
  return T('Tf3LadderOut', { name: actor.name });
}

/* -------------------------------------------- */
/*  Alt Mode Gear that counts as a weapon        */
/* -------------------------------------------- */

/**
 * Rotor Blades (TF CRB p.135): "Bot Mode: Your Rotor Blades count as a Close Combat Heavy Blade. You
 * can use it even if you are not Trained". Tow Cable & Hook: "Bot Mode: Your Tow Cable counts as a
 * Grappler ... You ignore the Athletics or Finesse requirements of using a Grappler." Water Cannon:
 * "Bot Mode: The Water Cannon counts as a Directed Element Rifle (Cold), but only requires one hardpoint
 * to operate (instead of 2) and waives the Technology requirement." The weapon is made once, from the
 * compendium copy, named for the gear, requirements waived; ./reactions.mjs equips it in Bot Mode and
 * stows it in Alt Mode.
 */
export const GEAR_WEAPONS = {
  [TF3.rotorBlades]: { weapon: TF3_WEAPON.heavyBlade, system: {} },
  [TF3.towCable]: { weapon: TF3_WEAPON.grappler, system: {} },
  [TF3.waterCannon]: { weapon: TF3_WEAPON.directedElementRifle, system: { elementChoice: 'cold' } },
};

export const gearWeaponOf = (actor, gear) => itemsOf(actor).find(i => i.type == 'weapon' && flagOf(i, 'grantedBy') == gear?.id) ?? null;

export async function useGearWeapon(item) {
  const actor = item.parent;
  const spec = GEAR_WEAPONS[sourceOf(item)];
  if (!spec || gearWeaponOf(actor, item)) {
    return null;
  }

  const { grantCopy } = await grantsApi();
  const weapon = await grantCopy(actor, spec.weapon, {
    grantedBy: item, integrated: true, name: item.name,
    system: { 'requirements.skill': null, 'requirements.shift': null, 'requirements.custom': '', equipped: !actor.system?.isTransformed, ...spec.system },
  });
  return weapon ? T('Tf3GearWeaponMade', { name: actor.name, gear: item.name }) : null;
}

/* -------------------------------------------- */
/*  Nose for Trouble                             */
/* -------------------------------------------- */

/**
 * Nose for Trouble: "You can spend a Story Point to modify your location in a minor way, such as adding
 * an exit". The point is spent; what it buys is the GM's.
 */
export async function useNoseForTrouble(item) {
  const actor = item.parent;
  const { canSpendForActor, spendForActor } = await import("../../story-points.mjs");
  if (!canSpendForActor(actor, 1)) {
    ui.notifications.warn(T('Tf3NoStoryPoint'));
    return null;
  }

  await spendForActor(actor, 1, { announce: false });
  return T('Tf3NoseModified', { name: actor.name, perk: item.name });
}

/* -------------------------------------------- */
/*  Stoic                                        */
/* -------------------------------------------- */

/**
 * Stoic (Commander, 7th level, p.65): "as a Move action, you can stand tall for all to see. You take a
 * penalty to Evasion up to -3 and can't defend with Toughness until the beginning of your next turn.
 * Your Allies each gain a number of Free actions equal to the penalty you took to your Evasion on
 * their next turn."
 */
export async function useStoic(item, economy, pay) {
  const actor = item.parent;
  if (!game.combat) {
    ui.notifications.warn(T('Tf3CombatOnly'));
    return null;
  }

  const { chooseButtons } = await grantsApi();
  const penalty = Number(await chooseButtons(item.name, T('Tf3StoicPrompt'), [['1', '-1'], ['2', '-2'], ['3', '-3']])) || 0;
  if (!penalty || !(await pay('move'))) {
    return null;
  }

  await actor.setFlag(SCOPE, STOIC_FLAG, { penalty, combatId: game.combat.id });
  const { setNextTurn } = await import("../../action-economy.mjs");
  const allies = combatActors().filter(other => areAllies(other, actor));
  for (const ally of allies) {
    await setNextTurn(ally, { grant: { free: penalty } }, item.name);
  }

  return T('Tf3StoicUsed', { name: actor.name, penalty, allies: allies.map(a => a.name).join(', ') || '-' });
}

/* -------------------------------------------- */
/*  Target Breakdown                             */
/* -------------------------------------------- */

/**
 * Target Breakdown (Analyst, 13th level, p.60): "you can spend a number of Free actions equal to the
 * number of times you used Analyze Target on a target to give an ally ↑ on an attack against that
 * target equal to that number." The count is dice.mjs's analyzeTargetCounts; the ↑ is banked on the
 * ally and spent by their next attack on that target (./rolls.mjs).
 */
export async function useTargetBreakdown(item, economy, pay) {
  const actor = item.parent;
  const target = firstTarget();
  if (!target) {
    ui.notifications.warn(T('Tf3PickTarget'));
    return null;
  }

  const count = Number(flagOf(actor, 'analyzeTargetCounts')?.[target.uuid.replace(/\./g, '-')]) || 0;
  if (!count) {
    ui.notifications.warn(T('Tf3BreakdownNone', { target: target.name }));
    return null;
  }

  const pool = (game.combat ? combatActors() : worldActors()).filter(other => areAllies(other, actor) && other !== target);
  const { chooseSelect } = await grantsApi();
  const allyId = await chooseSelect(item.name, T('Tf3BreakdownPickAlly', { count, target: target.name }), pool.map(a => ({ value: a.uuid, label: a.name })));
  const ally = pool.find(a => a.uuid == allyId);
  if (!ally) {
    return null;
  }

  for (let i = 0; i < count; i++) {
    if (!(await pay('free'))) {
      return null;
    }
  }

  const banked = (flagOf(ally, BREAKDOWN_FLAG) ?? []).filter(entry => entry?.targetUuid != target.uuid);
  await writeActor(ally, { [`flags.${SCOPE}.${BREAKDOWN_FLAG}`]: [...banked, { targetUuid: target.uuid, shiftUp: count, by: actor.name }] });
  return T('Tf3BreakdownGiven', { name: actor.name, ally: ally.name, count, target: target.name });
}

/* -------------------------------------------- */
/*  The Right Of All Sentient Beings             */
/* -------------------------------------------- */

/** "If they are Defeated during the Combat, you gain an Edge on Skill Tests for the rest of Combat." */
export async function useRightOfAll(item) {
  const actor = item.parent;
  if (!game.combat) {
    ui.notifications.warn(T('Tf3CombatOnly'));
    return null;
  }

  await actor.setFlag(SCOPE, RIGHT_OF_ALL_FLAG, game.combat.id);
  return T('Tf3RightOfAllFallen', { name: actor.name, perk: item.name });
}

/* -------------------------------------------- */
/*  Whisper Campaign                             */
/* -------------------------------------------- */

async function rollTotal(actor, skill, extra = {}) {
  const result = await actor?._dice?.rollSkill({ skill, essence: CONFIG.E20?.skillToEssence?.[skill] ?? 'social', shiftUp: 0, shiftDown: 0, ...extra }, actor);
  return Number(result?.outcomes?.[0]?.results?.[0]?.total ?? result?.total ?? 0);
}

/**
 * Whisper Campaign (Infiltrator, 6th level, p.61): "when you attempt a Social-based Skill Test,
 * designate an adjacent creature. If you fail the Skill Test and there are negative consequences ...
 * you can try to have the consequences affect the designated creature instead. If the creature
 * resists, roll a Contested Skill Test between your Deception and their Persuasion. You gain an Edge
 * on this roll." Used after the failed test, with the designated creature targeted: the holder's
 * Deception (with Edge) is rolled, then the creature's Persuasion - here if this user can roll for it,
 * else by the GM from the card.
 */
export async function useWhisperCampaign(item) {
  const actor = item.parent;
  const target = firstTarget();
  if (!target) {
    ui.notifications.warn(T('Tf3PickTarget'));
    return null;
  }

  const mine = await rollTotal(actor, 'deception', { edge: true });
  if (target.isOwner) {
    return whisperResult(actor, target, mine, await rollTotal(target, 'persuasion'));
  }

  await say(actor, `<p>${T('Tf3WhisperAsk', { name: esc(actor.name), target: esc(target.name), total: mine })}</p>
    <button type="button" data-e20-ext="tf3Whisper" data-actor="${esc(actor.uuid)}" data-target="${esc(target.uuid)}" data-total="${mine}">${esc(T('Tf3WhisperRoll', { target: target.name }))}</button>`);
  return null;
}

function whisperResult(actor, target, mine, theirs) {
  // A tie goes to the one resisting.
  return T(mine > theirs ? 'Tf3WhisperWon' : 'Tf3WhisperLost', { name: actor.name, target: target.name, mine, theirs });
}

registerChatButton('tf3Whisper', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  const target = await fromUuid(button.dataset.target);
  if (!actor || !target || !target.isOwner) {
    return;
  }

  button.disabled = true;
  const theirs = await rollTotal(target, 'persuasion');
  await say(actor, whisperResult(actor, target, Number(button.dataset.total) || 0, theirs));
});

/* -------------------------------------------- */
/*  Deceptive Warfare                            */
/* -------------------------------------------- */

/**
 * Deceptive Warfare (Transformers One Sourcebook, High Guard, p.16): "When you reset your initiative
 * ..., you can do so at the cost of two Free actions instead of a Move action". Resetting Your
 * Initiative (TF CRB p.142): "after the first round, you can use a Move action to reset your
 * Initiative. Roll a new Initiative Skill Test ... If the result is higher than your current place in
 * the Initiative order, it becomes your new place ... Otherwise, you keep their place". The
 * Deception/Infiltration substitute is already on the Initiative roll's own dialog (dice.mjs).
 */
export async function useDeceptiveWarfare(item, economy, pay) {
  const actor = item.parent;
  const combat = game.combat;
  const combatant = combatantOf(actor);
  if (!combat || !combatant) {
    ui.notifications.warn(T('Tf3CombatOnly'));
    return null;
  }

  if ((combat.round ?? 0) < 2) {
    ui.notifications.warn(T('Tf3ResetFirstRound'));
    return null;
  }

  const { chooseButtons } = await grantsApi();
  const cost = await chooseButtons(item.name, T('Tf3ResetPrompt'), [['twoFree', T('Tf3ResetTwoFree')], ['move', T('Tf3ResetMove')]]);
  if (!cost || !(await pay(cost))) {
    return null;
  }

  const before = Number(combatant.initiative);
  await combat.rollInitiative([combatant.id]);
  const after = Number(combat.combatants?.get?.(combatant.id)?.initiative ?? combatant.initiative);
  if (Number.isFinite(before) && !(after > before)) {
    await combatant.update({ initiative: before });
    return T('Tf3ResetKept', { name: actor.name, before, after });
  }

  return T('Tf3ResetMoved', { name: actor.name, after });
}

/* -------------------------------------------- */
/*  One Bot Over Another                         */
/* -------------------------------------------- */

const effectsOfEntry = entry => Object.values(entry.system?.items ?? {}).filter(e => e?.type == 'weaponEffect');
const isMeleeEntry = entry => effectsOfEntry(entry).some(e => e.classification?.style == 'melee' || e.range?.reachMultiplier > 0);
const isRangedEntry = entry => effectsOfEntry(entry).some(e => e.classification?.style && e.classification.style != 'melee');

/**
 * One Bot Over Another (Transformers One Sourcebook, High Guard, p.16): "you are Qualified with 1
 * Limited melee weapon and 1 Limited projectile weapon or 1 Restricted weapon." Picked once and kept
 * on the Perk; Requisition reads it (./reactions.mjs).
 */
export async function useOneBotOverAnother(item) {
  const { chooseButtons, findItems, pickOne } = await grantsApi();
  const plan = await chooseButtons(item.name, T('Tf3QualPlanPrompt'), [['pair', T('Tf3QualPlanPair')], ['restricted', T('Tf3QualPlanRestricted')]]);
  const slots = plan == 'pair'
    ? [{ availabilities: ['limited'], matches: isMeleeEntry, label: 'Tf3QualPickMelee' }, { availabilities: ['limited'], matches: isRangedEntry, label: 'Tf3QualPickRanged' }]
    : (plan == 'restricted' ? [{ availabilities: ['restricted'], matches: null, label: 'Tf3QualPickRestricted' }] : null);
  if (!slots) {
    return null;
  }

  const chosen = [];
  for (const slot of slots) {
    const rows = await findItems({ type: 'weapon', availabilities: slot.availabilities, matches: slot.matches });
    const uuid = await pickOne(T(slot.label), rows);
    if (!uuid) {
      return null;
    }

    chosen.push({ uuid, name: rows.find(row => row.uuid == uuid)?.name ?? (await fromUuid(uuid))?.name ?? '' });
  }

  await item.setFlag(SCOPE, CHOSEN_FLAG, chosen);
  return T('Tf3QualChosen', { perk: item.name, items: chosen.map(c => c.name).join(', ') });
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

const bySource = uuid => item => sourceOf(item) == uuid;

export const USES = [
  { id: 'tf3HoloDoubles', matches: bySource(TF3.holographicDoubles), run: useHoloDoubles },
  { id: 'tf3IrrefutableOrder', matches: bySource(TF3.irrefutableOrder), run: useIrrefutableOrder },
  { id: 'tf3Ladder', matches: bySource(TF3.ladder), run: useLadder },
  {
    id: 'tf3GearWeapon', matches: item => !!GEAR_WEAPONS[sourceOf(item)],
    canUse: item => !gearWeaponOf(item.parent, item), run: useGearWeapon,
  },
  { id: 'tf3NoseForTrouble', matches: bySource(TF3.noseForTrouble), run: useNoseForTrouble },
  { id: 'tf3Stoic', matches: bySource(TF3.stoic), canUse: () => !!game.combat, run: useStoic },
  { id: 'tf3TargetBreakdown', matches: bySource(TF3.targetBreakdown), run: useTargetBreakdown },
  {
    id: 'tf3RightOfAll', matches: bySource(TF3.rightOfAll),
    canUse: item => !!game.combat && flagOf(item.parent, RIGHT_OF_ALL_FLAG) != game.combat.id, run: useRightOfAll,
  },
  { id: 'tf3WhisperCampaign', matches: bySource(TF3.whisperCampaign), run: useWhisperCampaign },
  { id: 'tf3DeceptiveWarfare', matches: bySource(TF3.deceptiveWarfare), canUse: () => !!game.combat, run: useDeceptiveWarfare },
  { id: 'tf3OneBotOverAnother', matches: bySource(TF3.oneBotOverAnother), run: useOneBotOverAnother },
];

USES.forEach(registerUse);

