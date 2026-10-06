import { getLedger, isTracking } from "../../mechanics/actions/action-economy.mjs";

/**
 * Exo-Frame (Across the Stars, Armor Traits, p.85): a Standard action in a turn with a Move needs
 * a Driving test at DIF feet-moved / 5 (rounded up); failing leaves the wearer Prone.
 *
 * Feet moved is read off the wearer's token: Foundry v14 records every waypoint of the turn's
 * movement in TokenDocument#movementHistory (cleared at the start of each combat turn) and
 * measures it with measureMovementPath - the same measurement mechanics/combat/token-movement.mjs's Move-
 * action enforcement uses. Only meaningful on the wearer's own combat turn, since outside one the
 * history isn't reset per turn.
 *
 * Two automatic prompts, both only while the action economy is tracking (so a Standard action
 * spend and a turn ledger actually exist), and at most once per turn:
 * - a Standard action is spent after the wearer has already moved this turn ('essence20.
 *   actionSpent', fired by action-economy.mjs#spend), and
 * - the wearer moves after already having spent a Standard action this turn (Foundry's own
 *   'moveToken' hook).
 * The prompt asks rather than rolling outright - the player may have moved by a means that isn't
 * the exo-frame's problem, and the GM stays in charge of edge cases. Without the action economy,
 * the armor sheet's own "Roll Exo-Frame Driving Test" button (templates/item/details/armor.hbs)
 * runs the same roll with the DIF computed from the same recorded movement.
 */

export const EXO_FRAME_TESTED_FLAG = 'exoFrameTestedTurn';
const FEET_PER_DIF = 5;

/**
 * @param {Actor} actor
 * @returns {Item|null}   The first equipped armor with the Exo-Frame trait (own or upgrade-granted).
 */
export function getEquippedExoFrame(actor) {
  const armors = actor?.items?.documentsByType?.armor
    ?? (typeof actor?.items?.filter == 'function' ? actor.items.filter(item => item.type == 'armor') : []);
  return armors.find(armor => {
    const traits = armor.system?.itemAndUpgradeTraits
      ?? [...(armor.system?.traits ?? []), ...(armor.system?.upgradeTraits ?? [])];
    return armor.system?.equipped && traits.includes('exoFrame');
  }) ?? null;
}

/**
 * DIF = feet moved / 5, rounded up. 0 when nothing was moved (no test needed).
 * @param {Number} feet
 * @returns {Number}
 */
export function getExoFrameDifficulty(feet) {
  return feet > 0 ? Math.ceil(feet / FEET_PER_DIF) : 0;
}

/**
 * @param {Actor} actor
 * @returns {TokenDocument|null}
 */
function getTokenDocument(actor) {
  return actor?.token ?? actor?.getActiveTokens?.()?.[0]?.document ?? null;
}

/**
 * Distance the actor's token has recorded moving since its movement history was last cleared
 * (the start of its combat turn).
 * @param {Actor} actor
 * @returns {Number}   Feet (scene grid units); 0 when unknown.
 */
export function getFeetMovedThisTurn(actor) {
  const tokenDoc = getTokenDocument(actor);
  const history = tokenDoc?.movementHistory ?? [];
  if (history.length < 2) {
    return 0;
  }

  try {
    const distance = tokenDoc.measureMovementPath(history)?.distance;
    return Number.isFinite(distance) ? distance : 0;
  } catch {
    return 0;
  }
}

/**
 * @returns {Object|null}   {combatId, round, turn} for the combat turn in progress.
 */
function currentTurnKey() {
  const combat = game?.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : null;
}

/**
 * @param {Actor} actor
 * @returns {Boolean}   Whether the Exo-Frame test was already made (or declined) this combat turn.
 */
export function wasExoFrameTestedThisTurn(actor) {
  const stamp = actor?.getFlag?.('essence20', EXO_FRAME_TESTED_FLAG);
  const key = currentTurnKey();
  return !!stamp && !!key
    && stamp.combatId == key.combatId && stamp.round == key.round && stamp.turn == key.turn;
}

async function markExoFrameTested(actor) {
  const key = currentTurnKey();
  if (key) {
    await actor.setFlag('essence20', EXO_FRAME_TESTED_FLAG, key);
  }
}

/**
 * Whether it is this actor's own combat turn.
 * @param {Actor} actor
 * @returns {Boolean}
 */
function isOwnTurn(actor) {
  const combatant = game?.combat?.combatant;
  if (!combatant) {
    return false;
  }

  const tokenDoc = getTokenDocument(actor);
  return tokenDoc ? combatant.tokenId == tokenDoc.id : combatant.actor == actor;
}

/**
 * Rolls the Driving test at the DIF the recorded movement gives, knocking the wearer Prone on a
 * failure. A cancelled roll dialog changes nothing.
 * @param {Actor} actor
 * @param {Number} [feet]   Defaults to the movement recorded this turn.
 * @returns {Promise<Object|null>}   {difficulty, success} or null when nothing was rolled.
 */
export async function rollExoFrameTest(actor, feet = getFeetMovedThisTurn(actor)) {
  const difficulty = getExoFrameDifficulty(feet);
  if (!difficulty) {
    ui.notifications.info(game.i18n.format('E20.ExoFrameNoMovement', { name: actor.name }));
    return null;
  }

  const result = await actor._dice.rollSkill({
    skill: 'driving', essence: 'speed', shiftUp: 0, shiftDown: 0, dif: String(difficulty),
  }, actor);
  if (!result || result.cancelled) {
    return null;
  }

  await markExoFrameTested(actor);
  if (!result.success) {
    await actor.toggleStatusEffect('prone', { active: true });
    ui.notifications.warn(game.i18n.format('E20.ExoFrameFellProne', { name: actor.name }));
  }

  return { difficulty, success: !!result.success };
}

/**
 * The shared "should the wearer be asked now" check for both automatic triggers.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function needsExoFramePrompt(actor) {
  return isTracking() && isOwnTurn(actor) && !!getEquippedExoFrame(actor)
    && !wasExoFrameTestedThisTurn(actor);
}

/**
 * Asks the wearer whether to roll now; declining still counts as this turn's answer so the
 * prompt doesn't repeat on every later action.
 * @param {Actor} actor
 */
export async function promptExoFrameTest(actor) {
  const feet = getFeetMovedThisTurn(actor);
  const difficulty = getExoFrameDifficulty(feet);
  if (!difficulty) {
    return;
  }

  // Bound, not a bare reference: DialogV2.confirm calls this.wait internally.
  const confirm = foundry.applications?.api?.DialogV2?.confirm?.bind(foundry.applications.api.DialogV2);
  const ok = confirm
    ? await confirm({
      window: { title: game.i18n.localize('E20.ExoFrameTestTitle') },
      content: `<p>${game.i18n.format('E20.ExoFrameTestPrompt', { name: actor.name, feet: Math.round(feet), difficulty })}</p>`,
      rejectClose: false,
      modal: true,
    })
    : false;

  if (ok) {
    await rollExoFrameTest(actor, feet);
  } else {
    await markExoFrameTested(actor);
  }
}

/**
 * 'essence20.actionSpent' handler - a Standard action spent after moving.
 * @param {Actor} actor
 * @param {String} actionType
 * @param {Object} cost   {standard, move, free} amounts actually spent.
 */
export async function onExoFrameActionSpent(actor, actionType, cost) {
  if (!cost?.standard || !needsExoFramePrompt(actor) || !getFeetMovedThisTurn(actor)) {
    return;
  }

  await promptExoFrameTest(actor);
}

/**
 * 'moveToken' handler - movement after a Standard action was already spent this turn. Only on the
 * client that made the move, so the prompt appears once, to the person moving.
 * @param {TokenDocument} tokenDoc
 * @param {Object} movement
 * @param {Object} operation
 * @param {User} user
 */
export async function onExoFrameTokenMoved(tokenDoc, movement, operation, user) {
  const actor = tokenDoc?.actor;
  if (!actor || user?.id != game.user?.id || !needsExoFramePrompt(actor)) {
    return;
  }

  if (!getLedger(actor).standard) {
    return;
  }

  await promptExoFrameTest(actor);
}

/**
 * Registered once from essence20.mjs.
 */
export function registerExoFrameHooks() {
  Hooks.on('essence20.actionSpent', onExoFrameActionSpent);
  Hooks.on('moveToken', onExoFrameTokenMoved);
}
