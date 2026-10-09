import { jest } from '@jest/globals';
import { checkAttached, checkPrerequisites, describePrerequisite, prerequisitesOf, prerequisiteText, recheck } from './prerequisites.mjs';

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
    // The pack prerequisites that used to fall through as raw tags (2026-10-07).
    expect(describePrerequisite('self:tag:robot')).toBe('Robot trait');
    expect(describePrerequisite('not:self:tag:robot')).toBe('Not: Robot trait');
    expect(describePrerequisite('self:type:npc')).toBe('Is a Threat');
    expect(describePrerequisite('self:data:system.traits.flyBy')).toBe('Fly By trait');
    expect(describePrerequisite('self:data:system.qualified.poisons.all')).toBe('Qualified: poisons all');
    expect(describePrerequisite('self:data:system.powers.personal.max>=4')).toBe('Maximum Personal Power 4+');
    expect(describePrerequisite('self:data:system.movement.aerial.total>=50')).toBe('Aerial Movement 50+');
    expect(describePrerequisite('self:data:system.crew.numPassengers>=1')).toBe('Passengers 1+');
  });
});

describe('prerequisiteText - what the sheet chip, chat card and attached Upgrade line show', () => {
  afterEach(() => {
    delete global.fromUuidSync;
  });

  test('the tags in words, joined', () => {
    expect(prerequisiteText(perk(['self:level>=5', { any: ['self:skill:might>=d6', 'self:skill:finesse>=d6'] }]))).toBe('Level 5+; Might d6+ or Finesse d6+');
    expect(prerequisiteText(perk([]))).toBe('');
    expect(prerequisiteText(null)).toBe('');
  });

  test('the tags win over old typed text; the text is only an unmigrated item\'s fallback', () => {
    expect(prerequisiteText(perk(['self:level>=5'], { system: { prerequisite: 'Old words', prerequisites: { when: ['self:level>=5'] } } }))).toBe('Level 5+');
    expect(prerequisiteText({ name: 'Old', system: { prerequisite: ' Old words ' } })).toBe('Old words');
  });

  test('an attachment entry shows its attached item\'s tags, read through its uuid', () => {
    global.fromUuidSync = jest.fn(() => perk(['host:type:weapon']));
    expect(prerequisiteText({ uuid: 'Actor.a.Item.u', name: 'Scope', prerequisite: 'Old words' })).toBe('Attached to: type weapon');
    global.fromUuidSync = jest.fn(() => null);
    expect(prerequisiteText({ uuid: 'Actor.a.Item.gone', name: 'Scope', prerequisite: 'Old words' })).toBe('Old words');
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

describe('strict mode: GMs are asked, granted items are never checked', () => {
  const actorOf = () => ({ ...hero(), documentName: 'Actor', name: 'Hero' });
  test('a GM dropping an unmet item is asked; yes adds it, no stops it; met items, warn mode and players are not asked', async () => {
    const { confirmGmDrop } = await import('./prerequisites.mjs');
    const confirm = jest.fn(async () => true);
    global.foundry = { data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, applications: { api: { DialogV2: { confirm } } } };
    settings.prerequisiteMode = 'strict';
    game.user.isGM = true;
    expect(await confirmGmDrop(actorOf(), perk(['self:level>=9']))).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0].content).toContain('Level 9+');
    confirm.mockResolvedValueOnce(false);
    expect(await confirmGmDrop(actorOf(), perk(['self:level>=9']))).toBe(false);
    confirm.mockResolvedValueOnce(null);
    expect(await confirmGmDrop(actorOf(), perk(['self:level>=9']))).toBe(false);
    confirm.mockClear();
    expect(await confirmGmDrop(actorOf(), perk(['self:level>=2']))).toBe(true);
    expect(await confirmGmDrop(actorOf(), perk(['self:level>=9'], { type: 'upgrade' }))).toBe(true);
    settings.prerequisiteMode = 'warn';
    expect(await confirmGmDrop(actorOf(), perk(['self:level>=9']))).toBe(true);
    settings.prerequisiteMode = 'strict';
    game.user.isGM = false;
    expect(await confirmGmDrop(actorOf(), perk(['self:level>=9']))).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  test('a player is refused an unmet item, but not one a rule grants; a granted item gets no GM note either', async () => {
    const { onPreCreateItem, onCreateItem } = await import('./prerequisites.mjs');
    settings.prerequisiteMode = 'strict';
    game.user.id = 'p';
    const parent = actorOf();
    expect(onPreCreateItem({ ...perk(['self:level>=9']), parent }, {}, {}, 'p')).toBe(false);
    expect(onPreCreateItem({ ...perk(['self:level>=9'], { flags: { essence20: { grantedBy: 'x' } } }), parent }, {}, {}, 'p')).toBeUndefined();
    settings.prerequisiteMode = 'warn';
    ChatMessage.create.mockClear();
    await onCreateItem({ ...perk(['self:level>=9'], { flags: { essence20: { grantedBy: 'x' } } }), parent }, {}, 'p');
    expect(ChatMessage.create).not.toHaveBeenCalled();
    await onCreateItem({ ...perk(['self:level>=9']), parent }, {}, 'p');
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
  });
});

describe('the GM pop-up', () => {
  test('warn mode: the unmet note carries a pop-up that shows on GM clients only', async () => {
    const { onCreateItem, onGmNote } = await import('./prerequisites.mjs');
    settings.prerequisiteMode = 'warn';
    game.user.id = 'p';
    ChatMessage.create.mockClear();
    await onCreateItem({ ...perk(['self:level>=9']), parent: { ...hero(), documentName: 'Actor', name: 'Hero' } }, {}, 'p');
    const note = ChatMessage.create.mock.calls[0][0];
    expect(note.whisper).toEqual(['gm']);
    expect(note.flags.essence20.prerequisiteToast).toContain('AddedUnmetGm');
    expect(note.flags.essence20.prerequisiteToast).toContain('Level 9+');
    ui.notifications.warn.mockClear();
    onGmNote(note);
    expect(ui.notifications.warn).not.toHaveBeenCalled();
    game.user.isGM = true;
    onGmNote(note);
    expect(ui.notifications.warn).toHaveBeenCalledWith(note.flags.essence20.prerequisiteToast);
    onGmNote({ flags: {} });
    expect(ui.notifications.warn).toHaveBeenCalledTimes(1);
  });
});
