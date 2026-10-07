import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 17, split3 (docs/rules-batches/slSplit317.md): items that carried rules but still had hand-written code for part of
 * their behaviour. Each item is loaded from its pack source; these check the rules validate and that they do what the
 * removed code did.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const applyTimedCondition = jest.fn(async (actor, status) => actor.statuses.add(status));
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({ applyTimedCondition }));
const grants = {
  chooseSelect: jest.fn(async () => null), chooseButtons: jest.fn(async () => null), rollTest: jest.fn(async () => ({ success: true })),
  findItems: jest.fn(async () => []), pickOne: jest.fn(async () => null), grantCopy: jest.fn(async (actor, uuid) => ({ name: uuid })),
};
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
const pushActor = jest.fn(async () => true);
jest.unstable_mockModule('./mechanics/combat/forced-movement.mjs', () => ({ pushActor, pickCanvasPoint: jest.fn(async () => null) }));
const storyPoints = { canWriteStoryPoints: jest.fn(() => true), requestStoryPointGrant: jest.fn(async () => true) };
jest.unstable_mockModule('./mechanics/resources/story-points.mjs', () => storyPoints);
const setMorphedToughnessBonus = jest.fn(async () => {});
jest.unstable_mockModule('./sheet-handlers/perk-handler.mjs', () => ({ setMorphedToughnessBonus }));
const setEntryAndAddItem = jest.fn(async () => 'entry');
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ setEntryAndAddItem }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { registerCheck } = await import('./predicate.mjs');
const { fireItemAdded, fireTriggers, runUse, useAvailable, useRulesOf } = await import('./triggers.mjs');
const { ruleDerived, ruleRollSources, ruleWeaponTraits } = await import('./adapter.mjs');
const { bankedEntries } = await import('./bank.mjs');
const { sneakAttackWeaponGrants } = await import('./plugins/combat/sneak-attack-grant.mjs');
const { rulePetCommandUpshift, rulePetCommandTier } = await import('./plugins/picks/pet-command.mjs');
const { ruleContactAllegiance } = await import('./plugins/resources/contact-allegiance.mjs');
const { ruleKitUses } = await import('./plugins/resources/kit-uses.mjs');
const { ruleBrawnBonus } = await import('./plugins/effects/brawn-requirement.mjs');
const { addGroupTestBonuses } = await import('./plugins/rolls/group-test-bonus.mjs');
const { applyItemStage } = await import('./plugins/effects/item-modifier-stage.mjs');
const { vehicleChecks } = await import('./plugins/tags/vehicle-checks.mjs');
const { fireRoleDropped } = await import('./plugins/effects/role-dropped-event.mjs');
const { applyToVehicle } = await import('../mechanics/vehicles/vehicle-upgrades.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

export const FILES = {
  barrelingBeam: 'mlpcrbitems/_source/Barreling_Beam_FpQsQ0FCBFGHThQV.json',
  inMySights: 'gijcrbitems/_source/In_My_Sights_MD54SjlTYiCTvmBB.json',
  ballisticAdvantage: 'gijcrbitems/_source/Ballistic_Advantage_civSjmz83aDYPwvo.json',
  weaponCustomizer: 'iafav2items/_source/Weapon_Customizer_UWEU7hfmtRxlkWJB.json',
  synapticLinkage: 'eocitems/_source/Synaptic_Linkage_3JCZlRjXovAMXmko.json',
  favoriteCommand: 'wtnvcgitems/_source/Favorite_Command_GeHPKfuWe24HpYcQ.json',
  agreeable: 'mlpcrbitems/_source/Agreeable_YMG6nH32Y8yaYqZ9.json',
  gridlock: 'fgtaaitems/_source/Gridlock_Authority_EiS24nGsgSsroa16.json',
  distraction: 'fmmcitems/_source/Distraction_mJu5IxoVrPjp8dVU.json',
  venomWarlord: 'fmmcitems/_source/Venom_Warlord_9tU5tDmpOhChLfdv.json',
  unmovable: 'fmmcitems/_source/Unmovable_1aVrzJLiNkghFT4p.json',
  digIn: 'eocitems/_source/Dig_In_RQjNiRZxDFwTPHN8.json',
  frictionless: 'tsitems/_source/Frictionless_Movement_9fOrSAd3brtSBk9C.json',
  sprinter: 'tsitems/_source/Sprinter_L5P54Ismw81Lhrbe.json',
  wrestler: 'prcrbitems/_source/Wrestler_7QMuaLPZJWNPJHTz.json',
  powerBoost: 'atsitems/_source/Power_Boost_m3Kh8PqGf3O1oMmc.json',
  bruteForce: 'bthitems/_source/Brute_Force_3XP5RgmeyQwE5HH9.json',
  lanceOfLight: 'jttitems/_source/Lance_of_Light_HUdL1MryICmRmWnP.json',
  rushTheLine: 'iafav2items/_source/Rush_the_Line_va1HF5CudO4WsguB.json',
  shadow: 'gijcrbitems/_source/Shadow_PDiRwnTcNCtzJbDn.json',
  silentStrider: 'gijcrbitems/_source/Silent_Strider_C3KxTD37krYavSgw.json',
  gravityOptional: 'wtnvcgitems/_source/Gravity_Optional_F5mrzupd6TG2kj3x.json',
  gridSoldier: 'jttitems/_source/Grid_Soldier_y9F6PkCIw7g6tiqL.json',
  wisdom: 'ttsgitems/_source/Wisdom_of_the_Eldars_SB6FAYA0qIqV9F3G.json',
  observer: 'ttsgitems/_source/Observer_PTkqeQ8D4x9cstlZ.json',
  skier: 'ghpfitems/_source/Skier_dvmY7UiuKejOPY4N.json',
  heroicIntervention: 'prcrbitems/_source/Heroic_Intervention_T95n2lwh3F5OHjnB.json',
  honestAssessment: 'mlpcrbitems/_source/Honest_Assessment_eIDYxShici5rRpg3.json',
  emtGij: 'gijcrbitems/_source/EMT_Crash_Course_jDAu1zaZpv1IylJ8.json',
  emtPr: 'prcrbitems/_source/EMT_Crash_Course_cBezxXDBMpsRwYbP.json',
  personalPowerSupply: 'fgtaaitems/_source/Personal_Power_Supply_Uy3t5KLbeGHv08ho.json',
  reinforcedBasics: 'qgtgitems/_source/Reinforced_Basics_4HD4ibkT5hTdwlAW.json',
  takeTheWheel: 'ccitems/_source/Take_the_Wheel_EQK0bAGpmYkGPcRi.json',
  competitiveStrength: 'jttitems/_source/Competitive_Strength_J0ljd1QnU9AgoWj6.json',
  caretaker: 'prcrbitems/_source/Caretaker_4q2SPRzdbGosL62k.json',
  payItForward: 'jttitems/_source/Pay_It_Forward_M3pQgNMsU5hU5dMN.json',
  antiMatterReactor: 'qgtgitems/_source/Anti_Matter_Reactor_kOsm7efSfPh531Hm.json',
  camoNetting: 'qgtgitems/_source/Camo_Netting_S3qPHlomgES5iUNi.json',
  optimizedSeating: 'qgtgitems/_source/Optimized_Seating_5LrQ4TGjgWKsomL7.json',
  shallowDraft: 'qgtgitems/_source/Shallow_Draft_Ftm5iA7PG6J3M4aN.json',
  submarineMode: 'qgtgitems/_source/Submarine_Mode_ErSK3LwBT1Wg8rKF.json',
  treads: 'qgtgitems/_source/Treads_dXx85BLf1RKjn8xg.json',
  biotech: 'jttitems/_source/Biotech_Performance_Enhancer_wDMGtOqx1jpltxG9.json',
  aerialInterface: 'qgtgitems/_source/Aerial_Interface_Etogut0TJjvuKC9J.json',
  dutyOfTheSilver: 'atsitems/_source/Duty_of_the_Silver_KhV5GeGIMJNWlWhr.json',
  morphinTime: 'prcrbitems/_source/It_s_Morphin_Time__UFMTHB90lA9ZEvso.json',
  megaWeapon: 'prcrbitems/_source/Zord_Mega_Weapon_System_Wc1FJ5YDeTQS6XoE.json',
};

/** foundry.utils.setProperty, for plain objects. */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const node = keys.reduce((at, key) => (at[key] ??= {}), object);
  node[last] = value;
}

const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);
const clone = value => JSON.parse(JSON.stringify(value));

let nextId = 1;

function makeItem(actor, data) {
  const item = {
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, isOwner: true, ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    delete: jest.fn(async () => {}),
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

/** An actor holding the pack items `files`, with a token at x (feet) and disposition. */
function makeActor(name, files = [], { system = {}, x = 0, disposition = 1, type = 'playerCharacter', flags = {} } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, flags: { essence20: { ...flags } }, statuses: new Set(),
    system: {
      level: 12, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 6 } }, skills: {},
      essences: { strength: { value: 2, max: 2 }, speed: { value: 2, max: 2 }, smarts: { value: 2, max: 2 }, social: { value: 2, max: 2 } },
      defenses: { toughness: { total: 10 }, evasion: { total: 15 }, willpower: { total: 11 }, cleverness: { total: 12 } }, ...system,
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    async unsetFlag(scope, key) {
      delete this.flags[scope]?.[key];
    },
    getFlag(scope, key) {
      return getPath(this.flags[scope] ?? {}, key);
    },
    async createEmbeddedDocuments(kind, datas) {
      const made = datas.map(data => makeItem(actor, clone(data)));
      items.push(...made);
      rebuildIndex(actor);
      return made;
    },
    async deleteEmbeddedDocuments(kind, ids) {
      for (const id of ids) {
        const at = items.findIndex(item => item.id == id);
        if (at >= 0) {
          items.splice(at, 1);
        }
      }

      rebuildIndex(actor);
    },
    async toggleStatusEffect(status, { active } = {}) {
      if (active === false) {
        this.statuses.delete(status);
      } else {
        this.statuses.add(status);
      }
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  for (const file of [files].flat()) {
    const doc = fromPack(file);
    items.push(makeItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.test.Item.${doc._id}` } } }));
  }

  actor.items = {
    contents: items, get: id => items.find(item => item.id == id), find: fn => items.find(fn), filter: fn => items.filter(fn), some: fn => items.some(fn),
    map: fn => items.map(fn), [Symbol.iterator]: () => items[Symbol.iterator](),
  };
  const token = { actor, document: { disposition, uuid: `Scene.s.Token.t${actor.id}` }, center: { x, y: 0 }, id: `t${actor.id}`, name };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);
const firstItem = actor => actor.items.contents[0];

function scene(...actors) {
  const docs = new Map(actors.map(actor => [actor.uuid, actor]));
  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null, contents: actors, [Symbol.iterator]: () => actors[Symbol.iterator]() };
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token), controlled: [], setTargets: jest.fn() }, grid: { size: 100, measurePath: ([a, b]) => ({ distance: Math.hypot(a.x - b.x, a.y - b.y) }) }, scene: { id: 'sc', tokens: [] }, dimensions: { size: 100, distance: 5 } };
}

const target = (...actors) => {
  global.game.user.targets = new Set(actors.map(actor => actor.token));
  global.game.user.targets.first = () => actors[0]?.token;
};

const pay = jest.fn(async () => true);
/** Press the item's Use, picking the Use whose label starts with `label`. */
const press = (item, label = '', options = {}) => runUse(item, pay, { pick: async (it, available) => available.find(({ rule }) => String(rule.label ?? '').startsWith(label)) ?? null, ...options });
/** The labels of the item's Uses that can be pressed now. */
const available = item => useRulesOf(item).filter(({ rule, index }) => useAvailable(item, rule, index)).map(({ rule }) => rule.label);

const savedGame = global.game;
const savedFromUuid = global.fromUuid;
const savedFromUuidSync = global.fromUuidSync;

beforeEach(() => {
  pay.mockClear();
  applyTimedCondition.mockClear();
  pushActor.mockClear();
  grants.chooseSelect.mockReset();
  storyPoints.requestStoryPointGrant.mockClear();
  setMorphedToughnessBonus.mockClear();
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], activeGM: null },
    actors: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}), getSpeakerActor: () => null };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), skills: { might: 'E20.SkillMight', science: 'E20.SkillScience' }, essences: { strength: 'E20.EssenceStrength', speed: 'E20.EssenceSpeed', smarts: 'E20.EssenceSmarts', social: 'E20.EssenceSocial' }, statusEffects: [{ id: 'frightened', name: 'E20.Frightened' }, { id: 'impaired', name: 'E20.Impaired' }, { id: 'defeated', name: 'E20.Defeated' }] } };
  global.foundry = {
    ...global.foundry,
    applications: { api: { DialogV2: { wait: jest.fn(async () => null), confirm: jest.fn(async () => true) } } },
    utils: {
      ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, randomID: () => `r${nextId++}`,
      hasProperty: (o, k) => getPath(o, k) !== undefined, escapeHTML: text => String(text), deepClone: clone,
    },
  };
});

afterEach(() => {
  global.canvas = undefined;
  global.game = savedGame;
  global.fromUuid = savedFromUuid;
  global.fromUuidSync = savedFromUuidSync;
});

test('every split3 rule validates', () => {
  for (const file of Object.values(FILES)) {
    const rules = fromPack(file).system.rules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

/* -------------------------------------------- */
/*  Attacks and weapons                          */
/* -------------------------------------------- */

test('Barreling Beam: a hit pushes the target 15 ft away from the caster (the x2 Prone stays its own rule)', async () => {
  const caster = makeActor('Pony', FILES.barrelingBeam);
  const foe = makeActor('Foe', [], { x: 10, disposition: -1 });
  scene(caster, foe);
  const beam = firstItem(caster);
  await fireTriggers(caster, 'hit', { roll: { item: beam }, outcome: 'success', targets: [foe] });
  expect(pushActor).toHaveBeenCalledWith(foe, caster, 15);
  expect(foe.statuses.has('prone')).toBe(false);

  pushActor.mockClear();
  await fireTriggers(caster, 'hit', { roll: { item: { id: 'other' } }, outcome: 'success', targets: [foe] });
  expect(pushActor).not.toHaveBeenCalled();
});

test('In My Sights / Ballistic Advantage: a sniper weapon qualifies for Sneak Attack, to its own range / any range', () => {
  const effectOf = (actor, traits) => {
    const weapon = makeItem(actor, { type: 'weapon', system: { traits } });
    actor.items.contents.push(weapon);
    return makeItem(actor, { type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: { range: { long: 150 } } });
  };

  const sights = makeActor('Sniper', FILES.inMySights);
  expect(sneakAttackWeaponGrants(sights, effectOf(sights, ['sniper']))).toEqual({ qualifies: true, range: 'weapon' });
  expect(sneakAttackWeaponGrants(sights, effectOf(sights, ['silent']))).toEqual({ qualifies: false, range: undefined });

  const ballistic = makeActor('Sniper', [FILES.inMySights, FILES.ballisticAdvantage]);
  expect(sneakAttackWeaponGrants(ballistic, effectOf(ballistic, ['sniper']))).toEqual({ qualifies: true, range: 'unlimited' });
});

test('Weapon Customizer: a customized weapon is Temperamental while its holder has the Perk', () => {
  const holder = makeActor('Tinker', FILES.weaponCustomizer);
  const gun = makeItem(holder, { type: 'weapon', flags: { essence20: { customized: true } }, system: { traits: [] } });
  expect(ruleWeaponTraits(holder, gun, [])).toEqual(['temperamental']);
  expect(ruleWeaponTraits(holder, { ...gun, flags: {} }, [])).toEqual([]);

  const other = makeActor('Borrower');
  expect(ruleWeaponTraits(other, makeItem(other, { type: 'weapon', flags: { essence20: { customized: true } } }), [])).toEqual([]);
});

/* -------------------------------------------- */
/*  Companions, bonds and Contacts               */
/* -------------------------------------------- */

test('Synaptic Linkage: once per scene, one of your Conditions passes to your bonded ally', async () => {
  const partner = makeActor('Partner');
  const holder = makeActor('Head', FILES.synapticLinkage, { flags: { bond: { partner: partner.uuid, linked: false } } });
  scene(holder, partner);
  const perk = firstItem(holder);
  holder.statuses.add('frightened');
  holder.statuses.add('defeated');
  expect(available(perk)).toEqual(['Pass a Condition to your bonded ally (once per scene)']);

  grants.chooseSelect.mockImplementation(async (title, prompt, options) => {
    expect(options.map(option => option.value)).toEqual(['frightened']);
    return 'frightened';
  });
  await press(perk);
  expect(holder.statuses.has('frightened')).toBe(false);
  expect(partner.statuses.has('frightened')).toBe(true);
  expect(available(perk)).toEqual([]);

  const loner = makeActor('Alone', FILES.synapticLinkage);
  expect(available(firstItem(loner))).toEqual([]);
});

test('Favorite Command (Night Vale): the Use picks the Skill the pet obeys as a Move action', async () => {
  const pet = makeActor('Dog', FILES.favoriteCommand, { type: 'companion' });
  const perk = firstItem(pet);
  grants.chooseSelect.mockResolvedValue('might');
  await press(perk, 'Choose');
  expect(perk.flags.essence20.favoriteSkill).toBe('might');
});

test('Agreeable (MLP): ↑1 on the roll commanding its pet, and no DIF change', () => {
  const pet = makeActor('Pony Pet', FILES.agreeable, { type: 'companion' });
  expect(rulePetCommandUpshift(pet)).toBe(1);
  expect(rulePetCommandTier(pet)).toBe(0);
  expect(rulePetCommandUpshift(makeActor('Plain Pet', [], { type: 'companion' }))).toBe(0);
});

test('Gridlock Authority: civilian / government Contacts arrive with 1 more Allegiance Point', () => {
  const summoner = makeActor('Agent', FILES.gridlock);
  expect(ruleContactAllegiance(summoner, makeActor('Clerk', [], { type: 'npc', flags: { government: true } }))).toBe(1);
  expect(ruleContactAllegiance(summoner, makeActor('Thug', [], { type: 'npc' }))).toBe(0);
  expect(ruleContactAllegiance(makeActor('Nobody'), makeActor('Clerk', [], { type: 'npc', flags: { government: true } }))).toBe(0);
});

/* -------------------------------------------- */
/*  On / off switches                            */
/* -------------------------------------------- */

describe('on / off Uses keep writing the flags their readers read', () => {
  const POWERED = [
    ['unmovable', 'unmovableActive', 1],
    ['powerBoost', 'powerBoostActive', 2],
    ['bruteForce', 'powerBoostActive', 2],
    ['lanceOfLight', 'lanceOfLightActive', 2],
    ['observer', 'observerDisguiseActive', 1],
  ];
  const FREE = [
    ['digIn', 'cannoneerDugIn'],
    ['shadow', 'infiltratingActive'],
    ['silentStrider', 'infiltratingActive'],
    ['skier', 'isSkiingActive'],
    ['honestAssessment', 'honestAssessmentActive'],
  ];

  test.each(POWERED)('%s: on costs Personal Power (hidden when it can\'t be paid), off is free', async (key, flag, cost) => {
    const actor = makeActor('Ranger', FILES[key], { system: { powers: { personal: { value: cost, max: 6 } } } });
    const item = firstItem(actor);
    expect(available(item).some(label => label.includes(' on'))).toBe(true);
    await press(item, available(item).find(label => label.includes(' on')));
    expect(actor.flags.essence20[flag]).toBe(true);
    expect(actor.system.powers.personal.value).toBe(0);
    expect(available(item).some(label => label.endsWith(' off'))).toBe(true);
    expect(available(item).some(label => label.includes(' on ('))).toBe(false);
    await press(item, available(item).find(label => label.endsWith(' off')));
    expect(actor.flags.essence20[flag]).toBe(false);
    expect(actor.system.powers.personal.value).toBe(0);
    // Off with nothing left: can't switch on again.
    expect(available(item).filter(label => !label.startsWith('Strike'))).toEqual([]);
  });

  test.each(FREE)('%s: free either way', async (key, flag) => {
    const actor = makeActor('Joe', FILES[key]);
    const item = firstItem(actor);
    await press(item, available(item)[0]);
    expect(actor.flags.essence20[flag]).toBe(true);
    expect(available(item)).toHaveLength(1);
    await press(item, available(item)[0]);
    expect(actor.flags.essence20[flag]).toBe(false);
  });

  test("Lance of Light: its Strike is offered only while the Lance is summoned (it couldn't be switched on before)", async () => {
    const actor = makeActor('Ranger', FILES.lanceOfLight);
    const lance = firstItem(actor);
    expect(available(lance)).toEqual(['Lance of Light on (2 Personal Power)']);
    await press(lance, 'Lance of Light on');
    expect(available(lance)).toEqual(['Strike (1 Energy damage)', 'Lance of Light off']);
  });

  test('Distraction: on only while Morphed and not in Monster Form; off always', async () => {
    let monster = false;
    registerCheck('monsterForm', () => monster);
    const actor = makeActor('Putty', FILES.distraction, { system: { isMorphed: false } });
    const perk = firstItem(actor);
    expect(available(perk)).toEqual([]);
    actor.system.isMorphed = true;
    expect(available(perk)).toEqual(['Distraction on']);
    monster = true;
    expect(available(perk)).toEqual([]);
    monster = false;
    await press(perk, 'Distraction on');
    expect(actor.flags.essence20.distractionActive).toBe(true);
    actor.system.isMorphed = false;
    expect(available(perk)).toEqual(['Distraction off']);
  });

  test('Gravity Optional: floating switches on once per scene, off whenever', async () => {
    const actor = makeActor('Veteran', FILES.gravityOptional);
    const perk = firstItem(actor);
    await press(perk, 'Floating on');
    expect(actor.flags.essence20.gravityOptionalActive).toBe(true);
    await press(perk, 'Floating off');
    expect(actor.flags.essence20.gravityOptionalActive).toBe(false);
    expect(available(perk)).toEqual([]);
  });

  test('Wisdom of the Elders: only the chosen option is offered, at its own cost', async () => {
    const actor = makeActor('Guardian', FILES.wisdom);
    const perk = firstItem(actor);
    expect(available(perk)).toEqual([]);
    perk.system.choice = 'lightshieldArmor';
    expect(available(perk)).toEqual(['Lightshield Armor on (1 Personal Power)']);
    await press(perk, 'Lightshield Armor on');
    expect(actor.flags.essence20.wisdomOfTheEldersActive).toEqual({ lightshieldArmor: true });
    expect(actor.system.powers.personal.value).toBe(2);
    expect(available(perk)).toEqual(['Lightshield Armor off']);
    perk.system.choice = 'ferociousStrikes';
    expect(available(perk)).toEqual([]);
    actor.system.powers.personal.value = 3;
    expect(available(perk)).toEqual(['Ferocious Strikes on (3 Personal Power)']);
    perk.system.choice = 'teleportation';
    expect(useRulesOf(perk).filter(({ rule }) => rule.label.startsWith('Teleportation'))).toHaveLength(1);
  });
});

describe('Frictionless Movement / Sprinter / Rush the Line: active until the end of the turn', () => {
  test.each([['frictionless', 'frictionlessMovementActive'], ['sprinter', 'sprinterBoostActive']])('%s: once per scene, cleared at turn end', async (key, flag) => {
    const actor = makeActor('Beast', FILES[key]);
    const perk = firstItem(actor);
    await press(perk);
    expect(actor.flags.essence20[flag]).toBe(true);
    expect(available(perk)).toEqual([]);
    await fireTriggers(actor, 'turnEnd');
    expect(actor.flags.essence20[flag]).toBe(false);
  });

  test('Rush the Line: doubled Movement and a banked Edge for the next melee attack; cleared at turn end', async () => {
    const actor = makeActor('Renegade', FILES.rushTheLine);
    await press(firstItem(actor));
    expect(actor.flags.essence20.rushTheLineActive).toBe(true);
    expect(bankedEntries(actor)).toEqual([expect.objectContaining({ edge: true, when: ['attack:melee'], uses: 1, label: 'Rush the Line' })]);
    await fireTriggers(actor, 'turnEnd');
    expect(actor.flags.essence20.rushTheLineActive).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Conditions and healing                       */
/* -------------------------------------------- */

test('Wrestler: the pin Prones a Grappled target, and nothing else', async () => {
  const wrestler = makeActor('Ranger', FILES.wrestler);
  const foe = makeActor('Foe', [], { disposition: -1 });
  scene(wrestler, foe);
  target(foe);
  await press(firstItem(wrestler));
  expect(foe.statuses.has('prone')).toBe(false);
  foe.statuses.add('grappled');
  await press(firstItem(wrestler));
  expect(foe.statuses.has('prone')).toBe(true);
});

test('Venom Warlord: 1 Personal Power removes one of your Conditions (not Defeated)', async () => {
  const actor = makeActor('Warlord', FILES.venomWarlord);
  actor.statuses.add('frightened');
  actor.statuses.add('defeated');
  grants.chooseSelect.mockImplementation(async (title, prompt, options) => {
    expect(options.map(option => option.value)).toEqual(['frightened']);
    return 'frightened';
  });
  await press(firstItem(actor));
  expect(actor.statuses.has('frightened')).toBe(false);
  expect(actor.system.powers.personal.value).toBe(2);
});

describe('Grid Soldier', () => {
  test('removes Impaired from yourself (nothing targeted) or an ally within 5 ft, for 1 Personal Power', async () => {
    const soldier = makeActor('Soldier', FILES.gridSoldier);
    const ally = makeActor('Ally', [], { x: 5 });
    scene(soldier, ally);
    soldier.statuses.add('impaired');
    await press(firstItem(soldier));
    expect(soldier.statuses.has('impaired')).toBe(false);
    expect(soldier.system.powers.personal.value).toBe(2);

    ally.statuses.add('impaired');
    target(ally);
    await press(firstItem(soldier));
    expect(ally.statuses.has('impaired')).toBe(false);
    expect(soldier.system.powers.personal.value).toBe(1);
  });

  test('refuses (and spends nothing) for an enemy, a far ally or someone not Impaired', async () => {
    const soldier = makeActor('Soldier', FILES.gridSoldier);
    const enemy = makeActor('Enemy', [], { x: 5, disposition: -1 });
    const far = makeActor('Far', [], { x: 30 });
    scene(soldier, enemy, far);
    enemy.statuses.add('impaired');
    far.statuses.add('impaired');
    for (const other of [enemy, far, soldier]) {
      target(other);
      await press(firstItem(soldier));
    }

    expect(enemy.statuses.has('impaired')).toBe(true);
    expect(far.statuses.has('impaired')).toBe(true);
    expect(soldier.system.powers.personal.value).toBe(3);
  });
});

describe('EMT Crash Course (both printings)', () => {
  test.each(['emtGij', 'emtPr'])('%s: heal 1 once per scene, or restore 1 damaged Essence', async key => {
    const medic = makeActor('Medic', FILES[key]);
    const ally = makeActor('Ally', [], { system: { health: { value: 5, max: 10 } } });
    ally.system.essences.smarts = { value: 1, max: 2 };
    scene(medic, ally);
    target(ally);
    const perk = firstItem(medic);
    expect(available(perk)).toEqual(['Heal 1 Health (once per scene)', 'Restore 1 Essence']);
    await press(perk, 'Heal');
    expect(ally.system.health.value).toBe(6);
    expect(available(perk)).toEqual(['Restore 1 Essence']);

    grants.chooseSelect.mockImplementation(async (title, prompt, options) => {
      expect(options.map(option => option.value)).toEqual(['smarts']);
      return 'smarts';
    });
    await press(perk, 'Restore');
    expect(ally.system.essences.smarts.value).toBe(2);
  });
});

test('Heroic Intervention: the Story Point first (once per encounter), then the 1-Power move', async () => {
  const hero = makeActor('Hero', FILES.heroicIntervention);
  const perk = firstItem(hero);
  expect(available(perk)).toEqual(['A Story Point for the team (once per encounter)']);
  await press(perk, 'A Story Point');
  expect(storyPoints.requestStoryPointGrant).toHaveBeenCalledWith(hero, 1, expect.anything());
  expect(available(perk)).toEqual(['Move up to 15 ft (1 Personal Power)']);
  await press(perk, 'Move');
  expect(hero.system.powers.personal.value).toBe(2);
});

/* -------------------------------------------- */
/*  Gear, kits and Group Tests                   */
/* -------------------------------------------- */

test('Personal Power Supply: a Grid Power pick while Grid Powers are fewer than Personal Power', () => {
  const actor = makeActor('Ranger', FILES.personalPowerSupply, { system: { powers: { personal: { value: 2, max: 2 } } } });
  const perk = firstItem(actor);
  expect(available(perk)).toEqual(['Choose a Grid Power']);
  actor.items.contents.push(makeItem(actor, { type: 'power', system: { type: 'grid' } }), makeItem(actor, { type: 'power', system: { type: 'sorcerous' } }));
  expect(available(perk)).toEqual(['Choose a Grid Power']);
  actor.items.contents.push(makeItem(actor, { type: 'power', system: { type: 'grid' } }));
  expect(available(perk)).toEqual([]);
});

test('Reinforced Basics: Standard Kits last three uses, other tiers one', () => {
  const actor = makeActor('Joe', FILES.reinforcedBasics);
  expect(ruleKitUses(actor, 'standard')).toBe(3);
  expect(ruleKitUses(actor, 'limited')).toBe(1);
  expect(ruleKitUses(makeActor('Plain'), 'standard')).toBe(1);
});

test("Take the Wheel: this mission's Limited Driving (Land) Kit, usable without its prerequisite, replacing the last one", async () => {
  const driver = makeActor('Driver', FILES.takeTheWheel);
  const perk = firstItem(driver);
  await press(perk);
  await press(perk);
  const kits = driver.items.contents.filter(item => item.flags.essence20?.grantedBy == perk.id);
  expect(kits).toHaveLength(1);
  expect(kits[0]).toEqual(expect.objectContaining({ name: 'Limited Driving (Land) Kit', type: 'gear', system: { gearType: 'kits', quantity: 1 } }));
  expect(kits[0].flags.essence20).toEqual(expect.objectContaining({ kit: { tier: 'limited', skill: 'driving', spec: 'Land', essence: null }, ignorePrerequisite: true }));
});

test('Competitive Strength: Brawn 2 Ranks higher for carrying only', () => {
  const actor = makeActor('Strong', FILES.competitiveStrength);
  expect(ruleBrawnBonus(actor, 'carrying')).toBe(2);
  expect(ruleBrawnBonus(actor, 'requirement')).toBe(0);
});

test('Caretaker / Pay It Forward: Edge and ↑1 on your own Group Test rolls', () => {
  const out = addGroupTestBonuses(makeActor('Ranger', [FILES.caretaker, FILES.payItForward]), null, { shiftUp: 0, edge: false, labels: [] });
  expect(out).toEqual({ shiftUp: 1, edge: true, labels: ['Caretaker', 'Pay It Forward'] });
});

/* -------------------------------------------- */
/*  Vehicles                                     */
/* -------------------------------------------- */

describe('vehicle upgrades', () => {
  const movement = (ground, aerial = 0, swim = 0) => ({ ground: { total: ground }, aerial: { total: aerial }, swim: { total: swim }, climb: { total: 7 } });
  const vehicleWith = (files, speeds, toggles = {}) => {
    const vehicle = makeActor('VAMP', files, { type: 'vehicle', system: { movement: speeds } });
    for (const item of vehicle.items.contents) {
      item.flags.essence20 = { rules: { toggles } };
    }

    return vehicle;
  };

  const totals = vehicle => Object.fromEntries(Object.entries(vehicle.system.movement).map(([type, speed]) => [type, speed.total]));

  test('Anti-Matter Reactor x3, then Biotech +20 / +10 (only speeds it has), Optimized Seating and Camo Netting -10, never below 0', () => {
    const vehicle = vehicleWith([FILES.antiMatterReactor, FILES.biotech, FILES.optimizedSeating, FILES.camoNetting], movement(60, 5, 0), { boost: true, camo: true });
    applyToVehicle(vehicle);
    expect(totals(vehicle)).toEqual({ ground: 180 + 20 - 20, aerial: 15 + 10 - 20, swim: 0, climb: 7 });

    const plain = vehicleWith([FILES.optimizedSeating, FILES.camoNetting], movement(15, 0, 5));
    applyToVehicle(plain);
    expect(totals(plain)).toEqual({ ground: 5, aerial: 0, swim: 0, climb: 7 });

    const parked = vehicleWith([FILES.biotech], movement(60));
    applyToVehicle(parked);
    expect(totals(parked).ground).toBe(60);
  });

  test('Shallow Draft and Submarine Mode, before the x3', () => {
    const draft = vehicleWith([FILES.shallowDraft, FILES.antiMatterReactor], movement(20, 0, 30));
    applyToVehicle(draft);
    expect(totals(draft)).toEqual({ ground: 90, aerial: 0, swim: 90, climb: 7 });

    const sub = vehicleWith([FILES.submarineMode], movement(40, 60, 0));
    applyToVehicle(sub);
    expect(totals(sub).swim).toBe(40);
    const flyer = vehicleWith([FILES.submarineMode], movement(0, 60, 0));
    applyToVehicle(flyer);
    expect(totals(flyer).swim).toBe(30);
    const swimmer = vehicleWith([FILES.submarineMode], movement(40, 0, 10));
    applyToVehicle(swimmer);
    expect(totals(swimmer).swim).toBe(10);
  });

  test("Biotech Performance Enhancer: +1 damage on the vehicle's own attacks while boosted (not rams, flybys or Stun)", () => {
    const vehicle = vehicleWith([FILES.biotech], movement(60), { boost: true });
    const cannon = makeItem(vehicle, { type: 'weaponEffect', system: { damageType: 'energy', damageValue: 2 } });
    const ram = makeItem(vehicle, { type: 'weaponEffect', system: { damageType: 'blunt', damageValue: 2, isRam: true } });
    const stun = makeItem(vehicle, { type: 'weaponEffect', system: { damageType: 'stun', damageValue: 2 } });
    for (const effect of [cannon, ram, stun]) {
      applyItemStage(effect.system, effect, 'start');
    }

    expect([cannon, ram, stun].map(effect => effect.system.damageValue)).toEqual([3, 2, 2]);
    vehicle.items.contents[0].flags.essence20.rules.toggles.boost = false;
    const later = makeItem(vehicle, { type: 'weaponEffect', system: { damageType: 'energy', damageValue: 2 } });
    applyItemStage(later.system, later, 'start');
    expect(later.system.damageValue).toBe(2);
  });

  test('Treads: Edge on Driving in Rough Terrain, for the vehicle and its crew', () => {
    const vehicle = vehicleWith([FILES.treads], movement(60));
    let rough = true;
    vehicleChecks.isInRoughTerrain = () => rough;
    vehicleChecks.getCrewedVehicle = () => null;
    expect(ruleRollSources(vehicle, null, { rolledSkill: 'driving' }).sources).toEqual([expect.objectContaining({ edge: true })]);
    rough = false;
    expect(ruleRollSources(vehicle, null, { rolledSkill: 'driving' }).sources).toEqual([]);
    vehicleChecks.isInRoughTerrain = null;
  });

  test("Aerial Interface: the driver's active shield on an aerial vehicle", () => {
    const driver = makeActor('Pilot', FILES.aerialInterface, { system: { activeShieldDefense: { toughness: 2 } } });
    const vehicle = makeActor('Jet', [], { type: 'vehicle', system: { movement: { aerial: { base: 100, total: 100 } }, traits: {}, actors: { d: { uuid: driver.uuid, vehicleRole: 'driver' } } } });
    const truck = makeActor('Truck', [], { type: 'vehicle', system: { movement: { ground: { base: 60, total: 60 } }, traits: {}, actors: { d: { uuid: driver.uuid, vehicleRole: 'driver' } } } });
    scene(driver, vehicle, truck);
    rebuildIndex(vehicle);
    rebuildIndex(truck);
    ruleDerived(vehicle);
    ruleDerived(truck);
    expect(vehicle.system.defenses.toughness.total).toBe(12);
    expect(vehicle.system.defenses.evasion.total).toBe(15);
    expect(truck.system.defenses.toughness.total).toBe(10);
  });
});

/* -------------------------------------------- */
/*  Drop-time and Role-time rules                */
/* -------------------------------------------- */

test('Duty of the Silver: added, it trains Heavy Armor - Ultra-Heavy when Heavy is already trained', async () => {
  const fresh = makeActor('Silver', FILES.dutyOfTheSilver, { system: { trained: { armors: { heavy: false, ultraHeavy: false } } } });
  await fireItemAdded(fresh, firstItem(fresh));
  expect(fresh.system.trained.armors).toEqual({ heavy: true, ultraHeavy: false });

  const veteran = makeActor('Silver', FILES.dutyOfTheSilver, { system: { trained: { armors: { heavy: true, ultraHeavy: false } } } });
  await fireItemAdded(veteran, firstItem(veteran));
  expect(veteran.system.trained.armors).toEqual({ heavy: true, ultraHeavy: true });
});

test("It's Morphin Time!: a dropped Role re-works the Morphed Toughness bonus", async () => {
  const ranger = makeActor('Ranger', FILES.morphinTime, { system: { trained: { armors: { heavy: true } } } });
  await fireRoleDropped(ranger);
  expect(setMorphedToughnessBonus).toHaveBeenCalledWith(ranger);
  setMorphedToughnessBonus.mockClear();
  await fireRoleDropped(makeActor('Joe', [], { system: { trained: { armors: {} } } }));
  expect(setMorphedToughnessBonus).not.toHaveBeenCalled();
});

describe('Zord Mega-Weapon System', () => {
  const LANG = {
    'E20.ZordFeatureAttackMelee': 'Melee Weapon Attack', 'E20.ZordFeatureAttackRanged': 'Ranged Weapon Attack',
    'E20.ZordFeatureAttackEffectName': '{name} Effect', 'E20.MegaWeaponName': 'Mega-Weapon',
  };
  const askIndex = n => async () => n;

  beforeEach(() => {
    game.i18n.localize = key => LANG[key] ?? key;
    game.i18n.format = (key, data) => Object.entries(data).reduce((text, [k, v]) => text.replace(`{${k}}`, v), LANG[key] ?? key);
    global.CONFIG.E20.damageTypes = { energy: 'E20.DamageEnergy', fire: 'E20.DamageFire' };
    global.CONFIG.E20.weaponTraits = { energy: 'E20.WeaponTraitEnergy' };
  });

  test('added, it builds the 5-damage weapon of the chosen style and type, flagged for its attack counter', async () => {
    const zord = makeActor('Zord', FILES.megaWeapon, { type: 'zord' });
    scene(zord);
    const feature = firstItem(zord);
    grants.chooseSelect.mockResolvedValue('energy');
    await fireItemAdded(zord, feature, { ask: askIndex(1) });
    const weapon = itemNamed(zord, 'Mega-Weapon');
    expect(weapon).toEqual(expect.objectContaining({ type: 'weapon', system: { traits: ['energy'] } }));
    expect(weapon.flags.essence20?.grantedBy).toBeUndefined();
    const effect = itemNamed(zord, 'Mega-Weapon Effect');
    expect(effect.system).toEqual({
      classification: { skill: 'targeting', style: 'projectile' }, damageType: 'energy', damageValue: 5, defenseType: 'toughness',
      range: { min: null, reachMultiplier: 1, long: 120, value: 50 },
    });
    expect(effect.flags.essence20).toEqual(expect.objectContaining({ parentId: weapon.id, isMegaWeapon: true }));
    expect(ui.notifications.info).toHaveBeenCalledWith('E20.MegaWeaponCreated');
    expect(feature.delete).not.toHaveBeenCalled();
  });

  test('melee: Might, Reach; a cancelled choice takes the Feature off again', async () => {
    const zord = makeActor('Zord', FILES.megaWeapon, { type: 'zord' });
    grants.chooseSelect.mockResolvedValue('fire');
    await fireItemAdded(zord, firstItem(zord), { ask: askIndex(0) });
    expect(itemNamed(zord, 'Mega-Weapon').system.traits).toEqual([]);
    expect(itemNamed(zord, 'Mega-Weapon Effect').system).toEqual(expect.objectContaining({
      classification: { skill: 'might', style: 'melee' }, damageType: 'fire', range: { min: null, reachMultiplier: 1, long: null, value: null },
    }));

    const other = makeActor('Other', FILES.megaWeapon, { type: 'zord' });
    grants.chooseSelect.mockResolvedValue(null);
    await fireItemAdded(other, firstItem(other), { ask: askIndex(0) });
    expect(firstItem(other).delete).toHaveBeenCalled();
    expect(other.items.contents).toHaveLength(1);
  });
});
