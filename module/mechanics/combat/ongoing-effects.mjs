import { applyDamage } from "./combat.mjs";

/**
 * Ongoing / Poison / Toxin (Cobra Codex, New Weapon Effects and Traits, p.93-94; Field Guide and
 * others echo the same rule): a successful Ongoing attack hits again at the end of each of the target's
 * turns for the listed time or until treated - a Condition simply lasts that long, damage recurs
 * each round. Poison and Toxin both carry this same repeating half on top of their
 * own narrative-only "causes the Poisoned Condition" clause - per explicit user direction, this
 * project has no Poisoned status of its own, so only the repeating-DAMAGE half is built here; the
 * Condition half stays exactly as narrative as it always was.
 *
 * A pending effect is a plain object stored in a LIST on the TARGET (not the attacker - "affects
 * the target again... at the end of their turn" is the victim's own turn boundary, not the
 * attacker's), because more than one Ongoing source can be stacked on the same creature (a second
 * poisoned hit shouldn't silently overwrite the first). Ticked from essence20.mjs's own combatTurn/
 * combatRound hook loop, the SAME "endingActor" (whoever's turn is ending) this project already
 * uses for Regenerating Shell/Rush the Line/Frictionless Movement - here that endingActor is
 * sometimes the AFFECTED creature itself, which is exactly the "end of their turn" RAW asks for.
 *
 * "For the listed amount of time" is a per-weapon round count with no dedicated schema field
 * before now (compendium items only ever carry the bare 'ongoing'/'poison'/'toxin' trait string) -
 * see weapon.mjs#ongoingDuration's own comment for the added field and its default.
 *
 * "Until treated" - ending it early - is treatOngoingEffect below; nothing in this codebase models
 * an actual "Treat" Skill Test action yet, so this is exposed as a plain sheet control (the header
 * badge, see templates/actor/headers/common.hbs) rather than gated behind one.
 */
const PENDING_ONGOING_FLAG = 'pendingOngoingEffects';

/**
 * @param {Actor} actor
 * @returns {Array<Object>}   Each entry: {damageValue, damageType, roundsRemaining, sourceName}.
 */
export function getOngoingEffects(actor) {
  return actor?.getFlag?.('essence20', PENDING_ONGOING_FLAG) ?? [];
}

/**
 * Stacks a new pending Ongoing effect onto the target - does not merge with an existing one from
 * the same source, matching RAW's own Stun-stacking precedent ("Stun effects stack") for repeating
 * effects in general.
 * @param {Actor} targetActor
 * @param {Object} effect
 * @param {Number} effect.damageValue
 * @param {String} effect.damageType
 * @param {Number} effect.roundsRemaining
 * @param {String} effect.sourceName   The weapon's own name, for the sheet list/chat line.
 */
export async function addOngoingEffect(targetActor, { damageValue, damageType, roundsRemaining, sourceName }) {
  if (!targetActor || !roundsRemaining) {
    return;
  }

  const effects = getOngoingEffects(targetActor);
  effects.push({ damageValue, damageType, roundsRemaining, sourceName });
  await targetActor.setFlag('essence20', PENDING_ONGOING_FLAG, effects);
}

/**
 * Ticks every pending Ongoing effect on this actor down by one round, applying its damage (if it
 * has any - a Condition-only effect, e.g. Compound Z's own damageValue 0, has nothing to apply
 * here, matching RAW's own "if the effect is a type of damage" conditional) and dropping any entry
 * that has just run out. Called for whoever's turn is ENDING - see this file's own doc comment.
 * @param {Actor} actor
 */
export async function applyOngoingEffectsAtTurnEnd(actor) {
  const effects = getOngoingEffects(actor);
  if (!effects.length) {
    return;
  }

  const remaining = [];
  for (const effect of effects) {
    const roundsRemaining = effect.roundsRemaining - 1;
    if (effect.damageValue) {
      await applyDamage(actor, effect.damageValue, effect.damageType);
      // Same one-line chat record the environment hazards post, so the Health loss isn't silent.
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: game.i18n.format('E20.OngoingDamageChat', {
          name: actor.name,
          value: effect.damageValue,
          type: game.i18n.localize(CONFIG.E20.damageTypes?.[effect.damageType] ?? effect.damageType),
          source: effect.sourceName,
          rounds: Math.max(roundsRemaining, 0),
        }),
      });
    }

    if (roundsRemaining > 0) {
      remaining.push({ ...effect, roundsRemaining });
    }
  }

  await actor.setFlag('essence20', PENDING_ONGOING_FLAG, remaining);
}

/**
 * "Until treated" - clears one pending effect early, by its index in getOngoingEffects' own list.
 * @param {Actor} actor
 * @param {Number} index
 */
export async function treatOngoingEffect(actor, index) {
  const effects = getOngoingEffects(actor);
  if (index < 0 || index >= effects.length) {
    return;
  }

  effects.splice(index, 1);
  await actor.setFlag('essence20', PENDING_ONGOING_FLAG, effects);
}
