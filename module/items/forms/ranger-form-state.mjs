/**
 * Which Form General Perk is active (see forms.mjs) - no imports, so dice.mjs and the rest can ask
 * without pulling the Form engine in.
 */
export const FORM_FLAG = 'zord1Form';

export function activeForm(actor) {
  const state = actor?.flags?.essence20?.[FORM_FLAG];
  return state?.uuid ? state : null;
}

/** Whether this Form is the one currently active - and the actor is Morphed. */
export function isFormActive(actor, uuid) {
  return !!actor?.system?.isMorphed && !!uuid && activeForm(actor)?.uuid == uuid;
}
