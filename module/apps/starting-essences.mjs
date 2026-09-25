import { applyThemeClass, getGameLine } from "../settings.js";
import { computeEssenceSpend } from "../helpers/skill-picker.mjs";
import {
  checkStartingEssences, currentBase, ESSENCES, essencesOverspentBy, maxEssenceFor, MIN_ESSENCE,
  recommendedSpread, STARTING_ESSENCE_POINTS, startingEssencesUpdate,
} from "../helpers/starting-essences.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Spend a player character's 12 starting Essence points, within the book's limits - see
 * helpers/starting-essences.mjs for the rules and where they come from.
 *
 * Opens by itself when a new character is created (essence20.mjs's createActor hook), and from
 * the bar above the Skills tab's Essence columns (pc-skills.hbs) any time after. Nothing is
 * saved until Apply: the steppers only move this window's own copy of the spread, so a player
 * can try spreads out and walk away without changing anything.
 */
export default class StartingEssences extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {Actor} actor The player character whose starting Essences are being spent.
   */
  constructor(actor) {
    super({ id: `essence20-starting-essences-${actor.id}` });
    this._actor = actor;
    this._base = currentBase(actor);
    this._ignoreLimits = false;
    this._high = 'strength';
    this._low = 'social';
  }

  /**
   * Open the window for an actor, or bring its open one forward.
   * @param {Actor} actor
   * @returns {Promise<StartingEssences>}
   */
  static async open(actor) {
    const existing = foundry.applications.instances.get(`essence20-starting-essences-${actor.id}`);
    if (existing) {
      existing.bringToFront();
      return existing;
    }

    const app = new StartingEssences(actor);
    await app.render({ force: true });
    return app;
  }

  static DEFAULT_OPTIONS = {
    actions: {
      adjust: StartingEssences.#onAdjust,
      even: StartingEssences.#onEven,
      recommended: StartingEssences.#onRecommended,
      apply: StartingEssences.#onApply,
      cancel: StartingEssences.#onCancel,
    },
    classes: ["essence20", "theme-wrapper", "e20-window", "starting-essences"],
    tag: "form",
    position: {
      width: 460,
      height: "auto",
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/starting-essences.hbs",
    },
  };

  get title() {
    return game.i18n.format("E20.StartingEssencesTitle", { name: this._actor.name });
  }

  /** The creation cap for this character, from the world's Game Line (then its Role). */
  get max() {
    const role = this._actor.items.documentsByType?.role?.[0];
    return maxEssenceFor(getGameLine(), role?.system?.version ?? null);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const max = this.max;
    const status = checkStartingEssences(this._base, max);
    const previous = currentBase(this._actor);
    const upperBound = this._ignoreLimits ? Infinity : max;
    const lowerBound = this._ignoreLimits ? 0 : MIN_ESSENCE;

    context.max = max;
    context.total = STARTING_ESSENCE_POINTS;
    context.remaining = status.remaining;
    context.remainingClass = status.remaining === 0 ? 'is-done' : (status.remaining < 0 ? 'is-over' : '');
    context.isGM = game.user.isGM;
    context.ignoreLimits = this._ignoreLimits;
    context.canApply = this._ignoreLimits || status.isValid;

    // Each row shows what the Essence will come to with everything the Origin, Role and levels
    // add on top - the number the sheet will actually show - not just this window's share of it.
    context.rows = ESSENCES.map((essence) => {
      const value = this._base[essence];
      return {
        essence,
        label: CONFIG.E20.essences[essence],
        value,
        total: this._actor.system.essences[essence].max + (value - previous[essence]),
        canLower: value > lowerBound,
        canRaise: value < upperBound && (this._ignoreLimits || status.remaining > 0),
      };
    });

    context.essenceChoices = Object.fromEntries(ESSENCES.map(essence => [essence, CONFIG.E20.essences[essence]]));
    context.high = this._high;
    context.low = this._low;

    // Lowering an Essence below what its skills already cost would leave them unpaid for - said
    // here, before Apply, rather than discovered later in the Skill Picker's tally.
    const overspent = essencesOverspentBy(this._actor, this._base, computeEssenceSpend(this._actor));
    context.overspent = overspent.length
      ? game.i18n.format("E20.StartingEssencesSkillWarning", {
        essences: overspent.map(essence => game.i18n.localize(CONFIG.E20.essences[essence])).join(', '),
      })
      : null;

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);

    // The two recommended-spread pickers and the GM's override are read as they change, so
    // the window never holds a stale value for them between renders.
    for (const select of this.element.querySelectorAll('select[name="high"], select[name="low"]')) {
      select.addEventListener('change', () => {
        this[select.name === 'high' ? '_high' : '_low'] = select.value;
      });
    }

    this.element.querySelector('input[name="ignoreLimits"]')?.addEventListener('change', (event) => {
      this._ignoreLimits = event.target.checked;
      this.render();
    });
  }

  static #onAdjust(event, target) {
    const essence = target.dataset.essence;
    const step = Number(target.dataset.step);
    this._base[essence] = Math.max(0, this._base[essence] + step);
    this.render();
  }

  static #onEven() {
    this._base = { strength: 3, speed: 3, smarts: 3, social: 3 };
    this.render();
  }

  static #onRecommended() {
    if (this._high === this._low) {
      ui.notifications.warn(game.i18n.localize("E20.StartingEssencesSameEssence"));
      return;
    }

    this._base = recommendedSpread(this._high, this._low);
    this.render();
  }

  static async #onApply() {
    const status = checkStartingEssences(this._base, this.max);
    if (!this._ignoreLimits && !status.isValid) {
      return;
    }

    await this._actor.update(startingEssencesUpdate(this._actor, this._base));
    this.close();
  }

  static #onCancel() {
    this.close();
  }
}
