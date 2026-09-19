import { getSheetContext } from "../helpers/action-economy.mjs";

const { CombatTracker } = foundry.applications.sidebar.tabs;

/**
 * Combat Tracker showing each combatant's remaining actions.
 *
 * The sheet pip row (templates/actor/parts/misc/action-economy.hbs) answers "what do I have left?"
 * for one character. This answers it for the whole table at a glance, which is what a GM actually
 * needs mid-combat - and it is the surface where "has everyone moved yet?" gets asked.
 *
 * The marks are INJECTED after render rather than added by overriding core's own tracker template.
 * Copying templates/sidebar/tabs/combat/tracker.hbs into this system would mean re-syncing it with
 * every Foundry release, and silently losing whatever core added in the meantime; walking the
 * rendered rows costs one querySelectorAll and keeps working when that template changes.
 *
 * No refresh logic is needed either: the ledger lives on the Combatant (see
 * helpers/action-economy.mjs), so spending an action updates a Combatant flag, and core already
 * re-renders this tracker on combatant updates.
 */
export class Essence20CombatTracker extends CombatTracker {
  /**
   * @inheritDoc
   */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this._renderActionMarks();
  }

  /**
   * Add a compact remaining-actions strip to each combatant row.
   *
   * Rows whose actor has nothing to show - tracking off, opted out, or simply not in this
   * encounter - are skipped, so the tracker looks exactly as it does today when the feature is
   * switched off.
   * @protected
   */
  _renderActionMarks() {
    for (const row of this.element.querySelectorAll('li.combatant[data-combatant-id]')) {
      // Re-rendering is a full redraw, but guard anyway so a partial render can't double up.
      row.querySelector('.e20-tracker-actions')?.remove();

      const combatant = this.viewed?.combatants?.get(row.dataset.combatantId);
      const actor = combatant?.actor;
      if (!actor) {
        continue;
      }

      const context = getSheetContext(actor);
      if (!context) {
        continue;
      }

      const strip = this._buildActionMarks(context);
      // Under the name rather than beside the portrait: the controls row is already crowded, and
      // this reads as a property of the combatant rather than another button.
      (row.querySelector('.token-name') ?? row).append(strip);
    }
  }

  /**
   * Build the marks for one combatant.
   * @param {Object} context   The result of getSheetContext().
   * @returns {HTMLElement}
   * @protected
   */
  _buildActionMarks(context) {
    const strip = document.createElement('div');
    strip.classList.add('e20-tracker-actions');
    if (context.turnSkipped) {
      strip.classList.add('e20-tracker-actions--skipped');
    }

    const labels = [];
    for (const category of context.categories) {
      // A category with no budget this turn (Free actions below Speed 3) would otherwise draw an
      // empty gap that reads as a rendering fault.
      if (!context.turnSkipped && !category.pips.length) {
        continue;
      }

      const group = document.createElement('span');
      group.classList.add('e20-tracker-actions__group');
      group.dataset.category = category.key;

      for (const pip of category.pips) {
        const mark = document.createElement('i');
        mark.classList.add('e20-tracker-actions__pip', `e20-tracker-actions__pip--${category.key}`);
        if (pip.spent) {
          mark.classList.add('e20-tracker-actions__pip--spent');
        }

        group.append(mark);
      }

      strip.append(group);
      labels.push(`${game.i18n.localize(category.label)}: ${Math.max(0, category.max - category.spent)}/${category.max}`);
    }

    strip.dataset.tooltip = context.turnSkipped
      ? game.i18n.localize('E20.ActionEconomyTurnSkipped')
      : labels.join(' &middot; ');

    return strip;
  }
}
