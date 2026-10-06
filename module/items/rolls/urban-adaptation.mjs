import {
  registerRest, registerRollSources, registerSpecializes, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import {
  ignoreRoughTerrainWhen, isAttackItem, S1, terrainOf,
} from "../shared/terrain-perk-ids-and-readers.mjs";
import { T } from "../shared/item-lang.mjs";
import { findSourced, has, sourceOf } from "../shared/item-lookups.mjs";

/**
 * Urban Adaptation (Cobra Codex, Citystriker, 10th level, p.68): "you gain a pool of Adaptation
 * Points equal to a Ranger of half your level (rounded up). As a Free action, you can spend an
 * Adaptation Point to use one of your Urban Jungle abilities outside of a city for the remainder of
 * the scene. Adaptation Points replenish after a night's rest."
 *
 * The Ranger's pool (GI Joe CRB p.91, the Adaptation Points role-points item) starts at 0 and gains
 * 1 at levels 2, 4, 7, 10, 13, 16 and 19. The Urban Jungle abilities are its Edge, Specialized attacks and
 * ignoring Rough Terrain (rough-terrain.mjs ROUGH_TERRAIN_IGNORERS).
 */

const FLAG = {
  urbanAdaptation: 's1UrbanAdaptation',
  urbanAdaptationPoints: 's1UrbanAdaptationSpent',
};

const cap = key => String(key).charAt(0).toUpperCase() + String(key).slice(1);

const RANGER_ADAPTATION_LEVELS = [2, 4, 7, 10, 13, 16, 19];
export function urbanAdaptationMax(actor) {
  const level = Math.ceil((Number(actor?.system?.level) || 0) / 2);
  return RANGER_ADAPTATION_LEVELS.filter(at => at <= level).length;
}

export function urbanAdaptationLeft(actor) {
  return Math.max(0, urbanAdaptationMax(actor) - (Number(actor?.getFlag?.('essence20', FLAG.urbanAdaptationPoints)) || 0));
}

/** The Urban Jungle abilities bought outside a city this scene: 'edge' | 'specialized' | 'roughTerrain'. */
export function urbanAdaptationAbilities(actor) {
  if (!has(actor, S1.urbanAdaptation) || terrainOf(actor) == 'urban') {
    return [];
  }

  const record = actor.getFlag?.('essence20', FLAG.urbanAdaptation);
  return record && record.epoch == getSceneEpoch() ? (record.abilities ?? []) : [];
}

/** The ↑/↓ that moves a roll from one skill's die to another's (the Urban Jungle substitution). */
export function skillSwapDelta(actor, fromSkill, toSkill) {
  const list = CONFIG.E20?.skillShiftList ?? [];
  const from = list.indexOf(actor?.system?.skills?.[fromSkill]?.shift);
  const to = list.indexOf(actor?.system?.skills?.[toSkill]?.shift);
  return from >= 0 && to >= 0 ? from - to : 0;
}

/* -------------------------------------------- */
/*  The bought abilities                         */
/* -------------------------------------------- */

/** The Urban Jungle Edge bought for this scene outside a city. */
export function urbanAdaptationRollSources(actor, target, ctx = {}) {
  const { item } = ctx;
  const isAttack = ctx.isAttack ?? isAttackItem(item);
  const sources = [];
  if (!actor) {
    return { sources, consumes: [] };
  }

  if (!isAttack && urbanAdaptationAbilities(actor).includes('edge')) {
    sources.push({ id: 's1-urbanAdaptation', label: findSourced(actor, S1.urbanAdaptation)?.name ?? S1.urbanAdaptation, edge: true });
  }

  return { sources: sources.map(s => ({ shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...s })), consumes: [] };
}

export function urbanAdaptationSpecializes(actor, skill, item) {
  return isAttackItem(item) && urbanAdaptationAbilities(actor).includes('specialized');
}

/** ROUGH_TERRAIN_IGNORERS entry. */
export function urbanAdaptationIgnoresRoughTerrain(actor) {
  return urbanAdaptationAbilities(actor).includes('roughTerrain');
}

/* -------------------------------------------- */
/*  Use button and rest                          */
/* -------------------------------------------- */

/** Spend a point (Free action), pick which Urban Jungle ability to take out of the city for the rest of the scene. */
export const URBAN_ADAPTATION_USE = {
  id: 's1-urbanAdaptation',
  matches: item => sourceOf(item) == S1.urbanAdaptation,
  canUse: item => urbanAdaptationLeft(item.parent) > 0,
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const { chooseButtons } = await import("../../mechanics/resources/grants.mjs");
    const record = actor.getFlag('essence20', FLAG.urbanAdaptation);
    const owned = record?.epoch == getSceneEpoch() ? (record.abilities ?? []) : [];
    const choices = ['edge', 'specialized', 'roughTerrain'].filter(key => !owned.includes(key))
      .map(key => [key, T(`S1UrbanAbility${cap(key)}`)]);
    const ability = choices.length ? await chooseButtons(item.name, T('S1UrbanAdaptationPrompt'), choices) : null;
    if (!ability || !(await pay('free'))) {
      return null;
    }

    await actor.setFlag('essence20', FLAG.urbanAdaptation, { epoch: getSceneEpoch(), abilities: [...owned, ability] });
    await actor.setFlag('essence20', FLAG.urbanAdaptationPoints, (Number(actor.getFlag('essence20', FLAG.urbanAdaptationPoints)) || 0) + 1);
    return T('S1UrbanAdaptationUsed', { actor: actor.name, ability: T(`S1UrbanAbility${cap(ability)}`), left: urbanAdaptationLeft(actor) });
  },
};

export async function urbanAdaptationRest(actor) {
  if (actor?.flags?.essence20?.[FLAG.urbanAdaptationPoints]) {
    await actor.unsetFlag('essence20', FLAG.urbanAdaptationPoints);
  }
}

registerRollSources(urbanAdaptationRollSources);
registerSpecializes(urbanAdaptationSpecializes);
registerRest(urbanAdaptationRest);
registerUse(URBAN_ADAPTATION_USE);
ignoreRoughTerrainWhen(urbanAdaptationIgnoresRoughTerrain);
