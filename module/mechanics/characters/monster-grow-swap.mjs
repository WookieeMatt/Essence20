/**
 * Swaps a placed Token between a Threat's Normal and Grown forms. Phase 7 of
 * docs/STAT_BLOCK_IMPORTER_PLAN.md, mode B - the in-combat half of "Make My Monster Grow".
 *
 * The two forms are separate Actors cross-linked by the flags the Grow dialog writes
 * (`grownFormId` on the Normal form, `normalFormId` on the Grown one - see
 * apps/monster-grow-dialog.mjs).
 *
 * **Everything below was established by a live spike in Foundry v14.364**, because repointing a
 * TokenDocument at a different Actor interacts with ActorDelta in ways not worth guessing at:
 *
 *  1. `TokenDocument#update({actorId})` works directly on an unlinked token. No delete-and-recreate
 *     is needed, and the whole swap fits in ONE atomic update - so there is no frame where the
 *     token is half-swapped.
 *  2. The ActorDelta is **merged, not replaced**. Passing an empty `delta` does not clear it, so
 *     carried-over state is written explicitly (`delta.system.health.value`) rather than by
 *     hoping whatever is already in the delta happens to be right.
 *  3. Token dimensions do **not** follow. Essence20Actor#_preUpdate resizes tokens when an actor's
 *     own `system.size` changes; here the actor does not change, the token is repointed at a
 *     different one - so width/height must be set from the target's Size explicitly.
 *  4. A Combatant survives the swap and its `.actor` resolves through the token correctly, but its
 *     own `actorId` goes stale, which silently breaks `Combat#getCombatantsByActor` (verified: 0
 *     matches before updating it, 1 after). So the Combatant is updated too.
 */

/** Health carry-over modes. Both behaviours are canon - see `carryOverHealth`. */
export const HEALTH_MODES = {
  proportional: 'proportional',
  absolute: 'absolute',
  full: 'full',
};

/**
 * What the swapped token's Health should become.
 *
 * `proportional` keeps the same fraction of maximum, which is the sensible default for a monster
 * that grows mid-fight: a Threat worn down to half stays at half rather than being handed a full
 * new health bar. `absolute` keeps the raw number (the shape Heximas's own stat block describes,
 * "carrying any damage suffered from his Grown size"). `full` heals to the new maximum.
 *
 * Never returns less than 1 for a form that was still standing, so growing can't kill a Threat.
 *
 * @param {Number} current   Health on the form being left.
 * @param {Number} oldMax
 * @param {Number} newMax    Health maximum of the form being swapped to.
 * @param {String} [mode]
 * @returns {Number}
 */
export function carryOverHealth(current, oldMax, newMax, mode = HEALTH_MODES.proportional) {
  if (!newMax || newMax <= 0) {
    return 0;
  }

  if (mode === HEALTH_MODES.full) {
    return newMax;
  }

  if (mode === HEALTH_MODES.absolute) {
    return Math.min(current, newMax);
  }

  if (!oldMax || oldMax <= 0) {
    return newMax;
  }

  const scaled = Math.round((current / oldMax) * newMax);
  return Math.min(newMax, current > 0 ? Math.max(1, scaled) : 0);
}

/**
 * The other form of a Threat, if the Grow dialog has linked one.
 * @param {Actor} actor
 * @returns {{id: String, direction: "grow"|"shrink"}|null}
 */
export function getLinkedForm(actor) {
  const grownId = actor?.getFlag?.('essence20', 'grownFormId');
  if (grownId) {
    return { id: grownId, direction: 'grow' };
  }

  const normalId = actor?.getFlag?.('essence20', 'normalFormId');
  if (normalId) {
    return { id: normalId, direction: 'shrink' };
  }

  return null;
}

/**
 * Which actors could be linked to `actor` as its other form.
 *
 * Needed because the two forms very often already exist separately: a printed sourcebook page
 * carries the Normal and Grown stat blocks one after the other, and the importer's own batch mode
 * creates both from a single paste - leaving two unlinked Actors that the swap cannot use until
 * someone says they belong together.
 *
 * Excludes the actor itself and anything already claimed as some *other* actor's form, so linking
 * can't silently steal a pairing. An actor already linked to THIS one is still listed, so the
 * current pairing shows as the selected option rather than vanishing.
 *
 * @param {Actor} actor
 * @param {Iterable<Actor>} actors   Usually game.actors.
 * @returns {Actor[]}
 */
export function getLinkCandidates(actor, actors) {
  const candidates = [];

  for (const candidate of actors ?? []) {
    if (!candidate || candidate.id === actor?.id || candidate.type !== actor?.type) {
      continue;
    }

    const link = getLinkedForm(candidate);
    if (link && link.id !== actor?.id) {
      continue;
    }

    candidates.push(candidate);
  }

  return candidates;
}

/**
 * Marks `grownActor` as the Grown form of `normalActor`, writing both sides of the pairing.
 *
 * Any pairing either actor was previously part of is cleared first, so an actor can never end up
 * claimed by two different partners - the stale half would otherwise keep pointing here and the
 * HUD would offer a swap that lands somewhere unexpected.
 *
 * @param {Actor} normalActor
 * @param {Actor} grownActor
 * @returns {Promise<Boolean>}   False if the pairing was refused (same actor, or missing).
 */
export async function linkGrownForm(normalActor, grownActor) {
  if (!normalActor || !grownActor || normalActor.id === grownActor.id) {
    return false;
  }

  await unlinkGrownForm(normalActor);
  await unlinkGrownForm(grownActor);

  await normalActor.setFlag('essence20', 'grownFormId', grownActor.id);
  await grownActor.setFlag('essence20', 'normalFormId', normalActor.id);
  return true;
}

/**
 * Clears a pairing from both sides, given either half of it.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether there was a pairing to clear.
 */
export async function unlinkGrownForm(actor) {
  const link = getLinkedForm(actor);
  if (!link) {
    return false;
  }

  const partner = game.actors.get(link.id);
  await actor.unsetFlag('essence20', 'grownFormId');
  await actor.unsetFlag('essence20', 'normalFormId');

  if (partner) {
    await partner.unsetFlag('essence20', 'grownFormId');
    await partner.unsetFlag('essence20', 'normalFormId');
  }

  return true;
}

/**
 * The single update payload that performs a swap - split out from `swapTokenForm` so the exact
 * shape can be unit-tested without a live Token.
 *
 * @param {Object} params
 * @param {String} params.actorId      The Actor to repoint at.
 * @param {String} params.name         The swapped token's new name.
 * @param {Object} params.tokenSize    {width, height} from CONFIG.E20.tokenSizes.
 * @param {Number|null} params.health  Health to write into the delta, or null to leave it.
 * @param {String|null} [params.texture]
 * @returns {Object}
 */
export function buildSwapUpdate({ actorId, name, tokenSize, health, texture = null }) {
  const update = {
    actorId,
    name,
    width: tokenSize.width,
    height: tokenSize.height,
  };

  if (health !== null && health !== undefined) {
    update['delta.system.health.value'] = health;
  }

  if (texture) {
    update['texture.src'] = texture;
  }

  return update;
}

/**
 * Swaps one placed token to the other form of its Threat.
 *
 * @param {TokenDocument} tokenDocument
 * @param {Object} [options]
 * @param {String} [options.healthMode]   One of HEALTH_MODES.
 * @param {Boolean} [options.keepName]    Keep the token's current name instead of taking the
 *   target form's. Useful for a renamed "Putty #3"-style token.
 * @returns {Promise<Actor|null>}   The form swapped to, or null if there was nothing to swap to.
 */
export async function swapTokenForm(tokenDocument, { healthMode, keepName = false } = {}) {
  const currentActor = tokenDocument?.actor;
  const link = getLinkedForm(currentActor);
  if (!link) {
    return null;
  }

  const target = game.actors.get(link.id);
  if (!target) {
    ui.notifications.warn(game.i18n.localize("E20.MonsterGrowMissingForm"));
    return null;
  }

  const mode = healthMode
    ?? game.settings.get('essence20', 'monsterGrowHealthMode')
    ?? HEALTH_MODES.proportional;

  const health = carryOverHealth(
    currentActor.system.health?.value ?? 0,
    currentActor.system.health?.max ?? 0,
    target.system.health?.max ?? 0,
    mode,
  );

  const tokenSize = CONFIG.E20.tokenSizes[target.system.size] ?? CONFIG.E20.tokenSizes.common;
  await tokenDocument.update(buildSwapUpdate({
    actorId: target.id,
    name: keepName ? tokenDocument.name : target.name,
    tokenSize,
    health,
    texture: target.prototypeToken?.texture?.src ?? null,
  }));

  // See finding 4 in this file's own doc comment - the Combatant's actorId would otherwise go
  // stale and drop the token out of getCombatantsByActor.
  for (const combat of game.combats) {
    const combatant = combat.combatants.find(entry => entry.tokenId === tokenDocument.id);
    if (combatant && combatant.actorId !== target.id) {
      await combatant.update({ actorId: target.id });
    }
  }

  return target;
}

/**
 * Whether a token can be swapped at all - drives whether the HUD button is offered.
 * @param {TokenDocument} tokenDocument
 * @returns {Boolean}
 */
export function canSwapTokenForm(tokenDocument) {
  return Boolean(getLinkedForm(tokenDocument?.actor));
}
