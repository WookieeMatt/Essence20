/**
 * Statuses kept in step with related ones: Asleep/Unconscious turn on a real Blinded, Restrained a real Immobilized.
 */

/**
 * The one client that keeps linked statuses in step: the active GM, or with no GM on, whoever made the change. Every
 * client hears the ActiveEffect hooks, and each used to add its own Blinded, so a Defeated PC in a full game got one
 * per connected user.
 * @param {string} userId The user whose change fired the hook.
 * @returns {boolean}
 */
export function isLinkedStatusClient(userId) {
  const g = globalThis.game;
  const activeGM = g?.users?.activeGM;
  return activeGM ? activeGM.id == g.user?.id : userId == g?.user?.id;
}

// One sync at a time per actor and status: Defeated adds several statuses at once, and each fired a sync that saw no
// Blinded yet (the first one's create hadn't landed) and added another.
const pending = new Map();

/**
 * Runs fn after any sync already queued for the same key, so each sees the last one's result.
 * @param {string} key
 * @param {Function} fn
 * @returns {Promise}
 */
function queued(key, fn) {
  const run = (pending.get(key) ?? Promise.resolve()).then(fn, fn);
  const settled = run.catch(error => console.error('Essence20 | Linked status sync', error));
  pending.set(key, settled);
  settled.then(() => pending.get(key) === settled && pending.delete(key));
  return settled;
}

/**
 * Keeps one auto-applied `status` effect on the actor while `wanted` holds, and none (of its own) after.
 * @param {Actor} actor
 * @param {string} status The status to apply.
 * @param {string} flag The flags.essence20 marker telling an auto-applied effect from one set by hand.
 * @param {Function} wanted actor => whether the status should be on.
 * @returns {Promise}
 */
function syncLinkedStatus(actor, status, flag, wanted) {
  return queued(`${status}:${actor.uuid ?? actor.id ?? ''}`, async () => {
    const effects = (actor.effects?.contents ?? [...(actor.effects ?? [])]).filter(effect => effect.statuses?.has(status));
    const auto = effects.filter(effect => effect.getFlag?.('essence20', flag));

    if (wanted(actor)) {
      if (!effects.length) {
        const effectData = await ActiveEffect.implementation.fromStatusEffect(status);
        effectData.updateSource({ [`flags.essence20.${flag}`]: true });
        await actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
        return;
      }

      // Copies left over from before this ran one at a time.
      const extras = auto.length == effects.length ? auto.slice(1) : auto;
      for (const effect of extras) {
        await effect.delete();
      }
    } else {
      for (const effect of auto) {
        await effect.delete();
      }
    }
  });
}

/**
 * Asleep/Unconscious have no Foundry-native equivalent to Blinded's CONFIG.specialStatusEffects.BLIND
 * wiring (see essence20.mjs), but closed eyes should black out vision exactly the same way. Rather
 * than reinventing that (sight.enabled=false alone doesn't work - see ../world/token-sync.mjs#applyVisionToTokens),
 * this keeps the actor's real "blinded" status effect in sync with whether it's Asleep or
 * Unconscious, so Foundry's own already-working Blind handling takes care of vision for us.
 *
 * A flags.essence20.autoBlindFromSleep marker distinguishes an auto-applied Blinded from one the
 * GM/player toggled on manually for some other reason, so waking up never strips a manually-applied
 * Blinded, and a manually-applied Blinded is left alone (not removed) if the actor separately falls
 * asleep and wakes while it's active.
 * @param {Actor} actor The actor whose auto-blind status should be synced
 */
export async function syncAutoBlindStatus(actor) {
  if (!actor) return;

  await syncLinkedStatus(actor, 'blinded', 'autoBlindFromSleep',
    a => isAutoBlindEnabled() && (a.statuses?.has('asleep') || a.statuses?.has('unconscious') || false));
}

/** The world setting name; off, a sleeper keeps their sight (tables streaming a player's view asked for it). */
export const AUTO_BLIND_SETTING = 'autoBlindWhenUnconscious';

/** Whether Asleep/Unconscious turn Blinded on. On unless the GM turned it off. */
export function isAutoBlindEnabled() {
  try {
    return globalThis.game?.settings?.get('essence20', AUTO_BLIND_SETTING) !== false;
  } catch {
    // Not registered yet (early load, tests): the default.
    return true;
  }
}

/**
 * Re-checks every actor's auto Blinded after the setting changes: off strips the auto copies, on gives one to everyone
 * already asleep or out cold. World actors plus each scene's unlinked token actors, which have effects of their own.
 * @returns {Promise}
 */
export async function resyncAutoBlindEverywhere() {
  const g = globalThis.game;
  if (!g?.user?.isActiveGM) return;

  const actors = [...(g.actors ?? [])];
  for (const scene of g.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (!token.actorLink && token.actor) actors.push(token.actor);
    }
  }

  for (const actor of actors) {
    await syncAutoBlindStatus(actor);
  }
}

/**
 * Restrained (GI Joe CRB, Conditions, p.226): "In addition to the effects of Immobilized..." -
 * Restrained is written as a strict superset of Immobilized, but nothing actually turned the real
 * "immobilized" status on for a Restrained actor, so its Movement 0 / +1 shift never applied. Same
 * "sync a real status from a related one" shape as syncAutoBlindStatus() above (Asleep/Unconscious
 * -> Blinded), just Restrained -> Immobilized instead, and the same autoImmobilizedFromRestrained
 * flag distinguishes an auto-applied Immobilized from one toggled on manually for some other
 * reason, so a Restrained actor losing the condition never strips a manually-applied Immobilized.
 * @param {Actor} actor The actor whose auto-immobilized status should be synced
 */
export async function syncAutoImmobilizedStatus(actor) {
  if (!actor) return;

  await syncLinkedStatus(actor, 'immobilized', 'autoImmobilizedFromRestrained',
    a => a.statuses?.has('restrained') || false);
}
