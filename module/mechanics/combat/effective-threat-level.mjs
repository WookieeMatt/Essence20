import { TFull as T } from "../../items/shared/item-lang.mjs";
import { onHook } from "../../items/shared/hooks-and-clients.mjs";

/**
 * The effective Threat Level of the fight, read out on the GM's combat tracker (wired at load by
 * items/gear/qualification-setup.mjs).
 */

/* ============================================ */
/*  Effective Threat Level (Finster's Monster-Matic Cookbook p.11) */
/* ============================================ */

// Effective Threat Level: the highest TL in the group plus half (rounded up) of the rest's total -
// e.g. TL5 with three TL3s makes 10. TL0 Threats count as one TL per group of them equal in size
// to the number of player characters.
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

export function registerThreatLevelReadout() {
  onHook('renderCombatTracker', onRenderCombatTracker);
}
