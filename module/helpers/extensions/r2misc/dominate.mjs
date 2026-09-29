import { registerChatButton } from "../../extensions.mjs";

/**
 * Dominate (Quartermaster's Guide to Gear, nanomite power, p.93).
 *
 * Activating the power (its daily use is spent by the generic nanomite path, sheet-handlers/power-
 * handler.mjs#powerCost, which then reaches activateDominate through helpers/power-use.mjs#onPowerUse)
 * sends the nanomites at the targeted creature: "Select a victim within 20 feet and make a Targeting
 * Skill Test against their Evasion score. If they fail, then the victim is infected." The victim is kept
 * on the user's flag until the nanomites are recalled.
 *
 * With a victim infected, activating the power again doesn't infect anyone new - it's the "activate your
 * power again as a Standard action whenever the victim is within 60 feet" command, so the daily use the
 * generic path just spent is handed back ("the nanomites remain within them unless you recall them ...
 * until you do, you cannot regain the spent power use" - the one use stays tied up, no more are spent).
 *
 * The chat card's Command button rolls "a Persuasion Skill Test with Edge against your victim's
 * Willpower or Cleverness" (the roller picks which), with "a cumulative ↓1 on this Skill Test for every
 * round you've commanded your target" counted per command, and on a success applies Restrained or
 * Mesmerized, or notes a one-action command. Recall ends it: "dealing 1 damage to the target and to
 * you". Breaking the hold after 10 minutes, egregious-command Snags and when a Mesmerized victim is
 * asked too much are the GM's call.
 */

export const DOMINATE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.HwREY90wo09Hkdt1";
export const DOMINATE_FLAG = 'r2Dominate';
const INFECT_RANGE = 20;
const COMMAND_RANGE = 60;

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));
const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The dominator's current victim record ({victimUuid, name, commands}), or null. */
export function dominateStateOf(actor) {
  const state = actor?.flags?.essence20?.[DOMINATE_FLAG];
  return state?.victimUuid ? state : null;
}

/** Feet between two actors' first tokens, or null when either isn't on the canvas. */
function feetBetween(a, b) {
  const ta = a?.getActiveTokens?.()?.[0];
  const tb = b?.getActiveTokens?.()?.[0];
  const dims = globalThis.canvas?.dimensions;
  if (!ta || !tb || !dims?.size) {
    return null;
  }

  const pa = ta.center ?? ta;
  const pb = tb.center ?? tb;
  return Math.hypot(pa.x - pb.x, pa.y - pb.y) / dims.size * (dims.distance ?? 5);
}

function tooFar(a, b, range) {
  const feet = feetBetween(a, b);
  return feet != null && feet > range + 0.5;
}

async function post(actor, content) {
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

/** Hand the daily use the generic activation just spent back. */
async function refundUse(item) {
  const spent = Number(item?.system?.usesSpent) || 0;
  if (spent > 0) {
    await item.update({ 'system.usesSpent': spent - 1 });
  }
}

/** The Command / Recall buttons for the dominator's victim. */
export function dominateButtons(actor, state) {
  const data = `data-actor="${esc(actor.uuid)}"`;
  return `<p>${T('R2DominateHolds', { name: esc(actor.name), victim: esc(state.name) })}</p>`
    + `<button type="button" data-e20-ext="r2DominateCommand" ${data}>${T('R2DominateCommand')}</button>`
    + `<button type="button" data-e20-ext="r2DominateRecall" ${data}>${T('R2DominateRecall')}</button>`;
}

async function standardAction(actor, source) {
  if (!game.combat) {
    return true;
  }

  const { spend } = await import("../../action-economy.mjs");
  return !(await spend(actor, 'standard', { source })).blocked;
}

/**
 * The power's activation: infect the targeted creature, or (with a victim already infected) hand the
 * use back and offer the command card.
 * @param {Actor} actor
 * @param {Item} item
 * @returns {Promise<Boolean>}   Whether a victim was infected.
 */
export async function activateDominate(actor, item) {
  const state = dominateStateOf(actor);
  if (state) {
    await refundUse(item);
    await post(actor, dominateButtons(actor, state));
    return false;
  }

  const victim = game.user?.targets?.first?.()?.actor ?? null;
  if (!victim || victim === actor) {
    ui.notifications.warn(T('R2DominateNeedsTarget'));
    await refundUse(item);
    return false;
  }

  if (tooFar(actor, victim, INFECT_RANGE)) {
    ui.notifications.warn(T('R2DominateTooFar', { range: INFECT_RANGE }));
    await refundUse(item);
    return false;
  }

  const { rollTest } = await import("../../grants.mjs");
  const evasion = Number(victim.system?.defenses?.evasion?.total) || 0;
  const { success } = await rollTest(actor, 'targeting', evasion);
  if (!success) {
    await post(actor, `<p>${T('R2DominateMissed', { name: esc(actor.name), victim: esc(victim.name) })}</p>`);
    return false;
  }

  const next = { victimUuid: victim.uuid, name: victim.name, commands: 0 };
  await actor.setFlag('essence20', DOMINATE_FLAG, next);
  await post(actor, `<p>${T('R2DominateInfected', { name: esc(actor.name), victim: esc(victim.name) })}</p>${dominateButtons(actor, next)}`);
  return true;
}

async function choose(title, prompt, rows) {
  const { chooseButtons } = await import("../../grants.mjs");
  return chooseButtons(title, prompt, rows);
}

/** The Command button: a Persuasion test with Edge against Willpower or Cleverness, then the effect. */
export async function commandVictim(actor) {
  const state = dominateStateOf(actor);
  const victim = state ? await fromUuid(state.victimUuid) : null;
  if (!victim) {
    ui.notifications.warn(T('R2DominateNoVictim', { name: actor.name }));
    return false;
  }

  if (tooFar(actor, victim, COMMAND_RANGE)) {
    ui.notifications.warn(T('R2DominateTooFar', { range: COMMAND_RANGE }));
    return false;
  }

  const defense = await choose(T('R2DominateCommand'), T('R2DominateDefensePrompt', { victim: victim.name }), [
    ['willpower', game.i18n.localize(CONFIG.E20?.defenses?.willpower ?? 'willpower')],
    ['cleverness', game.i18n.localize(CONFIG.E20?.defenses?.cleverness ?? 'cleverness')],
  ]);
  if (!['willpower', 'cleverness'].includes(defense) || !(await standardAction(actor, T('R2DominateCommand')))) {
    return false;
  }

  const commands = Number(state.commands) || 0;
  const dif = Number(victim.system?.defenses?.[defense]?.total) || 0;
  const { rollTest } = await import("../../grants.mjs");
  const { success } = await rollTest(actor, 'persuasion', dif, { edge: true, shiftDown: commands });
  await actor.setFlag('essence20', DOMINATE_FLAG, { ...state, commands: commands + 1 });
  if (!success) {
    await post(actor, `<p>${T('R2DominateResisted', { name: esc(actor.name), victim: esc(victim.name) })}</p>`);
    return false;
  }

  const effect = await choose(T('R2DominateCommand'), T('R2DominateEffectPrompt', { victim: victim.name }), [
    ['restrained', T('R2DominateStandStill')], ['mesmerized', T('R2DominateMesmerize')], ['order', T('R2DominateOrder')],
  ]);
  if (effect == 'restrained' || effect == 'mesmerized') {
    const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
    const args = [effect, { active: true }];
    await (needsGmRelay(victim) ? relayToGm(victim, 'toggleStatusEffect', args) : victim.toggleStatusEffect(effect, { active: true }));
  }

  const key = { restrained: 'R2DominateStoodStill', mesmerized: 'R2DominateMesmerized' }[effect] ?? 'R2DominateOrdered';
  await post(actor, `<p>${T(key, { name: esc(actor.name), victim: esc(victim.name) })}</p>${dominateButtons(actor, state)}`);
  return true;
}

/**
 * The Recall button: the nanomites come home, 1 damage to each of you, and the power's use is free again.
 * @param {Actor} actor
 * @param {Object} [deps]   applyDamage, for tests - helpers/combat.mjs by default.
 */
export async function recallNanomites(actor, { applyDamage = null } = {}) {
  const state = dominateStateOf(actor);
  if (!state) {
    return false;
  }

  await actor.unsetFlag('essence20', DOMINATE_FLAG);
  const damage = applyDamage ?? (await import("../../combat.mjs")).applyDamage;
  await damage(actor, 1, 'special');
  const button = `<button type="button" data-e20-ext="o1ApplyDamage" data-target-uuid="${esc(state.victimUuid)}" data-amount="1" data-damage-type="special">${T('O1ApplyDamageButton')}</button>`;
  await post(actor, `<p>${T('R2DominateRecalled', { name: esc(actor.name), victim: esc(state.name) })}</p>${button}`);
  return true;
}

async function dominatorFrom(button) {
  const actor = await fromUuid(button.dataset.actor);
  if (!actor?.isOwner) {
    ui.notifications.warn(T('O1NotOwner'));
    return null;
  }

  return actor;
}

registerChatButton('r2DominateCommand', async (message, button) => {
  const actor = await dominatorFrom(button);
  if (actor) {
    await commandVictim(actor);
  }
});

registerChatButton('r2DominateRecall', async (message, button) => {
  const actor = await dominatorFrom(button);
  if (actor && (await recallNanomites(actor))) {
    button.disabled = true;
  }
});
