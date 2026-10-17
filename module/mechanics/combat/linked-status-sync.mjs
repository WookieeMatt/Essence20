/**
 * Statuses kept in step with related ones: Asleep/Unconscious turn on a real Blinded, Restrained a real Immobilized.
 */

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

  const shouldBeBlind = actor.statuses?.has('asleep') || actor.statuses?.has('unconscious') || false;
  const blindEffect = actor.effects.find(effect => effect.statuses?.has('blinded'));
  const isAutoBlind = !!blindEffect?.getFlag('essence20', 'autoBlindFromSleep');

  if (shouldBeBlind && !blindEffect) {
    const effectData = await ActiveEffect.implementation.fromStatusEffect('blinded');
    effectData.updateSource({ "flags.essence20.autoBlindFromSleep": true });
    await actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
  } else if (!shouldBeBlind && isAutoBlind) {
    await blindEffect.delete();
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

  const shouldBeImmobilized = actor.statuses?.has('restrained') || false;
  const immobilizedEffect = actor.effects.find(effect => effect.statuses?.has('immobilized'));
  const isAutoImmobilized = !!immobilizedEffect?.getFlag('essence20', 'autoImmobilizedFromRestrained');

  if (shouldBeImmobilized && !immobilizedEffect) {
    const effectData = await ActiveEffect.implementation.fromStatusEffect('immobilized');
    effectData.updateSource({ "flags.essence20.autoImmobilizedFromRestrained": true });
    await actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
  } else if (!shouldBeImmobilized && isAutoImmobilized) {
    await immobilizedEffect.delete();
  }
}
