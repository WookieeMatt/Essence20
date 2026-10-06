import { jest } from '@jest/globals';

// Dominate (Quartermaster's Guide to Gear): infect, command, recall.
let dominate;
let ext;
const actors = new Map();
const rollSkill = jest.fn();
const wait = jest.fn();
const applyDamage = jest.fn(async () => 1);

function makeActor(uuid, defenses = {}) {
  const actor = {
    uuid,
    name: uuid,
    isOwner: true,
    flags: {},
    system: { defenses },
    _dice: { rollSkill },
    getActiveTokens: () => [],
    setFlag: jest.fn(async function (scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    }),
    unsetFlag: jest.fn(async function (scope, key) {
      delete this.flags[scope]?.[key];
    }),
    toggleStatusEffect: jest.fn(),
  };
  actors.set(uuid, actor);
  return actor;
}

const power = (spent = 1) => ({ system: { usesSpent: spent }, update: jest.fn() });

beforeAll(async () => {
  global.Hooks = { on: jest.fn(), once: jest.fn(), callAll: jest.fn() };
  global.game = { i18n: { localize: k => k, format: k => k }, user: { id: 'u', targets: new Set() }, combat: null };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.CONFIG = { E20: { skillToEssence: { targeting: 'speed', persuasion: 'social' }, defenses: {} } };
  global.foundry = { applications: { api: { DialogV2: { wait } } } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.fromUuid = async uuid => actors.get(uuid) ?? null;
  global.canvas = null;
  ext = await import('../../mechanics/item-hooks.mjs');
  dominate = await import('./dominate-nanomites.mjs');
});

beforeEach(() => {
  actors.clear();
  rollSkill.mockReset();
  wait.mockReset();
  ChatMessage.create.mockClear();
});

const target = actor => {
  game.user.targets = new Set([{ actor }]);
  game.user.targets.first = () => [...game.user.targets][0];
};

test('infects the targeted creature on a Targeting hit against Evasion', async () => {
  const user = makeActor('Actor.baroness');
  const victim = makeActor('Actor.duke', { evasion: { total: 13 } });
  target(victim);
  rollSkill.mockResolvedValue({ success: true });

  expect(await dominate.activateDominate(user, power())).toBe(true);
  expect(rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'targeting', dif: '13' }), user);
  expect(dominate.dominateStateOf(user)).toEqual({ victimUuid: 'Actor.duke', name: 'Actor.duke', commands: 0 });
  expect(ChatMessage.create.mock.calls[0][0].content).toContain('data-e20-ext="r2DominateCommand"');
});

test('a miss infects no one and keeps the spent use', async () => {
  const user = makeActor('Actor.baroness');
  target(makeActor('Actor.duke', { evasion: { total: 13 } }));
  rollSkill.mockResolvedValue({ success: false });
  const item = power();

  expect(await dominate.activateDominate(user, item)).toBe(false);
  expect(dominate.dominateStateOf(user)).toBeNull();
  expect(item.update).not.toHaveBeenCalled();
});

test('no target: the use is handed back', async () => {
  const user = makeActor('Actor.baroness');
  game.user.targets = new Set();
  game.user.targets.first = () => undefined;
  const item = power(2);

  await dominate.activateDominate(user, item);
  expect(item.update).toHaveBeenCalledWith({ 'system.usesSpent': 1 });
  expect(rollSkill).not.toHaveBeenCalled();
});

test('activating again with a victim infected refunds the use and offers the command card', async () => {
  const user = makeActor('Actor.baroness');
  user.flags.essence20 = { r2Dominate: { victimUuid: 'Actor.duke', name: 'Duke', commands: 0 } };
  const item = power(1);

  await dominate.activateDominate(user, item);
  expect(item.update).toHaveBeenCalledWith({ 'system.usesSpent': 0 });
  expect(rollSkill).not.toHaveBeenCalled();
  expect(ChatMessage.create.mock.calls[0][0].content).toContain('r2DominateRecall');
});

test('Command: Persuasion with Edge against the picked Defense, ↓1 per earlier command, then the effect', async () => {
  const user = makeActor('Actor.baroness');
  const victim = makeActor('Actor.duke', { willpower: { total: 12 }, cleverness: { total: 15 } });
  user.flags.essence20 = { r2Dominate: { victimUuid: 'Actor.duke', name: 'Duke', commands: 2 } };
  wait.mockResolvedValueOnce('cleverness').mockResolvedValueOnce('restrained');
  rollSkill.mockResolvedValue({ success: true });

  expect(await dominate.commandVictim(user)).toBe(true);
  expect(rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'persuasion', dif: '15', edge: true, shiftDown: 2 }), user);
  expect(victim.toggleStatusEffect).toHaveBeenCalledWith('restrained', { active: true });
  expect(dominate.dominateStateOf(user).commands).toBe(3);
});

test('Command: a failed test applies nothing', async () => {
  const user = makeActor('Actor.baroness');
  const victim = makeActor('Actor.duke', { willpower: { total: 12 } });
  user.flags.essence20 = { r2Dominate: { victimUuid: 'Actor.duke', name: 'Duke', commands: 0 } };
  wait.mockResolvedValueOnce('willpower');
  rollSkill.mockResolvedValue({ success: false });

  expect(await dominate.commandVictim(user)).toBe(false);
  expect(victim.toggleStatusEffect).not.toHaveBeenCalled();
});

test('Recall ends the hold, deals 1 damage to the user and offers the victim 1 damage', async () => {
  const user = makeActor('Actor.baroness');
  user.flags.essence20 = { r2Dominate: { victimUuid: 'Actor.duke', name: 'Duke', commands: 1 } };

  expect(await dominate.recallNanomites(user, { applyDamage })).toBe(true);
  expect(dominate.dominateStateOf(user)).toBeNull();
  expect(applyDamage).toHaveBeenCalledWith(user, 1, 'special');
  const content = ChatMessage.create.mock.calls.at(-1)[0].content;
  expect(content).toContain('data-e20-ext="o1ApplyDamage"');
  expect(content).toContain('data-target-uuid="Actor.duke"');
});

test('the chat buttons are registered', () => {
  expect(Object.keys(ext.registrySnapshot().chatButtons)).toEqual(expect.arrayContaining(['r2DominateCommand', 'r2DominateRecall']));
});
