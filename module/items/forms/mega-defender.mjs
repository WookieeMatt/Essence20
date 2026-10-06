/**
 * Power Rangers - Through the Shattered Grid's Mega Defender (Magna Defender). (Better Together, Guardian Blast and
 * the rest of Metallic Armor Power Up! are items/social/better-together.mjs, items/attacks/guardian-blast.mjs and
 * items/defenses/metallic-armor-minions-and-ending.mjs. The Void Touched Origin's Essence trade, the Solarix Shard and
 * Follow Me! (PR CRB) are rules on their pack items.)
 */
import {
  registerAfterDamage, registerDerived, registerSceneAdvanced, registerTurnStart, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { O3 } from "../shared/mlp-pr-tf-ids-and-skill-total.mjs";
import { T } from "../shared/item-lang.mjs";
import { escapeHtml as escape, say } from "../shared/chat-lines.mjs";
import { isItem } from "../shared/item-lookups.mjs";
import { num } from "../shared/numbers.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";

/*
 * Mega Defender (Through the Shattered Grid, Magna Defender, p.24): "by expending 3 Personal Power
 * as a Standard action, you can have [the Torozord] channel and infuse you with Morphin Grid energy,
 * changing you into a Zord-like form known as the Mega Defender. ... You use the Strength and Speed
 * Essence Scores, Health, Defense bonuses, and type of movement of the Mega Defender form. ... you
 * remain in Mega Defender form until the scene's end or the form's Health falls to 0. When reduced
 * to 0 Health, you automatically return to your Morphed form with the same Health and Conditions you
 * had before." Stat block (p.38): Health 8, 40ft Ground, Strength 8, Speed 4, Toughness 18,
 * Evasion 14. Might/Targeting stay the Ranger's own ranks, which is how the actor already rolls.
 *
 * "Once the Torozord has answered your call and arrived at the conflict" - the form needs the
 * Ranger's Torozord (a Zord on their sheet) on the scene, and remembers which one. "While in this form,
 * you and the Torozord share actions. This means only one of you can Move and only one can take a
 * Standard action each turn. You may divide your Free actions as you see fit, using the highest
 * number of Free actions between you." They keep separate turns, so what one spends is pre-spent on
 * the partner's turn if it is still to come this round, and the one with fewer Free actions is topped
 * up to the other's at the start of their turn.
 */
const MEGA_FLAG = 'o3MegaDefender';
export const MEGA_FORM = { health: 8, strength: 8, speed: 4, toughness: 18, evasion: 14, ground: 40 };

export function megaDefenderActive(actor) {
  const record = actor?.flags?.essence20?.[MEGA_FLAG];
  return !!record && record.epoch == getSceneEpoch();
}

/** The Ranger's Torozord: a Zord on their sheet that has a token on the current scene. */
export function presentTorozord(actor) {
  const zords = Object.values(actor?.system?.actors ?? {})
    .map(entry => globalThis.fromUuidSync?.(entry?.uuid))
    .filter(zord => zord?.type == 'zord');
  const scene = globalThis.canvas?.scene ?? globalThis.game?.scenes?.current;
  const onScene = zords.filter(zord => scene?.tokens?.some?.(token => token.actorId == zord.id || token.actor?.id == zord.id));
  return onScene.find(zord => /toro/i.test(zord.name ?? '')) ?? onScene[0] ?? null;
}

/** The other half of an active Mega Defender pair, from either side. */
export function megaDefenderPartner(actor) {
  if (megaDefenderActive(actor)) {
    const uuid = actor.flags.essence20[MEGA_FLAG].torozordUuid;
    return uuid ? globalThis.fromUuidSync?.(uuid) ?? null : null;
  }

  if (actor?.type != 'zord') {
    return null;
  }

  return worldActors().find(ranger => megaDefenderActive(ranger) && ranger.flags.essence20[MEGA_FLAG].torozordUuid == actor.uuid) ?? null;
}

/** Whether this actor's turn is still to come in the current round. */
export function turnStillToCome(actor, combat = globalThis.game?.combat) {
  if (!combat?.turns?.length) {
    return false;
  }

  const index = combat.turns.findIndex(combatant => combatant.actor?.id == actor?.id);
  return index > (combat.turn ?? 0);
}

/** One partner spent actions: pre-spend them on the other's turn, if that is still to come. */
export async function shareMegaDefenderSpend(actor, cost = {}) {
  const partner = megaDefenderPartner(actor);
  const shared = Object.fromEntries(Object.entries(cost).filter(([category, amount]) => ['move', 'standard', 'free'].includes(category) && amount > 0));
  if (!partner || !Object.keys(shared).length || !turnStillToCome(partner)) {
    return false;
  }

  const economy = await import("../../mechanics/actions/action-economy.mjs");
  return economy.setNextTurn(partner, { prespend: shared }, T('O3MegaDefenderShared', { name: actor.name }));
}

/** The Free actions the pair has: the higher of the two. */
export function sharedFreeTopUp(actor, partner) {
  const own = num(actor?.system?.actions?.free?.max);
  const theirs = num(partner?.system?.actions?.free?.max);
  return Math.max(0, theirs - own);
}

registerTurnStart(async (actor) => {
  const partner = megaDefenderPartner(actor);
  const topUp = partner ? sharedFreeTopUp(actor, partner) : 0;
  if (topUp > 0) {
    const economy = await import("../../mechanics/actions/action-economy.mjs");
    await economy.grantActionsThisTurn(actor, { free: topUp }, T('O3MegaDefenderFree'));
  }
});

if (globalThis.Hooks?.on) {
  Hooks.on('essence20.actionSpent', (actor, actionType, cost) => {
    shareMegaDefenderSpend(actor, cost).catch(error => console.warn('essence20 | Mega Defender share failed', error));
  });
}

export function applyMegaDefender(actor) {
  if (!megaDefenderActive(actor)) {
    return;
  }

  const system = actor.system;
  for (const essence of ['strength', 'speed']) {
    const score = system.essences?.[essence];
    if (score) {
      if (score.max != null) {
        score.max = MEGA_FORM[essence];
      }

      score.value = MEGA_FORM[essence];
    }
  }

  if (system.health) {
    system.health.max = MEGA_FORM.health;
  }

  for (const defense of ['toughness', 'evasion']) {
    if (system.defenses?.[defense]) {
      system.defenses[defense].total = MEGA_FORM[defense];
      system.defenses[defense].string = `${MEGA_FORM[defense]} (Mega Defender)`;
    }
  }

  for (const [type, move] of Object.entries(system.movement ?? {})) {
    if (move && typeof move == 'object' && 'total' in move) {
      move.total = type == 'ground' ? MEGA_FORM.ground : 0;
    }
  }
}

registerDerived(applyMegaDefender);

async function endMegaDefender(actor) {
  const record = actor?.flags?.essence20?.[MEGA_FLAG];
  if (!record) {
    return;
  }

  await actor.unsetFlag('essence20', MEGA_FLAG);
  await actor.update({ 'system.health.value': num(record.prevHealth) });
  await say(actor, T('O3MegaDefenderEnds', { name: escape(actor.name) }));
}

registerUse({
  id: 'o3MegaDefender',
  matches: item => isItem(item, O3.megaDefender),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    if (megaDefenderActive(actor)) {
      await endMegaDefender(actor);
      return null;
    }

    const power = num(actor.system?.powers?.personal?.value);
    if (power < 3) {
      ui.notifications.warn(T('O3NoPower', { name: escape(actor.name) }));
      return null;
    }

    const torozord = presentTorozord(actor);
    if (!torozord) {
      ui.notifications.warn(T('O3MegaDefenderNoTorozord', { name: escape(actor.name) }));
      return null;
    }

    if (!(await pay('standard'))) {
      return null;
    }

    await actor.update({
      'system.powers.personal.value': power - 3,
      'system.health.value': MEGA_FORM.health,
      [`flags.essence20.${MEGA_FLAG}`]: { epoch: getSceneEpoch(), prevHealth: num(actor.system?.health?.value), torozordUuid: torozord.uuid },
    });
    return T('O3MegaDefenderLine', { name: escape(actor.name) });
  },
});

registerAfterDamage(async (actor, dealt, damageType, { newValue } = {}) => {
  if (megaDefenderActive(actor) && num(newValue) <= 0 && actor.isOwner) {
    await endMegaDefender(actor);
  }
});

registerSceneAdvanced(async () => {
  for (const actor of worldActors()) {
    if (actor.flags?.essence20?.[MEGA_FLAG] && !megaDefenderActive(actor)) {
      await endMegaDefender(actor);
    }
  }
});
