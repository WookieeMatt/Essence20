import { E20 } from "./config.mjs";
import { actorHasPerk } from "./perks.mjs";
import { getRemaining, isBlocking, isConfirming, isSprinting, isTracking, spend } from "./action-economy.mjs";

/**
 * Token movement against the action economy.
 *
 * A Move action lets a character move up to their Movement rating (GI Joe CRB p.193), so two
 * separate things have to happen when a token moves on its owner's turn: the Move action is spent,
 * and the distance travelled is checked against that rating.
 *
 * Almost none of the measuring is done here, because Foundry v14 already does it. Every token
 * carries a `movementHistory` of waypoints with a measured `cost` apiece, cleared at the start of
 * each combat turn by Combat#_clearMovementHistoryOnStartTurn. That cost already accounts for
 * difficult terrain and diagonals, via whatever cost function the grid and any terrain regions
 * supply - which is a far better answer than hand-computing pixel distance, and the reason this
 * file is short.
 *
 * Deliberately narrow about what it gates:
 *
 * - Only while the world has BOTH tracking and the movement sub-setting on. It is off by default,
 *   because preMoveToken fires only on the client initiating the move (v14 documents this), which
 *   makes any enforcement here advisory rather than authoritative.
 * - Only on the moving actor's OWN turn. Forced and out-of-turn movement must not eat the Move
 *   action the actor has not taken yet.
 * - Only for movement a person drove by hand - dragging or the arrow keys. A move made through the
 *   API is another feature moving the token (a Perk, a Region behaviour), `undo` is a correction,
 *   and `config`/`hud`/`paste` are a GM repositioning things rather than a character walking.
 * - Never for teleports, which are not movement in the rules' sense.
 */

// v14's movement actions (CONFIG.Token.movement.actions) mapped onto E20.movementTypes. `jump` and
// `crawl` are ordinary ground movement in Essence20 terms; `blink` and `displace` are teleports and
// are excluded entirely rather than mapped.
const MOVEMENT_TYPE_BY_ACTION = {
  walk: 'ground',
  crawl: 'ground',
  jump: 'ground',
  fly: 'aerial',
  swim: 'swim',
  burrow: 'burrow',
  climb: 'climb',
};

// Movement a person drove by hand, as opposed to a script, a correction, or a GM repositioning.
const PLAYER_DRIVEN_METHODS = ['dragging', 'keyboard'];

/* "Pushing Yourself: Buying Additional Movement" (GI Joe CRB p.194): "each Free action spent along
   with a creature or object's Move action adds 5 feet to whatever type of Movement they are using
   during the action... A character cannot spend Free actions on buying additional Movement that
   would double one of their Movement Types."

   So the reachable distance in a turn is the rating plus 5ft per Free action spent, hard-capped at
   twice the rating. Three printed things change that, and getPushRules below applies them. */
const PUSH_FEET_PER_FREE_ACTION = 5;
const PUSH_CAP_MULTIPLIER = 2;
// "You may move up to double your full Movement" - the Sprint action (GI Joe CRB p.197).
const SPRINT_MULTIPLIER = 2;
const PUSH_FEET_DOUBLED = 10;

/* Sewer Tunneler (Hawk's Personnel Files p.177): "You also add 10 feet to your Movement instead of
   5 feet when you Push Yourself." Unconditional - the Perk's other clause ("In an urban
   environment, you ignore Rough Terrain") is a separate sentence with its own condition, and is
   terrain handling rather than anything this file does. */
const SEWER_TUNNELER_ID = "Compendium.essence20.general_hawk_s_personel_files.Item.gCbl6p64cEJjF2eJ";

/* Earlier is Better Than Later (TF CRB p.108, and again for the Cycle Drones in Technorganic
   Secrets p.136): "While in Alt Mode, Free Actions used for additional Movement add 10 feet to his
   Movement instead of 5. Additionally, exchanging Free Actions for additional movement is not
   limited." Both halves at once, and only while transformed. */
const EARLIER_IS_BETTER_ID = "Compendium.essence20.tf_crb.Item.uyeLgTc55ixz31j1";

/**
 * Whether this actor is a vehicle someone is currently driving.
 *
 * "Unlike a Cybertronian, vehicles with a driver can't use Standard actions to Sprint or Free
 * actions to Push themselves" (Field Guide to Action and Adventure). Deliberately scoped to the
 * `vehicle` type: the rule names driven vehicles, and extending it to piloted `zord` actors would be
 * this system's invention rather than the book's.
 *
 * Crew live in system.actors, each with their own vehicleRole - the same shape dice.mjs's own
 * _getPilotedVehicle scans, read from the vehicle's side rather than the crew member's.
 * @param {Actor} actor
 * @returns {Boolean}
 */
function isDrivenVehicle(actor) {
  if (actor?.type != 'vehicle') {
    return false;
  }

  return Object.values(actor.system?.actors ?? {}).some(crew => crew?.vehicleRole == 'driver');
}

/**
 * How Pushing works for one actor: how far each Free action buys, how far it can be taken in
 * total, and whether it is available at all.
 *
 * @param {Actor} actor
 * @returns {Object}   {feetPerFreeAction, capMultiplier, canPush}
 */
export function getPushRules(actor) {
  // A driven vehicle cannot Push at any price, so nothing else about the rules matters.
  if (isDrivenVehicle(actor)) {
    return {
      feetPerFreeAction: PUSH_FEET_PER_FREE_ACTION,
      capMultiplier: PUSH_CAP_MULTIPLIER,
      canPush: false,
    };
  }

  const rules = {
    feetPerFreeAction: PUSH_FEET_PER_FREE_ACTION,
    capMultiplier: PUSH_CAP_MULTIPLIER,
    canPush: true,
  };

  if (actorHasPerk(actor, SEWER_TUNNELER_ID)) {
    rules.feetPerFreeAction = PUSH_FEET_DOUBLED;
  }

  if (actor?.system?.isTransformed && actorHasPerk(actor, EARLIER_IS_BETTER_ID)) {
    rules.feetPerFreeAction = PUSH_FEET_DOUBLED;
    // "not limited" - no doubling cap at all, so nothing is ever beyondCap.
    rules.capMultiplier = Infinity;
  }

  /* The Push cap is a ceiling on the BASE rating - "a character cannot spend Free actions on
     buying additional Movement that would double one of their Movement Types" (p.193) - but
     planPush applies capMultiplier to the ALLOWANCE, which Sprint has already doubled. Dividing
     keeps the ceiling at the same absolute distance: 2x base either way. In practice that means
     a sprinting character cannot Push at all, which is the right answer - they are already at
     double, and buying more would take them past it.

     Dividing rather than assigning 1 is what preserves Earlier Is Better's uncapped Infinity
     above (Infinity / 2 is Infinity), which "not limited" should stay whether or not the
     character is also Sprinting. */
  if (isSprinting(actor)) {
    rules.capMultiplier = rules.capMultiplier / SPRINT_MULTIPLIER;
  }

  return rules;
}

/**
 * Work out whether a distance is reachable, and what Pushing it would cost.
 *
 * @param {Number} used        Total feet this turn, including the leg being walked.
 * @param {Number} allowance   The actor's rating for this movement type.
 * @param {Number} freeLeft    Free actions still available this turn.
 * @param {Object} [rules]     From getPushRules(); the printed 5ft/doubling defaults when omitted.
 * @returns {Object}   {withinRating, pushFeet, freeNeeded, affordable, beyondCap, cap, canPush}
 */
export function planPush(used, allowance, freeLeft, rules = null) {
  const { feetPerFreeAction, capMultiplier, canPush } = rules ?? {
    feetPerFreeAction: PUSH_FEET_PER_FREE_ACTION,
    capMultiplier: PUSH_CAP_MULTIPLIER,
    canPush: true,
  };

  const cap = allowance * capMultiplier;
  const pushFeet = Math.max(0, used - allowance);
  const freeNeeded = Math.ceil(pushFeet / feetPerFreeAction);
  return {
    withinRating: pushFeet === 0,
    pushFeet,
    freeNeeded,
    cap,
    canPush,
    beyondCap: used > cap,
    // An actor that cannot Push never affords one, however many Free actions are going spare.
    affordable: canPush && freeLeft >= freeNeeded,
  };
}

/**
 * Whether the movement half of the action economy is switched on. Separate from the main setting
 * and off by default - see this module's own doc comment for why it is advisory.
 * @returns {Boolean}
 */
export function isMovementTracked() {
  try {
    return isTracking() && game?.settings?.get?.('essence20', 'actionEconomyMovement') === true;
  } catch {
    return false;
  }
}

/**
 * The E20 movement type a v14 movement action corresponds to, or null for a teleport or anything
 * unrecognised (a system or module may register its own actions).
 * @param {String} action
 * @returns {String|null}
 */
export function movementTypeFor(action) {
  return MOVEMENT_TYPE_BY_ACTION[action] ?? null;
}

/**
 * How far the actor may move on one Move action, for the given movement type.
 * @param {Actor} actor
 * @param {String} movementType   A key of E20.movementTypes.
 * @returns {Number|null}   The rating in feet, or null if the actor has no such movement.
 */
export function getMovementAllowance(actor, movementType) {
  const rating = actor?.system?.movement?.[movementType]?.total;
  if (!Number.isFinite(rating)) {
    return null;
  }

  /* Sprint (GI Joe CRB p.197): "By taking a Standard action to Sprint, you may move up to
     double your full Movement." Doubling the allowance here rather than at either call site is
     what makes the drag ruler and the enforcement agree - they both measure against this one
     number, so a sprinting token draws green all the way to twice its rating and is charged
     accordingly. SPRINT_MULTIPLIER is named rather than inlined because getPushRules below has
     to undo exactly this much to keep the Push cap where the rules put it. */
  return isSprinting(actor) ? rating * SPRINT_MULTIPLIER : rating;
}

/**
 * Whether it is currently this token's own turn. Movement outside it is never charged - see the
 * module doc comment.
 * @param {TokenDocument} token
 * @returns {Boolean}
 */
function isOwnTurn(token) {
  const combatant = game?.combat?.combatant;
  return !!combatant && !!token?.id && combatant.tokenId === token.id;
}

/**
 * The movement action of the path being walked. A single move can in principle span segments with
 * different actions; the last one wins, since that is what the token is doing when it arrives.
 * @param {Object} movement   A v14 TokenMovementOperation.
 * @returns {String|null}
 */
function actionOf(movement) {
  for (const waypoint of walkedWaypoints(movement).reverse()) {
    if (waypoint?.action) {
      return waypoint.action;
    }
  }

  return null;
}

/**
 * The waypoints of the movement being made right now.
 *
 * `passed` first, and it is nearly always the only one that matters: by the time this runs, the
 * leg being walked has already been measured into `passed`, and `pending` is empty unless the
 * movement has further legs still to walk. An earlier version of this file read `pending` alone
 * and fell back to `destination.action` - neither of which carries an action, so nothing was ever
 * charged. `destination` holds only geometry (x, y, elevation, width, height, depth, shape,
 * level); the movement action lives on the waypoints.
 * @param {Object} movement
 * @returns {Array}
 */
function walkedWaypoints(movement) {
  return [...(movement?.passed?.waypoints ?? []), ...(movement?.pending?.waypoints ?? [])];
}

/**
 * Whether any waypoint of this movement is a teleport.
 * @param {Object} movement
 * @returns {Boolean}
 */
function isTeleport(movement) {
  return walkedWaypoints(movement).some(waypoint => waypoint?.teleport);
}

/**
 * Decide what a pending token movement costs the actor, and spend it.
 *
 * Called from documents/token.mjs#_preUpdateMovement. Returns false only when the movement should
 * actually be rejected, which happens in 'strict' alone; every other mode records and reports.
 *
 * @param {TokenDocument} token   The token being moved.
 * @param {Object} movement       The v14 TokenMovementOperation.
 * @returns {Promise<Boolean>}   False to reject the movement.
 */
export async function consumeForMovement(token, movement) {
  const actor = token?.actor;
  if (!isMovementTracked() || !actor?.system?.actions?.enabled) {
    return true;
  }

  if (!movement?.recorded || isTeleport(movement)) {
    return true;
  }

  if (!PLAYER_DRIVEN_METHODS.includes(movement.method) || !isOwnTurn(token)) {
    return true;
  }

  const movementType = movementTypeFor(actionOf(movement));
  if (!movementType) {
    return true;
  }

  // Spend the Move action on the first recorded movement of the turn. Later movements in the same
  // turn are part of that same action - the rules let a character split their movement around
  // their Standard action - so they cost nothing further and are only measured.
  if (getRemaining(actor).move > 0) {
    const result = await spend(actor, 'move', { source: game.i18n.localize('E20.ActionEconomyMovementSource') });
    if (result.blocked) {
      return false;
    }
  }

  const allowance = getMovementAllowance(actor, movementType);

  /* What this turn will have cost once this move lands, in three parts, all already measured by
     Foundry against the grid and any terrain regions:

       history  what was recorded on earlier moves this turn
       passed   the leg being walked right now - this is where a drag or keypress lands
       pending  any further legs of a multi-leg path not yet walked

     `passed` is the one that matters and the one an earlier version of this code missed: it added
     only history and pending, and pending is empty for an ordinary move, so the distance actually
     being travelled was never counted at all. */
  const used = (movement.history?.cost ?? 0)
    + (movement.passed?.cost ?? 0)
    + (movement.pending?.cost ?? 0);
  if (allowance === null || !Number.isFinite(used)) {
    return true;
  }

  const push = planPush(used, allowance, getRemaining(actor).free, getPushRules(actor));
  if (push.withinRating) {
    return true;
  }

  const over = {
    name: actor.name,
    used: Math.round(used),
    allowance,
    movement: game.i18n.localize(E20.movementTypes[movementType] ?? movementType),
    free: push.freeNeeded,
    cap: push.cap,
  };

  /* Going past the rating is legal if the actor Pushes - spends Free actions to buy the extra
     distance. That is charged here rather than prompted for: at the moment the token passes its
     rating, buying the distance is the only thing that makes the move legal, and the pips show
     the result immediately. Only a distance that can't be bought is treated as an overrun. */
  if (!push.beyondCap && push.affordable) {
    for (let i = 0; i < push.freeNeeded; i++) {
      await spend(actor, 'free', { source: game.i18n.localize('E20.ActionEconomyPushSource') });
    }

    ui.notifications.info(game.i18n.format('E20.ActionEconomyPushed', over));
    return true;
  }

  /* Two different reasons the Push couldn't cover it: past twice the rating is not purchasable at
     any price, while being short of Free actions merely means not right now. The same reason is
     reported in every mode - the wording differs, but a player in 'track' (the default, where
     nothing is blocked) needs to know WHY their movement was flagged just as much as one in
     'strict' who was stopped. An earlier version only picked the specific wording for 'strict'
     and fell back to a generic "past their Movement" line everywhere else, which said nothing
     about Pushing at all. */
  const message = !push.canPush
    ? 'E20.ActionEconomyMovementNoPush'
    : (push.beyondCap
      ? 'E20.ActionEconomyMovementCapped'
      : 'E20.ActionEconomyMovementUnaffordable');

  if (isBlocking()) {
    ui.notifications.warn(game.i18n.format(message, over));
    return false;
  }

  if (isConfirming()) {
    const confirm = foundry.applications?.api?.DialogV2?.confirm;
    const ok = confirm
      ? await confirm({
        window: { title: game.i18n.localize('E20.ActionEconomyMovementTitle') },
        content: `<p>${game.i18n.format(message, over)}</p>`
          + `<p>${game.i18n.localize('E20.ActionEconomyMovementConfirm')}</p>`,
        rejectClose: false,
        modal: true,
      })
      : true;

    return !!ok;
  }

  ui.notifications.info(game.i18n.format(message, over));
  return true;
}

