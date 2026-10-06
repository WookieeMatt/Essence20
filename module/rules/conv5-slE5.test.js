import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slE5: items of the qualify / data / Night Vale slices converted with the 2026-10-05 round-5 engine
 * pieces (vehicle:data / vehicle:name~ tags, require + beforeCost, DerivedStat {choice} paths with
 * true / false, Movement afterGravity). Each is loaded from its pack source and must do what the
 * removed slice code did.
 */

// The roll, the picker and the Health-test helpers the steps reach for.
const rollTest = jest.fn(async () => ({ success: true, crit: false }));
const chooseSelect = jest.fn();
jest.unstable_mockModule('./helpers/grants.mjs', () => ({ rollTest, chooseSelect }));

const { rebuildIndex } = await import('./index.mjs');
const { applyRuleImmunity, ruleDerived, ruleMovementStages, ruleRollSources } = await import('./adapter.mjs');
const { runUse } = await import('./triggers.mjs');
const { setCrewLookup } = await import('./predicate.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

function makeActor({ name = 'Hero', type = 'playerCharacter', system = {}, items = [] } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { level: 5, health: { value: 3, max: 10 }, skills: {}, ...system },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    toggleStatusEffect: jest.fn(async function (status, { active }) {
      if (active) {
        actor.statuses.add(status);
      } else {
        actor.statuses.delete(status);
      }
    }),
    getActiveTokens: () => [],
  };
  actor.uuid = `Actor.${actor.id}`;
  const list = [...items];
  actor.items = { contents: list, get: id => list.find(i => i.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  for (const item of list) {
    item.parent = actor;
  }

  rebuildIndex(actor);
  return actor;
}

/** An owned copy of a pack item (its book source set, as a dropped copy has). */
function packItem(file, extra = {}) {
  const doc = fromPack(file);
  const source = `Compendium.essence20.x.Item.${doc._id ?? file.split('_').pop().replace('.json', '')}`;
  return {
    id: `i${nextId++}`, name: doc.name, type: doc.type, flags: { core: { sourceId: source }, ...(extra.flags ?? {}) }, system: { ...doc.system, ...(extra.system ?? {}) },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
  };
}

beforeEach(() => {
  rollTest.mockClear();
  chooseSelect.mockReset();
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null }, settings: { get: () => 1 },
    i18n: { localize: k => k, format: k => k },
  };
  global.ui = { notifications: { warn: jest.fn() } };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) },
    applications: { api: { DialogV2: { prompt: jest.fn(async () => 2) } } },
  };
});

const target = actor => {
  game.user.targets = new Set([{ actor }]);
};

/* -------------------------------------------- */
/*  Vehicle Qualifications (qualify1)            */
/* -------------------------------------------- */

const MTR = 'fffav1items/_source/Mega_Training_Regimen_nLT8HSCCGWEBiRlq.json';
const SNE = 'fffav1items/_source/Spared_No_Expense_3ZrBd6FhV6Fep1zq.json';
const SURGICAL = 'fffav1items/_source/Surgical_Operators_JtRCN6ppDatZVmav.json';
const USSF = 'fffav1items/_source/Ultra_Secret_Strike_Force_4Gd5yet4c24yjWtY.json';
const COBRA_LA = 'fffav1items/_source/The_Glory_of_Cobra_La_VAhtHpKlv4gsR0OY.json';
const COBRA_LA_UUID = 'Compendium.essence20.ferocious_fighters.Item.VAhtHpKlv4gsR0OY';

const land = (size, extra = {}) => ({ name: 'Truck', type: 'vehicle', system: { size, movement: { ground: { base: 30 } }, crew: { numPassengers: 0 }, traits: {} }, ...extra });

/** A driver holding the given Perks, at the wheel of `vehicle` (role: driver, or another crew role). */
function driver(files, vehicle, { shift = 'd4', role = 'driver', cobraSource = false } = {}) {
  const items = files.map(file => packItem(file));
  if (cobraSource) {
    items.find(item => item.name == 'The Glory of Cobra-La').flags.core.sourceId = COBRA_LA_UUID;
  }

  const actor = makeActor({ system: { skills: { driving: { shift } } }, items });
  setCrewLookup(who => (who === actor && vehicle ? { vehicle, role } : null));
  return actor;
}

const driving = actor => ruleRollSources(actor, null, { rolledSkill: 'driving' }).sources;
const upshift = actor => driving(actor).reduce((sum, source) => sum + (source.shiftUp ?? 0), 0);
function liftsSnag(actor) {
  const options = { snag: true, shiftUp: 0, shiftDown: 0 };
  applyRuleImmunity(actor, options, { rolledSkill: 'driving' });
  return !options.snag;
}

describe('vehicle Qualifications', () => {
  test('by size, passengers and paint: ↑1 driving a qualifying vehicle with Ranks', () => {
    expect(upshift(driver([MTR], land('huge')))).toBe(1);
    expect(upshift(driver([MTR], land('large')))).toBe(0);
    expect(upshift(driver([SNE], land('long')))).toBe(1);
    expect(upshift(driver([SNE], land('huge')))).toBe(0);
    expect(upshift(driver([SNE], land('common', { system: { size: 'common', movement: { ground: { base: 0 }, aerial: { base: 60 } } } })))).toBe(0);
    expect(upshift(driver([SURGICAL], { name: 'Ambulance', system: { crew: { numPassengers: 2 } } }))).toBe(1);
    expect(upshift(driver([SURGICAL], { name: 'Bike', system: { crew: { numPassengers: 0 } } }))).toBe(0);
    expect(upshift(driver([USSF], { name: 'Python Conquest', system: {} }))).toBe(1);
    expect(upshift(driver([USSF], { name: 'Night Raven', system: { traits: { pythonPaint: true } } }))).toBe(1);
    expect(upshift(driver([USSF], { name: 'Night Raven', system: { traits: {} } }))).toBe(0);
  });

  test('only driving: not as a passenger, not with another Skill, not with no vehicle', () => {
    expect(upshift(driver([MTR], land('huge'), { role: 'passenger' }))).toBe(0);
    expect(ruleRollSources(driver([MTR], land('huge')), null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    expect(upshift(driver([MTR], null))).toBe(0);
  });

  test('several qualifying Perks still give one ↑1', () => {
    const vehicle = land('long', { name: 'Python Truck', system: { ...land('long').system, crew: { numPassengers: 3 } } });
    expect(upshift(driver([SNE, SURGICAL, USSF], vehicle))).toBe(1);
  });

  test('untrained: no ↑1, the Snag is lifted', () => {
    const actor = driver([MTR], land('huge'), { shift: 'd20' });
    expect(upshift(actor)).toBe(0);
    expect(liftsSnag(actor)).toBe(true);
    expect(liftsSnag(driver([MTR], land('huge')))).toBe(false);
    expect(liftsSnag(driver([MTR], land('large'), { shift: 'd20' }))).toBe(false);
  });

  test('The Glory of Cobra-La: Biomechanical vehicles qualify, any other gives a Snag', () => {
    const bio = { name: 'Insectoid Flyer', system: { traits: { biomechanical: true } } };
    const mount = { name: 'Cobra-La Mount', system: { traits: {} } };
    const truck = { name: 'Supply Truck', system: { traits: {} } };
    expect(upshift(driver([COBRA_LA], bio))).toBe(1);
    expect(upshift(driver([COBRA_LA], mount))).toBe(1);
    expect(driving(driver([COBRA_LA], bio)).some(source => source.snag)).toBe(false);
    const snagged = driving(driver([COBRA_LA], truck));
    expect(snagged).toEqual([expect.objectContaining({ snag: true })]);
    expect(liftsSnag(driver([COBRA_LA], bio, { shift: 'd20' }))).toBe(true);
    expect(liftsSnag(driver([COBRA_LA], truck, { shift: 'd20' }))).toBe(false);
  });

  test('another Perk never lifts Cobra-La\'s Snag for a vehicle that isn\'t Biomechanical', () => {
    const truck = land('long');
    expect(liftsSnag(driver([SNE, COBRA_LA], truck, { shift: 'd20', cobraSource: true }))).toBe(false);
    expect(liftsSnag(driver([SNE, COBRA_LA], { ...truck, name: 'Bio-Mech Truck' }, { shift: 'd20', cobraSource: true }))).toBe(true);
    expect(liftsSnag(driver([SNE], truck, { shift: 'd20' }))).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Mentor (qualify2)                            */
/* -------------------------------------------- */

const MENTOR = 'tfcrbitems/_source/Mentor_aMrMtyNJUsSYyMId.json';
const intimidation = () => ({ intimidation: { shift: 'd4', essences: { strength: true, social: false, speed: false, smarts: false } } });

describe('Mentor', () => {
  test('the Use picks a Skill and an Essence; that Skill can use the Essence', async () => {
    const perk = packItem(MENTOR);
    const actor = makeActor({ system: { skills: intimidation() }, items: [perk] });
    chooseSelect.mockResolvedValueOnce('intimidation').mockResolvedValueOnce('social');
    const pay = jest.fn(async () => true);
    expect(await runUse(perk, pay)).toBeTruthy();
    expect(pay).not.toHaveBeenCalled();
    expect(chooseSelect.mock.calls[0][2].map(o => o.value)).toContain('weird');
    expect(chooseSelect.mock.calls[1][2].map(o => o.value)).toEqual(['strength', 'speed', 'smarts', 'social']);
    expect(perk.flags.essence20.rules.choices).toEqual({ skill: 'intimidation', essence: 'social' });
    ruleDerived(actor);
    expect(actor.system.skills.intimidation.essences.social).toBe(true);
    expect(actor.system.skills.intimidation.essences.speed).toBe(false);
  });

  test('no pick yet, no change', () => {
    const actor = makeActor({ system: { skills: intimidation() }, items: [packItem(MENTOR)] });
    ruleDerived(actor);
    expect(actor.system.skills.intimidation.essences).toEqual(intimidation().intimidation.essences);
  });

  test('an old pick (flags.essence20.q2Mentor) carries over', () => {
    const perk = packItem(MENTOR, { flags: { essence20: { q2Mentor: { skill: 'intimidation', essence: 'social' } } } });
    const actor = makeActor({ items: [perk] });
    expect(legacyChoiceUpdates(actor)).toEqual([{ _id: perk.id, 'flags.essence20.rules.choices.skill': 'intimidation', 'flags.essence20.rules.choices.essence': 'social' }]);
  });
});

/* -------------------------------------------- */
/*  At Ease, Disease (qualify2)                  */
/* -------------------------------------------- */

const AT_EASE = 'sssitems/_source/At_Ease_Disease_MHPffqgwDx7u3tlZ.json';

describe('At Ease, Disease', () => {
  const setUp = () => {
    const perk = packItem(AT_EASE);
    return { perk, actor: makeActor({ items: [perk] }) };
  };

  test('out of combat: nothing asked, nothing paid', async () => {
    const { perk } = setUp();
    const pay = jest.fn(async () => true);
    expect(await runUse(perk, pay)).toContain('Only during combat.');
    expect(pay).not.toHaveBeenCalled();
    expect(foundry.applications.api.DialogV2.prompt).not.toHaveBeenCalled();
  });

  test('not a vehicle, Zord or Megaform', async () => {
    game.combat = { id: 'c', started: true, round: 1, turn: 0 };
    const { perk } = setUp();
    for (const type of ['vehicle', 'zord', 'megaform']) {
      target(makeActor({ type }));
      const pay = jest.fn(async () => true);
      expect(await runUse(perk, pay)).toContain('Only living creatures.');
      expect(pay).not.toHaveBeenCalled();
    }
  });

  test('a cancelled amount costs nothing', async () => {
    game.combat = { id: 'c', started: false };
    const { perk } = setUp();
    foundry.applications.api.DialogV2.prompt.mockResolvedValueOnce(null);
    const pay = jest.fn(async () => true);
    expect(await runUse(perk, pay)).toBeNull();
    expect(pay).not.toHaveBeenCalled();
    expect(rollTest).not.toHaveBeenCalled();
  });

  test('a Standard action, Intimidation at DIF 5 + 5 per Health; success heals the target and clears Defeated', async () => {
    game.combat = { id: 'c', started: true, round: 1, turn: 0 };
    const { perk, actor } = setUp();
    const friend = makeActor({ name: 'Friend', system: { health: { value: 0, max: 10 } } });
    friend.statuses.add('defeated');
    target(friend);
    const pay = jest.fn(async () => true);
    await runUse(perk, pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(rollTest).toHaveBeenCalledWith(actor, 'intimidation', 15, expect.any(Object));
    expect(friend.system.health.value).toBe(2);
    expect(friend.statuses.has('defeated')).toBe(false);
  });

  test('untargeted, it heals the user; a failed test heals nothing; never past the maximum', async () => {
    game.combat = { id: 'c', started: true, round: 1, turn: 0 };
    const { perk, actor } = setUp();
    actor.system.health.value = 9;
    await runUse(perk, jest.fn(async () => true));
    expect(actor.system.health.value).toBe(10);
    actor.system.health.value = 4;
    rollTest.mockResolvedValueOnce({ success: false, crit: false });
    expect(await runUse(perk, jest.fn(async () => true))).toContain('No Health restored.');
    expect(actor.system.health.value).toBe(4);
  });
});

/* -------------------------------------------- */
/*  Replacement Teeth (wtnv)                     */
/* -------------------------------------------- */

const TEETH = 'wtnvcgitems/_source/Replacement_Teeth_wuHnZ1qtGrd8il8a.json';

describe('Replacement Teeth', () => {
  test('needs a target before the Standard action is paid', async () => {
    const perk = packItem(TEETH);
    makeActor({ name: 'Pet', type: 'companion', items: [perk] });
    const pay = jest.fn(async () => true);
    await runUse(perk, pay);
    expect(pay).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test('a Standard action: the target is Immobilized for 1 round', async () => {
    game.combat = { id: 'c', started: true, round: 2, turn: 1 };
    const perk = packItem(TEETH);
    makeActor({ name: 'Pet', type: 'companion', items: [perk] });
    const foe = makeActor({ name: 'Foe', type: 'npc' });
    const effect = { statuses: new Set(['immobilized']), update: jest.fn(async () => {}) };
    foe.effects = { find: fn => [effect].find(fn) };
    target(foe);
    const pay = jest.fn(async () => true);
    await runUse(perk, pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(foe.statuses.has('immobilized')).toBe(true);
    expect(effect.update).toHaveBeenCalledWith({ 'duration.rounds': 1, 'duration.startRound': 2, 'duration.startTurn': 1 });
  });
});

/* -------------------------------------------- */
/*  Transmetal (data22)                          */
/* -------------------------------------------- */

const TRANSMETAL = 'tsitems/_source/Transmetal_MoXpVD8zILQ5h7T8.json';

describe('Transmetal', () => {
  const movement = () => ({
    ground: { altMode: 30, total: 30 }, aerial: { altMode: 0, total: 0 }, swim: { altMode: 0, total: 0 }, climb: { altMode: 0, total: 0 }, burrow: { altMode: 0, total: 0 },
  });
  const transformer = (choice, move, isTransformed = true) => makeActor({ system: { isTransformed, movement: move }, items: [packItem(TRANSMETAL, { system: { choice } })] });
  const after = (actor, type) => ruleMovementStages(actor)('afterGravity', type, actor.system.movement[type].total);

  test('a new Alt Mode Movement of 40 feet', () => {
    expect(after(transformer('aerial', movement()), 'aerial')).toBe(40);
    expect(after(transformer('swim', movement()), 'swim')).toBe(40);
  });

  test('+20 to one of several Alt Mode Movements', () => {
    const actor = transformer('aerial', { ...movement(), aerial: { altMode: 20, total: 20 } });
    expect(after(actor, 'aerial')).toBe(40);
    expect(after(actor, 'ground')).toBeNull();
  });

  test('raised to 40 when it is the only Alt Mode Movement', () => {
    expect(after(transformer('ground', movement()), 'ground')).toBe(40);
    expect(after(transformer('ground', { ...movement(), ground: { altMode: 50, total: 50 } }), 'ground')).toBe(50);
  });

  test('only in Alt Mode, and only with a choice', () => {
    expect(after(transformer('aerial', movement(), false), 'aerial')).toBeNull();
    expect(after(transformer(null, movement()), 'aerial')).toBeNull();
  });
});
