import {
  registerApplyDialog, registerChatButton, registerChatDecorator, registerDerived, registerDialogToggles, registerUse,
} from "../../extensions.mjs";
import { getSceneEpoch, getUses } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";
import { has, itemFrom, Q1, setQ1Flag, sourceOf, T } from "./common.mjs";

/* -------------------------------------------- */
/*  Danger Sense (Across the Stars p.56)         */
/* -------------------------------------------- */

// "You gain ↑2 to your Alertness Skill Tests [the item's own Active Effect], have Edge on Skill
// tests to avoid traps and ambushes, and re-roll 1s and 2s on Initiative Skill dice."
//
// Initiative is rolled from system.initiative.formula through Combat#rollInitiative, never through
// a chat card the reroll engine can decorate, so the reroll is written into the formula itself:
// every Skill die (not the d20) gets Foundry's "r<=2" - rerolled once, the new result stands. A d2
// is left alone (it can only ever show a 1 or 2).
export function withInitiativeRerolls(formula) {
  return String(formula ?? '').replace(/(\d*)d(\d+)(?![\dr])/g, (match, count, faces) => {
    const size = Number(faces);
    return size >= 3 && size <= 12 ? `${match}r<=2` : match;
  });
}

export function dangerSenseDerived(actor) {
  const initiative = actor?.system?.initiative;
  if (!initiative?.formula || !has(actor, Q1.dangerSense) || initiative.formula.includes('r<=2')) {
    return;
  }

  initiative.formula = withInitiativeRerolls(initiative.formula);
}

export function dangerSenseToggles(actor) {
  const toggles = [];
  if (has(actor, Q1.dangerSense)) {
    toggles.push({ name: 'q1DangerSense', label: T('E20.Q1DangerSenseToggle'), type: 'checkbox', value: false });
  }

  // Nothing Personal (Intercontinental Adventures p.100): "When attempting to win over a new
  // Contact, you gain an Edge on one of the Skill Tests."
  if (has(actor, Q1.nothingPersonal)) {
    toggles.push({ name: 'q1NothingPersonal', label: T('E20.Q1NothingPersonalToggle'), type: 'checkbox', value: false });
  }

  return toggles;
}

export function dangerSenseApply(actor, options) {
  if (options.ext?.q1DangerSense || options.ext?.q1NothingPersonal) {
    options.edge = true;
  }
}

/* -------------------------------------------- */
/*  Shared reroll plumbing                       */
/* -------------------------------------------- */

async function postReroll(message, config, label) {
  const { applyReroll } = await import("../../reroll.mjs");
  const rerolled = Roll.fromData(message.rolls[0].toJSON());
  if (!(await applyReroll(rerolled, config))) {
    return false;
  }

  const { buildCheckChatData } = await import("../../combat.mjs");
  const chatData = await buildCheckChatData(rerolled, {
    flavor: label,
    results: [],
    speaker: message.speaker,
    canCritD2: !!message.flags?.essence20?.canCritD2,
    rollContext: { skill: message.flags?.essence20?.skill, essence: message.flags?.essence20?.essence, q1Reroll: true },
  });
  await ChatMessage.create(chatData);
  return true;
}

function speakerOf(message) {
  return message?.speaker ? ChatMessage.getSpeakerActor(message.speaker) : null;
}

function canPress(message, actor) {
  return !!actor && (game.user?.isGM || actor.isOwner || message.isAuthor);
}

function addButton(element, key, label, data = {}) {
  const container = element.querySelector?.('.message-content') ?? element;
  if (!container || element.querySelector?.(`[data-e20-ext="${key}"]`)) {
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'e20-chat-action-button';
  button.dataset.e20Ext = key;
  for (const [name, value] of Object.entries(data)) {
    button.dataset[name] = value;
  }

  button.textContent = label;
  container.appendChild(button);
}

/* -------------------------------------------- */
/*  Best-Laid Plans (Decepticon Directive p.62)  */
/* -------------------------------------------- */

// "Before beginning a scene, if you have the opportunity to meet with your allies and discuss the
// upcoming situation for at least 1 hour, you can attempt a DIF 10 Alertness or Culture Skill Test.
// On a success, you or your allies can reroll one d20 result during the scene in question. For
// every 5 by which your result exceeds the DIF, you and your allies can reroll one additional d20
// during the scene."
//
// Rolling it (the Use button) opens a pool on the planner for the current scene, shared by the
// planner and the primary Party's roster. Every roll card by one of them then carries a
// "Best-Laid Plans: reroll the d20" button until the pool runs dry or the scene changes.
const PLANS_FLAG = 'q1BestLaidPlans';

export function planPoolSize(total, dif = 10) {
  if (!Number.isFinite(total) || total < dif) {
    return 0;
  }

  return 1 + Math.floor((total - dif) / 5);
}

export function livePlans(planner) {
  const pool = planner?.flags?.essence20?.[PLANS_FLAG];
  return pool && pool.epoch == getSceneEpoch() && pool.remaining > 0 ? pool : null;
}

function partyMembers() {
  return game.actors?.party?.members ?? [];
}

export async function runBestLaidPlans(item) {
  const actor = item.parent;
  const { chooseButtons } = await import("../../grants.mjs");
  const skill = await chooseButtons(item.name, T('E20.Q1PlansPrompt'), [
    ['alertness', game.i18n.localize(CONFIG.E20?.skills?.alertness ?? 'Alertness')],
    ['culture', game.i18n.localize(CONFIG.E20?.skills?.culture ?? 'Culture')],
  ]);
  if (!['alertness', 'culture'].includes(skill)) {
    return null;
  }

  const result = await actor._dice?.rollSkill({
    skill, essence: CONFIG.E20?.skillToEssence?.[skill] ?? 'smarts', shiftUp: 0, shiftDown: 0, dif: '10',
  }, actor);
  if (!result || result.cancelled) {
    return null;
  }

  const total = result.outcomes?.[0]?.roll?.total ?? result.outcomes?.[0]?.results?.[0]?.total;
  const size = result.success ? Math.max(1, planPoolSize(Number(total))) : 0;
  if (!size) {
    return T('E20.Q1PlansFailed', { name: actor.name });
  }

  const members = [...new Set([actor.uuid, ...partyMembers().map(member => member.uuid)])];
  await actor.setFlag('essence20', PLANS_FLAG, { epoch: getSceneEpoch(), remaining: size, members });
  return T('E20.Q1PlansReady', { name: actor.name, count: size });
}

function plannerFor(actor) {
  return worldActors().find(planner => {
    const pool = livePlans(planner);
    return pool && pool.members.includes(actor.uuid);
  }) ?? null;
}

/* -------------------------------------------- */
/*  One Last Chance (Decepticon Directive p.44)  */
/* -------------------------------------------- */

// "once per scene when an ally in the same scene as you and is acting on your orders (or orders
// that you are also following at the GM's discretion) fails a Skill Test, they can reroll any of
// the dice involved. They must accept the second result."
//
// Offered on an ally's failed Skill Test while a holder of the Perk has a token on the current
// scene and hasn't spent it this scene; "on your orders" is the table's call (the button says so).
// Rerolls every die of the test.
const LAST_CHANCE_FLAG = 'q1OneLastChance';

export function lastChanceHolderFor(actor, { onScene = null } = {}) {
  if (!actor) {
    return null;
  }

  const sceneActorIds = onScene ?? new Set((canvas?.scene?.tokens ?? []).map(token => token.actorId));
  return worldActors().find(holder => holder.id != actor.id
    && has(holder, Q1.oneLastChance)
    && (sceneActorIds.size == 0 || sceneActorIds.has(holder.id))
    && ['playerCharacter', 'companion'].includes(actor.type) == ['playerCharacter', 'companion'].includes(holder.type)
    && getUses(holder, LAST_CHANCE_FLAG, 'scene') == 0) ?? null;
}

/* -------------------------------------------- */
/*  Chat buttons                                 */
/* -------------------------------------------- */

export function decorateRerolls(message, element) {
  if (!message?.isRoll || !message.rolls?.length || !element) {
    return;
  }

  const actor = speakerOf(message);
  if (!canPress(message, actor)) {
    return;
  }

  const planner = plannerFor(actor);
  const hasD20 = message.rolls[0].dice?.some?.(die => die.faces == 20);
  if (planner && hasD20) {
    const pool = livePlans(planner);
    addButton(element, 'q1PlansReroll', T('E20.Q1PlansButton', { count: pool.remaining }), { plannerUuid: planner.uuid });
  }

  if (message.flags?.essence20?.rollFailed === true && message.flags?.essence20?.skill && !message.flags?.essence20?.q1Reroll) {
    const holder = lastChanceHolderFor(actor);
    if (holder) {
      addButton(element, 'q1LastChance', T('E20.Q1LastChanceButton', { name: holder.name }), { holderUuid: holder.uuid });
    }
  }
}

export async function onPlansReroll(message, button) {
  const planner = await fromUuid(button.dataset.plannerUuid);
  const pool = livePlans(planner);
  if (!pool) {
    ui.notifications.warn(T('E20.Q1PlansEmpty'));
    return;
  }

  const actor = speakerOf(message);
  const ok = await postReroll(message, { mode: 'all', target: 'd20', recursive: false, values: [] },
    `${actor?.name ?? ''}: ${itemFrom(planner, Q1.bestLaidPlans)?.name ?? 'Best-Laid Plans'}`);
  if (ok) {
    await setQ1Flag(planner, PLANS_FLAG, { ...pool, remaining: pool.remaining - 1 });
    button.disabled = true;
  }
}

export async function onLastChance(message, button) {
  const holder = await fromUuid(button.dataset.holderUuid);
  if (!holder || getUses(holder, LAST_CHANCE_FLAG, 'scene') > 0) {
    ui.notifications.warn(T('E20.Q1LastChanceUsed'));
    return;
  }

  const actor = speakerOf(message);
  const ok = await postReroll(message, { mode: 'all', target: 'allDice', recursive: false, values: [] },
    `${actor?.name ?? ''}: ${itemFrom(holder, Q1.oneLastChance)?.name ?? 'One Last Chance'}`);
  if (ok) {
    const { epochFor } = await import("../../scene-clock.mjs");
    await setQ1Flag(holder, LAST_CHANCE_FLAG, { epoch: epochFor('scene'), window: 'scene', count: 1 });
    button.disabled = true;
  }
}

export const PLANS_USE = {
  id: 'q1BestLaidPlans',
  matches: item => item?.type == 'perk' && sourceOf(item) == Q1.bestLaidPlans,
  canUse: () => true,
  run: item => runBestLaidPlans(item),
};

export function registerRerolls() {
  registerDerived(dangerSenseDerived);
  registerDialogToggles(dangerSenseToggles);
  registerApplyDialog(dangerSenseApply);
  registerUse(PLANS_USE);
  registerChatDecorator(decorateRerolls);
  registerChatButton('q1PlansReroll', onPlansReroll);
  registerChatButton('q1LastChance', onLastChance);
}

