/**
 * Tear Down (Cobra Codex, Taskmaster Focus, 3rd level, p.59): "When you make an attack, you can
 * first make an Intimidation Skill Test as a Free action against your target as you describe the
 * pain or debilitating effect your attack will have on them. If both your attack and Intimidation
 * Skill Test succeed, your attack deals 1 Psychic Damage in addition to its normal effects."
 *
 * Same Growl-shaped "trigger a real dialog roll via actor._dice.rollSkill()" idiom
 * helpers/growl.mjs already establishes for a Free-action Intimidation Skill Test against a
 * target, banking a pending self-bonus scoped to that one target - Willpower Defense (RAW names
 * none, same default Growl's own identical gap already uses). Unlike Growl's own repeatable-per-
 * turn shiftUp, this is consumed by the single very next attack against that target (no once-per-
 * turn gate needed - "your attack," singular), and the bonus damage drops the "Psychic" type
 * distinction the same way Position of Power's own identical flat-bonus-damage precedent already
 * does (this project's damageBonusValue pipeline adds a flat number on top of the attack's own
 * damage type, not a second damage type).
 */
export const TEAR_DOWN_ID = "Compendium.essence20.cobra_codex.Item.ZrJG5EJVVZWcP8fo";
const TEAR_DOWN_FLAG = 'tearDownTargetUuid';

/**
 * Whether targetActor is the one the actor's Tear Down bonus is currently pending against.
 * @param {Actor} actor
 * @param {Actor} targetActor
 * @returns {Boolean}
 */
export function isTearDownPending(actor, targetActor) {
  const pendingUuid = actor?.getFlag?.('essence20', TEAR_DOWN_FLAG);
  return !!pendingUuid && !!targetActor?.uuid && pendingUuid == targetActor.uuid;
}

/**
 * Banks the bonus against a successfully-Intimidated target.
 * @param {Actor} actor
 * @param {Actor} targetActor
 * @returns {Promise<void>}
 */
export async function markTearDownPending(actor, targetActor) {
  if (!targetActor?.uuid) {
    return;
  }

  await actor.setFlag('essence20', TEAR_DOWN_FLAG, targetActor.uuid);
}

/**
 * Clears the pending bonus - called once the following attack is actually made, hit or not,
 * since RAW's Free-action Intimidation Skill Test is spent per attack attempt either way.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function clearTearDownPending(actor) {
  await actor.unsetFlag('essence20', TEAR_DOWN_FLAG);
}

/**
 * Attempts the Free-action Intimidation Skill Test against the currently-targeted token.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function activateTearDown(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.TearDownNoTarget'));
    return;
  }

  await actor._dice.rollSkill({
    skill: 'intimidation',
    essence: 'strength',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'willpower',
    isTearDown: true,
  }, actor);
}
