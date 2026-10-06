import {
  registerChatButton, registerPostRoll, registerPreRoll, registerTurnEnd, registerTurnStart, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { getNearbyEnemyTokens } from "../../mechanics/combat/nearby-enemies.mjs";
import { firstTarget, onDamageButton, safe, TF1 } from "../shared/condition-damage-buttons.mjs";
import { T } from "../shared/item-lang.mjs";
import { has, nameOf } from "../shared/item-lookups.mjs";
import { sayParagraph as say } from "../shared/chat-lines.mjs";
import { tokenOf } from "../shared/sides.mjs";

/**
 * Decepticon Directive combat Perks and gear: the Show Respect Hang-Up. (Focused Blast, Target-Rich Environment and the
 * armor Comms Assault's roll ignores are rules on their Perks.) Brutal Display, Make An Example and Comms Assault's
 * Use, Easy In, Easy Out's longer Disappear, all of My Allies Are My Shield, Steady Firepower and both
 * halves of Fearsome Additions are rules on the items.
 */

// Focused Blast (forgo an area weapon's blast for ↑1 or +1 damage) is a DialogSelect + HitRider rule pair on its Perk.

/* -------------------------------------------- */
/*  After the roll                               */
/* -------------------------------------------- */

export async function tf1CombatPostRoll(actor, results, checkContext, { hits = [], isCrit = false, rider = {} } = {}) {
  // Show Respect (Decepticon Directive, Hang-Up, p.31): "Whenever a foe rolls a Critical Success on an
  // Attack Skill Test, you must salute and not attack that foe on your following turn unless they are
  // the only foe present."
  if (isCrit && hits.length && rider.style && game?.combat) {
    await noteRespect(actor);
  }
}

/* -------------------------------------------- */
/*  Show Respect                                 */
/* -------------------------------------------- */

const RESPECT_FLAG = 'tf1Respect';

async function noteRespect(attacker) {
  const attackerToken = tokenOf(attacker);
  for (const combatant of game.combat.combatants ?? []) {
    const holder = combatant.actor;
    if (!holder || holder.id == attacker.id || !has(holder, TF1.showRespect)) {
      continue;
    }

    const holderToken = combatant.token?.object ?? tokenOf(holder);
    if (attackerToken && holderToken && attackerToken.document?.disposition == holderToken.document?.disposition) {
      continue;
    }

    const record = holder.flags?.essence20?.[RESPECT_FLAG] ?? {};
    const pending = [...new Set([...(record.pending ?? []), attacker.uuid])];
    const { needsGmRelay, relayToGm } = await import("../../mechanics/world/gm-relay.mjs");
    const value = { ...record, pending };
    if (needsGmRelay(holder)) {
      await relayToGm(holder, 'setFlag', ['essence20', RESPECT_FLAG, value]);
    } else {
      await holder.setFlag('essence20', RESPECT_FLAG, value);
    }

    await say(holder, T('Tf1ShowRespect', { name: holder.name, foe: attacker.name, hangUp: nameOf(holder, TF1.showRespect, 'Show Respect') }));
  }
}

export async function respectTurnStart(actor) {
  const record = actor?.flags?.essence20?.[RESPECT_FLAG];
  if (record?.pending?.length || record?.active?.length) {
    await actor.setFlag('essence20', RESPECT_FLAG, { pending: [], active: record.pending ?? [] });
  }
}

export async function respectTurnEnd(actor) {
  const record = actor?.flags?.essence20?.[RESPECT_FLAG];
  if (record?.active?.length) {
    await actor.setFlag('essence20', RESPECT_FLAG, { pending: record.pending ?? [], active: [] });
  }
}

/** Show Respect: a reminder when the holder attacks a foe they must salute this turn. */
export function respectWarning(actor, item) {
  const active = actor?.flags?.essence20?.[RESPECT_FLAG]?.active ?? [];
  if (!active.length || item?.type != 'weaponEffect') {
    return null;
  }

  const foes = safe(() => getNearbyEnemyTokens(actor, Infinity).length, 0);
  const target = firstTarget()?.actor;
  return target && active.includes(target.uuid) && foes > 1 ? target : null;
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

// Fearsome Voice (Tyrant, 1st level, p.44), Make An Example (6th level), Brutal Display (Beast Warrior, 20th
// level) and Comms Assault's Use (Infiltrator Analyst, 17th level) are rules on their Perks: a rollVsEach
// against every creature the Use picks, and hit Triggers for the Conditions.
// Target-Rich Environment (Quake, 20th level, p.47) is a Use rule on its Perk too: an attackEach with the favorite
// weapon's chosen attack at every enemy in its range (rules/plugins/combat/rule-attacks.mjs).
export const COMBAT_USES = [];

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerPostRoll(tf1CombatPostRoll);
registerChatButton('tf1Damage', onDamageButton);
COMBAT_USES.forEach(registerUse);

registerPreRoll((actor, dataset, item) => {
  const foe = respectWarning(actor, item);
  if (foe) {
    ui.notifications.warn(T('Tf1RespectWarn', { name: actor.name, foe: foe.name }));
  }
});

registerTurnStart(respectTurnStart);
registerTurnEnd(respectTurnEnd);
