import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 16, part b (docs/rules-batches/slLeftB16.md): the items rounds 14 and 15 left as code. Each item is loaded from
 * its pack source; these check the rules validate and that the converted rules do what the removed code did.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const rolls = { rows: null };
const rollVsMany = jest.fn(async (actor, skill, others) => (rolls.rows ? rolls.rows(others) : others.map(other => ({ targetUuid: other.uuid, success: true, multiplier: 1 }))));
jest.unstable_mockModule('./mechanics/combat/reaction-engine.mjs', () => ({ rollVsMany }));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const applyTimedCondition = jest.fn(async (actor, status) => actor.statuses.add(status));
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({ applyTimedCondition }));
const applyDamage = jest.fn(async () => true);
const grants = {
  chooseSelect: jest.fn(async () => null), chooseButtons: jest.fn(async () => null), rollTest: jest.fn(async () => ({ success: true })),
  findItems: jest.fn(async () => []), pickOne: jest.fn(async () => null), grantCopy: jest.fn(async (actor, uuid) => ({ name: uuid })),
};
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  applyDamage,
  getDefenseValue: (actor, key) => Number(actor.system?.defenses?.[key]?.total) || 0,
}));

const setEntryAndAddItem = jest.fn(async () => 'entry');
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ setEntryAndAddItem }));
const spend = jest.fn(async () => ({ blocked: false }));
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({ spend, setNextTurn: jest.fn(), grantBonusAttack: jest.fn(), getLedger: () => null, isTracking: () => false }));
const powerCost = jest.fn(async () => {});
jest.unstable_mockModule('./sheet-handlers/power-handler.mjs', () => ({ powerCost }));
const explodeVehicle = jest.fn(async () => {});
jest.unstable_mockModule('./mechanics/vehicles/vehicle-defeat.mjs', () => ({ explodeVehicle }));
const activateWhyDoIKnowThat = jest.fn(async () => 'Compendium.essence20.x.Item.perk');
jest.unstable_mockModule('./items/gear/why-do-i-know-that.mjs', () => ({ activateWhyDoIKnowThat }));
const pickCanvasPoint = jest.fn(async () => null);
jest.unstable_mockModule('./mechanics/combat/forced-movement.mjs', () => ({ pickCanvasPoint }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { fireItemAdded, fireTriggers, runUse, useAvailable } = await import('./triggers.mjs');
const { hitRiderOnAttack } = await import('./plugins/combat/hit-rider.mjs');
const { pressCardButton } = await import('./plugins/cards/card-buttons.mjs');
const { ruleMultipleTargets } = await import('./plugins/combat/hazard-terrain-targets.mjs');
const { bankedEntries, bankedSpecializes } = await import('./bank.mjs');
const { earlyDefenseAdjust } = await import('./plugins/combat/early-defense.mjs');
const { markedTargetSources } = await import('./plugins/marks/rule-marks.mjs');
const { bankKeySideCount, hasBankKey } = await import('./plugins/resources/bank-keys-and-borrowing.mjs');
const { consumeOneMark, inMarkedArea } = await import('./plugins/marks/counted-marks.mjs');
const { ruleDerived, ruleRollSources } = await import('./adapter.mjs');
const { markedRowOutcomes } = await import('./plugins/rolls/marked-row-outcome.mjs');
const { runScheduledNextRound } = await import('./plugins/combat/next-round-schedule.mjs');
const kits = await import('../mechanics/resources/kits.mjs');
const { imperfectionOf } = await import('../mechanics/resources/grant-uses.mjs');
const { bondGuardSources, holderBestAdjust } = await import('./plugins/combat/bond-partner-guard.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

export const FILES = {
  groundSuppression: 'qgtgitems/_source/Ground_Suppression_nCjrhYaUuN4omhDm.json',
  dangerClose: 'qgtgitems/_source/Danger_Close_FpwnwD7Pnl6uvLTZ.json',
  techSpecs: 'qgtgitems/_source/Tech_Specs_Ii4gXQePcG8xg0hB.json',
  technicalMastery: 'qgtgitems/_source/Technical_Mastery_QKlXoVgNMq7Kv58L.json',
  dataBridge: 'eocitems/_source/Data_Bridge_uLtZ0zbfx0K4jcSK.json',
  thinkTank: 'eocitems/_source/Think_Tank_TklqajBQCS7jiwpC.json',
  misery: 'eocitems/_source/Misery_Loves_Company_JJ8ffuxjYeXJ9KJ2.json',
  eyeForAppraisal: 'dditems/_source/Eye_For_Appraisal_JlwxiwZDpq7UkYXn.json',
  vantagePoint: 'dditems/_source/Vantage_Point_j8s0vIsIEUJzAAvy.json',
  powerfulSuggestion: 'eocitems/_source/Powerful_Suggestion_QRGflsYQcDN16l10.json',
  rigUpgrade: 'ccitems/_source/Rig_Upgrade_FmJF8idUZpHAxIPM.json',
  rallyGuardiansFeatures: 'ttsgitems/_source/Rally_Guardians_Features_vJYXOqRQIDEUmuDE.json',
  selfDestruct: 'qgtgitems/_source/Self_Destruct_0xonF9tJvSOcn6Ow.json',
  additionalAttackType: 'prcrbitems/_source/Additional_Attack_Type_j5arWXvkd5fHbe0Q.json',
  metallicArmor: 'ttsgitems/_source/Metallic_Armor_Power_Up_LotTM0zOcCBLkki4.json',
  dominate: 'qgtgitems/_source/Dominate_HwREY90wo09Hkdt1.json',
  inTheRightHands: 'dditems/_source/In_The_Right_Hands_z5xX6kylwvCblYkl.json',
  packAttack: 'ccitems/_source/Pack_Attack_spxYtWFQPj7bBt0g.json',
  medicineKit: 'wtnvcgitems/_source/Medicine_Kit_3mgHGQRzVaKtwnWb.json',
  hintOfIndependence: 'dditems/_source/A_Hint_of_Independence_TkzfZUNiGvv5iWDh.json',
  hitSomeone: 'eocitems/_source/Hit_Someone_Your_Own_Size__zDeWS4koDbfN98hB.json',
  tryMe: 'sssitems/_source/Try_Me_ZyWXJTkPqv8S6K3b.json',
  scienceKit: 'wtnvcgitems/_source/Science_Kit_alcXH1wbroHciYlS.json',
  travelReporterKit: 'wtnvcgitems/_source/Travel_Reporter_Kit_gG1nTctk40oLyJJH.json',
};

// The pack files this part gave rules to (Danger Close and Think Tank are read by other items' rules).
const RULED = Object.entries(FILES).filter(([key]) => !['dangerClose', 'thinkTank', 'vantagePoint'].includes(key)).map(([, file]) => file);

/** foundry.utils.setProperty, for plain objects. */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const node = keys.reduce((at, key) => (at[key] ??= {}), object);
  if (last.startsWith('-=')) {
    delete node[last.slice(2)];
  } else {
    node[last] = value;
  }
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

/** A pack item's compendium uuid - the real one where a rule names it, else a stand-in. */
const SOURCES = {
  TklqajBQCS7jiwpC: 'Compendium.essence20.enigma_of_combination.Item.TklqajBQCS7jiwpC',
  j8s0vIsIEUJzAAvy: 'Compendium.essence20.decepticon_directive.Item.j8s0vIsIEUJzAAvy',
};
const sourceOfPack = doc => SOURCES[doc._id] ?? `Compendium.essence20.test.Item.${doc._id}`;

/** An actor holding the pack items `files`, with a token at x (feet) and disposition. */
export function makeActor(name, files = [], { system = {}, x = 0, disposition = 1, type = 'playerCharacter' } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: {
      level: 12, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 6 } }, skills: {},
      energon: { normal: { value: 1, max: 4 } }, essences: { smarts: { value: 2 } },
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
      return getPath(this.flags[scope], key);
    },
    async createEmbeddedDocuments(type, datas) {
      const made = datas.map(data => makeItem(actor, clone(data)));
      items.push(...made);
      rebuildIndex(actor);
      return made;
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
    items.push(makeItem(actor, { name: doc.name, type: doc.type, img: doc.img, system: clone(doc.system), flags: { core: { sourceId: sourceOfPack(doc) } } }));
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

/** Give an actor another (non-pack) item. */
export function addItem(actor, data) {
  const item = makeItem(actor, data);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

export const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);

export function scene(...actors) {
  const docs = new Map(actors.map(actor => [actor.uuid, actor]));
  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null, contents: actors, [Symbol.iterator]: () => actors[Symbol.iterator]() };
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token), controlled: [], setTargets: jest.fn() }, grid: { size: 100, measurePath: ([a, b]) => ({ distance: Math.hypot(a.x - b.x, a.y - b.y) }) }, scene: { id: 'sc', tokens: [] }, dimensions: { size: 100, distance: 5 } };
}

export const target = (...actors) => {
  global.game.user.targets = new Set(actors.map(actor => actor.token));
  global.game.user.targets.first = () => actors[0]?.token;
};

const pay = jest.fn(async () => true);
const savedGame = global.game;
const savedFromUuid = global.fromUuid;
const savedFromUuidSync = global.fromUuidSync;

beforeEach(() => {
  pay.mockClear();
  rollVsMany.mockClear();
  applyTimedCondition.mockClear();
  applyDamage.mockClear();
  explodeVehicle.mockClear();
  rolls.rows = null;
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], activeGM: null },
    actors: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}), getSpeakerActor: () => null };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), skills: { culture: 'E20.SkillCulture', science: 'E20.SkillScience', technology: 'E20.SkillTechnology' }, skillToEssence: { driving: 'speed', technology: 'smarts', culture: 'smarts', science: 'smarts' } } };
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

/** Pick the choose option whose label starts with `text`. */
const askFor = text => async (step, options) => options.findIndex(option => String(option.label).startsWith(text));

test('every part-b rule validates', () => {
  for (const file of RULED) {
    const rules = fromPack(file).system.rules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

describe('Ground Suppression and Danger Close', () => {
  const combat = { id: 'c1', started: true, round: 2, turn: 0, turns: [], combatants: { contents: [] } };

  test('Driving against the chosen Defense of everyone within 60 ft, friend and foe; a hit is -5 Toughness and Evasion this round', async () => {
    const strafer = makeActor('Strafer', FILES.groundSuppression);
    const foe = makeActor('Foe', [], { x: 30, disposition: -1 });
    const friend = makeActor('Friend', [], { x: 50 });
    const far = makeActor('Far', [], { x: 80, disposition: -1 });
    scene(strafer, foe, friend, far);
    game.combat = combat;
    rolls.rows = others => others.map(other => ({ targetUuid: other.uuid, success: other !== friend, multiplier: 1 }));
    await runUse(itemNamed(strafer, 'Ground Suppression'), pay, { ask: askFor('Evasion') });
    expect(rollVsMany).toHaveBeenCalledWith(strafer, 'driving', [foe, friend], 'evasion');
    expect(foe.flags.essence20.ruleMarks.groundSuppressed).toEqual(expect.objectContaining({ by: strafer.uuid, until: 'combatRound' }));
    expect(friend.flags.essence20.ruleMarks?.groundSuppressed).toBeUndefined();

    // Any attacker meets the marked foe's Toughness / Evasion 5 lower, this round only; other Defenses are untouched.
    const attacker = makeActor('Attacker', [], { x: 10 });
    expect((await earlyDefenseAdjust(attacker, foe, 'toughness', 10, {})).difficulty).toBe(5);
    expect((await earlyDefenseAdjust(attacker, foe, 'evasion', 15, {})).difficulty).toBe(10);
    expect((await earlyDefenseAdjust(attacker, foe, 'willpower', 11, {})).difficulty).toBe(11);
    game.combat = { ...combat, round: 3 };
    expect((await earlyDefenseAdjust(attacker, foe, 'toughness', 10, {})).difficulty).toBe(10);
  });

  test('a cancelled Defense pick rolls nothing; out of combat a hit leaves no reduction', async () => {
    const strafer = makeActor('Strafer', FILES.groundSuppression);
    const foe = makeActor('Foe', [], { x: 30, disposition: -1 });
    scene(strafer, foe);
    await runUse(itemNamed(strafer, 'Ground Suppression'), pay, { ask: async () => null });
    expect(rollVsMany).not.toHaveBeenCalled();
    await runUse(itemNamed(strafer, 'Ground Suppression'), pay, { ask: askFor('Toughness') });
    expect(rollVsMany).toHaveBeenCalledWith(strafer, 'driving', [foe], 'toughness');
    expect((await earlyDefenseAdjust(strafer, foe, 'toughness', 10, {})).difficulty).toBe(10);
  });

  test('Danger Close: the first targeted tokens, up to Smarts, are left out of the area', async () => {
    const strafer = makeActor('Strafer', [FILES.groundSuppression, FILES.dangerClose], { system: { essences: { smarts: { value: 1 } } } });
    const spared = makeActor('Spared', [], { x: 10 });
    const second = makeActor('Second', [], { x: 20 });
    const foe = makeActor('Foe', [], { x: 30, disposition: -1 });
    scene(strafer, spared, second, foe);
    target(spared, second);
    await runUse(itemNamed(strafer, 'Ground Suppression'), pay, { ask: askFor('Toughness') });
    expect(rollVsMany).toHaveBeenCalledWith(strafer, 'driving', [second, foe], 'toughness');

    // Without Danger Close, targeting spares nobody.
    const plain = makeActor('Plain', FILES.groundSuppression);
    scene(plain, spared, second, foe);
    target(spared, second);
    await runUse(itemNamed(plain, 'Ground Suppression'), pay, { ask: askFor('Toughness') });
    expect(rollVsMany).toHaveBeenLastCalledWith(plain, 'driving', [spared, second, foe], 'toughness');
  });
});

describe('Tech Specs and Technical Mastery', () => {
  const combat = { id: 'c1', started: true, round: 2, turn: 0, turns: [], combatants: { contents: [] } };
  const attack = { isAttack: true, item: { type: 'weaponEffect', system: { classification: { style: 'melee' } } } };

  test('needs a target; Technology against its highest Defense, a hit tells its Defenses and Hang-Ups', async () => {
    const officer = makeActor('Officer', FILES.techSpecs);
    const tank = makeActor('Tank', [], { x: 30, disposition: -1, type: 'vehicle' });
    addItem(tank, { name: 'Leaky Seals', type: 'hangUp' });
    scene(officer, tank);
    const item = itemNamed(officer, 'Tech Specs');
    expect(await runUse(item, pay)).toContain('NeedsTarget');
    expect(rollVsMany).not.toHaveBeenCalled();

    target(tank);
    game.combat = combat;
    const card = await runUse(item, pay);
    expect(rollVsMany).toHaveBeenCalledWith(officer, 'technology', [tank], 'evasion');
    expect(card).toContain("Tank&#39;s Defenses: Toughness 10, Evasion 15, Willpower 11, Cleverness 12. Hang-Ups: Leaky Seals.");
    expect(tank.flags.essence20.ruleMarks.techSpecs).toEqual(expect.objectContaining({ by: officer.uuid, until: 'combatThroughNextRound' }));
  });

  test('the marked target: ↑1 to attacks by the officer and its side, this round and the next; Edge too with Technical Mastery', async () => {
    const officer = makeActor('Officer', [FILES.techSpecs, FILES.technicalMastery]);
    const plainOfficer = makeActor('Plain', FILES.techSpecs);
    const ally = makeActor('Ally', [], { x: 10 });
    const enemy = makeActor('Enemy', [], { x: 10, disposition: -1 });
    const tank = makeActor('Tank', [], { x: 30, disposition: -1 });
    const other = makeActor('Other', [], { x: 40, disposition: -1 });
    scene(officer, plainOfficer, ally, enemy, tank, other);
    game.combat = combat;
    target(tank);
    await runUse(itemNamed(officer, 'Tech Specs'), pay);

    const sources = roller => markedTargetSources(roller, tank, attack).sources;
    expect(sources(officer)).toEqual([
      expect.objectContaining({ label: 'Tech Specs', shiftUp: 1, edge: false }),
      expect.objectContaining({ label: 'Technical Mastery (with Tech Specs)', edge: true }),
    ]);
    expect(sources(ally).map(source => source.label)).toEqual(['Tech Specs', 'Technical Mastery (with Tech Specs)']);
    expect(sources(enemy)).toEqual([]);
    expect(markedTargetSources(ally, tank, { isAttack: false, rolledSkill: 'persuasion' }).sources).toEqual([]);
    game.combat = { ...combat, round: 3 };
    expect(sources(ally).length).toBe(2);
    game.combat = { ...combat, round: 4 };
    expect(sources(ally)).toEqual([]);

    // A Tech Officer without Technical Mastery gives the ↑1 alone.
    game.combat = combat;
    target(other);
    await runUse(itemNamed(plainOfficer, 'Tech Specs'), pay);
    expect(markedTargetSources(ally, other, attack).sources.map(source => source.label)).toEqual(['Tech Specs']);
  });

  test('out of combat the target is told about but not marked for the bonus', async () => {
    const officer = makeActor('Officer', FILES.techSpecs);
    const tank = makeActor('Tank', [], { x: 30, disposition: -1 });
    scene(officer, tank);
    target(tank);
    await runUse(itemNamed(officer, 'Tech Specs'), pay);
    expect(markedTargetSources(officer, tank, attack).sources).toEqual([]);
  });
});


describe('Data Bridge, Think Tank and Misery Loves Company', () => {
  const combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [], combatants: { contents: [] } };
  const SKILLS = {
    culture: { shift: 'd6', specializations: { arcane: { name: 'Arcane Lore' } } },
    science: { shift: 'd4', specializations: { bio: { name: 'Biology' } } },
  };

  beforeEach(() => {
    grants.chooseSelect.mockReset();
  });

  test('only with an ally holding a Specialization; the borrowed one is Specialized on the next roll of its Skill, for the user and every ally', async () => {
    const lonely = makeActor('Lonely', FILES.dataBridge);
    scene(lonely);
    const alone = itemNamed(lonely, 'Data Bridge');
    expect(useAvailable(alone, alone.system.rules[0], 0)).toBe(false);

    const analyst = makeActor('Analyst', FILES.dataBridge);
    const scholar = makeActor('Scholar', [], { x: 40, system: { skills: SKILLS } });
    const friend = makeActor('Friend', [], { x: 400 });
    const foe = makeActor('Foe', [], { x: 20, disposition: -1, system: { skills: SKILLS } });
    scene(analyst, scholar, friend, foe);
    game.combats = { get: id => (id == combat.id ? combat : null) };
    game.combat = combat;
    const bridge = itemNamed(analyst, 'Data Bridge');
    expect(useAvailable(bridge, bridge.system.rules[0], 0)).toBe(true);
    grants.chooseSelect.mockImplementation(async (title, prompt, options) => {
      expect(options.map(option => option.label)).toEqual(['Arcane Lore (E20.SkillCulture) - Scholar', 'Biology (E20.SkillScience) - Scholar']);
      return 'science';
    });
    await runUse(bridge, pay);
    for (const actor of [analyst, scholar, friend]) {
      expect(bankedEntries(actor)).toEqual([expect.objectContaining({ key: 'dataBridge', specialize: true, when: ['skill:in:science'], until: 'combat' })]);
      expect(bankedSpecializes(actor, null, { rolledSkill: 'science' })).toBe(true);
      expect(bankedSpecializes(actor, null, { rolledSkill: 'culture' })).toBe(false);
    }

    expect(bankedEntries(foe)).toEqual([]);
    expect(hasBankKey(scholar, 'dataBridge')).toBe(true);
    expect(bankKeySideCount(analyst, 'dataBridge')).toBe(3);
    // Once per turn.
    expect(useAvailable(bridge, bridge.system.rules[0], 0)).toBe(false);
    // Banked in a combat, it goes with that combat.
    game.combats = { get: () => null };
    game.combat = null;
    expect(hasBankKey(analyst, 'dataBridge')).toBe(false);
  });

  test('a cancelled pick borrows nothing', async () => {
    const analyst = makeActor('Analyst', FILES.dataBridge);
    const scholar = makeActor('Scholar', [], { x: 40, system: { skills: SKILLS } });
    scene(analyst, scholar);
    grants.chooseSelect.mockResolvedValue(null);
    await runUse(itemNamed(analyst, 'Data Bridge'), pay);
    expect(bankedEntries(analyst)).toEqual([]);
    expect(bankedEntries(scholar)).toEqual([]);
  });

  test('Think Tank: pick an ally and borrow every Specialization it has', async () => {
    const analyst = makeActor('Analyst', [FILES.dataBridge, FILES.thinkTank]);
    const scholar = makeActor('Scholar', [], { x: 40, system: { skills: SKILLS } });
    scene(analyst, scholar);
    grants.chooseSelect.mockImplementation(async (title, prompt, options) => {
      expect(options).toEqual([{ value: 'culture|science', label: 'Scholar' }]);
      return 'culture|science';
    });
    await runUse(itemNamed(analyst, 'Data Bridge'), pay);
    expect(bankedSpecializes(analyst, null, { rolledSkill: 'culture' })).toBe(true);
    expect(bankedSpecializes(scholar, null, { rolledSkill: 'science' })).toBe(true);
    expect(bankedSpecializes(scholar, null, { rolledSkill: 'technology' })).toBe(false);
  });

  test('Misery Loves Company: 1 Energon to pass one of the four Conditions from an ally to someone on the Data Bridge', async () => {
    const analyst = makeActor('Analyst', [FILES.dataBridge, FILES.misery], { system: { energon: { normal: { value: 2, max: 4 } } } });
    const scared = makeActor('Scared', [], { x: 10 });
    const bridged = makeActor('Bridged', [], { x: 20 });
    scene(analyst, scared, bridged);
    const item = itemNamed(analyst, 'Misery Loves Company');
    const [use] = item.system.rules;
    scared.statuses.add('frightened');
    expect(useAvailable(item, use, 0)).toBe(false);
    bridged.flags.essence20.ruleBank = [{ id: 'b', key: 'dataBridge', uses: 1, when: [] }];
    expect(useAvailable(item, use, 0)).toBe(true);
    scared.statuses.delete('frightened');
    scared.statuses.add('prone');
    expect(useAvailable(item, use, 0)).toBe(false);
    scared.statuses.add('frightened');

    globalThis.foundry.applications.api.DialogV2.wait = jest.fn(async ({ content }) => {
      expect(content).toContain('Scared - E20.StatusFrightened');
      expect(content).toContain('<option value="0">Bridged</option>');
      return { pair: '0', to: '0' };
    });
    await runUse(item, pay);
    expect(scared.statuses.has('frightened')).toBe(false);
    expect(bridged.statuses.has('frightened')).toBe(true);
    expect(analyst.system.energon.normal.value).toBe(1);

    // The same creature at both ends changes nothing and costs nothing.
    bridged.statuses.add('stunned');
    globalThis.foundry.applications.api.DialogV2.wait = jest.fn(async () => ({ pair: '1', to: '0' }));
    await runUse(item, pay);
    expect(bridged.statuses.has('stunned')).toBe(true);
    expect(analyst.system.energon.normal.value).toBe(1);
    analyst.system.energon.normal.value = 0;
    expect(useAvailable(item, use, 0)).toBe(false);
  });
});

describe('Eye For Appraisal and Vantage Point', () => {
  const ranged = { isAttack: true, isMelee: false, item: { type: 'weaponEffect', system: { classification: { style: 'projectile' } } } };

  afterEach(() => {
    jest.restoreAllMocks();
    pickCanvasPoint.mockReset();
  });

  test('once per scene, marks the target for the next 2d2 ranged attacks by the Raider, one used up per attack', async () => {
    const raider = makeActor('Raider', FILES.eyeForAppraisal);
    const other = makeActor('Other', FILES.eyeForAppraisal, { x: 5 });
    const foe = makeActor('Foe', [], { x: 50, disposition: -1 });
    scene(raider, other, foe);
    const item = itemNamed(raider, 'Eye For Appraisal');
    expect(await runUse(item, pay)).toContain('NeedsTarget');
    target(foe);
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    await runUse(item, pay);
    expect(foe.flags.essence20.ruleMarks.appraisal).toEqual(expect.objectContaining({ by: raider.uuid, count: 4 }));
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    expect(pickCanvasPoint).not.toHaveBeenCalled();

    const roll = ruleRollSources(raider, foe, ranged);
    expect(roll.sources).toEqual([expect.objectContaining({ label: 'Eye for Appraisal', shiftUp: 1 })]);
    expect(roll.consumes).toContainEqual({ ext: 'rulesMarkOne', actorUuid: foe.uuid, key: 'appraisal' });
    expect(ruleRollSources(raider, foe, { ...ranged, isMelee: true }).sources).toEqual([]);
    expect(ruleRollSources(other, foe, ranged).sources).toEqual([]);

    for (let left = 3; left >= 0; left--) {
      await consumeOneMark({ actorUuid: foe.uuid, key: 'appraisal' });
      expect(foe.flags.essence20.ruleMarks.appraisal?.count).toBe(left || undefined);
    }

    expect(ruleRollSources(raider, foe, ranged).sources).toEqual([]);
  });

  test('with Vantage Point, the spot picked on the map is the appraised area; cancelling it still marks the target', async () => {
    const raider = makeActor('Raider', [FILES.eyeForAppraisal, FILES.vantagePoint]);
    const foe = makeActor('Foe', [], { x: 50, disposition: -1 });
    scene(raider, foe);
    canvas.dimensions.distancePixels = 20;
    target(foe);
    pickCanvasPoint.mockResolvedValue({ x: 150, y: 100 });
    await runUse(itemNamed(raider, 'Eye For Appraisal'), pay);
    expect(foe.flags.essence20.ruleMarks.appraisal.text).toBe('150,100,sc');
    expect(inMarkedArea(raider, foe, { center: { x: 0, y: 0 } })).toBe(true);
    expect(inMarkedArea(raider, foe, { center: { x: 0, y: 301 } })).toBe(false);

    const second = makeActor('Second', [FILES.eyeForAppraisal, FILES.vantagePoint]);
    scene(second, foe);
    target(foe);
    pickCanvasPoint.mockResolvedValue(null);
    await runUse(itemNamed(second, 'Eye For Appraisal'), pay);
    expect(foe.flags.essence20.ruleMarks.appraisal).toEqual(expect.objectContaining({ by: second.uuid, text: ',,' }));
    expect(inMarkedArea(second, foe, { center: { x: 150, y: 100 } })).toBe(false);
  });
});

describe('Powerful Suggestion', () => {
  async function suggest(counselor, victim, skill, fate) {
    target(victim);
    grants.chooseSelect.mockResolvedValueOnce(skill);
    return runUse(itemNamed(counselor, 'Powerful Suggestion'), pay, { ask: askFor(fate) });
  }

  beforeEach(() => {
    grants.chooseSelect.mockReset();
    global.CONFIG.E20.skills = { athletics: 'E20.SkillAthletics', persuasion: 'E20.SkillPersuasion' };
  });

  test('needs a target; "fail": ↓3 on that Skill until a Critical Success with it proves it wrong', async () => {
    const counselor = makeActor('Counselor', FILES.powerfulSuggestion);
    const victim = makeActor('Victim', [], { x: 10, disposition: -1 });
    scene(counselor, victim);
    expect(await runUse(itemNamed(counselor, 'Powerful Suggestion'), pay)).toContain('NeedsTarget');
    await suggest(counselor, victim, 'athletics', 'Fail');
    expect(grants.chooseSelect.mock.calls[0][2]).toEqual([{ value: 'athletics', label: 'E20.SkillAthletics' }, { value: 'persuasion', label: 'E20.SkillPersuasion' }]);
    expect(victim.flags.essence20.ruleMarks.suggestFail).toEqual(expect.objectContaining({ by: counselor.uuid, text: 'athletics', until: 'combat' }));
    expect(ruleRollSources(victim, null, { rolledSkill: 'athletics' }).sources).toEqual([expect.objectContaining({ shiftDown: 3 })]);
    expect(ruleRollSources(victim, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);

    // A plain success leaves it; a x2 row uses it up.
    let outcomes = markedRowOutcomes(victim, { rolledSkill: 'athletics' });
    expect(outcomes.adjust(1)).toBe(1);
    await outcomes.spend();
    expect(victim.flags.essence20.ruleMarks.suggestFail).toBeDefined();
    outcomes = markedRowOutcomes(victim, { rolledSkill: 'athletics' });
    expect(outcomes.adjust(2)).toBe(2);
    await outcomes.spend();
    expect(victim.flags.essence20.ruleMarks.suggestFail).toBeUndefined();
  });

  test('"excel": the next plain success with that Skill becomes a Critical Success, once; a new suggestion replaces the old', async () => {
    const counselor = makeActor('Counselor', FILES.powerfulSuggestion);
    const victim = makeActor('Victim', [], { x: 10 });
    scene(counselor, victim);
    await suggest(counselor, victim, 'persuasion', 'Fail');
    await suggest(counselor, victim, 'persuasion', 'Excel');
    expect(victim.flags.essence20.ruleMarks.suggestFail).toBeUndefined();
    expect(markedRowOutcomes(victim, { rolledSkill: 'athletics' }).adjust(1)).toBe(1);
    const outcomes = markedRowOutcomes(victim, { rolledSkill: 'persuasion' });
    expect(outcomes.adjust(0)).toBe(0);
    expect(outcomes.adjust(1)).toBe(2);
    await outcomes.spend();
    expect(victim.flags.essence20.ruleMarks.suggestExcel).toBeUndefined();
    expect(markedRowOutcomes(victim, { rolledSkill: 'persuasion' }).adjust(1)).toBe(1);
  });
});

describe('Rig Upgrade and Rally Guardians Features: what is due by level, picked onto the companion', () => {
  const ENTRIES = [
    { uuid: 'Compendium.x.Item.dronea', name: 'Drone Arm', type: 'upgrade', system: { type: 'drone', availability: 'standard' } },
    { uuid: 'Compendium.x.Item.armorz', name: 'Armor Plate', type: 'upgrade', system: { type: 'armor', availability: 'standard' } },
    { uuid: 'Compendium.x.Item.combin', name: 'Combiner', type: 'feature', system: {} },
    { uuid: 'Compendium.x.Item.megawp', name: 'Zord Mega-Weapon System', type: 'feature', system: {} },
    { uuid: 'Compendium.x.Item.bodyfx', name: 'Heavy Chassis', type: 'feature', system: {} },
  ];

  beforeEach(() => {
    grants.findItems.mockReset();
    grants.pickOne.mockReset();
    grants.grantCopy.mockClear();
    grants.findItems.mockImplementation(async ({ type, availabilities, matches }) => ENTRIES.filter(entry => entry.type == type
      && (!availabilities || availabilities.includes(entry.system.availability)) && (!matches || matches(entry))));
    grants.pickOne.mockImplementation(async (title, rows) => rows[0]?.uuid ?? null);
  });

  function companionFor(owner, name, flags) {
    const companion = makeActor(name, [], { type: flags.personalVehicle ? 'vehicle' : 'zord' });
    companion.flags.essence20 = { companionOf: owner.uuid, ...flags };
    return companion;
  }

  test('Rig Upgrade: a Standard Drone Upgrade at 6th, Standard + Limited at 10th, Standard + Limited + Restricted at 17th', async () => {
    const rigger = makeActor('Rigger', FILES.rigUpgrade, { system: { level: 5 } });
    scene(rigger);
    const item = itemNamed(rigger, 'Rig Upgrade');
    await runUse(item, pay);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.RigNone');
    const rig = companionFor(rigger, 'Rig', { personalVehicle: 'ridingRig' });
    scene(rigger, rig);
    await runUse(item, pay);
    expect(ui.notifications.info).toHaveBeenCalledWith('E20.GrantAlready');
    expect(grants.findItems).not.toHaveBeenCalled();

    const tiers = [];
    grants.findItems.mockImplementation(async ({ availabilities, matches }) => {
      tiers.push(availabilities[0]);
      expect(matches(ENTRIES[0])).toBe(true);
      expect(matches(ENTRIES[1])).toBe(false);
      return [ENTRIES[0]];
    });
    for (const level of [6, 10, 17]) {
      rigger.system.level = level;
      for (let i = 0; i < 4; i++) {
        await runUse(item, pay);
      }
    }

    expect(tiers).toEqual(['standard', 'standard', 'limited', 'standard', 'limited', 'restricted']);
    expect(grants.grantCopy).toHaveBeenCalledTimes(6);
    expect(grants.grantCopy.mock.calls.every(([actor]) => actor === rig)).toBe(true);
    expect(item.flags.essence20.rigUpgrades).toBe(6);

    // A cancelled pick counts nothing.
    const fresh = makeActor('Fresh', FILES.rigUpgrade, { system: { level: 6 } });
    const freshRig = companionFor(fresh, 'Fresh Rig', { personalVehicle: 'ridingRig' });
    scene(fresh, freshRig);
    grants.pickOne.mockResolvedValue(null);
    await runUse(itemNamed(fresh, 'Rig Upgrade'), pay);
    expect(itemNamed(fresh, 'Rig Upgrade').flags.essence20?.rigUpgrades).toBeUndefined();
  });

  test('Rally Guardians Features: one Zord Feature at 6, 10, 14 and 17, never Combiner or the Mega-Weapon System', async () => {
    const guardian = makeActor('Guardian', FILES.rallyGuardiansFeatures, { system: { level: 10 } });
    scene(guardian);
    const item = itemNamed(guardian, 'Rally Guardians Features');
    await runUse(item, pay);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.GuardianCompanyNone');
    const company = companionFor(guardian, 'Company', { guardians: true });
    scene(guardian, company);
    grants.pickOne.mockImplementation(async (title, rows) => {
      expect(rows.map(row => row.name)).toEqual(['Heavy Chassis']);
      return rows[0].uuid;
    });
    await runUse(item, pay);
    await runUse(item, pay);
    await runUse(item, pay);
    expect(grants.grantCopy).toHaveBeenCalledTimes(2);
    expect(grants.grantCopy.mock.calls[0][0]).toBe(company);
    expect(ui.notifications.info).toHaveBeenCalledWith('E20.GrantAlready');
    guardian.system.level = 17;
    await runUse(item, pay);
    await runUse(item, pay);
    await runUse(item, pay);
    expect(item.flags.essence20.guardianFeatures).toBe(4);
  });
});

describe('Self-Destruct', () => {
  const combat = { id: 'c1', started: true, round: 2, turn: 3, turns: [], combatants: { contents: [] } };

  test('armed (a Free action) on a vehicle, it goes off at the first turn start a round later at or past that turn', async () => {
    const car = makeActor('Car', FILES.selfDestruct, { type: 'vehicle' });
    const pc = makeActor('Driver', FILES.selfDestruct);
    scene(car, pc);
    game.user.isActiveGM = true;
    game.combat = combat;
    const item = itemNamed(car, 'Self-Destruct');
    expect(useAvailable(itemNamed(pc, 'Self-Destruct'), item.system.rules[0], 0)).toBe(false);
    const card = await runUse(item, pay);
    expect(pay).toHaveBeenCalledWith('free');
    expect(card).toContain('Self-Destruct is armed');
    // Armed again: still one charge.
    await runUse(item, pay);
    expect(car.flags.essence20.ruleNextRound).toHaveLength(1);

    for (const [round, turn] of [[2, 4], [3, 0], [3, 2]]) {
      await runScheduledNextRound({ ...combat, round, turn });
      expect(explodeVehicle).not.toHaveBeenCalled();
    }

    await runScheduledNextRound({ ...combat, round: 3, turn: 3 });
    expect(car.statuses.has('defeated')).toBe(true);
    expect(explodeVehicle).toHaveBeenCalledWith(car);
    expect(car.flags.essence20.ruleNextRound).toEqual([]);
    await runScheduledNextRound({ ...combat, round: 5, turn: 0 });
    expect(explodeVehicle).toHaveBeenCalledTimes(1);
  });

  test('two rounds on it goes off at any turn; armed out of combat it never does; only the active GM runs it', async () => {
    const car = makeActor('Car', FILES.selfDestruct, { type: 'vehicle' });
    scene(car);
    game.combat = combat;
    await runUse(itemNamed(car, 'Self-Destruct'), pay);
    await runScheduledNextRound({ ...combat, round: 4, turn: 0 });
    expect(explodeVehicle).not.toHaveBeenCalled();
    game.user.isActiveGM = true;
    await runScheduledNextRound({ ...combat, round: 4, turn: 0 });
    expect(explodeVehicle).toHaveBeenCalledTimes(1);

    const van = makeActor('Van', FILES.selfDestruct, { type: 'vehicle' });
    scene(van);
    game.user.isActiveGM = true;
    game.combat = null;
    await runUse(itemNamed(van, 'Self-Destruct'), pay);
    await runScheduledNextRound({ ...combat, round: 9, turn: 0 });
    expect(explodeVehicle).toHaveBeenCalledTimes(1);
  });
});

describe('Additional Attack Type', () => {
  const LANG = {
    'E20.ZordFeatureAttackMelee': 'Melee Weapon Attack', 'E20.ZordFeatureAttackRanged': 'Ranged Weapon Attack',
    'E20.ZordFeatureAttackEffectName': '{name} Effect', 'E20.ZordFeatureAttackTypeAdded': 'Added a new {name} to this Zord.',
  };

  beforeEach(() => {
    grants.chooseSelect.mockReset();
    game.i18n.localize = key => LANG[key] ?? key;
    game.i18n.format = (key, data) => Object.entries(data).reduce((text, [k, v]) => text.replace(`{${k}}`, v), LANG[key] ?? key);
    global.CONFIG.E20.damageTypes = { energy: 'E20.DamageEnergy', fire: 'E20.DamageFire' };
    global.CONFIG.E20.weaponTraits = { energy: 'E20.WeaponTraitEnergy' };
  });

  test('a ranged baseline attack of the chosen damage type, kept on the Zord without the Feature', async () => {
    const zord = makeActor('Zord', FILES.additionalAttackType, { type: 'zord' });
    scene(zord);
    const feature = itemNamed(zord, 'Additional Attack Type');
    grants.chooseSelect.mockResolvedValue('energy');
    await fireItemAdded(zord, feature, { ask: askFor('Ranged') });
    const weapon = itemNamed(zord, 'Ranged Weapon Attack');
    expect(weapon).toEqual(expect.objectContaining({ type: 'weapon', system: { traits: ['energy'] } }));
    expect(weapon.flags.essence20?.grantedBy).toBeUndefined();
    const effect = itemNamed(zord, 'Ranged Weapon Attack Effect');
    expect(effect.system).toEqual({
      classification: { skill: 'targeting', style: 'projectile' }, damageType: 'energy', damageValue: 2, defenseType: 'toughness',
      range: { min: null, reachMultiplier: 1, long: 120, value: 50 },
    });
    expect(effect.flags.essence20).toEqual(expect.objectContaining({ parentId: weapon.id, grantedBy: null }));
    expect(ui.notifications.info).toHaveBeenCalledWith('Added a new Ranged Weapon Attack to this Zord.');
    expect(feature.delete).not.toHaveBeenCalled();
  });

  test('melee: Might, Reach and no trait for a damage type that is not one; a cancelled choice takes the Feature off', async () => {
    const zord = makeActor('Zord', FILES.additionalAttackType, { type: 'zord' });
    scene(zord);
    grants.chooseSelect.mockResolvedValue('fire');
    await fireItemAdded(zord, itemNamed(zord, 'Additional Attack Type'), { ask: askFor('Melee') });
    expect(itemNamed(zord, 'Melee Weapon Attack').system.traits).toEqual([]);
    expect(itemNamed(zord, 'Melee Weapon Attack Effect').system).toEqual(expect.objectContaining({
      classification: { skill: 'might', style: 'melee' }, damageType: 'fire', range: { min: null, reachMultiplier: 1, long: null, value: null },
    }));

    const other = makeActor('Other', FILES.additionalAttackType, { type: 'zord' });
    const feature = itemNamed(other, 'Additional Attack Type');
    grants.chooseSelect.mockResolvedValue(null);
    await fireItemAdded(other, feature, { ask: askFor('Melee') });
    expect(feature.delete).toHaveBeenCalled();
    expect(other.items.contents).toHaveLength(1);
  });
});

describe('Metallic Armor Power Up!', () => {
  const ACTIVE = 'metallicArmorActive';
  const effect = { type: 'weaponEffect', system: { classification: { style: 'projectile' } } };

  function ranger() {
    const actor = makeActor('Ranger', FILES.metallicArmor, { system: { health: { value: 10, max: 10, bonus: 0 }, powers: { personal: { value: 2, max: 6 } } } });
    const power = itemNamed(actor, 'Metallic Armor Power Up');
    power.system.canActivate = true;
    return { actor, power };
  }

  test('its Use activates the Power the sheet way while off, and ends it while on', async () => {
    const { actor, power } = ranger();
    scene(actor);
    const [use] = power.system.rules;
    expect(useAvailable(power, use, 0)).toBe(true);
    expect(await runUse(power, pay)).toBeNull();
    expect(powerCost).toHaveBeenCalledWith(actor, power);
    power.system.canActivate = false;
    expect(useAvailable(power, use, 0)).toBe(false);

    await fireTriggers(actor, 'powerUsed', { roll: { item: power } });
    expect(actor.flags.essence20[ACTIVE]).toBe(true);
    expect(actor.system.health.bonus).toBe(3);
    // Activated again: nothing more.
    await fireTriggers(actor, 'powerUsed', { roll: { item: power } });
    expect(actor.system.health.bonus).toBe(3);
    expect(useAvailable(power, use, 0)).toBe(true);
    expect(await runUse(power, pay)).toContain('Metallic Armor ends.');
    expect(actor.flags.essence20[ACTIVE]).toBe(false);
    expect(actor.system.health.bonus).toBe(0);
  });

  test('1 Personal Power at each turn start, lapsing (the 3 temporary Health gone) when it can\'t be paid; Multiple Targets meanwhile', async () => {
    const { actor, power } = ranger();
    scene(actor);
    expect(ruleMultipleTargets(actor, effect)).toBe(false);
    await fireTriggers(actor, 'powerUsed', { roll: { item: power } });
    expect(ruleMultipleTargets(actor, effect)).toBe(true);
    await fireTriggers(actor, 'turnStart');
    await fireTriggers(actor, 'turnStart');
    expect(actor.system.powers.personal.value).toBe(0);
    expect(actor.flags.essence20[ACTIVE]).toBe(true);
    actor.system.health.bonus = 2;
    await fireTriggers(actor, 'turnStart');
    expect(actor.flags.essence20[ACTIVE]).toBe(false);
    expect(actor.system.health.bonus).toBe(0);
    expect(actor.system.powers.personal.value).toBe(0);
    expect(ruleMultipleTargets(actor, effect)).toBe(false);
  });

  test('-1 damage from minions; a Critical Success by a non-minion or being Defeated ends it', async () => {
    const { actor, power } = ranger();
    const minion = makeActor('Putty Patroller', [], { type: 'npc', disposition: -1 });
    const boss = makeActor('Goldar', [], { type: 'npc', disposition: -1 });
    scene(actor, minion, boss);
    const notes = [];
    const tools = { damageBonusNote: (result, amount, label) => notes.push([amount, label]) };
    hitRiderOnAttack(minion, actor, { damageValue: 3 }, {}, tools);
    expect(notes).toEqual([]);
    await fireTriggers(actor, 'powerUsed', { roll: { item: power } });
    hitRiderOnAttack(minion, actor, { damageValue: 3 }, {}, tools);
    hitRiderOnAttack(boss, actor, { damageValue: 3 }, {}, tools);
    expect(notes).toEqual([[-1, 'Metallic Armor']]);

    const attack = { item: { type: 'weaponEffect', system: {} }, isAttack: true };
    await fireTriggers(actor, 'targeted', { roll: attack, outcome: 'crit', targets: [minion] });
    await fireTriggers(actor, 'targeted', { roll: attack, outcome: 'double', targets: [boss] });
    expect(actor.flags.essence20[ACTIVE]).toBe(true);
    await fireTriggers(actor, 'targeted', { roll: attack, outcome: 'crit', targets: [boss] });
    expect(actor.flags.essence20[ACTIVE]).toBe(false);

    await fireTriggers(actor, 'powerUsed', { roll: { item: power } });
    await fireTriggers(actor, 'takesDamage', { damage: { amount: 2, damageType: 'blunt' }, roll: { damageType: 'blunt', damageAmount: 2 } });
    expect(actor.flags.essence20[ACTIVE]).toBe(true);
    actor.system.health.value = 0;
    await fireTriggers(actor, 'takesDamage', { damage: { amount: 2, damageType: 'blunt' }, roll: { damageType: 'blunt', damageAmount: 2 } });
    expect(actor.flags.essence20[ACTIVE]).toBe(false);
  });
});

describe('Dominate (nanomites)', () => {
  const posted = () => ChatMessage.create.mock.calls.map(([data]) => data);
  const cardOf = () => posted().filter(data => data.flags?.essence20?.ruleButtons).pop();

  function setup() {
    const user = makeActor('Infiltrator', FILES.dominate);
    const victim = makeActor('Victim', [], { x: 15, disposition: -1, system: { defenses: { evasion: { total: 12 }, willpower: { total: 9 }, cleverness: { total: 14 } } } });
    const power = itemNamed(user, 'Dominate');
    power.system.usesSpent = 1;
    scene(user, victim);
    return { user, victim, power };
  }

  const use = async (user, power) => fireTriggers(user, 'powerUsed', { roll: { item: power }, targets: [...(game.user.targets ?? [])].map(token => token.actor) });

  test('no target, or one beyond 20 ft: a warning and the daily use back; otherwise Targeting against Evasion', async () => {
    const { user, victim, power } = setup();
    await use(user, power);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.R2DominateNeedsTarget');
    expect(power.system.usesSpent).toBe(0);
    power.system.usesSpent = 1;
    victim.token.center.x = 30;
    target(victim);
    await use(user, power);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.R2DominateTooFar');
    expect(power.system.usesSpent).toBe(0);
    power.system.usesSpent = 1;

    victim.token.center.x = 15;
    grants.rollTest.mockResolvedValueOnce({ success: false });
    await use(user, power);
    expect(grants.rollTest).toHaveBeenLastCalledWith(user, 'targeting', 12, expect.anything());
    expect(power.system.usesSpent).toBe(1);
    expect(victim.flags.essence20.ruleMarks?.[`dominated--${user.id}`]).toBeUndefined();

    grants.rollTest.mockResolvedValueOnce({ success: true });
    await use(user, power);
    expect(victim.flags.essence20.ruleMarks[`dominated--${user.id}`]).toEqual(expect.objectContaining({ by: user.uuid, count: 0 }));
    expect(cardOf().content).toContain("Infiltrator&#39;s nanomites infect Victim.");
    expect(cardOf().flags.essence20.ruleButtons.buttons.map(button => button.label)).toEqual(['Command', 'Recall nanomites']);

    // Used again while the victim is held: the use comes back and the command card is posted.
    await use(user, power);
    expect(power.system.usesSpent).toBe(0);
    expect(cardOf().content).toContain('nanomites are in Victim');
  });

  test('Command: Persuasion with Edge against the chosen Defense, a cumulative ↓1 per command; Recall: 1 damage each', async () => {
    const { user, victim, power } = setup();
    target(victim);
    grants.rollTest.mockResolvedValueOnce({ success: true });
    await use(user, power);
    const card = cardOf();
    game.user.targets = new Set();
    const asks = [askFor('Cleverness'), askFor('Be Mesmerized')];
    const press = async (index, ask) => {
      const ctxAsk = ask;
      globalThis.foundry.applications.api.DialogV2.wait = jest.fn(async ({ buttons }) => {
        const pick = await ctxAsk(null, buttons.map(button => ({ label: button.label })));
        return buttons[pick]?.action ?? null;
      });
      return pressCardButton(card, index);
    };

    grants.rollTest.mockResolvedValueOnce({ success: true });
    let step = 0;
    await press(0, async (s, options) => asks[step++](s, options));
    expect(grants.rollTest).toHaveBeenLastCalledWith(user, 'persuasion', 14, expect.objectContaining({ edge: true, shiftDown: 0 }));
    expect(victim.statuses.has('mesmerized')).toBe(true);
    expect(spend).toHaveBeenCalledWith(user, 'standard', expect.anything());
    expect(victim.flags.essence20.ruleMarks[`dominated--${user.id}`].count).toBe(1);

    grants.rollTest.mockResolvedValueOnce({ success: false });
    await press(0, askFor('Willpower'));
    expect(grants.rollTest).toHaveBeenLastCalledWith(user, 'persuasion', 9, expect.objectContaining({ edge: true, shiftDown: 1 }));
    expect(victim.flags.essence20.ruleMarks[`dominated--${user.id}`].count).toBe(2);

    // Beyond 60 ft: refused.
    victim.token.center.x = 70;
    const calls = grants.rollTest.mock.calls.length;
    await press(0, askFor('Willpower'));
    expect(grants.rollTest.mock.calls.length).toBe(calls);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.R2DominateTooFar');

    await press(1, askFor('x'));
    expect(victim.flags.essence20.ruleMarks?.[`dominated--${user.id}`]).toBeUndefined();
    expect(applyDamage).toHaveBeenCalledWith(user, 1, 'special');
    expect(posted().some(data => String(data.content).includes(victim.uuid))).toBe(true);
  });
});

describe('In The Right Hands', () => {
  const defenses = () => ({ toughness: { total: 10 }, evasion: { total: 12 }, willpower: { total: 11 }, cleverness: { total: 9 } });

  async function wield(bot, kind, wielder = null) {
    grants.chooseSelect.mockImplementation(async (title, prompt, options) => (options.some(option => option.value == kind) ? kind
      : (options.find(option => !wielder || option.label == wielder) ?? options[0])?.value ?? null));
    return runUse(itemNamed(bot, 'In The Right Hands'), pay);
  }

  beforeEach(() => {
    grants.chooseSelect.mockReset();
  });

  test('Body Armor Segment: +2 Toughness and Evasion to the wearer and the Cybertronian while in Alt Mode, and ↑1 Brawn to the wearer', async () => {
    const bot = makeActor('Bot', FILES.inTheRightHands, { system: { isTransformed: true, defenses: defenses() } });
    const wearer = makeActor('Wearer', [], { x: 5, system: { defenses: defenses() } });
    scene(bot, wearer);
    await wield(bot, 'bodyArmor');
    expect(wearer.flags.essence20.ruleMarks.rightHands).toEqual(expect.objectContaining({ by: bot.uuid }));
    ruleDerived(wearer);
    ruleDerived(bot);
    expect([wearer.system.defenses.toughness.total, wearer.system.defenses.evasion.total, wearer.system.defenses.willpower.total]).toEqual([12, 14, 11]);
    expect([bot.system.defenses.toughness.total, bot.system.defenses.evasion.total]).toEqual([12, 14]);
    expect(ruleRollSources(wearer, null, { rolledSkill: 'brawn' }).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(ruleRollSources(wearer, null, { rolledSkill: 'might' }).sources).toEqual([]);

    // Out of Alt Mode: nothing.
    bot.system.isTransformed = false;
    wearer.system.defenses = defenses();
    bot.system.defenses = defenses();
    ruleDerived(wearer);
    ruleDerived(bot);
    expect(wearer.system.defenses.toughness.total).toBe(10);
    expect(bot.system.defenses.toughness.total).toBe(10);
    expect(ruleRollSources(wearer, null, { rolledSkill: 'brawn' }).sources).toEqual([]);
  });

  test('a new wielder takes it over; with nobody picked, nobody has it - and the Cybertronian no Body Armor bonus', async () => {
    const bot = makeActor('Bot', FILES.inTheRightHands, { system: { isTransformed: true, defenses: defenses() } });
    const first = makeActor('First', [], { x: 5 });
    scene(bot, first);
    await wield(bot, 'firearm');
    expect(ruleRollSources(first, null, { rolledSkill: 'alertness' }).sources).toHaveLength(1);
    const second = makeActor('Second', [], { x: 5 });
    scene(bot, first, second);
    await wield(bot, 'melee', 'Second');
    expect(first.flags.essence20.ruleMarks?.rightHands).toBeUndefined();
    expect(ruleRollSources(second, null, { rolledSkill: 'intimidation' }).sources).toHaveLength(1);
    expect(ruleRollSources(second, null, { rolledSkill: 'alertness' }).sources).toEqual([]);

    grants.chooseSelect.mockImplementation(async (title, prompt, options) => (options.some(option => option.value == 'bodyArmor') ? 'bodyArmor' : null));
    // Nobody to hand it to (both have gone over to the other side): it comes off the wielder.
    second.token.document.disposition = -1;
    first.token.document.disposition = -1;
    await runUse(itemNamed(bot, 'In The Right Hands'), pay);
    expect(second.flags.essence20.ruleMarks?.rightHands).toBeUndefined();
    ruleDerived(bot);
    expect(bot.system.defenses.toughness.total).toBe(10);
  });

  test('Handheld Shield: ↑1 Might on a shove, and a Snag on the first attack against the wielder each turn', async () => {
    const bot = makeActor('Bot', FILES.inTheRightHands, { system: { isTransformed: true } });
    const wielder = makeActor('Wielder', [], { x: 5 });
    const foe = makeActor('Foe', [], { x: 15, disposition: -1 });
    scene(bot, wielder, foe);
    await wield(bot, 'shield');
    expect(ruleRollSources(wielder, null, { rolledSkill: 'might', dataset: { isShove: true } }).sources).toHaveLength(1);
    expect(ruleRollSources(wielder, null, { rolledSkill: 'might' }).sources).toEqual([]);
    const attack = { isAttack: true, item: { type: 'weaponEffect', system: { classification: { style: 'melee' } } } };
    const first = markedTargetSources(foe, wielder, attack);
    expect(first.sources).toEqual([expect.objectContaining({ snag: true })]);
    expect(first.consumes).toEqual([expect.objectContaining({ ext: 'rulesLimit', actorUuid: bot.uuid })]);
    expect(markedTargetSources(foe, bot, attack).sources).toEqual([]);
  });
});

describe('Pack Attack', () => {
  const attack = { isAttack: true, item: { type: 'weaponEffect', system: { classification: { style: 'melee' } } } };

  test('only while its Growl mark is on someone; allies within 60 ft get ↑1 on attacks against that target until the next turn', async () => {
    const warthog = makeActor('Warthog', FILES.packAttack);
    const near = makeActor('Near', [], { x: 30 });
    const far = makeActor('Far', [], { x: 80 });
    const foe = makeActor('Foe', [], { x: 20, disposition: -1 });
    scene(warthog, near, far, foe);
    const item = itemNamed(warthog, 'Pack Attack');
    const [use] = item.system.rules;
    expect(useAvailable(item, use, 0)).toBe(false);
    foe.flags.essence20.ruleMarks = { [`growl--${warthog.id}`]: { by: warthog.uuid, until: 'combat', stamp: null } };
    expect(useAvailable(item, use, 0)).toBe(true);
    await runUse(item, pay);
    expect(near.flags.essence20.ruleMarks.packAttackAlly).toEqual(expect.objectContaining({ by: warthog.uuid, until: 'nextTurnOrScene' }));
    expect(far.flags.essence20.ruleMarks?.packAttackAlly).toBeUndefined();
    expect(markedTargetSources(near, foe, attack).sources).toEqual([expect.objectContaining({ label: 'Pack Attack', shiftUp: 1 })]);
    expect(markedTargetSources(far, foe, attack).sources).toEqual([]);
    expect(markedTargetSources(warthog, foe, attack).sources).toEqual([]);
    expect(markedTargetSources(near, foe, { isAttack: false, rolledSkill: 'persuasion' }).sources).toEqual([]);
  });

  test('with no ally within 60 ft: a warning and nothing marked', async () => {
    const warthog = makeActor('Warthog', FILES.packAttack);
    const foe = makeActor('Foe', [], { x: 20, disposition: -1 });
    scene(warthog, foe);
    foe.flags.essence20.ruleMarks = { [`growl--${warthog.id}`]: { by: warthog.uuid, until: null, stamp: null } };
    await runUse(itemNamed(warthog, 'Pack Attack'), pay);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.PackAttackNoAllies');
    expect(foe.flags.essence20.ruleMarks.packAttackTarget).toBeUndefined();
  });
});

describe('WTNV Medicine Kit (and the Night Vale kits\' Skills)', () => {
  test('its Skill: Science (Medicine); the Science and Travel Reporter kits: Science, Streetwise', () => {
    const owner = makeActor('Owner', [FILES.medicineKit, FILES.scienceKit, FILES.travelReporterKit]);
    expect(kits.kitInfo(itemNamed(owner, 'Medicine Kit'))).toEqual(expect.objectContaining({ skill: 'science', spec: 'Medicine' }));
    expect(kits.kitInfo(itemNamed(owner, 'Science Kit'))).toEqual(expect.objectContaining({ skill: 'science', spec: null }));
    expect(kits.kitInfo(itemNamed(owner, 'Travel Reporter Kit'))).toEqual(expect.objectContaining({ skill: 'streetwise', spec: null }));
  });

  test('"Heal 2", first in the kit\'s choices while unspent: a Standard action, 2 Health (doubled by Take Mine) to the target or yourself', async () => {
    const medic = makeActor('Medic', FILES.medicineKit, { system: { health: { value: 5, max: 10 } } });
    const hurt = makeActor('Hurt', [], { x: 5, system: { health: { value: 9, max: 10 } } });
    scene(medic, hurt);
    const kit = itemNamed(medic, 'Medicine Kit');
    const offered = [];
    globalThis.foundry.applications.api.DialogV2.wait = jest.fn(async ({ buttons }) => {
      offered.push(buttons.map(button => button.label));
      return buttons[0].action;
    });
    const payKit = jest.fn(async () => true);
    target(hurt);
    expect(await kits.useKit(medic, kit, payKit)).toBe('Medic uses the kit: Hurt heals 2.');
    expect(offered[0][0]).toBe('Heal 2');
    expect(payKit).toHaveBeenCalledWith('standard');
    expect(hurt.system.health.value).toBe(10);
    expect(kit.flags.essence20.kitSpent).toBe(true);

    // Spent: no heal on offer - scrounging it back is all that's left.
    globalThis.foundry.applications.api.DialogV2.wait = jest.fn(async () => null);
    expect(await kits.useKit(medic, kit, payKit)).toMatch(/^E20.KitScrounge/);
    expect(globalThis.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();

    // No target: yourself.
    const fresh = makeActor('Fresh', FILES.medicineKit, { system: { health: { value: 5, max: 10 } } });
    scene(fresh);
    target();
    globalThis.foundry.applications.api.DialogV2.wait = jest.fn(async ({ buttons }) => buttons[0].action);
    await kits.useKit(fresh, itemNamed(fresh, 'Medicine Kit'), payKit);
    expect(fresh.system.health.value).toBe(7);

    // An unpaid action: nothing happens.
    const broke = makeActor('Broke', FILES.medicineKit, { system: { health: { value: 5, max: 10 } } });
    scene(broke);
    await kits.useKit(broke, itemNamed(broke, 'Medicine Kit'), async () => false);
    expect(broke.system.health.value).toBe(5);
  });
});

describe('A Hint of Independence', () => {
  beforeEach(() => {
    grants.chooseSelect.mockReset();
    activateWhyDoIKnowThat.mockClear();
    global.CONFIG.E20.damageTypes = { energy: 'E20.DamageEnergy', fire: 'E20.DamageFire' };
  });

  test('once: a General Perk, then an imperfection picked (or rolled); Stress Leak and Vulnerability also take a damage type', async () => {
    const drone = makeActor('Drone', FILES.hintOfIndependence);
    scene(drone);
    const item = itemNamed(drone, 'A Hint of Independence');
    const [use] = item.system.rules;
    grants.chooseSelect.mockResolvedValue('fire');
    const card = await runUse(item, pay, { ask: async (step, options) => {
      expect(options.map(option => option.label)).toEqual(['E20.ImperfectionRoll', ...Array.from({ length: 8 }, (_, i) => `E20.Imperfection.${i + 1}`)]);
      return 4;
    } });
    expect(activateWhyDoIKnowThat).toHaveBeenCalledWith(drone);
    expect(imperfectionOf(drone)).toEqual({ n: 4, imperfectionType: 'fire' });
    expect(card).toContain('E20.Imperfection.4');
    expect(useAvailable(item, use, 0)).toBe(false);
  });

  test('the roll: 1d8; no damage type for the others; a cancelled Perk pick or imperfection still uses it up', async () => {
    const drone = makeActor('Drone', FILES.hintOfIndependence);
    scene(drone);
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    await runUse(itemNamed(drone, 'A Hint of Independence'), pay, { ask: async () => 0 });
    jest.restoreAllMocks();
    expect(imperfectionOf(drone)).toEqual({ n: 8 });
    expect(grants.chooseSelect).not.toHaveBeenCalled();

    const other = makeActor('Other', FILES.hintOfIndependence);
    scene(other);
    activateWhyDoIKnowThat.mockResolvedValueOnce(null);
    const item = itemNamed(other, 'A Hint of Independence');
    await runUse(item, pay, { ask: async () => null });
    expect(item.flags.essence20.granted).toBe(true);
    expect(imperfectionOf(other)).toBeNull();
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);

    // Vulnerability with the damage type left unpicked keeps none.
    const third = makeActor('Third', FILES.hintOfIndependence);
    scene(third);
    grants.chooseSelect.mockResolvedValue(null);
    await runUse(itemNamed(third, 'A Hint of Independence'), pay, { ask: async () => 3 });
    expect(imperfectionOf(third)).toEqual({ n: 3 });
  });
});

describe('Hit Someone Your Own Size!', () => {
  const attack = { isAttack: true, item: { type: 'weaponEffect', system: { classification: { style: 'melee' } } } };

  function pair({ distance = 5 } = {}) {
    const guard = makeActor('Guard', FILES.hitSomeone, { system: { defenses: { toughness: { total: 16 } } } });
    const partner = makeActor('Partner', [], { x: distance, system: { defenses: { toughness: { total: 11 } } } });
    const foe = makeActor('Foe', [], { x: 30, disposition: -1 });
    guard.flags.essence20.bond = { partner: partner.uuid, linked: true };
    scene(guard, partner, foe);
    return { guard, partner, foe };
  }

  test('attacks on the bonded partner within the holder\'s Reach suffer ↓2 - not the holder\'s own', () => {
    const { guard, partner, foe } = pair();
    expect(bondGuardSources(foe, partner, attack).sources).toEqual([expect.objectContaining({ label: 'Hit Someone Your Own Size!', shiftDown: 2 })]);
    expect(bondGuardSources(guard, partner, attack).sources).toEqual([]);
    expect(bondGuardSources(foe, partner, { isAttack: false, rolledSkill: 'persuasion' }).sources).toEqual([]);
    expect(bondGuardSources(foe, guard, attack).sources).toEqual([]);
    partner.token.center.x = 10;
    expect(bondGuardSources(foe, partner, attack).sources).toEqual([]);
  });

  test('within 5 ft the partner meets the better of its own and the holder\'s Toughness', () => {
    const { guard, partner, foe } = pair();
    expect(holderBestAdjust(foe, partner, 'toughness')).toBe(5);
    expect(holderBestAdjust(foe, partner, 'evasion')).toBe(0);
    expect(holderBestAdjust(foe, guard, 'toughness')).toBe(0);
    partner.system.defenses.toughness.total = 18;
    expect(holderBestAdjust(foe, partner, 'toughness')).toBe(0);
    partner.system.defenses.toughness.total = 11;
    partner.token.center.x = 6;
    expect(holderBestAdjust(foe, partner, 'toughness')).toBe(0);
  });
});

describe('Try Me', () => {
  const rolled = total => ({ rollSkill: jest.fn(async () => ({ outcomes: [{ results: [{ total }] }] })) });

  test('once per combat, a Standard action: a card with an Accept per enemy within 20 ft for the GM', async () => {
    const brawler = makeActor('Brawler', FILES.tryMe);
    const near = makeActor('Near', [], { x: 15, disposition: -1 });
    const far = makeActor('Far', [], { x: 30, disposition: -1 });
    const friend = makeActor('Friend', [], { x: 5 });
    scene(brawler, near, far, friend);
    const item = itemNamed(brawler, 'Try Me');
    await runUse(item, pay);
    expect(pay).toHaveBeenCalledWith('standard');
    const card = ChatMessage.create.mock.calls.map(([data]) => data).filter(data => data.flags?.essence20?.ruleButtons).pop();
    expect(card.content).toContain('E20.TryMeIssued');
    expect(card.flags.essence20.ruleButtons.buttons.map(button => [button.label, button.who])).toEqual([['Near accepts', 'gm']]);
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);

    // Nobody in range: a warning, nothing paid.
    const lonely = makeActor('Lonely', FILES.tryMe);
    scene(lonely, far);
    pay.mockClear();
    await runUse(itemNamed(lonely, 'Try Me'), pay);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.NoOneInRange');
    expect(pay).not.toHaveBeenCalled();
  });

  test('accepted: the enemy is moved beside the challenger and both roll their better of Might and Finesse - a tie to the challenger', async () => {
    const brawler = makeActor('Brawler', FILES.tryMe, { system: { skills: { might: { shift: 'd6' }, finesse: { shift: 'd6' } } } });
    const near = makeActor('Near', [], { x: 15, disposition: -1, system: { skills: { might: { shift: 'd4' }, finesse: { shift: 'd8' } } } });
    scene(brawler, near);
    global.CONFIG.E20.skillShiftList = ['3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'];
    global.CONFIG.E20.skillToEssence = { ...global.CONFIG.E20.skillToEssence, might: 'strength', finesse: 'speed' };
    brawler.token.document = { ...brawler.token.document, x: 200, y: 300, width: 2 };
    near.token.document.update = jest.fn(async () => {});
    brawler._dice = rolled(12);
    near._dice = rolled(12);
    await runUse(itemNamed(brawler, 'Try Me'), pay);
    const card = ChatMessage.create.mock.calls.map(([data]) => data).filter(data => data.flags?.essence20?.ruleButtons).pop();
    await pressCardButton(card, 0);
    expect(near.token.document.update).toHaveBeenCalledWith({ x: 400, y: 300 });
    expect(brawler._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'might' }), brawler);
    expect(near._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'finesse' }), near);
    const said = ChatMessage.create.mock.calls.map(([data]) => String(data.content)).join(' ');
    expect(said).toContain('ContestWon');
  });
});
