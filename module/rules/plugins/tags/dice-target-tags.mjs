import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { registerRecipient } from "../../steps.mjs";

/**
 * Round 15 (dice part): tags about the roll's target (the other party) that dice.mjs's hand-written Perks read.
 *
 *   target:statusFrom:<id>          the other party has that Condition, applied by this actor (the effect's
 *                                   flags.essence20.conditionSource - target-riders.mjs#hasConditionFrom; Worst Nightmare)
 *   target:resistsRolled            the other party resists the rolled attack's own damage type (system.resistances)
 *   target:immuneRolled             ...is immune to it (system.immunities) (Ninja Powered: Deep Wisdom)
 *   target:nearby:<ft>:<tags&tags>  another token within that range of the other party - not this actor's, not the
 *                                   other party's own - meets the tags, asked as the target (mechanics/combat/
 *                                   nearby-allies.mjs#getAllNearbyTokens; Gang Up's "another being on a Psycho Path")
 *   target:mostConditions           the other party has at least as many Conditions as any enemy token in the scene
 *                                   (nearby-enemies.mjs#getNearbyEnemyTokens, any range; Sadistic)
 *   holder:versusTarget:<self tag>  a self: tag asked of the rule's holder with the roll's target as the other party
 *                                   (a driver's Perk comparing its own size with the vehicle's target - Heavy Ordnance)
 *   to: nearestEnemies:<n>          (step recipient) the n enemy tokens nearest this actor, any range, nearest first
 *                                   (nearby-enemies.mjs#getNearbyEnemyTokens; Beam Volley's setTargets)
 *
 * The canvas helpers are loaded at `setup` (tests set `targetTagHelpers` directly); until then the canvas tags answer
 * false.
 */

export const targetTagHelpers = {
  getAllNearbyTokens: null,
  getNearbyEnemyTokens: null,
};

globalThis.Hooks?.once?.('setup', async () => {
  try {
    const [allies, enemies] = await Promise.all([
      import("../../../mechanics/combat/nearby-allies.mjs"),
      import("../../../mechanics/combat/nearby-enemies.mjs"),
    ]);
    targetTagHelpers.getAllNearbyTokens = allies.getAllNearbyTokens;
    targetTagHelpers.getNearbyEnemyTokens = enemies.getNearbyEnemyTokens;
  } catch (error) {
    console.error('Essence20 | round 15 target tags failed to load', error);
  }
});

const effectsOf = actor => actor?.effects?.contents ?? (actor?.effects ? [...actor.effects] : []);

registerTag('target:statusFrom', (rest, ctx) => {
  const other = ctx.other;
  if (!other) {
    return false;
  }

  return !!other.statuses?.has?.(rest) && effectsOf(other).some(effect => effect.statuses?.has?.(rest)
    && !!ctx.self?.uuid && effect.flags?.essence20?.conditionSource == ctx.self.uuid);
});

const rolledType = ctx => ctx.item?.system?.damageType ?? null;
registerTag('target:resistsRolled', (rest, ctx) => !!(ctx.other && rolledType(ctx) && ctx.other.system?.resistances?.[rolledType(ctx)]));
registerTag('target:immuneRolled', (rest, ctx) => !!(ctx.other && rolledType(ctx) && ctx.other.system?.immunities?.[rolledType(ctx)]));

registerTag('target:nearby', (rest, ctx) => {
  const match = /^(\d+):(.+)$/.exec(String(rest ?? ''));
  const other = ctx.other;
  if (!match || !other || !targetTagHelpers.getAllNearbyTokens) {
    return false;
  }

  const self = ctx.self;
  const tags = match[2].split('&').filter(Boolean);
  return targetTagHelpers.getAllNearbyTokens(other, Number(match[1])).some(token => {
    const actor = token?.actor;
    if (!actor || actor === other || actor === self || (self?.uuid && actor.uuid == self.uuid)) {
      return false;
    }

    return evaluate(tags, contextFor({ ...ctx, other: actor })) === true;
  });
});

registerTag('target:mostConditions', (rest, ctx) => {
  const other = ctx.other;
  if (!other || !ctx.self || !targetTagHelpers.getNearbyEnemyTokens) {
    return false;
  }

  const enemies = targetTagHelpers.getNearbyEnemyTokens(ctx.self, Infinity).map(token => token.actor).filter(Boolean);
  const most = Math.max(0, ...enemies.map(enemy => enemy.statuses?.size ?? 0));
  return (other.statuses?.size ?? 0) >= most;
});

// skill:roleSkill - the rolled Skill is one of the actor's base Role's Skills (actor._getBaseRole().system.skills - Genius).
registerTag('skill:roleSkill', (rest, ctx) => {
  if (!ctx.rolledSkill || !ctx.self) {
    return null;
  }

  const skills = ctx.self._getBaseRole?.()?.system?.skills;
  return Array.isArray(skills) && skills.includes(ctx.rolledSkill);
});

registerTag('holder:versusTarget', (rest, ctx) => {
  const holder = ctx.holder ?? ctx.self;
  if (!holder || !rest) {
    return null;
  }

  return evaluate([`self:${rest}`], contextFor({ ...ctx, self: holder, other: ctx.other ?? null }));
});

registerRecipient(/^nearestEnemies:(\d+)$/, (match, ctx) => {
  const actor = ctx.actor;
  const own = actor?.getActiveTokens?.()?.[0];
  const tokens = targetTagHelpers.getNearbyEnemyTokens?.(actor, Infinity) ?? [];
  const distance = token => globalThis.canvas.grid.measurePath([token.center, own.center]).distance;
  const sorted = own && globalThis.canvas?.grid?.measurePath ? [...tokens].sort((a, b) => distance(a) - distance(b)) : [...tokens];
  return [...new Set(sorted.slice(0, Number(match[1])).map(token => token.actor).filter(Boolean))];
});
