import { jest } from '@jest/globals';
import { checkAttached, checkPrerequisites, describePrerequisite, prerequisitesOf, recheck } from './prerequisites.mjs';

const hero = (extra = {}) => ({
  name: 'Hero',
  statuses: new Set(),
  system: {
    level: 4,
    size: 'common',
    skills: { might: { shift: 'd6' }, finesse: { shift: 'd4' } },
    essences: { smarts: { max: 3 } },
    trained: { armors: { heavy: false } },
    ...extra,
  },
  items: [{ name: 'Favorite Command', type: 'perk' }],
});
const perk = (when, extra = {}) => ({ name: 'Big Perk', type: 'perk', flags: {}, system: { prerequisites: { when } }, ...extra });

let settings;
beforeEach(() => {
  settings = { prerequisiteMode: 'warn' };
  global.game = {
    settings: { get: (scope, key) => settings[key] },
    i18n: { localize: key => key, format: (key, data) => `${key} ${JSON.stringify(data)}` },
    user: { isGM: false, name: 'Player' },
    users: Object.assign([{ id: 'gm', isGM: true }, { id: 'p', isGM: false }], { activeGM: { isSelf: true } }),
  };
  global.ChatMessage = { create: jest.fn() };
  global.ui = { notifications: { warn: jest.fn() } };
});

describe('checking', () => {
  test('met, unmet, GM questions and host checks still waiting', () => {
    const when = [
      'self:level>=3',
      { any: ['self:skill:might>=d6', 'self:skill:finesse>=d6'] },
      'self:essence:smarts>=4',
      'ask:GM approval',
      'host:trait:computerized',
    ];
    const result = checkPrerequisites(hero(), perk(when));
    expect(result).toEqual({ met: false, unmet: ['Smarts 4+'], asks: ['GM approval'], waiting: ['Attached to: trait computerized'] });
    expect(checkPrerequisites(hero(), perk(['host:trait:computerized']), { host: { type: 'weapon', system: { traits: ['computerized'] } } }).met).toBe(true);
    expect(checkPrerequisites(hero(), perk([])).met).toBe(true);
    expect(checkPrerequisites(hero(), perk(['self:hasType:perk:Favorite Command'])).met).toBe(true);
    expect(checkPrerequisites(hero(), perk(['self:hasType:origin:Favorite Command'])).met).toBe(false);
    expect(prerequisitesOf({ system: {} })).toEqual([]);
  });

  test('plain words', () => {
    expect(describePrerequisite('self:level>=5')).toBe('Level 5+');
    expect(describePrerequisite('self:level<=4')).toBe('Level 4 or lower');
    expect(describePrerequisite('self:skill:spaceshipPiloting>=d6')).toBe('Spaceship Piloting d6+');
    expect(describePrerequisite('self:size>=huge')).toBe('Size Huge or larger');
    expect(describePrerequisite('self:has:Favorite Command')).toBe('Has Favorite Command');
    expect(describePrerequisite('self:hasType:influence:Athletic')).toBe('Has Athletic (influence)');
    expect(describePrerequisite('self:count:alteration>=3')).toBe('3 or more Alteration items');
    expect(describePrerequisite('self:trained:armors.heavy')).toBe('Trained: armors heavy');
    expect(describePrerequisite({ any: ['self:skill:might>=d6', 'self:skill:finesse>=d6'] })).toBe('Might d6+ or Finesse d6+');
    expect(describePrerequisite('not:self:canTransform')).toBe('Not: Has an Alt Mode');
    expect(describePrerequisite('ask:GM approval')).toBe('GM approval');
  });
});

describe('attaching', () => {
  const upgrade = () => ({ name: 'Scope', type: 'upgrade', flags: {}, system: { prerequisites: { when: ['host:type:weapon'] } }, delete: jest.fn() });

  test('warn: kept, and the GM is told', async () => {
    const item = upgrade();
    expect(await checkAttached(hero(), item, { type: 'armor', system: {} })).toBe(true);
    expect(item.delete).not.toHaveBeenCalled();
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ whisper: ['gm'] }));
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test('strict: a player\'s unmet attachment comes off again; met ones stay quietly', async () => {
    settings.prerequisiteMode = 'strict';
    const item = upgrade();
    expect(await checkAttached(hero(), item, { type: 'armor', system: {} })).toBe(false);
    expect(item.delete).toHaveBeenCalled();
    const fine = upgrade();
    expect(await checkAttached(hero(), fine, { type: 'weapon', system: {} })).toBe(true);
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });

  test('off: nothing checked', async () => {
    settings.prerequisiteMode = 'off';
    expect(await checkAttached(hero(), upgrade(), { type: 'armor', system: {} })).toBe(true);
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe('losing a prerequisite later', () => {
  test('the first check records quietly; going from met to unmet tells the GM once', async () => {
    const item = perk(['self:level>=3'], { id: 'p1' });
    const actor = hero();
    actor.items = Object.assign([item], { get: id => (id == 'p1' ? item : null) });
    actor.updateEmbeddedDocuments = jest.fn(async (type, updates) => {
      for (const update of updates) {
        item.flags.essence20 = { prerequisitesMet: update['flags.essence20.prerequisitesMet'] };
      }
    });

    await recheck(actor);
    expect(item.flags.essence20.prerequisitesMet).toBe(true);
    expect(ChatMessage.create).not.toHaveBeenCalled();

    actor.system.level = 2;
    await recheck(actor);
    expect(item.flags.essence20.prerequisitesMet).toBe(false);
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);

    await recheck(actor);
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
  });
});

describe('choosers', () => {
  test('an option the character fails is marked; strict blocks a player only', async () => {
    const { choicePrerequisites } = await import('./prerequisites.mjs');
    global.fromUuidSync = uuid => (uuid == 'U.big' ? perk(['self:level>=9']) : uuid == 'U.free' ? perk([]) : null);
    expect(choicePrerequisites(hero(), 'U.big')).toEqual({ missing: 'Level 9+', blocked: false });
    expect(choicePrerequisites(hero(), 'U.free')).toBeNull();
    settings.prerequisiteMode = 'strict';
    expect(choicePrerequisites(hero(), 'U.big').blocked).toBe(true);
    game.user.isGM = true;
    expect(choicePrerequisites(hero(), 'U.big').blocked).toBe(false);
    settings.prerequisiteMode = 'off';
    expect(choicePrerequisites(hero(), 'U.big')).toBeNull();
  });
});
