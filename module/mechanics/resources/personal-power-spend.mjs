/**
 * The Personal Power choke point: every write to system.powers.personal.value, wherever it comes
 * from (the Power sheet cost, Perk costs, Rest, the sidebar), passes through the actor update
 * hooks, so this is where "whenever you spend / regain Personal Power" rules live.
 *
 * - A decrease is a spend, unless the writer marks it `{essence20Loss: true}` (Power drained by an
 *   enemy, Body of Energy's damage) or `{essence20Refund: true}` (this file's own refunds).
 * - An increase is regaining Power.
 *
 * Item code joins it with registerBeforePowerWrite (may adjust the write - Void Warrior's no-regain,
 * items/resources/void-warrior-regain-block.mjs) and registerAfterPowerWrite (on the writing client - Body of
 * Energy's split on leaving Morph, items/resources/body-of-energy.mjs).
 *
 * Inner Conservation, Power Efficiency (Through the Shattered Grid) and Dino Charged (Beneath the
 * Helmet) are their items' own resourceSpent Trigger rules.
 */
import { changed } from "../../items/shared/resource-team-lookups.mjs";
import { onHook } from "../../items/shared/hooks-and-clients.mjs";
import { num } from "../../items/shared/numbers.mjs";

export const POWER = 'system.powers.personal.value';

const BEFORE_WRITE = [];
const AFTER_WRITE = [];

/** fn(actor, changes, prev, next, userId) before a Power or Morph write, once `prev` ({power, health, morphed}) is recorded. */
export const registerBeforePowerWrite = fn => BEFORE_WRITE.push(fn);

/** fn(actor, changes, prev) after that write, on the client that made it. */
export const registerAfterPowerWrite = fn => AFTER_WRITE.push(fn);

/* -------------------------------------------- */
/*  Before the write                             */
/* -------------------------------------------- */

onHook('preUpdateActor', (actor, changes, options, userId) => {
  const next = changed(changes, POWER);
  const nextMorph = changed(changes, 'system.isMorphed');
  if (next === undefined && nextMorph === undefined) {
    return;
  }

  options.essence20Prev = {
    power: num(actor.system?.powers?.personal?.value),
    health: num(actor.system?.health?.value),
    morphed: !!actor.system?.isMorphed,
  };

  for (const fn of BEFORE_WRITE) {
    fn(actor, changes, options.essence20Prev, next, userId);
  }
});

/* -------------------------------------------- */
/*  After the write                              */
/* -------------------------------------------- */

onHook('updateActor', (actor, changes, options, userId) => {
  if (userId != game.user?.id || !options?.essence20Prev) {
    return;
  }

  for (const fn of AFTER_WRITE) {
    fn(actor, changes, options.essence20Prev);
  }
});
