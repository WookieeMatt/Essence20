import { rulesOf } from "../../index.mjs";
import { stampFor } from "../../expiry.mjs";
import { epochFor } from "../../../helpers/scene-clock.mjs";
import { getProperty, itemsOf, listOf, worldActors } from "./common.mjs";

/**
 * Old holder-side memories moved into per-setter marks (round 10, group E). A `mark` step with `perSetter` may say
 * where an older version of its item kept the creatures it had dealt with:
 *   legacy: "flags.essence20.d22Deceived"   a list of creature keys (a token id for an unlinked token, else the actor id)
 *   legacy: "flags.essence20.d22Met"        or a {key: scene counter} map - every key
 *   legacyScene: true                       only the keys stamped with the current scene counter
 * Once, on the active GM's client at start-up, each such creature gets that mark from the holder (never over a mark
 * already there), with the step's own `until`; the holder is stamped (flags.essence20.legacyMarks.<item id>-<key>) so
 * it never runs twice. Fresh Mark / Natural Style.
 */

/** Every mark step of an item's rules that carries a `legacy` path, nested ones too. */
export function legacyMarkSteps(item) {
  const found = [];
  const visit = steps => {
    for (const step of Array.isArray(steps) ? steps : []) {
      if (step?.do == 'mark' && step.perSetter && step.key && typeof step.legacy == 'string') {
        found.push(step);
      }

      for (const nested of [step?.steps, step?.then, step?.onSuccess, step?.onFail, step?.onCrit, step?.onHit, step?.onMiss,
        ...(Array.isArray(step?.options) ? step.options.map(o => o?.steps) : [])]) {
        visit(nested);
      }
    }
  };

  for (const rule of rulesOf(item)) {
    visit(rule?.steps);
  }

  return found;
}

/** The creature a stored key names: a world actor, else a token (any scene) with that id. */
export function creatureFor(key) {
  const actor = globalThis.game?.actors?.get?.(key);
  if (actor) {
    return actor;
  }

  for (const scene of listOf(globalThis.game?.scenes)) {
    const token = scene.tokens?.get?.(key);
    if (token?.actor) {
      return token.actor;
    }
  }

  return null;
}

/** The creature keys an old memory holds (a list, or a map's keys - this scene's only with legacyScene). */
export function legacyKeys(value, onlyThisScene = false) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (value && typeof value == 'object') {
    return Object.entries(value).filter(([, stamp]) => !onlyThisScene || stamp == epochFor('scene')).map(([key]) => key);
  }

  return [];
}

/**
 * The writes moving one holder's old memories into marks: [{doc, update}] (marks on creatures, then the stamp on the
 * holder). Nothing for a holder already stamped.
 */
export function legacyMarkMoves(holder) {
  const moves = [];
  const stamps = {};
  for (const item of itemsOf(holder)) {
    for (const step of legacyMarkSteps(item)) {
      const done = `${item.id}-${step.key}`;
      if (holder.flags?.essence20?.legacyMarks?.[done] || stamps[`flags.essence20.legacyMarks.${done}`]) {
        continue;
      }

      stamps[`flags.essence20.legacyMarks.${done}`] = true;
      const markKey = `${step.key}--${holder.id}`;
      for (const key of legacyKeys(getProperty(holder, step.legacy), !!step.legacyScene)) {
        const creature = creatureFor(key);
        if (!creature || creature.flags?.essence20?.ruleMarks?.[markKey]) {
          continue;
        }

        const mark = { by: holder.uuid, until: step.until ?? null, stamp: step.until ? stampFor(step.until, undefined, holder) : null };
        moves.push({ doc: creature, update: { [`flags.essence20.ruleMarks.${markKey}`]: mark } });
      }
    }
  }

  if (Object.keys(stamps).length) {
    moves.push({ doc: holder, update: stamps });
  }

  return moves;
}

/** Run the move for every world actor (the active GM, once at start-up). */
export async function moveLegacyMarks() {
  for (const holder of worldActors()) {
    for (const { doc, update } of legacyMarkMoves(holder)) {
      await doc.update(update);
    }
  }
}

export function installLegacy() {
  globalThis.Hooks?.once?.('ready', () => {
    if (globalThis.game?.users?.activeGM?.isSelf) {
      moveLegacyMarks().catch(error => console.error('Essence20 | legacy marks failed', error));
    }
  });
}
