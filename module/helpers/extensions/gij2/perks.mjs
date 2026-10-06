import {
  registerAfterDamage, registerChatButton, registerChatDecorator, registerPreRoll, registerUse,
} from "../../extensions.mjs";
import { getUses, markUsed } from "../../scene-clock.mjs";
import { G2, T, escape, findSourced, hasItem, perkUseCard, post, sourceOf } from "./shared.mjs";

/**
 * GI JOE CRB Perks that needed a Use button, a roll hook or a follow-up reminder: Martial Artist,
 * Nose For Trouble's Streetwise swap, Queen's Gambit, Castling's move and Plan of Action's split.
 */

const SHIFTS = () => CONFIG.E20?.skillShiftList ?? [];

async function grantsApi() {
  return import("../../grants.mjs");
}

/** Write a flag on someone else's actor through the GM when this user can't. */
async function setFlagOn(doc, key, value) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, 'setFlag', ['essence20', key, value]);
  }

  await doc.setFlag('essence20', key, value);
  return true;
}

function tokenOf(actor) {
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

// Mentor, Expert Knowledge and Energy Resistant (their picks and what they give) are item rules now -
// rules/conv5-slC5.test.js and rules/conv4-slC4.test.js.

/* -------------------------------------------- */
/*  Martial Artist                               */
/* -------------------------------------------- */

const levelOf = actor => Number(actor?.system?.threatLevel || actor?.system?.level) || 0;
const compare = (theirs, mine) => (theirs > mine ? 'Superior' : (theirs < mine ? 'Inferior' : 'Equal'));

// Martial Artist (Influence, p.50): "Given the opportunity to observe another martial artist for one
// minute, you can learn information about their capabilities compared to your own. The GM tells you
// if the creature is your equal, superior, or inferior in Threat Level as well as Toughness and
// Evasion defense." Read off the targeted token and whispered to the player and the GM.
export async function martialArtistCompare(actor, target) {
  const { getDefenseValue } = await import("../../combat.mjs");
  const word = key => T(`E20.Gij2Compare${key}`);
  return T('E20.Gij2MartialArtistResult', {
    target: target.name,
    level: word(compare(levelOf(target), levelOf(actor))),
    toughness: word(compare(getDefenseValue(target, 'toughness'), getDefenseValue(actor, 'toughness'))),
    evasion: word(compare(getDefenseValue(target, 'evasion'), getDefenseValue(actor, 'evasion'))),
  });
}

registerUse({
  id: 'gij2MartialArtist',
  matches: item => sourceOf(item) == G2.martialArtist && !!item.parent,
  run: async (item) => {
    const actor = item.parent;
    const target = game.user?.targets?.first?.()?.actor;
    if (!target || target == actor) {
      ui.notifications.warn(T('E20.Gij2NeedsTarget', { perk: item.name }));
      return null;
    }

    const content = await martialArtistCompare(actor, target);
    const gms = (game.users?.filter?.(u => u.isGM) ?? []).map(u => u.id);
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content, whisper: [...new Set([game.user.id, ...gms])] });
    return null;
  },
});

/* -------------------------------------------- */
/*  Nose For Trouble                             */
/* -------------------------------------------- */

// Nose For Trouble (General Perk, p.132): "You may use Streetwise in place of Alertness to search for
// clues or look for traps." Offered on a plain Alertness test when Streetwise is the better die (the
// Initiative bullet is dice.mjs's own checkbox).
export function streetwiseIsBetter(actor) {
  const list = SHIFTS();
  const street = list.indexOf(actor?.system?.skills?.streetwise?.shift);
  const alert = list.indexOf(actor?.system?.skills?.alertness?.shift);
  return street >= 0 && (alert < 0 || street < alert);
}

registerPreRoll(async (actor, dataset, item) => {
  if (item || dataset?.skill != 'alertness' || !hasItem(actor, G2.noseForTrouble) || !streetwiseIsBetter(actor)) {
    return;
  }

  const perk = findSourced(actor, G2.noseForTrouble);
  const swap = await foundry.applications.api.DialogV2.confirm({
    window: { title: perk.name },
    content: `<p>${T('E20.Gij2NoseStreetwisePrompt')}</p>`,
    rejectClose: false,
  });
  if (swap) {
    dataset.skill = 'streetwise';
    dataset.essence = CONFIG.E20.skillToEssence.streetwise;
    dataset.isSpecialized = false;
  }
});

/* -------------------------------------------- */
/*  Queen's Gambit                               */
/* -------------------------------------------- */

export const QUEENS_FLAG = 'gij2QueensGambit';

function combatActors(combat) {
  return [...(combat?.combatants ?? [])].map(c => c.actor).filter(Boolean);
}

function dispositionOf(actor) {
  return tokenOf(actor)?.document?.disposition ?? actor?.prototypeToken?.disposition ?? 0;
}

/**
 * The initiative that sorts a combatant straight after the one acting now: halfway to the next
 * one, or 1 below the current one when it's last.
 */
export function initiativeAfterCurrent(combat) {
  const turns = combat?.turns ?? [];
  const current = turns[combat?.turn ?? 0];
  if (current?.initiative == null) {
    return null;
  }

  const next = turns[(combat.turn ?? 0) + 1];
  return next?.initiative != null ? (current.initiative + next.initiative) / 2 : current.initiative - 1;
}

// Queen's Gambit (Grandmaster Focus, 17th level, p.87): "once per combat, when an ally takes damage,
// an ally you designate moves in the initiative order to right after the effect that caused the
// damage. This can mean that ally takes two turns this round." Offered on a card whenever an ally of
// a holder in the combat takes damage; the holder's player picks the ally.
export async function queensGambitOffer(damaged, dealt) {
  const combat = game.combat;
  if (!(dealt > 0) || !combat?.started || !damaged) {
    return;
  }

  for (const holder of combatActors(combat)) {
    const perk = findSourced(holder, G2.queensGambit);
    if (!perk || getUses(holder, QUEENS_FLAG, 'encounter') > 0 || dispositionOf(holder) != dispositionOf(damaged)) {
      continue;
    }

    const owners = (game.users?.filter?.(u => u.isGM || holder.testUserPermission?.(u, 'OWNER')) ?? []).map(u => u.id);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: holder }),
      whisper: owners,
      content: `<p>${T('E20.Gij2QueensGambitOffer', { name: holder.name, ally: escape(damaged.name), perk: perk.name })}</p>`
        + `<button type="button" data-e20-ext="gij2QueensGambit" data-holder="${holder.uuid}">${escape(perk.name)}</button>`,
    });
  }
}

registerAfterDamage(queensGambitOffer);

registerChatButton('gij2QueensGambit', async (message, button) => {
  const holder = await fromUuid(button.dataset.holder);
  const combat = game.combat;
  if (!holder || !combat) {
    return;
  }

  if (getUses(holder, QUEENS_FLAG, 'encounter') > 0) {
    ui.notifications.warn(T('E20.Gij2AlreadyUsed', { perk: findSourced(holder, G2.queensGambit)?.name ?? "Queen's Gambit" }));
    return;
  }

  let allyUuid = button.dataset.ally;
  if (!allyUuid) {
    const { chooseSelect } = await grantsApi();
    const allies = [...combat.combatants].filter(c => c.actor && dispositionOf(c.actor) == dispositionOf(holder));
    allyUuid = await chooseSelect(findSourced(holder, G2.queensGambit)?.name ?? '', T('E20.Gij2QueensGambitPick'),
      allies.map(c => ({ value: c.actor.uuid, label: c.name })));
  }

  const combatant = [...combat.combatants].find(c => c.actor?.uuid == allyUuid);
  if (!combatant) {
    return;
  }

  if (!game.user.isGM && !combatant.canUserModify?.(game.user, 'update')) {
    // Only the GM can reorder someone else's combatant - hand the GM the finished choice.
    const gms = (game.users?.filter?.(u => u.isGM) ?? []).map(u => u.id);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: holder }),
      whisper: gms,
      content: `<p>${T('E20.Gij2QueensGambitGm', { name: holder.name, ally: escape(combatant.name) })}</p>`
        + `<button type="button" data-e20-ext="gij2QueensGambit" data-holder="${holder.uuid}" data-ally="${allyUuid}">${T('E20.Gij2Apply')}</button>`,
    });
    return;
  }

  const initiative = initiativeAfterCurrent(combat);
  if (initiative == null) {
    return;
  }

  await combatant.update({ initiative });
  await markUsed(holder, QUEENS_FLAG, { window: 'encounter' });
  await post(holder, T('E20.Gij2QueensGambitDone', { name: holder.name, ally: escape(combatant.name) }));
});

/* -------------------------------------------- */
/*  Castling and Plan of Action reminders        */
/* -------------------------------------------- */

// Castling (Grandmaster Focus, 10th level, p.87): "They each gain one Temporary Health and may
// immediately move up to their full Movement Rating." castling.mjs gives the Temporary Health; the
// Perk's use card now says the move is theirs to take. Plan of Action (Officer, p.85): "At 5th level,
// you can grant a total of ↑2 to allies, either as ↑1 each to two allies or ↑2 to one ally" (↑3 at 9th,
// ↑4 at 13th, ↑5 at 18th) - banked-buffs.mjs gives the whole total to one ally; the use card gets a
// Split button that moves part of it to a second ally.
export function perkCardDecorator(message, element) {
  if (!element?.querySelector || element.querySelector('.gij2-note')) {
    return;
  }

  const content = element.querySelector('.message-content') ?? element;
  if (perkUseCard(message, G2.castling)) {
    content.insertAdjacentHTML('beforeend', `<p class="gij2-note">${T('E20.Gij2CastlingMove')}</p>`);
  }

  const plan = perkUseCard(message, G2.planOfAction);
  if (plan && (plan.item.system?.advances?.currentValue ?? 1) >= 2 && !hasItem(plan.actor, G2.inspiration)
    && (message.isAuthor || game.user?.isGM)) {
    content.insertAdjacentHTML('beforeend', `<p class="gij2-note"><button type="button" data-e20-ext="gij2PlanSplit" data-actor="${plan.actor.uuid}">${T('E20.Gij2PlanSplit')}</button></p>`);
  }
}

registerChatDecorator(perkCardDecorator);

registerChatButton('gij2PlanSplit', async (message, button) => {
  const officer = await fromUuid(button.dataset.actor);
  const { getPendingBonus, bankPendingBonus } = await import("../../perks.mjs");
  const { getNearbyAllyTokens } = await import("../../allies.mjs");
  const allies = getNearbyAllyTokens(officer, Infinity).map(t => t.actor).filter(Boolean);
  const first = allies.find(ally => (getPendingBonus(ally, 'pendingPlanOfAction')?.shiftUp ?? 0) >= 2);
  if (!first) {
    ui.notifications.warn(T('E20.Gij2PlanSplitNothing'));
    return;
  }

  const pending = getPendingBonus(first, 'pendingPlanOfAction');
  const { chooseSelect } = await grantsApi();
  const secondUuid = await chooseSelect(T('E20.Gij2PlanSplit'), T('E20.Gij2PlanSplitWho', { name: first.name }),
    allies.filter(a => a != first).map(a => ({ value: a.uuid, label: a.name })));
  const second = secondUuid ? await fromUuid(secondUuid) : null;
  if (!second) {
    return;
  }

  const amounts = Array.from({ length: pending.shiftUp - 1 }, (_, i) => i + 1);
  const moved = Number(await chooseSelect(T('E20.Gij2PlanSplit'), T('E20.Gij2PlanSplitHowMany', { name: second.name }),
    amounts.map(n => ({ value: String(n), label: `↑${n}` }))));
  if (!moved) {
    return;
  }

  await setFlagOn(first, 'pendingPlanOfAction', { ...pending, shiftUp: pending.shiftUp - moved });
  const theirs = getPendingBonus(second, 'pendingPlanOfAction');
  if (theirs) {
    await setFlagOn(second, 'pendingPlanOfAction', { ...theirs, shiftUp: (theirs.shiftUp ?? 0) + moved });
  } else if (second.isOwner) {
    await bankPendingBonus(second, 'pendingPlanOfAction', { shiftUp: moved });
  } else {
    await setFlagOn(second, 'pendingPlanOfAction', { shiftUp: moved, combatId: game.combat?.id ?? null, round: game.combat?.round ?? null });
  }

  await post(officer, T('E20.Gij2PlanSplitDone', { first: escape(first.name), a: pending.shiftUp - moved, second: escape(second.name), b: moved }));
});

// Fearsome Presence (Renegade, 14th level, p.97) is a Use rule on its Perk: the first three hits within 20 ft are
// Frightened until the Renegade's next turn starts (a turnStart Trigger lifts it).
