import {
  registerAfterDamage, registerChatButton, registerChatDecorator, registerConsumer, registerPostRoll, registerRest, registerRollSources, registerUse,
} from "../../extensions.mjs";
import { actorHasHangUp, actorHasPerk, findPerk } from "../../perks.mjs";
import { worldActors } from "../../companion-link.mjs";
import {
  areAllies, canAct, cardInfo, claim, claimKey, convertRows, damageButton, distanceBetween, esc, gmDo, holdersOf, holds, isClaimed, isResponsible,
  itemsOf, lastApplyContext, ownerIds, payPower, say, SCOPE, sourceOf, speakerActor,
} from "./core.mjs";

/**
 * Reactions to something happening to someone else - a character dropping to 0, a Fumble nearby,
 * gear being destroyed, a Defeat - rather than to a card's button. Every client sees these hooks;
 * each acts only for the actors it is responsible for (core.mjs#isResponsible).
 */

export const TRIG = {
  junker: "Compendium.essence20.quartermasters_guide_to_gear.Item.fiokYoWguE1eBVda",
  notOnMyWatchIa: "Compendium.essence20.intercontinental_adventures.Item.xH3iQ0NcXp1eFO35",
  allForOne: "Compendium.essence20.pr_crb.Item.Q5YDt0r21QDmBuDC",
  agencyHangUp: "Compendium.essence20.across_the_stars.Item.QZpWbKjMxMdahpoL",
  agencyPerk: "Compendium.essence20.across_the_stars.Item.bGKG7artYs7uHHz4",
  inspirationalLeader: "Compendium.essence20.across_the_stars.Item.JH6xyTYUHCxAKkTP",
  lossAndGain: "Compendium.essence20.finster_s_monster_matic_cookbook.Item.kyqh747vyQnwSWu2",
  theirLoss: "Compendium.essence20.finster_s_monster_matic_cookbook.Item.mgTerJX1jxtVMQMJ",
  cruelConflagration: "Compendium.essence20.finster_s_monster_matic_cookbook.Item.c22iQeKZY1TmPzFe",
  energonManipulator: "Compendium.essence20.decepticon_directive.Item.cOVq7EH6HPrXmhBC",
  revengeful: "Compendium.essence20.decepticon_directive.Item.n1CZfponNlZ9I8uN",
};

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));
const nameOf = (actor, uuid, fallback) => itemsOf(actor).find(item => sourceOf(item) == uuid)?.name ?? fallback;

function whisperCard(actor, content) {
  return globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content, whisper: ownerIds(actor),
  });
}

/* -------------------------------------------- */
/*  Dropping to 0                                */
/* -------------------------------------------- */

// Health and Personal Power before the update, so updateActor can tell a drop TO 0 from an update
// that merely leaves it there. Update options travel with the update to every client.
globalThis.Hooks?.on('preUpdateActor', (actor, changes, options) => {
  options.e20ReactBefore = {
    health: actor.system?.health?.value ?? null,
    power: actor.system?.powers?.personal?.value ?? null,
  };
});

globalThis.Hooks?.on('updateActor', (actor, changes, options) => {
  const before = options?.e20ReactBefore ?? {};
  const health = foundry.utils.getProperty(changes, 'system.health.value');
  const power = foundry.utils.getProperty(changes, 'system.powers.personal.value');
  const run = promise => promise?.catch?.(error => console.error('Essence20 | react trigger failed', error));
  if (health !== undefined && Number(health) <= 0 && (before.health ?? 1) > 0) {
    run(onDropToZero(actor, 'health'));
  }

  if (power !== undefined && Number(power) <= 0 && (before.power ?? 1) > 0) {
    run(onDropToZero(actor, 'power'));
  }
});

export async function onDropToZero(actor, what) {
  // Junker: a vehicle (or Zord) destroyed in front of you counts as equipment destroyed.
  if (what == 'health' && ['vehicle', 'zord', 'megaform'].includes(actor.type)) {
    await noteBroken();
  }

  if (what == 'health' && !['vehicle'].includes(actor.type)) {
    await notOnMyWatch(actor);
  }

  await allForOne(actor, what);
}

/* -------------------------------------------- */
/*  Junker                                       */
/* -------------------------------------------- */

// Junker (Quartermaster's Guide, Hang-Up, p.9): "In combat, when you see a piece of equipment break
// or be destroyed, including battledress, weapons, and vehicles, you suffer Snag on your next Skill
// Test as you consider its possibilities." Broken gear is a weapon/armor flagged broken (Desperate
// Parry breaks one), or a vehicle/Zord dropping to 0 Health.
export async function noteBroken() {
  if (!game.combat) {
    return;
  }

  for (const holder of holdersOf(TRIG.junker)) {
    if (isResponsible(holder) && !holder.getFlag?.(SCOPE, 'junkerSnag')) {
      await holder.setFlag(SCOPE, 'junkerSnag', true);
    }
  }
}

/** Tell the table a piece of gear broke (and wake any Junker). */
export async function announceBroken(actor, itemName) {
  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage.getSpeaker?.({ actor }),
    content: T('ReactGearBroken', { name: esc(actor?.name), item: esc(itemName) }),
    flags: { [SCOPE]: { reactBroken: true } },
  });
}

globalThis.Hooks?.on('createChatMessage', message => {
  if (message?.flags?.[SCOPE]?.reactBroken) {
    noteBroken().catch(error => console.error('Essence20 | Junker failed', error));
  }
});

globalThis.Hooks?.on('updateItem', (item, changes) => {
  if (foundry.utils.getProperty(changes, 'flags.essence20.broken') === true && ['weapon', 'armor', 'shield'].includes(item.type)) {
    noteBroken().catch(error => console.error('Essence20 | Junker failed', error));
  }
});

registerRollSources(actor => {
  if (!actor?.getFlag?.(SCOPE, 'junkerSnag')) {
    return null;
  }

  return {
    sources: [{ id: 'reactJunker', label: nameOf(actor, TRIG.junker, 'Junker'), snag: true }],
    consumes: [{ ext: 'reactJunker', actorUuid: actor.uuid }],
  };
});

registerConsumer('reactJunker', async consume => {
  const actor = await fromUuid(consume.actorUuid);
  await actor?.unsetFlag?.(SCOPE, 'junkerSnag');
});

/* -------------------------------------------- */
/*  Not On My Watch (G.I. Joe)                   */
/* -------------------------------------------- */

// Not On My Watch (Factions in Action Vol. 2, General Perk, p.95): "If a member of your unit that you
// can see gains the Defeated Condition, you can immediately Move your Ground Movement towards them."
// The +1 Toughness/Evasion half is dice.mjs. The Move is handed over as an extra Move action.
async function notOnMyWatch(fallen) {
  for (const holder of holdersOf(TRIG.notOnMyWatchIa)) {
    if (holder === fallen || !isResponsible(holder) || !areAllies(holder, fallen)) {
      continue;
    }

    await whisperCard(holder, `<p>${T('ReactNomwPrompt', { name: esc(holder.name), fallen: esc(fallen.name) })}</p>
      <button type="button" data-e20-ext="reactNomwMove" data-actor-uuid="${holder.uuid}">${esc(nameOf(holder, TRIG.notOnMyWatchIa, 'Not On My Watch'))}</button>`);
  }
}

registerChatButton('reactNomwMove', async (message, button) => {
  const actor = await fromUuid(button.dataset.actorUuid);
  if (!canAct(actor) || isClaimed(actor, claimKey(message, null, 'nomw'))) {
    button.disabled = true;
    return;
  }

  await claim(actor, claimKey(message, null, 'nomw'));
  button.disabled = true;
  if (game.combat) {
    const { grantActionsThisTurn } = await import("../../action-economy.mjs");
    await grantActionsThisTurn(actor, { move: 1 }, nameOf(actor, TRIG.notOnMyWatchIa, 'Not On My Watch'));
  }

  await say(actor, T('ReactNomwMoved', { name: esc(actor.name), feet: actor.system?.movement?.ground?.total ?? 0 }));
});

/* -------------------------------------------- */
/*  All For One                                  */
/* -------------------------------------------- */

// All For One (PR CRB, Black Ranger, 18th level, p.34): "If you are ever brought to 0 Personal Power
// or 0 Health, you can immediately call upon your fellow Ranger teammates to help you... each member
// of your team may choose to give 1d2 Power and/or 1 Health to you immediately, spending the same
// amount from themselves to do so. This ability may only be used once daily." "Daily" resets on Rest.
async function allForOne(actor, what) {
  if (!holds(actor, TRIG.allForOne) || !isResponsible(actor) || actor.getFlag?.(SCOPE, 'allForOneUsed')) {
    return;
  }

  await actor.setFlag(SCOPE, 'allForOneUsed', true);
  const perk = nameOf(actor, TRIG.allForOne, 'All For One');
  await say(actor, `<p>${T('ReactAfoCall', { name: esc(actor.name), perk: esc(perk), what: T(what == 'power' ? 'ReactPower' : 'ReactHealth') })}</p>
    <button type="button" data-e20-ext="reactAfoGive" data-kind="health" data-recipient="${actor.uuid}">${T('ReactAfoGiveHealth')}</button>
    <button type="button" data-e20-ext="reactAfoGive" data-kind="power" data-recipient="${actor.uuid}">${T('ReactAfoGivePower')}</button>`);
}

registerRest(async actor => {
  if (actor?.getFlag?.(SCOPE, 'allForOneUsed')) {
    await actor.unsetFlag(SCOPE, 'allForOneUsed');
  }
});

/** Whose Health/Power this user gives: their own character, else one they own on the recipient's side. */
export function giverFor(recipient) {
  const own = game.user?.character;
  if (own && own !== recipient && areAllies(own, recipient)) {
    return own;
  }

  return worldActors().find(actor => actor !== recipient && actor.type == 'playerCharacter' && actor.isOwner && !game.user.isGM
    && areAllies(actor, recipient)) ?? null;
}

registerChatButton('reactAfoGive', async (message, button) => {
  const recipient = await fromUuid(button.dataset.recipient);
  const giver = recipient ? giverFor(recipient) : null;
  const kind = button.dataset.kind;
  if (!giver) {
    ui.notifications?.warn(T('ReactAfoNoGiver'));
    return;
  }

  const key = claimKey(message, { targetUuid: kind }, 'afo');
  if (isClaimed(giver, key)) {
    ui.notifications?.warn(T('ReactAlreadyUsed'));
    return;
  }

  let amount = 1;
  if (kind == 'power') {
    amount = (await new Roll('1d2').evaluate()).total;
    if (!(await payPower(giver, amount))) {
      return;
    }
  } else {
    const health = giver.system?.health?.value ?? 0;
    if (health < 1) {
      ui.notifications?.warn(T('ReactAfoNoHealth', { name: giver.name }));
      return;
    }

    await giver.update({ 'system.health.value': health - 1 });
  }

  await claim(giver, key);
  await gmDo({ kind: 'restore', uuid: recipient.uuid, what: kind, amount },
    T('ReactAfoGave', { name: esc(giver.name), recipient: esc(recipient.name), amount, what: T(kind == 'power' ? 'ReactPower' : 'ReactHealth') }), giver);
});

/* -------------------------------------------- */
/*  Someone nearby fails or Fumbles              */
/* -------------------------------------------- */

/** Loss and Gain (FMMC Table 5-6): 1 at 1st level, +1 at 6th, 11th and 16th. */
export function lossAndGain(actor) {
  const item = itemsOf(actor).find(i => sourceOf(i) == TRIG.lossAndGain);
  const stored = Number(item?.system?.bonus?.value);
  if (stored > 0) {
    return stored;
  }

  const level = Number(actor?.system?.level) || 1;
  return 1 + [6, 11, 16].filter(threshold => level >= threshold).length;
}

globalThis.Hooks?.on('createChatMessage', message => {
  onCheckCard(message).catch(error => console.error('Essence20 | react roll trigger failed', error));
});

export async function onCheckCard(message) {
  const info = cardInfo(message);
  if (!info?.attacker || !info.rows.length || !info.rollFailed) {
    return;
  }

  const roller = info.attacker;

  // Their Loss, My Gain (FMMC, Path of Thorns, 1st level, p.296): "Anytime a character that you can
  // see within 60 feet Fumbles a Skill Test, you regain a number Health as shown in the Loss and Gain
  // column on Table 5-6."
  if (info.isFumble) {
    for (const holder of holdersOf(TRIG.theirLoss)) {
      if (holder === roller || !isResponsible(holder) || distanceBetween(holder, roller) > 60) {
        continue;
      }

      const amount = lossAndGain(holder);
      const health = holder.system?.health ?? {};
      const healed = Math.max(0, Math.min(amount, (health.max ?? Infinity) - (health.value ?? 0)));
      if (healed > 0) {
        await holder.update({ 'system.health.value': (health.value ?? 0) + healed });
      }

      await say(holder, T('ReactTheirLoss', { name: esc(holder.name), roller: esc(roller.name), amount: healed }));
    }
  }

  // Cruel Conflagration (FMMC, Path of Cruelty, 15th level, p.284): "Anytime a character fails a
  // Skill Test within 15 feet of you, you can spend 1 Personal Power to impart the Impaired condition
  // on them until the end of your next turn. Anytime a character Fumbles a Skill Test within 15 feet
  // of you, you can spend 1 Personal Power to inflict 2 Psychic damage upon them or 2 Personal Power
  // to inflict the damage and impart the Impaired condition."
  for (const holder of holdersOf(TRIG.cruelConflagration)) {
    if (holder === roller || !isResponsible(holder) || distanceBetween(holder, roller) > 15) {
      continue;
    }

    const perk = esc(nameOf(holder, TRIG.cruelConflagration, 'Cruel Conflagration'));
    const button = (mode, label) => `<button type="button" data-e20-ext="reactCruelConf" data-mode="${mode}" data-holder="${holder.uuid}"
      data-target="${roller.uuid}">${label}</button>`;
    const buttons = info.isFumble
      ? button('damage', T('ReactCruelDamage')) + button('both', T('ReactCruelBoth'))
      : button('impaired', T('ReactCruelImpaired'));
    await whisperCard(holder, `<p>${T('ReactCruelPrompt', { perk, roller: esc(roller.name) })}</p>${buttons}`);
  }
}

registerChatButton('reactCruelConf', async (message, button) => {
  const holder = await fromUuid(button.dataset.holder);
  const target = await fromUuid(button.dataset.target);
  if (!canAct(holder) || !target || isClaimed(holder, claimKey(message, null, 'cruel'))) {
    return;
  }

  const mode = button.dataset.mode;
  if (!(await payPower(holder, mode == 'both' ? 2 : 1))) {
    return;
  }

  await claim(holder, claimKey(message, null, 'cruel'));
  if (mode != 'damage') {
    await gmDo({ kind: 'status', uuid: target.uuid, status: 'impaired', rounds: 1 },
      T('ReactCruelImpairedDone', { name: esc(holder.name), target: esc(target.name) }), holder);
  }

  if (mode != 'impaired') {
    await damageButton(holder, target, 2, 'psychic', T('ReactCruelDamageDone', { name: esc(holder.name), target: esc(target.name) }));
  }
});

/* -------------------------------------------- */
/*  Defeating someone                            */
/* -------------------------------------------- */

registerAfterDamage(async (actor, dealt, damageType, { newValue, wasAlreadyDefeated } = {}) => {
  if (!(newValue <= 0) || wasAlreadyDefeated) {
    return;
  }

  const context = lastApplyContext();
  const attacker = context?.attackerUuid ? await fromUuid(context.attackerUuid) : null;
  if (!attacker || attacker === actor) {
    return;
  }

  // Energon Manipulator (Decepticon Directive p.65): "By destroying an object containing Energon or
  // by Defeating any Cybertronian, you immediately regain 1d2 Health."
  if (actorHasPerk(attacker, TRIG.energonManipulator)) {
    const { creatureTagsOf } = await import("../../creature-tags.mjs");
    const tags = creatureTagsOf(actor);
    if (actor.system?.canTransform || tags.has('cybertronian') || tags.has('robot')) {
      await energonHeal(attacker);
    }
  }

  // Revengeful (Decepticon Directive p.66): "If one of these attacks Defeat that target, your team
  // gains a Story Point." The ↑1 window (pendingRevengeful) is dice.mjs's.
  if (actorHasPerk(attacker, TRIG.revengeful) && attacker.getFlag?.(SCOPE, 'pendingRevengeful')?.attackerUuid == actor.uuid) {
    const { requestStoryPointGrant } = await import("../../story-points.mjs");
    await requestStoryPointGrant(attacker, 1);
    await say(attacker, T('ReactRevengeful', { name: esc(attacker.name), target: esc(actor.name) }));
  }
});

async function energonHeal(actor) {
  const roll = await new Roll('1d2').evaluate();
  const health = actor.system?.health ?? {};
  const healed = Math.max(0, Math.min(roll.total, (health.max ?? Infinity) - (health.value ?? 0)));
  await actor.update({ 'system.health.value': (health.value ?? 0) + healed });
  await say(actor, T('ReactEnergonHeal', { name: esc(actor.name), amount: healed, roll: roll.total }));
  return healed;
}

// The "destroying an object containing Energon" half is the player's call - a Use button.
registerUse({
  id: 'react-energon-manipulator',
  matches: item => sourceOf(item) == TRIG.energonManipulator,
  run: async item => {
    await energonHeal(item.parent);
    return null;
  },
});

/* -------------------------------------------- */
/*  Inspirational Leader                         */
/* -------------------------------------------- */

// Inspirational Leader (Across the Stars, General Perk, p.69): "In a combat scene, after you succeed
// (or Critically Succeed) at a Skill Test in view of allies and teammates, they gain ↑1 when using
// the same Skill until the end of the round." The out-of-combat Lend Assistance half is an Assist
// rule on the Perk.
registerPostRoll(async (actor, results, checkContext) => {
  const skill = checkContext?.riderContext?.skill;
  if (!game.combat || !skill || !actorHasPerk(actor, TRIG.inspirationalLeader) || !(results ?? []).some(r => r.success)) {
    return;
  }

  await actor.setFlag(SCOPE, 'inspiringSkill', { skill, combatId: game.combat.id, round: game.combat.round });
});

export function inspiringLeaders(actor, skill) {
  if (!game.combat || !skill) {
    return [];
  }

  return worldActors().filter(leader => {
    const flag = leader !== actor && leader.getFlag?.(SCOPE, 'inspiringSkill');
    return flag && flag.skill == skill && flag.combatId == game.combat.id && flag.round == game.combat.round
      && areAllies(leader, actor) && actorHasPerk(leader, TRIG.inspirationalLeader);
  });
}

registerRollSources((actor, target, ctx) => {
  const leader = inspiringLeaders(actor, ctx?.rolledSkill)[0];
  return leader
    ? { sources: [{ id: 'reactInspiringLeader', label: `${nameOf(leader, TRIG.inspirationalLeader, 'Inspirational Leader')} (${leader.name})`, shiftUp: 1 }] }
    : null;
});

/* -------------------------------------------- */
/*  Agency                                       */
/* -------------------------------------------- */

/**
 * Agency (Across the Stars, Hang-Up, p.42): "When you Fumble in your agency's Skill, you do not
 * generate a Story Point as you normally would." The agency's Skill is the Agency Influence Perk's
 * own skill choice. Read by dice.mjs's Fumble grant (scratchpad integration/react-patch.cjs).
 * @param {Actor} actor
 * @param {String} skill
 * @returns {Boolean}
 */
export function suppressesFumbleStoryPoint(actor, skill) {
  if (!skill || !actorHasHangUp(actor, TRIG.agencyHangUp)) {
    return false;
  }

  const choice = findPerk(actor, TRIG.agencyPerk)?.system?.choice;
  return !!choice && choice == skill;
}

/* -------------------------------------------- */
/*  Secret Helper                                */
/* -------------------------------------------- */

// Secret Helper (MLP CRB p.74): "if a friend fails a Skill Test, you can roll your Skill Die (for the
// Skill they were using) and add it to their total." chat.mjs posts the assisted total; this reads
// it against the failed card's Difficulties and, where it now clears one, offers to resolve it as a
// success - with the Attack's damage when it was an Attack.
export function secretHelperSource(message) {
  const list = game.messages?.contents ?? [];
  const index = list.findIndex(m => m.id == message.id);
  for (let i = (index < 0 ? list.length : index) - 1; i >= 0 && i >= index - 25; i--) {
    const candidate = list[i];
    if (candidate?.speaker?.actor == message.speaker?.actor && candidate.flags?.[SCOPE]?.rollFailed === true && candidate.flags[SCOPE].checkResults) {
      return candidate;
    }
  }

  return null;
}

registerChatDecorator((message, element) => {
  if (!message?.flags?.[SCOPE]?.secretHelperAssist || !message.rolls?.length || !element?.querySelector) {
    return;
  }

  const source = secretHelperSource(message);
  const info = source ? cardInfo(source) : null;
  if (!info) {
    return;
  }

  const total = Number(message.rolls[0].total);
  const rows = info.rows.filter(row => !row.success && total >= row.difficulty);
  if (!rows.length || element.querySelector('.e20-react-secret-helper')) {
    return;
  }

  const box = document.createElement('div');
  box.className = 'e20-react-secret-helper e20-chat-action-buttons';
  box.innerHTML = `<p>${T('ReactSecretHelperNow', { total })}</p>`;
  const roller = speakerActor(message);
  if (canAct(roller)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'e20-chat-action-button';
    button.textContent = T('ReactResolveSuccess');
    button.disabled = isClaimed(roller, claimKey(message, null, 'secretHelper'));
    button.addEventListener('click', async () => {
      button.disabled = true;
      await claim(roller, claimKey(message, null, 'secretHelper'));
      await convertRows(info, rows, { crit: false, speaker: roller, reason: T('ReactSecretHelperSuccess', { name: esc(roller.name) }) });
    });
    box.appendChild(button);
  }

  (element.querySelector('.message-content') ?? element).appendChild(box);
});
