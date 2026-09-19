/**
 * This suite needs a DOM, because the tracker marks are injected into core-rendered rows rather
 * than produced by a template this system owns - so the thing worth testing IS the resulting
 * markup. jest-environment-jsdom is already installed; the rest of the suite stays on node.
 *
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

/**
 * CombatTracker is an ApplicationV2 living under foundry.applications.sidebar.tabs, which the
 * module reads at import time - so the stub has to exist before the import, hence the dynamic
 * import below rather than a static one at the top of the file.
 */
global.foundry = {
  ...(global.foundry ?? {}),
  applications: {
    ...(global.foundry?.applications ?? {}),
    sidebar: { tabs: { CombatTracker: class CombatTracker {
      async _onRender() {}
    } } },
  },
  utils: { randomID: () => 'id1' },
};

const { Essence20CombatTracker } = await import('./combat-tracker.mjs');

function makeActor({ enabled = true, standard = 1, move = 1, free = 0 } = {}) {
  return {
    name: 'Duke',
    token: { id: 'token1' },
    system: {
      actions: {
        enabled,
        shared: false,
        standard: { base: 1, bonus: 0, max: standard },
        move: { base: 1, bonus: 0, max: move },
        free: { base: 0, bonus: 0, max: free },
      },
    },
  };
}

function makeCombatant(actor, flags = {}) {
  return {
    actor,
    tokenId: 'token1',
    isOwner: true,
    group: null,
    getFlag: (scope, key) => flags[key],
    setFlag: async (scope, key, value) => {
      flags[key] = value;
    },
  };
}

function setGame({ combatant = null, mode = 'track' } = {}) {
  global.game = {
    user: { isGM: false },
    i18n: { localize: jest.fn(key => key) },
    settings: { get: jest.fn((scope, key) => (key === 'actionEconomyMode' ? mode : undefined)) },
    combat: combatant
      ? { combatants: [combatant], getCombatantsByActor: () => [combatant] }
      : null,
  };
}

/**
 * A tracker whose element is a real DOM fragment holding one combatant row, so the injection can
 * be exercised against the markup core actually renders.
 */
function makeTracker(combatant) {
  const tracker = new Essence20CombatTracker();
  const root = document.createElement('div');
  root.innerHTML = `
    <ol class="combat-tracker">
      <li class="combatant" data-combatant-id="c1">
        <img class="token-image" />
        <div class="token-name"><strong class="name">Duke</strong></div>
      </li>
    </ol>`;
  tracker.element = root;
  Object.defineProperty(tracker, 'viewed', {
    value: combatant ? { combatants: { get: () => combatant } } : null,
    configurable: true,
  });

  return tracker;
}

describe("_renderActionMarks", () => {
  test("adds a strip of pips under the combatant's name", () => {
    const actor = makeActor();
    const combatant = makeCombatant(actor);
    setGame({ combatant });

    const tracker = makeTracker(combatant);
    tracker._renderActionMarks();

    const strip = tracker.element.querySelector('.e20-tracker-actions');
    expect(strip).not.toBeNull();
    expect(strip.parentElement.classList.contains('token-name')).toBe(true);
    expect(strip.querySelectorAll('.e20-tracker-actions__pip')).toHaveLength(2);
  });

  test("marks spent actions without removing them, so the starting budget stays visible", async () => {
    const actor = makeActor();
    const combatant = makeCombatant(actor);
    setGame({ combatant });
    const { spend } = await import('../helpers/action-economy.mjs');
    await spend(actor, 'standard');

    const tracker = makeTracker(combatant);
    tracker._renderActionMarks();

    expect(tracker.element.querySelectorAll('.e20-tracker-actions__pip')).toHaveLength(2);
    expect(tracker.element.querySelectorAll('.e20-tracker-actions__pip--spent')).toHaveLength(1);
  });

  test("draws nothing when the world isn't tracking", () => {
    const combatant = makeCombatant(makeActor());
    setGame({ combatant, mode: 'off' });

    const tracker = makeTracker(combatant);
    tracker._renderActionMarks();

    expect(tracker.element.querySelector('.e20-tracker-actions')).toBeNull();
  });

  test("draws nothing for an actor that opted out", () => {
    const combatant = makeCombatant(makeActor({ enabled: false }));
    setGame({ combatant });

    const tracker = makeTracker(combatant);
    tracker._renderActionMarks();

    expect(tracker.element.querySelector('.e20-tracker-actions')).toBeNull();
  });

  test("skips a row whose combatant has no actor", () => {
    setGame({ combatant: makeCombatant(makeActor()) });
    const tracker = makeTracker({ actor: null });

    expect(() => tracker._renderActionMarks()).not.toThrow();
    expect(tracker.element.querySelector('.e20-tracker-actions')).toBeNull();
  });

  // A category with no budget this turn would otherwise draw an empty gap that reads as a fault.
  test("omits a category the actor has none of this turn", () => {
    const combatant = makeCombatant(makeActor({ free: 0 }));
    setGame({ combatant });

    const tracker = makeTracker(combatant);
    tracker._renderActionMarks();

    const groups = tracker.element.querySelectorAll('.e20-tracker-actions__group');
    expect([...groups].map(g => g.dataset.category)).toEqual(['standard', 'move']);
  });

  test("includes a Free action group once the actor has any", () => {
    const combatant = makeCombatant(makeActor({ free: 2 }));
    setGame({ combatant });

    const tracker = makeTracker(combatant);
    tracker._renderActionMarks();

    const groups = tracker.element.querySelectorAll('.e20-tracker-actions__group');
    expect([...groups].map(g => g.dataset.category)).toEqual(['standard', 'move', 'free']);
  });

  test("re-rendering replaces the strip rather than stacking a second one", () => {
    const combatant = makeCombatant(makeActor());
    setGame({ combatant });

    const tracker = makeTracker(combatant);
    tracker._renderActionMarks();
    tracker._renderActionMarks();

    expect(tracker.element.querySelectorAll('.e20-tracker-actions')).toHaveLength(1);
  });

  test("a turn consumed by a Whole Turn action is dimmed and says so", async () => {
    const actor = makeActor();
    const combatant = makeCombatant(actor);
    setGame({ combatant });
    const { resetTurn, spend } = await import('../helpers/action-economy.mjs');
    await spend(actor, 'wholeTurn');
    await resetTurn(combatant);

    const tracker = makeTracker(combatant);
    tracker._renderActionMarks();

    const strip = tracker.element.querySelector('.e20-tracker-actions');
    expect(strip.classList.contains('e20-tracker-actions--skipped')).toBe(true);
    expect(strip.dataset.tooltip).toBe('E20.ActionEconomyTurnSkipped');
  });

  test("the tooltip reports remaining over maximum per category", () => {
    const combatant = makeCombatant(makeActor());
    setGame({ combatant });

    const tracker = makeTracker(combatant);
    tracker._renderActionMarks();

    expect(tracker.element.querySelector('.e20-tracker-actions').dataset.tooltip)
      .toContain('1/1');
  });
});
