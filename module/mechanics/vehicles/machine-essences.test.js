import { jest } from '@jest/globals';
import {
  convertEssenceWrites, essenceAdjustedMachines, migrateMachineEssences, noticeEssenceBases, resetEssencesFromBase, usesEssenceBase,
} from './machine-essences.mjs';

function setProperty(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

beforeAll(() => {
  foundry.utils.setProperty ??= setProperty;
});

const essence = (base, value = base) => ({ base, usesDrivers: false, value });

function zord({ name = 'Rex', type = 'zord', source = { strength: essence(6), speed: essence(4) }, shown = null } = {}) {
  return {
    name, type,
    _source: { system: { essences: source } },
    system: { essences: shown ?? source },
  };
}

describe('which actors keep a base', () => {
  test('Zords and Vehicles do; Megaforms and characters do not', () => {
    expect(['zord', 'vehicle'].map(type => usesEssenceBase({ type }))).toEqual([true, true]);
    expect(['megaform', 'playerCharacter', 'npc', 'companion'].map(type => usesEssenceBase({ type }))).toEqual([false, false, false, false]);
    expect(usesEssenceBase(null)).toBe(false);
  });
});

describe('migration', () => {
  test('a stored record without a base keeps its stored number as the base, as-is', () => {
    const source = { essences: { strength: { usesDrivers: false, value: 7 }, speed: { usesDrivers: false, value: 4 }, smarts: { usesDrivers: true, value: null } } };
    expect(migrateMachineEssences(source)).toBe(true);
    expect(source.essences.strength).toEqual({ usesDrivers: false, value: 7, base: 7 });
    expect(source.essences.smarts.base).toBeNull();
  });

  test('an already-migrated record and a partial update are left alone', () => {
    const migrated = { essences: { strength: { base: 6, usesDrivers: false, value: 7 } } };
    expect(migrateMachineEssences(migrated)).toBe(false);
    expect(migrated.essences.strength.base).toBe(6);
    const partial = { essences: { strength: { value: 9 } } };
    expect(migrateMachineEssences(partial)).toBe(false);
    expect(partial.essences.strength.base).toBeUndefined();
    expect(migrateMachineEssences({})).toBe(false);
  });
});

describe('prep', () => {
  test('each value starts from its base before effects apply', () => {
    const system = { essences: { strength: essence(6, 9), speed: essence(4, 5), smarts: { usesDrivers: true, value: null } } };
    resetEssencesFromBase(system);
    expect(system.essences.strength.value).toBe(6);
    expect(system.essences.speed.value).toBe(4);
    expect(system.essences.smarts.value).toBeNull();
  });
});

describe('writes to the value', () => {
  test('move the base by the same amount the value moves', () => {
    // Heavy Chassis shows Strength 7 on a base of 6; a Zord Alteration writes 7 + 2.
    const actor = zord({ source: { strength: essence(6), speed: essence(4) }, shown: { strength: essence(6, 7), speed: essence(4, 4) } });
    const changed = { system: { essences: { strength: { value: 9 } } } };
    convertEssenceWrites(actor, changed);
    expect(changed.system.essences.strength.base).toBe(8);
    // The value write stays (essenceChanged Triggers read it).
    expect(changed.system.essences.strength.value).toBe(9);
    expect(changed.system.essences.speed).toBeUndefined();
  });

  test('a base in the same update wins; an old record without a base reads its value', () => {
    const actor = zord({ shown: { strength: essence(6, 7) } });
    const changed = { system: { essences: { strength: { base: 3, value: 9 } } } };
    convertEssenceWrites(actor, changed);
    expect(changed.system.essences.strength.base).toBe(3);

    const old = zord({ source: { strength: { usesDrivers: false, value: 5 } }, shown: { strength: { value: 5 } } });
    const damage = { system: { essences: { strength: { value: 3 } } } };
    convertEssenceWrites(old, damage);
    expect(damage.system.essences.strength.base).toBe(3);

    const cleared = { system: { essences: { smarts: { value: null } } } };
    convertEssenceWrites(actor, cleared);
    expect(cleared.system.essences.smarts.base).toBeNull();
  });
});

describe('the one-time GM notice', () => {
  function world(actors, { done = false, gm = true } = {}) {
    const settings = { done };
    return {
      actors,
      scenes: [{ tokens: [{ actorLink: false, actor: zord({ name: 'Token Zord', shown: { strength: essence(5, 6) } }) }, { actorLink: true, actor: actors[0] }] }],
      users: { activeGM: { isSelf: gm } },
      settings: { get: () => settings.done, set: jest.fn(async (scope, key, value) => (settings.done = value)) },
      i18n: { localize: key => key, format: (key, data) => `${data.essence} ${data.base}->${data.value}` },
    };
  }

  beforeEach(() => {
    global.ChatMessage = { create: jest.fn(), getWhisperRecipients: () => [{ id: 'gm' }] };
  });

  test('lists Zords whose Features change an Essence, once, to the GMs', async () => {
    const boosted = zord({ name: 'Heavy', shown: { strength: essence(6, 7), speed: essence(4) } });
    const plain = zord({ name: 'Plain' });
    const megaform = { name: 'Mega', type: 'megaform', system: { essences: { strength: essence(6, 9) } } };
    const game = world([boosted, plain, megaform]);
    expect(essenceAdjustedMachines(game).map(entry => entry.actor.name)).toEqual(['Heavy', 'Token Zord']);
    expect(await noticeEssenceBases(game)).toBe(true);
    const message = ChatMessage.create.mock.calls[0][0];
    expect(message.whisper).toEqual(['gm']);
    expect(message.content).toContain('Heavy');
    expect(message.content).toContain('E20.EssenceStrength 6->7');
    expect(message.content).not.toContain('Plain');
    expect(await noticeEssenceBases(game)).toBe(false);
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
  });

  test('nothing for a non-GM, or a world with nothing to report (but it is still marked done)', async () => {
    expect(await noticeEssenceBases(world([zord({ shown: { strength: essence(6, 7) } })], { gm: false }))).toBe(false);
    const quiet = world([zord()]);
    quiet.scenes = [];
    expect(await noticeEssenceBases(quiet)).toBe(false);
    expect(quiet.settings.set).toHaveBeenCalledWith('essence20', 'machineEssenceBaseNotice', true);
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });
});
