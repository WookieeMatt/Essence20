import { E20 } from "./config.mjs";
import { setAiming, setSprinting } from "./action-economy.mjs";
import { activateLendAssistance } from "./lend-assistance.mjs";
import { deactivateInvisibilityOnLendAssistance } from "./invisibility.mjs";

/**
 * What the rules' own combat actions actually DO.
 *
 * E20.namedActions gives each of them a name and a cost, and the Actions tab spends that cost -
 * but spending was all that happened: taking Defend charged a Standard action and then left the
 * player to remember, unaided, that everything attacking them this round is Snagged. This module
 * is the other half, and it is deliberately the ONLY place that knows what an action does, so the
 * sheet stays wiring.
 *
 * Only the actions whose printed effect is self-contained are here. The rest are listed in
 * NOT_AUTOMATED below with the reason, rather than half-implemented: an action that does the wrong
 * thing is worse than one that does nothing, because the player stops checking.
 *
 * Every handler runs AFTER the action's cost has been paid (see base-actor-sheet.mjs), so a
 * refused or unaffordable action never reaches one.
 */

/* Actions deliberately left as cost-only, and why. Kept here rather than in a commit message so
 * the next person to ask "why doesn't Hide do anything?" finds the answer next to the code.
 *
 * - attack        Already covered: the weapon effects on the Actions tab are the Attack action,
 *                 and they roll and charge themselves.
 * - contingency   "You decide what has to happen before the Contingency action" (GI Joe CRB
 *                 p.196). The trigger is free narrative text and the resolution is out of turn;
 *                 the item schema already carries `contingencyTrigger` for the Perks that set
 *                 one, but a generic Contingency has nowhere to put it yet.
 * - useASkill     Rolls whichever skill the player wants, which is what the Skills tab already
 *                 does. Its one mechanical addition - "for every enemy adjacent to you, your Skill
 *                 Test suffers an automatic down 1 shift" - depends on counting adjacent enemies,
 *                 which needs a token on a scene and a reach calculation.
 * - move          Nothing to do: moving the token is the action.
 * - freeAction    Deliberately generic - the catch-all for the printed list of minor interactions
 *                 (opening a door, stowing a weapon), none of which the system models.
 * - commandPet    A Handle Animal Skill Test, but against a Difficulty the GM sets for the
 *                 specific command. Rolling it blind would invite the wrong comparison.
 */
const NOT_AUTOMATED = [
  'attack', 'contingency', 'useASkill', 'move', 'freeAction', 'commandPet',
];

/**
 * The Condition an actor carries while Defending.
 *
 * A status rather than a flag on the ledger, for two reasons: it shows on the token, so the GM can
 * see who is defending without opening a sheet; and the attacker's roll needs to read it off the
 * TARGET, which `actor.statuses` makes a one-line check (see dice.mjs).
 */
export const DEFENDING_STATUS = 'defending';

/**
 * Take the Defend action.
 *
 * "After announcing a Defend action, all attacks against you from adversaries and effects you can
 * see suffer a Snag on their Attack Skill Test. This benefit lasts until the beginning of your
 * next turn." (GI Joe CRB p.196)
 *
 * The Snag itself is applied by the attacker's own roll - dice.mjs#_getAutomaticCombatModifiers
 * reads this status off the target. It is cleared at the start of this actor's next turn by
 * documents/combat.mjs#_onStartTurn, which is exactly what "until the beginning of your next turn"
 * means.
 *
 * The "you can see" qualifier is NOT enforced. This system has no model of which adversaries a
 * given actor is aware of, and inventing one from token vision would be wrong about darkness,
 * cover and every Perk that grants awareness. The Snag is offered to every attacker and annotates
 * the Roll Options Dialog with its own name, so a GM ruling that the defender never saw this one
 * coming just sets the radio back to Normal.
 *
 * @param {Actor} actor
 * @returns {Promise<Object>}   {message} for the chat notice.
 */
async function defend(actor) {
  await actor.toggleStatusEffect(DEFENDING_STATUS, { active: true });

  return { message: game.i18n.format('E20.ActionDefendActivated', { name: actor.name }) };
}

/**
 * Take the Aim action.
 *
 * "A Ranged weapon-specific Free action is Aiming, which grants a up-1 shift on a single ranged
 * attack test as long as you don't use Movement between your Aim and your attack." (GI Joe CRB
 * p.193)
 *
 * Three constraints, all of them enforced elsewhere because that is where the information is:
 * the shift is ranged-only and applied by dice.mjs; the aim is spent by the shot (item.mjs#roll);
 * and moving cancels it (documents/token.mjs). This just sets the flag.
 *
 * @param {Actor} actor
 * @returns {Promise<Object>}
 */
async function aim(actor) {
  await setAiming(actor, true);

  return { message: game.i18n.format('E20.ActionAimActivated', { name: actor.name }) };
}

/**
 * Take the Hide action: "you make a Infiltration Skill Test. Your numerical result on this Skill
 * Test sets the Difficulty for other creatures' Alertness Skill Tests to notice you." (GI Joe CRB
 * p.196)
 *
 * The roll is the whole of it. Nothing stores the result as a live Difficulty, because the same
 * page makes ending it a judgement call - "your Hide benefit ends if you attack, make sufficient
 * noise, move out of cover... or move more than half of your Movement" - and a stored number that
 * silently outlives the cover it was rolled behind is worse than a number on a chat card.
 *
 * @param {Actor} actor
 * @returns {Promise<Object>}
 */
async function hide(actor) {
  await rollActionSkill(actor, 'infiltration');

  return { message: null };
}

/**
 * Take the Search the Area action: "Make an Alertness Skill Test. The GM compares the result of
 * this Skill Test to the Infiltration scores of any hidden foes, or the Difficulty the GM sets for
 * clues, secrets, and so on." (GI Joe CRB p.197)
 *
 * @param {Actor} actor
 * @returns {Promise<Object>}
 */
async function searchTheArea(actor) {
  await rollActionSkill(actor, 'alertness');

  return { message: null };
}

/**
 * Roll one of the actor's skills the way the Skills tab does.
 *
 * Builds the same dataset templates/actor/parts/misc/essence-skills.hbs puts on its roll links, so
 * the roll goes through the ordinary path and picks up every shift, Perk and dialog option a
 * hand-clicked one would. Reading the fields off the actor rather than restating them is what
 * keeps that true as the skill schema grows.
 *
 * @param {Actor} actor
 * @param {String} skill   A key of E20.skills.
 * @returns {Promise<void>}
 */
async function rollActionSkill(actor, skill) {
  const fields = actor.system.skills?.[skill];
  if (!fields) {
    return;
  }

  await actor.rollSkill({
    rollType: 'skill',
    skill,
    essence: E20.skillToEssence[skill],
    shift: fields.shift,
    shiftUp: fields.shiftUp,
    shiftDown: fields.shiftDown,
    isSpecialized: fields.isSpecialized,
    canCritD2: fields.canCritD2,
  });
}

/**
 * Take the Sprint action: "The Sprint action is nothing more than a way to cross more ground
 * quickly during your turn. By taking a Standard action to Sprint, you may move up to double
 * your full Movement." (GI Joe CRB p.197)
 *
 * Nothing moves here - Sprint only raises the distance a Move action is allowed to cover. The
 * allowance itself lives in helpers/token-movement.mjs, where the drag ruler and the movement
 * enforcement both read it, so a sprinting token draws green all the way to twice its rating.
 *
 * @param {Actor} actor
 * @returns {Promise<Object>}
 */
async function sprint(actor) {
  await setSprinting(actor, true);

  return { message: game.i18n.format('E20.ActionSprintActivated', { name: actor.name }) };
}

/**
 * Take the Lend Assistance action - see helpers/lend-assistance.mjs, which holds both of the
 * grants and the picker.
 *
 * The one handler that can come back cancelled: it asks who is being helped, and an action that
 * helped nobody was never taken, so the caller hands the Standard action back - which is also why
 * Invisibility (Technorganic Secrets p.47, "...until you take the... Lend Assistance... action")
 * only clears on a real result, not a cancelled one: an action refunded was never actually taken.
 *
 * @param {Actor} actor
 * @returns {Promise<Object>}
 */
async function lendAssistance(actor) {
  const result = await activateLendAssistance(actor);
  if (!result.cancelled) {
    await deactivateInvisibilityOnLendAssistance(actor);
  }

  return result;
}

const HANDLERS = {
  aim,
  defend,
  hide,
  lendAssistance,
  searchTheArea,
  sprint,
};

/**
 * Whether taking this action does anything beyond spending its cost.
 *
 * Used by the Actions tab to mark the rows that carry an effect, so a player can tell at a glance
 * which of these the system will actually run for them.
 *
 * @param {String} key   A key of E20.namedActions.
 * @returns {Boolean}
 */
export function isAutomated(key) {
  return Object.hasOwn(HANDLERS, key);
}

/**
 * Run a named action's effect, if it has one.
 *
 * Called only after the cost has been paid, so there is no "did it go through" check here - by the
 * time this runs, it did.
 *
 * @param {Actor} actor
 * @param {String} key   A key of E20.namedActions.
 * @returns {Promise<Object|null>}   {message} to post, or null when the action has no effect.
 */
export async function runNamedAction(actor, key) {
  const handler = HANDLERS[key];
  if (!handler) {
    return null;
  }

  return await handler(actor);
}

/**
 * The actions left as cost-only, for tests that assert the split is deliberate rather than an
 * oversight - every key in E20.namedActions is in exactly one of the two lists.
 */
export const UNAUTOMATED_ACTIONS = NOT_AUTOMATED;
