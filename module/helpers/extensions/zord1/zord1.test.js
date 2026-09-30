import { jest } from '@jest/globals';

// Minimal Foundry stand-ins, installed before the modules load.
const worldList = [];
function makeItem(data) {
  const item = {
    id: data.id ?? Math.random().toString(36).slice(2, 10),
    name: data.name ?? 'Item',
    type: data.type ?? 'perk',
    system: data.system ?? {},
    flags: data.flags ?? {},
    effects: [],
    setFlag: jest.fn(async function (scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    }),
    update: jest.fn(async () => {}),
  };
  return item;
}

function makeActor(data = {}) {
  const items = (data.items ?? []).map(makeItem);
  const actor = {
    uuid: data.uuid ?? `Actor.${Math.random().toString(36).slice(2, 10)}`,
    id: data.id ?? 'a',
    name: data.name ?? 'Actor',
    type: data.type ?? 'playerCharacter',
    system: data.system ?? {},
    flags: data.flags ?? {},
    statuses: new Set(),
    isOwner: true,
    items: { contents: items, get: id => items.find(i => i.id == id) },
    prototypeToken: { disposition: data.disposition ?? 1 },
    getActiveTokens: () => [],
    setFlag: jest.fn(async function (scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    }),
    unsetFlag: jest.fn(async function (scope, key) {
      delete this.flags[scope]?.[key];
    }),
    update: jest.fn(async () => {}),
    getFlag(scope, key) {
      return this.flags?.[scope]?.[key];
    },
  };
  items.forEach(item => {
    item.parent = actor;
  });
  return actor;
}

const src = uuid => ({ core: { sourceId: uuid } });

let forms;
let formState;
let emotions;
let slots;
let megaform;
let bodies;
let common;
let ext;

beforeAll(async () => {
  global.Hooks = { on: jest.fn(), once: jest.fn(), callAll: jest.fn() };
  global.game = {
    i18n: { localize: k => k, format: k => k },
    user: { id: 'u1', targets: new Set() },
    actors: { contents: worldList, get: id => worldList.find(a => a.id == id), [Symbol.iterator]: () => worldList[Symbol.iterator]() },
    settings: { get: () => ({}) },
    combat: null,
    scenes: {},
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.CONFIG = { E20: { damageTypes: {}, skills: {}, skillToEssence: { animalHandling: 'social' } }, statusEffects: [{ id: 'frightened' }, { id: 'prone' }] };
  global.foundry = { utils: { randomID: () => 'r', setProperty: (obj, path, value) => {
    const keys = path.split('.');
    let cur = obj;
    keys.slice(0, -1).forEach(k => {
      cur[k] ??= {};
      cur = cur[k];
    });
    cur[keys.at(-1)] = value;
  } }, applications: { api: {} } };
  global.fromUuidSync = uuid => worldList.find(a => a.uuid == uuid) ?? null;
  global.fromUuid = async uuid => global.fromUuidSync(uuid);
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.canvas = null;

  ext = await import('../../extensions.mjs');
  common = await import('./common.mjs');
  formState = await import('./form-state.mjs');
  forms = await import('./forms.mjs');
  emotions = await import('./emotions.mjs');
  slots = await import('./zord-slots.mjs');
  megaform = await import('./megaform.mjs');
  bodies = await import('./bodies.mjs');
  await import('./zord1.mjs');
});

beforeEach(() => {
  worldList.length = 0;
  global.game.user.targets = new Set();
});

describe('registration', () => {
  test('uses and hooks register', () => {
    const uses = ext.registrySnapshot().uses.map(u => u.id);
    expect(uses).toEqual(expect.arrayContaining(['zord1Form', 'zord1DinoThunder', 'zord1RexFeature', 'zord1AdditionalZord', 'zord1Multi', 'zord1Limbs']));
    expect(global.Hooks.on).toHaveBeenCalledWith('updateActor', expect.any(Function));
  });

  test('the Lightspeed Form is left to its existing heal Use', () => {
    const use = ext.registrySnapshot().uses.find(u => u.id == 'zord1Form');
    const perk = makeItem({ flags: src(forms.FORM.lightspeed) });
    perk.parent = { type: 'playerCharacter' };
    expect(use.matches(perk)).toBe(false);
    const solar = makeItem({ flags: src(forms.FORM.solar) });
    solar.parent = { type: 'playerCharacter' };
    expect(use.matches(solar)).toBe(true);
  });
});

describe('common', () => {
  test('stamps expire by round/turn and scene', () => {
    expect(common.isStampLive({ sceneEpoch: 3 }, 3)).toBe(true);
    expect(common.isStampLive({ sceneEpoch: 3 }, 4)).toBe(false);
    global.game.combat = { id: 'c', round: 2, turn: 1, turns: [{ actor: { id: 'x' } }, { actor: { id: 'a' } }] };
    const stamp = common.untilNextTurnStamp({ id: 'a' });
    expect(stamp).toMatchObject({ combatId: 'c', untilRound: 3, untilTurn: 0 });
    expect(common.isStampLive(stamp)).toBe(true);
    global.game.combat.round = 3;
    global.game.combat.turn = 1;
    expect(common.isStampLive(stamp)).toBe(false);
    global.game.combat = null;
  });
});

describe('Forms', () => {
  test('a Form only counts while Morphed and chosen', () => {
    const actor = makeActor({ system: { isMorphed: true }, flags: { essence20: { zord1Form: { uuid: forms.FORM.operator } } } });
    expect(formState.isFormActive(actor, forms.FORM.operator)).toBe(true);
    expect(formState.isFormActive(actor, forms.FORM.solar)).toBe(false);
    actor.system.isMorphed = false;
    expect(formState.isFormActive(actor, forms.FORM.operator)).toBe(false);
  });

  test('Ranger Operator swaps the armor bonus for +2 Toughness and Evasion', () => {
    const actor = makeActor({
      items: [{ type: 'perk', name: 'Ranger Operator', flags: src(forms.FORM.operator) }],
      system: {
        isMorphed: true,
        defenses: { toughness: { total: 16, morphed: 3, string: '' }, evasion: { total: 12, morphed: 0, string: '' } },
      },
      flags: { essence20: { zord1Form: { uuid: forms.FORM.operator } } },
    });
    forms.formDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(15);
    expect(actor.system.defenses.evasion.total).toBe(14);
  });

  test('Ranger Operator gear depends on Core vs Advanced Role', () => {
    const core = makeActor({ items: [{ type: 'role', system: { isAdvanced: false } }] });
    const adv = makeActor({ items: [{ type: 'role', system: { isAdvanced: true } }] });
    expect(forms.formSpec(core, forms.FORM.operator).swaps).toHaveLength(2);
    expect(forms.formSpec(adv, forms.FORM.operator).swaps).toEqual([{ replaces: 'both', uuids: [expect.stringContaining('RNP5lNTQLostQKSB')] }]);
    expect(forms.formSpec(core, forms.FORM.solar).cost).toBe(1);
  });

  test('Beast Morpher: Cheetah speed, Gorilla Health and Brawn', () => {
    const cheetah = makeActor({
      items: [{ type: 'perk', flags: { ...src(forms.FORM.beast), essence20: { zord1Beast: 'cheetah' } } }],
      system: { isMorphed: true, defenses: {}, movement: { ground: { total: 30 } }, health: { max: 5 } },
      flags: { essence20: { zord1Form: { uuid: forms.FORM.beast } } },
    });
    forms.formDerived(cheetah);
    expect(cheetah.system.movement.ground.total).toBe(50);

    const gorilla = makeActor({
      items: [{ type: 'perk', flags: { ...src(forms.FORM.beast), essence20: { zord1Beast: 'gorilla' } } }],
      system: { isMorphed: true, defenses: {}, movement: {}, health: { max: 5 } },
      flags: { essence20: { zord1Form: { uuid: forms.FORM.beast } } },
    });
    forms.formDerived(gorilla);
    expect(gorilla.system.health.max).toBe(7);
    const { sources } = forms.formRollSources(gorilla, null, { rolledSkill: 'brawn' });
    expect(sources).toEqual([expect.objectContaining({ shiftUp: 2 })]);
  });

  test('Ninja Storm Wind Ranger: a 1 Personal Power Morph Form that doubles Ground movement and adds ↑1 to Stealth', () => {
    const ninja = makeActor({
      items: [{ type: 'perk', name: 'Ninja Storm Wind Ranger', flags: src(forms.FORM.ninjaStorm) }],
      system: { isMorphed: true, defenses: {}, movement: { ground: { total: 30 } } },
      flags: { essence20: { zord1Form: { uuid: forms.FORM.ninjaStorm } } },
    });
    expect(forms.heldForms(ninja)).toEqual([forms.FORM.ninjaStorm]);
    expect(forms.formSpec(ninja, forms.FORM.ninjaStorm).cost).toBe(1);
    forms.formDerived(ninja);
    expect(ninja.system.movement.ground.total).toBe(60);
    expect(forms.formRollSources(ninja, null, { rolledSkill: 'infiltration' }).sources)
      .toEqual([expect.objectContaining({ id: 'zord1NinjaStealth', shiftUp: 1 })]);
    expect(forms.formRollSources(ninja, null, { rolledSkill: 'athletics' }).sources).toHaveLength(0);

    const inactive = makeActor({
      items: [{ type: 'perk', flags: src(forms.FORM.ninjaStorm) }],
      system: { isMorphed: true, defenses: {}, movement: { ground: { total: 30 } } },
    });
    forms.formDerived(inactive);
    expect(inactive.system.movement.ground.total).toBe(30);
  });

  describe('Ninja Storm Wind Ranger element', () => {
    const use = () => ext.registrySnapshot().uses.find(u => u.id == 'zord1Form');
    const ninjaActor = (element, extraFlags = {}) => makeActor({
      items: [{ type: 'perk', name: 'Ninja Storm Wind Ranger', flags: { ...src(forms.FORM.ninjaStorm), essence20: element ? { zord1NinjaElement: element } : {} } }],
      system: { isMorphed: true, defenses: {}, health: { max: 5 }, powers: { personal: { value: 3 } }, movement: { ground: { total: 30 } } },
      flags: { essence20: { zord1Form: { uuid: forms.FORM.ninjaStorm }, ...extraFlags } },
    });
    const answer = value => {
      global.foundry.applications.api.DialogV2 = { wait: jest.fn(async () => value) };
    };

    const rolls = (actor, success) => {
      actor._dice = { rollSkill: jest.fn(async () => ({ success })) };
      return actor._dice.rollSkill;
    };

    afterAll(() => {
      global.foundry.applications.api = {};
    });

    test('the element is picked on the Perk from the Use button when none is set', async () => {
      const actor = ninjaActor(null);
      const perk = actor.items.contents[0];
      answer('water');
      await use().run(perk, null, async () => true);
      expect(perk.flags.essence20.zord1NinjaElement).toBe('water');
      expect(forms.ninjaElement(actor)).toBe('water');
    });

    test('activating the element costs 1 Personal Power and runs for 3 rounds', async () => {
      const actor = ninjaActor('earth');
      const perk = actor.items.contents[0];
      global.game.combat = { id: 'c', round: 2, turn: 0 };
      global.game.combats = { get: id => (id == 'c' ? global.game.combat : null) };
      answer('ninjaElement');
      await use().run(perk, null, async () => true);
      expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 2 });
      expect(forms.isNinjaElementActive(actor)).toBe(true);
      global.game.combat.round = 5;
      expect(forms.isNinjaElementActive(actor)).toBe(false);
      global.game.combat = null;
      delete global.game.combats;
    });

    test('Earth Duplication takes 1 Health off while split, and only while the element runs', async () => {
      const actor = ninjaActor('earth', { zord1NinjaElementOn: { epoch: 1, window: 'encounter', count: 1 } });
      const perk = actor.items.contents[0];
      answer('ninjaDuplicate');
      await use().run(perk, null, async () => true);
      forms.formDerived(actor);
      expect(actor.system.health.max).toBe(4);

      const lapsed = ninjaActor('earth', { zord1NinjaDuplicate: true });
      forms.formDerived(lapsed);
      expect(lapsed.system.health.max).toBe(5);
    });

    test('Air Blast rolls Targeting against Toughness and knocks the target Prone on a hit', async () => {
      const actor = ninjaActor('air', { zord1NinjaElementOn: { epoch: 1, window: 'encounter', count: 1 } });
      const perk = actor.items.contents[0];
      const target = makeActor({ name: 'Putty', system: { defenses: { toughness: { total: 14 }, evasion: { total: 11 } } } });
      target.toggleStatusEffect = jest.fn();
      global.game.user.targets = new Set([{ actor: target }]);
      answer('airBlast');
      const roll = rolls(actor, true);
      const pay = jest.fn(async () => true);
      await use().run(perk, null, pay);
      expect(pay).toHaveBeenCalledWith('standard');
      expect(roll).toHaveBeenCalledWith(expect.objectContaining({ skill: 'targeting', dif: '14' }), actor);
      expect(target.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
    });

    test('Water Blast rolls against Evasion and offers 2 Stun on a hit', async () => {
      const actor = ninjaActor('water', { zord1NinjaElementOn: { epoch: 1, window: 'encounter', count: 1 } });
      const perk = actor.items.contents[0];
      const target = makeActor({ uuid: 'Actor.putty', system: { defenses: { toughness: { total: 14 }, evasion: { total: 11 } } } });
      global.game.user.targets = new Set([{ actor: target }]);
      answer('waterBlast');
      const roll = rolls(actor, true);
      const message = await use().run(perk, null, async () => true);
      expect(roll).toHaveBeenCalledWith(expect.objectContaining({ skill: 'targeting', dif: '11' }), actor);
      expect(message).toContain('data-e20-ext="o1ApplyDamage"');
      expect(message).toContain('data-target-uuid="Actor.putty"');
      expect(message).toContain('data-amount="2"');
    });

    test('rolls against a Ranger with the Form active offer the mind-control Snag', async () => {
      const ninja = ninjaActor('air');
      const roller = makeActor();
      expect(forms.formToggles(roller, { rolledSkill: 'persuasion' }).map(t => t.name)).not.toContain('zord1NinjaMind');
      global.game.user.targets = new Set([{ actor: ninja }]);
      expect(forms.formToggles(roller, { rolledSkill: 'persuasion' }).map(t => t.name)).toContain('zord1NinjaMind');
      const options = { ext: { zord1NinjaMind: true } };
      await forms.formApplyDialog(roller, options, {});
      expect(options.snag).toBe(true);
    });

    test('ending the Form clears the element', async () => {
      const actor = ninjaActor('earth', { zord1NinjaElementOn: { epoch: 1, count: 1 }, zord1NinjaDuplicate: true });
      await forms.endForm(actor);
      expect(actor.flags.essence20.zord1NinjaElementOn).toBeUndefined();
      expect(actor.flags.essence20.zord1NinjaDuplicate).toBeUndefined();
    });
  });

  test('Solar Power resists Cold and Energy attacks as a Snag', () => {
    const target = makeActor({ items: [{ type: 'perk', flags: src(forms.FORM.solar) }], system: { isMorphed: true }, flags: { essence20: { zord1Form: { uuid: forms.FORM.solar } } } });
    const attacker = makeActor();
    const fire = forms.formRollSources(attacker, target, { item: { type: 'weaponEffect', system: { damageType: 'fire' } } });
    expect(fire.sources[0]).toMatchObject({ snag: true });
    const blunt = forms.formRollSources(attacker, target, { item: { type: 'weaponEffect', system: { damageType: 'blunt' } } });
    expect(blunt.sources).toHaveLength(0);
  });

  test('Lightspeed and Time Force healing/time Edge toggles', async () => {
    const actor = makeActor({ system: { isMorphed: true }, flags: { essence20: { zord1Form: { uuid: forms.FORM.lightspeed } } } });
    const toggles = forms.formToggles(actor, { rolledSkill: 'science', item: null });
    expect(toggles[0]).toMatchObject({ name: 'zord1Lightspeed', value: true });
    const options = { ext: { zord1Lightspeed: true }, snag: true };
    await forms.formApplyDialog(actor, options, {});
    expect(options).toMatchObject({ snag: false });
  });

  test('Supersonic makes the Blade Blaster Sonic', async () => {
    const blaster = { id: 'w1', type: 'weapon', name: 'Blade Blaster', system: { traits: ['powerWeapon'] } };
    const actor = makeActor({ system: { isMorphed: true }, flags: { essence20: { zord1Form: { uuid: forms.FORM.supersonic } } } });
    actor.items.contents.push(blaster);
    const result = { damageValue: 2, damageType: 'energy' };
    await forms.formHitRider(actor, null, result, { weaponId: 'w1' }, { damageBonusNote: jest.fn(), addRiderOption: jest.fn() });
    expect(result.damageType).toBe('sonic');
  });

  test('Dino Thunder: Tricera Skin and Shield Projection', () => {
    const actor = makeActor({
      system: { defenses: { toughness: { total: 12 } } },
      flags: { essence20: { zord1Dino: { triceraSkin: { sceneEpoch: null }, shieldProjection: {} } } },
    });
    forms.formDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(17);
    expect(forms.dinoDefenseAdjust(null, actor, 'evasion')).toBe(5);
    expect(forms.dinoDefenseAdjust(null, actor, 'willpower')).toBe(0);
  });

  test('Dino Thunder: Intangibility stops damage', () => {
    const actor = makeActor({ flags: { essence20: { zord1Dino: { intangibility: {} } } } });
    expect(forms.dinoDamageModifier(actor, 4)).toBe(0);
    expect(forms.dinoDamageModifier(makeActor(), 4)).toBe(4);
  });
});

describe('Emotional Mastery', () => {
  test('Emotional Range caps the known options', async () => {
    const actor = makeActor({ items: [{ type: 'rolePoints', name: 'Emotional Range', flags: src(emotions.EMOTION.range), system: { bonus: { value: 2 } } }] });
    expect(emotions.emotionalRange(actor)).toBe(2);
    actor.flags.essence20 = { zord1KnownEmotions: ['anger', 'fear', 'joy'] };
    await expect(emotions.ensureKnownEmotions(actor)).resolves.toEqual(['anger', 'fear']);
    expect(await emotions.ensureKnownEmotions(makeActor())).toBeNull();
  });

  test('Emotional Strength triggers once per scene for the active option', async () => {
    global.Roll = class {
      constructor() {
        this.total = 2;
      }
      async evaluate() {
        return this;
      }
    };
    const holder = makeActor({
      items: [{ type: 'perk', flags: src(emotions.EMOTION.strength) }],
      system: { powers: { personal: { value: 1, max: 6 } } },
      flags: { essence20: { activeEmotionalMastery: ['distress'] } },
    });
    worldList.push(holder);
    expect(emotions.canTrigger(holder, 'distress')).toBe(true);
    expect(emotions.canTrigger(holder, 'joy')).toBe(false);
    await emotions.emotionPostRoll(holder, [{ success: false }], {}, { isFumble: true });
    expect(holder.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 3 });
  });

  test('Contempt fires on an enemy Critical Success, Joy on an ally', async () => {
    const holder = makeActor({
      items: [{ type: 'perk', flags: src(emotions.EMOTION.strength) }],
      system: { powers: { personal: { value: 0, max: 6 } } },
      flags: { essence20: { activeEmotionalMastery: ['contempt'] } },
      disposition: 1,
    });
    worldList.push(holder);
    const ally = makeActor({ disposition: 1 });
    await emotions.emotionPostRoll(ally, [], {}, { isCrit: true });
    expect(holder.update).not.toHaveBeenCalled();
    const enemy = makeActor({ disposition: -1 });
    await emotions.emotionPostRoll(enemy, [], {}, { isCrit: true });
    expect(holder.update).toHaveBeenCalled();
  });
});

describe('Zord slots', () => {
  test('owned Zords, owners and the one-Zord-per-scene rule', () => {
    const zordA = makeActor({ type: 'zord', uuid: 'Actor.zA', name: 'A' });
    const zordB = makeActor({ type: 'zord', uuid: 'Actor.zB', name: 'B' });
    const pilot = makeActor({
      uuid: 'Actor.p',
      items: [{ type: 'perk', flags: src(slots.ZS.additionalZord) }],
      system: { actors: { a: { type: 'zord', uuid: 'Actor.zA' }, b: { type: 'zord', uuid: 'Actor.zB' } } },
    });
    worldList.push(zordA, zordB, pilot);
    expect(slots.ownedZords(pilot)).toHaveLength(2);
    expect(slots.zordOwner(zordB)).toBe(pilot);
    pilot.flags.essence20 = { zord1ActiveZord: { epoch: 1, uuid: 'Actor.zA' } };
    const summon = { flags: { essence20: { zordSummonReadyRound: 3 } } };
    expect(slots.checkOneZordPerScene(zordA, summon)).toBe(true);
    expect(slots.checkOneZordPerScene(zordB, summon)).toBe(false);
  });

  test('Megafauna: essences, Evasion, melee ↑1 and Animal Handling driving', () => {
    const zord = makeActor({
      type: 'zord', uuid: 'Actor.z',
      items: [{ type: 'feature', name: 'Megafauna', flags: src(slots.ZS.megafauna) }],
      flags: { essence20: { zord1Megafauna: true } },
      system: { essences: { smarts: { value: null }, social: { value: null } }, defenses: { evasion: { total: 10 } }, actors: { d: { vehicleRole: 'driver', uuid: 'Actor.pilot' } } },
    });
    const pilot = makeActor({ uuid: 'Actor.pilot' });
    worldList.push(zord, pilot);
    slots.zordDerived(zord);
    expect(zord.system.essences.smarts.value).toBe(3);
    expect(zord.system.defenses.evasion.total).toBe(13);
    expect(slots.zordRollSources(zord, null, { isAttack: true, isMelee: true }).sources[0]).toMatchObject({ shiftUp: 1 });
    const dataset = { skill: 'driving' };
    slots.megafaunaPreRoll(pilot, dataset);
    expect(dataset.skill).toBe('animalHandling');
  });

  test('Terrorzord: Smarts 5, Social 4 and Terror toggles', () => {
    const zord = makeActor({ type: 'zord', uuid: 'Actor.tz', system: { essences: { smarts: { value: null }, social: { value: null } }, defenses: {} } });
    const pilot = makeActor({
      items: [{ type: 'perk', flags: src(slots.ZS.terrorzordNature) }, { type: 'perk', flags: src(slots.ZS.terror) }],
      system: { actors: { z: { type: 'zord', uuid: 'Actor.tz' } } },
    });
    pilot._getBaseRolePoints = () => ({ system: { resource: { value: 2 } } });
    worldList.push(zord, pilot);
    slots.zordDerived(zord);
    expect(zord.system.essences).toMatchObject({ smarts: { value: 5 }, social: { value: 4 } });
    expect(slots.terrorToggles(zord, {})[0]).toMatchObject({ name: 'zord1Terror', max: 2 });
  });

  test('Anti-Armor critical cuts armor for the scene', () => {
    const target = makeActor({ system: { defenses: { toughness: { total: 15, armor: 3 } } }, flags: { essence20: { zord1ArmorShred: { epoch: 1, amount: 2 } } } });
    slots.zordDerived(target);
    expect(target.system.defenses.toughness.total).toBe(13);
  });

  test('Ship Integration lends the Phantom Suite to the ship', () => {
    const pilot = makeActor({ uuid: 'Actor.ph', items: [{ type: 'perk', flags: src(slots.ZS.phantomSuite), system: { advances: { currentValue: 3 } } }], flags: { essence20: { phantomSuiteActive: true } } });
    const ship = makeActor({ type: 'zord', system: { actors: { d: { vehicleRole: 'driver', uuid: 'Actor.ph' } } }, flags: { essence20: { zord1ShipIntegration: { pilotUuid: 'Actor.ph', epoch: 1 } } } });
    worldList.push(pilot, ship);
    expect(slots.integratedPilot(ship)).toBe(pilot);
    expect(slots.zordDefenseAdjust(null, ship, 'evasion')).toBe(3);
    expect(slots.zordRollSources(ship, null, { rolledSkill: 'infiltration' }).sources[0]).toMatchObject({ edge: true, shiftUp: 1 });
  });
});

describe('Megaforms', () => {
  test('Accurate Combiner gives ↑1 when its participant\'s attack is used', () => {
    const part = makeActor({
      uuid: 'Actor.part',
      items: [{ type: 'megaformTrait', name: 'Accurate Combiner', system: { type: 'accurateCombiner', attackType: 'ranged' } }, { type: 'weapon', name: 'Cannon' }],
    });
    worldList.push(part);
    const mega = makeActor({ type: 'megaform', system: { actors: { p: { uuid: 'Actor.part' } } } });
    const weapon = makeItem({ id: 'mw', type: 'weapon', name: 'Cannon' });
    mega.items.contents.push(weapon);
    const effect = { type: 'weaponEffect', flags: { essence20: { parentId: 'mw' } } };
    expect(megaform.attackOwner(mega, effect)).toBe(part);
    expect(megaform.accurateCombinerSources(mega, null, { item: effect, isAttack: true, isMelee: false }).sources).toHaveLength(1);
    expect(megaform.accurateCombinerSources(mega, null, { item: effect, isAttack: true, isMelee: true }).sources).toHaveLength(0);
  });

  test('Assault Weapon adds 1 damage to the Megaform\'s participant melee attacks only', async () => {
    const zord = makeActor({
      uuid: 'Actor.zord', type: 'zord',
      items: [{ type: 'megaformTrait', name: 'Assault Weapon', system: { type: 'assaultWeapon' } }, { type: 'weapon', name: 'Saber' }],
    });
    worldList.push(zord);
    const mega = makeActor({ type: 'megaform', system: { hasAssaultWeapon: true, actors: { z: { uuid: 'Actor.zord' } } } });
    mega.items.contents.push(
      makeItem({ id: 'mw', type: 'weapon', name: 'Saber' }),
      makeItem({ id: 'me', type: 'weaponEffect', flags: { essence20: { parentId: 'mw' } } }),
      makeItem({ id: 'gen', type: 'weaponEffect', name: 'Enhanced', flags: { essence20: { zord2Gen: 'pr-Melee-z' } } }),
    );
    const tools = { damageBonusNote: jest.fn() };
    const hit = (itemId, style = 'melee', system = mega.system) => megaform.assaultWeaponHitRider(
      { ...mega, system }, null, { damageValue: 3 }, { style, itemUuid: `Actor.m.Item.${itemId}` }, tools,
    );

    await hit('me');
    expect(tools.damageBonusNote).toHaveBeenCalledWith(expect.anything(), 1, 'Assault Weapon');
    tools.damageBonusNote.mockClear();
    await hit('me', 'projectile');
    await hit('gen');
    await hit('me', 'melee', { ...mega.system, hasAssaultWeapon: false });
    expect(tools.damageBonusNote).not.toHaveBeenCalled();
  });

  test('Power/Target Master mirror perks, powers and weapons', () => {
    const wearer = makeActor({
      uuid: 'Actor.w',
      items: [
        { type: 'upgrade', flags: src(megaform.MF.powerMaster) },
        { type: 'perk', name: 'P' }, { type: 'power', name: 'Pw' }, { type: 'weapon', name: 'W' },
      ],
    });
    worldList.push(wearer);
    const mega = makeActor({ type: 'megaform', system: { actors: { w: { uuid: 'Actor.w' } } } });
    expect(megaform.desiredMirrors(mega).map(e => e.item.name).sort()).toEqual(['P', 'Pw']);
    wearer.items.contents.push(makeItem({ type: 'upgrade', flags: src(megaform.MF.targetMaster) }));
    expect(megaform.desiredMirrors(mega).map(e => e.item.name).sort()).toEqual(['P', 'Pw', 'W']);
  });

  test('Signature Finishing Move multiplies the damage', async () => {
    const zord = makeActor({ type: 'zord', uuid: 'Actor.sz', items: [{ type: 'feature', name: 'SFM', flags: { ...src(megaform.MF.sfm), essence20: { zord1Finisher: { style: 'melee', damageType: 'fire' } } } }] });
    worldList.push(zord);
    const mega = makeActor({ type: 'megaform', system: { actors: { z: { uuid: 'Actor.sz' } } } });
    const item = { type: 'weaponEffect', system: { classification: { style: 'melee' } } };
    const toggles = megaform.finisherToggles(mega, { item });
    expect(toggles[0].name).toBe('zord1Sfm');
    await megaform.finisherApplyDialog(mega, { ext: { zord1Sfm: true } }, { item });
    const result = { damageValue: 3 };
    const damageBonusNote = jest.fn((r, n) => {
      r.damageValue += n;
    });
    await megaform.finisherHitRider(mega, null, result, {}, { damageBonusNote });
    expect(result.damageValue).toBe(12);
    expect(result.damageType).toBe('fire');
  });
});

describe('Bodies', () => {
  test('size classes step along the ladder', () => {
    expect(bodies.shiftSize('common', 1)).toBe('large');
    expect(bodies.shiftSize('extended', 1)).toBe('gigantic');
    expect(bodies.shiftSize('small', -1)).toBe('small');
  });

  test('Titan Frame and Plated Carapace follow the mode', () => {
    const upgrades = [
      { type: 'upgrade', name: 'Titan Frame', flags: src(bodies.BODY.titanFrame), system: { armorBonus: { value: 4 } } },
      { type: 'upgrade', name: 'Plated Carapace', flags: src(bodies.BODY.platedCarapace), system: { armorBonus: { value: 2 } } },
    ];
    const bot = makeActor({ items: upgrades, system: { canTransform: true, isTransformed: false, defenses: { toughness: { total: 20 }, evasion: { total: 12 } } } });
    bodies.bodiesDerived(bot);
    expect(bot.system.defenses.toughness.total).toBe(20);
    expect(bot.system.defenses.evasion.total).toBe(10);
    const alt = makeActor({ items: upgrades, system: { canTransform: true, isTransformed: true, defenses: { toughness: { total: 20 }, evasion: { total: 12 } } } });
    bodies.bodiesDerived(alt);
    expect(alt.system.defenses.toughness.total).toBe(18);
    expect(alt.system.defenses.evasion.total).toBe(12);
  });

  test('Enlarged needs Restricted Accommodation on armor', () => {
    const actor = makeActor({ items: [{ type: 'alteration', flags: src(bodies.BODY.enlarged) }] });
    const armor = makeItem({ id: 'ar', type: 'armor', name: 'Battledress', system: { items: {} } });
    armor.parent = actor;
    expect(bodies.checkBattledress(armor, { system: { equipped: true } })).toBe(false);
    armor.system.items = { u: { name: 'Restricted Alteration Accommodation' } };
    expect(bodies.checkBattledress(armor, { system: { equipped: true } })).toBe(true);
  });

  test('Additional Pair of Limbs: +10ft Ground in Alt Mode', () => {
    const actor = makeActor({
      items: [{ type: 'gear', flags: { ...src(bodies.BODY.limbs), essence20: { zord1LimbsMode: 'move' } } }],
      system: { isTransformed: true, defenses: {}, movement: { ground: { total: 40 } } },
    });
    bodies.bodiesDerived(actor);
    expect(actor.system.movement.ground.total).toBe(50);
  });
});
