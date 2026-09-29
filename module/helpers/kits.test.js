import { jest } from '@jest/globals';
import {
  activeKits, applyDialogKits, canUseKit, carryPercent, extraCarriedHands, KIT, kitDialogFlags, kitInfo, kitRequirement, kitSources,
  kitUseKind, loaderShieldToughness, loaderShoveBonus, meetsKitPrerequisite, protomatterReduce, restKits, runKitUse, scroungeDif,
  skillKitNoUntrainedSnag, takeMineMultiplier, wildAnimalPersuasion,
} from './kits.mjs';

function flagged(obj) {
  obj.flags ??= {};
  obj.flags.essence20 ??= {};
  obj.getFlag = (scope, key) => obj.flags?.[scope]?.[key];
  obj.setFlag = jest.fn(async (scope, key, value) => {
    obj.flags[scope] ??= {};
    obj.flags[scope][key] = value;
  });
  obj.unsetFlag = jest.fn(async (scope, key) => {
    delete obj.flags?.[scope]?.[key];
  });
  obj.update = jest.fn(async (changes) => {
    for (const [key, value] of Object.entries(changes)) {
      const parts = key.split('.');
      let target = obj;
      for (const part of parts.slice(0, -1)) {
        target[part] ??= {};
        target = target[part];
      }

      target[parts.at(-1)] = value;
    }
  });
  return obj;
}

let nextId = 0;
const gear = (name, extra = {}) => flagged({
  id: extra.id ?? `g${nextId++}`, name, type: extra.type ?? 'gear',
  flags: { ...(extra.source ? { core: { sourceId: extra.source } } : {}), essence20: { ...(extra.flags ?? {}) } },
  system: { gearType: 'kits', quantity: 1, ...(extra.system ?? {}) },
});
const perk = (source, name = 'Perk') => gear(name, { type: 'perk', source, system: {} });

function makeActor(items = [], system = {}) {
  const list = [...items];
  const actor = flagged({
    id: 'a1', uuid: 'Actor.a1', name: 'Tester', type: 'playerCharacter',
    system: { level: 5, skills: {}, ...system },
    items: Object.assign(list, { contents: list, get: id => list.find(i => i.id == id) }),
    createEmbeddedDocuments: jest.fn(async (type, data) => data.map(d => {
      const item = flagged({ ...d, id: `new${nextId++}`, flags: d.flags ?? {}, system: d.system ?? {} });
      item.parent = actor;
      list.push(item);
      return item;
    })),
    deleteEmbeddedDocuments: jest.fn(async (type, ids) => {
      for (const id of ids) {
        const i = list.findIndex(x => x.id == id);
        if (i >= 0) list.splice(i, 1);
      }
    }),
  });
  for (const i of list) {
    i.parent = actor;
  }

  return actor;
}

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, combat: null, user: { targets: new Set() }, settings: { get: () => 1 } };
  global.CONFIG = {
    E20: {
      skills: { athletics: 'Athletics', infiltration: 'Infiltration', science: 'Science', technology: 'Technology', driving: 'Driving', survival: 'Survival', brawn: 'Brawn', deception: 'Deception' },
      skillToEssence: { athletics: 'strength', brawn: 'strength', infiltration: 'speed', driving: 'speed', science: 'smarts', technology: 'smarts', survival: 'smarts', deception: 'social' },
      skillShiftList: ['criticalSuccess', 'autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail', 'fumble'],
    },
  };
  global.foundry = { utils: { randomID: () => `r${nextId++}` }, applications: { api: { DialogV2: { wait: jest.fn(async () => 'consume') } } } };
});

describe('kitInfo', () => {
  test('reads the tier, Skill and Specialization from the name', () => {
    expect(kitInfo(gear('Limited Infiltration (Burglary) Kit'))).toMatchObject({ tier: 'limited', skill: 'infiltration', spec: 'Burglary' });
    expect(kitInfo(gear('Standard Medicine Kit'))).toMatchObject({ tier: 'standard', skill: 'science', spec: 'Medicine' });
    expect(kitInfo(gear('Restricted Climbing Kit'))).toMatchObject({ tier: 'restricted', skill: 'athletics', spec: 'Climbing' });
    expect(kitInfo(gear('Limited Driving (Land, Sea, or Air) Kit'))).toMatchObject({ skill: 'driving', spec: null });
    expect(kitInfo(gear('Standard Infiltration Kit'))).toMatchObject({ tier: 'standard', skill: 'infiltration', spec: null });
  });

  test('reads Essence Kits and generic kits', () => {
    expect(kitInfo(gear('Essence Kit (Smarts)'))).toMatchObject({ tier: 'limited', essence: 'smarts' });
    expect(kitInfo(gear('Standard Kit'))).toMatchObject({ tier: 'standard', skill: null, spec: null });
  });

  test('a stored choice wins, and non-kits are skipped', () => {
    expect(kitInfo(gear('Standard Kit', { flags: { kit: { tier: 'standard', skill: 'technology', spec: 'Repair' } } }))).toMatchObject({ skill: 'technology', spec: 'Repair' });
    expect(kitInfo(gear('Med Kit', { source: KIT.medKit }))).toBeNull();
    expect(kitInfo(gear('Rope', { system: { gearType: 'tools' } }))).toBeNull();
  });
});

describe('prerequisites and requirements', () => {
  test('a kit needs its Skill die', () => {
    const actor = makeActor([], { skills: { infiltration: { shift: 'd4' } } });
    expect(meetsKitPrerequisite(actor, { tier: 'standard', skill: 'infiltration' })).toBe(true);
    expect(meetsKitPrerequisite(actor, { tier: 'limited', skill: 'infiltration' })).toBe(false);
    expect(meetsKitPrerequisite(makeActor([perk('Compendium.essence20.gi_joe_crb.Item.az09yEPydnE1tBTj')], { skills: { infiltration: { shift: 'd20' } } }),
      { tier: 'restricted', skill: 'infiltration' })).toBe(true);
  });

  test('the best kit decides the Snag or downshift', () => {
    const actor = makeActor([gear('Standard Infiltration (Burglary) Kit')], { skills: { infiltration: { shift: 'd8' } } });
    expect(kitRequirement(actor, 'infiltration', 'Burglary', 'standard')).toMatchObject({ snag: false, shiftDown: 0 });
    expect(kitRequirement(actor, 'infiltration', 'Burglary', 'limited')).toMatchObject({ snag: false, shiftDown: 1 });
    expect(kitRequirement(actor, 'infiltration', 'Burglary', 'restricted')).toMatchObject({ snag: false, shiftDown: 3 });
    expect(kitRequirement(actor, 'athletics', null, 'standard')).toMatchObject({ snag: true });
    expect(kitRequirement(actor, 'infiltration', null, 'none')).toMatchObject({ snag: false, shiftDown: 0 });
  });

  test('a spent kit and a generic kit do not count', () => {
    const actor = makeActor([gear('Standard Infiltration Kit', { flags: { kitSpent: true } }), gear('Limited Kit')], { skills: { infiltration: { shift: 'd8' } } });
    expect(kitRequirement(actor, 'infiltration', null, 'standard').snag).toBe(true);
  });

  test('Essence Kits cover their Essence', () => {
    const actor = makeActor([gear('Essence Kit (Speed)')], { skills: { infiltration: { shift: 'd4' } } });
    expect(kitRequirement(actor, 'infiltration', null, 'essence')).toMatchObject({ snag: false, shiftDown: 0 });
    expect(kitRequirement(actor, 'infiltration', null, 'standard')).toMatchObject({ snag: false, shiftDown: 2 });
    expect(kitRequirement(actor, 'infiltration', null, 'limited')).toMatchObject({ snag: false, shiftDown: 4 });
    expect(kitRequirement(actor, 'science', null, 'standard').snag).toBe(true);
  });

  test('the Alterations and Kitted Purpose count as kits', () => {
    const utility = gear('Utility Adjustment', { type: 'alteration', source: KIT.utilityAdjustment, flags: { virtualKit: { tier: 'standard', skill: 'technology', spec: null } } });
    const purpose = gear('Kitted Purpose', { type: 'perk', source: KIT.kittedPurpose, flags: { virtualKit: { tier: 'limited', skill: 'science', spec: null, docked: false } } });
    const actor = makeActor([utility, purpose]);
    expect(activeKits(actor).map(k => k.skill)).toEqual(['technology']);
    expect(kitDialogFlags(actor)).toEqual({ kitRequiredAvailable: true });
    expect(kitDialogFlags(makeActor([]))).toEqual({});
  });

  test('applyDialogKits applies the Snag, cancelled by an Edge', async () => {
    const actor = makeActor([]);
    const options = { kitRequired: 'standard', shiftDown: 0, edge: false, snag: false };
    await applyDialogKits(actor, options, { skill: 'athletics' });
    expect(options.snag).toBe(true);
    const withEdge = { kitRequired: 'standard', shiftDown: 0, edge: true, snag: false };
    await applyDialogKits(actor, withEdge, { skill: 'athletics' });
    expect(withEdge).toMatchObject({ edge: false, snag: false });
  });
});

describe('kits beyond the three tiers', () => {
  const mlp = id => `Compendium.essence20.mlp_crb.Item.${id}`;

  test('a parenthetical Specialization names the Skill when the word before it is not one', () => {
    CONFIG.E20.skills.culture = 'Culture';
    expect(kitInfo(gear('Limited Artisan (Chef) Kit'))).toMatchObject({ tier: 'limited', skill: 'culture', spec: 'Chef' });
  });

  test('My Little Pony kits name their Skill, need no Rank, and are simply the right kit', () => {
    const carpentry = gear('Carpentry Kit', { source: mlp('l69ECABViS1WaFDQ') });
    const forensic = gear('Forensic Kit', { source: mlp('90PF2Uvlv32sjgrZ') });
    expect(kitInfo(carpentry)).toMatchObject({ skill: 'technology', simple: true });
    const actor = makeActor([carpentry, forensic], { skills: { technology: { shift: 'd20' } } });
    expect(kitRequirement(actor, 'technology', null, 'restricted')).toMatchObject({ snag: false, shiftDown: 0 });
    expect(kitRequirement(actor, 'alertness', 'Investigation', 'standard')).toMatchObject({ snag: false, shiftDown: 0 });
    expect(kitSources(actor, 'technology', null, false).specialize).toBe(false);
    expect(canUseKit(carpentry)).toBe(false);
  });

  test('the Wild Animal Survival Kit covers Animal Handling or Survival', () => {
    const kit = gear('Restricted Wild Animal Survival Kit', { source: 'Compendium.essence20.operation_cold_iron.Item.EI7uvXnVEv0eK1C7' });
    const actor = makeActor([kit], { skills: { animalHandling: { shift: 'd20' }, survival: { shift: 'd8' } } });
    expect(kitInfo(kit)).toMatchObject({ tier: 'restricted', skills: ['animalHandling', 'survival'] });
    expect(kitRequirement(actor, 'animalHandling', null, 'restricted')).toMatchObject({ snag: false, shiftDown: 0 });
    expect(kitRequirement(actor, 'survival', 'Arctic', 'restricted')).toMatchObject({ snag: false, shiftDown: 0 });
    expect(meetsKitPrerequisite(makeActor([], { skills: { survival: { shift: 'd4' }, animalHandling: { shift: 'd4' } } }), kitInfo(kit))).toBe(false);
  });

  test('the Wild Animal Survival Kit offers Animal Handling or Survival for Persuasion only', () => {
    const kit = gear('Restricted Wild Animal Survival Kit', { source: 'Compendium.essence20.operation_cold_iron.Item.EI7uvXnVEv0eK1C7' });
    const actor = makeActor([kit], { skills: { animalHandling: { shift: 'd8' }, survival: { shift: 'd4' } } });
    expect(wildAnimalPersuasion(actor, 'persuasion')).toEqual({ kit, skills: ['animalHandling', 'survival'] });
    expect(wildAnimalPersuasion(actor, 'deception')).toBeNull();
    expect(wildAnimalPersuasion(makeActor([], {}), 'persuasion')).toBeNull();
    // Below the d8 prerequisite in both Skills: the kit can't be used.
    const weak = makeActor([gear('Restricted Wild Animal Survival Kit', { source: 'Compendium.essence20.operation_cold_iron.Item.EI7uvXnVEv0eK1C7' })],
      { skills: { animalHandling: { shift: 'd4' }, survival: { shift: 'd4' } } });
    expect(wildAnimalPersuasion(weak, 'persuasion')).toBeNull();
  });

  test('Prototype and Theoretical kits rank above Restricted', () => {
    const kit = gear('Prototype Kit', { flags: { kit: { tier: 'prototype', skill: 'technology', spec: 'Explosives' } } });
    const actor = makeActor([kit], { skills: { technology: { shift: 'd10' } } });
    expect(kitRequirement(actor, 'technology', 'Explosives', 'restricted')).toMatchObject({ snag: false, shiftDown: 0 });
    expect(kitSources(actor, 'technology', 'Explosives', false).specialize).toBe(true);
    expect(meetsKitPrerequisite(makeActor([], { skills: { technology: { shift: 'd8' } } }), kitInfo(kit))).toBe(false);
    expect(kitInfo(gear('Prototype Kit'))).toMatchObject({ tier: 'prototype', skill: null });
  });

  test('Prototype and Theoretical kits ignore a Snag against their Edge; Theoretical caps downshifts at one step', () => {
    const proto = gear('Prototype Kit', { flags: { kit: { tier: 'prototype', skill: 'technology', spec: 'Explosives' } } });
    const theory = gear('Theoretical Kit', { flags: { kit: { tier: 'theoretical', skill: 'science', spec: null } } });
    const restricted = gear('Restricted Kit', { flags: { kit: { tier: 'restricted', skill: 'athletics', spec: null } } });
    const actor = makeActor([proto, theory, restricted], { skills: { technology: { shift: 'd10' }, science: { shift: 'd12' }, athletics: { shift: 'd8' } } });
    // Already Specialized: the kit gives its Edge, and protects it.
    expect(kitSources(actor, 'technology', 'Explosives', true)).toMatchObject({ ignoreSnagOnEdge: true, maxShiftDown: null });
    // Not yet Specialized: the kit gives Specialization instead, so there's no Edge to protect.
    expect(kitSources(actor, 'technology', 'Explosives', false)).toMatchObject({ specialize: true, ignoreSnagOnEdge: false });
    expect(kitSources(actor, 'science', null, false)).toMatchObject({ ignoreSnagOnEdge: false, maxShiftDown: 1 });
    expect(kitSources(actor, 'science', null, true)).toMatchObject({ ignoreSnagOnEdge: true, maxShiftDown: 1 });
    expect(kitSources(actor, 'athletics', null, true)).toMatchObject({ ignoreSnagOnEdge: false, maxShiftDown: null });
  });

  test('a Skill Kit clears the untrained Snag for its chosen Skill only, and is never the kit a test calls for', () => {
    const basic = gear('Basic Skill Kit', { source: 'Compendium.essence20.quartermasters_guide_to_gear.Item.gRxcVy1mS18jyWtx', flags: { kit: { tier: 'standard', skill: 'science', spec: null } } });
    expect(kitInfo(basic)).toMatchObject({ skillKit: true, skill: 'science', spec: null });
    const actor = makeActor([basic], { skills: { science: { shift: 'd20' } } });
    expect(skillKitNoUntrainedSnag(actor, 'science')).toBe(true);
    expect(skillKitNoUntrainedSnag(actor, 'technology')).toBe(false);
    expect(kitRequirement(actor, 'science', null, 'standard').snag).toBe(true);
    // Basic: "No Ranks" in its Skill.
    expect(skillKitNoUntrainedSnag(makeActor([basic], { skills: { science: { shift: 'd2' } } }), 'science')).toBe(false);
  });
});

describe('boosts', () => {
  test('a carried Restricted kit specializes, or gives an Edge', () => {
    const actor = makeActor([gear('Restricted Athletics (Climbing) Kit')], { skills: { athletics: { shift: 'd8' } } });
    expect(kitSources(actor, 'athletics', 'Climbing', false).specialize).toBe(true);
    expect(kitSources(actor, 'athletics', 'Climbing', true).sources[0]).toMatchObject({ edge: true });
  });

  test('using up a Standard kit gives a Specialization, or ↑1', async () => {
    const kit = gear('Standard Athletics (Swimming) Kit');
    const actor = makeActor([kit], { skills: { athletics: { shift: 'd4' } } });
    const message = await runKitUse(kit, null);
    expect(message).toBe('E20.KitUsed');
    expect(kit.flags.essence20.kitSpent).toBe(true);
    expect(kitSources(actor, 'athletics', 'Swimming', false).specialize).toBe(true);
    expect(kitSources(actor, 'athletics', 'Swimming', true).sources[0]).toMatchObject({ shiftUp: 1 });
  });

  test('Reinforced Basics gives Standard kits three uses', async () => {
    const kit = gear('Standard Athletics Kit');
    makeActor([kit, perk(KIT.reinforcedBasics)], { skills: { athletics: { shift: 'd4' } } });
    await runKitUse(kit, null);
    expect(kit.flags.essence20.kitSpent).toBeUndefined();
    await runKitUse(kit, null);
    await runKitUse(kit, null);
    expect(kit.flags.essence20.kitSpent).toBe(true);
  });

  test('an Essence Kit boost lasts one test', async () => {
    const kit = gear('Essence Kit (Strength)');
    const actor = makeActor([kit], { skills: { athletics: { shift: 'd4' } } });
    await runKitUse(kit, null);
    const boost = kitSources(actor, 'brawn', null, true);
    expect(boost.sources[0]).toMatchObject({ shiftUp: 1 });
    expect(boost.consumes.length).toBe(1);
    await applyDialogKits(actor, { kitRequired: 'none' }, { skill: 'brawn', consumes: boost.consumes });
    expect(kitSources(actor, 'brawn', null, true).sources).toEqual([]);
  });

  test('Imaginary Corn gives ↑1 on Strength tests', async () => {
    const corn = gear('Imaginary Corn', { source: KIT.imaginaryCorn, system: { gearType: 'other', quantity: 2 } });
    const actor = makeActor([corn]);
    await runKitUse(corn, null);
    expect(corn.system.quantity).toBe(1);
    expect(kitSources(actor, 'athletics', null, false).sources[0]).toMatchObject({ shiftUp: 1 });
    expect(kitSources(actor, 'science', null, false).sources).toEqual([]);
  });
});

describe('gear and Perks', () => {
  test('Use kinds', () => {
    expect(kitUseKind(gear('Standard Medicine Kit'))).toBe('kit');
    expect(kitUseKind(gear('Med Kit', { source: KIT.medKit }))).toBe('medKit');
    expect(kitUseKind(perk(KIT.crashSurvivor))).toBe('crashSurvivor');
    expect(kitUseKind(gear('Rope', { system: { gearType: 'tools' } }))).toBeNull();
  });

  test('Crash Survivor grants a Limited Driving (Air) kit usable without prerequisites', async () => {
    const survivor = perk(KIT.crashSurvivor, 'Crash Survivor');
    const actor = makeActor([survivor], { skills: { driving: { shift: 'd20' } } });
    await runKitUse(survivor, null);
    await runKitUse(survivor, null);
    const kits = actor.items.filter(i => i.flags.essence20.grantedBy == survivor.id);
    expect(kits.length).toBe(1);
    expect(kitRequirement(actor, 'driving', 'Air', 'limited').snag).toBe(false);
  });

  test('Med Kit heals 1, or 2 with Medicine, over ten uses', async () => {
    const kit = gear('Med Kit', { source: KIT.medKit, system: { gearType: 'medical' } });
    const actor = makeActor([kit], { health: { value: 2, max: 6 }, skills: { science: { specializations: { medicine: { name: 'Medicine' } } } } });
    await runKitUse(kit, null);
    expect(actor.system.health.value).toBe(4);
    expect(kit.flags.essence20.usesLeft).toBe(9);
  });

  test('Wrist Communicator runs out of charges until a rest', async () => {
    const comm = gear('Wrist Communicator', { source: KIT.wristCommunicator, flags: { chargesUsed: 3 } });
    const actor = makeActor([comm]);
    expect(canUseKit(comm)).toBe(false);
    await restKits(actor);
    expect(canUseKit(comm)).toBe(true);
  });

  test('Protomatter Injection Layer takes 1 off the first three hits of 2+', async () => {
    const layer = gear('Protomatter Injection Layer', { type: 'upgrade', source: KIT.protomatterInjectionLayer });
    const actor = makeActor([layer]);
    expect(await protomatterReduce(actor, 1)).toBe(1);
    expect(await protomatterReduce(actor, 3)).toBe(2);
    await protomatterReduce(actor, 2);
    await protomatterReduce(actor, 2);
    expect(await protomatterReduce(actor, 2)).toBe(2);
  });

  test('carrying capacity', () => {
    expect(carryPercent(makeActor([], { skills: { brawn: { shift: 'd20' } } }))).toBe(10);
    expect(carryPercent(makeActor([], { skills: { brawn: { shift: 'd8' } } }))).toBe(100);
    expect(carryPercent(makeActor([perk(KIT.packMuleTf)], { skills: { brawn: { shift: 'd8' } } }))).toBe(200);
    expect(carryPercent(makeActor([perk(KIT.competitiveStrength)], { skills: { brawn: { shift: 'd6' } } }))).toBe(150);
    expect(carryPercent(makeActor([perk(KIT.growthBoost)], { isMorphed: true, skills: { brawn: { shift: 'd8' } } }))).toBe(200);
  });

  test('Loader: carry and shove in Alt Mode, shield in Bot Mode', () => {
    const loader = gear('Loader', { source: KIT.loader, system: { gearType: 'tools' } });
    const actor = makeActor([loader], { isTransformed: true });
    expect(loaderShoveBonus(actor)).toBe(2);
    expect(loaderShieldToughness(actor)).toBe(0);
    loader.flags.essence20.loaderShield = true;
    actor.system.isTransformed = false;
    expect(loaderShoveBonus(actor)).toBe(0);
    expect(loaderShieldToughness(actor)).toBe(1);
  });

  test('Bomber carries six explosives outside the hands', () => {
    const grenade = gear('Grenade', { type: 'weapon', system: { quantity: 8 } });
    const effect = gear('Grenade', { type: 'weaponEffect', flags: { parentId: grenade.id }, system: { classification: { style: 'explosive' } } });
    const actor = makeActor([grenade, effect, perk(KIT.bomber)]);
    expect(extraCarriedHands(actor, [{ item: grenade, hands: 1 }])).toBe(6);
  });

  test('Handy Scrounger and Take Mine', () => {
    expect(scroungeDif(makeActor([]), 'limited')).toBe(10);
    expect(scroungeDif(makeActor([perk(KIT.handyScrounger)]), 'standard')).toBe(0);
    const corn = gear('Imaginary Corn', { flags: { givenBy: { actorUuid: 'Actor.other', scene: 1 } } });
    const actor = makeActor([corn]);
    expect(takeMineMultiplier(actor, corn)).toBe(2);
    expect(takeMineMultiplier(actor, gear('Imaginary Corn'))).toBe(1);
  });
});
