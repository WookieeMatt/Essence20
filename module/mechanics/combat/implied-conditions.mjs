import { registerAfterDamage, registerDerived } from "../item-hooks.mjs";
import { T, post } from "../../items/shared/cobra-codex-item-lookups.mjs";

/**
 * Asleep and Defeated (GI Joe CRB, Conditions, p.225): "Sleeping characters are Prone and
 * Unconscious. They can be awoken with loud noise, an action, or by taking damage." / "Defeated
 * characters are Prone."
 *
 * Both are defined by other Conditions, so the implied ones are added to the actor's live status
 * set in derived data - every `statuses.has('prone')` / `has('unconscious')` check in the system
 * (the attacker's Edge, a prone attacker's melee Snag, Obscuring Matrix, the action budget...) then
 * sees them without each check having to list Asleep and Defeated as well. Nothing is written to
 * the actor, so waking up or recovering takes the implied Conditions away with it.
 */
export const IMPLIED = {
  asleep: ['prone', 'unconscious'],
  defeated: ['prone'],
};

export function addImpliedStatuses(actor) {
  const statuses = actor?.statuses;
  if (!statuses?.has || !statuses.add) {
    return;
  }

  for (const [status, implied] of Object.entries(IMPLIED)) {
    if (statuses.has(status)) {
      implied.forEach(id => statuses.add(id));
    }
  }
}

registerDerived(addImpliedStatuses);

// "...or by taking damage." Any damage that actually lands wakes the sleeper.
export async function wakeOnDamage(actor, dealt) {
  if (!(Number(dealt) > 0) || !actor?.effects) {
    return false;
  }

  const sleeping = [...actor.effects].some(effect => effect.statuses?.has?.('asleep'));
  if (!sleeping) {
    return false;
  }

  await actor.toggleStatusEffect('asleep', { active: false });
  await post(actor, T('G1WokeUp', { name: actor.name }));
  return true;
}

registerAfterDamage((actor, dealt) => wakeOnDamage(actor, dealt));
