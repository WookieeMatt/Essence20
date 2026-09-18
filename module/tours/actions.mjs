import Essence20CompendiumBrowser from "../apps/compendium-browser.mjs";
import { StoryPoints } from "../apps/story-points.mjs";
import { ensureDemoActor } from "./demo-content.mjs";

/**
 * Side effects a tour step can request via its `action` property.
 *
 * Every action is deliberately a thin wrapper over the same code path a user would take - usually
 * clicking the very control the previous step pointed at. That's the point: if an action stops
 * working, the UI it demonstrates has genuinely changed, and the tour failing is the signal we
 * want rather than noise to route around.
 *
 * Each action receives the running tour and may await whatever it needs; `_preStep` awaits the
 * action before core resolves the step's target, so an action that opens a window can rely on the
 * window being there for the selector that follows.
 *
 * @type {Record<string, (tour: import("./essence20-tour.mjs").Essence20Tour) => Promise<void>>}
 */
export const ACTIONS = {
  /**
   * Expand the sidebar if the user has it collapsed.
   *
   * Worth doing before the step that introduces the sidebar: collapsed, it is a 40px strip of
   * icons, and "everything in your world is reachable from here" lands poorly pointed at that.
   * Later steps expand it as a side effect of activating a tab, so without this the tour would
   * also visibly jump open one step after introducing it.
   */
  async expandSidebar() {
    if (!ui.sidebar.expanded) ui.sidebar.expand();
  },

  /**
   * Open the Essence20 Compendium Browser, or bring it forward if it's already up.
   * @param {import("./essence20-tour.mjs").Essence20Tour} tour
   */
  async openCompendiumBrowser(tour) {
    const existing = foundry.applications.instances.get("essence20-compendium-browser");
    if (existing) {
      existing.bringToFront();
      return;
    }

    const browser = new Essence20CompendiumBrowser();
    await browser.render(true);
    await tour._waitForRender(browser);
  },

  /**
   * Open the Story Points tracker. Respects the app's own open() guard, which honours the
   * sptShow/sptAccess settings rather than forcing the window up for a user who can't use it.
   */
  async openStoryPoints() {
    if (game.StoryPointsTracker) {
      game.StoryPointsTracker.bringToFront();
      return;
    }

    await StoryPoints.open();
  },

  /**
   * Put the Impaired condition on the demo character.
   *
   * The Roll Options Dialog only renders its "Automatic Modifiers" block when something actually
   * contributes one, and that block is the whole point of the rolling tour: it is where the system
   * shows *which* Perk or condition caused a shift, individually toggleable. Impaired is the
   * cheapest honest way to make one appear — it contributes `shiftDown: 1` through the same
   * `addSource()` path a Perk uses, needs no Perk wiring on the demo actor, and is a condition a
   * new player will genuinely meet.
   *
   * Must run on a step *before* the one that opens the dialog: the dialog computes its modifiers
   * when it opens, so applying the condition afterwards would come too late to show anything.
   */
  async applyDemoImpaired() {
    const actor = await ensureDemoActor("character");
    if (!actor || actor.statuses.has("impaired")) return;
    await actor.toggleStatusEffect("impaired", { active: true });
  },

  /**
   * Submit the open Roll Options Dialog and wait for the resulting chat message.
   *
   * Resolves once the message count has actually gone up rather than after a fixed delay, so the
   * step that highlights the card isn't racing the roll animation.
   */
  async submitRoll() {
    const dialog = foundry.applications.instances.get("roll-options");
    if (!dialog) return;

    const before = game.messages.size;
    dialog.element.querySelector("footer button[type='submit']")?.click();

    const deadline = performance.now() + 5000;
    while ((game.messages.size === before) && (performance.now() < deadline)) {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }

    // Flag whatever the roll produced so teardown can remove it. The tour deletes its demo actor
    // afterwards, and a chat card attributed to an actor that no longer exists is exactly the kind
    // of debris a tour shouldn't leave in someone's game log.
    const message = game.messages.contents.at(-1);
    if (game.messages.size > before) await message?.setFlag("essence20", "tourDemo", true);
  },

  /**
   * Post a chat message containing a `@Check[...]` link, so the enrichers tour has a live one to
   * point at rather than describing the syntax in the abstract.
   *
   * Flagged for teardown like the roll cards.
   */
  async postDemoCheck() {
    const existing = game.messages.find(m => m.getFlag("essence20", "tourDemoCheck"));
    if (existing) return;

    // Wrapped in a marker span so the tour step can select *this* link. A bare `.e20-check-link`
    // matches every check link in the chat log, and the first laid-out one is whichever the table
    // happened to post earlier — the tour would then point at a stranger's roll while its copy
    // described this one.
    const message = await ChatMessage.create({
      content: "<span class=\"e20-tour-check\">@Check[skill=athletics dif=15]</span>",
      flags: { essence20: { tourDemo: true, tourDemoCheck: true } },
      whisper: [game.user.id],
    });

    // The enricher runs when the message renders, so wait for the link to exist before the step
    // that highlights it resolves its selector.
    const deadline = performance.now() + 3000;
    while (performance.now() < deadline) {
      if (document.querySelector(".e20-tour-check .e20-check-link")) break;
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }

    return message;
  },
};
