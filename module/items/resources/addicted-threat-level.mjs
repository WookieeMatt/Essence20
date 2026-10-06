import { registerUse } from "../../mechanics/item-hooks.mjs";
import { has, Q1, sourceOf, T } from "../shared/qualification-gm-relay.mjs";

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
    const { applyEssenceDamage } = await import("../../mechanics/world/environment-hazards.mjs");
    await applyEssenceDamage(actor, ['smarts', 'social']);
    await actor.setFlag('essence20', ADDICTION_FLAG, { ...state, day });
    const low = ['smarts', 'social'].some(essence => (actor.system?.essences?.[essence]?.value ?? 2) <= 1);
    return T(low ? 'E20.Q1AddictionBerserk' : 'E20.Q1AddictionWithdrawal', { name: actor.name });
  }

  // "At the same skill level that caused the Hang-Up" - recorded when the addiction took hold
  // (resource/energon.mjs, darkEnergonAddictionDie); asked for only when that's unknown, e.g. a
  // Hang-Up added by hand. Past the top of the ladder the attack always succeeds.
  let shift = actor.flags?.essence20?.darkEnergonAddictionDie;
  if (!shift) {
    const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
    shift = await chooseSelect(actor.name, T('E20.Q1AddictionLevel'), SHIFTS.map(value => ({ value, label: value })));
    if (!shift) {
      return null;
    }
  }

  let hit = true;
  if (shift != 'auto') {
    const roll = await new Roll(`d20 + ${shift}`).evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: T('E20.Q1AddictionAttack') });
    const willpower = actor.system?.defenses?.willpower?.total ?? 10;
    hit = roll.total >= willpower;
  }

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
    const { chooseButtons, rollTest } = await import("../../mechanics/resources/grants.mjs");
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
  const totalLevels = players.reduce((sum, actor) => sum + (Number(actor.system?.level) || 0), 0);
  const partyLevel = players.length ? Math.round(totalLevels / players.length) : 0;
  // The Threat Level that suits a party of any size: their total levels / 4, rounded down (Field
  // Guide to Action & Adventure p.145) - mechanics/characters/threat-rules.mjs#appropriateThreatLevel.
  const appropriate = Math.floor(totalLevels / 4);
  return { tl: effectiveThreatLevel(levels, players.length), threats: threats.length, players: players.length, partyLevel, appropriate };
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
  registerUse(ADDICTION_USE);
  if (globalThis.Hooks?.on) {
    Hooks.on('preUpdateActor', (actor, changes) => {
      onAddictPreUpdate(actor, changes);
    });
    Hooks.on('renderCombatTracker', onRenderCombatTracker);
  }
}
