import { registerApplyDialog, registerChatButton, registerChatDecorator, registerDialogToggles } from "../../extensions.mjs";
import { getUses, markUsed } from "../../scene-clock.mjs";
import { escape, has, itemsOf, Q2, T } from "./common.mjs";

/**
 * Old Hand (G.I. Joe: Hawk's Personnel Files) - the Do Or Die bonus die.
 *
 * Do Or Die (1st level): "You gain a bonus die you can roll in case of emergencies. Once per scene,
 * after rolling a Skill Test and determining the results, you can spend a Moxie Point to roll your Do
 * Or Die bonus die and add it to your total. Use this new total to determine the result."
 * Table 05-1: the die is d2 at Old Hand levels 1-5, d4 at 6-10, d6 at 11-15, d8 at 16.
 * Moxie: "You can also spend a Moxie Point to gain an additional use of a Role Perk" - a second use in
 * the same scene costs one more Moxie.
 *
 * Wild Idea (7th level): "you can spend a Moxie Point to add your Do Or Die bonus die as a bonus Skill
 * Die. This works like a Specialized roll, taking the highest Skill Die result." A Roll Options Dialog
 * checkbox; the die joins the roll's kept-highest pool through skillRollOptions.extBonusPoolDie (the
 * same bonusPoolDie slot Rumble in the Jungle uses - see the qualify2 patch spec for dice.mjs).
 */

const SCENE_FLAG = 'q2DoOrDieScene';

export function oldHandLevel(actor) {
  const level = Number(actor?.system?.level) || 0;
  const transition = Number(actor?.system?.oldHandTransitionLevel) || 0;
  return transition ? Math.max(1, level - transition + 1) : level;
}

export function doOrDieDie(actor) {
  const level = oldHandLevel(actor);
  if (level >= 16) {
    return 'd8';
  }

  if (level >= 11) {
    return 'd6';
  }

  return level >= 6 ? 'd4' : 'd2';
}

export function moxieOf(actor) {
  return actor?.items?.documentsByType?.rolePoints?.find(item => item.name == 'Moxie')
    ?? itemsOf(actor).find(item => item.type == 'rolePoints' && item.name == 'Moxie') ?? null;
}

function moxieLeft(actor) {
  if (actor?.system?.useUnlimitedResource) {
    return Infinity;
  }

  return Number(moxieOf(actor)?.system?.resource?.value) || 0;
}

async function spendMoxie(actor, amount) {
  const moxie = moxieOf(actor);
  if (!moxie || actor.system?.useUnlimitedResource) {
    return !!moxie || !!actor.system?.useUnlimitedResource;
  }

  const value = Number(moxie.system.resource.value) || 0;
  if (value < amount) {
    return false;
  }

  await moxie.update({ 'system.resource.value': value - amount });
  return true;
}

/** Moxie this use costs: 1, or 2 once the scene's use is spent. */
export function doOrDieCost(actor) {
  return getUses(actor, SCENE_FLAG, 'scene') > 0 ? 2 : 1;
}

export function canDoOrDie(actor) {
  return has(actor, Q2.doOrDie) && moxieLeft(actor) >= doOrDieCost(actor);
}

/**
 * The check card's per-target outcomes once the bonus die is added.
 * @param {Number} oldTotal
 * @param {Number} bonus
 * @param {Array} checkResults   message.flags.essence20.checkResults
 * @param {Function} multiplierOf   combat.mjs#computeMultiplier
 */
export function rescore(oldTotal, bonus, checkResults, multiplierOf) {
  const total = oldTotal + bonus;
  return (checkResults ?? []).map(entry => ({
    ...entry,
    total,
    before: multiplierOf(oldTotal, entry.difficulty),
    after: multiplierOf(total, entry.difficulty),
  }));
}

function speakerActor(message) {
  const speaker = message?.speaker ?? {};
  const token = speaker.token ? game.scenes?.get?.(speaker.scene)?.tokens?.get?.(speaker.token) : null;
  return token?.actor ?? (speaker.actor ? game.actors?.get?.(speaker.actor) : null);
}

export function decorateDoOrDie(message, element) {
  const flags = message?.flags?.essence20;
  if (!flags?.checkResults?.length || !message.rolls?.length || element?.querySelector?.('[data-e20-ext="q2DoOrDie"]')) {
    return;
  }

  const actor = speakerActor(message);
  if (!actor?.isOwner || !canDoOrDie(actor)) {
    return;
  }

  const card = element.querySelector?.('.e20-check-card');
  if (!card) {
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'e20-chat-action-button';
  button.dataset.e20Ext = 'q2DoOrDie';
  button.textContent = T('E20.Q2DoOrDieButton', { die: doOrDieDie(actor), cost: doOrDieCost(actor) });
  card.append(button);
}

export async function onDoOrDie(message, button) {
  const actor = speakerActor(message);
  if (!actor?.isOwner || !canDoOrDie(actor)) {
    ui.notifications.warn(T('E20.Q2DoOrDieUnavailable'));
    return;
  }

  const cost = doOrDieCost(actor);
  if (!(await spendMoxie(actor, cost))) {
    return;
  }

  await markUsed(actor, SCENE_FLAG, { window: 'scene' });
  button.disabled = true;

  const die = doOrDieDie(actor);
  const roll = await new Roll(`1${die}`).evaluate();
  const { computeMultiplier } = await import("../../combat.mjs");
  const flags = message.flags.essence20;
  const results = rescore(message.rolls[0].total, roll.total, flags.checkResults, computeMultiplier);

  // A weapon attack's damage for the targets the new total now hits (or hits harder).
  const effect = flags.isAttack && flags.itemUuid ? await fromUuid(flags.itemUuid) : null;
  const base = Number(effect?.system?.damageValue) || 0;
  const damageType = effect?.system?.damageType ?? null;
  const rows = [];
  for (const [index, entry] of results.entries()) {
    const target = entry.targetUuid ? await fromUuid(entry.targetUuid) : null;
    const name = escape(target?.name ?? T('E20.Q2DoOrDieCheck'));
    const outcome = entry.after > 0 ? T('E20.CheckSuccess') + (entry.after > 1 ? ` &times;${entry.after}` : '') : T('E20.CheckFailure');
    let row = `<li>${name} (${T('E20.CheckDifficultyAbbr')} ${entry.difficulty}): ${outcome}</li>`;
    const extra = base * (entry.after - entry.before);
    if (extra > 0 && damageType && target) {
      row += `<button type="button" class="e20-check-damage-button" data-action="apply-damage" data-key="${entry.targetUuid}:q2DoOrDie:${index}"
        data-target-uuid="${entry.targetUuid}" data-damage="${extra}" data-damage-type="${damageType}">
        ${T('E20.CheckApplyDamage')} ${extra} ${T(CONFIG.E20.damageTypes?.[damageType] ?? damageType)}</button>`;
    }

    rows.push(row);
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls: [roll],
    content: `<div class="e20-check-card"><p>${escape(T('E20.Q2DoOrDieRolled', {
      name: actor.name, die, bonus: roll.total, total: results[0]?.total ?? (message.rolls[0].total + roll.total),
    }))}</p><ul class="e20-check-results">${rows.join('')}</ul></div>`,
  });
}

/* -------------------------------------------- */
/*  Wild Idea                                    */
/* -------------------------------------------- */

export function wildIdeaToggles(actor) {
  if (!has(actor, Q2.wildIdea) || !has(actor, Q2.doOrDie) || moxieLeft(actor) < 1) {
    return [];
  }

  return [{ name: 'q2WildIdea', label: T('E20.Q2WildIdeaToggle', { die: doOrDieDie(actor) }), type: 'checkbox', value: false }];
}

export async function wildIdeaApply(actor, options) {
  if (!options?.ext?.q2WildIdea || !has(actor, Q2.wildIdea)) {
    return;
  }

  if (await spendMoxie(actor, 1)) {
    options.extBonusPoolDie = doOrDieDie(actor);
  }
}

registerChatDecorator(decorateDoOrDie);
registerChatButton('q2DoOrDie', onDoOrDie);
registerDialogToggles(wildIdeaToggles);
registerApplyDialog(wildIdeaApply);
