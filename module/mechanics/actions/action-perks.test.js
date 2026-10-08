import { jest } from '@jest/globals';
import { existsSync, readdirSync, readFileSync } from 'fs';
import {
  consumeForItem, getLedger, getRemaining, getSheetContext, grantBonusAttack, isBraced, resetTurn, setBraced,
  setNextTurn, spend,
} from './action-economy.mjs';
import {
  attackMatchesFilter, canUseActionPerk, describeAttack, getAttacksPerAction,
} from './action-perks.mjs';

// The pack items whose AttackCount rules these tests exercise (action-perks.mjs's old ACTION_PERK_IDS - nothing in
// the module read them any more).
const P = {
  extraAttack: 'Compendium.essence20.gi_joe_crb.Item.aQjUa46mn4kHvsVO',
  prExtraAttack: 'Compendium.essence20.pr_crb.Item.mtwdgpBBU7zNXnTh',
  bangBang: 'Compendium.essence20.tf_crb.Item.IYvmwPoPLXWPpSp5',
};

let idCounter = 0;
const wait = jest.fn();
const MOTOR_LANCER = "Compendium.essence20.intercontinental_adventures.Item.YaFY9NhcpZPXdvv0";

global.foundry = {
  utils: {
    randomID: jest.fn(() => `id${++idCounter}`),
    escapeHTML: s => s,
  },
  applications: { api: { DialogV2: { wait } } },
};

function makeCombatant(actor = null, tokenId = 'token1') {
  const flags = {};
  return {
    actor,
    tokenId,
    isOwner: true,
    uuid: `Combat.c1.Combatant.${tokenId}`,
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

// An item built from a compendium id carries that pack item's rules (AttackCount and the rest), the
// way a real copy inherits them.
const PACK_RULES = new Map();
for (const dir of readdirSync('packs')) {
  const src = `packs/${dir}/_source`;
  if (existsSync(src)) {
    for (const file of readdirSync(src).filter(name => name.endsWith('.json'))) {
      PACK_RULES.set(file.slice(-21, -5), src + '/' + file);
    }
  }
}

const packRules = uuid => {
  const file = PACK_RULES.get(String(uuid ?? '').split('.').pop());
  return file ? JSON.parse(readFileSync(file, 'utf8')).system?.rules ?? [] : [];
};

let nextSourced = 1;
const sourced = (uuid, name = 'Perk', type = 'perk', system = {}) => ({
  id: `src${nextSourced++}`, type, name, system: { rules: packRules(uuid), ...system }, flags: { core: { sourceId: uuid } },
});

function makeActor({ items = [], name = 'Duke', standard = 1, move = 1, free = 2, system = {}, id = null } = {}) {
  const flags = {};
  const list = [...items];
  list.get = key => list.find(i => i.id == key);
  return {
    id: id ?? name,
    name,
    items: list,
    token: { id: `${name}-token` },
    statuses: new Set(),
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[key];
    }),
    update: jest.fn(),
    system: {
      level: 5,
      essences: { smarts: { value: 3 }, social: { value: 2 } },
      actions: {
        enabled: true,
        standard: { max: standard },
        move: { max: move },
        free: { max: free },
      },
      ...system,
    },
  };
}

/**
 * One combat, one combatant per actor.
 */
function setGame(actors = [], { prompts = true, targets = [] } = {}) {
  const combatants = actors.map(actor => makeCombatant(actor, actor.token.id));
  global.game = {
    user: { id: 'u1', isGM: true, isActiveGM: true, targets: { size: targets.length, first: () => targets[0] } },
    i18n: { localize: jest.fn(key => key), format: jest.fn(key => key) },
    settings: {
      get: jest.fn((scope, key) => {
        if (key == 'actionEconomyMode') return 'track';
        if (key == 'actionPerkPrompts') return prompts;
        return undefined;
      }),
    },
    combat: {
      id: 'c1', round: 1, turn: 0, combatants, turns: combatants,
      getCombatantsByActor: jest.fn(actor => combatants.filter(c => c.actor === actor)),
    },
    socket: { emit: jest.fn() },
  };
  return combatants;
}

const attackItem = (actor, { weapon = null, name = 'Shot', style = 'projectile', skill = 'targeting' } = {}) => ({
  name,
  type: 'weaponEffect',
  actor,
  flags: { essence20: { parentId: weapon?.id ?? null } },
  system: { actionType: 'standard', classification: { style, skill } },
});

const weapon = (id, traits = [], size = 'medium') => ({ id, type: 'weapon', name: id, system: { traits, size } });

beforeEach(() => {
  idCounter = 0;
  wait.mockReset();
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
});

describe("cost rules", () => {
  test("no Perk, no dialog and no change", async () => {
    const actor = makeActor();
    setGame([actor]);

    const result = await spend(actor, 'standard', { context: { key: 'defend' } });

    expect(wait).not.toHaveBeenCalled();
    expect(result.actionType).toBe('standard');
  });
});

describe("several attacks per Attack action", () => {
  test("Bang Bang: the second ballistic attack rides on the first Attack action", async () => {
    const gun = weapon('gun', ['ballistic']);
    const actor = makeActor({ items: [gun, sourced(P.bangBang, 'Bang Bang')] });
    setGame([actor]);
    const shot = attackItem(actor, { weapon: gun });

    await consumeForItem(shot);
    const second = await consumeForItem(shot);
    await consumeForItem(shot);

    expect(second.chained).toBe(true);
    expect(getLedger(actor).standard).toBe(2);
  });

  test("the free attacks have to match the weapon rule that granted them", async () => {
    const gun = weapon('gun', ['ballistic']);
    const actor = makeActor({ items: [gun, sourced(P.bangBang, 'Bang Bang')] });
    setGame([actor]);

    await consumeForItem(attackItem(actor, { weapon: gun }));
    const punch = await consumeForItem(attackItem(actor, { style: 'melee', skill: 'might' }));

    expect(punch.chained).toBeUndefined();
    expect(getLedger(actor).standard).toBe(2);
  });

  test("Extra Attack counts its advances; PR's only works Morphed", () => {
    const extra = sourced(P.extraAttack, 'Extra Attack', 'perk', { advances: { currentValue: 2 } });
    const gij = makeActor({ items: [extra] });
    expect(getAttacksPerAction(gij, attackItem(gij)).count).toBe(3);

    const ranger = makeActor({ items: [sourced(P.prExtraAttack, 'Extra Attack')] });
    expect(getAttacksPerAction(ranger, attackItem(ranger)).count).toBe(1);
    ranger.system.isMorphed = true;
    expect(getAttacksPerAction(ranger, attackItem(ranger)).count).toBe(2);
  });

  test("attackMatchesFilter and describeAttack read the weapon in hand", () => {
    const blade = weapon('blade', ['silent', 'martialArts'], 'light');
    const actor = makeActor({ items: [blade] });
    const attack = describeAttack(actor, attackItem(actor, { weapon: blade, style: 'melee', skill: 'finesse' }));

    expect(attackMatchesFilter({ silentMartialArts: true }, attack)).toBe(true);
    expect(attackMatchesFilter({ ballistic: true }, attack)).toBe(false);
    expect(attackMatchesFilter(null, attack)).toBe(true);
    expect(describeAttack(actor, attackItem(actor)).unarmed).toBe(true);
  });
});

describe("bonus attacks and the next turn", () => {
  test("a granted bonus attack is used by the next matching attack, at its own cost", async () => {
    const actor = makeActor();
    setGame([actor]);
    await grantBonusAttack(actor, { source: 'Ready for Action', cost: 'free' });

    const result = await consumeForItem(attackItem(actor));

    expect(result.bonusAttack).toBe(true);
    expect(getRemaining(actor)).toEqual({ standard: 1, move: 1, free: 1 });
    expect(getSheetContext(actor).freeAttacks).toBe(0);
  });

  test("next-turn grants and blocks land when that turn starts", async () => {
    const actor = makeActor();
    const [combatant] = setGame([actor]);

    await setNextTurn(actor, { grant: { standard: 1 } }, 'No, I Insist');
    await setNextTurn(actor, { block: ['free'] }, 'Laughtracting');
    expect(getRemaining(actor)).toEqual({ standard: 1, move: 1, free: 2 });

    await resetTurn(combatant);
    expect(getRemaining(actor)).toEqual({ standard: 2, move: 1, free: 0 });

    await resetTurn(combatant);
    expect(getRemaining(actor)).toEqual({ standard: 1, move: 1, free: 2 });
  });

  // Secret Helper's price is grantNextTurn steps on its CardOffer rule (rules/conv15-items2.test.js).

  test("Stealth Helper's used-up Free action is pre-spent on the next turn", async () => {
    const actor = makeActor();
    const [combatant] = setGame([actor]);

    await setNextTurn(actor, { prespend: { free: 1 } });
    await resetTurn(combatant);

    expect(getRemaining(actor).free).toBe(1);
  });

});

describe("Use buttons", () => {
  test("no Use button outside combat", () => {
    // Motor Lancer's switch (items/attacks/weapon-perk-uses.mjs) is a combat-only Use.
    const perk = sourced(MOTOR_LANCER);
    perk.parent = makeActor();
    global.game = { combat: null };
    expect(canUseActionPerk(perk)).toBe(false);
  });
});

describe("the second batch", () => {
  test("Fast Trigger adds a ranged attack on top of Extra Attack", () => {
    const extra = sourced(P.extraAttack, 'Extra Attack', 'perk', { advances: { currentValue: 1 } });
    const actor = makeActor({ items: [extra] });
    actor.getFlag = jest.fn((scope, key) => (key == 'powerAdaptationActive' ? { fastTrigger: true } : undefined));

    expect(getAttacksPerAction(actor, attackItem(actor)).count).toBe(3);
    expect(getAttacksPerAction(actor, attackItem(actor, { style: 'melee', skill: 'might' })).count).toBe(2);
  });

});

// Detail Oriented (three Finesse Use a Skill tests a day as a Move action) is an ActionCost rule now
// (rules/conv12-slI12.test.js). Shoot, You Fools!, Motivate, Mobilize, Momentum, Mobility, Bullet Barrage and
// Balance Your Enthusiasm are item rules too (rules/conv14-systems.test.js).

describe("bracing", () => {
  test("Brace lasts the turn; a bipod brace lasts until the actor moves", async () => {
    const actor = makeActor();
    const [combatant] = setGame([actor]);

    await setBraced(actor, true);
    expect(isBraced(actor)).toBe(true);
    await resetTurn(combatant);
    expect(isBraced(actor)).toBe(false);

    await setBraced(actor, true, { untilMoved: true });
    await resetTurn(combatant);
    expect(isBraced(actor)).toBe(true);
    await setBraced(actor, false);
    expect(isBraced(actor)).toBe(false);
  });

  test("a Prone actor counts as braced", () => {
    const actor = makeActor();
    setGame([actor]);
    actor.statuses.add('prone');
    expect(isBraced(actor)).toBe(true);
  });
});

// A table entry naming an id it never defined used to match any item without a source (findSourced
// with undefined) - Curb Your Enthusiasm was offered as a Move action to nearly everyone.
describe("findSourced with no id", () => {
  test("matches nothing", async () => {
    const { findSourced } = await import("./action-perks.mjs");
    const actor = { items: [{ name: 'Homebrew', flags: {} }] };
    expect(findSourced(actor, undefined)).toBeUndefined();
  });
});

// Favorite Command's code entry (the pet's Perk) and the WTNV printing's own ActionCost rule (a commander holding it)
// ask the same question for the same cost - only one offer may reach the player (audit fix 2026-10-07).
describe("the same discount offered twice", () => {
  test("two offers with the same question and the same cost become one", async () => {
    const { getCostOptions } = await import("./action-perks.mjs");
    const { registerCostRuleProvider } = await import("../item-hooks.mjs");
    let on = true;
    const twin = id => ({ id, label: id, has: () => true, matches: ctx => ctx?.key == 'commandPet', to: () => 'move', ask: 'E20.ActionPerkAskFavoriteCommand' });
    registerCostRuleProvider(() => (on ? [twin('Favorite Command (rule)'), twin('Favorite Command (again)')] : []));
    const actor = makeActor({ items: [] });
    setGame([actor]);

    const { offers } = getCostOptions(actor, 'standard', { key: 'commandPet' }, null);
    on = false;
    expect(offers.map(offer => offer.label)).toEqual(['Favorite Command (rule)']);
    expect(offers[0].actionType).toBe('move');
  });
});
