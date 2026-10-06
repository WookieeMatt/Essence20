import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Batch slA9 (docs/rules-batches/slA9.md): the zord1 / zord2 / pr1 / pr2 / pr3 slice items re-checked
 * against the round-9 engine pieces. Converted: Aim Apparatus (an added Trigger picks a Player Character,
 * legacy-read from the old flag, and steps their Targeting up one rank capped at d12 through `to: picked`;
 * a removed Trigger steps it back down) and Protector of Safehaven (a once-per-mission Use: a Limited weapon,
 * tracked 1 Temporary Health, or a mission-long mark two Roll Options switches read). Each is loaded from its
 * pack source and must do what the removed slice code did.
 */

// The picker / grant helpers the pick and pickGrant steps use, and the resource slice's temporary Health
// ledger the tracked heal goes through. (Mocked paths resolve from module/jest.setup.js.)
const chooseSelect = jest.fn();
const findItems = jest.fn();
const pickOne = jest.fn();
const grantCopy = jest.fn();
const grantTemp = jest.fn();
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({ chooseSelect, findItems, pickOne, grantCopy, rollTest: jest.fn(), markIntegrated: jest.fn() }));
jest.unstable_mockModule('./mechanics/resources/temporary-resources.mjs', () => ({ grantTemp }));

const { rebuildIndex } = await import('./index.mjs');
const { fireItemAdded, runUse } = await import('./triggers.mjs');
const { ruleDialogSwitches } = await import('./adapter.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');
const { validateRule } = await import('./types.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  aim: 'prcrbitems/_source/Aim_Apparatus_8Kyl6XMzRCZGBzbW.json',
  safehaven: 'ttsgitems/_source/Protector_of_Safehaven_YJRejmHoASYm67lQ.json',
};

let nextId = 1;
let missionEpoch = 1;

const getPath = (object, key) => key.split('.').reduce((o, k) => o?.[k], object);
function setPath(object, key, value) {
  const deletion = key.match(/^(.*)\.-=(.+)$/);
  if (deletion) {
    delete getPath(object, deletion[1])?.[deletion[2]];
    return;
  }

  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

function asItem(data, actor) {
  const item = {
    id: `i${nextId++}`, flags: {}, system: {}, isOwner: true, ...data, parent: actor,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

function makeActor(type = 'playerCharacter', name = 'Ranger', system = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { health: { value: 5, max: 10, bonus: 0 }, ...system },
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    }),
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  game.actors.contents.push(actor);
  return actor;
}

function addPackItem(actor, file, extra = {}) {
  const doc = fromPack(file);
  const item = asItem({
    name: doc.name, type: doc.type, system: { ...doc.system }, flags: extra.flags ?? {},
    _stats: { compendiumSource: `Compendium.essence20.x.Item.${doc._id}` },
  }, actor);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

beforeEach(() => {
  const contents = [];
  missionEpoch = 1;
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null },
    settings: { get: (scope, key) => (String(key).toLowerCase().includes('mission') ? missionEpoch : 1), set: async () => {} },
    actors: { contents, get: id => contents.find(actor => actor.id == id), [Symbol.iterator]: () => contents[Symbol.iterator]() },
    i18n: { localize: k => k, format: k => k },
  };
  global.fromUuidSync = uuid => contents.find(actor => actor.uuid == uuid) ?? null;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath },
  };
  for (const mock of [chooseSelect, findItems, pickOne, grantCopy, grantTemp]) {
    mock.mockReset();
  }
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fromUuidSync;
});

const lines = () => ChatMessage.create.mock.calls.map(([data]) => data.content).join(' ');

test('every rule added in this batch is valid', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

/* -------------------------------------------- */
/*  Aim Apparatus (pr2/team.mjs)                 */
/* -------------------------------------------- */

describe('Aim Apparatus: the picked Player Character gains a Targeting rank (never past d12), given back on removal', () => {
  function setup(shift = 'd20', flags = {}) {
    const holder = makeActor('playerCharacter', 'Blue', { skills: { targeting: { shift: 'd6' } } });
    const mate = makeActor('playerCharacter', 'Mate', { skills: { targeting: { shift } } });
    makeActor('npc', 'Putty');
    makeActor('zord', 'Zord');
    const perk = addPackItem(holder, FILES.aim, { flags });
    return { holder, mate, perk };
  }

  test('added: offers every Player Character (the holder too), steps the pick up one rank and posts it', async () => {
    const { holder, mate, perk } = setup('d20');
    chooseSelect.mockImplementation(async () => mate.uuid);
    await fireItemAdded(holder, perk);
    expect(chooseSelect.mock.calls[0][2].map(o => o.label)).toEqual(['Blue', 'Mate']);
    expect(mate.system.skills.targeting.shift).toBe('d2');
    expect(holder.system.skills.targeting.shift).toBe('d6');
    expect(perk.flags.essence20.rules.choices.target).toBe(mate.uuid);
    expect(lines()).toContain(`@UUID[${mate.uuid}] gains a level in Targeting (from Blue)`);
  });

  test('capped at d12 (the old stepShift: d12 stays, 2d8 comes back to d12)', async () => {
    for (const [from, to] of [['d12', 'd12'], ['d10', 'd12'], ['2d8', 'd12']]) {
      const { holder, mate, perk } = setup(from);
      chooseSelect.mockImplementation(async () => mate.uuid);
      await fireItemAdded(holder, perk);
      expect(mate.system.skills.targeting.shift).toBe(to);
    }
  });

  test('picking yourself raises your own Targeting', async () => {
    const { holder, perk } = setup();
    chooseSelect.mockImplementation(async () => holder.uuid);
    await fireItemAdded(holder, perk);
    expect(holder.system.skills.targeting.shift).toBe('d8');
  });

  test('a cancelled pick changes nothing', async () => {
    const { holder, mate, perk } = setup('d4');
    chooseSelect.mockImplementation(async () => null);
    await fireItemAdded(holder, perk);
    expect(mate.system.skills.targeting.shift).toBe('d4');
    expect(holder.system.skills.targeting.shift).toBe('d6');
  });

  test('a copy that already carries a pick (old flag or rules choice) asks nothing and steps nothing', async () => {
    const { holder, mate, perk } = setup('d4', { essence20: { pr2AimApparatusTarget: 'placeholder' } });
    perk.flags.essence20.pr2AimApparatusTarget = mate.uuid;
    await fireItemAdded(holder, perk);
    const second = addPackItem(holder, FILES.aim, { flags: { essence20: { rules: { choices: { target: mate.uuid } } } } });
    await fireItemAdded(holder, second);
    expect(chooseSelect).not.toHaveBeenCalled();
    expect(mate.system.skills.targeting.shift).toBe('d4');
  });

  test('the old flag moves over through the linking pass', () => {
    const { holder, mate, perk } = setup('d4', { essence20: { pr2AimApparatusTarget: 'placeholder' } });
    perk.flags.essence20.pr2AimApparatusTarget = mate.uuid;
    expect(legacyChoiceUpdates(holder)).toEqual([{ _id: perk.id, 'flags.essence20.rules.choices.target': mate.uuid }]);
  });

  test('removed: the picked actor steps back down one rank (never below d20); no pick, nothing', async () => {
    const { holder, mate, perk } = setup('d2');
    setPath(perk, 'flags.essence20.rules.choices.target', mate.uuid);
    await fireItemAdded(holder, perk, { event: 'removed' });
    expect(mate.system.skills.targeting.shift).toBe('d20');
    await fireItemAdded(holder, perk, { event: 'removed' });
    expect(mate.system.skills.targeting.shift).toBe('d20');
    mate.system.skills.targeting.shift = '3d6';
    await fireItemAdded(holder, perk, { event: 'removed' });
    expect(mate.system.skills.targeting.shift).toBe('d12');

    const other = setup('d8');
    await fireItemAdded(other.holder, other.perk, { event: 'removed' });
    expect(other.mate.system.skills.targeting.shift).toBe('d8');
    expect(other.holder.system.skills.targeting.shift).toBe('d6');
  });
});

/* -------------------------------------------- */
/*  Protector of Safehaven (pr3/ttsg.mjs)        */
/* -------------------------------------------- */

describe('Protector of Safehaven: once per mission, one gift', () => {
  const chooseOption = label => async (step, options) => options.findIndex(option => option.label == label);
  const pay = async () => true;

  function setup() {
    const ranger = makeActor('playerCharacter', 'Ranger');
    const perk = addPackItem(ranger, FILES.safehaven);
    const switches = (ctx) => ruleDialogSwitches(ranger, ctx).map(entry => entry.label);
    return { ranger, perk, switches };
  }

  test('the weapon: a Limited weapon picked and granted (by the Perk); cancelled, the use is not spent', async () => {
    const { ranger, perk } = setup();
    findItems.mockResolvedValue([{ uuid: 'Compendium.x.Item.blaster', name: 'Blaster' }]);
    pickOne.mockResolvedValueOnce(null);
    expect(await runUse(perk, pay, { ask: chooseOption('A Limited weapon') })).toBeNull();
    expect(grantCopy).not.toHaveBeenCalled();

    pickOne.mockResolvedValueOnce('Compendium.x.Item.blaster');
    grantCopy.mockResolvedValueOnce({ name: 'Blaster' });
    const line = await runUse(perk, pay, { ask: chooseOption('A Limited weapon') });
    expect(findItems.mock.calls[0][0]).toMatchObject({ type: 'weapon', availabilities: ['limited'] });
    expect(grantCopy).toHaveBeenCalledWith(ranger, 'Compendium.x.Item.blaster', expect.objectContaining({ grantedBy: perk }));
    expect(line).toContain('is welcomed in Safehaven: a Limited weapon.');
    // Once per mission: the button is gone until the mission advances.
    expect(await runUse(perk, pay, { ask: chooseOption('+11 Wealth Bonus') })).toBeNull();
    missionEpoch = 2;
    expect(await runUse(perk, pay, { ask: chooseOption('+11 Wealth Bonus') })).toContain('+11 Wealth Bonus');
  });

  test('1 Temporary Health goes through the temporary Health ledger', async () => {
    const { ranger, perk } = setup();
    await runUse(perk, pay, { ask: chooseOption('1 Temporary Health') });
    expect(grantTemp).toHaveBeenCalledWith(ranger, expect.objectContaining({ kind: 'health', amount: 1, untilDamage: false }));
  });

  test('upgrade: Edge on Technology rolls this mission; social: ↑1 on Social rolls this mission', async () => {
    const { ranger, perk, switches } = setup();
    expect(switches({ rolledSkill: 'technology', rolledEssence: 'smarts' })).toEqual([]);
    await runUse(perk, pay, { ask: chooseOption('Edge on weapon upgrades') });
    const upgrade = ruleDialogSwitches(ranger, { rolledSkill: 'technology', rolledEssence: 'smarts' });
    expect(upgrade.map(entry => entry.label)).toEqual(['Safehaven: weapon upgrade attempt (Edge)']);
    expect(switches({ rolledSkill: 'persuasion', rolledEssence: 'social' })).toEqual([]);
    expect(switches({ rolledSkill: 'science', rolledEssence: 'smarts' })).toEqual([]);

    // The next mission: the mark is gone, and the other gift may be chosen.
    missionEpoch = 2;
    expect(switches({ rolledSkill: 'technology', rolledEssence: 'smarts' })).toEqual([]);
    await runUse(perk, pay, { ask: chooseOption('↑1 Social with residents') });
    expect(switches({ rolledSkill: 'persuasion', rolledEssence: 'social' })).toEqual(['Safehaven: with Safehaven residents (↑1)']);
    expect(switches({ rolledSkill: 'technology', rolledEssence: 'smarts' })).toEqual([]);
  });
});
