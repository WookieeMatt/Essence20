import {
  registerAfterDamage, registerChatButton, registerChatDecorator, registerDerived, registerPostRoll,
  registerPreRoll, registerRollSources, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { getUses, markUsed } from "../../scene-clock.mjs";
import { hasComputerizedGear } from "../other1/cobra-gear.mjs";
import { G2, T, escape, findSourced, hasItem, itemsOf, perkUseCard, post, sourceOf } from "./shared.mjs";

/**
 * GI JOE CRB Perks that needed a Use button, a roll hook or a follow-up reminder: Expert Knowledge,
 * Mentor, Martial Artist, Nose For Trouble's Streetwise swap, Machinesmith, En Passant, Energy
 * Resistant, Queen's Gambit, BRRRRRRRRRRRRRRT's Sprint, Castling's move, Plan of Action's split and
 * Fearsome Presence's range, count and expiry.
 */

const skillLabel = skill => game.i18n.localize(CONFIG.E20?.skills?.[skill] ?? skill);
const essenceLabel = essence => game.i18n.localize(CONFIG.E20?.essences?.[essence] ?? essence);
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

async function unsetFlagOn(doc, key) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, 'unsetFlag', ['essence20', key]);
  }

  await doc.unsetFlag('essence20', key);
  return true;
}

async function toggleStatusOn(actor, status, active) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(actor)) {
    return relayToGm(actor, 'toggleStatusEffect', [status, { active }]);
  }

  return actor.toggleStatusEffect(status, { active });
}

function tokenOf(actor) {
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

function feetBetween(a, b) {
  if (!a?.center || !b?.center || !canvas?.grid) {
    return null;
  }

  return canvas.grid.measurePath([a.center, b.center]).distance;
}

/* -------------------------------------------- */
/*  Choices made when the item is taken          */
/* -------------------------------------------- */

// Expert Knowledge (Origin, p.67): "When you choose this Origin, select an area of study covered by
// a Smarts skill." Mentor (General Perk, p.132): "Choose a Skill. You may associate that Skill with
// an additional Essence." Energy Resistant (armor upgrade, p.156): "Choose an Element."
export const EXPERT_FLAG = 'gij2ExpertSkill';
export const MENTOR_FLAG = 'gij2Mentor';
export const ELEMENT_FLAG = 'gij2Element';
export const ELEMENTS = ['acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic'];

export function smartsSkills() {
  return Object.entries(CONFIG.E20?.skillToEssence ?? {}).filter(([, e]) => e == 'smarts').map(([skill]) => skill);
}

async function chooseExpertSkill(item) {
  const { chooseSelect } = await grantsApi();
  const skill = await chooseSelect(item.name, T('E20.Gij2ExpertKnowledgePrompt'),
    smartsSkills().map(value => ({ value, label: skillLabel(value) })));
  if (!skill) {
    return null;
  }

  await item.setFlag('essence20', EXPERT_FLAG, skill);
  return T('E20.Gij2ChoiceSet', { name: item.parent?.name ?? '', item: item.name, choice: skillLabel(skill) });
}

async function chooseMentor(item) {
  const { chooseSelect } = await grantsApi();
  const skill = await chooseSelect(item.name, T('E20.Gij2MentorSkillPrompt'),
    Object.keys(CONFIG.E20?.skillToEssence ?? {}).map(value => ({ value, label: skillLabel(value) })));
  if (!skill) {
    return null;
  }

  const own = CONFIG.E20.skillToEssence[skill];
  const essence = await chooseSelect(item.name, T('E20.Gij2MentorEssencePrompt', { skill: skillLabel(skill) }),
    ['strength', 'speed', 'smarts', 'social'].filter(e => e != own).map(value => ({ value, label: essenceLabel(value) })));
  if (!essence) {
    return null;
  }

  await item.setFlag('essence20', MENTOR_FLAG, { skill, essence });
  return T('E20.Gij2ChoiceSet', { name: item.parent?.name ?? '', item: item.name, choice: `${skillLabel(skill)} + ${essenceLabel(essence)}` });
}

async function chooseElement(item) {
  const { chooseSelect } = await grantsApi();
  const element = await chooseSelect(item.name, T('E20.Gij2ElementPrompt'),
    ELEMENTS.map(value => ({ value, label: game.i18n.localize(CONFIG.E20.damageTypes?.[value] ?? value) })));
  if (!element) {
    return null;
  }

  await item.setFlag('essence20', ELEMENT_FLAG, element);
  return T('E20.Gij2ChoiceSet', { name: item.parent?.name ?? '', item: item.name, choice: game.i18n.localize(CONFIG.E20.damageTypes?.[element] ?? element) });
}

const CHOOSERS = {
  [G2.expertKnowledge]: chooseExpertSkill,
  [G2.mentor]: chooseMentor,
  [G2.energyResistant]: chooseElement,
};

for (const [uuid, run] of Object.entries(CHOOSERS)) {
  registerUse({ id: `gij2Choose-${uuid.slice(-16)}`, matches: item => sourceOf(item) == uuid && !!item.parent, run: item => run(item) });
}

// Ask right away when the item lands on an actor (dropped, or granted - For The Syndicate grants Mentor).
globalThis.Hooks?.on?.('createItem', (item, options, userId) => {
  const run = CHOOSERS[sourceOf(item)];
  if (run && item.parent && userId == game.user?.id) {
    run(item);
  }
});

/** Mentor's extra Essence and Energy Resistant's Resistance, in derived data. */
export function perkDerived(actor) {
  const skills = actor?.system?.skills;
  for (const item of itemsOf(actor)) {
    const source = sourceOf(item);
    if (source == G2.mentor) {
      const pick = item.flags?.essence20?.[MENTOR_FLAG];
      if (pick?.skill && pick.essence && skills?.[pick.skill]?.essences) {
        skills[pick.skill].essences[pick.essence] = true;
      }
    } else if (source == G2.energyResistant) {
      // "You are Resistant to Damage of that Element" - while the upgraded battledress is worn.
      const element = item.flags?.essence20?.[ELEMENT_FLAG];
      const parentId = item.flags?.essence20?.parentId;
      const worn = !parentId || !!actor.items?.get?.(parentId)?.system?.equipped;
      if (element && worn && actor.system?.resistances) {
        actor.system.resistances[element] = true;
      }
    }
  }
}

registerDerived(perkDerived);

/* -------------------------------------------- */
/*  Expert Knowledge                             */
/* -------------------------------------------- */

// Expert Knowledge (Origin, p.67): "When you succeed on a Skill Test in your area of study, you gain
// an additional benefit (such greater information, additional healing, more potent effects) as if you
// rolled a critical success. If you critically succeed in your area of study, you gain two additional
// benefits instead of one." What the benefit is stays the GM's; the card says how many are owed.
export async function expertKnowledgePostRoll(actor, results, checkContext, { isCrit } = {}) {
  const skill = checkContext?.riderContext?.skill;
  const item = findSourced(actor, G2.expertKnowledge);
  if (!item || !skill || item.flags?.essence20?.[EXPERT_FLAG] != skill || !(results ?? []).some(r => r?.success)) {
    return;
  }

  const crit = isCrit || (results ?? []).some(r => r?.success && r.multiplier >= 2);
  await post(actor, T('E20.Gij2ExpertKnowledgeCard', { name: actor.name, perk: item.name, count: crit ? 2 : 1 }));
}

registerPostRoll(expertKnowledgePostRoll);

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
/*  Machinesmith                                 */
/* -------------------------------------------- */

// Machinesmith (Tinkerer Focus, 20th level, p.105): "You treat all targets as if they had the AI and
// Robot perks when it is beneficial for you to do so." The one place that is a number: an
// Electromagnetic attack is "↑3 against computers ... and robots, but ↓3 against all other targets"
// (p.207). Against a living target with nothing computerized, dice.mjs gives the ↓3; this undoes it
// and adds the robot ↑3. (A target already counted as computerized - dice.mjs's Computerized trait,
// or other1's computerized gear - already gets the ↑.) Using Technology to give first aid and the
// like is the GM's call.
export function machinesmithSources(actor, target, { item } = {}) {
  if (!target || !hasItem(actor, G2.machinesmith) || item?.type != 'weaponEffect') {
    return null;
  }

  const weapon = actor?.items?.get?.(item.flags?.essence20?.parentId);
  const em = item.system?.damageType == 'emp' || !!weapon?.system?.traits?.includes?.('electromagnetic');
  if (!em || target.system?.traits?.computerized || hasComputerizedGear(target)) {
    return null;
  }

  return { sources: [{ id: 'gij2Machinesmith', label: findSourced(actor, G2.machinesmith).name, shiftUp: 6 }] };
}

registerRollSources(machinesmithSources);

/* -------------------------------------------- */
/*  En Passant                                   */
/* -------------------------------------------- */

// En Passant (Grandmaster Focus, 3rd level, p.87): "when you are aware of an enemy coming within your
// reach or range, you may attempt a DIF 15 Alertness Skill Test. On a success, you interrupt their
// turn to make an immediate attack." The Use button rolls the test; a success hands over one attack
// that costs no action (helpers/action-economy.mjs#grantBonusAttack), to be made right away.
registerUse({
  id: 'gij2EnPassant',
  matches: item => sourceOf(item) == G2.enPassant && !!item.parent,
  run: async (item, economy) => {
    const actor = item.parent;
    const { rollTest } = await grantsApi();
    const { success } = await rollTest(actor, 'alertness', 15);
    if (!success) {
      return T('E20.Gij2EnPassantFail', { name: actor.name, perk: item.name });
    }

    const eco = economy ?? await import("../../action-economy.mjs");
    await eco.grantBonusAttack?.(actor, { source: item.name, cost: 'none' });
    return T('E20.Gij2EnPassantHit', { name: actor.name, perk: item.name });
  },
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
/*  BRRRRRRRRRRRRRRT and Castling reminders      */
/* -------------------------------------------- */

// BRRRRRRRRRRRRRRT (Heavy Ordnance Focus, 10th level, p.111): "your allies gain ↑1 shift for the next
// turn and may immediately take a Sprint action." dice.mjs banks the ↑1 and stamps the Perk's
// once-per-encounter flag; the Sprint is out of turn (token movement off-turn isn't charged), so the
// card tells the table who may move and how far.
globalThis.Hooks?.on?.('updateActor', async (actor, changes, options, userId) => {
  if (userId != game.user?.id || !changes?.flags?.essence20?.brrrrrrrrrrrrrrtUsedThisEncounter) {
    return;
  }

  const { getNearbyAllyTokens } = await import("../../allies.mjs");
  const names = getNearbyAllyTokens(actor, Infinity).map(t => t.actor?.name).filter(Boolean);
  await post(actor, T('E20.Gij2BrrrtSprint', {
    perk: findSourced(actor, G2.brrrt)?.name ?? 'BRRRRRRRRRRRRRRT',
    allies: names.length ? escape(names.join(', ')) : T('E20.Gij2Allies'),
  }));
});

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

/* -------------------------------------------- */
/*  Fearsome Presence                            */
/* -------------------------------------------- */

export const FEARSOME_FLAG = 'gij2FearsomeFrightened';
const FEARSOME_RANGE = 20;
const FEARSOME_MAX = 3;

// Fearsome Presence (Renegade, 14th level, p.97): "Choose up to three characters within 20 feet and
// roll your Intimidation against their Willpower. If you are successful, they gain the Frightened
// Condition towards you until the start of your next turn and must move away from you if it is safe
// to do so." dice.mjs frightens every target the roll beat; this keeps it to the first three within
// 20 feet, stamps who frightened them, and lifts it at the start of the Renegade's next turn.
registerPreRoll(async (actor, dataset) => {
  if (!dataset?.isFearsomePresence) {
    return;
  }

  const targets = [...(game.user?.targets ?? [])];
  const mine = tokenOf(actor);
  const far = targets.filter(t => (feetBetween(mine, t) ?? 0) > FEARSOME_RANGE);
  if (targets.length > FEARSOME_MAX || far.length) {
    ui.notifications.warn(T('E20.Gij2FearsomeLimits', { count: FEARSOME_MAX, range: FEARSOME_RANGE }));
  }
});

export async function fearsomePostRoll(actor, results, checkContext) {
  if (!checkContext?.isFearsomePresenceAttempt) {
    return;
  }

  const mine = tokenOf(actor);
  let counted = 0;
  const frightened = [];
  for (const result of results ?? []) {
    if (!result?.success || !result.targetUuid) {
      continue;
    }

    const target = await fromUuid(result.targetUuid);
    if (!target) {
      continue;
    }

    const distance = feetBetween(mine, tokenOf(target));
    counted += 1;
    if (counted > FEARSOME_MAX || (distance != null && distance > FEARSOME_RANGE)) {
      await toggleStatusOn(target, 'frightened', false);
      continue;
    }

    await setFlagOn(target, FEARSOME_FLAG, { by: actor.uuid });
    frightened.push(target.name);
  }

  if (frightened.length) {
    await post(actor, T('E20.Gij2FearsomeCard', { name: actor.name, targets: escape(frightened.join(', ')) }));
  }
}

registerPostRoll(fearsomePostRoll);

export async function fearsomeExpire(actor) {
  const actors = (canvas?.tokens?.placeables ?? []).map(t => t.actor).filter(Boolean);
  for (const target of actors) {
    if (target.flags?.essence20?.[FEARSOME_FLAG]?.by == actor?.uuid && actor?.uuid) {
      await target.toggleStatusEffect('frightened', { active: false });
      await unsetFlagOn(target, FEARSOME_FLAG);
    }
  }
}

registerTurnStart(fearsomeExpire);
