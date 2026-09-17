import { canProvisionDemo, cleanupDemoActors, DEMO_ACTORS, ensureDemoActor, findFallbackActor } from "./demo-content.mjs";

const Tour = foundry.nue.Tour;

/**
 * How long, in milliseconds, a step will wait for its target element to appear before giving up.
 * Generous enough to cover a sheet render plus a tab switch on a slow machine, short enough that a
 * genuinely missing selector doesn't stall the tour for an uncomfortable length of time.
 * @type {number}
 */
const DEFAULT_TIMEOUT = 3000;

/**
 * A Tour subclass that adds the handful of capabilities core's purely declarative step grammar
 * lacks, all of which Essence20's tours need:
 *
 * - `sidebarTab` / `layer` / `tool` - the same activations core's SidebarTour and CanvasTour do,
 *   merged into one class so a single tour can move between the sidebar, the canvas and a sheet.
 * - `app` - ensures a given application is open and scopes the step's selector to its root element,
 *   so `.tab[data-tab='gear']` can't match some other sheet the user happens to have open.
 * - `tab` - activates a sheet tab and waits for the re-render.
 * - `action` - a named side effect from the whitelist in actions.mjs.
 * - `expand` - opens a collapsible item container so the step can point inside it.
 * - `waitFor` / `timeout` - poll for an element other than `selector`.
 * - `optional` - skip the step rather than show a broken tooltip when the target never appears.
 *
 * The core reason this class exists at all: `Tour#_getTargetElement` is a single synchronous
 * `document.querySelector`, which finds nothing for any of the ApplicationV2 sheets and dialogs
 * this system is built from. Everything asynchronous therefore has to be awaited in `_preStep`,
 * which core calls before it resolves the target.
 *
 * @see docs/TOURS_PLAN.md
 */
export class Essence20Tour extends Tour {
  /**
   * The application the current step is scoped to, if the step declared one. Selectors resolve
   * inside this app's element rather than against the whole document.
   * @type {foundry.applications.api.ApplicationV2|null}
   */
  #app = null;

  /**
   * Steps whose target never materialised and which were marked `optional`, so `progress()` knows
   * to keep skipping in the direction of travel rather than bouncing between two dead steps.
   * @type {Set<number>}
   */
  #skipped = new Set();

  /* -------------------------------------------- */
  /*  Lifecycle                                   */
  /* -------------------------------------------- */

  /**
   * The demo actor keys this tour needs, derived from the `app` values its steps declare.
   * @type {string[]}
   */
  get requiredDemoActors() {
    const keys = new Set();
    for (const step of this.config.steps ?? []) {
      const demoKey = this.constructor.DEMO_APPS[step.app];
      if (demoKey) keys.add(demoKey);
    }

    return [...keys];
  }

  /**
   * A tour that needs a demo actor can only run for someone who can either create one or already
   * owns something to stand in for it. Without this the Play button would start a tour that
   * immediately fails on its first sheet step.
   * @override
   */
  get canStart() {
    if (!game.ready) return false;
    if (canProvisionDemo()) return true;
    return this.requiredDemoActors.every(key => !!findFallbackActor(DEMO_ACTORS[key]?.type));
  }

  /** @override */
  async start() {
    // A paused game swallows some of the interactions the tours demonstrate.
    game.togglePause(false);
    this.#skipped.clear();
    return super.start();
  }

  /** @override */
  exit() {
    this.#app = null;
    this.#skipped.clear();
    const result = super.exit();
    this.#teardown();
    return result;
  }

  /** @override */
  async complete() {
    const result = await super.complete();
    await this.#teardown();
    return result;
  }

  /**
   * Remove anything the tour created. Deliberately never throws into the caller: failing to tidy
   * up is not a reason to make exiting a tour look broken.
   * @returns {Promise<void>}
   */
  async #teardown() {
    this.#app = null;
    if (!this.requiredDemoActors.length) return;

    // `exit()` is synchronous in core, so this runs fire-and-forget. Give anything that starts
    // immediately afterwards — notably the next tour in a `suggestedNextTours` chain — a chance to
    // become the active tour before we delete. Without this the outgoing tour's cleanup races the
    // incoming one's provisioning and deletes the demo actor out from under it, which fails the
    // new tour's first sheet step.
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    if (Tour.tourInProgress) return;

    try {
      await cleanupDemoActors();
    } catch (err) {
      console.error(`Essence20 | Tour "${this.id}" failed to clean up its demo actors`, err);
    }
  }

  /* -------------------------------------------- */

  /**
   * Advance past `optional` steps whose target never appeared, instead of letting core warn and
   * render a tooltip with nothing to anchor to.
   * @override
   */
  async progress(stepIndex) {
    const previous = this.stepIndex;
    await super.progress(stepIndex);

    // Only a step that is still current and still targetless needs skipping; super.progress() has
    // already run _preStep and resolved the target by this point.
    const step = this.currentStep;
    if (!step?.optional || !step.selector || this.targetElement) return;
    if (this.#skipped.has(this.stepIndex)) return;

    this.#skipped.add(this.stepIndex);
    console.debug(`Essence20 | Tour "${this.id}" skipping optional step "${step.id}" (no target)`);

    // Keep moving the way the user was already moving, so Previous doesn't get stuck.
    const goingBack = Number.isFinite(previous) && stepIndex < previous;
    if (goingBack) return this.hasPrevious ? this.previous() : this.exit();
    return this.hasNext ? this.next() : this.complete();
  }

  /* -------------------------------------------- */
  /*  Step set-up                                 */
  /* -------------------------------------------- */

  /** @override */
  async _preStep() {
    await super._preStep();
    const step = this.currentStep;
    if (!step) return;

    if (step.sidebarTab) {
      ui[step.sidebarTab]?.activate();
    }

    if (step.layer && canvas.scene) {
      // ui.controls.activate() is async in v14; core's own CanvasTour doesn't await it, which can
      // race the step's selector against the control group still being swapped in.
      await ui.controls.activate({ control: step.layer, tool: step.tool });
    }

    if (step.app) {
      this.#app = await this._ensureApp(step.app);
    } else {
      this.#app = null;
    }

    if (step.tab && this.#app) {
      this.#app.changeTab(step.tab, step.tabGroup ?? "primary");
      await this._waitForRender(this.#app);
    }

    if (step.action) {
      const { ACTIONS } = await import("./actions.mjs");
      const action = ACTIONS[step.action];
      if (!action) console.warn(`Essence20 | Tour "${this.id}" declared unknown action "${step.action}"`);
      else await action(this);
    }

    if (step.expand) {
      const container = await this._await(step.expand, step.timeout);
      container?.querySelector("[data-action='toggleAccordionHeader']")?.click();
    }

    // Resolving the target here is what makes the whole grammar work: core calls _preStep() before
    // _getTargetElement(), so anything awaited here is in the DOM by the time core looks for it.
    const target = step.waitFor ?? step.selector;
    if (target) {
      const element = await this._await(target, step.timeout);
      // Being in the DOM isn't enough — it has to have stopped moving. Expanding the sidebar, for
      // one, slides the tab strip ~300px left, and core measures the highlight exactly once.
      if (element) await this._settle(element);
    }
  }

  /* -------------------------------------------- */

  /**
   * Wait until an element's position and size stop changing.
   *
   * Rather than hard-coding knowledge of which core animations move which elements (sidebar
   * expansion, sheet resize, a tab swap reflowing a scroll container), this just watches the
   * element's own box until it holds still for two consecutive frames.
   * @param {HTMLElement} element    The element to watch.
   * @param {number} [timeout]       Milliseconds to wait before proceeding regardless.
   * @returns {Promise<void>}
   * @protected
   */
  async _settle(element, timeout = 1000) {
    const deadline = performance.now() + timeout;

    // requestAnimationFrame does not fire while the tab is hidden or the window is minimised, so
    // a bare `await rAF` here would park forever and take the tour with it the moment someone
    // alt-tabs. Racing it against a timer keeps the loop advancing to its deadline regardless;
    // when frames aren't running nothing is moving anyway, so settling immediately is correct.
    const frame = () => Promise.race([
      new Promise((resolve) => requestAnimationFrame(resolve)),
      new Promise((resolve) => window.setTimeout(resolve, 50)),
    ]);
    const box = () => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return `${x},${y},${width},${height}`;
    };

    let previous = box();
    let stable = 0;

    while (performance.now() < deadline) {
      await frame();
      const current = box();
      if (current === previous) {
        if (++stable >= 2) return;
      } else {
        stable = 0;
        previous = current;
      }
    }
  }

  /* -------------------------------------------- */
  /*  Target resolution                           */
  /* -------------------------------------------- */

  /**
   * Resolve the step's selector, scoped to the step's app when it declared one.
   *
   * v14 allows any ApplicationV2 to be popped out into a separate browser window, where a plain
   * `document.querySelector` finds nothing. `_ensureApp()` re-attaches a detached target, so the
   * detached-window scan below is only a fallback for windows we don't control - a popped-out
   * sidebar tab, for instance, which `activate()` refuses to pull back into the sidebar.
   * @override
   */
  _getTargetElement(selector) {
    if (this.#app) return this._pickVisible(this.#app.element?.querySelectorAll(selector));
    return this._pickVisible(document.querySelectorAll(selector))
      ?? this._queryDetachedWindows(selector);
  }

  /**
   * Choose the element a user can actually see from a set of matches.
   *
   * A selector routinely matches several elements, only one of which is on screen — the system
   * renders the same Compendium Browser button into both the Items and Compendium directory
   * footers, and an inactive sidebar tab or sheet tab keeps its markup in the DOM at zero size.
   * `querySelector` returns whichever comes first in document order, which is just as likely to be
   * a hidden copy, and core would then highlight a 0x0 box in the top-left corner.
   * @param {NodeListOf<HTMLElement>|undefined} matches   Candidate elements.
   * @returns {HTMLElement|null}                          The first laid-out match, else the first.
   * @protected
   */
  _pickVisible(matches) {
    if (!matches?.length) return null;
    for (const element of matches) {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) return element;
    }

    return matches[0];
  }

  /**
   * Search every detached v14 window for the given selector.
   * @param {string} selector           A CSS selector.
   * @returns {HTMLElement|null}        The first match found, or null.
   * @protected
   */
  _queryDetachedWindows(selector) {
    for (const { window: win } of foundry.applications.detached?.windows?.values() ?? []) {
      const element = this._pickVisible(win?.document?.querySelectorAll(selector));
      if (element) return element;
    }

    return null;
  }

  /* -------------------------------------------- */

  /**
   * Poll for an element matching the selector, resolving as soon as it exists.
   *
   * Uses a MutationObserver rather than a polling interval so a fast render resolves on the very
   * next microtask instead of waiting out a tick, and resolves with null on timeout rather than
   * rejecting - a missing target is handled by the caller (`optional`) or reported by core's own
   * "target element not found" warning.
   * @param {string} selector                  A CSS selector.
   * @param {number} [timeout]                 Milliseconds to wait before giving up.
   * @returns {Promise<HTMLElement|null>}      The element, or null if it never appeared.
   * @protected
   */
  async _await(selector, timeout = DEFAULT_TIMEOUT) {
    const existing = this._getTargetElement(selector);
    if (existing) return existing;

    return new Promise((resolve) => {
      let timer = null;

      const finish = (element) => {
        observer.disconnect();
        if (timer) window.clearTimeout(timer);
        resolve(element);
      };

      const observer = new MutationObserver(() => {
        const element = this._getTargetElement(selector);
        if (element) finish(element);
      });

      // Watch the scoped root when there is one, so an unrelated busy sheet elsewhere in the
      // document doesn't wake the observer on every mutation.
      const root = this.#app?.element ?? document.body;
      observer.observe(root, { childList: true, subtree: true, attributes: true });

      timer = window.setTimeout(() => finish(this._getTargetElement(selector)), timeout);
    });
  }

  /* -------------------------------------------- */

  /**
   * Wait for an application to finish its next render.
   *
   * ApplicationV2 extends EventEmitterMixin and emits a "render" event on the instance, so this
   * listens to the one app rather than to a global `renderApplicationV2` hook that every other
   * open window would also wake.
   * @param {foundry.applications.api.ApplicationV2} app   The application.
   * @returns {Promise<void>}
   * @protected
   */
  async _waitForRender(app) {
    return new Promise((resolve) => {
      let timer = null;

      const onRender = () => {
        if (timer) window.clearTimeout(timer);
        resolve();
      };

      app.addEventListener("render", onRender, { once: true });

      // Don't hang the tour if the render was synchronous and already done, or never happens.
      timer = window.setTimeout(resolve, DEFAULT_TIMEOUT);
    });
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Render the step, then re-measure the highlight once layout has settled.
   *
   * Core computes the cut-out's geometry once, inline in `_renderStep`, from a
   * getBoundingClientRect() taken the instant the step renders. `_settle()` in `_preStep` handles
   * the predictable movement, but anything that reflows *because* the step rendered — a scrollIntoView
   * on a long directory, a font finishing loading — still lands after that measurement. This is the
   * safety net, and it also keeps the highlight attached across window resizes.
   * @override
   */
  async _renderStep() {
    // Core throws "The expected targetElement ... does not exist" whenever a step declares a
    // selector that resolved to nothing, and `progress()` turns that into an exit-and-rethrow —
    // which would kill the tour on exactly the steps `optional` exists to tolerate. Returning
    // early here leaves the step un-rendered so the skip logic in progress() can advance past it.
    const step = this.currentStep;
    if (step?.optional && step.selector && !this.targetElement) return;

    await super._renderStep();

    // Rebuilding the fade element is safe; it carries no listeners. The tooltip deliberately isn't
    // re-activated here, because core binds the step's button handlers to it after activation and
    // re-activating would silently drop them.
    requestAnimationFrame(() => this._repositionHighlight());

    this.#onResize ??= foundry.utils.debounce(() => this._repositionHighlight(), 100);
    window.addEventListener("resize", this.#onResize);
  }

  /**
   * Bound resize handler, kept so it can be removed again in `_postStep`.
   * @type {Function|null}
   */
  #onResize = null;

  /** @override */
  async _postStep() {
    if (this.#onResize) {
      window.removeEventListener("resize", this.#onResize);
      this.#onResize = null;
    }

    return super._postStep();
  }

  /**
   * Re-measure and rebuild the step's highlight over the current target.
   * @protected
   */
  _repositionHighlight() {
    if (!this.targetElement?.isConnected || !this.fadeElement) return;

    this.fadeElement.remove();
    this.fadeElement = Tour.highlightElement(this.targetElement, {
      padding: this.currentStep?.selector ? Tour.HIGHLIGHT_PADDING : 0,
    });
  }

  /* -------------------------------------------- */
  /*  Application handling                        */
  /* -------------------------------------------- */

  /**
   * Logical `app` keys that resolve to a demo actor's sheet rather than a standalone application.
   * @type {Record<string, string>}
   */
  static DEMO_APPS = {
    character: "character",
    transformer: "transformer",
    threat: "threat",
    vehicle: "vehicle",
    zord: "zord",
    megaform: "megaform",
  };

  /**
   * Resolve a step's logical `app` key to a rendered application, opening it if necessary.
   * @param {string} key                                              The logical app key.
   * @returns {Promise<foundry.applications.api.ApplicationV2|null>}  The rendered application.
   * @protected
   */
  async _ensureApp(key) {
    const demoKey = this.constructor.DEMO_APPS[key];
    if (demoKey) return this._ensureActorSheet(demoKey);

    // The Skill Picker is instantiated per actor, so its id isn't known until we know whose sheet
    // the tour is running against.
    if (key === "skillPicker") return this._ensureSkillPicker();

    // The roll dialog only exists once a roll has been started, and `_preStep` resolves `app`
    // before it runs `action` — so opening it has to happen here rather than as a step action.
    if (key === "rollDialog") return this._ensureRollDialog();

    // Item sheets are per-document too: `Essence20ItemSheet-Actor-<actorId>-Item-<itemId>`.
    if (key === "item") return this._ensureItemSheet();

    if (key === "storyPoints") return this._ensureStoryPoints();

    const app = foundry.applications.instances.get(key) ?? null;
    return app ? this._attachIfDetached(app) : null;
  }

  /**
   * Open the Skill Picker for the tour's character, from the sheet's own button.
   *
   * Clicking the control rather than constructing the app keeps the tour on the same code path the
   * user takes, and means the picker is bound to the same actor the previous steps were describing.
   * @returns {Promise<foundry.applications.api.ApplicationV2|null>}
   * @protected
   */
  async _ensureSkillPicker() {
    const sheet = await this._ensureActorSheet(this.constructor.DEMO_APPS.character ?? "character");
    if (!sheet) return null;

    const pickerId = `essence20-skill-picker-${sheet.document.id}`;
    const existing = foundry.applications.instances.get(pickerId);
    if (existing) return this._attachIfDetached(existing);

    // The button lives on the Skills tab, so make sure that tab is showing before reaching for it.
    sheet.changeTab("skills", "primary");
    await this._waitForRender(sheet);
    sheet.element.querySelector("[data-action='skillPicker']")?.click();

    const picker = await this._awaitApp(pickerId);
    return picker ? this._attachIfDetached(picker) : null;
  }

  /**
   * Open the Roll Options Dialog by rolling a skill from the demo character's sheet.
   *
   * The skill comes from the step's `skill` property so a tour can pick one the demo character is
   * actually trained in; rolling an untrained skill would make the dialog's shift controls read as
   * if they did nothing.
   * @returns {Promise<foundry.applications.api.ApplicationV2|null>}
   * @protected
   */
  async _ensureRollDialog() {
    const existing = foundry.applications.instances.get("roll-options");
    if (existing) return this._attachIfDetached(existing);

    const sheet = await this._ensureActorSheet(this.constructor.DEMO_APPS.character ?? "character");
    if (!sheet) return null;

    sheet.changeTab("skills", "primary");
    await this._waitForRender(sheet);

    const skill = this.currentStep?.skill ?? "targeting";
    const link = sheet.element.querySelector(
      `[data-action='rollable'][data-roll-type='skill'][data-skill='${skill}']`,
    );

    if (!link) {
      console.warn(`Essence20 | Tour "${this.id}" found no roll link for skill "${skill}"`);
      return null;
    }

    link.click();
    const dialog = await this._awaitApp("roll-options");
    return dialog ? this._attachIfDetached(dialog) : null;
  }

  /**
   * Open an item sheet belonging to the demo character.
   *
   * The item is named by the step's `item` property; it defaults to the demo weapon, which is the
   * most interesting one to look at because it carries attached children.
   * @returns {Promise<foundry.applications.api.ApplicationV2|null>}
   * @protected
   */
  async _ensureItemSheet() {
    const sheet = await this._ensureActorSheet(this.constructor.DEMO_APPS.character ?? "character");
    if (!sheet) return null;

    const name = this.currentStep?.item ?? "Practice Blaster";
    const item = sheet.document.items.find(i => i.name === name);
    if (!item) {
      console.warn(`Essence20 | Tour "${this.id}" found no demo item named "${name}"`);
      return null;
    }

    if (!item.sheet.rendered) {
      await item.sheet.render(true);
      await this._waitForRender(item.sheet);
    }

    return this._attachIfDetached(item.sheet);
  }

  /**
   * Open the Story Points tracker.
   *
   * Goes through the app's own `open()` rather than constructing one, so the tracker's settings
   * gating (sptShow / sptAccess) still decides whether it may appear at all — a tour should not
   * force up a window the GM has configured off.
   * @returns {Promise<foundry.applications.api.ApplicationV2|null>}
   * @protected
   */
  async _ensureStoryPoints() {
    if (game.StoryPointsTracker?.rendered) return this._attachIfDetached(game.StoryPointsTracker);

    const { StoryPoints } = await import("../apps/story-points.mjs");
    await StoryPoints.open();
    const app = await this._awaitApp("story-points");
    return app ? this._attachIfDetached(app) : null;
  }

  /**
   * Wait for an application with the given id to be registered and rendered.
   * @param {string} id                                               The application id.
   * @param {number} [timeout]                                        Milliseconds to wait.
   * @returns {Promise<foundry.applications.api.ApplicationV2|null>}
   * @protected
   */
  async _awaitApp(id, timeout = DEFAULT_TIMEOUT) {
    const deadline = performance.now() + timeout;
    while (performance.now() < deadline) {
      const app = foundry.applications.instances.get(id);
      if (app?.element) return app;
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }

    return null;
  }

  /**
   * Open the sheet for a demo actor, provisioning the actor if it isn't there yet.
   * @param {string} demoKey                                          A key of `DEMO_ACTORS`.
   * @returns {Promise<foundry.applications.api.ApplicationV2|null>}  The rendered sheet.
   * @protected
   */
  async _ensureActorSheet(demoKey) {
    const actor = await ensureDemoActor(demoKey);
    if (!actor) {
      console.warn(`Essence20 | Tour "${this.id}" could not obtain a demo actor for "${demoKey}"`);
      return null;
    }

    if (!actor.sheet.rendered) {
      await actor.sheet.render(true);
      await this._waitForRender(actor.sheet);
    }

    return this._attachIfDetached(actor.sheet);
  }

  /**
   * Pull an application back into the main workspace if the user has detached it into its own
   * browser window (v14). Core's tour overlay and centre-screen steps are always appended to the
   * main document's body, so a step anchored inside a detached window renders a highlight and a
   * tooltip that look right but aren't actually modal. Re-attaching restores every assumption core
   * makes, and is a visible, explicable thing for a tour to do.
   * @param {foundry.applications.api.ApplicationV2} app   The application.
   * @returns {Promise<foundry.applications.api.ApplicationV2>}
   * @protected
   */
  async _attachIfDetached(app) {
    const detachedWindows = foundry.applications.detached?.windows;
    if (!detachedWindows?.size || !app.element) return app;

    // An app living in another window has a different ownerDocument than the main workspace.
    if (app.element.ownerDocument === document) return app;

    await app.attachWindow();
    await this._waitForRender(app);
    return app;
  }
}
