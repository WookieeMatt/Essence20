import { jest } from '@jest/globals';
import { legacyPoolParty } from '../../jest.legacy-pool-party.js';
import { canUsePerk, onPerkUse } from './banked-buffs.mjs';

const GUIDANCE_ID = "Compendium.essence20.gi_joe_crb.Item.yVxdYbSfMWfaDQZR";

global.canvas = {
  tokens: { placeables: [], setTargets: jest.fn() },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};
global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
global.game = {
  combat: null, i18n: { localize: (k) => k, format: (k) => k }, user: { targets: new Set() },
  users: [{ isGM: true, active: true }], socket: { emit: jest.fn() },
  actors: { party: legacyPoolParty() },
};
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor({ id = 'actor1', name = 'Actor' } = {}) {
  return {
    id, name, items: [], getFlag: jest.fn(() => undefined), setFlag: jest.fn(), unsetFlag: jest.fn(),
    getActiveTokens: jest.fn(() => []),
  };
}

function makePerkItem({ sourceId, actor, currentValue = null }) {
  return {
    type: 'perk',
    name: 'Test Perk',
    parent: actor,
    flags: { core: { sourceId } },
    system: { advances: { currentValue } },
  };
}

describe("canUsePerk", () => {
  test("false for a Perk not in the bankable table", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: "Compendium.essence20.gi_joe_crb.Item.other", actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("false for a non-perk item", () => {
    const actor = makeActor();
    const item = { type: 'weapon', parent: actor, flags: { core: { sourceId: GUIDANCE_ID } } };
    expect(canUsePerk(item)).toBe(false);
  });

  test("false when the item has no parent actor", () => {
    const item = makePerkItem({ sourceId: GUIDANCE_ID, actor: null });
    expect(canUsePerk(item)).toBe(false);
  });

});

describe("onPerkUse", () => {
  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockReset();
  });

  test("does nothing for a Perk not in the bankable table", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: "Compendium.essence20.gi_joe_crb.Item.other", actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

// Guidance and Environmental Expertise are Use rules on their Perks (rules/conv15-items2.test.js).

// Trade School is item rules on its Perk (rules/conv17-perm.test.js).

// Relic Key is its Feature's own rules (rules/conv15-items2.test.js).

// Help Yourself's clone is the spell's own rules (rules/conv15-items2.test.js).

// (Growl is a Use rule on its Perk - rules/conv16-LeftA.test.js.)

// Fearsome Presence is a Use rule on its Perk (rules/conv10-slB10.test.js).

describe("Nu, Pogodi!'s own condition-removal clause (Factions in Action Vol. 2, Oktober Guard Faction Perk, p.68)", () => {
  const NU_POGODI_ID = "Compendium.essence20.intercontinental_adventures.Item.sItc8nD7ockbQ1mn";

  function makeNuPogodiActor({ statuses = ['frightened'] } = {}) {
    const flagStore = {};
    return {
      ...makeActor(),
      statuses: new Set(statuses),
      toggleStatusEffect: jest.fn(),
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };
  }

  beforeEach(() => {
    global.ChatMessage.create.mockReset();
    foundry.applications.api.DialogV2.wait.mockReset();
    game.combat = { id: 'combat1' };
  });

  afterEach(() => {
    game.combat = null;
  });

  test("canUsePerk is true when not yet used this encounter", () => {
    expect(canUsePerk(makePerkItem({
      sourceId: NU_POGODI_ID, actor: makeNuPogodiActor(),
    }))).toBe(true);
  });

  test("removes the chosen Condition and notifies", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('frightened');
    const actor = makeNuPogodiActor({ statuses: ['frightened'] });
    const item = makePerkItem({ sourceId: NU_POGODI_ID, actor });

    await onPerkUse(item);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(global.ChatMessage.create).toHaveBeenCalled();
    expect(canUsePerk(item)).toBe(false);
  });
});
