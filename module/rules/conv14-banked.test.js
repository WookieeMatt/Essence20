import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 14, part "banked" (docs/rules-batches/slBanked14.md): the Perk Use buttons moved out of
 * mechanics/resources/banked-buffs.mjs (and their dice.mjs / item-file halves) onto rules. Each item is loaded from its
 * pack source; these check the rules validate and that the converted Uses do what the removed code did, plus the four
 * user-approved fixes (Nemesis Drain, Whatever We Need, Extra Rough Training, Words Can Hurt!).
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const rollVsMany = jest.fn(async (actor, skill, others) => others.map(other => ({ targetUuid: other.uuid, success: true })));
jest.unstable_mockModule('./mechanics/combat/reaction-engine.mjs', () => ({ rollVsMany }));
const nearby = { tokens: [] };
jest.unstable_mockModule('./mechanics/combat/nearby-enemies.mjs', () => ({ getNearbyEnemyTokens: jest.fn(() => nearby.tokens) }));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { runUse } = await import('./triggers.mjs');
const { toggleOf } = await import('./predicate.mjs');
const { nearbyEnemies } = await import('./plugins/combat/nearby-enemies-recipient.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

// Every pack file this part gave rules to.
const ALL = [
  'ttsgitems/_source/Combat_Stance_R2C760BXAI1XKVtm.json',
  'iafav2items/_source/Like_Water_HSjShnVmoDdzEDT1.json',
  'sssitems/_source/Meat_Shield_hYwFDsC7azfYB5fO.json',
  'mlpcrbitems/_source/Inner_Magic_E6GWRHzP9tOAxQP6.json',
  'atsitems/_source/Through_the_Arches_f372LpDqqiO2XoEi.json',
  'ghpfitems/_source/Trigger_Reaction_PItQuRGhxq4lMT3P.json',
  'atsitems/_source/Phantom_Suite_fQgxo5c7tNOD2Q5K.json',
  'gijcrbitems/_source/Castling_eB7jbgbevLVPxW4e.json',
  'ccitems/_source/Beast_Mode_o4lqILvsxyU3LhBS.json',
  'qgtgitems/_source/Box_Shot_N8E3QTLUKX6DOoEc.json',
  'gijcrbitems/_source/Protected_Target_llnU5dWqYlfgLA5V.json',
  'dditems/_source/Primary_Quarry_myYcCOZdN1ViBeQH.json',
  'dditems/_source/Known_Accomplices_LxpkFOriqLvRT7sn.json',
  'tfcrbitems/_source/Mark_Everybot_KxmnKUYmQ56D02Jg.json',
  'sssitems/_source/Extra_Rough_Training_pqrUN5jaAbWJmgLf.json',
  'fffav1items/_source/Timely_Teammate_yrhhCOXpS8Mx1R0C.json',
  'fffav1items/_source/Roar__AaI58jYka8MfhIbc.json',
  'fmmcitems/_source/Nemesis_Drain_WQYSawSpefEKLaG0.json',
  'fmmcitems/_source/Right_Behind_You_7jwgzzygZymRkndW.json',
  'fmmcitems/_source/Better_You_Than_Me_u0vF75YLcwdyY8pv.json',
  'fmmcitems/_source/Power_Bleed_2nI6ckZdiIKwtRqr.json',
  'fmmcitems/_source/Toxic_Terror_kh7Wk5zalucm9I7p.json',
  'gijcrbitems/_source/Rousing_Comeback_I8yAnOEoaut76wlf.json',
  'gijcrbitems/_source/Knight_s_Jump_CG0aeZtKsPVmvUF5.json',
  'gijcrbitems/_source/Dirty_Trick__Environmental__e5nMmMPpV3WU9P92.json',
  'jttitems/_source/Honorific_Token_z9NkwgoIx2JRrPBA.json',
  'mlpcrbitems/_source/Party_Power_GKez5xeu5ZllzGOI.json',
  'gijcrbitems/_source/Concentrate_Fire_LccKe9ZdDPvS5YbD.json',
  'qgtgitems/_source/Stay_In_Formation_pU3dKGNWYAhgRY6B.json',
  'prcrbitems/_source/Humanitarian_hxWJxlMLbkBbx73w.json',
  'prcrbitems/_source/_I_Know_A_Guy__anfEVX8bI2eQh40E.json',
  'gijcrbitems/_source/Phantom_Z92UggPHdmt47A7Q.json',
  'gijcrbitems/_source/Suggestion_q2YLQLdssomYU4Za.json',
  'gijcrbitems/_source/Talk_Them_Down_Y8PlCnqD5txZKJWh.json',
  'qgtgitems/_source/Deadstick_SDwpvAzQX0pYSHyc.json',
  'kocitems/_source/Superb_Soloist_S3t5zNlhPp7evXbh.json',
  'ccitems/_source/Harass_91TqKfAnyL1VijZH.json',
  'ccitems/_source/Antagonistic_04lrt1b9aCN4ts2N.json',
  'ccitems/_source/Flying_Nuisance_6PsZqPUijt60ISlq.json',
  'ccitems/_source/Versatile_Protection_FZQlUV1KkyQxUi7s.json',
  'ccitems/_source/Animal_Gait_gWjcSPeqNe1h8rwZ.json',
  'tsitems/_source/Two_Heads_Are_Better_Than_One_2SGJ4ezuiZgb7JqX.json',
  'tsitems/_source/Invisibility_Ec3PMcI8WsCu2ivp.json',
  'dditems/_source/I_Still_Function_o4HgDxoKWVtieWZJ.json',
  'gijcrbitems/_source/Self_Revive_ulES8RippJVrGbhj.json',
  'gijcrbitems/_source/Shoulder_To_Shoulder_vZNQBGwiv1hREbyr.json',
  'gijcrbitems/_source/Natural_Movement_TLI74oM0tbDtQ298.json',
  'dsoeitems/_source/Pointy_kwkUWzNVdSKDx0jt.json',
  'mlpcrbitems/_source/After_You_CjNQHWxMjTQfcLTZ.json',
  'wtnvcgitems/_source/Quick_Study_adJm4dpjD04TICkd.json',
  'atsitems/_source/Power_Adaptation_S7Qs6bJOVkVFxlFu.json',
  'dditems/_source/Spot_Weld_4GYOdopDcXS8lgGI.json',
  'eocitems/_source/Martial_Leadership_6dRdxCRjWqjrt8Wc.json',
  'eocitems/_source/Voice_of_Primus_m8oHzT4BUB79NiVw.json',
  'eocitems/_source/Words_Can_Hurt__SBoujesTRdI7IpmM.json',
  'eocitems/_source/Calming_Words_r3slLsGwSfXUiD94.json',
  'jttitems/_source/Archkey_EEZUFQIGfeLhT2qX.json',
  'jttitems/_source/Engine_Cells_Q8TO2TJNncmy6Q6R.json',
  'dditems/_source/Energon_Cube_5p3lMU4vT7kUodp5.json',
  'dditems/_source/Energon_Snack_y72ZEiWUa3AYxcXl.json',
  'ccitems/_source/Impossible_Expectations_98rFJyzaoCWrLdbF.json',
  'bthitems/_source/Absolute_Menace_YsoS30FKigTm19CH.json',
  'eocitems/_source/Frightening_Display_8NJtMXvcK3YDnwY4.json',
  'bthitems/_source/Fight_Me__7ovAtv0r6UaAsmHE.json',
  'wtnvcgitems/_source/A_Logical_Explanation_CiDQxCxgnnosvBDo.json',
  'bthitems/_source/Duty_Of_The_Graphite_Rr7ucZahtHI9yXwA.json',
  'qgtgitems/_source/Uninterrupted_Break_1vrQxY1nzjMjeU7D.json',
  'bthitems/_source/Elemental_Storm_6IoMpj8pWmP8IpH4.json',
  'jttitems/_source/Comic_Flair_Ux2eueBLxKgzD2Kd.json',
  'jttitems/_source/Powered_Plating_45WHjwO125zTvuGR.json',
  'jttitems/_source/Paradox_TYebczV8RvTTbWnL.json',
  'ttsgitems/_source/At_All_Cost_TGnqQAWWi1hBGqeh.json',
  'gijcrbitems/_source/Quick_Study_IoOFcSJK3sHLAbgR.json',
  'gijcrbitems/_source/Fast_Learner_u3KK0V30GXDdRPAY.json',
  'tsitems/_source/Electromagnetic_Disruption_EmJaaHzoEYtWhchj.json',
  'prcrbitems/_source/At_All_Costs_UFwnD2CsWCWXlUyf.json',
  'fgtaaitems/_source/It_s_Time_HT4iCNp5WIWXR5bJ.json',
  'ghpfitems/_source/Soothe_vzTeGdjO3v2oeR19.json',
  'fgtaaitems/_source/Manipulate_5IfrvMnLOMqfNWko.json',
  'fgtaaitems/_source/Talk_Them_Down_Ht8KDCTIQXLo1YI3.json',
  'prcrbitems/_source/Whirlwind_Strike_SV8nqua9koRB3lvm.json',
  'prcrbitems/_source/Whatever_We_Need_1DphEJt2hPswKDzI.json',
  'tfcrbitems/_source/Force_Field_j3qkiawQATkksdaC.json',
  'ghpfitems/_source/Squad_Guardian_Li2y6KqFu2OGRkrX.json',
  'prcrbitems/_source/Volley_Xi2sHKmBi21c3wbu.json',
  'prcrbitems/_source/Group_Strike_coGMtK50t3Ojeklx.json',
  'wtnvcgitems/_source/More_Heads_are_Better_than_One_jsaByB9ui8k1VUfG.json',
  'mlpcrbitems/_source/Horse_Around_6uhfHYeuUkFuGEEN.json',
  'mlpcrbitems/_source/Crack_Up_The_4th_Wall_km6HV50h6XWKTIm1.json',
  'prcrbitems/_source/Inspiration_FJSNzVRulj20M0B1.json',
  'gijcrbitems/_source/Benefits_of_Command_jSmMtJ0YFCEJcXYU.json',
];

const FILES = {
  energonCube: 'dditems/_source/Energon_Cube_5p3lMU4vT7kUodp5.json',
  crackUp: 'mlpcrbitems/_source/Crack_Up_The_4th_Wall_km6HV50h6XWKTIm1.json',
  pointy: 'dsoeitems/_source/Pointy_kwkUWzNVdSKDx0jt.json',
  nemesisDrain: 'fmmcitems/_source/Nemesis_Drain_WQYSawSpefEKLaG0.json',
  whateverWeNeed: 'prcrbitems/_source/Whatever_We_Need_1DphEJt2hPswKDzI.json',
  extraRoughTraining: 'sssitems/_source/Extra_Rough_Training_pqrUN5jaAbWJmgLf.json',
  wordsCanHurt: 'eocitems/_source/Words_Can_Hurt__SBoujesTRdI7IpmM.json',
};

/** foundry.utils.setProperty, for plain objects. */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const node = keys.reduce((at, key) => (at[key] ??= {}), object);
  if (last.startsWith('-=') || (globalThis.foundry?.data?.operators?.ForcedDeletion && value instanceof globalThis.foundry.data.operators.ForcedDeletion)) {
    delete node[last.replace(/^-=/, '')];
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
    delete: jest.fn(async () => {}),
  };
  return item;
}

/** An actor holding the pack items `files`, with a token at x (feet) and disposition. */
function makeActor(name, files = [], { system = {}, x = 0, disposition = 1 } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: {
      level: 12, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 6 } }, skills: {},
      energon: { normal: { value: 1, max: 4 } }, rolePoints: { name: 'Cheer Points', value: 0, max: 3 },
      defenses: { toughness: { total: 10 }, evasion: { total: 10 }, willpower: { total: 11 }, cleverness: { total: 14 } }, ...system,
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  for (const file of [files].flat()) {
    const doc = fromPack(file);
    items.push(makeItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system) }));
  }

  actor.items = {
    contents: items, get: id => items.find(item => item.id == id), find: fn => items.find(fn), filter: fn => items.filter(fn), some: fn => items.some(fn),
    [Symbol.iterator]: () => items[Symbol.iterator](),
  };
  const token = { actor, document: { disposition }, center: { x, y: 0 }, id: `t${actor.id}` };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);

function scene(...actors) {
  const docs = new Map(actors.map(actor => [actor.uuid, actor]));
  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null, contents: actors, [Symbol.iterator]: () => actors[Symbol.iterator]() };
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token), controlled: [], setTargets: jest.fn() }, grid: { size: 100, measurePath: ([a, b]) => ({ distance: Math.hypot(a.x - b.x, a.y - b.y) }) }, scene: { id: 'sc', tokens: [] } };
}

const target = (...actors) => {
  global.game.user.targets = new Set(actors.map(actor => actor.token));
};

/** Every step anywhere under `steps` (options, branches, nested steps). */
function allSteps(node, out = []) {
  if (Array.isArray(node)) {
    node.forEach(entry => allSteps(entry, out));
  } else if (node && typeof node == 'object') {
    if (node.do) {
      out.push(node);
    }

    Object.values(node).forEach(value => allSteps(value, out));
  }

  return out;
}

const pay = jest.fn(async () => true);
const savedGame = global.game;
const savedFromUuid = global.fromUuid;
const savedFromUuidSync = global.fromUuidSync;

beforeEach(() => {
  pay.mockClear();
  rollVsMany.mockClear();
  nearby.tokens = [];
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], activeGM: null },
    actors: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}), getSpeakerActor: () => null };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.foundry = {
    ...global.foundry,
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

test('every banked-part rule validates', () => {
  expect(ALL.length).toBe(91);
  for (const file of ALL) {
    const rules = fromPack(file).system.rules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

test('no converted rule uses the broken target:markedByMe: or rule:toggle: tag forms', () => {
  for (const file of ALL) {
    const text = JSON.stringify(fromPack(file).system.rules);
    expect(text).not.toMatch(/target:markedByMe:|rule:toggle:/);
  }
});

describe('resource Uses', () => {
  test('Energon Cube: +2 Energon past the max, one off the stack', async () => {
    const bot = makeActor('Bot', FILES.energonCube);
    scene(bot);
    const cube = itemNamed(bot, 'Energon Cube');
    cube.system.quantity = 2;
    bot.system.energon.normal.value = 4;
    await runUse(cube, pay);
    expect(bot.system.energon.normal.value).toBe(6);
    expect(cube.system.quantity).toBe(1);
  });

  test('Crack-Up The 4th Wall is once per encounter', () => {
    const [use] = fromPack(FILES.crackUp).system.rules;
    expect(use.limit).toEqual({ per: 'encounter' });
    expect(use.steps).toEqual([{ do: 'gainResource', resource: { rolePoints: 'Cheer Points' }, amount: 1 }]);
  });
});

describe('Pointy: claws on until switched off or the combat ends', () => {
  test('the On Use sets the toggle with until combat; Off clears it', async () => {
    const pony = makeActor('Pony', FILES.pointy);
    scene(pony);
    const pointy = itemNamed(pony, 'Pointy');
    await runUse(pointy, pay);
    expect(toggleOf(pointy, 'on')).toBe(true);
    expect(pointy.flags.essence20.rules.toggleUntil.on.until).toBe('combat');
    await runUse(pointy, pay);
    expect(toggleOf(pointy, 'on')).toBe(false);
  });

  test('the shift is unarmed only; the Sharp damage type covers the claw weapons too', () => {
    const rules = fromPack(FILES.pointy).system.rules;
    expect(rules.find(rule => rule.type == 'RollModifier').when).toEqual(['attack:unarmed', 'self:toggle:on']);
    expect(rules.find(rule => rule.type == 'DamageType').to).toBe('sharp');
  });
});

describe('Nemesis Drain (user-approved fix: the penalty ends with the scene)', () => {
  test('drains 1 Personal Power from each nearby enemy hit and marks them until the scene ends', async () => {
    const monster = makeActor('Monster', FILES.nemesisDrain, { disposition: -1 });
    const ranger = makeActor('Ranger', [], { x: 10 });
    scene(monster, ranger);
    nearby.tokens = [ranger.token, ranger.token];
    await runUse(itemNamed(monster, 'Nemesis Drain'), pay);
    expect(rollVsMany).toHaveBeenCalledWith(monster, 'intimidation', [ranger], 'willpower', 'social');
    expect(monster.system.powers.personal.value).toBe(1);
    expect(ranger.system.powers.personal.value).toBe(2);
    expect(ranger.flags.essence20.ruleMarks.nemesisDrain).toEqual(expect.objectContaining({ by: monster.uuid, until: 'scene' }));
  });

  test('the -1 to Toughness and Evasion only reads the drain mark while Morphed', () => {
    const defenses = fromPack(FILES.nemesisDrain).system.rules.filter(rule => rule.type == 'Defense');
    expect(defenses.map(rule => [rule.defense, rule.amount, rule.mark])).toEqual([['toughness', -1, 'nemesisDrain'], ['evasion', -1, 'nemesisDrain']]);
    defenses.forEach(rule => expect(rule.when).toContain('self:morphed'));
  });
});

test('nearbyEnemies recipient: each actor once, in token order', () => {
  const a = makeActor('A');
  const b = makeActor('B');
  nearby.tokens = [a.token, b.token, a.token, { actor: null }];
  expect(nearbyEnemies(makeActor('Me'), 30)).toEqual([a, b]);
});

describe('Whatever We Need (user-approved fix: the Edge is used up by the roll)', () => {
  test('marks one target and the Edge consumes that mark', async () => {
    const ranger = makeActor('Ranger', FILES.whateverWeNeed);
    const points = makeItem(ranger, { name: 'Role Points', type: 'rolePoints', system: { resource: { value: 2, max: 3 } } });
    ranger.items.contents.push(points);
    const ally = makeActor('Ally');
    scene(ranger, ally);
    target(ally);
    await runUse(itemNamed(ranger, 'Whatever We Need'), pay);
    expect(ally.flags.essence20.ruleMarks.whateverWeNeed.by).toBe(ranger.uuid);
    expect(points.system.resource.value).toBe(1);
    const modifier = fromPack(FILES.whateverWeNeed).system.rules.find(rule => rule.type == 'RollModifier');
    expect(modifier).toEqual(expect.objectContaining({ edge: true, consumeMark: 'whateverWeNeed', consumeFrom: 'target' }));
  });
});

describe('Extra Rough Training (user-approved fix: once per mission per teammate)', () => {
  test('stamps a mission window on the teammate and refuses a teammate already trained this mission', () => {
    const [use] = fromPack(FILES.extraRoughTraining).system.rules;
    const steps = allSteps(use.steps);
    expect(steps.find(step => step.do == 'markWindow')).toEqual({ do: 'markWindow', flag: 'extraRoughTrainingUsedThisMission', window: 'mission', to: 'target' });
    expect(steps.find(step => step.do == 'warn').when).toEqual(['target:windowUsed:extraRoughTrainingUsedThisMission:mission']);
    expect(use.when).toEqual(['not:combat:exists']);
  });

  test('success banks an Edge, failure an upshift, for the trained Skill only', () => {
    const banks = allSteps(fromPack(FILES.extraRoughTraining).system.rules).filter(step => step.do == 'bank');
    expect(banks.map(bank => [bank.edge ?? false, bank.upshift ?? 0, bank.until])).toEqual([[true, 0, 'combat'], [false, 1, 'combat']]);
    banks.forEach(bank => expect(bank.appliesWhen).toEqual(['skill:{var.picked}', 'not:roll:initiative']));
  });
});

describe("Words Can Hurt! (user-approved fix: the immunity ends with the scene)", () => {
  test('every hit branch marks the target immune until the scene ends, and an immune target is refused', () => {
    const [use] = fromPack(FILES.wordsCanHurt).system.rules;
    const steps = allSteps(use.steps);
    const marks = steps.filter(step => step.do == 'mark');
    expect(marks).toHaveLength(4);
    marks.forEach(mark => expect(mark).toEqual({ do: 'mark', key: 'wordsCanHurtImmune', to: 'target', until: 'scene' }));
    expect(steps.find(step => step.do == 'warn').when).toEqual(['target:marked:wordsCanHurtImmune']);
  });
});
