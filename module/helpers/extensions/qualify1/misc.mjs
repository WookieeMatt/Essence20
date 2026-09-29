import {
  registerChatButton, registerDerived, registerRollSources, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { getSceneEpoch, getUses, markUsed } from "../../scene-clock.mjs";
import { escape, has, idOf, itemFrom, Q1, sourceOf, T } from "./common.mjs";

/* ============================================ */
/*  Tenacity (G.I. Joe CRB, Infantry, 11th, p.80) */
/* ============================================ */

// "When affected by an effect that lasts until the end of your next turn, you may choose for it to
// end at the start of your turn instead. If you are affected by an effect that requires you to take
// a Skill Test, you gain an Edge on that Skill Test and may make it at the beginning of your turn in
// addition to the end of your turn."
//
// The Skill Test half: every save card roll (helpers/save-riders.mjs, riderSpec kind 'save') gets
// Edge; the card's button can be pressed at the start of the turn as well as the end. The duration
// half: at the start of the holder's turn, anything on them set to run out at the end of this very
// turn - a rider mark someone else put on them, or a timed Condition in its last round - is listed
// on a card with an "End it now" button.

export function isSaveRoll(dataset) {
  const spec = dataset?.riderSpec;
  if (!spec) {
    return false;
  }

  try {
    return JSON.parse(spec)?.kind == 'save';
  } catch (error) {
    return String(spec).includes('"save"');
  }
}

export function tenacitySources(actor, target, ctx = {}) {
  if (!has(actor, Q1.tenacity) || !isSaveRoll(ctx.dataset)) {
    return { sources: [], consumes: [] };
  }

  return { sources: [{ id: 'q1Tenacity', label: itemFrom(actor, Q1.tenacity)?.name ?? 'Tenacity', edge: true }], consumes: [] };
}

/** What on this actor ends at the end of its current turn. */
export function endingThisTurn(actor, combat) {
  if (!combat) {
    return { marks: [], effects: [] };
  }

  const marks = (actor?.flags?.essence20?.riderMarks ?? []).filter(mark => mark?.combatId == combat.id
    && mark.untilRound == combat.round && mark.untilTurn == combat.turn && mark.by != actor.uuid);
  const effects = (actor?.effects?.filter ? actor.effects.filter(() => true) : []).filter(effect => {
    const rounds = effect.duration?.rounds;
    const start = effect.duration?.startRound;
    return rounds && start != null && start + rounds - 1 <= combat.round && effect.statuses?.size;
  });
  return { marks, effects };
}

export async function tenacityTurnStart(actor, combat) {
  if (!has(actor, Q1.tenacity)) {
    return null;
  }

  const { marks, effects } = endingThisTurn(actor, combat);
  if (!marks.length && !effects.length) {
    return null;
  }

  const names = [...marks.map(mark => mark.label ?? mark.kind), ...effects.map(effect => effect.name)];
  const perk = itemFrom(actor, Q1.tenacity)?.name ?? 'Tenacity';
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: (game.users?.filter?.(user => actor.testUserPermission?.(user, 'OWNER')) ?? []).map(user => user.id),
    content: `<p><strong>${escape(perk)}</strong> - ${escape(T('E20.Q1TenacityPrompt', { effects: names.join(', ') }))}</p>
      <button type="button" class="e20-chat-action-button" data-e20-ext="q1TenacityEnd" data-actor-uuid="${actor.uuid}">${escape(T('E20.Q1TenacityEnd'))}</button>`,
  });
}

export async function onTenacityEnd(message, button) {
  const actor = await fromUuid(button.dataset.actorUuid);
  if (!actor || !(actor.isOwner || game.user?.isGM)) {
    return;
  }

  const { marks, effects } = endingThisTurn(actor, game.combat);
  if (marks.length) {
    const kept = (actor.flags.essence20.riderMarks ?? []).filter(mark => !marks.includes(mark));
    await actor.setFlag('essence20', 'riderMarks', kept);
  }

  if (effects.length) {
    await actor.deleteEmbeddedDocuments('ActiveEffect', effects.map(effect => effect.id));
  }

  button.disabled = true;
}

/* ============================================ */
/*  Dome Generator (G.I. Joe CRB p.156)          */
/* ============================================ */

// "As a Free action once per scene, double the battledress's effect until the beginning of your next
// turn. This upgrade can be taken multiple times, increasing the number of times it can be used."
const DOME_FLAG = 'q1DomeActive';
const DOME_USES = 'q1DomeGenerator';

function domeArmor(upgrade) {
  const parentId = upgrade?.flags?.essence20?.parentId;
  return parentId ? upgrade.parent?.items?.get?.(parentId) ?? null : null;
}

function domeCopies(upgrade) {
  const armor = domeArmor(upgrade);
  return armor ? upgrade.parent.items.filter(item => item.type == 'upgrade' && item.flags?.essence20?.parentId == armor.id
    && idOf(sourceOf(item)) == Q1.domeGenerator).length : 1;
}

function untilStartOfNextTurn(actor) {
  const combat = game.combat;
  if (!combat) {
    return {};
  }

  const theirs = combat.turns?.findIndex?.(c => c.actor?.id == actor?.id) ?? -1;
  return { combatId: combat.id, untilRound: combat.round + 1, untilTurn: (theirs < 0 ? combat.turn : theirs) - 1 };
}

export function domeLive(actor) {
  const dome = actor?.flags?.essence20?.[DOME_FLAG];
  if (!dome || dome.scene != getSceneEpoch()) {
    return null;
  }

  const combat = game.combat;
  if (dome.combatId) {
    if (!combat || combat.id != dome.combatId) {
      return null;
    }

    if (combat.round > dome.untilRound || (combat.round == dome.untilRound && combat.turn > dome.untilTurn)) {
      return null;
    }
  }

  return dome;
}

export function domeDerived(actor) {
  const dome = domeLive(actor);
  if (!dome || actor.system?.isMorphed) {
    return;
  }

  const armor = actor.items?.get?.(dome.armorId);
  if (!armor?.system?.equipped) {
    return;
  }

  const label = T('E20.Q1DomeLabel');
  for (const [defense, field] of [['toughness', 'totalBonusToughness'], ['evasion', 'totalBonusEvasion']]) {
    const bonus = parseInt(armor.system[field]) || 0;
    const target = actor.system?.defenses?.[defense];
    if (bonus > 0 && target) {
      target.total += bonus;
      target.string = `${target.string ?? ''} + ${bonus} (${label})`;
    }
  }
}

export const DOME_USE = {
  id: 'q1DomeGenerator',
  matches: item => item?.type == 'upgrade' && idOf(sourceOf(item)) == Q1.domeGenerator,
  canUse: item => !!domeArmor(item)?.system?.equipped && getUses(item.parent, DOME_USES, 'scene') < domeCopies(item),
  async run(item, economy, pay) {
    const actor = item.parent;
    const armor = domeArmor(item);
    if (!armor || !(await pay('free'))) {
      return null;
    }

    await markUsed(actor, DOME_USES, { window: 'scene' });
    await actor.setFlag('essence20', DOME_FLAG, { armorId: armor.id, scene: getSceneEpoch(), ...untilStartOfNextTurn(actor) });
    return T('E20.Q1DomeUsed', { name: actor.name, armor: armor.name });
  },
};

/* ============================================ */
/*  Nobility Hang-Up (Field Guide p.57)          */
/* ============================================ */

// "Your position in the nobility comes with a recurring responsibility that weighs heavily on you.
// Your group begins each session with 1 fewer Story Point."
//
// The Story Points app's New Session resets the primary Party with sessionResetUpdate() - both pools
// written at once, the players' to the roster size. That write is recognised here (both keys,
// storyPoints == roster size) and trimmed by 1 for each Party member holding this Hang-Up.
export function nobilityPenalty(members) {
  return (members ?? []).filter(member => has(member, Q1.nobility)).length;
}

export function onPartyPreUpdate(actor, changes) {
  if (actor?.type != 'party') {
    return;
  }

  const flat = foundry.utils.flattenObject(changes ?? {});
  const members = actor.members ?? [];
  if (!('system.storyPoints' in flat) || !('system.gmPoints' in flat) || flat['system.storyPoints'] != members.length) {
    return;
  }

  const penalty = nobilityPenalty(members);
  if (!penalty) {
    return;
  }

  const value = Math.max(0, flat['system.storyPoints'] - penalty);
  foundry.utils.setProperty(changes, 'system.storyPoints', value);
  if (changes['system.storyPoints'] !== undefined) {
    changes['system.storyPoints'] = value;
  }

  ChatMessage.create({ content: `<p>${escape(T('E20.Q1NobilitySession', { count: penalty }))}</p>` });
}

/* ============================================ */
/*  Addicted (Dark Energon) (Decepticon Directive p.80) */
/* ============================================ */

// "At the start of each day, the Dark Energon makes an attack against the user's Willpower (at the
// same skill level that caused the Hang-Up). If it fails, the user staves off the hunger for the day;
// on a success, the user needs to consume Dark Energon that day or all standard Energon Point
// expenditures are doubled in cost. A Dark Energon addict that hasn't consumed Dark Energon within 24
// hours after being successfully attacked by the addiction takes 1 Smarts and 1 Social Essence damage
// and continues to take the same damage each subsequent 24 hours until they consume Dark Energon (no
// additional attack needed). ... When a Dark Energon user is reduced to 1 Smarts or Social Essence,
// they begin randomly attacking enemies and allies alike in a berserk rage ... Dark Energon addiction
// can be treated with a successful DIF 20 Science (Medicine) Skill Test that requires a week of
// counseling and treatment."
//
// No calendar exists, so the Hang-Up's Use button carries the day: New Day (the attack, or the
// withdrawal damage), Consumed Dark Energon, and Treatment. While craving, every drop in standard
// Energon is doubled (preUpdateActor below).
const ADDICTION_FLAG = 'q1Addiction';

export function addictionState(actor) {
  return actor?.flags?.essence20?.[ADDICTION_FLAG] ?? { day: 0, craving: false, cravingDay: null, cured: false };
}

export function isCraving(actor) {
  const state = addictionState(actor);
  return has(actor, Q1.addictedDarkEnergon) && !state.cured && !!state.craving;
}

/** Double a drop in standard Energon while craving. */
export function onAddictPreUpdate(actor, changes) {
  if (!isCraving(actor)) {
    return;
  }

  const path = 'system.energon.normal.value';
  const flat = foundry.utils.flattenObject(changes ?? {});
  if (!(path in flat)) {
    return;
  }

  const before = Number(foundry.utils.getProperty(actor, path) ?? 0);
  const after = Number(flat[path]);
  if (!(after < before)) {
    return;
  }

  const doubled = Math.max(0, before - 2 * (before - after));
  foundry.utils.setProperty(changes, path, doubled);
  if (changes[path] !== undefined) {
    changes[path] = doubled;
  }
}

const SHIFTS = ['d2', 'd4', 'd6', 'd8', 'd10', 'd12'];

async function newDay(actor, state) {
  const day = (state.day ?? 0) + 1;
  // Unfed since a successful attack on an earlier day: withdrawal, no new attack.
  if (state.craving && state.cravingDay != null && state.cravingDay < day) {
    const { applyEssenceDamage } = await import("../../environment-hazards.mjs");
    await applyEssenceDamage(actor, ['smarts', 'social']);
    await actor.setFlag('essence20', ADDICTION_FLAG, { ...state, day });
    const low = ['smarts', 'social'].some(essence => (actor.system?.essences?.[essence]?.value ?? 2) <= 1);
    return T(low ? 'E20.Q1AddictionBerserk' : 'E20.Q1AddictionWithdrawal', { name: actor.name });
  }

  const { chooseSelect } = await import("../../grants.mjs");
  const shift = await chooseSelect(actor.name, T('E20.Q1AddictionLevel'), SHIFTS.map(value => ({ value, label: value })));
  if (!shift) {
    return null;
  }

  const roll = await new Roll(`d20 + ${shift}`).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: T('E20.Q1AddictionAttack') });
  const willpower = actor.system?.defenses?.willpower?.total ?? 10;
  const hit = roll.total >= willpower;
  await actor.setFlag('essence20', ADDICTION_FLAG, { ...state, day, craving: hit, cravingDay: hit ? day : null });
  return T(hit ? 'E20.Q1AddictionHungry' : 'E20.Q1AddictionStaved', { name: actor.name });
}

export const ADDICTION_USE = {
  id: 'q1Addiction',
  matches: item => sourceOf(item) == Q1.addictedDarkEnergon,
  canUse: item => !addictionState(item.parent).cured,
  async run(item) {
    const actor = item.parent;
    const state = addictionState(actor);
    const { chooseButtons, rollTest } = await import("../../grants.mjs");
    const which = await chooseButtons(item.name, T('E20.Q1WhichUse'), [
      ['day', T('E20.Q1AddictionNewDay')], ['fed', T('E20.Q1AddictionFed')], ['treat', T('E20.Q1AddictionTreat')],
    ]);
    if (which == 'day') {
      return newDay(actor, state);
    }

    if (which == 'fed') {
      await actor.setFlag('essence20', ADDICTION_FLAG, { ...state, craving: false, cravingDay: null });
      return T('E20.Q1AddictionFedLine', { name: actor.name });
    }

    if (which == 'treat') {
      const { success } = await rollTest(actor, 'science', 20);
      if (success) {
        await actor.setFlag('essence20', ADDICTION_FLAG, { ...state, craving: false, cured: true });
        return T('E20.Q1AddictionCured', { name: actor.name });
      }

      return T('E20.Q1AddictionNotCured', { name: actor.name });
    }

    return null;
  },
};

/* ============================================ */
/*  Effective Threat Level (Finster's Monster-Matic Cookbook p.11) */
/* ============================================ */

// "separate the highest Threat Level creature from the group, then add half (always round up) of the
// total Threat Level of the group to that Threat's TL ... three Cogs (TL3) and Lightning Bot (TL5)
// would be Threat Level 10 (5+[3+3+3]/2)." "when ... there are TL0 Threats present, they count as a
// single TL for each set of these Threats numerically equal to the number of player characters."
export function effectiveThreatLevel(levels, playerCount) {
  const tls = (levels ?? []).map(Number).filter(Number.isFinite);
  const zeros = tls.filter(tl => tl <= 0).length;
  const rest = tls.filter(tl => tl > 0);
  const sets = playerCount > 0 ? Math.floor(zeros / playerCount) : 0;
  rest.push(...Array(sets).fill(1));
  if (!rest.length) {
    return 0;
  }

  rest.sort((a, b) => b - a);
  const [top, ...others] = rest;
  return top + Math.ceil(others.reduce((sum, tl) => sum + tl, 0) / 2);
}

export function combatThreatSummary(combat) {
  const actors = (combat?.combatants?.contents ?? [...(combat?.combatants ?? [])]).map(c => c.actor).filter(Boolean);
  const players = actors.filter(actor => actor.type == 'playerCharacter');
  const threats = actors.filter(actor => actor.type == 'npc' || (actor.type == 'vehicle' && actor.system?.threatLevel));
  const levels = threats.map(actor => actor.system?.threatLevel ?? 0);
  const partyLevel = players.length
    ? Math.round(players.reduce((sum, actor) => sum + (Number(actor.system?.level) || 0), 0) / players.length) : 0;
  return { tl: effectiveThreatLevel(levels, players.length), threats: threats.length, players: players.length, partyLevel };
}

export function onRenderCombatTracker(app, html) {
  const root = html?.[0] ?? html;
  const combat = app?.viewed ?? game.combat;
  if (!game.user?.isGM || !combat || !root?.querySelector) {
    return;
  }

  root.querySelector('.q1-threat-level')?.remove();
  const summary = combatThreatSummary(combat);
  if (!summary.threats) {
    return;
  }

  const line = document.createElement('div');
  line.className = 'q1-threat-level e20-threat-level';
  line.style.cssText = 'padding: 2px 8px; font-size: var(--font-size-12, 12px); opacity: 0.85;';
  line.textContent = T('E20.Q1EncounterTl', summary);
  const header = root.querySelector('.combat-tracker-header, header') ?? root;
  header.appendChild(line);
}

export function registerMisc() {
  registerRollSources(tenacitySources);
  registerTurnStart(tenacityTurnStart);
  registerChatButton('q1TenacityEnd', onTenacityEnd);
  registerDerived(domeDerived);
  registerUse(DOME_USE);
  registerUse(ADDICTION_USE);
  if (globalThis.Hooks?.on) {
    Hooks.on('preUpdateActor', (actor, changes) => {
      onPartyPreUpdate(actor, changes);
      onAddictPreUpdate(actor, changes);
    });
    Hooks.on('renderCombatTracker', onRenderCombatTracker);
  }
}
