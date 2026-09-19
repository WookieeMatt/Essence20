import { getRemaining, isTracking } from "../helpers/action-economy.mjs";
import { getMovementAllowance, getPushRules, isMovementTracked, movementTypeFor, planPush } from "../helpers/token-movement.mjs";

const { TokenRuler } = foundry.canvas.placeables.tokens;

/* Ruler path colours, by how the move is being paid for. Deliberately traffic-light rather than
   the system palette: the ruler is drawn over arbitrary map art, and these three have to be
   told apart at a glance without a legend. 'within' is green because it is the reassuring
   case - most movement never leaves it, and the path simply reads as "this is fine".

   sass/views/_token-ruler.scss mirrors the amber and red for the text note; if these change,
   change them there too. There is no green there because a label only appears once you are
   past the rating. */
const PATH_COLORS = {
  within: 0x46b478,
  pushing: 0xffc861,
  unaffordable: 0xff5c4d,
  capped: 0xff5c4d,
  // A driven vehicle cannot Push at all - red for the same reason as capped: no amount of
  // Free actions buys this distance.
  noPush: 0xff5c4d,
};

/**
 * Token drag ruler that says, while you are still dragging, what this move is going to cost.
 *
 * The action economy already charged Pushing correctly (helpers/token-movement.mjs), but it only
 * told you afterwards, in a toast that is easy to miss and arrives once the move is already made.
 * The ruler is where a player is actually looking mid-drag, and v14 measures the planned path for
 * us, so the warning can be live. Two things carry it:
 *
 * - The PATH and its grid squares are coloured by how the distance is being paid for - green
 *   inside the Movement rating, amber where Free actions are buying it, red where it cannot be
 *   bought. Because each waypoint carries the cumulative cost to reach it, this is per-segment:
 *   one drag can run green, turn amber where the rating runs out, and turn red at the cap, so the
 *   exact step where it stops being free is visible on the map.
 * - The LABEL spells out the cost in words, but only once past the rating; inside it, the colour
 *   already says everything and a note would be noise.
 *
 * `CONFIG.Token.rulerClass` and the `WAYPOINT_LABEL_TEMPLATE` static are both there to be replaced,
 * so this is the sanctioned extension point rather than a workaround - unlike the combat tracker,
 * where the marks are injected post-render because core offered nothing.
 *
 * The one cost: WAYPOINT_LABEL_TEMPLATE takes a single-rooted template and core inserts it with
 * parseHTML, so the system template is a copy of core's with one block added rather than a wrapper
 * around it. If a future Foundry release changes the stock label, templates/hud/waypoint-label.hbs
 * needs the same change.
 */
export class Essence20TokenRuler extends TokenRuler {
  static WAYPOINT_LABEL_TEMPLATE = "systems/essence20/templates/hud/waypoint-label.hbs";

  /**
   * Add the Pushing cost of the move being dragged to the waypoint label.
   *
   * @param {Object} waypoint   The ruler waypoint.
   * @param {Object} state      Render state shared across the path's waypoints.
   * @returns {Object|void}
   * @override
   */
  _getWaypointLabelContext(waypoint, state) {
    const context = super._getWaypointLabelContext(waypoint, state);
    if (!context) {
      return context;
    }

    const push = this._getPushContext(waypoint);
    if (push) {
      context.e20Push = push;
      context.cssClass = `${context.cssClass ?? ''} e20-push--${push.status}`.trim();
    }

    return context;
  }

  /**
   * How this token is doing for Movement as far as the given waypoint, or null when the question
   * doesn't apply - out of combat, on someone else's turn, with tracking off, or for a teleport.
   *
   * Cumulative, because `measurement.cost` is the cost to reach THIS waypoint: a path can start
   * within the rating, cross into Pushing partway along, and end past the cap, and each segment
   * should say which of those it is.
   *
   * @param {Object} waypoint
   * @returns {Object|null}   {status, used, allowance, freeLeft, push}
   * @protected
   */
  _getPushState(waypoint) {
    const actor = this.token?.actor;
    if (!isTracking() || !isMovementTracked() || !actor?.system?.actions?.enabled) {
      return null;
    }

    // Only while it is this token's own turn, matching what token-movement.mjs actually charges.
    const combatant = game.combat?.combatant;
    if (!combatant || combatant.tokenId !== this.token.document.id) {
      return null;
    }

    const movementType = movementTypeFor(waypoint.action);
    const allowance = movementType ? getMovementAllowance(actor, movementType) : null;
    const planned = waypoint.measurement?.cost;
    if (allowance === null || !Number.isFinite(planned)) {
      return null;
    }

    /* No need to add the turn's earlier movement: core measures the whole rendered path, and that
       path is the history followed by the planned one, so the cost already runs from where the
       token started the turn. Verified in v14 against a token with 20 ft of history: its `passed`
       waypoint measured 20, and a further 10 ft drag measured 30 rather than 10. */
    const used = planned;
    const freeLeft = getRemaining(actor).free;
    const push = planPush(used, allowance, freeLeft, getPushRules(actor));
    /* Order matters: an actor that cannot Push at all is never "capped" or "short of Free",
       it simply has no such option, and saying so is more use than a number it cannot reach. */
    const status = push.withinRating
      ? 'within'
      : (!push.canPush
        ? 'noPush'
        : (push.beyondCap ? 'capped' : (push.affordable ? 'pushing' : 'unaffordable')));

    return { status, used, allowance, freeLeft, push };
  }

  /**
   * The colour for a stretch of path: green while inside the Movement rating, amber where Free
   * actions are buying the distance, red where it cannot be bought at all. Null leaves core's own
   * per-user colour alone, which is what every non-applicable case wants.
   *
   * @param {Object} waypoint
   * @returns {Number|null}
   * @protected
   */
  _getPushColor(waypoint) {
    return PATH_COLORS[this._getPushState(waypoint)?.status] ?? null;
  }

  /**
   * Colour the ruler line by what the movement costs.
   * @override
   */
  _getSegmentStyle(waypoint) {
    const style = super._getSegmentStyle(waypoint);
    // Core draws nothing at all for an action it does not visualize, and returns a style with no
    // colour to say so; colouring that would be colouring a line nobody sees.
    if (!style.width) {
      return style;
    }

    const color = this._getPushColor(waypoint);
    return color === null ? style : { ...style, color };
  }

  /**
   * Colour the highlighted grid squares to match the line.
   * @override
   */
  _getGridHighlightStyle(waypoint, offset) {
    const style = super._getGridHighlightStyle(waypoint, offset);
    // Core hides squares it doesn't want drawn (unreachable, teleport waypoints, and the join
    // between passed and planned); recolouring those would put them back.
    if (style.alpha === 0) {
      return style;
    }

    const color = this._getPushColor(waypoint);
    return color === null ? style : { ...style, color };
  }

  /**
   * What Pushing this far would cost, or null when there is nothing worth saying - including a
   * move that is still within the rating, which the colour already conveys.
   *
   * @param {Object} waypoint
   * @returns {Object|null}   {status, feet, allowance, free, freeLeft, cap, text}
   * @protected
   */
  _getPushContext(waypoint) {
    const state = this._getPushState(waypoint);
    if (!state || state.status === 'within') {
      return null;
    }

    const { status, used, allowance, freeLeft, push } = state;
    return {
      status,
      feet: Math.round(used),
      allowance,
      cap: push.cap,
      free: push.freeNeeded,
      freeLeft,
      // Formatted here rather than in the template: the label interpolates the distance and the
      // number of Free actions, and Handlebars' localize helper only looks up a key.
      text: game.i18n.format(`E20.ActionEconomyRuler${status.capitalize()}`, {
        feet: Math.round(used),
        allowance,
        cap: push.cap,
        free: push.freeNeeded,
        freeLeft,
      }),
    };
  }

}
