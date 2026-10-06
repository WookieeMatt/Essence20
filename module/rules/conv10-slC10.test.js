import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Batch slC10 (docs/rules-batches/slC10.md): group C's items, converted on the round-10 engine pieces
 * (module/rules/ext/c/). Each is loaded from its pack source and must do what the removed slice code did.
 */

// The action economy the steps go through. (Mocked paths resolve from module/jest.setup.js.)
const spend = jest.fn(async () => ({ blocked: false }));
const setNextTurn = jest.fn(async () => true);
const grantBonusAttack = jest.fn(async () => true);
jest.unstable_mockModule('./helpers/action-economy.mjs', () => ({ spend, setNextTurn, grantBonusAttack, getLedger: () => null, isTracking: () => true }));
// The pickers and the plain Skill Test a roll step makes (helpers/grants.mjs).
const chooseSelect = jest.fn(async (title, prompt, options) => options[0]?.value ?? null);
const rollTest = jest.fn(async () => ({ success: true }));
jest.unstable_mockModule('./helpers/grants.mjs', () => ({ chooseSelect, rollTest, chooseButtons: jest.fn() }));
// Damage lands through helpers/combat.mjs#applyDamage.
jest.unstable_mockModule('./helpers/combat.mjs', () => ({ applyDamage: jest.fn(async () => true) }));

const { rebuildIndex } = await import('./index.mjs');
const { fireTriggers, runUse } = await import('./triggers.mjs');
const { ruleDialogSwitches, ruleDerived, ruleRollSources, applyRuleSwitches } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { registerCheck, setWorldLookups } = await import('./predicate.mjs');
const { runApplyDialog, runPreRoll, extDefenseAdjust } = await import('../helpers/extensions.mjs');
await import('./ext/index.mjs');
const { lazy } = await import('./ext/c/core.mjs');
const { lateDefenseAdjust } = await import('./ext/c/defense.mjs');
const { ruleItemLadders } = await import('./ext/c/equipment.mjs');
const { ruleBrawnBonus } = await import('./ext/c/brawn.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  angry: 'ccitems/_source/Angry_wGMyGbySdNSgPs8B.json',
  fastTracking: 'dditems/_source/Fast_Tracking_9DMDz10v4IJ75MZQ.json',
  environmentalWarrior: 'bthitems/_source/Environmental_Warrior_bxnYVraaRNaXRy9Y.json',
  layeredArmor: 'jttitems/_source/Layered_Armor_GUppwd5R2bSVaKVO.json',
  seafarerHangUp: 'qgtgitems/_source/Seafarer_ahWxUG3w6KkfgUDw.json',
  arcticGij: 'gijcrbitems/_source/Arctic_Expedition_Clothes_pWRpmsOcWIv9trHP.json',
  arcticMlp: 'mlpcrbitems/_source/Arctic_Expedition_Clothes_pWRpmsOcWIv9trHP.json',
  desertGij: 'gijcrbitems/_source/Desert_Expedition_Clothes_SQzr6PhXZQ338BBh.json',
  desertMlp: 'mlpcrbitems/_source/Desert_Expedition_Clothes_SQzr6PhXZQ338BBh.json',
  desertGear: 'wtnvcgitems/_source/Desert_Gear_tv0pOgALa608pw8i.json',
  business: 'wtnvcgitems/_source/Business_6Vke4qKEaYjjRWQt.json',
  holographic: 'qgtgitems/_source/Holographic_Sights_aapIJuPKyMaGjb4U.json',
  largerThanLife: 'fmmcitems/_source/Larger_Than_Life_Gwhns0NfDQYhCVPK.json',
  contort: 'ghpfitems/_source/Contort_PPMvpsNSpvUMFwMs.json',
  balance: 'eocitems/_source/Balance_and_Compensation_T0TFdu4HRK8Eh0u0.json',
  overBrawn: 'gijcrbitems/_source/Over_Brawn_ToNsubTwuej5GAV0.json',
  theHeavy: 'gijcrbitems/_source/The_Heavy_rlD6YJSr2fgROKHo.json',
  packMuleGij: 'gijcrbitems/_source/Pack_Mule_x8SbuymJTLYn1TdC.json',
  packMuleTf: 'tfcrbitems/_source/Pack_Mule_b4zeeYax1vrzVGZx.json',
  dogPerson: 'wtnvcgitems/_source/Dog_Person_U5arLtyo8eEgl2Ck.json',
  thirdEye: 'wtnvcgitems/_source/Third_Eye_XolO5C6pgFt8WQJZ.json',
  tenacity: 'gijcrbitems/_source/Tenacity_dyjdCTOs83bLiCxC.json',
  historyBuff: 'jttitems/_source/History_Buff_b3O5i3HMtaIHl6PD.json',
  subtleSnake: 'fffav1items/_source/Subtle_Snake_ZCgcPAQzeMYTti7g.json',
  shadow: 'gijcrbitems/_source/Shadow_PDiRwnTcNCtzJbDn.json',
  somethingIsOff: 'sotsitems/_source/Something_Is_Off_1tLnQT580DafhUV4.json',
  explosiveEngineer: 'ghpfitems/_source/Explosive_Engineer_rT04k3umqXPAlsA3.json',
  explosiveEngineerPerk: 'ghpfitems/_source/Explosive_Engineer_1MCKcleeXZZf5PQF.json',
  secondSkin: 'gijcrbitems/_source/Second_Skin_Txn7a7v4gQOCYPhC.json',
  wildIdea: 'ghpfitems/_source/Wild_Idea_CVl4P0zoArmY5mp1.json',
  stingerSpray: 'fmmcitems/_source/Stinger_Spray_Effect_b2cIwfYeGzvifR7l.json',
  stingerSprayPoison: 'fmmcitems/_source/Stinger_Spray_Alternate_Effect__2_Poison_Damage__GZRKwL2vRwXUIjtf.json',
  stingerSprayBlinded: 'fmmcitems/_source/Stinger_Spray_Alternate_Effect__Blinded__Bx7lTyG4lBTi66Si.json',
  arrogant: 'eocitems/_source/Arrogant_duMjTyfREHYmDFJs.json',
  waterrunning: 'kocitems/_source/Waterrunning_F6mPryRgK7wLM0Yu.json',
  laserDesignator: 'gijcrbitems/_source/Laser_Designator_AcNaNxZnyOfXv0f6.json',
  demolecularizationGun: 'eocitems/_source/Demolecularization_Gun_HjkeUVUUTQiXi0MO.json',
  cage: 'tfcrbitems/_source/Cage_w1E74WXrvwQJlS1Q.json',
  diversion: 'tfcrbitems/_source/Diversion_LDi9BUkXFtaCSoTe.json',
  stoic: 'tfcrbitems/_source/Stoic_p9Obyw2krF0pks8D.json',
  thornWarlord: 'fmmcitems/_source/Thorn_Warlord_GKNjCEwhgEbBiKQn.json',
  ladder: 'tfcrbitems/_source/Ladder_CjJGz1LLzFoveqZK.json',
  bumpAndRun: 'eocitems/_source/Bump___Run_4eA2ktw0cfdYV6Fs.json',
  synchUp: 'tfcrbitems/_source/Synch_Up_gaDAXIEkSt0B25RZ.json',
  noEscape: 'tfcrbitems/_source/No_Escape_xxMeliFHeWYxtGVI.json',
  energized: 'gijcrbitems/_source/Energized_yoOIFTh1E2pVlSln.json',
  spiked: 'gijcrbitems/_source/Spiked_pRipbWx12tOzfdqD.json',
  energyField: 'tfcrbitems/_source/Energy_Field_p2ntDbJb38jpGNFO.json',
  heartyMeal: 'ghpfitems/_source/Hearty_Meal_NULhQcWctFcXXdDH.json',
  weaponEnthusiastHangUp: 'qgtgitems/_source/Weapon_Enthusiast_GcMPz5MICXwTzKOq.json',
  ignite: 'ccitems/_source/Ignite_zherN6ArBKv6wyGc.json',
  deconstruct: 'tfcrbitems/_source/Deconstruct_7tc7EWwKSFQ76tly.json',
};

let nextId = 1;
let sceneEpoch = 1;
const byUuid = new Map();

const getPath = (object, key) => key.split('.').reduce((o, k) => o?.[k], object);
function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  const at = keys.reduce((node, k) => (node[k] ??= {}), object);
  if (last.startsWith('-=')) {
    delete at[last.slice(2)];
  } else {
    at[last] = value;
  }
}

function makeItem(data = {}) {
  const item = {
    id: `i${nextId++}`, name: 'Thing', type: 'perk', isOwner: true, system: {}, ...data,
    flags: { essence20: {}, ...(data.flags ?? {}) },
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
  };
  item.uuid = `Item.${item.id}`;
  byUuid.set(item.uuid, item);
  return item;
}

const packItem = (file, extra = {}) => {
  const doc = fromPack(file);
  return makeItem({ name: doc.name, type: doc.type, system: { ...JSON.parse(JSON.stringify(doc.system)), ...(extra.system ?? {}) }, flags: { core: { sourceId: `Compendium.x.Item.${doc._id}` }, ...(extra.flags ?? {}) }, ...(extra.id ? { id: extra.id } : {}) });
};

function makeActor(items = [], { name = 'Hero', type = 'playerCharacter', system = {}, flags = {}, token = null } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, documentName: 'Actor', isOwner: true, statuses: new Set(), flags: { essence20: { ...flags } },
    system: { level: 6, health: { value: 5, max: 10 }, ...system },
    getActiveTokens: () => (token ? [token] : []),
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
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
      return getPath(this.flags?.[scope] ?? {}, key);
    },
    async toggleStatusEffect(status, { active = true } = {}) {
      if (active) {
        this.statuses.add(status);
      } else {
        this.statuses.delete(status);
      }
    },
    effects: { filter: () => [] },
    async deleteEmbeddedDocuments(kind, ids) {
      this.items.contents = this.items.contents.filter(item => !ids.includes(item.id));
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = {
    contents: items, get: id => actor.items.contents.find(i => i.id == id), find: fn => actor.items.contents.find(fn),
    [Symbol.iterator]: () => actor.items.contents[Symbol.iterator](),
  };
  items.forEach(item => (item.parent = actor));
  rebuildIndex(actor);
  byUuid.set(actor.uuid, actor);
  game.actors.contents.push(actor);
  return actor;
}

const target = (...actors) => {
  game.user.targets = new Set(actors.map(actor => ({ actor })));
  game.user.targets.first = () => [...game.user.targets][0];
};

beforeEach(() => {
  sceneEpoch = 1;
  byUuid.clear();
  spend.mockClear();
  setNextTurn.mockClear();
  grantBonusAttack.mockClear();
  rollTest.mockClear();
  chooseSelect.mockClear();
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], filter: () => [] },
    actors: { contents: [] }, i18n: { localize: k => k, format: k => k, has: () => false },
    settings: { get: () => sceneEpoch, set: async () => {} },
  };
  game.user.targets.first = () => undefined;
  global.canvas = { tokens: { placeables: [] } };
  global.CONFIG = { E20: {
    skillShiftList: ['3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'],
    skillToEssence: { persuasion: 'social', deception: 'social', culture: 'smarts', athletics: 'strength', brawn: 'strength', conditioning: 'strength', animalHandling: 'social', might: 'strength', targeting: 'speed', technology: 'smarts', science: 'smarts', acrobatics: 'speed', alertness: 'smarts', survival: 'smarts' },
    actorReach: { small: 2, common: 5, large: 5, huge: 10 },
    availabilityDifficulties: { automatic: 0, standard: 0, limited: 10, restricted: 15, prototype: 20, unique: 25, theoretical: 30, other: 0 },
    weaponRequirementShiftLadder: ['none', 'd2', 'd4', 'd6', 'd8', 'd10', 'd12', '2d8', '3d6'],
  } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuidSync = uuid => byUuid.get(uuid) ?? null;
  global.fromUuid = async uuid => byUuid.get(uuid) ?? null;
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, escapeHTML: s => s, randomID: () => `r${nextId++}` },
  };
  lazy.angrySnagSkill = null;
  lazy.getLedger = null;
  lazy.getEnvironment = null;
  lazy.getTerrain = null;
});

// The checks and world lookups essence20.mjs registers, as stand-ins.
let onLand = true;
let place = { terrain: null, environment: 'normal' };
registerCheck('onLand', () => onLand);
registerCheck('favoriteWeaponRolled', (actor, option, ctx) => {
  const perk = actor.items.contents.find(item => item.name == 'Favorite Weapon');
  return !!perk && !!ctx?.item && ctx.item.flags?.essence20?.parentId == perk.system.choice;
});
setWorldLookups({ terrain: () => place.terrain, environment: () => place.environment });
beforeEach(() => {
  onLand = true;
  place = { terrain: null, environment: 'normal' };
});

test('the slC10 rules validate', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules ?? []) {
      expect([file, validateRule(rule)]).toEqual([file, []]);
    }
  }
});

/* -------------------------------------------- */
/*  Tags and checks                              */
/* -------------------------------------------- */

describe('Angry (Hang-Up): a Snag on the Skill picked this scene', () => {
  test('the chosen Skill only, labelled Angry', () => {
    const actor = makeActor([packItem(FILES.angry)]);
    lazy.angrySnagSkill = () => 'deception';
    expect(ruleRollSources(actor, null, { rolledSkill: 'deception' }).sources).toEqual([expect.objectContaining({ label: 'Angry', snag: true })]);
    expect(ruleRollSources(actor, null, { rolledSkill: 'culture' }).sources).toEqual([]);
    lazy.angrySnagSkill = () => null;
    expect(ruleRollSources(actor, null, { rolledSkill: 'deception' }).sources).toEqual([]);
  });

  test('a Matured-ignored Hang-Up does nothing', () => {
    const actor = makeActor([packItem(FILES.angry, { flags: { essence20: { maturedIgnored: true } } })]);
    lazy.angrySnagSkill = () => 'deception';
    expect(ruleRollSources(actor, null, { rolledSkill: 'deception' }).sources).toEqual([]);
  });
});

describe('Fast Tracking: Edge on a Contingency attack with the Favorite Weapon', () => {
  const setup = () => {
    const weapon = makeItem({ type: 'weapon', name: 'Rifle', system: { equipped: true } });
    const other = makeItem({ type: 'weapon', name: 'Knife', system: { equipped: true } });
    const favorite = makeItem({ type: 'perk', name: 'Favorite Weapon', system: { choice: weapon.id }, flags: { core: { sourceId: 'Compendium.essence20.transformers_one_sourcebook.Item.favorite' } } });
    const shot = makeItem({ type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: {} });
    const stab = makeItem({ type: 'weaponEffect', flags: { essence20: { parentId: other.id } }, system: {} });
    const actor = makeActor([packItem(FILES.fastTracking), weapon, other, favorite, shot, stab]);
    return { actor, shot, stab };
  };

  test('offered only on the Favorite Weapon\'s attacks', () => {
    const { actor, shot, stab } = setup();
    expect(ruleDialogSwitches(actor, { item: stab, isAttack: true })).toEqual([]);
    expect(ruleDialogSwitches(actor, { item: shot, isAttack: true })).toEqual([expect.objectContaining({ type: 'checkbox', value: false })]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'targeting' })).toEqual([]);
  });

  test('pre-ticked off its own turn with a Contingency logged; never remembered', () => {
    const { actor, shot } = setup();
    const fast = () => ruleDialogSwitches(actor, { item: shot, isAttack: true }).find(s => /Fast Tracking/.test(s.label));
    expect(fast().value).toBe(false);
    game.combat = { id: 'c', started: true, combatant: { actor: { id: 'someone-else' } } };
    lazy.getLedger = () => ({ log: [{ namedKey: 'contingency' }] });
    expect(fast().value).toBe(true);
    game.combat.combatant.actor.id = actor.id;
    expect(fast().value).toBe(false);
  });
});

describe('Environmental Warrior: ↑1 on attacks where a Survival Specialization fits', () => {
  const warrior = () => makeActor([packItem(FILES.environmentalWarrior)], { system: { skills: { survival: { specializations: { f: { name: 'Forests' } } } } } });
  const attack = { item: { type: 'weaponEffect', system: {} }, isAttack: true };

  test('automatic when the terrain matches, nothing when it doesn\'t', () => {
    const actor = warrior();
    lazy.getTerrain = () => 'woodlands';
    lazy.getEnvironment = () => 'normal';
    expect(ruleRollSources(actor, null, attack).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    lazy.getTerrain = () => 'desert';
    expect(ruleRollSources(actor, null, attack).sources).toEqual([]);
    expect(ruleDialogSwitches(actor, attack)).toEqual([]);
  });

  test('an untagged scene offers an unticked switch, never remembered; not on non-attacks', () => {
    const actor = warrior();
    actor.flags.essence20.ruleSwitches = { [`rule-${actor.items.contents[0].id}-0`]: true };
    const offered = ruleDialogSwitches(actor, attack);
    expect(offered).toEqual([expect.objectContaining({ type: 'checkbox', value: false })]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'survival' })).toEqual([]);
  });
});

describe('Layered Armor: +1 on Persuasion (Leadership) while worn', () => {
  test('a flat +1, not a shift', async () => {
    const armor = packItem(FILES.layeredArmor, { system: { equipped: true } });
    const actor = makeActor([armor], { system: { skills: { persuasion: { specializations: { leadership: { name: 'Leadership' } } } } } });
    const options = { shiftUp: 0, ext: {} };
    await runApplyDialog(actor, options, { rolledSkill: 'persuasion', dataset: { specializationKey: 'leadership' } });
    expect(options.skillEffectModifierBonus).toBe(1);
    expect(options.shiftUp).toBe(0);
    const plain = { ext: {} };
    await runApplyDialog(actor, plain, { rolledSkill: 'persuasion', dataset: {} });
    expect(plain.skillEffectModifierBonus).toBeUndefined();
    armor.system.equipped = false;
    rebuildIndex(actor);
    const off = { ext: {} };
    await runApplyDialog(actor, off, { rolledSkill: 'persuasion', dataset: { specializationName: 'Leadership' } });
    expect(off.skillEffectModifierBonus).toBeUndefined();
  });
});

describe('Seafarer (Hang-Up): a Snag resisting poison or illness on land', () => {
  const save = { riderSpec: JSON.stringify({ kind: 'save', spec: { title: 'Toxic gas', damage: { value: 1, type: 'poison' } } }) };
  const sailor = () => makeActor([packItem(FILES.seafarerHangUp)]);

  test('automatic on a poison save on land; the dialog switch on other Strength resist tests', () => {
    const actor = sailor();
    expect(ruleRollSources(actor, null, { rolledSkill: 'conditioning', dataset: save }).sources).toEqual([expect.objectContaining({ label: 'Seafarer', snag: true })]);
    const illness = { riderSpec: JSON.stringify({ kind: 'save', spec: { title: 'Plague', status: 'sick' } }) };
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics', dataset: illness }).sources).toHaveLength(1);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'conditioning', dataset: save })).toEqual([]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'brawn', dataset: {} })).toEqual([expect.objectContaining({ value: false })]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'culture', dataset: {} })).toEqual([]);
    const plain = { riderSpec: JSON.stringify({ kind: 'save', spec: { title: 'Rockslide' } }) };
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics', dataset: plain }).sources).toEqual([]);
  });

  test('nothing off land', () => {
    const actor = sailor();
    onLand = false;
    expect(ruleRollSources(actor, null, { rolledSkill: 'conditioning', dataset: save }).sources).toEqual([]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'brawn', dataset: {} })).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Defenses                                     */
/* -------------------------------------------- */

describe('Exposure clothes: +2 Toughness in the cold or the desert, not against attacks', () => {
  const dressed = (...files) => makeActor(files.map(file => packItem(file, { system: { equipped: true } })), {
    system: { defenses: { toughness: { total: 10, string: '10' }, cleverness: { total: 10, string: '10' } } },
  });

  test('the sheet shows +2 while exposed; an attack takes it back off', () => {
    const actor = dressed(FILES.arcticGij);
    place.environment = 'extremeCold';
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(12);
    expect(actor.system.defenses.toughness.string).toBe('10 + 2 (Arctic Expedition Clothes)');
    expect(lateDefenseAdjust(makeActor(), actor, 'toughness', {})).toBe(-2);
    expect(lateDefenseAdjust(makeActor(), actor, 'evasion', {})).toBe(0);
  });

  test('arctic terrain counts as cold; desert terrain or Extreme Heat for the desert clothes; nothing elsewhere', () => {
    place.terrain = 'arctic';
    const mlp = dressed(FILES.arcticMlp);
    ruleDerived(mlp);
    expect(mlp.system.defenses.toughness.total).toBe(12);
    place = { terrain: 'desert', environment: 'normal' };
    for (const file of [FILES.desertGij, FILES.desertMlp, FILES.desertGear]) {
      const actor = dressed(file);
      ruleDerived(actor);
      expect(actor.system.defenses.toughness.total).toBe(12);
    }

    place = { terrain: 'urban', environment: 'normal' };
    const town = dressed(FILES.arcticGij, FILES.desertGear);
    ruleDerived(town);
    expect(town.system.defenses.toughness.total).toBe(10);
    expect(lateDefenseAdjust(makeActor(), town, 'toughness', {})).toBe(0);
  });

  test('two that apply at once still give +2 (and take back 2)', () => {
    place = { terrain: 'desert', environment: 'extremeCold' };
    const actor = dressed(FILES.arcticGij, FILES.desertGear);
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(12);
    expect(lateDefenseAdjust(makeActor(), actor, 'toughness', {})).toBe(-2);
  });
});

describe('Business: +2 Cleverness against StrexCorp agents', () => {
  test('by name or a creature tag starting "strex"', () => {
    const actor = makeActor([packItem(FILES.business, { system: { equipped: true } })]);
    expect(lateDefenseAdjust(makeActor([], { name: 'StrexCorp Agent' }), actor, 'cleverness', {})).toBe(2);
    expect(lateDefenseAdjust(makeActor([], { name: 'Cecil' }), actor, 'cleverness', {})).toBe(0);
    expect(lateDefenseAdjust(makeActor([], { name: 'Kevin', system: { creatureTags: 'strexcorp' } }), actor, 'cleverness', {})).toBe(2);
    expect(lateDefenseAdjust(makeActor([], { name: 'StrexCorp Agent' }), actor, 'toughness', {})).toBe(0);
    // Through the extension registry too, the way riderDefenseAdjust asks.
    expect(extDefenseAdjust(makeActor([], { name: 'StrexCorp Agent' }), actor, 'cleverness', { difficulty: 10 })).toBe(2);
  });
});

/* -------------------------------------------- */
/*  Refs: rolled item, other item, Reach          */
/* -------------------------------------------- */

describe('Holographic Sights: hands back a multi-target Targeting effect\'s ↓', () => {
  test('↑ equal to the effect\'s own ↓, on the upgraded weapon only', () => {
    const weapon = makeItem({ type: 'weapon', system: { equipped: true } });
    const sights = packItem(FILES.holographic, { flags: { essence20: { parentId: weapon.id } } });
    const multi = makeItem({ type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: { numTargets: 2, shiftDown: 1, classification: { skill: 'targeting' } } });
    const single = makeItem({ type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: { numTargets: 1, shiftDown: 1, classification: { skill: 'targeting' } } });
    const actor = makeActor([weapon, sights, multi, single]);
    expect(ruleRollSources(actor, null, { item: multi, isAttack: true }).sources).toEqual([expect.objectContaining({ label: 'Holographic Sights', shiftUp: 1 })]);
    expect(ruleRollSources(actor, null, { item: single, isAttack: true }).sources).toEqual([]);
    multi.system.shiftDown = 3;
    expect(ruleRollSources(actor, null, { item: multi, isAttack: true }).sources[0].shiftUp).toBe(3);
  });
});

describe('Larger Than Life and Contort: melee Reach', () => {
  const claw = (reach, multiplier = 1) => makeItem({ type: 'weaponEffect', system: { classification: { style: 'melee' }, totalReach: reach, range: { reachMultiplier: multiplier } } });

  test('Larger Than Life: at least a Large creature\'s Reach (times the multiplier)', () => {
    const small = claw(2);
    const long = claw(2, 2);
    const actor = makeActor([packItem(FILES.largerThanLife), small, long], { type: 'npc', system: { size: 'small' } });
    ruleDerived(actor);
    expect(small.system.totalReach).toBe(5);
    expect(long.system.totalReach).toBe(10);
  });

  test('Contort: the Use doubles Reach until the end of the turn (one doubling), a second press stops', async () => {
    const punch = claw(5);
    const perk = packItem(FILES.contort);
    const actor = makeActor([perk, punch], { system: { size: 'common' } });
    await runUse(perk, async () => true, { ask: async () => 0 });
    expect(actor.flags.essence20.ruleMarks.contort).toBeTruthy();
    rebuildIndex(actor);
    ruleDerived(actor);
    expect(punch.system.totalReach).toBe(10);
    ruleDerived(actor);
    expect(punch.system.totalReach).toBe(10);
    await runUse(perk, async () => true, { ask: async () => 0 });
    expect(actor.flags.essence20.ruleMarks.contort).toBeUndefined();
  });

  test('Contort in combat pays a Move action or two Free actions', async () => {
    const perk = packItem(FILES.contort);
    const actor = makeActor([perk, claw(5)], { system: { size: 'common' } });
    game.combat = { id: 'c', started: true, round: 1, turn: 0, turns: [] };
    await runUse(perk, async () => true, { ask: async () => 1 });
    expect(spend).toHaveBeenCalledTimes(2);
    expect(spend.mock.calls.map(call => call[1])).toEqual(['free', 'free']);
    expect(actor.flags.essence20.ruleMarks.contort).toBeTruthy();
  });
});

describe('Balance and Compensation: ranged External weapons\' requirements two dice lower', () => {
  test('never below d2; melee and Integrated weapons untouched', () => {
    const ranged = (req, hardpoint = 'external', style = 'ranged') => {
      const weapon = makeItem({ type: 'weapon', system: { hardpoint: { type: hardpoint }, requirements: { shift: req } } });
      const effect = makeItem({ type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: { classification: { style } } });
      return [weapon, effect];
    };

    const [d6, d6e] = ranged('d6');
    const [d4, d4e] = ranged('d4');
    const [none, nonee] = ranged('none');
    const [inner, innere] = ranged('d8', 'integrated');
    const [club, clube] = ranged('d8', 'external', 'melee');
    const actor = makeActor([packItem(FILES.balance), d6, d6e, d4, d4e, none, nonee, inner, innere, club, clube]);
    ruleItemLadders(actor);
    expect([d6, d4, none].map(w => w.system.effectiveBrawnReq)).toEqual(['d2', 'd2', 'none']);
    expect(inner.system.effectiveBrawnReq).toBeUndefined();
    expect(club.system.effectiveBrawnReq).toBeUndefined();
    const [d8, d8e] = ranged('d8');
    d8.system.effectiveBrawnReq = 'd8';
    const second = makeActor([packItem(FILES.balance), d8, d8e]);
    ruleItemLadders(second);
    expect(d8.system.effectiveBrawnReq).toBe('d4');
  });
});

describe('Over Brawn, The Heavy, Pack Mule: Brawn against equipment requirements', () => {
  test('ignored, +2, +2 (Pack Mule once, also for carrying)', () => {
    expect(ruleBrawnBonus(makeActor([packItem(FILES.overBrawn)]))).toBe(Infinity);
    expect(ruleBrawnBonus(makeActor([packItem(FILES.theHeavy)]))).toBe(2);
    expect(ruleBrawnBonus(makeActor([packItem(FILES.packMuleTf)]))).toBe(2);
    expect(ruleBrawnBonus(makeActor([packItem(FILES.theHeavy), packItem(FILES.packMuleGij)]))).toBe(4);
    expect(ruleBrawnBonus(makeActor([packItem(FILES.packMuleGij), packItem(FILES.packMuleTf)]))).toBe(2);
    expect(ruleBrawnBonus(makeActor([packItem(FILES.theHeavy), packItem(FILES.packMuleGij)]), 'carrying')).toBe(2);
    expect(ruleBrawnBonus(makeActor([packItem(FILES.overBrawn)]), 'carrying')).toBe(0);
  });
});

/* -------------------------------------------- */
/*  Dialog                                       */
/* -------------------------------------------- */

describe('Dog Person', () => {
  test('↑1 and an Animal Handling Specialization against a dog or coyote', async () => {
    const actor = makeActor([packItem(FILES.dogPerson)]);
    const dog = makeActor([], { name: 'Feral Dog' });
    target(dog);
    expect(ruleRollSources(actor, dog, { rolledSkill: 'persuasion' }).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    const { ruleSpecializes } = await import('./adapter.mjs');
    expect(ruleSpecializes(actor, 'animalHandling', null, {})).toBe(true);
    expect(ruleSpecializes(actor, 'persuasion', null, {})).toBe(false);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'persuasion' })).toEqual([]);
    const coyotes = makeActor([], { name: 'Bob', system: { creatureTags: 'coyotes' } });
    expect(ruleRollSources(actor, coyotes, { rolledSkill: 'persuasion' }).sources).toHaveLength(1);
  });

  test('with no dog targeted, an unticked switch: ↑1, and Specialized on Animal Handling', async () => {
    const actor = makeActor([packItem(FILES.dogPerson)]);
    const offered = ruleDialogSwitches(actor, { rolledSkill: 'animalHandling' });
    expect(offered).toEqual([expect.objectContaining({ value: false })]);
    const options = { shiftUp: 0, ext: { [offered[0].name]: true } };
    await runApplyDialog(actor, options, { rolledSkill: 'animalHandling' });
    expect(options).toMatchObject({ shiftUp: 1, isSpecialized: true });
    const other = { shiftUp: 0, ext: { [offered[0].name]: true } };
    await runApplyDialog(actor, other, { rolledSkill: 'persuasion' });
    expect(other.shiftUp).toBe(1);
    expect(other.isSpecialized).toBeFalsy();
  });
});

describe('Third Eye: ignore the first ↓1 on a vision test', () => {
  test('ticked, one downshift comes off (never below none)', async () => {
    const actor = makeActor([packItem(FILES.thirdEye)]);
    const [toggle] = ruleDialogSwitches(actor, { rolledSkill: 'alertness' });
    expect(toggle.value).toBe(false);
    const options = { shiftDown: 2, ext: { [toggle.name]: true } };
    await runApplyDialog(actor, options, { rolledSkill: 'alertness' });
    expect(options.shiftDown).toBe(1);
    const none = { shiftDown: 0, ext: { [toggle.name]: true } };
    await runApplyDialog(actor, none, { rolledSkill: 'alertness' });
    expect(none.shiftDown).toBe(0);
    const off = { shiftDown: 2, ext: {} };
    await runApplyDialog(actor, off, { rolledSkill: 'alertness' });
    expect(off.shiftDown).toBe(2);
  });
});

describe('Tenacity', () => {
  test('Edge on a save card\'s roll', () => {
    const actor = makeActor([packItem(FILES.tenacity)]);
    const save = { riderSpec: JSON.stringify({ kind: 'save', spec: {} }) };
    expect(ruleRollSources(actor, null, { rolledSkill: 'conditioning', dataset: save }).sources).toEqual([expect.objectContaining({ label: 'Tenacity', edge: true })]);
    expect(ruleRollSources(actor, null, { rolledSkill: 'conditioning', dataset: {} }).sources).toEqual([]);
  });

  test('turn start: a card offers to end what runs out this turn (others\' marks, last-round Conditions)', async () => {
    const actor = makeActor([packItem(FILES.tenacity)], { flags: { riderMarks: [{ combatId: 'c', untilRound: 3, untilTurn: 1, by: 'Actor.x', kind: 'k', label: 'Pinned' }] } });
    game.combat = { id: 'c', round: 3, turn: 1, started: true };
    game.i18n = { has: () => true, localize: k => k, format: (k, d) => `${k} ${JSON.stringify(d)}` };
    await fireTriggers(actor, 'turnStart');
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('rulesEndExpiring');
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('Pinned');
    ChatMessage.create.mockClear();
    game.combat.turn = 2;
    await fireTriggers(actor, 'turnStart');
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Batch 3: marks that carry rules, Defenses     */
/* -------------------------------------------- */

const chat = () => ChatMessage.create.mock.calls.map(call => call[0].content).join('\n');
const cast = (caster, spell, outcome = 'success') => fireTriggers(caster, 'afterRoll', { roll: { item: spell }, outcome, facts: {} });

describe('Waterrunning: the target (or the caster) gets the ↓1 sharp-turn switch on Acrobatics this scene', () => {
  test('a successful cast marks the target; its Acrobatics rolls offer the switch, unticked', async () => {
    const spell = packItem(FILES.waterrunning);
    const caster = makeActor([spell], { name: 'Twilight' });
    const pony = makeActor([], { name: 'Rarity' });
    target(pony);
    await cast(caster, spell);
    expect(pony.flags.essence20.ruleMarks.waterrunning).toMatchObject({ by: caster.uuid, until: 'scene' });
    const offered = ruleDialogSwitches(pony, { rolledSkill: 'acrobatics' });
    expect(offered).toEqual([expect.objectContaining({ type: 'checkbox', value: false, label: 'Sharp turn or sudden stop on liquid (Waterrunning ↓1)' })]);
    expect(ruleDialogSwitches(pony, { rolledSkill: 'athletics' })).toEqual([]);
    const options = { shiftDown: 0, ext: { [offered[0].name]: true } };
    await runApplyDialog(pony, options, { rolledSkill: 'acrobatics' });
    expect(options.shiftDown).toBe(1);
    sceneEpoch = 2;
    expect(ruleDialogSwitches(pony, { rolledSkill: 'acrobatics' })).toEqual([]);
  });

  test('no target: the caster; a failed cast: nobody', async () => {
    const spell = packItem(FILES.waterrunning);
    const caster = makeActor([spell]);
    await cast(caster, spell, 'failure');
    expect(caster.flags.essence20.ruleMarks).toBeUndefined();
    await cast(caster, spell);
    expect(caster.flags.essence20.ruleMarks.waterrunning).toBeTruthy();
    expect(ruleDialogSwitches(caster, { rolledSkill: 'acrobatics' })).toHaveLength(0);
  });
});

describe('Laser Designator: ↑2 on anyone\'s Targeting against the designated creature this scene', () => {
  test('the Use designates the target; others\' Targeting rolls against it get ↑2', async () => {
    const { extRollSources } = await import('../helpers/extensions.mjs');
    const designator = packItem(FILES.laserDesignator);
    const spotter = makeActor([designator], { name: 'Flint' });
    const tank = makeActor([], { name: 'HISS' });
    target(tank);
    await runUse(designator, async () => true);
    expect(tank.flags.essence20.ruleMarks.laserDesignated).toMatchObject({ by: spotter.uuid, until: 'scene' });
    const gunner = makeActor([], { name: 'Breaker' });
    const labels = ctx => extRollSources(gunner, tank, ctx).sources.filter(s => /Laser Designator/.test(s.label));
    expect(labels({ rolledSkill: 'targeting' })).toEqual([expect.objectContaining({ shiftUp: 2 })]);
    expect(labels({ rolledSkill: 'might' })).toEqual([]);
    expect(extRollSources(tank, tank, { rolledSkill: 'targeting' }).sources.filter(s => /Laser/.test(s.label))).toEqual([]);
    sceneEpoch = 2;
    expect(labels({ rolledSkill: 'targeting' })).toEqual([]);
  });

  test('no target: nothing designated', async () => {
    const designator = packItem(FILES.laserDesignator);
    makeActor([designator]);
    await runUse(designator, async () => true);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe('Demolecularization Gun: a hit target is demolecularized for the scene', () => {
  test('Edge on anyone\'s Sharp attacks against it', async () => {
    const { extRollSources } = await import('../helpers/extensions.mjs');
    const gun = packItem(FILES.demolecularizationGun, { system: { equipped: true } });
    const shot = makeItem({ type: 'weaponEffect', flags: { essence20: { parentId: gun.id } }, system: { damageType: 'energy' } });
    const shooter = makeActor([gun, shot], { name: 'Shockwave' });
    const victim = makeActor([], { name: 'Optimus' });
    await fireTriggers(shooter, 'hit', { roll: { item: shot, isAttack: true }, outcome: 'success', targets: [victim] });
    expect(victim.flags.essence20.ruleMarks.demolecularized).toMatchObject({ by: shooter.uuid });
    expect(chat()).toContain('Optimus is partially demolecularized');
    const edge = item => extRollSources(makeActor(), victim, { item, isAttack: true }).sources.filter(s => s.label == 'Demolecularized');
    expect(edge({ type: 'weaponEffect', system: { damageType: 'sharp' } })).toEqual([expect.objectContaining({ edge: true })]);
    expect(edge({ type: 'weaponEffect', system: { damageType: 'blunt', secondaryDamage: { type: 'sharp' } } })).toHaveLength(1);
    expect(edge({ type: 'weaponEffect', system: { damageType: 'blunt' } })).toEqual([]);
    sceneEpoch = 2;
    expect(edge({ type: 'weaponEffect', system: { damageType: 'sharp' } })).toEqual([]);
  });

  test('another weapon\'s hit marks nothing', async () => {
    const gun = packItem(FILES.demolecularizationGun, { system: { equipped: true } });
    const knife = makeItem({ type: 'weaponEffect', system: {} });
    const shooter = makeActor([gun, knife]);
    const victim = makeActor();
    await fireTriggers(shooter, 'hit', { roll: { item: knife, isAttack: true }, outcome: 'success', targets: [victim] });
    expect(victim.flags.essence20.ruleMarks).toBeUndefined();
  });
});

describe('Cage: prisoners up to capacity, ↓2 to escape, and a focus Snag for one roll', () => {
  test('imprison (one in Bot Mode), escape tests at ↓2, focus Snag used up by one roll, release', async () => {
    const cage = packItem(FILES.cage);
    const captor = makeActor([cage], { name: 'Megatron', system: { isTransformed: false } });
    const one = makeActor([], { name: 'Spike' });
    const two = makeActor([], { name: 'Carly' });
    target(one);
    await runUse(cage, async () => true, { ask: async () => 0 });
    expect(one.flags.essence20.ruleMarks.caged).toMatchObject({ by: captor.uuid });
    target(two);
    const full = await runUse(cage, async () => true, { ask: async () => 0 });
    expect(two.flags.essence20.ruleMarks?.caged).toBeUndefined();
    expect(full).toContain('The Cage is full.');

    expect(ruleRollSources(one, null, { rolledSkill: 'brawn' }).sources).toEqual([expect.objectContaining({ label: 'Escaping the Cage (↓2)', shiftDown: 2 })]);
    expect(ruleRollSources(one, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);

    // Focus (a Free action): the next escape roll is Snagged, then the focus is spent.
    await runUse(cage, async () => true, { ask: async (step, options) => options.findIndex(o => /Focus/.test(o.label)) });
    expect(spend).toHaveBeenCalledWith(captor, 'free', expect.anything());
    const focused = ruleRollSources(one, null, { rolledSkill: 'infiltration' });
    expect(focused.sources.map(s => s.label)).toEqual(['Escaping the Cage (↓2)', 'The captor focuses on you (Cage: Snag)']);
    expect(focused.consumes).toEqual([{ ext: 'rulesMark', actorUuid: one.uuid, key: 'cageFocus' }]);

    // Release.
    await runUse(cage, async () => true, { ask: async (step, options) => options.findIndex(o => /Release/.test(o.label)) });
    expect(one.flags.essence20.ruleMarks.caged).toBeUndefined();
    expect(ruleRollSources(one, null, { rolledSkill: 'brawn' }).sources).toEqual([]);
  });

  test('in Alt Mode: the Alt Mode\'s Crew rating, +4 with Extra Crew Capacity', async () => {
    const cage = packItem(FILES.cage);
    const mode = makeItem({ type: 'altMode', system: { altModeCrew: 1 } });
    const extra = makeItem({ type: 'gear', flags: { core: { sourceId: 'Compendium.essence20.tf_crb.Item.PCwgQWKmTOl8va3I' } } });
    const captor = makeActor([cage, mode, extra], { system: { isTransformed: true } });
    captor.system.altModeId = mode.id;
    const prisoners = [1, 2, 3, 4, 5, 6].map(i => makeActor([], { name: `P${i}` }));
    for (const prisoner of prisoners) {
      target(prisoner);
      await runUse(cage, async () => true, { ask: async () => 0 });
    }

    expect(prisoners.filter(p => p.flags.essence20.ruleMarks?.caged).length).toBe(5);
  });
});

describe('Diversion', () => {
  test('a success marks the target: Snag attacking the diverter, Edge for the diverter\'s allies until it goes for the diverter', async () => {
    const { extRollSources } = await import('../helpers/extensions.mjs');
    const perk = packItem(FILES.diversion);
    const token = disposition => ({ document: { disposition }, center: { x: 0, y: 0 } });
    const diverter = makeActor([perk], { name: 'Jazz', token: token(1), system: { skills: {} } });
    const ally = makeActor([], { name: 'Bumblebee', token: token(1) });
    const foe = makeActor([], { name: 'Starscream', token: token(-1), system: { defenses: { willpower: { total: 12 }, cleverness: { total: 15 } } } });
    target(foe);
    rollTest.mockResolvedValueOnce({ success: true });
    chooseSelect.mockResolvedValueOnce('intimidation');
    await runUse(perk, async () => true, { ask: async () => 1 });
    expect(rollTest).toHaveBeenCalledWith(diverter, 'intimidation', 15, expect.anything());
    expect(foe.flags.essence20.ruleMarks.diversion).toMatchObject({ by: diverter.uuid, until: 'endOfNextRound' });

    const attack = { item: { type: 'weaponEffect', system: {} }, isAttack: true };
    expect(ruleRollSources(foe, diverter, attack).sources).toEqual([expect.objectContaining({ snag: true })]);
    expect(ruleRollSources(foe, ally, attack).sources).toEqual([]);
    const edge = roller => extRollSources(roller, foe, attack).sources.filter(s => /Diverted target/.test(s.label));
    expect(edge(ally)).toEqual([expect.objectContaining({ edge: true })]);
    expect(edge(diverter)).toEqual([]);
    expect(edge(makeActor([], { token: token(-1) }))).toEqual([]);

    // It went for the diverter: the allies' Edge is off.
    await fireTriggers(foe, 'miss', { roll: { item: attack.item, isAttack: true }, outcome: 'failure', targets: [diverter] });
    expect(edge(ally)).toEqual([]);
  });

  test('a failure marks nothing; the cost is paid only once the Skill and Defense are picked', async () => {
    const perk = packItem(FILES.diversion);
    const diverter = makeActor([perk]);
    const foe = makeActor([], { system: { defenses: { willpower: { total: 12 }, cleverness: { total: 15 } } } });
    target(foe);
    const pay = jest.fn(async () => true);
    rollTest.mockResolvedValueOnce({ success: false });
    chooseSelect.mockResolvedValueOnce('deception');
    await runUse(perk, pay, { ask: async () => 0 });
    expect(pay).toHaveBeenCalledWith('standard');
    expect(rollTest).toHaveBeenCalledWith(diverter, 'deception', 12, expect.anything());
    expect(foe.flags.essence20.ruleMarks).toBeUndefined();
    pay.mockClear();
    chooseSelect.mockResolvedValueOnce(null);
    await runUse(perk, pay, { ask: async () => 0 });
    expect(pay).not.toHaveBeenCalled();
  });
});

describe('Stoic', () => {
  test('in combat, a Move action: Evasion down, Toughness attacks meet Evasion, allies\' Free actions next turn', async () => {
    const perk = packItem(FILES.stoic);
    const holder = makeActor([perk], { name: 'Ultra Magnus', system: { defenses: { evasion: { total: 14, string: '14' }, toughness: { total: 16, string: '16' } } } });
    const ally = makeActor([], { name: 'Kup' });
    game.combat = { id: 'c', started: true, round: 1, turn: 0, turns: [{ actor: holder }, { actor: ally }], combatants: { contents: [{ actor: holder }, { actor: ally }] }, combatant: { actor: holder } };
    const pay = jest.fn(async () => true);
    await runUse(perk, pay, { ask: async () => 1 });
    expect(pay).toHaveBeenCalledWith('move');
    expect(holder.flags.essence20.ruleMarks.stoic).toMatchObject({ count: 2, until: 'nextTurn' });
    rebuildIndex(holder);
    ruleDerived(holder);
    expect(holder.system.defenses.evasion.total).toBe(12);
    expect(holder.system.defenses.evasion.string).toBe('14 - 2 (Stoic)');
    expect(lateDefenseAdjust(makeActor(), holder, 'toughness', {})).toBe(-4);
    expect(lateDefenseAdjust(makeActor(), holder, 'evasion', {})).toBe(0);
    expect(setNextTurn).toHaveBeenCalledWith(ally, { grant: { free: 2 } }, perk.name);
    expect(setNextTurn).not.toHaveBeenCalledWith(holder, expect.anything(), expect.anything());

    // Its next turn: over.
    game.combat.round = 2;
    expect(lateDefenseAdjust(makeActor(), holder, 'toughness', {})).toBe(0);
  });

  test('not offered outside combat', async () => {
    const perk = packItem(FILES.stoic);
    makeActor([perk]);
    const pay = jest.fn(async () => true);
    expect(await runUse(perk, pay, { ask: async () => 0 })).toBeNull();
    expect(pay).not.toHaveBeenCalled();
  });
});

describe('Thorn Warlord', () => {
  let form = true;
  beforeAll(() => {
    registerCheck('monsterForm', () => form);
  });

  test('in Monster Form, Acid attacks against Toughness meet Evasion', () => {
    form = true;
    const warlord = makeActor([packItem(FILES.thornWarlord)]);
    const defender = makeActor([], { system: { defenses: { toughness: { total: 18 }, evasion: { total: 12 } } } });
    const acid = { item: { type: 'weaponEffect', system: { damageType: 'acid' } } };
    expect(lateDefenseAdjust(warlord, defender, 'toughness', acid)).toBe(-6);
    expect(lateDefenseAdjust(warlord, defender, 'evasion', acid)).toBe(0);
    expect(lateDefenseAdjust(warlord, defender, 'toughness', { item: { system: { damageType: 'blunt', secondaryDamage: { type: 'acid' } } } })).toBe(-6);
    expect(lateDefenseAdjust(warlord, defender, 'toughness', { item: { system: { damageType: 'blunt' } } })).toBe(0);
    form = false;
    expect(lateDefenseAdjust(warlord, defender, 'toughness', acid)).toBe(0);
  });

  test('2 Personal Power on hitting a Frightened or Impaired target (never above the maximum)', async () => {
    const warlord = makeActor([packItem(FILES.thornWarlord)], { system: { powers: { personal: { value: 1, max: 5 } } } });
    const scared = makeActor();
    scared.statuses = new Set(['frightened']);
    await fireTriggers(warlord, 'hit', { roll: {}, outcome: 'success', targets: [scared] });
    expect(warlord.system.powers.personal.value).toBe(3);
    const slow = makeActor();
    slow.statuses = new Set(['impaired']);
    warlord.system.powers.personal.value = 4;
    await fireTriggers(warlord, 'hit', { roll: {}, outcome: 'success', targets: [slow] });
    expect(warlord.system.powers.personal.value).toBe(5);
    warlord.system.powers.personal.value = 1;
    await fireTriggers(warlord, 'hit', { roll: {}, outcome: 'success', targets: [makeActor()] });
    expect(warlord.system.powers.personal.value).toBe(1);
  });
});

/* -------------------------------------------- */
/*  Batch 4: Reach, Bump & Run, reactions        */
/* -------------------------------------------- */

describe('Ladder: Bot Mode unarmed Reach x2', () => {
  test('unarmed melee attacks reach twice the Size Reach in Bot Mode only', () => {
    const fist = makeItem({ type: 'weaponEffect', system: { classification: { style: 'melee' }, totalReach: 5 } });
    const sword = makeItem({ type: 'weaponEffect', flags: { essence20: { parentId: 'w' } }, system: { classification: { style: 'melee' }, totalReach: 5 } });
    const bot = makeActor([packItem(FILES.ladder), fist, sword], { system: { canTransform: true, isTransformed: false, size: 'common' } });
    ruleDerived(bot);
    expect(fist.system.totalReach).toBe(10);
    expect(sword.system.totalReach).toBe(5);
    const truck = makeItem({ type: 'weaponEffect', system: { classification: { style: 'melee' }, totalReach: 5 } });
    ruleDerived(makeActor([packItem(FILES.ladder), truck], { system: { canTransform: true, isTransformed: true, size: 'common' } }));
    expect(truck.system.totalReach).toBe(5);
  });
});

describe('Bump & Run', () => {
  test('the ↑1 switch on attacks, never remembered; ticked, its key rides on the roll', async () => {
    const actor = makeActor([packItem(FILES.bumpAndRun)]);
    const attack = { item: { type: 'weaponEffect', system: {} }, isAttack: true };
    const [toggle] = ruleDialogSwitches(actor, attack);
    expect(toggle).toMatchObject({ value: false });
    expect(ruleDialogSwitches(actor, { rolledSkill: 'athletics' })).toEqual([]);
    const options = { shiftUp: 0, ext: { [toggle.name]: true } };
    await applyRuleSwitches(actor, options, attack);
    expect(options).toMatchObject({ shiftUp: 1, ruleKeys: ['bumpAndRun'] });
  });

  test('a Critical Success Stuns the target (not a plain success, not without the switch)', async () => {
    const actor = makeActor([packItem(FILES.bumpAndRun)]);
    const target = makeActor();
    const hit = (outcome, switches) => fireTriggers(actor, 'hit', { roll: { item: { type: 'weaponEffect', system: {} }, isAttack: true, switches }, outcome, facts: {}, targets: [target] });
    await hit('success', ['bumpAndRun']);
    await hit('double', []);
    expect(target.statuses.has('stunned')).toBe(false);
    await hit('double', ['bumpAndRun']);
    expect(target.statuses.has('stunned')).toBe(true);
  });

  test('the spot is noted at the attack; a token still within 10 ft at the turn end is Impaired', async () => {
    let center = { x: 0, y: 0 };
    const token = { document: { disposition: 1 }, get center() {
      return center;
    } };
    const actor = makeActor([packItem(FILES.bumpAndRun)], { token });
    game.combat = { id: 'c', started: true, round: 1, turn: 0, turns: [{ actor }] };
    canvas.grid = { measurePath: ([a, b]) => ({ distance: Math.hypot(b.x - a.x, b.y - a.y) }) };
    await fireTriggers(actor, 'afterRoll', { roll: { item: { type: 'weaponEffect', system: {} }, switches: ['bumpAndRun'] }, outcome: 'any', facts: {} });
    expect(actor.flags.essence20.ruleMarks.bumpRun).toMatchObject({ x: 0, y: 0 });
    center = { x: 5, y: 0 };
    await fireTriggers(actor, 'turnEnd');
    expect(chat()).toContain("didn't move 10 ft");
    expect(actor.flags.essence20.ruleMarks.bumpRun).toBeUndefined();

    ChatMessage.create.mockClear();
    center = { x: 0, y: 0 };
    await fireTriggers(actor, 'afterRoll', { roll: { item: { type: 'weaponEffect', system: {} }, switches: ['bumpAndRun'] }, outcome: 'any', facts: {} });
    center = { x: 20, y: 0 };
    await fireTriggers(actor, 'turnEnd');
    expect(chat()).not.toContain("didn't move 10 ft");
  });
});

describe('Synch Up: an ally\'s miss within range offers an out-of-turn attack, once per turn', () => {
  test('offered to the attacker\'s allies in range of the missed target', async () => {
    const { reactionOffers, pressReaction } = await import('./reactions.mjs');
    const at = (x, disposition) => ({ document: { disposition }, center: { x, y: 0 } });
    canvas.grid = { measurePath: ([a, b]) => ({ distance: Math.abs(b.x - a.x) }) };
    game.combat = { id: 'c', started: true, round: 1, turn: 0, turns: [] };
    const blaster = makeItem({ type: 'weaponEffect', system: { range: { long: 60 } } });
    const commander = makeActor([packItem(FILES.synchUp), blaster], { name: 'Prime', token: at(0, 1) });
    const ally = makeActor([], { name: 'Hot Rod', token: at(10, 1) });
    const foe = makeActor([], { name: 'Megatron', token: at(30, -1) });
    const info = { message: { id: 'm' }, attacker: ally, isAttack: true, total: 8, rows: [{ targetUuid: foe.uuid, success: false, difficulty: 12 }] };
    expect(reactionOffers(info, [commander])).toHaveLength(1);
    expect(reactionOffers({ ...info, rows: [{ targetUuid: foe.uuid, success: true, difficulty: 6 }] }, [commander])).toHaveLength(0);
    foe.getActiveTokens = () => [at(200, -1)];
    expect(reactionOffers(info, [commander])).toHaveLength(0);
    foe.getActiveTokens = () => [at(30, -1)];
    const [offer] = reactionOffers(info, [commander]);
    await pressReaction(info, offer);
    expect(grantBonusAttack).toHaveBeenCalled();
    // Its once-per-turn use is counted, and the button is claimed.
    expect(Object.keys(commander.flags.essence20.ruleUses ?? {})).toHaveLength(1);
    expect(commander.flags.essence20.reactClaims).toHaveLength(1);
  });
});

describe('No Escape: an enemy moving into melee Reach offers an attack', () => {
  test('a whispered button when an enemy\'s move ends inside the Reach, having started outside', async () => {
    const { onMoveToken } = await import('./ext/c/reach.mjs');
    canvas.grid = { size: 100, measurePath: ([a, b]) => ({ distance: Math.abs(b.x - a.x) / 20 }) };
    const sentinelToken = { document: { disposition: 1 }, center: { x: 50, y: 50 } };
    const sentinel = makeActor([packItem(FILES.noEscape)], { name: 'Ironhide', token: sentinelToken, system: { size: 'common' } });
    sentinelToken.actor = sentinel;
    const foe = makeActor([], { name: 'Soundwave', token: { document: { disposition: -1 } } });
    canvas.tokens.placeables = [sentinelToken];
    game.combat = { id: 'c' };
    game.users = { contents: [], filter: () => [], activeGM: { id: 'u' } };
    const move = (fromX, toX) => onMoveToken({ actor: foe }, { origin: { x: fromX, y: 0 }, destination: { x: toX, y: 0 } });
    await move(1000, 100);
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('No Escape');
    ChatMessage.create.mockClear();
    await move(100, 120);
    await move(1000, 900);
    expect(ChatMessage.create).not.toHaveBeenCalled();
    game.combat = null;
    await move(1000, 100);
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe('Energized, Spiked, Energy Field: the attacker takes the ↓ or lets the wearer strike back', () => {
  const wearing = file => {
    const armor = makeItem({ type: 'armor', system: { equipped: true } });
    const upgrade = packItem(file, { flags: { essence20: { parentId: armor.id } } });
    return { armor, actor: makeActor([armor, upgrade], { name: 'Duke' }) };
  };

  const melee = { item: { type: 'weaponEffect', system: { classification: { style: 'melee' }, range: {}, totalReach: 5 } }, isAttack: true };

  test('a select on plain Reach melee attacks at the wearer, ↓ by default', async () => {
    const { extDialogToggles } = await import('../helpers/extensions.mjs');
    CONFIG.E20.actorReach.common = 5;
    const { armor, actor: wearer } = wearing(FILES.spiked);
    const attacker = makeActor([], { name: 'Cobra', system: { size: 'common' } });
    target(wearer);
    const select = extDialogToggles(attacker, melee).find(t => t.type == 'select');
    expect(select).toMatchObject({ label: 'Spiked (Duke)', value: '0' });
    const take = { shiftDown: 0, ext: {} };
    await runApplyDialog(attacker, take, melee);
    expect(take.shiftDown).toBe(1);
    expect(extDialogToggles(attacker, { ...melee, item: { type: 'weaponEffect', system: { classification: { style: 'melee' }, range: { reachMultiplier: 2 } } } }).find(t => t.type == 'select')).toBeUndefined();
    armor.system.equipped = false;
    rebuildIndex(wearer);
    expect(extDialogToggles(attacker, melee).find(t => t.type == 'select')).toBeUndefined();
  });

  test('striking back: a card for the wearer; pressed, Might or Finesse against the better Defense, then a GM damage button', async () => {
    const { actor: wearer } = wearing(FILES.energized);
    const attacker = makeActor([], { name: 'Cobra', system: { size: 'common', defenses: { toughness: { total: 13 }, evasion: { total: 16 } } } });
    target(wearer);
    const { extDialogToggles } = await import('../helpers/extensions.mjs');
    const select = extDialogToggles(attacker, melee).find(t => t.type == 'select');
    const strike = { shiftDown: 0, ext: { [select.name]: '1' } };
    await runApplyDialog(attacker, strike, melee);
    expect(strike.shiftDown).toBe(0);
    const card = ChatMessage.create.mock.calls.find(call => call[0].flags?.essence20?.ruleButton);
    expect(card[0].flags.essence20.ruleButton).toMatchObject({ who: 'owner', targets: [attacker.uuid] });
    const { runSteps, stepContext } = await import('./steps.mjs');
    chooseSelect.mockResolvedValueOnce('fire').mockResolvedValueOnce('finesse');
    rollTest.mockResolvedValueOnce({ success: true });
    const ctx = stepContext({ actor: wearer, item: wearer.items.contents[1], targets: [attacker] });
    await runSteps(card[0].flags.essence20.ruleButton.steps, ctx);
    expect(rollTest).toHaveBeenCalledWith(wearer, 'finesse', 16, expect.anything());
    const gm = ChatMessage.create.mock.calls.map(call => call[0].flags?.essence20?.ruleButton).filter(Boolean).pop();
    expect(gm).toMatchObject({ who: 'gm', label: 'Apply 1 fire damage to Cobra (Energized)' });
  });
});

/* -------------------------------------------- */
/*  Batch 6-9: Hearty Meal, Weapon Enthusiast,    */
/*  Ignite, Deconstruct                          */
/* -------------------------------------------- */

describe('Hearty Meal', () => {
  test('the Use: Culture or Performance at DIF 15; a success gives the cook and every ally 1 temporary Health', async () => {
    const perk = packItem(FILES.heartyMeal);
    const token = disposition => ({ document: { disposition }, center: { x: 0, y: 0 } });
    const cook = makeActor([perk], { name: 'Roadblock', token: token(1), system: { health: { value: 5, max: 10, bonus: 0 } } });
    const ally = makeActor([], { name: 'Duke', token: token(1), system: { health: { value: 5, max: 10, bonus: 1 } } });
    const foe = makeActor([], { name: 'Cobra', token: token(-1), system: { health: { value: 5, max: 10, bonus: 0 } } });
    canvas.tokens.placeables = [cook, ally, foe].map(actor => ({ ...actor.getActiveTokens()[0], actor }));
    canvas.grid = { measurePath: () => ({ distance: 30 }) };
    chooseSelect.mockResolvedValueOnce('performance');
    rollTest.mockResolvedValueOnce({ success: true });
    await runUse(perk, async () => true);
    expect(rollTest).toHaveBeenCalledWith(cook, 'performance', 15, expect.anything());
    expect(cook.system.health.bonus).toBe(1);
    expect(foe.system.health.bonus).toBe(0);
    rollTest.mockResolvedValueOnce({ success: false });
    await runUse(perk, async () => true);
    expect(cook.system.health.bonus).toBe(1);
  });

  test('the heal action: Culture or Performance out of combat, once per mission', async () => {
    const { healSkills } = await import('../helpers/extensions/other2/medic.mjs');
    const { spendActionSkill } = await import('./ext/c/actions.mjs');
    const cook = makeActor([packItem(FILES.heartyMeal)]);
    expect(healSkills(cook, { inCombat: false })).toEqual(['science', 'technology', 'culture', 'performance']);
    expect(healSkills(cook, { inCombat: true })).toEqual(['science', 'technology']);
    await spendActionSkill(cook, 'heal', 'science');
    expect(healSkills(cook, { inCombat: false })).toHaveLength(4);
    await spendActionSkill(cook, 'heal', 'culture');
    expect(healSkills(cook, { inCombat: false })).toEqual(['science', 'technology']);
    expect(healSkills(makeActor(), { inCombat: false })).toEqual(['science', 'technology']);
  });
});

describe('Weapon Enthusiast (Hang-Up): no Lend Assistance with the chosen weapon type', () => {
  test('banked Lend Assistance is set aside for that weapon\'s attacks and put back after', async () => {
    const { runPostRoll } = await import('../helpers/extensions.mjs');
    const hangUp = packItem(FILES.weaponEnthusiastHangUp, { flags: { essence20: { q2WeaponType: 'shotguns' } } });
    hangUp.flags.core.sourceId = 'Compendium.essence20.quartermasters_guide_to_gear.Item.GcMPz5MICXwTzKOq';
    const gun = makeItem({ type: 'weapon', name: 'Pump Shotgun', system: { equipped: true } });
    const blast = makeItem({ type: 'weaponEffect', flags: { essence20: { parentId: gun.id } }, system: {} });
    const knife = makeItem({ type: 'weapon', name: 'Combat Knife', system: { equipped: true } });
    const stab = makeItem({ type: 'weaponEffect', flags: { essence20: { parentId: knife.id } }, system: {} });
    const actor = makeActor([hangUp, gun, blast, knife, stab], { flags: { pendingLendAssistanceShift: { skill: 'targeting' } } });
    await runPreRoll(actor, { skill: 'targeting' }, stab);
    expect(actor.flags.essence20.pendingLendAssistanceShift).toEqual({ skill: 'targeting' });
    await runPreRoll(actor, { skill: 'targeting' }, blast);
    expect(actor.flags.essence20.pendingLendAssistanceShift).toBeUndefined();
    expect(ui.notifications.info).toHaveBeenCalled();
    await runPostRoll(actor, [], {}, {});
    expect(actor.flags.essence20.pendingLendAssistanceShift).toEqual({ skill: 'targeting' });
  });
});

describe('Ignite (and Fireball\'s Edge)', () => {
  const fireAttack = { item: { type: 'weaponEffect', system: { damageType: 'fire' } }, isAttack: true };

  test('a Fire hit sets the target alight, with a card offering to fight the fire or drop and roll', async () => {
    const igniter = makeActor([packItem(FILES.ignite)], { name: 'Firefly' });
    const victim = makeActor([], { name: 'Duke' });
    await fireTriggers(igniter, 'hit', { roll: fireAttack, outcome: 'success', facts: {}, targets: [victim] });
    expect(victim.flags.essence20.ruleMarks.burning).toMatchObject({ by: igniter.uuid, count: 0 });
    const buttons = ChatMessage.create.mock.calls.map(call => call[0].flags?.essence20?.ruleButton).filter(Boolean);
    expect(buttons.map(button => button.who)).toEqual(['targets', 'targets']);
    ChatMessage.create.mockClear();
    await fireTriggers(igniter, 'hit', { roll: fireAttack, outcome: 'success', facts: {}, targets: [victim] });
    expect(ChatMessage.create.mock.calls.filter(call => call[0].flags?.essence20?.ruleButton)).toHaveLength(0);
    const other = makeActor();
    await fireTriggers(igniter, 'hit', { roll: { ...fireAttack, item: { type: 'weaponEffect', system: { damageType: 'blunt' } } }, outcome: 'success', facts: {}, targets: [other] });
    expect(other.flags.essence20.ruleMarks).toBeUndefined();

    // Fighting the fire adds ↓1 to its next attack.
    const { runSteps, stepContext } = await import('./steps.mjs');
    const fight = stepContext({ actor: igniter, item: igniter.items.contents[0], targets: [victim] });
    await runSteps(buttons[0].steps, fight);
    expect(victim.flags.essence20.ruleMarks.burning.count).toBe(1);
    const drop = stepContext({ actor: igniter, item: igniter.items.contents[0], targets: [victim] });
    await runSteps(buttons[1].steps, drop);
    expect(victim.flags.essence20.ruleMarks.burning).toBeUndefined();
    expect(victim.statuses.has('prone')).toBe(true);
  });

  test('at the end of the burning creature\'s turn the igniter rolls Science against its Evasion: a hit burns for 1, a miss puts it out', async () => {
    const { applyDamage } = await import('../helpers/combat.mjs');
    const fireball = makeItem({ type: 'perk', name: 'Fireball', flags: { core: { sourceId: 'Compendium.essence20.cobra_codex.Item.20lv1ecNs4ORVwWu' } } });
    const igniter = makeActor([packItem(FILES.ignite), fireball], { name: 'Firefly' });
    const rolls = [];
    igniter._dice = { rollSkill: jest.fn(async dataset => {
      rolls.push(dataset);
      return { success: rolls.length == 1 };
    }) };
    const victim = makeActor([], { name: 'Duke', system: { defenses: { evasion: { total: 13 } } } });
    await fireTriggers(igniter, 'hit', { roll: fireAttack, outcome: 'success', facts: {}, targets: [victim] });
    victim.flags.essence20.ruleMarks.burning.count = 2;
    await fireTriggers(victim, 'turnEnd');
    expect(rolls[0]).toMatchObject({ skill: 'science', dif: '13', shiftDown: 2, edge: true });
    expect(applyDamage).toHaveBeenCalledWith(victim, 1, 'fire');
    expect(victim.flags.essence20.ruleMarks.burning.count).toBe(0);
    await fireTriggers(victim, 'turnEnd');
    expect(victim.flags.essence20.ruleMarks.burning).toBeUndefined();
    expect(chat()).toContain('The fire on Duke goes out.');
  });
});

describe('Deconstruct', () => {
  test('pick an adjacent enemy\'s item, spend 1 Energon and a Standard action, Technology against its Requisition DIF', async () => {
    const perk = packItem(FILES.deconstruct);
    const scientist = makeActor([perk], { name: 'Perceptor', system: { energon: { normal: { value: 2 } } } });
    const blaster = makeItem({ type: 'weapon', name: 'Blaster', system: { availability: 'restricted' } });
    const kit = makeItem({ type: 'gear', name: 'Medical Kit', system: { availability: 'limited' } });
    const foe = makeActor([blaster, kit], { name: 'Shockwave' });
    target(foe);
    const pay = jest.fn(async () => true);
    chooseSelect.mockResolvedValueOnce(blaster.uuid);
    rollTest.mockResolvedValueOnce({ success: true, crit: false });
    await runUse(perk, pay);
    expect(rollTest).toHaveBeenCalledWith(scientist, 'technology', 15, expect.anything());
    expect(pay).toHaveBeenCalledWith('standard');
    expect(scientist.system.energon.normal.value).toBe(1);
    expect(blaster.flags.essence20.tf2Deconstructed).toMatchObject({ dif: 10 });

    // A Critical Success on a Kit: destroyed.
    chooseSelect.mockResolvedValueOnce(kit.uuid);
    rollTest.mockResolvedValueOnce({ success: true, crit: true });
    await runUse(perk, pay);
    expect(rollTest).toHaveBeenLastCalledWith(scientist, 'technology', 10, expect.anything());
    expect(foe.items.contents).not.toContain(kit);
  });

  test('no Energon: nothing is paid or rolled; a sabotaged item can\'t be picked again', async () => {
    const perk = packItem(FILES.deconstruct);
    makeActor([perk], { system: { energon: { normal: { value: 0 } } } });
    const blaster = makeItem({ type: 'weapon', name: 'Blaster', system: {}, flags: { essence20: { tf2Deconstructed: { dif: 10 } } } });
    const foe = makeActor([blaster]);
    target(foe);
    const pay = jest.fn(async () => true);
    await runUse(perk, pay);
    expect(chooseSelect).not.toHaveBeenCalled();
    expect(pay).not.toHaveBeenCalled();
    blaster.flags.essence20 = {};
    chooseSelect.mockResolvedValueOnce(blaster.uuid);
    await runUse(perk, pay);
    expect(pay).not.toHaveBeenCalled();
    expect(rollTest).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Batch 2: dialog pieces                       */
/* -------------------------------------------- */

describe('History Buff: the Continuum Anomaly check, one die smaller, shown to the GM', () => {
  test('the picked risk\'s die one size smaller (never below d2), as a blind roll with the band', async () => {
    const rolled = [];
    global.Roll = class {
      constructor(formula) {
        this.formula = formula;
      }

      async evaluate() {
        this.total = 7;
        rolled.push(this);
        return this;
      }

      async toMessage(data, options) {
        this.message = { data, options };
      }
    };
    game.i18n = { has: () => true, localize: k => k, format: (k, d) => `${k} ${JSON.stringify(d)}` };
    const perk = packItem(FILES.historyBuff);
    makeActor([perk]);
    await runUse(perk, async () => true, { ask: async () => 3 });
    expect(rolled[0].formula).toBe('1d6');
    expect(rolled[0].message.options).toEqual({ rollMode: 'blindroll' });
    expect(rolled[0].message.data.flavor).toBe('E20.ResAnomalyFlavor {"formula":"1d6","band":"E20.ResAnomalyBand.lasting"}');
    await runUse(perk, async () => true, { ask: async () => 0 });
    await runUse(perk, async () => true, { ask: async () => 1 });
    await runUse(perk, async () => true, { ask: async () => 6 });
    expect(rolled.slice(1).map(roll => roll.formula)).toEqual(['1d2', '1d2', '1d12']);
    delete global.Roll;
  });
});

describe('Subtle Snake: a three-way select on Social tests', () => {
  test('none, ↓1 or a Snag', async () => {
    const actor = makeActor([packItem(FILES.subtleSnake)]);
    const ctx = { rolledSkill: 'persuasion', rolledEssence: 'social' };
    const { extDialogToggles } = await import('../helpers/extensions.mjs');
    const select = extDialogToggles(actor, ctx).find(t => t.type == 'select');
    expect(select.options.map(o => o.label)).toEqual(['E20.Gij3SubtleSnakeNone', 'E20.Gij3SubtleSnakeCobra', 'E20.Gij3SubtleSnakeOutsider']);
    expect(select.value).toBe('0');
    expect(extDialogToggles(actor, { rolledSkill: 'science', rolledEssence: 'smarts' }).some(t => t.name == select.name)).toBe(false);
    const cobra = { shiftDown: 0, ext: { [select.name]: '1' } };
    await runApplyDialog(actor, cobra, ctx);
    expect(cobra).toMatchObject({ shiftDown: 1 });
    expect(cobra.snag).toBeFalsy();
    const outsider = { shiftDown: 0, ext: { [select.name]: '2' } };
    await runApplyDialog(actor, outsider, ctx);
    expect(outsider).toMatchObject({ shiftDown: 0, snag: true });
    const none = { shiftDown: 0, ext: { [select.name]: '0' } };
    await runApplyDialog(actor, none, ctx);
    expect(none).toMatchObject({ shiftDown: 0 });
    expect(none.snag).toBeFalsy();
  });
});

describe('Shadow: the roller\'s ↓2 switch against an Infiltrating holder', () => {
  let infiltrating = true;
  beforeAll(() => {
    registerCheck('infiltrating', () => infiltrating);
  });

  test('offered against the holder, ticked by default on a non-attack Alertness test', async () => {
    infiltrating = true;
    const { extDialogToggles } = await import('../helpers/extensions.mjs');
    const snake = makeActor([packItem(FILES.shadow)], { name: 'Snake' });
    const roller = makeActor();
    expect(extDialogToggles(roller, { rolledSkill: 'alertness' }).filter(t => /Shadow/.test(t.label))).toEqual([]);
    target(snake);
    const [toggle] = extDialogToggles(roller, { rolledSkill: 'alertness' }).filter(t => /Shadow/.test(t.label));
    expect(toggle).toMatchObject({ type: 'checkbox', value: true, label: 'This roll tries to detect Snake (Shadow: ↓2)' });
    expect(extDialogToggles(roller, { rolledSkill: 'technology' }).find(t => /Shadow/.test(t.label)).value).toBe(false);
    expect(extDialogToggles(roller, { rolledSkill: 'alertness', item: { type: 'weaponEffect', system: {} } }).find(t => /Shadow/.test(t.label)).value).toBe(false);
    const options = { shiftDown: 1, ext: { [toggle.name]: true } };
    await runApplyDialog(roller, options, { rolledSkill: 'alertness' });
    expect(options.shiftDown).toBe(3);
    const off = { shiftDown: 0, ext: { [toggle.name]: false } };
    await runApplyDialog(roller, off, { rolledSkill: 'alertness' });
    expect(off.shiftDown).toBe(0);
    infiltrating = false;
    expect(extDialogToggles(roller, { rolledSkill: 'alertness' }).filter(t => /Shadow/.test(t.label))).toEqual([]);
  });
});

describe('Something Is Off: +1 Cleverness per pick (up to 4) when the roller says it\'s a con', () => {
  test('the roller\'s switch on Social or Deception tests; ticked, the holder\'s Cleverness rises', async () => {
    const { extDialogToggles } = await import('../helpers/extensions.mjs');
    const mark = makeActor([1, 2, 3, 4, 5].map(() => packItem(FILES.somethingIsOff)), { name: 'Rarity' });
    const roller = makeActor();
    target(mark);
    const conning = extDialogToggles(roller, { rolledSkill: 'deception' }).filter(t => /Something Is Off/.test(t.label));
    expect(conning).toHaveLength(1);
    expect(conning[0]).toMatchObject({ value: false, label: 'Conning Rarity in a deal (Something Is Off)' });
    expect(extDialogToggles(roller, { rolledSkill: 'persuasion' }).filter(t => /Something Is Off/.test(t.label))).toHaveLength(1);
    expect(extDialogToggles(roller, { rolledSkill: 'athletics' }).filter(t => /Something Is Off/.test(t.label))).toHaveLength(0);
    const options = { ext: { [conning[0].name]: true } };
    await runApplyDialog(roller, options, { rolledSkill: 'deception' });
    expect(lateDefenseAdjust(roller, mark, 'cleverness', { ext: options.ext })).toBe(4);
    expect(lateDefenseAdjust(roller, mark, 'toughness', { ext: options.ext })).toBe(0);
    const lie = { ext: { [conning[0].name]: false } };
    await runApplyDialog(roller, lie, { rolledSkill: 'deception' });
    expect(lateDefenseAdjust(roller, mark, 'cleverness', { ext: lie.ext })).toBe(0);
    const one = makeActor([packItem(FILES.somethingIsOff)], { name: 'Applejack' });
    const once = { ext: {} };
    target(one);
    const [single] = extDialogToggles(roller, { rolledSkill: 'deception' }).filter(t => /Something Is Off/.test(t.label));
    once.ext[single.name] = true;
    await runApplyDialog(roller, once, { rolledSkill: 'deception' });
    expect(lateDefenseAdjust(roller, one, 'cleverness', { ext: once.ext })).toBe(1);
  });
});

describe('Explosive Engineer (Hang-Up): the Perk\'s Science / Technology swap stays off grenades', () => {
  test('the switches are offered on explosives, but not on a grenade while the Hang-Up is held', () => {
    const perk = packItem(FILES.explosiveEngineerPerk);
    const hangUp = packItem(FILES.explosiveEngineer);
    hangUp.flags.core.sourceId = 'Compendium.essence20.general_hawk_s_personel_files.Item.rT04k3umqXPAlsA3';
    const grenadeWeapon = makeItem({ type: 'weapon', name: 'Frag Grenade', system: { equipped: true } });
    const grenade = makeItem({ type: 'weaponEffect', name: 'Frag', flags: { essence20: { parentId: grenadeWeapon.id } }, system: { classification: { style: 'explosive' } } });
    const charge = makeItem({ type: 'weaponEffect', name: 'Breaching Charge', system: { classification: { style: 'explosive' } } });
    const skills = { system: { skills: { science: { shift: 'd6' }, technology: { shift: 'd8' } } } };
    const both = makeActor([perk, hangUp, grenadeWeapon, grenade, charge], skills);
    expect(ruleDialogSwitches(both, { item: grenade, isAttack: true })).toEqual([]);
    expect(ruleDialogSwitches(both, { item: charge, isAttack: true })).toHaveLength(2);
    const perkOnly = makeActor([packItem(FILES.explosiveEngineerPerk), grenadeWeapon, grenade], skills);
    expect(ruleDialogSwitches(perkOnly, { item: grenade, isAttack: true })).toHaveLength(2);
  });
});

describe('Second Skin: an armor requisition with Technology or Science', () => {
  test('asked before the dialog on an Athletics / Acrobatics requisition only', async () => {
    const { ask } = await import('./ext/c/dialog.mjs');
    const asked = [];
    ask.skill = async (title, prompt, skills) => {
      asked.push(skills);
      return 'technology';
    };

    const actor = makeActor([packItem(FILES.secondSkin)]);
    const dataset = { skill: 'athletics', essence: 'strength', requisitionItemName: 'Vest' };
    await runPreRoll(actor, dataset, null);
    expect(dataset).toMatchObject({ skill: 'technology', essence: 'smarts' });
    expect(asked[0]).toEqual(['athletics', 'technology', 'science']);
    const weapon = { skill: 'targeting', requisitionItemName: 'Rifle' };
    await runPreRoll(actor, weapon, null);
    expect(weapon.skill).toBe('targeting');
    const plain = { skill: 'acrobatics' };
    await runPreRoll(actor, plain, null);
    expect(plain.skill).toBe('acrobatics');
    expect(asked).toHaveLength(1);
  });
});

describe('Wild Idea: the Do Or Die die as a bonus Skill Die for a Moxie Point', () => {
  const moxie = value => makeItem({ type: 'rolePoints', name: 'Moxie', system: { resource: { value, max: 5 } } });

  test('offered with Do Or Die and a Moxie Point; ticked, it adds the die and spends the point', async () => {
    const doOrDie = makeItem({ type: 'perk', name: 'Do Or Die', flags: { core: { sourceId: 'Compendium.essence20.general_hawk_s_personel_files.Item.4NG56r746V7BLt8W' } } });
    const points = moxie(2);
    const actor = makeActor([packItem(FILES.wildIdea), doOrDie, points], { system: { level: 10 } });
    const [toggle] = ruleDialogSwitches(actor, { rolledSkill: 'culture' });
    expect(toggle).toMatchObject({ type: 'checkbox', value: false });
    const options = { ext: { [toggle.name]: true } };
    await runApplyDialog(actor, options, { rolledSkill: 'culture' });
    expect(options.extBonusPoolDie).toBe('d4');
    expect(points.system.resource.value).toBe(1);
    expect(ruleDialogSwitches(makeActor([packItem(FILES.wildIdea), moxie(2)]), { rolledSkill: 'culture' })).toEqual([]);
    expect(ruleDialogSwitches(makeActor([packItem(FILES.wildIdea), doOrDie, moxie(0)]), { rolledSkill: 'culture' })).toEqual([]);
  });

  test('the die grows with Old Hand level', async () => {
    const { bonusDieOf } = await import('./ext/c/dialog.mjs');
    const rule = fromPack(FILES.wildIdea).system.rules[0];
    const die = (level, transition = 0) => bonusDieOf(rule.bonusDie, makeActor([], { system: { level, oldHandTransitionLevel: transition } }), null);
    expect([die(5), die(6), die(11), die(16), die(20)]).toEqual(['d2', 'd4', 'd6', 'd8', 'd8']);
    expect([die(5, 5), die(15, 5), die(20, 5)]).toEqual(['d2', 'd6', 'd8']);
  });
});

describe('Stinger Spray: each attack costs 1 Personal Power', () => {
  let form = true;
  beforeAll(() => {
    registerCheck('monsterForm', () => form);
  });

  test('paid as it is rolled; a missing Monster Form or an empty pool warns, the roll goes on', async () => {
    form = true;
    const effect = packItem(FILES.stingerSpray);
    const venom = makeActor([effect], { system: { powers: { personal: { value: 2, max: 5 } } } });
    const dataset = { skill: 'targeting' };
    await runPreRoll(venom, dataset, effect);
    expect(venom.system.powers.personal.value).toBe(1);
    expect(dataset.cancelRoll).toBeUndefined();
    expect(ui.notifications.warn).not.toHaveBeenCalled();
    form = false;
    const empty = makeActor([packItem(FILES.stingerSpray)], { system: { powers: { personal: { value: 0, max: 5 } } } });
    await runPreRoll(empty, {}, empty.items.contents[0]);
    expect(empty.system.powers.personal.value).toBe(0);
    expect(ui.notifications.warn).toHaveBeenCalledTimes(2);
  });
});

describe('Arrogant (Hang-Up): no first-turn attacks on lower Threat Levels', () => {
  const setup = () => {
    const holder = makeActor([packItem(FILES.arrogant)], { system: { level: 5 } });
    game.combat = { id: 'c', started: true, round: 1, combatant: { actor: holder } };
    return holder;
  };

  const attack = (holder, ...targets) => {
    target(...targets);
    const dataset = { skill: 'targeting' };
    return runPreRoll(holder, dataset, makeItem({ type: 'weaponEffect', system: {} })).then(() => dataset);
  };

  test('a lower Threat Level holds the attack (cancelled, with a warning)', async () => {
    const holder = setup();
    expect((await attack(holder, makeActor([], { type: 'npc', system: { threatLevel: 2 } }))).cancelRoll).toBe(true);
    expect(ui.notifications.warn).toHaveBeenCalled();
    expect((await attack(holder, makeActor([], { type: 'npc', system: { threatLevel: 0 } }))).cancelRoll).toBe(true);
    expect((await attack(holder, makeActor([], { system: { level: 1 } }))).cancelRoll).toBeUndefined();
    expect((await attack(holder, makeActor([], { type: 'npc', system: { threatLevel: 6 } }))).cancelRoll).toBeUndefined();
  });

  test('an area attack is fine with one at or above; a later round or someone else\'s turn too', async () => {
    const holder = setup();
    const low = makeActor([], { type: 'npc', system: { threatLevel: 2 } });
    const high = makeActor([], { type: 'npc', system: { threatLevel: 6 } });
    target(low, high);
    const area = makeItem({ type: 'weaponEffect', system: { radius: 10 } });
    const areaSet = { skill: 'targeting' };
    await runPreRoll(holder, areaSet, area);
    expect(areaSet.cancelRoll).toBeUndefined();
    const single = { skill: 'targeting' };
    await runPreRoll(holder, single, makeItem({ type: 'weaponEffect', system: {} }));
    expect(single.cancelRoll).toBe(true);
    target(low);
    const lone = { skill: 'targeting' };
    await runPreRoll(holder, lone, area);
    expect(lone.cancelRoll).toBe(true);
    game.combat.round = 2;
    expect((await attack(holder, low)).cancelRoll).toBeUndefined();
    game.combat.round = 1;
    game.combat.combatant = { actor: low };
    expect((await attack(holder, low)).cancelRoll).toBeUndefined();
  });
});

