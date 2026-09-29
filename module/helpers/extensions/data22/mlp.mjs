import { registerPostRoll, registerRollSources, registerUse } from "../../extensions.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import { creatureKey, has, findSourced, sourceOf, T } from "./shared.mjs";

/**
 * My Little Pony Core Rulebook items: Fresh Mark, Natural Style (first time vs a specific creature)
 * and the Smoke Screen Magic Bauble.
 */

const mlp = id => `Compendium.essence20.mlp_crb.Item.${id}`;
export const MLP22 = {
  freshMark: mlp('LWCNfr3eEU2y9MyP'),
  naturalStyle: mlp('IgjtNiGBXQinE1GO'),
  smokeScreen: mlp('Sm0keScr33nD22aB'),
};

const DECEIVED_FLAG = 'd22Deceived';
const MET_FLAG = 'd22Met';

const isSocial = (skill, essence) => essence == 'social' || CONFIG.E20?.skillToEssence?.[skill] == 'social';

/* -------------------------------------------- */
/*  Fresh Mark / Natural Style                   */
/* -------------------------------------------- */

/**
 * Fresh Mark (MLP CRB, Influence Perk, p.54): "You gain Edge on Deception Skill Tests the first time
 * you target a specific creature." Natural Style (p.62): "When meeting any creature for the first
 * time you gain ↑1 on any Social Essence Skill Test you make involving them for that scene." The
 * first social test against a creature is when they "meet"; the ↑1 then holds for that scene only.
 */
export function mlpRollSources(actor, target, { rolledSkill, rolledEssence } = {}) {
  const sources = [];
  const key = creatureKey(target);
  if (!key) {
    return { sources, consumes: [] };
  }

  if (rolledSkill == 'deception' && has(actor, MLP22.freshMark)) {
    const deceived = actor.flags?.essence20?.[DECEIVED_FLAG] ?? [];
    if (!deceived.includes(key)) {
      sources.push({ id: 'd22FreshMark', label: findSourced(actor, MLP22.freshMark)?.name ?? 'Fresh Mark', edge: true });
    }
  }

  if (isSocial(rolledSkill, rolledEssence) && has(actor, MLP22.naturalStyle)) {
    const met = actor.flags?.essence20?.[MET_FLAG]?.[key];
    if (met == null || met == getSceneEpoch()) {
      sources.push({ id: 'd22NaturalStyle', label: findSourced(actor, MLP22.naturalStyle)?.name ?? 'Natural Style', shiftUp: 1 });
    }
  }

  return { sources, consumes: [] };
}

/** After the roll: remember who has now been deceived / met. */
export async function mlpPostRoll(actor, results, checkContext, { hits = [] } = {}) {
  const skill = checkContext?.riderContext?.skill ?? null;
  const keys = hits.map(h => creatureKey(h.target)).filter(Boolean);
  if (!keys.length || !skill) {
    return;
  }

  if (skill == 'deception' && has(actor, MLP22.freshMark)) {
    const deceived = actor.flags?.essence20?.[DECEIVED_FLAG] ?? [];
    const next = [...new Set([...deceived, ...keys])];
    if (next.length != deceived.length) {
      await actor.setFlag('essence20', DECEIVED_FLAG, next);
    }
  }

  if (isSocial(skill) && has(actor, MLP22.naturalStyle)) {
    const met = { ...(actor.flags?.essence20?.[MET_FLAG] ?? {}) };
    const fresh = keys.filter(key => met[key] == null);
    if (fresh.length) {
      for (const key of fresh) {
        met[key] = getSceneEpoch();
      }

      await actor.setFlag('essence20', MET_FLAG, met);
    }
  }
}

registerRollSources((actor, target, ctx) => mlpRollSources(actor, target, ctx));
registerPostRoll((actor, results, checkContext, extra) => mlpPostRoll(actor, results, checkContext, extra));

/* -------------------------------------------- */
/*  Smoke Screen                                 */
/* -------------------------------------------- */

const SMOKE_RADIUS = 20;

/** Tokens whose centre is within `radius` feet of the point. */
export function tokensWithin(point, radius) {
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  return tokens.filter(token => token?.actor && token.center
    && canvas.grid.measurePath([point, token.center]).distance <= radius);
}

/**
 * Smoke Screen (MLP CRB, Magic Bauble, p.143): "d4, 1 round, 20ft radius. When this smoke bomb is
 * set off, everyone in the area of effect gains the condition Blinded for 1 round." No Skill Test -
 * a Standard action, a point on the canvas, and every creature within 20 feet is Blinded for a round.
 * The bauble is used up.
 */
export async function setOffSmokeScreen(item, economy, pay) {
  const actor = item.parent;
  if (!(await pay('standard'))) {
    return null;
  }

  const { pickCanvasPoint } = await import("../../forced-movement.mjs");
  const point = await pickCanvasPoint(T('D22SmokeScreenPick'));
  if (!point) {
    return null;
  }

  const { applyTimedCondition } = await import("../../timed-status.mjs");
  const blinded = [];
  for (const token of tokensWithin(point, SMOKE_RADIUS)) {
    try {
      // Targeting them is what lets the GM carry the write for a player (helpers/gm-relay.mjs).
      token.setTarget?.(true, { releaseOthers: false, groupSelection: true });
      await applyTimedCondition(token.actor, 'blinded', 1);
    } catch (error) {
      // A player can't set the duration on someone else's effect - the Condition still landed.
    }

    blinded.push(token.name ?? token.actor.name);
  }

  const quantity = Number(item.system?.quantity ?? 1);
  await item.update({ 'system.quantity': Math.max(0, quantity - 1) });
  return T('D22SmokeScreenUsed', { name: actor.name, item: item.name, targets: blinded.join(', ') || '-' });
}

registerUse({
  id: 'd22SmokeScreen',
  matches: item => sourceOf(item) == MLP22.smokeScreen,
  canUse: item => Number(item.system?.quantity ?? 1) > 0,
  run: (item, economy, pay) => setOffSmokeScreen(item, economy, pay),
});
