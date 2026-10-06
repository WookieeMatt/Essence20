import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Batch slH12 (docs/rules-batches/slH12.md): the last hand-written parts of Tactical Size Shift, Hybridization, Advanced
 * Dino Gem Integration (Primordial Power), Dino Drive Mode, Ninja Storm Wind Ranger (the mind-control Snag), Solar Power
 * (its Form), Mobile Headquarters (the scene allies' Initiative Edge) and This, I Command (the upshift / action
 * doubling), moved to item rules on the group H plug-ins (module/rules/ext/h/). Each item is loaded from its pack source
 * and must do what the removed code did.
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };

const spend = jest.fn(async () => ({ blocked: false }));
jest.unstable_mockModule('./helpers/action-economy.mjs', () => ({ spend, setNextTurn: jest.fn(), getLedger: () => null, isTracking: () => true }));
const chooseSelect = jest.fn();
const findItems = jest.fn();
const pickOne = jest.fn();
const grantCopy = jest.fn(async () => ({ name: 'Copy', system: {} }));
jest.unstable_mockModule('./helpers/grants.mjs', () => ({
  chooseSelect, chooseButtons: jest.fn(), findItems, pickOne, grantCopy, rollTest: jest.fn(), pickPerkFrom: jest.fn(), markIntegrated: jest.fn(),
}));
jest.unstable_mockModule('./helpers/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const applyDamage = jest.fn();
jest.unstable_mockModule('./helpers/combat.mjs', () => ({ applyDamage, getVehicleDriver: jest.fn() }));
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ createItemCopies: jest.fn(), setEntryAndAddItem: jest.fn() }));

await import('./ext/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { fireItemAdded, fireTriggers, runUse, useAvailable } = await import('./triggers.mjs');
const { ruleDialogSwitches, ruleNoUntrainedSnag, ruleRollSources } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { extDialogToggles, runApplyDialog } = await import('../helpers/extensions.mjs');
const { hitRiderOnAttack } = await import('./ext/b/hit-rider.mjs');
const { derivedMovement } = await import('./ext/e/derived.mjs');
const { ruleFormSpec, ruleFormUuids } = await import('./ext/a/forms.mjs');
const { ruleIgnoresDrawback } = await import('./ext/h/drawback.mjs');
const { damageReduction, initiativeEdgeFor, massShiftUsed, offerGrantDouble } = await import('./ext/h/types.mjs');
const perks = await import('../helpers/perks.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  tss: 'atsitems/_source/Tactical_Size_Shift_tS3P7BZqnH9GGLux.json',
  hybrid: 'tfcrbitems/_source/Hybridization_R5SobOsimfa7mvdy.json',
  mercurial: 'tfcrbitems/_source/Mercurial_Nature_G5LYO99aCFly6oq0.json',
  gem: 'bthitems/_source/Advanced_Dino_Gem_Integration_K4CUMFhAjXRFzGbA.json',
  drive: 'bthitems/_source/Dino_Drive_Mode_fpfH5KgJ3BdWAFtM.json',
  ninja: 'bthitems/_source/Ninja_Storm_Wind_Ranger__Form__Txv1ODlLKY91hPrA.json',
  solar: 'atsitems/_source/Solar_Power__Form__4ksM4tGqdjuyPSj1.json',
  hq: 'jttitems/_source/Mobile_Headquarters_soCSwGBp0AZbEeZC.json',
  command: 'ccitems/_source/This__I_Command_SUc3emTvPnwB6W93.json',
};
const SOURCES = {
  tss: 'Compendium.essence20.across_the_stars.Item.tS3P7BZqnH9GGLux',
  hybrid: 'Compendium.essence20.tf_crb.Item.R5SobOsimfa7mvdy',
  mercurial: 'Compendium.essence20.tf_crb.Item.G5LYO99aCFly6oq0',
  gem: 'Compendium.essence20.beneath_the_helmet.Item.K4CUMFhAjXRFzGbA',
  drive: 'Compendium.essence20.beneath_the_helmet.Item.fpfH5KgJ3BdWAFtM',
  ninja: 'Compendium.essence20.beneath_the_helmet.Item.Txv1ODlLKY91hPrA',
  solar: 'Compendium.essence20.across_the_stars.Item.4ksM4tGqdjuyPSj1',
  hq: 'Compendium.essence20.jump_through_time.Item.soCSwGBp0AZbEeZC',
  command: 'Compendium.essence20.cobra_codex.Item.SUc3emTvPnwB6W93',
};

let nextId = 1;
const clock = { sceneClockScene: 3, sceneClockEncounter: 3, sceneClockMission: 7 };
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
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

const world = { actors: [], items: new Map() };

function embedded(owner, kind, datas) {
  return datas.map(data => {
    const made = kind == 'ActiveEffect'
      ? { id: `e${nextId++}`, ...JSON.parse(JSON.stringify(data)) }
      : asItem({ ...JSON.parse(JSON.stringify(data)), id: data._id ?? undefined }, owner);
    (kind == 'ActiveEffect' ? owner.effects : owner.items.contents).push(made);
    return made;
  });
}

function asItem(data, actor) {
  const item = {
    id: data.id ?? `i${nextId++}`, flags: {}, system: {}, effects: [], isOwner: true, ...data, parent: actor,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }

      if (actor) {
        rebuildIndex(actor);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    async createEmbeddedDocuments(kind, datas) {
      return embedded(this, kind, datas);
    },
  };
  item.uuid = `${actor?.uuid ?? 'Item'}.Item.${item.id}`;
  world.items.set(item.uuid, item);
  return item;
}

function makeActor(type = 'playerCharacter', name = 'Hero', system = {}, extra = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} }, effects: [],
    system: { health: { value: 5, max: 10, bonus: 0 }, ...system },
    prototypeToken: { disposition: extra.disposition ?? 1 },
    getActiveTokens: () => [],
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    async unsetFlag(scope, key) {
      delete this.flags?.[scope]?.[key];
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    async createEmbeddedDocuments(kind, datas) {
      const made = embedded(this, kind, datas);
      rebuildIndex(this);
      return made;
    },
    async deleteEmbeddedDocuments(kind, ids) {
      const list = kind == 'ActiveEffect' ? this.effects : items;
      for (const id of ids) {
        const at = list.findIndex(entry => entry.id == id);
        if (at >= 0) {
          list.splice(at, 1);
        }
      }

      rebuildIndex(this);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  world.actors.push(actor);
  return actor;
}

function addItem(actor, data) {
  const item = asItem(data, actor);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

function addPackItem(actor, key, extra = {}) {
  const doc = fromPack(FILES[key]);
  return addItem(actor, {
    name: doc.name, type: doc.type, img: doc.img, system: { ...JSON.parse(JSON.stringify(doc.system)), ...(extra.system ?? {}) },
    flags: JSON.parse(JSON.stringify(extra.flags ?? {})), _stats: { compendiumSource: SOURCES[key] },
  });
}

/** The index (in the offered list) of the option with that label - a `choose` answer. */
const answer = label => jest.fn(async (step, options) => options.findIndex(option => option.label == label));
const useOf = (item, label) => {
  const index = item.system.rules.findIndex(rule => rule.type == 'Use' && rule.label == label);
  return { rule: item.system.rules[index], index };
};

const available = (item, label) => {
  const { rule, index } = useOf(item, label);
  return useAvailable(item, rule, index);
};

beforeEach(() => {
  world.actors.length = 0;
  world.items.clear();
  const actors = world.actors;
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null, contents: [] },
    settings: { get: (scope, key) => clock[key] ?? 1, set: async () => {} },
    actors: { contents: actors, get: id => actors.find(actor => actor.id == id), [Symbol.iterator]: () => actors[Symbol.iterator]() },
    i18n: { localize: k => k, format: k => k, has: () => false },
    messages: { get: () => null },
  };
  global.canvas = undefined;
  global.fromUuidSync = uuid => actors.find(actor => actor.uuid == uuid) ?? world.items.get(uuid) ?? null;
  global.fromUuid = async uuid => global.fromUuidSync(uuid);
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.CONFIG = {
    ...(global.CONFIG ?? {}),
    E20: {
      ...(global.CONFIG?.E20 ?? {}),
      skills: { might: 'Might', athletics: 'Athletics', driving: 'Driving', infiltration: 'Infiltration' },
      skillToEssence: { might: 'strength', athletics: 'strength', driving: 'speed', infiltration: 'speed' },
      damageTypes: { fire: 'Fire', blunt: 'Blunt', psychic: 'Psychic' },
      skillShiftList: ['3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'],
    },
  };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath, deepClone: value => JSON.parse(JSON.stringify(value)) },
    applications: { api: { DialogV2: { confirm: jest.fn(async () => true) } } },
  };
  for (const mock of [spend, chooseSelect, findItems, pickOne, grantCopy, applyDamage]) {
    mock.mockClear();
  }
});

test('every changed item\'s rules validate', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules ?? []) {
      expect([file, rule.label, validateRule(rule)]).toEqual([file, rule.label, []]);
    }
  }
});

/* -------------------------------------------- */
/*  Tactical Size Shift                          */
/* -------------------------------------------- */

describe('Tactical Size Shift', () => {
  const zordOf = () => makeActor('zord', 'Zord', {
    skills: { might: { shift: 'd6' }, athletics: { shift: 'd12' }, driving: { shift: 'd4' }, infiltration: { shift: 'd20' } },
    movement: { ground: { base: 30 }, aerial: { base: 0 }, swim: { base: 20 } },
  });

  test('landing on a Zord: larger, a Strength Skill one step up, its Active Effect; a later copy is locked to larger', async () => {
    const zord = zordOf();
    const feature = addPackItem(zord, 'tss');
    const ask = answer('E20.Pr1SizeShiftLarger');
    chooseSelect.mockResolvedValueOnce('might');
    await fireItemAdded(zord, feature, { ask });
    expect(ask.mock.calls[0][1].map(option => option.label)).toEqual(['E20.Pr1SizeShiftLarger', 'E20.Pr1SizeShiftSmaller']);
    expect(chooseSelect.mock.calls[0][2].map(option => option.value)).toEqual(['might', 'athletics']);
    expect(zord.system.skills.might.shift).toBe('d8');
    expect(feature.flags.essence20.pr1SizeShift).toEqual({ previous: 'd6', direction: 'larger', skill: 'might' });
    expect(feature.effects).toEqual([expect.objectContaining({
      name: 'Tactical Size Shift', img: 'icons/svg/aura.svg', transfer: true, disabled: false,
      changes: [{ key: 'system.essences.strength.value', mode: 2, value: '1' }, { key: 'system.health.bonus', mode: 2, value: '2' }],
    })]);
    expect(available(feature, 'Choose larger or smaller')).toBe(false);

    // "future choices ... only in the same direction": no question; d12 stays d12.
    const second = addPackItem(zord, 'tss');
    const noAsk = jest.fn();
    chooseSelect.mockResolvedValueOnce('athletics');
    await fireItemAdded(zord, second, { ask: noAsk });
    expect(noAsk).not.toHaveBeenCalled();
    expect(second.flags.essence20.pr1SizeShift).toEqual({ previous: 'd12', direction: 'larger', skill: 'athletics' });
    expect(zord.system.skills.athletics.shift).toBe('d12');
  });

  test('smaller: Speed +1 and +10 ft to each Movement it has; removing it gives the Skill die back', async () => {
    const zord = zordOf();
    const feature = addPackItem(zord, 'tss');
    chooseSelect.mockResolvedValueOnce('infiltration');
    const { rule, index } = useOf(feature, 'Choose larger or smaller');
    expect(useAvailable(feature, rule, index)).toBe(true);
    await runUse(feature, async () => true, { ask: answer('E20.Pr1SizeShiftSmaller') });
    expect(zord.system.skills.infiltration.shift).toBe('d2');
    expect(feature.effects[0].changes).toEqual([
      { key: 'system.essences.speed.value', mode: 2, value: '1' },
      { key: 'system.movement.ground.bonus', mode: 2, value: '10' },
      { key: 'system.movement.swim.bonus', mode: 2, value: '10' },
    ]);

    await fireItemAdded(zord, feature, { event: 'removed' });
    expect(zord.system.skills.infiltration.shift).toBe('d20');
  });

  test('a cancelled Skill pick keeps nothing; never on a Player Character; an older pick (the old flag) is put back too', async () => {
    const zord = zordOf();
    const feature = addPackItem(zord, 'tss');
    chooseSelect.mockResolvedValueOnce(null);
    await fireItemAdded(zord, feature, { ask: answer('E20.Pr1SizeShiftLarger') });
    expect(feature.flags.essence20?.pr1SizeShift).toBeUndefined();
    expect(feature.effects).toEqual([]);
    expect(zord.system.skills.might.shift).toBe('d6');

    const pc = makeActor();
    expect(available(addPackItem(pc, 'tss'), 'Choose larger or smaller')).toBe(false);

    const old = addPackItem(zord, 'tss', { flags: { essence20: { pr1SizeShift: { direction: 'larger', skill: 'driving', previous: 'd2' } } } });
    await fireItemAdded(zord, old, { event: 'removed' });
    expect(zord.system.skills.driving.shift).toBe('d2');
  });
});

/* -------------------------------------------- */
/*  Hybridization                                */
/* -------------------------------------------- */

describe('Hybridization', () => {
  const botOf = (level = 7, system = {}) => makeActor('playerCharacter', 'Modemaster', {
    level, skills: { athletics: { shift: 'd20' } }, movement: { ground: { total: 30 }, aerial: { total: 0 }, swim: { total: 15 } }, isTransformed: false, ...system,
  });
  const hybrid = (actor, choice) => addPackItem(actor, 'hybrid', choice ? { flags: { essence20: { zord2Hybrid: choice } } } : {});

  test('each copy picks one Hybridization, never one another copy holds (Extra Shift may repeat), and is renamed', async () => {
    const bot = botOf();
    const first = hybrid(bot);
    await fireItemAdded(bot, first, { ask: answer('E20.Zord2Hybrid.changeSize') });
    expect(first.flags.essence20.zord2Hybrid).toBe('changeSize');
    expect(first.name).toBe('Hybridization (E20.Zord2Hybrid.changeSize)');
    hybrid(bot, 'extraShift');

    const next = hybrid(bot);
    const ask = answer('E20.Zord2Hybrid.extraShift');
    await runUse(next, async () => true, { ask });
    const offered = ask.mock.calls[0][1].map(option => option.label.split('.').pop());
    expect(offered).toEqual(['evasiveConversion', 'extraShift', 'fastShift', 'halfTrack', 'helpingHand', 'holdThatShape',
      'reinforceShell', 'replacementPart', 'steadyHands', 'weaponize']);
    expect(next.flags.essence20.zord2Hybrid).toBe('extraShift');
  });

  test('daily Mass Shift uses: Table 5-10 by level plus Extra Shift; unlimited with Mercurial Nature', () => {
    const bot = botOf(7);
    const size = hybrid(bot, 'changeSize');
    hybrid(bot, 'extraShift');
    bot.flags.essence20.zord2MassShiftDay = 4;
    expect(available(size, 'Change Size (Mass Shift)')).toBe(true);
    bot.flags.essence20.zord2MassShiftDay = 5;
    expect(available(size, 'Change Size (Mass Shift)')).toBe(false);

    for (const [level, uses] of [[1, 2], [2, 2], [3, 3], [5, 3], [6, 4], [10, 4], [11, 5], [15, 5], [16, 6], [19, 6], [20, 10]]) {
      const someone = botOf(level);
      const item = hybrid(someone, 'halfTrack');
      someone.flags.essence20.zord2MassShiftDay = uses - 1;
      expect([level, available(item, 'Half Track (Mass Shift)')]).toEqual([level, true]);
      someone.flags.essence20.zord2MassShiftDay = uses;
      expect([level, available(item, 'Half Track (Mass Shift)')]).toEqual([level, false]);
    }

    addPackItem(bot, 'mercurial');
    bot.flags.essence20.zord2MassShiftDay = 99;
    expect(available(size, 'Change Size (Mass Shift)')).toBe(true);
    // Only the H Hybridizations have a button.
    expect(useOf(hybrid(bot, 'fastShift'), 'Fast Shift').rule).toBeUndefined();
  });

  test('Change Size: a Move action (Free with Fast Shift), the direction, the scene (the mission with Hold That Shape), one use', async () => {
    const bot = botOf();
    const size = hybrid(bot, 'changeSize');
    await runUse(size, async () => true, { ask: answer('E20.Zord2HybridSizeDown') });
    expect(spend).toHaveBeenCalledWith(bot, 'move', expect.anything());
    expect(bot.flags.essence20.zord2HybridSizeDir).toBe(-1);
    expect(bot.flags.essence20.zord2HybridSize).toEqual({ epoch: 3, window: 'scene', count: 1 });
    expect(bot.flags.essence20.zord2MassShiftDay).toBe(1);

    hybrid(bot, 'fastShift');
    hybrid(bot, 'holdThatShape');
    spend.mockClear();
    await runUse(size, async () => true, { ask: answer('E20.Zord2HybridSizeUp') });
    expect(spend).toHaveBeenCalledWith(bot, 'free', expect.anything());
    expect(spend).toHaveBeenCalledTimes(1);
    expect(bot.flags.essence20.zord2HybridSizeDir).toBe(1);
    expect(bot.flags.essence20.zord2HybridSize).toMatchObject({ epoch: 7, window: 'mission' });
    expect(bot.flags.essence20.zord2MassShiftDay).toBe(2);

    // A cancelled direction spends no daily use.
    await runUse(size, async () => true, { ask: jest.fn(async () => null) });
    expect(bot.flags.essence20.zord2MassShiftDay).toBe(2);
  });

  test('Evasive Conversion: no action; the next attack against them takes a Snag and uses it up', async () => {
    const bot = botOf();
    const evasive = hybrid(bot, 'evasiveConversion');
    await runUse(evasive, async () => true);
    expect(spend).not.toHaveBeenCalled();
    expect(bot.flags.essence20.ruleMarks.zord2Evasive).toBeTruthy();
    expect(bot.flags.essence20.zord2MassShiftDay).toBe(1);

    const enemy = makeActor('npc', 'Enemy');
    const attack = { type: 'weaponEffect', system: { classification: { style: 'melee' } } };
    const out = ruleRollSources(enemy, bot, { item: attack, isAttack: true });
    expect(out.sources).toEqual([expect.objectContaining({ label: 'Evasive Conversion', snag: true })]);
    expect(out.consumes).toEqual([{ ext: 'rulesMark', actorUuid: bot.uuid, key: 'zord2Evasive' }]);
    expect(ruleRollSources(enemy, bot, { rolledSkill: 'athletics' }).sources).toEqual([]);
  });

  test('Half Track: the Alt Mode\'s Movement in Bot Mode for the scene', async () => {
    const bot = botOf();
    const track = hybrid(bot, 'halfTrack');
    addItem(bot, { name: 'Truck', type: 'altMode', system: { altModeMovement: { ground: 60, aerial: 0, aquatic: 20 } } });
    derivedMovement(bot);
    expect(bot.system.movement.ground.total).toBe(30);
    await runUse(track, async () => true);
    expect(bot.flags.essence20.zord2HalfTrack).toEqual({ epoch: 3, window: 'scene', count: 1 });
    derivedMovement(bot);
    expect(bot.system.movement).toMatchObject({ ground: { total: 60 }, aerial: { total: 0 }, swim: { total: 20 } });
    bot.system.isTransformed = true;
    bot.system.movement.ground.total = 30;
    derivedMovement(bot);
    expect(bot.system.movement.ground.total).toBe(30);
  });

  test('Steady Hands lifts the untrained Snag for the scene; Helping Hand ignores Limited Articulation', async () => {
    const bot = botOf();
    const steady = hybrid(bot, 'steadyHands');
    expect(ruleNoUntrainedSnag(bot, 'athletics')).toBe(false);
    await runUse(steady, async () => true);
    expect(ruleNoUntrainedSnag(bot, 'athletics')).toBe(true);

    expect(ruleIgnoresDrawback(bot, 'limitedArticulation')).toBe(false);
    hybrid(bot, 'helpingHand');
    expect(ruleIgnoresDrawback(bot, 'limitedArticulation')).toBe(true);
  });

  test('Replacement Part repairs 1; Reinforce Shell / Weaponize grant a picked armor upgrade / weapon for the scene', async () => {
    const bot = botOf();
    await runUse(hybrid(bot, 'replacementPart'), async () => true);
    expect(bot.system.health.value).toBe(6);

    const shell = hybrid(bot, 'reinforceShell');
    findItems.mockResolvedValueOnce([{ uuid: 'Compendium.x.Item.plate', name: 'Plating', system: { type: 'armor' } }]);
    pickOne.mockResolvedValueOnce('Compendium.x.Item.plate');
    await runUse(shell, async () => true);
    expect(findItems.mock.calls[0][0].type).toBe('upgrade');
    expect(findItems.mock.calls[0][0].matches({ system: { type: 'armor' } })).toBe(true);
    expect(findItems.mock.calls[0][0].matches({ system: { type: 'weapon' } })).toBe(false);
    expect(grantCopy).toHaveBeenCalledWith(bot, 'Compendium.x.Item.plate', expect.objectContaining({
      grantedBy: shell, flags: { rulesExpiry: expect.objectContaining({ until: 'scene' }) },
    }));

    const weaponize = hybrid(bot, 'weaponize');
    findItems.mockResolvedValueOnce([{ uuid: 'Compendium.x.Item.gun', name: 'Gun' }]);
    pickOne.mockResolvedValueOnce('Compendium.x.Item.gun');
    await runUse(weaponize, async () => true);
    expect(grantCopy).toHaveBeenLastCalledWith(bot, 'Compendium.x.Item.gun', expect.objectContaining({ system: { 'hardpoint.type': 'external' } }));
    expect(bot.flags.essence20.zord2MassShiftDay).toBe(3);
  });

  test('a rest gives the uses back; the Mass Shift Role Perk\'s own uses count once', async () => {
    const bot = botOf();
    hybrid(bot, 'changeSize');
    hybrid(bot, 'extraShift');
    await massShiftUsed(bot);
    expect(bot.flags.essence20.zord2MassShiftDay).toBe(1);
    await fireTriggers(bot, 'rest');
    expect(bot.flags.essence20.zord2MassShiftDay).toBe(0);
  });
});

/* -------------------------------------------- */
/*  Advanced Dino Gem Integration                */
/* -------------------------------------------- */

describe('Advanced Dino Gem Integration: Primordial Power', () => {
  const tools = () => ({ damageBonusNote: jest.fn((result, amount) => {
    result.damageValue += amount;
  }) });

  test('a switch on the Zord\'s melee attacks; ticked, a hit deals +2 (picks old and new)', () => {
    const zord = makeActor('zord', 'Dino Zord');
    addPackItem(zord, 'gem', { flags: { essence20: { rules: { choices: { gem: 'primordial' } } } } });
    addItem(zord, { id: 'jaw', name: 'Jaws', type: 'weapon' });
    const bite = addItem(zord, { name: 'Bite', type: 'weaponEffect', system: { classification: { style: 'melee' } }, flags: { essence20: { parentId: 'jaw' } } });
    const shot = addItem(zord, { name: 'Shot', type: 'weaponEffect', system: { classification: { style: 'projectile' } } });
    const names = ctx => ruleDialogSwitches(zord, ctx).map(entry => entry.label);
    expect(names({ item: bite, isAttack: true, isMelee: true })).toEqual(['Primordial Power (Advanced Dino Gem Integration: Snag, +2 damage)']);
    expect(names({ item: shot, isAttack: true, isMelee: false })).toEqual([]);
    const [primordial] = ruleDialogSwitches(zord, { item: bite, isAttack: true, isMelee: true });
    expect(primordial.entry?.rule ?? zord.items.contents[0].system.rules.find(rule => rule.key == 'pr1DinoPrimordial')).toMatchObject({ snag: true });

    const hit = { damageValue: 3 };
    hitRiderOnAttack(zord, null, hit, { itemUuid: bite.uuid, switches: ['pr1DinoPrimordial'], style: 'melee' }, tools());
    expect(hit.damageValue).toBe(5);
    const plain = { damageValue: 3 };
    hitRiderOnAttack(zord, null, plain, { itemUuid: bite.uuid, switches: [], style: 'melee' }, tools());
    expect(plain.damageValue).toBe(3);

    const old = makeActor('zord', 'Old Zord');
    addPackItem(old, 'gem', { flags: { essence20: { pr1DinoGem: 'primordial' } } });
    const oldBite = addItem(old, { name: 'Bite', type: 'weaponEffect', system: { classification: { style: 'melee' } } });
    expect(ruleDialogSwitches(old, { item: oldBite, isAttack: true, isMelee: true })).toHaveLength(1);
    const sense = makeActor('zord', 'Sense Zord');
    addPackItem(sense, 'gem', { flags: { essence20: { rules: { choices: { gem: 'sense' } } } } });
    expect(ruleDialogSwitches(sense, { item: oldBite, isAttack: true, isMelee: true })).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Dino Drive Mode                              */
/* -------------------------------------------- */

describe('Dino Drive Mode', () => {
  const zordOf = (speed = 4, movement = { ground: { base: 30 }, aerial: { base: 0 }, swim: { base: 20 } }) => makeActor('zord', 'Dino Zord', {
    essences: { speed: { value: speed } }, movement,
  });

  test('engaging: a Standard action, a movement picked first, +1 plating and +10 ft for the scene, -3 Speed (min 1) until its next turn', async () => {
    const zord = zordOf(4);
    const drive = addPackItem(zord, 'drive');
    const pay = jest.fn(async () => true);
    const ask = answer('E20.Pr2Movement.swim');
    const line = await runUse(drive, pay, { ask });
    expect(ask.mock.calls[0][1].map(option => option.label)).toEqual(['E20.Pr2Movement.ground', 'E20.Pr2Movement.swim']);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(zord.effects).toEqual([
      expect.objectContaining({ name: 'Dino Drive Mode', changes: [{ key: 'system.defenses.toughness.armor', mode: 2, value: '1' }, { key: 'system.movement.swim.bonus', mode: 2, value: '10' }], flags: { essence20: { pr2DinoDriveEffect: true } } }),
      expect.objectContaining({ name: 'E20.Pr2DinoDriveSlowName', changes: [{ key: 'system.essences.speed.value', mode: 2, value: '-3' }], flags: { essence20: { pr2DinoDriveEffect: true, pr2DinoDriveSlow: true } } }),
    ]);
    expect(zord.flags.essence20.pr2DinoDrive).toEqual({ epoch: 3, window: 'scene', count: 1 });
    expect(line).toContain('Speed -3');
    expect(available(drive, 'Engage Dino Drive Mode')).toBe(false);

    await fireTriggers(zord, 'turnStart');
    expect(zord.effects.map(effect => effect.name)).toEqual(['Dino Drive Mode']);
    await fireTriggers(zord, 'sceneStart');
    expect(zord.effects).toEqual([]);
  });

  test('a cancelled pick costs nothing; Speed 1 takes no penalty; no Movement at all offers Ground', async () => {
    const zord = zordOf(1, { ground: { base: 0 }, aerial: { base: 0 } });
    const drive = addPackItem(zord, 'drive');
    const pay = jest.fn(async () => true);
    expect(await runUse(drive, pay, { ask: jest.fn(async () => null) })).toBe(null);
    expect(pay).not.toHaveBeenCalled();
    const ask = answer('E20.Pr2Movement.ground');
    await runUse(drive, pay, { ask });
    expect(ask.mock.calls[0][1].map(option => option.label)).toEqual(['E20.Pr2Movement.ground']);
    expect(zord.effects.map(effect => effect.name)).toEqual(['Dino Drive Mode']);
  });

  test('Reflective Armor: once a round, Energy damage is d2 lower while engaged', async () => {
    const zord = zordOf();
    addPackItem(zord, 'drive');
    expect(await damageReduction(zord, 3, 'fire')).toBe(3);
    zord.flags.essence20.pr2DinoDrive = { epoch: 3, window: 'scene', count: 1 };
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0 };
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.9);
    try {
      expect(await damageReduction(zord, 3, 'blunt')).toBe(3);
      expect(await damageReduction(zord, 3, 'fire')).toBe(1);
      expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: '<p>E20.Pr2DinoDriveReflect</p>' }));
      expect(await damageReduction(zord, 3, 'laser')).toBe(3);
      global.game.combat.round = 2;
      expect(await damageReduction(zord, 1, 'sonic')).toBe(0);
    } finally {
      random.mockRestore();
    }
  });
});

/* -------------------------------------------- */
/*  Ninja Storm Wind Ranger                      */
/* -------------------------------------------- */

describe('Ninja Storm Wind Ranger', () => {
  test('rolling at a Ranger with the Form active offers the mind-control Snag', async () => {
    const ninja = makeActor('playerCharacter', 'Tori', { isMorphed: true });
    addPackItem(ninja, 'ninja');
    ninja.flags.essence20.zord1Form = { uuid: SOURCES.ninja };
    const roller = makeActor('npc', 'Lothor');
    const mind = () => extDialogToggles(roller, { rolledSkill: 'persuasion' }).filter(toggle => String(toggle.label).includes('mind'));
    expect(mind()).toEqual([]);
    game.user.targets = new Set([{ actor: ninja }]);
    const [toggle] = mind();
    expect(toggle.label).toBe("Trying to control Tori's mind (Ninja Storm: Snag)");
    const options = { ext: { [toggle.name]: true } };
    await runApplyDialog(roller, options, { rolledSkill: 'persuasion' });
    expect(options.snag).toBe(true);

    ninja.system.isMorphed = false;
    expect(mind()).toEqual([]);
    ninja.system.isMorphed = true;
    expect(extDialogToggles(ninja, { rolledSkill: 'persuasion' }).filter(entry => String(entry.label).includes('mind'))).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Solar Power                                  */
/* -------------------------------------------- */

describe('Solar Power', () => {
  test('a Form rule: 1 Personal Power, an Element picked at activation, no swaps; Unlock / End buttons', () => {
    const ranger = makeActor('playerCharacter', 'Ranger', { isMorphed: false });
    const solar = addPackItem(ranger, 'solar');
    expect(ruleFormSpec(ranger, SOURCES.solar)).toEqual({ key: SOURCES.solar, cost: 1, swaps: [], element: true });
    expect(ruleFormUuids(ranger)).toEqual([SOURCES.solar]);
    expect(available(solar, 'Unlock this Form (1 Personal Power)')).toBe(false);
    ranger.system.isMorphed = true;
    expect(available(solar, 'Unlock this Form (1 Personal Power)')).toBe(true);
    expect(available(solar, 'End this Form')).toBe(false);
    ranger.flags.essence20.zord1Form = { uuid: SOURCES.solar, element: 'cold' };
    expect(available(solar, 'Unlock this Form (1 Personal Power)')).toBe(false);
    expect(available(solar, 'End this Form')).toBe(true);

    const npc = makeActor('npc', 'Copy');
    npc.system.isMorphed = true;
    expect(available(addPackItem(npc, 'solar'), 'Unlock this Form (1 Personal Power)')).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Mobile Headquarters                          */
/* -------------------------------------------- */

describe('Mobile Headquarters', () => {
  test('allied vehicles and Zords in the scene roll Initiative with Edge', () => {
    const hq = makeActor('zord', 'HQ');
    addPackItem(hq, 'hq');
    const ally = makeActor('vehicle', 'Jeep');
    const zord = makeActor('zord', 'Zord');
    const foe = makeActor('vehicle', 'Foe', {}, { disposition: -1 });
    const pc = makeActor('playerCharacter', 'Ranger');
    const scene = [hq, ally, zord, foe, pc];
    expect(initiativeEdgeFor(ally, scene)).toBe(true);
    expect(initiativeEdgeFor(zord, scene)).toBe(true);
    expect(initiativeEdgeFor(foe, scene)).toBe(false);
    expect(initiativeEdgeFor(pc, scene)).toBe(false);
    // Not on the scene: nothing.
    expect(initiativeEdgeFor(ally, [ally])).toBe(false);
    // Its own Edge is its SkillDie rule (conv11-slF11), not this.
    expect(initiativeEdgeFor(hq, scene)).toBe(false);
    const second = makeActor('zord', 'Second HQ');
    addPackItem(second, 'hq');
    expect(initiativeEdgeFor(second, scene)).toBe(false);
    // Only a Zord holding it counts.
    const truck = makeActor('vehicle', 'Truck');
    addPackItem(truck, 'hq');
    expect(initiativeEdgeFor(ally, [truck, ally])).toBe(false);

    global.canvas = { tokens: { placeables: scene.map(actor => ({ actor })) } };
    expect(initiativeEdgeFor(ally)).toBe(true);
  });
});

/* -------------------------------------------- */
/*  This, I Command                              */
/* -------------------------------------------- */

describe('This, I Command', () => {
  const officer = (hasPerk = true) => {
    const actor = makeActor('playerCharacter', 'Baroness');
    if (hasPerk) {
      addPackItem(actor, 'command');
    }

    return actor;
  };

  test('a yes deals the ally 1 Psychic and doubles a banked upshift; a no keeps it', async () => {
    const ally = makeActor('playerCharacter', 'Viper');
    const granter = officer();
    await perks.bankPendingBonus(ally, 'pendingX', { shiftUp: 2 }, { granter });
    expect(foundry.applications.api.DialogV2.confirm).toHaveBeenCalledWith(expect.objectContaining({
      window: { title: 'This, I Command' }, content: '<p>E20.ThisICommandPrompt</p>',
    }));
    expect(applyDamage).toHaveBeenCalledWith(ally, 1, 'psychic');
    expect(ally.flags.essence20.pendingX).toMatchObject({ shiftUp: 4 });

    foundry.applications.api.DialogV2.confirm.mockResolvedValueOnce(false);
    applyDamage.mockClear();
    await perks.bankPendingBonus(ally, 'pendingY', { shiftUp: 1 }, { granter });
    expect(applyDamage).not.toHaveBeenCalled();
    expect(ally.flags.essence20.pendingY).toMatchObject({ shiftUp: 1 });
  });

  test('extra actions too; never asked without the Perk, for yourself, or for something that is not an upshift', async () => {
    const ally = makeActor('playerCharacter', 'Viper');
    const granter = officer();
    expect(await offerGrantDouble(granter, ally, 'actions', '1 Move')).toBe(true);
    expect(await perks.offerGrantDouble(granter, ally, 'actions', '1 Move')).toBe(true);
    const confirm = foundry.applications.api.DialogV2.confirm;
    confirm.mockClear();
    expect(await perks.offerGrantDouble(officer(false), ally, 'actions', 'x')).toBe(false);
    expect(await perks.offerGrantDouble(granter, granter, 'upshift', 'x')).toBe(false);
    await perks.bankPendingBonus(ally, 'pendingZ', { edge: true }, { granter });
    expect(confirm).not.toHaveBeenCalled();
  });
});
