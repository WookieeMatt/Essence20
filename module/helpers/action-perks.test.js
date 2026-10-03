import { jest } from '@jest/globals';
import { existsSync, readdirSync, readFileSync } from 'fs';
import {
  consumeForItem, getLedger, getRemaining, getSheetContext, grantBonusAttack, isBraced, resetTurn, setBraced,
  setNextTurn, spend,
} from './action-economy.mjs';
import {
  ACTION_PERK_IDS as P, attackMatchesFilter, canUseActionPerk, describeAttack, getAttacksPerAction, getCostOptions,
  getLaughtractingBlock, getLendAssistanceGrantModes, getSecretHelperPenalty, onPowerUsed,
  resetDailyActionPerkUses,
  isHarmonyUnleashedActive, useActionPerk,
} from './action-perks.mjs';

let idCounter = 0;
const wait = jest.fn();

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
  test("Mobility makes one Sprint per turn a Free action, then Sprint costs its Standard again", async () => {
    const actor = makeActor({ items: [sourced(P.mobility, 'Mobility')] });
    setGame([actor]);

    const first = await spend(actor, 'standard', { source: 'Sprint', context: { key: 'sprint' } });
    expect(first.actionType).toBe('free');
    expect(getLedger(actor).log[0].source).toBe('Sprint (Mobility)');
    expect(getRemaining(actor).standard).toBe(1);

    const second = await spend(actor, 'standard', { source: 'Sprint', context: { key: 'sprint' } });
    expect(second.actionType).toBe('standard');
    expect(getRemaining(actor).standard).toBe(0);
  });

  test("Here To Help: the first Lend Assistance is Free, the second a Move, the third a Standard", async () => {
    const actor = makeActor({ items: [sourced(P.hereToHelp, 'Here To Help')] });
    setGame([actor]);
    const types = [];
    for (let i = 0; i < 3; i++) {
      types.push((await spend(actor, 'standard', { context: { key: 'lendAssistance' } })).actionType);
    }

    expect(types).toEqual(['free', 'move', 'standard']);
  });

  test("a fiction-dependent discount is offered, and the player's answer decides", async () => {
    const actor = makeActor({ items: [sourced(P.talentForKindness, 'A Talent for Kindness')] });
    setGame([actor]);

    wait.mockResolvedValueOnce('offer0');
    const discounted = await spend(actor, 'standard', { context: { kind: 'item' } });
    expect(discounted.actionType).toBe('move');

    // Once per round - the Standard->Move half is spent, so nothing is offered now.
    const options = getCostOptions(actor, 'standard', { kind: 'item' }, getLedger(actor));
    expect(options.offers).toHaveLength(0);

    // ...but a related Free action still costs nothing, without limit.
    expect(getCostOptions(actor, 'free', { kind: 'item' }, getLedger(actor)).offers[0].actionType).toBe('none');
  });

  test("choosing the normal cost keeps the discount for later", async () => {
    const actor = makeActor({ items: [sourced(P.detailOriented, 'Detail Oriented')] });
    setGame([actor]);
    wait.mockResolvedValueOnce('base');

    const result = await spend(actor, 'standard', { context: { key: 'useASkill' } });

    expect(result.actionType).toBe('standard');
    expect(getCostOptions(actor, 'standard', { key: 'useASkill' }, getLedger(actor)).offers).toHaveLength(1);
  });

  test("closing the dialog takes no action at all", async () => {
    const actor = makeActor({ items: [sourced(P.talentForKindness, 'A Talent for Kindness')] });
    setGame([actor]);
    wait.mockResolvedValueOnce(null);

    const result = await spend(actor, 'contingency', { context: { key: 'contingency' } });

    expect(result.blocked).toBe(true);
    expect(result.cancelled).toBe(true);
    expect(getLedger(actor).log).toHaveLength(0);
  });

  test("with prompts turned off, only the discounts the system can verify apply", () => {
    const actor = makeActor({ items: [sourced(P.talentForKindness, 'A Talent for Kindness'), sourced(P.hereToHelp, 'Here To Help')] });
    setGame([actor], { prompts: false });

    const { auto, offers } = getCostOptions(actor, 'standard', { key: 'lendAssistance' }, getLedger(actor));
    expect(offers).toHaveLength(0);
    expect(auto.actionType).toBe('free');
  });

  test("Desperate Times: a Move action for Lend Assistance only after a Standard one this round", async () => {
    const actor = makeActor({ items: [sourced(P.desperateTimes, 'Desperate Times')] });
    setGame([actor]);

    expect((await spend(actor, 'standard', { context: { key: 'lendAssistance' } })).actionType).toBe('standard');
    expect((await spend(actor, 'standard', { context: { key: 'lendAssistance' } })).actionType).toBe('move');
  });

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

  test("Secret Helper's price: no Standard, or Subtle/Stealth Helper's lighter one", () => {
    expect(getSecretHelperPenalty(makeActor())).toEqual({ block: ['standard'], prespend: {} });
    expect(getSecretHelperPenalty(makeActor({ items: [sourced(P.subtleHelper)] }))).toEqual({ block: ['move'], prespend: {} });
    expect(getSecretHelperPenalty(makeActor({ items: [sourced(P.stealthHelper)] }))).toEqual({ block: [], prespend: { free: 1 } });
  });

  test("Stealth Helper's used-up Free action is pre-spent on the next turn", async () => {
    const actor = makeActor();
    const [combatant] = setGame([actor]);

    await setNextTurn(actor, { prespend: { free: 1 } });
    await resetTurn(combatant);

    expect(getRemaining(actor).free).toBe(1);
  });

  test("Laughtracting takes Free actions; Distraughter the Move too", () => {
    expect(getLaughtractingBlock(makeActor())).toEqual(['free']);
    expect(getLaughtractingBlock(makeActor({ items: [sourced(P.distraughter)] }))).toEqual(['free', 'move']);
  });

  test("Here, Let Me / No, I Insist add Lend Assistance modes", () => {
    const actor = makeActor({ items: [sourced(P.hereLetMe), sourced(P.noIInsist)] });
    setGame([actor]);
    expect(getLendAssistanceGrantModes(actor).map(m => m.grant)).toEqual([{ move: 1 }, { standard: 1 }]);
  });
});

describe("Use buttons", () => {
  test("Motivate spends a Standard action and gives the targeted ally one now", async () => {
    const perk = sourced(P.motivate, 'Motivate');
    const officer = makeActor({ name: 'Hawk', items: [perk] });
    perk.parent = officer;
    const ally = makeActor({ name: 'Duke' });
    setGame([officer, ally], { targets: [{ actor: ally }] });

    expect(canUseActionPerk(perk)).toBe(true);
    const message = await useActionPerk(perk);

    expect(message).toBe('E20.ActionPerkUsedAlly');
    expect(getRemaining(officer).standard).toBe(0);
    expect(getRemaining(ally).standard).toBe(2);
  });

  test("Mobilize spends a Move action, not a Standard, and gives the ally a Move now", async () => {
    const perk = sourced(P.mobilize, 'Mobilize');
    const officer = makeActor({ name: 'Hawk', items: [perk] });
    perk.parent = officer;
    const ally = makeActor({ name: 'Duke' });
    setGame([officer, ally], { targets: [{ actor: ally }] });
    const before = getRemaining(officer);
    const allyBefore = getRemaining(ally);

    await useActionPerk(perk);

    expect(getRemaining(officer).standard).toBe(before.standard);
    expect(getRemaining(officer).move).toBe(before.move - 1);
    expect(getRemaining(ally).move).toBe(allyBefore.move + 1);
  });

  test("Harmony Unleashed lands on the targeted pony, or the caster with nothing targeted", async () => {
    const perk = sourced(P.harmonyUnleashed, 'Harmony Unleashed', 'spell');
    const caster = makeActor({ name: 'Twilight', items: [perk] });
    perk.parent = caster;
    const pony = makeActor({ name: 'Applejack' });
    setGame([caster, pony], { targets: [{ actor: pony }] });

    await useActionPerk(perk);
    expect(isHarmonyUnleashedActive(pony)).toBe(true);
    expect(isHarmonyUnleashedActive(caster)).toBe(false);

    const solo = sourced(P.harmonyUnleashed, 'Harmony Unleashed', 'spell');
    const self = makeActor({ name: 'Rarity', items: [solo] });
    solo.parent = self;
    setGame([self]);
    await useActionPerk(solo);
    expect(isHarmonyUnleashedActive(self)).toBe(true);
  });

  test("an ally Perk needs an ally targeted", async () => {
    const perk = sourced(P.mobilize, 'Mobilize');
    const officer = makeActor({ items: [perk] });
    perk.parent = officer;
    setGame([officer]);

    expect(await useActionPerk(perk)).toBeNull();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("no Use button outside combat", () => {
    const perk = sourced(P.motivate);
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

  test("Bullet Barrage fires every equipped ballistic weapon", () => {
    const guns = ['a', 'b', 'c'].map(id => ({ ...weapon(id, ['ballistic']), system: { traits: ['ballistic'], equipped: true } }));
    const actor = makeActor({ items: [...guns, sourced(P.bulletBarrage, 'Bullet Barrage')] });
    expect(getAttacksPerAction(actor, attackItem(actor, { weapon: guns[0] })).count).toBe(3);
  });

  test("Ground and Pound: unarmed attacks become Free and are counted for the Downshift", async () => {
    const perk = sourced(P.groundAndPound, 'Ground and Pound');
    const actor = makeActor({ items: [perk] });
    actor.toggleStatusEffect = jest.fn(async status => actor.statuses.add(status));
    perk.parent = actor;
    setGame([actor], { targets: [{ actor: makeActor({ name: 'Viper' }) }] });

    await useActionPerk(perk);
    expect(actor.statuses.has('prone')).toBe(true);

    const punch = attackItem(actor, { style: 'melee', skill: 'might' });
    await consumeForItem(punch);
    await consumeForItem(punch);

    expect(getLedger(actor).perkUses.groundAndPound).toBe(2);
    expect(getLedger(actor).standard).toBe(1);
  });

  test("Barrage Attack gives one attack per other ranged weapon", async () => {
    const feature = sourced(P.barrageAttack, 'Barrage Attack', 'feature');
    const effects = ['x', 'y', 'z'].map(id => ({ id, type: 'weaponEffect', system: { classification: { style: 'energy' } }, flags: {} }));
    const zord = makeActor({ items: [feature, ...effects], system: { powers: { personal: { value: 3 } } } });
    feature.parent = zord;
    setGame([zord]);

    await useActionPerk(feature);

    expect(getLedger(zord).bonusAttacks).toHaveLength(2);
    expect(zord.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 2 });
  });
});

describe("the last four", () => {
  test("Detail Oriented: a Finesse Use a Skill as a Move action, three times a day, back after a Rest", async () => {
    const actor = makeActor({ items: [sourced(P.detailOriented, 'Detail Oriented')] });
    setGame([actor]);
    for (let i = 0; i < 3; i++) {
      wait.mockResolvedValueOnce('offer0');
      expect((await spend(actor, 'standard', { context: { key: 'useASkill' } })).actionType).toBe('move');
    }

    expect(getCostOptions(actor, 'standard', { key: 'useASkill' }, getLedger(actor)).offers).toHaveLength(0);
    expect(await resetDailyActionPerkUses(actor)).toBe(true);
    expect(getCostOptions(actor, 'standard', { key: 'useASkill' }, getLedger(actor)).offers).toHaveLength(1);
    expect(await resetDailyActionPerkUses(actor)).toBe(false);
  });

  test("Shoot, You Fools! gives every ally an attack that costs them nothing and stings on a miss", async () => {
    const perk = sourced(P.shootYouFools, 'Shoot, You Fools!');
    const baroness = makeActor({ name: 'Baroness', items: [perk] });
    perk.parent = baroness;
    const viper = makeActor({ name: 'Viper' });
    const combatants = setGame([baroness, viper]);
    game.combat.combatants = combatants;

    const message = await useActionPerk(perk);

    expect(message).toBe('E20.ActionPerkUsedAllies');
    expect(getRemaining(baroness).standard).toBe(0);
    const result = await consumeForItem(attackItem(viper));
    expect(result.bonusAttack).toBe(true);
    expect(result.psychicOnMiss).toBe(1);
    expect(getRemaining(viper).standard).toBe(1);
  });
});

describe("powers that grant attacks", () => {
  test("Relentless Blows gives two free unarmed strikes", async () => {
    const power = sourced(P.relentlessBlows, 'Relentless Blows', 'power');
    const actor = makeActor({ items: [power] });
    setGame([actor]);

    expect(await onPowerUsed(actor, power)).toBe(true);
    expect(getLedger(actor).bonusAttacks).toHaveLength(2);
    expect(await onPowerUsed(actor, sourced('other', 'Other', 'power'))).toBe(false);
  });
});

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
  test("matches nothing, and Balance Your Enthusiasm needs its own Perk", async () => {
    const { findSourced, ACTION_PERK_IDS } = await import("./action-perks.mjs");
    const actor = { items: [{ name: 'Homebrew', flags: {} }] };
    expect(findSourced(actor, undefined)).toBeUndefined();
    expect(ACTION_PERK_IDS.balanceYourEnthusiasm).toBe('Compendium.essence20.mlp_crb.Item.0oLVEe94tZ0drQTo');
    expect(findSourced(actor, ACTION_PERK_IDS.balanceYourEnthusiasm)).toBeUndefined();
  });
});
