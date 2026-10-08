import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Batch slA10 (docs/rules-batches/slA10.md): the items group A's round-10 plug-ins (module/rules/ext/a/) unblock -
 * Megaform roster rules, Forms, owned Zords, size classes, helper hooks. Each item is loaded from its pack source and
 * must do what the removed slice code did.
 */

const chooseSelect = jest.fn();
const chooseButtons = jest.fn();
const findItems = jest.fn();
const pickOne = jest.fn();
const grantCopy = jest.fn();
const rollTest = jest.fn();
const pickPerkFrom = jest.fn();
const applyDamage = jest.fn();
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({
  chooseSelect, chooseButtons, findItems, pickOne, grantCopy, rollTest, pickPerkFrom, markIntegrated: jest.fn(),
}));
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({ applyDamage, getVehicleDriver: jest.fn() }));
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ createItemCopies: jest.fn(), setEntryAndAddItem: jest.fn() }));
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({ applyTimedCondition: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { fireTriggers, runUse } = await import('./triggers.mjs');
const { ruleRollSources, ruleDamageDealt, ruleDialogSwitches, ruleDerived } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const megaformExt = await import('./plugins/zords/megaform.mjs');
const formsExt = await import('./plugins/zords/form-perks.mjs');
const zordsExt = await import('./plugins/zords/zords.mjs');
const hooksExt = {
  ...(await import('./plugins/zords/zord-timing-hooks.mjs')), ...(await import('./plugins/picks/known-options.mjs')),
  ...(await import('./plugins/rolls/before-roll-and-group-test-events.mjs')), ...(await import('./plugins/effects/derived-hook-movement.mjs')),
};
const sizeExt = await import('./plugins/effects/size.mjs');
const { fireItemAdded } = await import('./triggers.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;
let sceneEpoch = 1;

const getPath = (object, key) => key.split('.').reduce((o, k) => o?.[k], object);
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

function asItem(data, actor) {
  const item = {
    id: data.id ?? `i${nextId++}`, flags: {}, system: {}, effects: [], isOwner: true, ...data, parent: actor,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    toObject() {
      return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, flags: this.flags }));
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  world.items.set(item.uuid, item);
  return item;
}

function makeActor(type = 'playerCharacter', name = 'Ranger', system = {}, extra = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} }, effects: [],
    system: { health: { value: 5, max: 10, bonus: 0 }, ...system },
    getActiveTokens: () => [],
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    }),
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    async unsetFlag(scope, key) {
      delete this.flags?.[scope]?.[key];
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    createEmbeddedDocuments: jest.fn(async function (kind, datas) {
      return datas.map(data => {
        const made = asItem({ ...JSON.parse(JSON.stringify(data)), id: data._id ?? undefined }, this);
        items.push(made);
        return made;
      });
    }),
    deleteEmbeddedDocuments: jest.fn(async function (kind, ids) {
      for (const id of ids) {
        const at = items.findIndex(item => item.id == id);
        if (at >= 0) {
          items.splice(at, 1);
        }
      }
    }),
    ...extra,
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

function addPackItem(actor, file, extra = {}) {
  const doc = fromPack(file);
  return addItem(actor, {
    name: doc.name, type: doc.type, system: { ...JSON.parse(JSON.stringify(doc.system)), ...(extra.system ?? {}) }, flags: extra.flags ?? {},
    _stats: { compendiumSource: extra.source ?? `Compendium.essence20.x.Item.${doc._id}` },
  });
}

const packRules = file => fromPack(file).system.rules ?? [];

beforeEach(() => {
  world.actors.length = 0;
  world.items.clear();
  sceneEpoch = 1;
  const actors = world.actors;
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null, contents: [] },
    settings: { get: (scope, key) => (String(key).toLowerCase().includes('scene') ? sceneEpoch : 1), set: async () => {} },
    actors: { contents: actors, get: id => actors.find(actor => actor.id == id), [Symbol.iterator]: () => actors[Symbol.iterator]() },
    i18n: { localize: k => k, format: k => k, has: () => false },
  };
  global.fromUuidSync = uuid => actors.find(actor => actor.uuid == uuid) ?? world.items.get(uuid) ?? null;
  global.fromUuid = async uuid => global.fromUuidSync(uuid);
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath, deepClone: value => JSON.parse(JSON.stringify(value)) },
  };
  for (const mock of [chooseSelect, chooseButtons, findItems, pickOne, grantCopy, rollTest, pickPerkFrom, applyDamage]) {
    mock.mockReset();
  }
});

const FILES = {
  accurate: 'atsitems/_source/Accurate_Combiner_yYaK1g58FCPpSNUr.json',
  assault: 'jttitems/_source/Assault_Weapon_89twbGGvy0Q698AL.json',
  rollerDrum: 'eocitems/_source/Roller_Drum_Hjo7mZ7eLs8EwKeu.json',
  powerMaster: 'fgtaaitems/_source/Power_Master_Zord1PowerMastr1.json',
  targetMaster: 'fgtaaitems/_source/Target_Master_Zord1TargetMastr.json',
  scramble: 'eocitems/_source/Scramble_Modulator_5o2qpfqpwRPeUBPA.json',
  warzord: 'atsitems/_source/Warzord_jX5IHpydHimdjbGb.json',
};

test('every converted item\'s rules validate', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of packRules(file)) {
      expect([file, validateRule(rule)]).toEqual([file, []]);
    }
  }
});

/* -------------------------------------------- */
/*  Megaforms                                    */
/* -------------------------------------------- */

/** A Megazord built from these participants, with a copy of the first one's weapon and its attack. */
function megazord(participants, { combiner = false } = {}) {
  const roster = Object.fromEntries(participants.map((actor, i) => [`p${i}`, { uuid: actor.uuid }]));
  return makeActor('megaform', 'Megazord', { subtype: [combiner ? 'megaformCombiner' : 'megaformZord'], actors: roster });
}

describe('Megaform roster rules', () => {
  test('Accurate Combiner: ↑1 when the Megaform uses its participant\'s attack of the noted type', () => {
    const zord = makeActor('zord', 'Gun Zord');
    addItem(zord, { name: 'Cannon', type: 'weapon' });
    addPackItem(zord, FILES.accurate, { system: { attackType: 'ranged' } });
    const mega = megazord([zord]);
    addItem(mega, { id: 'mw', name: 'Cannon', type: 'weapon' });
    const effect = addItem(mega, { name: 'Cannon', type: 'weaponEffect', flags: { essence20: { parentId: 'mw' } } });
    expect(ruleRollSources(mega, null, { item: effect, isAttack: true, isMelee: false }).sources).toEqual([
      expect.objectContaining({ label: 'Accurate Combiner', shiftUp: 1 }),
    ]);
    expect(ruleRollSources(mega, null, { item: effect, isAttack: true, isMelee: true }).sources).toEqual([]);
    // Another participant's attack: nothing.
    const other = makeActor('zord', 'Saber Zord');
    addItem(other, { name: 'Saber', type: 'weapon' });
    mega.system.actors.p1 = { uuid: other.uuid };
    addItem(mega, { id: 'sw', name: 'Saber', type: 'weapon' });
    const saber = addItem(mega, { name: 'Saber', type: 'weaponEffect', flags: { essence20: { parentId: 'sw' } } });
    expect(ruleRollSources(mega, null, { item: saber, isAttack: true, isMelee: false }).sources).toEqual([]);
  });

  test('Accurate Combiner with no attack type noted counts melee', () => {
    const zord = makeActor('zord', 'Saber Zord');
    addItem(zord, { name: 'Saber', type: 'weapon' });
    addPackItem(zord, FILES.accurate, { system: { attackType: undefined } });
    const mega = megazord([zord]);
    addItem(mega, { id: 'mw', name: 'Saber', type: 'weapon' });
    const effect = addItem(mega, { name: 'Saber', type: 'weaponEffect', flags: { essence20: { parentId: 'mw' } } });
    expect(ruleRollSources(mega, null, { item: effect, isAttack: true, isMelee: true }).sources).toHaveLength(1);
    expect(ruleRollSources(mega, null, { item: effect, isAttack: true, isMelee: false }).sources).toHaveLength(0);
  });

  test('Assault Weapon: +1 on the Megaform\'s participant melee attacks, once however many hold it', () => {
    const zord = makeActor('zord', 'Saber Zord');
    addItem(zord, { name: 'Saber', type: 'weapon' });
    addPackItem(zord, FILES.assault);
    const second = makeActor('zord', 'Other Zord');
    addPackItem(second, FILES.assault);
    const mega = megazord([zord, second]);
    addItem(mega, { id: 'mw', name: 'Saber', type: 'weapon' });
    const effect = addItem(mega, { name: 'Saber', type: 'weaponEffect', flags: { essence20: { parentId: 'mw' } } });
    const generated = addItem(mega, { name: 'Enhanced', type: 'weaponEffect', flags: { essence20: { zord2Gen: 'pr-Melee-z' } } });
    const tools = { damageBonusNote: jest.fn() };
    ruleDamageDealt(mega, null, { damageValue: 3 }, { style: 'melee', itemUuid: effect.uuid }, tools);
    expect(tools.damageBonusNote).toHaveBeenCalledTimes(1);
    expect(tools.damageBonusNote).toHaveBeenCalledWith(expect.anything(), 1, 'Assault Weapon');
    tools.damageBonusNote.mockClear();
    ruleDamageDealt(mega, null, { damageValue: 3 }, { style: 'projectile', itemUuid: effect.uuid }, tools);
    ruleDamageDealt(mega, null, { damageValue: 3 }, { style: 'melee', itemUuid: generated.uuid }, tools);
    ruleDamageDealt(mega, null, { damageValue: 0 }, { style: 'melee', itemUuid: effect.uuid }, tools);
    expect(tools.damageBonusNote).not.toHaveBeenCalled();
  });

  test('Roller Drum: +1 Health to its holder\'s row of a Combiner form', () => {
    const bot = makeActor('playerCharacter', 'Drummer');
    addPackItem(bot, FILES.rollerDrum);
    const other = makeActor('playerCharacter', 'Other');
    const form = megazord([bot, other], { combiner: true });
    form.system.participantHealth = [{ name: 'Drummer', value: 4, max: 6 }, { name: 'Other', value: 5, max: 5 }];
    Object.assign(form.system, { combinedHealthMax: 11, combinedHealthValue: 9, health: { max: 11, value: 9 } });
    megaformExt.megaformHealthDerived(form);
    expect(form.system.participantHealth).toEqual([{ name: 'Drummer', value: 5, max: 7 }, { name: 'Other', value: 5, max: 5 }]);
    expect(form.system).toMatchObject({ combinedHealthMax: 12, combinedHealthValue: 10, health: { max: 12, value: 10 } });
    // A Megazord (not a Combiner form): nothing.
    const zordForm = megazord([bot]);
    Object.assign(zordForm.system, { combinedHealthMax: 6, combinedHealthValue: 4, participantHealth: [{ name: 'Drummer', value: 4, max: 6 }] });
    megaformExt.megaformHealthDerived(zordForm);
    expect(zordForm.system.combinedHealthMax).toBe(6);
  });

  test('Power Master / Target Master mirror Perks and Powers / weapons onto the Megaform', async () => {
    const wearer = makeActor('playerCharacter', 'Wearer');
    addItem(wearer, { name: 'P', type: 'perk' });
    addItem(wearer, { name: 'Pw', type: 'power' });
    const weapon = addItem(wearer, { name: 'W', type: 'weapon' });
    addItem(wearer, { name: 'WE', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } } });
    addPackItem(wearer, FILES.powerMaster);
    const mega = megazord([wearer]);
    expect(megaformExt.desiredMirrors(mega).map(e => e.item.name).sort()).toEqual(['P', 'Pw']);
    addPackItem(wearer, FILES.targetMaster);
    expect(megaformExt.desiredMirrors(mega).map(e => e.item.name).sort()).toEqual(['P', 'Pw', 'W', 'WE']);

    // The Use mirrors them (keeping ids) and says so; with no Megaform it posts nothing.
    const master = wearer.items.contents.find(item => item.name == 'Power Master');
    const line = await runUse(master, async () => true);
    expect(line).toContain('Wearer&#39;s gear is shared with Megazord.');
    expect(mega.items.contents.map(item => item.name).sort()).toEqual(['P', 'Pw', 'W', 'WE']);
    expect(mega.createEmbeddedDocuments).toHaveBeenCalledWith('Item', expect.any(Array), { keepId: true });
    const loner = makeActor('playerCharacter', 'Loner');
    const own = addPackItem(loner, FILES.powerMaster);
    expect(await runUse(own, async () => true)).toBeNull();
  });

  test('Scramble Modulator: a hit on a Combiner form offers the GM 1 Sonic on its healthiest components', async () => {
    const attacker = makeActor('playerCharacter', 'Shooter');
    const weapon = addItem(attacker, { name: 'Blaster', type: 'weapon', system: { equipped: true } });
    const effect = addItem(attacker, { name: 'Blaster', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } } });
    addPackItem(attacker, FILES.scramble, { flags: { essence20: { parentId: weapon.id } } });
    const a = makeActor('playerCharacter', 'A', { health: { value: 4, max: 6 } });
    const b = makeActor('playerCharacter', 'B', { health: { value: 6, max: 6 } });
    const c = makeActor('playerCharacter', 'C', { health: { value: 6, max: 8 } });
    const form = megazord([a, b, c], { combiner: true });
    await fireTriggers(attacker, 'hit', { roll: { item: effect, isAttack: true }, outcome: 'success', targets: [form] });
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
    const button = ChatMessage.create.mock.calls[0][0].flags.essence20.ruleButton;
    expect(button).toMatchObject({ who: 'gm', targets: [form.uuid] });
    const ctx = stepContext({ actor: attacker, item: null, targets: [form] });
    await runSteps(button.steps, ctx);
    expect(applyDamage.mock.calls.map(([who, amount, type]) => [who.name, amount, type])).toEqual([['B', 1, 'sonic'], ['C', 1, 'sonic']]);

    // Not a Combiner form, or another weapon: nothing.
    ChatMessage.create.mockClear();
    await fireTriggers(attacker, 'hit', { roll: { item: effect, isAttack: true }, outcome: 'success', targets: [makeActor('npc', 'Foe')] });
    const fist = addItem(attacker, { name: 'Fist', type: 'weaponEffect' });
    await fireTriggers(attacker, 'hit', { roll: { item: fist, isAttack: true }, outcome: 'success', targets: [form] });
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });

  test('Warzord: the Combiner reminder when its Megaform combines, once per scene', async () => {
    const zord = makeActor('zord', 'Warzord');
    addPackItem(zord, FILES.warzord);
    addItem(zord, { name: 'Combiner', type: 'feature', _stats: { compendiumSource: 'Compendium.essence20.pr_crb.Item.ZZMBVjmosr0VViMU' } });
    const mega = megazord([zord, makeActor('zord', 'Z2'), makeActor('zord', 'Z3')]);
    await megaformExt.onRosterChanged(mega);
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('1 Story Point per Zord combining with it (2)');
    await megaformExt.onRosterChanged(mega);
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
    // Without the Combiner Feature: no reminder.
    const plain = makeActor('zord', 'Plain Warzord');
    addPackItem(plain, FILES.warzord);
    ChatMessage.create.mockClear();
    await megaformExt.onRosterChanged(megazord([plain]));
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });
});


/* -------------------------------------------- */
/*  Size classes                                 */
/* -------------------------------------------- */

const SIZE_FILES = {
  enlarged: 'ccitems/_source/Enlarged_JPcfpND1LOVLDKIZ.json',
  shrunk: 'ccitems/_source/Shrunk_nvyLaYW6EOcAdHDo.json',
  shapeShift: 'dsoeitems/_source/Revolutionary_Shape_Shifting_ojIyM3QMD0QgRGca.json',
  bigRigger: 'iafav2items/_source/Big_Rigger_XRn8pnRtJVdaxTC6.json',
  biggerRigger: 'iafav2items/_source/Bigger_Rigger_vU2UK40cwyMPJJ83.json',
  tss: 'atsitems/_source/Tactical_Size_Shift_tS3P7BZqnH9GGLux.json',
  warriorMode: 'prcrbitems/_source/Warrior_Mode_RsrUlBazkPwpRfxi.json',
  mesh: 'ttsgitems/_source/Mesh_Zord_3b3GBTixZORshVzf.json',
  hybridization: 'tfcrbitems/_source/Hybridization_R5SobOsimfa7mvdy.json',
};

/** The text the next askText step gets (the dialog it would open). */
function answerText(text) {
  global.foundry.applications = { api: { DialogV2: { prompt: async () => text } } };
}

describe('Size classes as data', () => {
  test('the rules validate', () => {
    for (const file of Object.values(SIZE_FILES)) {
      for (const rule of packRules(file)) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }
    }
  });

  test('Enlarged / Shrunk: one size class on the ladder when added, back when removed', async () => {
    const big = makeActor('playerCharacter', 'Big', { size: 'extended' });
    const enlarged = addPackItem(big, SIZE_FILES.enlarged);
    await fireItemAdded(big, enlarged);
    expect(big.system.size).toBe('gigantic');
    expect(enlarged.flags.essence20.rules.choices.originalSize).toBe('extended');
    await fireItemAdded(big, enlarged);
    expect(big.system.size).toBe('gigantic');
    await fireItemAdded(big, enlarged, { event: 'removed' });
    expect(big.system.size).toBe('extended');

    const small = makeActor('playerCharacter', 'Small', { size: 'small' });
    const shrunk = addPackItem(small, SIZE_FILES.shrunk);
    await fireItemAdded(small, shrunk);
    expect(small.system.size).toBe('small');

    // A copy added before the rules kept its old size in the old flag.
    const old = makeActor('playerCharacter', 'Old', { size: 'large' });
    const legacy = addPackItem(old, SIZE_FILES.shrunk, { flags: { essence20: { zord1OriginalSize: 'huge' } } });
    await fireItemAdded(old, legacy);
    expect(old.system.size).toBe('large');
    await fireItemAdded(old, legacy, { event: 'removed' });
    expect(old.system.size).toBe('huge');
  });

  test('Enlarged / Shrunk: Battledress needs the Accommodation upgrade', () => {
    const { checkAccommodation } = sizeExt;
    global.ui = { notifications: { warn: jest.fn() } };
    const actor = makeActor('playerCharacter', 'Big', { size: 'large' });
    addPackItem(actor, SIZE_FILES.enlarged);
    const armor = addItem(actor, { name: 'Battledress', type: 'armor', system: { items: {} } });
    expect(checkAccommodation(armor, { system: { equipped: true } })).toBe(false);
    armor.system.items = { u: { name: 'Limited Alteration Accommodation' } };
    expect(checkAccommodation(armor, { system: { equipped: true } })).toBe(false);
    armor.system.items = { u: { name: 'Restricted Alteration Accommodation' } };
    expect(checkAccommodation(armor, { system: { equipped: true } })).toBe(true);
    expect(checkAccommodation(armor, { system: { equipped: false } })).toBe(true);

    const small = makeActor('playerCharacter', 'Small');
    addPackItem(small, SIZE_FILES.shrunk);
    const suit = addItem(small, { name: 'Battledress', type: 'armor', system: { items: {} } });
    expect(checkAccommodation(suit, { system: { equipped: true } })).toBe(false);
    addItem(small, { name: 'Limited Alteration Accommodation', type: 'upgrade', flags: { essence20: { parentId: suit.id } } });
    expect(checkAccommodation(suit, { system: { equipped: true } })).toBe(true);
    expect(ui.notifications.warn).toHaveBeenCalledTimes(3);
  });

  test('Revolutionary Shape-Shifting: take a shape (and a size) for the scene, a ↑1 switch, end it', async () => {
    const pony = makeActor('playerCharacter', 'Pony', { size: 'common' });
    const spell = addPackItem(pony, SIZE_FILES.shapeShift);
    const use = pick => runUse(spell, async () => true, { ask: async (step, options) => options.findIndex(option => option.label == pick) });
    answerText('');
    expect(await use('One size larger')).toBeNull();
    expect(pony.system.size).toBe('common');
    answerText('Dragon');
    expect(await use('One size larger')).toContain('Pony takes the shape of Dragon.');
    expect(pony.system.size).toBe('large');
    expect(ruleDialogSwitches(pony, { rolledSkill: 'athletics' })).toEqual([
      expect.objectContaining({ label: 'Suited to your Dragon shape (↑1)', value: false }),
    ]);
    expect(await use('x')).toContain('Pony returns to their own shape.');
    expect(pony.system.size).toBe('common');
    expect(ruleDialogSwitches(pony, { rolledSkill: 'athletics' })).toEqual([]);

    // The same size: no size change, the switch all the same.
    answerText('Cat');
    await use('The same size');
    expect(pony.system.size).toBe('common');
    expect(ruleDialogSwitches(pony, { rolledSkill: 'athletics' })).toHaveLength(1);
    await use('x');

    // A new scene ends it, size and all.
    answerText('Bear');
    await use('One size larger');
    expect(pony.system.size).toBe('large');
    sceneEpoch = 2;
    await fireTriggers(pony, 'sceneStart');
    expect(pony.system.size).toBe('common');
    expect(ruleDialogSwitches(pony, { rolledSkill: 'athletics' })).toEqual([]);
  });

  test('Big Rigger / Bigger Rigger: no size upshifts against the vehicle they drive', () => {
    const { sizeMatrixCancel } = sizeExt;
    const driver = makeActor('playerCharacter', 'Driver');
    const truck = makeActor('vehicle', 'Truck', { size: 'gigantic', actors: { d: { vehicleRole: 'driver', uuid: driver.uuid } } });
    const soldier = makeActor('npc', 'Soldier', { size: 'common' });
    expect(sizeMatrixCancel(soldier, truck, 'toughness')).toBeNull();
    addPackItem(driver, SIZE_FILES.bigRigger);
    expect(sizeMatrixCancel(soldier, truck, 'toughness')).toEqual({ label: 'Big Rigger', shift: 2 });
    expect(sizeMatrixCancel(soldier, truck, undefined)).toEqual({ label: 'Big Rigger', shift: 2 });
    expect(sizeMatrixCancel(soldier, truck, 'evasion')).toBeNull();
    expect(sizeMatrixCancel(makeActor('npc', 'Giant', { size: 'gigantic' }), truck, 'toughness')).toBeNull();

    const other = makeActor('playerCharacter', 'Other');
    const bike = makeActor('vehicle', 'Bike', { size: 'huge', actors: { d: { vehicleRole: 'driver', uuid: other.uuid } } });
    addPackItem(other, SIZE_FILES.biggerRigger);
    const car = makeActor('vehicle', 'Car', { size: 'common' });
    expect(sizeMatrixCancel(car, bike, 'toughness')).toEqual({ label: 'Bigger Rigger', shift: 1 });
    expect(sizeMatrixCancel(soldier, bike, 'toughness')).toBeNull();
    expect(sizeMatrixCancel(car, bike, 'evasion')).toBeNull();
    // Both: Big Rigger's reading wins.
    addPackItem(other, SIZE_FILES.bigRigger);
    expect(sizeMatrixCancel(car, bike, 'toughness')).toEqual({ label: 'Big Rigger', shift: 1 });
  });

  test('Tactical Size Shift, Warzord, Warrior Mode and Mesh Zord sizes', () => {
    const { sizeDerived } = sizeExt;
    const zord = makeActor('zord', 'Zord', { size: 'huge' });
    addPackItem(zord, SIZE_FILES.tss, { flags: { essence20: { pr1SizeShift: { direction: 'larger' } } } });
    sizeDerived(zord);
    expect(zord.system.size).toBe('extended');
    addPackItem(zord, SIZE_FILES.tss, { flags: { essence20: { pr1SizeShift: { direction: 'larger' } } } });
    zord.system.size = 'huge';
    sizeDerived(zord);
    expect(zord.system.size).toBe('gigantic');
    zord.system.size = 'towering';
    sizeDerived(zord);
    expect(zord.system.size).toBe('towering');
    zord.system.size = 'titanic';
    sizeDerived(zord);
    expect(zord.system.size).toBe('titanic');

    const shrinking = makeActor('zord', 'Small Zord', { size: 'huge' });
    addPackItem(shrinking, SIZE_FILES.tss, { flags: { essence20: { pr1SizeShift: { direction: 'smaller' } } } });
    addPackItem(shrinking, SIZE_FILES.tss, { flags: { essence20: { pr1SizeShift: { direction: 'smaller' } } } });
    sizeDerived(shrinking);
    expect(shrinking.system.size).toBe('long');

    const war = makeActor('zord', 'War', { size: 'huge' });
    addPackItem(war, SIZE_FILES.tss, { flags: { essence20: { pr1SizeShift: { direction: 'smaller' } } } });
    addPackItem(war, FILES.warzord);
    sizeDerived(war);
    expect(war.system.size).toBe('titanic');

    const warrior = makeActor('zord', 'Warrior', { size: 'huge' });
    addPackItem(warrior, SIZE_FILES.warriorMode);
    sizeDerived(warrior);
    expect(warrior.system.size).toBe('huge');
    warrior.flags.essence20.warriorModeActive = true;
    sizeDerived(warrior);
    expect(warrior.system.size).toBe('towering');
    warrior.system.size = 'titanic';
    sizeDerived(warrior);
    expect(warrior.system.size).toBe('titanic');

    const mesh = makeActor('zord', 'Mesh', { size: 'large' });
    addPackItem(mesh, SIZE_FILES.mesh);
    sizeDerived(mesh);
    expect(mesh.system.size).toBe('towering');
    // Not on a character.
    const pc = makeActor('playerCharacter', 'PC', { size: 'common' });
    addPackItem(pc, FILES.warzord);
    sizeDerived(pc);
    expect(pc.system.size).toBe('common');
  });

  test('Hybridization (Change Size): one rung up or down while the Mass Shift lasts', () => {
    const { sizeDerived } = sizeExt;
    const bot = makeActor('playerCharacter', 'Bot', { size: 'common' });
    addPackItem(bot, SIZE_FILES.hybridization, { flags: { essence20: { zord2Hybrid: 'changeSize' } } });
    addPackItem(bot, SIZE_FILES.hybridization, { flags: { essence20: { zord2Hybrid: 'extraShift' } } });
    sizeDerived(bot);
    expect(bot.system.size).toBe('common');
    bot.flags.essence20.zord2HybridSize = { epoch: 1, window: 'scene', count: 1 };
    sizeDerived(bot);
    expect(bot.system.size).toBe('large');
    bot.system.size = 'common';
    bot.flags.essence20.zord2HybridSizeDir = -1;
    sizeDerived(bot);
    expect(bot.system.size).toBe('small');
    bot.system.size = 'small';
    sizeDerived(bot);
    expect(bot.system.size).toBe('small');
  });
});

/* -------------------------------------------- */
/*  A Ranger and their Zords                     */
/* -------------------------------------------- */

const ZORD_FILES = {
  rex: 'jttitems/_source/Rex_Feature_tOugALzdjmKHD8Ck.json',
  additional: 'jttitems/_source/Additional_Zord_FubfmphdFHTJR1s5.json',
  terrorzord: 'bthitems/_source/Terrorzord_Nature_ijVB6KM95RagxKQp.json',
  phantomFocus: 'atsitems/_source/Phantom_Focus_aXGMEoVsYSttOSHn.json',
  skyMorpher: 'jttitems/_source/Sky_Morpher_2FlXYjY1AFSFq8Jz.json',
  dataLink: 'qgtgitems/_source/Data_Link_nRL1FJLtAEIbXozX.json',
  powerMatrix: 'ttsgitems/_source/Power_Matrix_c9VPGmGTxQuilsYh.json',
  mesh: 'ttsgitems/_source/Mesh_Zord_3b3GBTixZORshVzf.json',
};
const TERROR = 'Compendium.essence20.beneath_the_helmet.Item.yBBB0Mi6fr84YcSd';
const AUX = 'Compendium.essence20.pr_crb.Item.QO0kY1y359tSnPTS';

/** A Ranger with these Zords on their sheet. */
function ranger(name, zords = [], system = {}) {
  return makeActor('playerCharacter', name, {
    actors: Object.fromEntries(zords.map((zord, i) => [`z${i}`, { type: 'zord', uuid: zord.uuid }])),
    powers: { personal: { value: 3, max: 5 } }, ...system,
  });
}

const driving = (vehicle, actor, role = 'driver') => {
  vehicle.system.actors = { ...(vehicle.system.actors ?? {}), [`c${actor.id}`]: { uuid: actor.uuid, vehicleRole: role } };
};

describe('A Ranger and their Zords', () => {
  test('the rules validate', () => {
    for (const file of Object.values(ZORD_FILES)) {
      for (const rule of packRules(file)) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }
    }
  });

  test('Rex Feature: a Zord Feature the Ranger\'s own Zord doesn\'t have, when added and from its Use', async () => {
    const zord = makeActor('zord', 'Rex');
    addItem(zord, { name: 'Held', type: 'feature', _stats: { compendiumSource: 'Compendium.x.Item.held' } });
    const pilot = ranger('Quantum', [zord]);
    const perk = addPackItem(pilot, ZORD_FILES.rex);
    findItems.mockResolvedValue([{ uuid: 'Compendium.x.Item.held', name: 'Held' }, { uuid: 'Compendium.x.Item.new', name: 'New' }]);
    pickOne.mockResolvedValue('Compendium.x.Item.new');
    grantCopy.mockResolvedValue({ name: 'New' });
    await fireItemAdded(pilot, perk);
    const { matches, type } = findItems.mock.calls[0][0];
    expect(type).toBe('feature');
    expect(matches({ uuid: 'Compendium.x.Item.held', name: 'Held' })).toBe(false);
    expect(matches({ uuid: 'Compendium.x.Item.new', name: 'New' })).toBe(true);
    expect(grantCopy).toHaveBeenCalledWith(zord, 'Compendium.x.Item.new', expect.objectContaining({ grantedBy: perk }));
    expect(chooseSelect).not.toHaveBeenCalled();
    // The Use asks which Zord when there are two.
    const second = makeActor('zord', 'Second');
    pilot.system.actors.z1 = { type: 'zord', uuid: second.uuid };
    chooseSelect.mockResolvedValue(second.uuid);
    await runUse(perk, async () => true);
    expect(grantCopy).toHaveBeenLastCalledWith(second, 'Compendium.x.Item.new', expect.objectContaining({ grantedBy: perk }));
    // Not on a Zord itself.
    grantCopy.mockClear();
    const onZord = addPackItem(makeActor('zord', 'Z'), ZORD_FILES.rex);
    await fireItemAdded(onZord.parent, onZord);
    expect(grantCopy).not.toHaveBeenCalled();
  });

  test('Additional Zord: Auxiliary Zord (once) and two Zord Features on the new Zord', async () => {
    const zord = makeActor('zord', 'New Zord');
    const pilot = ranger('Ranger', [zord]);
    const perk = addPackItem(pilot, ZORD_FILES.additional);
    global.fromUuid = async uuid => (uuid == AUX ? { toObject: () => ({ name: 'Auxiliary Zord', type: 'feature', system: {} }) } : global.fromUuidSync(uuid));
    findItems.mockResolvedValue([{ uuid: 'Compendium.x.Item.a', name: 'A' }, { uuid: 'Compendium.x.Item.b', name: 'B' }]);
    pickOne.mockResolvedValueOnce('Compendium.x.Item.a').mockResolvedValueOnce('Compendium.x.Item.b');
    grantCopy.mockImplementation(async (actor, uuid) => addItem(actor, { name: uuid.slice(-1), type: 'feature', _stats: { compendiumSource: uuid } }));
    await runUse(perk, async () => true);
    expect(zord.items.contents.map(item => item.name)).toEqual(['Auxiliary Zord', 'a', 'b']);
    expect(zord.items.contents[0].flags.essence20.grantedBy).toBe(perk.id);
    // The second Feature pick leaves out the first.
    expect(findItems.mock.calls[1][0].matches({ uuid: 'Compendium.x.Item.a' })).toBe(false);
    // Again: no second Auxiliary Zord; a cancelled pick stops there.
    zord.items.contents[0]._stats = { compendiumSource: AUX };
    pickOne.mockResolvedValue(null);
    await runUse(perk, async () => true);
    expect(zord.items.contents.filter(item => item.name == 'Auxiliary Zord')).toHaveLength(1);
  });

  test('Additional Zord: one of the Ranger\'s Zords per scene', () => {
    const { checkSummonLimit } = zordsExt;
    global.ui = { notifications: { warn: jest.fn() } };
    const zordA = makeActor('zord', 'A');
    const zordB = makeActor('zord', 'B');
    const pilot = ranger('Ranger', [zordA, zordB]);
    const summon = { flags: { essence20: { zordSummonReadyRound: 3 } } };
    expect(checkSummonLimit(zordB, summon, 1)).toBe(true);
    addPackItem(pilot, ZORD_FILES.additional);
    pilot.flags.essence20.zord1ActiveZord = { epoch: 1, uuid: zordA.uuid };
    expect(checkSummonLimit(zordA, summon, 1)).toBe(true);
    expect(checkSummonLimit(zordB, summon, 1)).toBe(false);
    expect(checkSummonLimit(zordB, summon, 2)).toBe(true);
    expect(checkSummonLimit(zordB, { flags: {} }, 1)).toBe(true);
  });

  test('Terrorzord Nature: Smarts 5 / Social 4 (not in Megafauna Form), Terror spent for ↑1 each by the pilot', async () => {
    const zord = makeActor('zord', 'Terrorzord', { essences: { smarts: { value: 1 }, social: { value: 1 } } });
    const pilot = ranger('Dark Ranger', [zord]);
    addPackItem(pilot, ZORD_FILES.terrorzord);
    ruleDerived(zord);
    expect(zord.system.essences).toMatchObject({ smarts: { value: 5 }, social: { value: 4 } });
    const beast = makeActor('zord', 'Beast', { essences: { smarts: { value: 3 }, social: { value: 3 } } });
    addItem(beast, { name: 'Megafauna', type: 'feature', _stats: { compendiumSource: 'Compendium.essence20.across_the_stars.Item.c6plguiUVmJzGNsw' } });
    beast.flags.essence20.zord1Megafauna = true;
    pilot.system.actors.z1 = { type: 'zord', uuid: beast.uuid };
    ruleDerived(beast);
    expect(beast.system.essences).toMatchObject({ smarts: { value: 3 }, social: { value: 3 } });

    // No Terror Perk: no switch. With it: a number box up to the pilot's Terror, paid by the pilot.
    expect(ruleDialogSwitches(zord, { rolledSkill: 'might' })).toEqual([]);
    addItem(pilot, { name: 'Terror', type: 'perk', _stats: { compendiumSource: TERROR } });
    const terror = addItem(pilot, { name: 'Terror Points', type: 'rolePoints', system: { resource: { value: 2, max: 5 } } });
    pilot._getBaseRolePoints = () => terror;
    const [box] = ruleDialogSwitches(zord, { rolledSkill: 'might' });
    expect(box).toMatchObject({ type: 'number', max: 2, label: 'Spend Terror on the Terrorzord (↑1 each)' });
    const { applyRuleSwitches } = await import('./adapter.mjs');
    const options = { ext: { [box.name]: 2 }, shiftUp: 0 };
    await applyRuleSwitches(zord, options, { rolledSkill: 'might' });
    expect(options.shiftUp).toBe(2);
    expect(terror.system.resource.value).toBe(0);
    // The pilot's own Driving while driving it.
    terror.system.resource.value = 1;
    driving(zord, pilot);
    expect(ruleDialogSwitches(pilot, { rolledSkill: 'driving' })).toEqual([expect.objectContaining({ type: 'number', max: 1 })]);
    expect(ruleDialogSwitches(pilot, { rolledSkill: 'athletics' })).toEqual([]);
  });

  test('Terrorzord Nature: a natural 1 while driving it costs the pilot 1 Personal Power; the control roll offer', async () => {
    const zord = makeActor('zord', 'Terrorzord', { essences: {} });
    const pilot = ranger('Dark Ranger', [zord]);
    addPackItem(pilot, ZORD_FILES.terrorzord);
    driving(zord, pilot);
    await fireTriggers(zord, 'afterRoll', { outcome: 'fumble', facts: { results: [], isFumble: true } });
    expect(pilot.system.powers.personal.value).toBe(2);
    await fireTriggers(pilot, 'afterRoll', { outcome: 'fumble', facts: { results: [], isFumble: true } });
    expect(pilot.system.powers.personal.value).toBe(1);
    await fireTriggers(zord, 'afterRoll', { outcome: 'failure', facts: { results: [], isFumble: false } });
    expect(pilot.system.powers.personal.value).toBe(1);
    // Someone else driving: the Zord's natural 1 costs nothing.
    zord.system.actors = { x: { uuid: makeActor('playerCharacter', 'Other').uuid, vehicleRole: 'driver' } };
    await fireTriggers(zord, 'afterRoll', { outcome: 'fumble', facts: { results: [], isFumble: true } });
    expect(pilot.system.powers.personal.value).toBe(1);

    ChatMessage.create.mockClear();
    await fireTriggers(pilot, 'turnStart');
    expect(ChatMessage.create).not.toHaveBeenCalled();
    zord.getActiveTokens = () => [{}];
    await fireTriggers(pilot, 'turnStart');
    expect(ChatMessage.create.mock.calls[0][0].flags.essence20.ruleButton.steps[0]).toMatchObject({ do: 'roll', skill: 'driving', dif: 10 });
  });

  test('Phantom Focus (Ship Integration): 1 Power while piloting; the ship gets the Phantom Suite and Unseen Strike', async () => {
    const { ruleDefenseAdjust } = await import('./adapter.mjs');
    const ship = makeActor('vehicle', 'Phantom Ship', { defenses: { evasion: { total: 12 } } });
    const pilot = makeActor('playerCharacter', 'Phantom', { powers: { personal: { value: 2, max: 4 } } });
    const focus = addPackItem(pilot, ZORD_FILES.phantomFocus, { system: { choice: 'shipIntegration' } });
    addItem(pilot, { name: 'Phantom Suite', type: 'perk', system: { advances: { currentValue: 3 } }, _stats: { compendiumSource: 'Compendium.essence20.across_the_stars.Item.fQgxo5c7tNOD2Q5K' } });
    expect(await runUse(focus, async () => true)).toBeNull();
    driving(ship, pilot);
    expect(await runUse(focus, async () => true)).toContain('Phantom integrates the ship');
    expect(pilot.system.powers.personal.value).toBe(1);
    expect(ship.flags.essence20.ruleMarks.zord1ShipIntegration.by).toBe(pilot.uuid);
    // Suite off: nothing. On: ↑1 Edge on the ship's Infiltration, +3 Evasion.
    expect(ruleRollSources(ship, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
    pilot.flags.essence20.phantomSuiteActive = true;
    expect(ruleRollSources(ship, null, { rolledSkill: 'infiltration' }).sources).toEqual([expect.objectContaining({ shiftUp: 1, edge: true })]);
    expect(ruleDefenseAdjust(null, ship, 'evasion', { difficulty: 12 })).toBe(3);
    expect(ruleDefenseAdjust(null, ship, 'toughness', { difficulty: 12 })).toBe(0);
    // Unseen Strike: the ship's first attack each turn halves the target's Evasion.
    const target = makeActor('npc', 'Foe');
    const effect = addItem(ship, { name: 'Cannon', type: 'weaponEffect' });
    expect(ruleDefenseAdjust(ship, target, 'evasion', { difficulty: 11, item: effect })).toBe(0);
    addItem(pilot, { name: 'Unseen Strike', type: 'perk', _stats: { compendiumSource: 'Compendium.essence20.across_the_stars.Item.EYdpn9PL4iNrQPkh' } });
    expect(ruleDefenseAdjust(ship, target, 'evasion', { difficulty: 11, item: effect })).toBe(-5);
    // Someone else driving the ship: it isn't integrated for them.
    ship.system.actors = { o: { uuid: makeActor('playerCharacter', 'Other').uuid, vehicleRole: 'driver' } };
    expect(ruleRollSources(ship, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
    driving(ship, pilot);
    ship.system.actors = { p: { uuid: pilot.uuid, vehicleRole: 'driver' } };
    expect(await runUse(focus, async () => true)).toContain('ends the ship integration');
    expect(ruleRollSources(ship, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
  });

  test('Sky Morpher: ↑1 Driving their own Zord, rolled by the Ranger or by the Zord', () => {
    const zord = makeActor('zord', 'Zord');
    const pilot = ranger('Ranger', [zord]);
    addPackItem(pilot, ZORD_FILES.skyMorpher);
    expect(ruleRollSources(pilot, null, { rolledSkill: 'driving' }).sources).toEqual([]);
    driving(zord, pilot);
    expect(ruleRollSources(pilot, null, { rolledSkill: 'driving' }).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(ruleRollSources(zord, null, { rolledSkill: 'driving' }).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(ruleRollSources(pilot, null, { rolledSkill: 'might' }).sources).toEqual([]);
    // Someone else's Zord.
    const other = makeActor('zord', 'Borrowed');
    zord.system.actors = {};
    driving(other, pilot);
    expect(ruleRollSources(pilot, null, { rolledSkill: 'driving' }).sources).toEqual([]);
    expect(ruleRollSources(other, null, { rolledSkill: 'driving' }).sources).toEqual([]);
  });

  test('Data-Link: an un-Commanded drone gives its owner +1 Evasion until their next turn', async () => {
    const { ruleDefenseAdjust } = await import('./adapter.mjs');
    global.game.combat = { id: 'c1', round: 2, turn: 0, started: true, turns: [] };
    const owner = makeActor('playerCharacter', 'Owner');
    const drone = makeActor('companion', 'Drone', { type: 'drone' });
    drone.flags.essence20.companionOf = owner.uuid;
    addPackItem(drone, ZORD_FILES.dataLink);
    await fireTriggers(owner, 'turnEnd');
    expect(owner.flags.essence20.ruleMarks.dataLink).toBeTruthy();
    expect(ruleDefenseAdjust(null, owner, 'evasion', { difficulty: 10 })).toBe(1);
    expect(ruleDefenseAdjust(null, owner, 'toughness', { difficulty: 10 })).toBe(0);
    // Commanded this round: nothing.
    delete owner.flags.essence20.ruleMarks;
    drone.flags.essence20.petCommand = { combatId: 'c1', round: 2 };
    await fireTriggers(owner, 'turnEnd');
    expect(owner.flags.essence20.ruleMarks).toBeUndefined();
    // Bought on the owner's sheet: any of their drones.
    const loose = makeActor('playerCharacter', 'Loose');
    addPackItem(loose, ZORD_FILES.dataLink);
    const idle = makeActor('companion', 'Idle', { type: 'drone' });
    idle.flags.essence20.companionOf = loose.uuid;
    await fireTriggers(loose, 'turnEnd');
    expect(ruleDefenseAdjust(null, loose, 'evasion', { difficulty: 10 })).toBe(1);
    global.game.combat = null;
  });

  test('Power Matrix: the driver draws from a reserve of 3 per copy (up to 9), refilled when the pilot rests', async () => {
    const zord = makeActor('zord', 'Matrix Zord');
    const feature = addPackItem(zord, ZORD_FILES.powerMatrix);
    addPackItem(zord, ZORD_FILES.powerMatrix);
    const pilot = ranger('Ranger', [zord]);
    zord.flags.essence20.zord2PowerMatrixSpent = 2;
    global.foundry.applications = { api: { DialogV2: { prompt: async () => 4 } } };
    const run = () => runUse(feature, async () => true);
    expect(await run()).toContain('Nobody is driving the Zord.');
    driving(zord, pilot);
    expect(await run()).toContain('feeds 4 Personal Power to its driver (0 left)');
    expect(pilot.system.powers.personal.value).toBe(7);
    expect(zord.flags.essence20.zord2PowerMatrixSpent).toBe(6);
    expect(await run()).toContain('The Power Matrix is empty.');
    await fireTriggers(pilot, 'rest');
    expect(zord.flags.essence20.zord2PowerMatrixSpent).toBe(0);
  });

  test('Mesh Zord: three different Megaform Traits on the Zord itself', async () => {
    const zord = makeActor('zord', 'Mesh', {
      health: { value: 6, max: 6 }, essences: { strength: { value: 5 }, speed: { value: 3 } }, movement: { ground: { total: 30 } }, immunities: {},
      defenses: { toughness: { total: 10, string: '10' }, evasion: { total: 10, string: '10' } },
    });
    const mesh = addPackItem(zord, ZORD_FILES.mesh);
    chooseSelect.mockResolvedValueOnce('coreBody').mockResolvedValueOnce('coreDefenses').mockResolvedValueOnce('coreAbilityStrength');
    await fireItemAdded(zord, mesh);
    expect(mesh.flags.essence20.rules.choices).toMatchObject({ mesh1: 'coreBody', mesh2: 'coreDefenses', mesh3: 'coreAbilityStrength' });
    expect(chooseSelect.mock.calls[1][2].map(option => option.value)).not.toContain('coreBody');
    expect(chooseSelect.mock.calls[2][2].map(option => option.value)).not.toContain('coreDefenses');
    ruleDerived(zord);
    expect(zord.system).toMatchObject({ health: { max: 12 }, essences: { strength: { value: 6 } } });
    expect(zord.system.defenses.toughness.total).toBe(12);
    expect(zord.system.defenses.evasion.total).toBe(11);
    // In a Megazord: the Essence step aside, and its Core Body doesn't double again with a real Core Body Trait.
    const mega = megazord([zord]);
    addItem(zord, { name: 'Core Body', type: 'megaformTrait', system: { type: 'coreBody' } });
    Object.assign(zord.system, { health: { value: 6, max: 6 }, essences: { strength: { value: 5 }, speed: { value: 3 } } });
    ruleDerived(zord);
    expect(zord.system).toMatchObject({ health: { max: 6 }, essences: { strength: { value: 5 } } });
    expect(mega.type).toBe('megaform');
  });

  test('Mesh Zord: the rest of the list (Layered Systems, Move, Grounding, Defender, Core Ability Speed)', () => {
    const zord = makeActor('zord', 'Mesh', {
      health: { value: 6, max: 6 }, essences: { strength: { value: 5 }, speed: { value: 3 } }, movement: { ground: { total: 30 } }, immunities: {},
      defenses: { toughness: { total: 10, string: '10' }, evasion: { total: 10, string: '10' } },
    });
    addPackItem(zord, ZORD_FILES.mesh, { flags: { essence20: { rules: { choices: { mesh1: 'layeredSystems', mesh2: 'move', mesh3: 'grounding' } } } } });
    ruleDerived(zord);
    expect(zord.system).toMatchObject({ health: { max: 9 }, movement: { ground: { total: 40 } }, immunities: { emp: true } });
    const other = makeActor('zord', 'Mesh 2', {
      health: { value: 6, max: 6 }, essences: { strength: { value: 5 }, speed: { value: 3 } }, movement: { ground: { total: 30 } }, immunities: {},
      defenses: { toughness: { total: 10, string: '10' }, evasion: { total: 10, string: '10' } },
    });
    addPackItem(other, ZORD_FILES.mesh, { flags: { essence20: { rules: { choices: { mesh1: 'defender', mesh2: 'coreAbilitySpeed', mesh3: '' } } } } });
    ruleDerived(other);
    expect(other.system.essences.speed.value).toBe(4);
    expect(other.system.defenses.toughness.total).toBe(11);
    expect(other.system.defenses.evasion.total).toBe(11);
  });
});

/* -------------------------------------------- */
/*  Helper hooks                                 */
/* -------------------------------------------- */

const HOOK_FILES = {
  expeditor: 'prcrbitems/_source/Megaform_Expeditor_NJfcNgMJYcatsTCB.json',
  uwSmall: 'prcrbitems/_source/Unique_Weapon_Small_Melee__Pr3UniqWpnSmallM.json',
  uwTwoHanded: 'prcrbitems/_source/Unique_Weapon_Two_Handed_Melee__Pr3UniqWpnTwoHnd.json',
  dinoGem: 'bthitems/_source/Advanced_Dino_Gem_Integration_K4CUMFhAjXRFzGbA.json',
  peerlessPr: 'prcrbitems/_source/Peerless_Pilot_dHDCKO4k7dlzyXbC.json',
  peerlessGij: 'gijcrbitems/_source/Peerless_Pilot_y39VC0CIsI8mdLKK.json',
  bendPhysics: 'bthitems/_source/Bend_Physics_EITAjh6GBuc2SVSY.json',
  emissary: 'ttsgitems/_source/Emissary_s_Gift_L3ps91zsJJQl71cw.json',
  emotionalRange: 'jttitems/_source/Emotional_Range_lhUy6M5juoCvCVBd.json',
};

describe('Rule hooks in hand-written helpers', () => {
  test('the rules validate', () => {
    for (const file of Object.values(HOOK_FILES)) {
      for (const rule of packRules(file)) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }
    }
  });

  test('Megaform Expeditor: the Ranger\'s Zord joins 1d4 rounds sooner, at least 1', () => {
    const { ruleJoinTime } = hooksExt;
    const zord = makeActor('zord', 'Zord');
    const pilot = ranger('Ranger', [zord]);
    expect(ruleJoinTime(zord, 5, () => 0.5)).toBe(5);
    addPackItem(pilot, HOOK_FILES.expeditor);
    expect(ruleJoinTime(zord, 5, () => 0.25)).toBe(3);
    expect(ruleJoinTime(zord, 3, () => 0.99)).toBe(1);
    expect(ruleJoinTime(makeActor('zord', 'Other'), 5, () => 0.25)).toBe(5);
  });

  test('Unique Weapon (Small Melee) halves the summon (rounded up, at least 1); Genetic Resonance brings it 2 rounds sooner', () => {
    const { ruleSummonRounds } = hooksExt;
    const pilot = makeActor('playerCharacter', 'Green Ranger');
    const zord = makeActor('zord', 'Dragonzord');
    expect(ruleSummonRounds(pilot, zord, 5)).toBe(5);
    const weapon = addPackItem(pilot, HOOK_FILES.uwSmall);
    expect(ruleSummonRounds(pilot, zord, 5)).toBe(3);
    expect(ruleSummonRounds(pilot, zord, 1)).toBe(1);
    weapon.system.equipped = false;
    rebuildIndex(pilot);
    expect(ruleSummonRounds(pilot, zord, 5)).toBe(5);
    addPackItem(zord, HOOK_FILES.dinoGem, { flags: { essence20: { rules: { choices: { gem: 'resonance' } } } } });
    expect(ruleSummonRounds(pilot, zord, 5)).toBe(3);
    expect(ruleSummonRounds(pilot, zord, 2)).toBe(1);
    weapon.system.equipped = true;
    rebuildIndex(pilot);
    expect(ruleSummonRounds(pilot, zord, 6)).toBe(1);
    const legacy = makeActor('zord', 'Old');
    addPackItem(legacy, HOOK_FILES.dinoGem, { flags: { essence20: { pr1DinoGem: 'resonance' } } });
    expect(ruleSummonRounds(null, legacy, 6)).toBe(4);
    const shield = makeActor('zord', 'Shield');
    addPackItem(shield, HOOK_FILES.dinoGem, { flags: { essence20: { rules: { choices: { gem: 'shield' } } } } });
    expect(ruleSummonRounds(null, shield, 6)).toBe(6);
  });

  test('Peerless Pilot: the emergency disembark passes outright (PR: the driver; GI Joe: whoever pilots it)', () => {
    const { ruleAutoDisembark } = hooksExt;
    const pr = makeActor('playerCharacter', 'PR');
    addPackItem(pr, HOOK_FILES.peerlessPr);
    const vehicle = makeActor('vehicle', 'Car', { actors: { a: { uuid: pr.uuid, vehicleRole: 'driver' } } });
    expect(ruleAutoDisembark(pr, { vehicleRole: 'driver' }, vehicle)).toBe(true);
    expect(ruleAutoDisembark(pr, { vehicleRole: 'passenger' }, vehicle)).toBe(false);
    expect(ruleAutoDisembark(makeActor('playerCharacter', 'X'), { vehicleRole: 'driver' }, vehicle)).toBe(false);
    const joe = makeActor('playerCharacter', 'Joe');
    addPackItem(joe, HOOK_FILES.peerlessGij);
    expect(ruleAutoDisembark(joe, { vehicleRole: 'driver' }, vehicle)).toBe(true);
    expect(ruleAutoDisembark(joe, { vehicleRole: 'passenger' }, vehicle)).toBe(false);
    const driverless = makeActor('vehicle', 'Drifter', { actors: { a: { uuid: joe.uuid, vehicleRole: 'passenger' } } });
    expect(ruleAutoDisembark(joe, { vehicleRole: 'passenger' }, driverless)).toBe(true);
    expect(ruleAutoDisembark(pr, { vehicleRole: 'passenger' }, driverless)).toBe(false);
  });

  test('Peerless Pilot (PR CRB): Edge on Initiative and Driving while driving with a d6+ Driving Specialization', () => {
    const pilot = makeActor('playerCharacter', 'Pilot', { skills: { driving: { specializations: { s: { name: 'Bikes', shift: 'd6' } } } } });
    addPackItem(pilot, HOOK_FILES.peerlessPr);
    const car = makeActor('vehicle', 'Car');
    expect(ruleRollSources(pilot, null, { rolledSkill: 'driving' }).sources).toEqual([]);
    driving(car, pilot);
    expect(ruleRollSources(pilot, null, { rolledSkill: 'driving', dataset: {} }).sources).toEqual([expect.objectContaining({ edge: true })]);
    expect(ruleRollSources(pilot, null, { rolledSkill: 'initiative', dataset: { isInitiative: true } }).sources).toEqual([expect.objectContaining({ edge: true })]);
    expect(ruleRollSources(pilot, null, { rolledSkill: 'targeting' }).sources).toEqual([]);
    pilot.system.skills.driving.specializations.s.shift = 'd4';
    expect(ruleRollSources(pilot, null, { rolledSkill: 'driving', dataset: {} }).sources).toEqual([]);
  });

  test('Bend Physics: Morphed Rangers of the holder\'s team double their Movement (once); Unique Weapon (Two-Handed) -10 ft', () => {
    const { applyDerivedHookMovement } = hooksExt;
    const BEND = 'Compendium.essence20.beneath_the_helmet.Item.EITAjh6GBuc2SVSY';
    const holder = makeActor('playerCharacter', 'Aqua', { isMorphed: true, movement: { ground: { total: 30 }, aerial: { total: 0 } } });
    addPackItem(holder, HOOK_FILES.bendPhysics, { source: BEND });
    const mate = makeActor('playerCharacter', 'Mate', { isMorphed: true, movement: { ground: { total: 30 }, aerial: { total: 0 } } });
    const second = makeActor('playerCharacter', 'Also Aqua', { isMorphed: false, movement: { ground: { total: 30 } } });
    addPackItem(second, HOOK_FILES.bendPhysics, { source: BEND });
    applyDerivedHookMovement(holder);
    applyDerivedHookMovement(mate);
    expect(holder.system.movement.ground.total).toBe(60);
    expect(mate.system.movement).toEqual({ ground: { total: 60 }, aerial: { total: 0 } });
    applyDerivedHookMovement(second);
    expect(second.system.movement.ground.total).toBe(30);
    // The Two-Handed Melee weapon: -10 ft on every speed it has, after the doubling.
    addPackItem(mate, HOOK_FILES.uwTwoHanded);
    mate.system.movement = { ground: { total: 30 }, aerial: { total: 0 } };
    applyDerivedHookMovement(mate);
    expect(mate.system.movement).toEqual({ ground: { total: 50 }, aerial: { total: 0 } });
    mate.system.isMorphed = false;
    mate.system.movement = { ground: { total: 5 } };
    applyDerivedHookMovement(mate);
    expect(mate.system.movement.ground.total).toBe(0);
  });

  test('Emissary\'s Gift: a PR CRB Role Perk at or below level, once', async () => {
    const actor = makeActor('playerCharacter', 'Emissary', { level: 6 });
    const gift = addPackItem(actor, HOOK_FILES.emissary);
    pickPerkFrom.mockResolvedValue({ uuid: 'Compendium.essence20.pr_crb.Item.p', name: 'Follow Me!' });
    expect(await runUse(gift, async () => true)).toContain('Follow Me!');
    expect(pickPerkFrom).toHaveBeenCalledWith(actor, gift, expect.objectContaining({
      from: 'role', pack: 'pr_crb', maxLevel: 6, excludeName: '^(Extra Attack|General Perk|Grid Power|Zord|Zord Feature)$',
    }));
    expect(gift.flags.essence20.pr3Granted).toBe(true);
    expect(await runUse(gift, async () => true)).toBeNull();
  });

  test('Emotional Range: the Emotional Mastery options known, topped up to the Range', async () => {
    const { ensureKnownOptions } = hooksExt;
    const actor = makeActor('playerCharacter', 'Purple');
    expect(await ensureKnownOptions(actor, 'emotionalMastery')).toBeNull();
    const range = addPackItem(actor, HOOK_FILES.emotionalRange, { system: { bonus: { value: 2 } } });
    actor.flags.essence20.zord1KnownEmotions = ['anger', 'fear', 'joy'];
    expect(await ensureKnownOptions(actor, 'emotionalMastery')).toEqual(['anger', 'fear']);
    range.system.bonus.value = 4;
    const choose = jest.fn(async (title, prompt, options) => options.find(option => option.value == 'shame').value);
    expect(await ensureKnownOptions(actor, 'emotionalMastery', { choose })).toEqual(['anger', 'fear', 'joy', 'shame']);
    expect(choose.mock.calls[0][2].map(option => option.value)).not.toContain('anger');
    expect(range.flags.essence20.rules.choices['known-emotionalMastery']).toEqual(['anger', 'fear', 'joy', 'shame']);
    // Cancelled: what is known so far.
    range.system.bonus.value = 5;
    expect(await ensureKnownOptions(actor, 'emotionalMastery', { choose: async () => null })).toEqual(['anger', 'fear', 'joy', 'shame']);
  });
});

/* -------------------------------------------- */
/*  Events, Overdrive, Dino Drive Mode           */
/* -------------------------------------------- */

const MISC_FILES = {
  auraOfDecay: 'fmmcitems/_source/Aura_of_Decay_Vza1muNXrpw4IyKG.json',
  dinoDrive: 'bthitems/_source/Dino_Drive_Mode_fpfH5KgJ3BdWAFtM.json',
  overdrive: 'jttitems/_source/Overdrive_2JZSo4C7xDUMlPG2.json',
};

describe('Events, Overdrive, Dino Drive Mode', () => {
  test('the rules validate', () => {
    for (const file of Object.values(MISC_FILES)) {
      for (const rule of packRules(file)) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }
    }
  });

  test('Aura of Decay: 1 Health as the Power is used (beforeRoll), never below 0', async () => {
    const actor = makeActor('npc', 'Monster', { health: { value: 4, max: 10 } });
    const power = addPackItem(actor, MISC_FILES.auraOfDecay);
    await fireTriggers(actor, 'beforeRoll', { roll: { item: power, dataset: { rollType: 'power' } } });
    expect(actor.system.health.value).toBe(3);
    await fireTriggers(actor, 'beforeRoll', { roll: { item: power, dataset: { rollType: 'skill' } } });
    await fireTriggers(actor, 'beforeRoll', { roll: { item: addItem(actor, { name: 'Other', type: 'power' }), dataset: { rollType: 'power' } } });
    expect(actor.system.health.value).toBe(3);
    actor.system.health.value = 0;
    await fireTriggers(actor, 'beforeRoll', { roll: { item: power, dataset: { rollType: 'power' } } });
    expect(actor.system.health.value).toBe(0);
  });

  test('Dino Drive Mode: Amplified Dino Strength - Edge on Energy attacks near another Zord with Energem Infusion', () => {
    const ENERGEM = 'Compendium.essence20.beneath_the_helmet.Item.ZLQCeC2gGWHnYEBQ';
    const zord = makeActor('zord', 'Dino Zord');
    addPackItem(zord, MISC_FILES.dinoDrive);
    const effect = addItem(zord, { name: 'Laser', type: 'weaponEffect', system: { damageType: 'laser', classification: { style: 'energy' } } });
    const blade = addItem(zord, { name: 'Blade', type: 'weaponEffect', system: { damageType: 'sharp', classification: { style: 'melee' } } });
    const partner = makeActor('zord', 'Partner');
    addItem(partner, { name: 'Energem Infusion', type: 'feature', _stats: { compendiumSource: ENERGEM } });
    const token = (actor, x) => ({ actor, center: { x, y: 0 } });
    const mine = token(zord, 0);
    zord.getActiveTokens = () => [mine];
    const theirs = token(partner, 25);
    partner.getActiveTokens = () => [theirs];
    global.canvas = { tokens: { placeables: [mine, theirs] }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
    const roll = item => ruleRollSources(zord, null, { item, isAttack: true, isMelee: false }).sources;
    expect(roll(effect)).toEqual([]);
    zord.flags.essence20.pr2DinoDrive = { epoch: 1, window: 'scene', count: 1 };
    expect(roll(effect)).toEqual([expect.objectContaining({ edge: true, label: 'Amplified Dino Strength (Edge)' })]);
    expect(roll(blade)).toEqual([]);
    theirs.center.x = 40;
    expect(roll(effect)).toEqual([]);
    global.canvas = undefined;
  });

  test('Overdrive: a seated crew member pays 1 Power for an option not taken this turn, up to three', async () => {
    const { applyMovementStage } = hooksExt;
    const zord = makeActor('zord', 'Zord', { movement: { ground: { total: 40 }, aerial: { total: 0 } } });
    const feature = addPackItem(zord, MISC_FILES.overdrive);
    const pilot = makeActor('playerCharacter', 'Pilot', { powers: { personal: { value: 3, max: 4 } } });
    const weak = makeActor('playerCharacter', 'Weak', { powers: { personal: { value: 3, max: 2 } } });
    zord.system.actors = { p: { uuid: pilot.uuid, vehicleRole: 'driver' }, w: { uuid: weak.uuid, vehicleRole: 'passenger' } };
    const take = label => runUse(feature, async () => true, { ask: async (step, options) => options.findIndex(option => option.label.startsWith(label)) });

    expect(await take('+20 ft')).toContain('Pilot feeds 1 Personal Power into Zord&#39;s Overdrive: +20 ft Movement.');
    expect(pilot.system.powers.personal.value).toBe(2);
    applyMovementStage(zord, 'derivedHook');
    expect(zord.system.movement).toEqual({ ground: { total: 60 }, aerial: { total: 0 } });

    await take('Accurate');
    const ranged = addItem(zord, { name: 'Cannon', type: 'weaponEffect', system: { classification: { style: 'projectile' } } });
    const out = ruleRollSources(zord, null, { item: ranged, isAttack: true, isMelee: false });
    expect(out.sources).toEqual([expect.objectContaining({ label: 'Overdrive (Accurate)', shiftUp: 1 })]);
    expect(out.consumes).toEqual(expect.arrayContaining([expect.objectContaining({ ext: 'rulesMark', key: 'pr1OdAccurate' })]));

    await take('+1 damage');
    const tools = { damageBonusNote: jest.fn() };
    const laser = addItem(zord, { name: 'Laser', type: 'weaponEffect', system: { damageType: 'laser' } });
    ruleDamageDealt(zord, null, { damageValue: 2 }, { style: 'energy', itemUuid: laser.uuid }, tools);
    expect(tools.damageBonusNote).toHaveBeenCalledWith(expect.anything(), 1, 'Overdrive');
    expect(pilot.system.powers.personal.value).toBe(0);

    // Three this turn: no more.
    expect(await take('↑2')).toContain('This Zord has already taken 3 Overdrive options this turn.');
  });

  test('Overdrive: the pilot\'s Group Skill Test switch; nobody able to pay', async () => {
    const zord = makeActor('zord', 'Zord');
    const feature = addPackItem(zord, MISC_FILES.overdrive);
    const take = label => runUse(feature, async () => true, { ask: async (step, options) => options.findIndex(option => option.label.startsWith(label)) });
    expect(await take('↑2')).toContain('NothingToPick');
    const pilot = makeActor('playerCharacter', 'Pilot', { powers: { personal: { value: 0, max: 4 } } });
    zord.system.actors = { p: { uuid: pilot.uuid, vehicleRole: 'driver' } };
    expect(await take('↑2')).toContain('NotEnough');
    expect(ruleDialogSwitches(pilot, { rolledSkill: 'athletics' })).toEqual([]);
    pilot.system.powers.personal.value = 1;
    await take('↑2');
    expect(pilot.flags.essence20.ruleMarks.pr1OdGroup).toBeTruthy();
    expect(ruleDialogSwitches(pilot, { rolledSkill: 'athletics' })).toEqual([expect.objectContaining({ label: 'Group Skill Test (Overdrive: ↑2)', value: false })]);
  });
});

/* -------------------------------------------- */
/*  Forms                                        */
/* -------------------------------------------- */

const FORM_FILES = {
  lightspeed: 'atsitems/_source/Lightspeed_Response__Form__E3WLZpN7iKL9uzeB.json',
  turbo: 'atsitems/_source/Turbocharged__Form__JgHUKEslM51Kfz4L.json',
  operator: 'jttitems/_source/Ranger_Operator_nZYtfaowY0EH3Z0R.json',
  timeForce: 'jttitems/_source/Time_Force_DHTCWLVAKNmtm2iu.json',
  beast: 'bthitems/_source/Beast_Morpher__Form__8FGJyvGaCOd8hrSA.json',
  ninja: 'bthitems/_source/Ninja_Storm_Wind_Ranger__Form__Txv1ODlLKY91hPrA.json',
  supersonic: 'atsitems/_source/Supersonic__Form__Ylo4AY4LCHTXjuuE.json',
  rollOut: 'tfcrbitems/_source/For_The_Allspark__UMlH70vmM3kJzWvS.json',
};
const FORM_SOURCES = {
  lightspeed: 'Compendium.essence20.across_the_stars.Item.E3WLZpN7iKL9uzeB',
  turbo: 'Compendium.essence20.across_the_stars.Item.JgHUKEslM51Kfz4L',
  operator: 'Compendium.essence20.jump_through_time.Item.nZYtfaowY0EH3Z0R',
  timeForce: 'Compendium.essence20.jump_through_time.Item.DHTCWLVAKNmtm2iu',
  beast: 'Compendium.essence20.beneath_the_helmet.Item.8FGJyvGaCOd8hrSA',
  ninja: 'Compendium.essence20.beneath_the_helmet.Item.Txv1ODlLKY91hPrA',
  supersonic: 'Compendium.essence20.across_the_stars.Item.Ylo4AY4LCHTXjuuE',
};

/** A Morphed Ranger holding a Form Perk, with a Blade Blaster and a Power Weapon. */
function ranger2(form, extra = {}) {
  const actor = makeActor('playerCharacter', 'Ranger', { isMorphed: true, powers: { personal: { value: 3, max: 5 } }, essences: { speed: { value: 4 } }, ...extra });
  actor.updateEmbeddedDocuments = jest.fn(async (kind, updates) => {
    for (const { _id, ...changes } of updates) {
      const item = actor.items.get(_id);
      for (const [key, value] of Object.entries(changes)) {
        setPath(item, key, value);
      }
    }
  });
  addItem(actor, { name: 'Blade Blaster', type: 'weapon', system: { equipped: true } });
  addItem(actor, { name: 'Power Sword', type: 'weapon', system: { equipped: true, traits: ['powerWeapon'] } });
  const perk = addPackItem(actor, FORM_FILES[form], { source: FORM_SOURCES[form] });
  return { actor, perk };
}

describe('Forms as data', () => {
  test('the rules validate', () => {
    for (const file of Object.values(FORM_FILES)) {
      for (const rule of packRules(file)) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }
    }
  });

  test('Form specs: Ranger Operator\'s gear depends on Core vs Advanced Role; held Forms come from the rules', async () => {
    const { ruleFormSpec } = formsExt;
    const forms = await import('../items/forms/ranger-form-perks.mjs');
    const { actor: core } = ranger2('operator');
    addItem(core, { name: 'Red Ranger', type: 'role', system: { isAdvanced: false } });
    expect(ruleFormSpec(core, FORM_SOURCES.operator)).toEqual({ key: FORM_SOURCES.operator, cost: 0, swaps: [
      { replaces: 'blaster', uuids: [expect.stringContaining('PaBwCwRPJ83dYT5y')] }, { replaces: 'power', uuids: [expect.stringContaining('LbdzQcgY043JTTGy')] },
    ] });
    const { actor: adv } = ranger2('operator');
    addItem(adv, { name: 'Gold Ranger', type: 'role', system: { isAdvanced: true } });
    expect(forms.formSpec(adv, FORM_SOURCES.operator).swaps).toEqual([{ replaces: 'both', uuids: [expect.stringContaining('RNP5lNTQLostQKSB')] }]);
    expect(forms.heldForms(adv)).toEqual([FORM_SOURCES.operator]);
    const { actor: speedy } = ranger2('supersonic');
    expect(forms.formSpec(speedy, FORM_SOURCES.supersonic)).toMatchObject({ cost: 1, grants: [expect.stringContaining('aVQzWhD1oKDTcApQ')] });
  });

  test('Lightspeed Response: 1 Power, a picked blaster and the V-Lancer swapped in; put back when the Form ends', async () => {
    const forms = await import('../items/forms/ranger-form-perks.mjs');
    const { actor, perk } = ranger2('lightspeed');
    chooseButtons.mockResolvedValue('Compendium.essence20.across_the_stars.Item.yOltN3CfcfQ1qrxk');
    grantCopy.mockImplementation(async (who, uuid, options) => addItem(who, { name: uuid.slice(-4), type: 'weapon', flags: { essence20: { ...options.flags, grantedBy: options.grantedBy.id } } }));
    expect(await forms.activateForm(actor, FORM_SOURCES.lightspeed)).toBe(true);
    expect(actor.system.powers.personal.value).toBe(2);
    expect(actor.flags.essence20.zord1Form).toMatchObject({ uuid: FORM_SOURCES.lightspeed });
    expect(grantCopy.mock.calls.map(call => call[1])).toEqual([
      'Compendium.essence20.across_the_stars.Item.yOltN3CfcfQ1qrxk', 'Compendium.essence20.across_the_stars.Item.CPk5vJmroY58l2ao',
    ]);
    expect(actor.items.contents.filter(item => item.system.equipped === false).map(item => item.name)).toEqual(['Blade Blaster', 'Power Sword']);
    await forms.endForm(actor);
    expect(actor.flags.essence20.zord1Form).toBeUndefined();
    expect(actor.items.contents.map(item => item.name)).toEqual(['Blade Blaster', 'Power Sword', 'Lightspeed Response (Form)']);
    expect(perk.name).toBe('Lightspeed Response (Form)');
  });

  test('Turbo: start / end Uses while Morphed, and the Turbo Cart for 1 Power', async () => {
    const { actor, perk } = ranger2('turbo');
    chooseButtons.mockResolvedValue('Compendium.essence20.across_the_stars.Item.vQJbFtZMiJNEeyC3');
    grantCopy.mockResolvedValue({ id: 'g' });
    const use = label => runUse(perk, async () => true, { pick: async (item, available) => available.find(({ rule }) => rule.label.startsWith(label)) ?? null });
    await use('Unlock');
    expect(actor.flags.essence20.zord1Form.uuid).toBe(FORM_SOURCES.turbo);
    expect(actor.system.powers.personal.value).toBe(2);
    expect(await use('Summon a Turbo Cart')).toContain('Ranger summons a Turbo Cart.');
    expect(actor.system.powers.personal.value).toBe(1);
    expect(await use('End')).toContain('Ranger ends the Form.');
    expect(actor.flags.essence20.zord1Form).toBeUndefined();
    expect(await use('Summon a Turbo Cart')).toBeNull();
    actor.system.isMorphed = false;
    expect(await use('Unlock')).toBeNull();
  });

  test('Time Force: the Electro Booster replaces the Chrono Sabers; a Vector Weapon for the scene', async () => {
    const { actor, perk } = ranger2('timeForce');
    actor.flags.essence20.zord1Form = { uuid: FORM_SOURCES.timeForce };
    const SABER = 'Compendium.essence20.jump_through_time.Item.CZJlfyDUzfHVvUVT';
    const saber = addItem(actor, { name: 'Chrono Saber', type: 'weapon', system: { equipped: true }, _stats: { compendiumSource: SABER } });
    global.fromUuid = async uuid => ({ toObject: () => ({ name: uuid.endsWith('YDAaxYbW8mr1Z0JT') ? 'Electro Booster' : 'Vector Weapon', type: 'weapon', system: {} }) });
    const use = label => runUse(perk, async () => true, { pick: async (item, available) => available.find(({ rule }) => rule.label.startsWith(label)) ?? null });
    await use('Convert the Chrono Sabers');
    expect(saber.system.equipped).toBe(false);
    const booster = actor.items.contents.find(item => item.name == 'Electro Booster');
    expect(booster.flags.essence20).toMatchObject({ zord1FormGrant: FORM_SOURCES.timeForce, grantedBy: perk.id });
    await use('Summon a Vector Weapon');
    const vector = actor.items.contents.find(item => item.name == 'Vector Weapon');
    expect(vector.flags.essence20.rulesExpiry.until).toBe('scene');
    expect(actor.system.powers.personal.value).toBe(1);
  });

  test('Beast Morpher: the animal, the Cheetah vortex and dog, the Gorilla and Jackrabbit Hang-Ups', async () => {
    const { actor, perk } = ranger2('beast');
    chooseSelect.mockResolvedValue('cheetah');
    await fireItemAdded(actor, perk);
    expect(perk.flags.essence20.rules.choices.beast).toBe('cheetah');
    const use = label => runUse(perk, async () => true, { pick: async (item, available) => available.find(({ rule }) => rule.label.startsWith(label)) ?? null });
    await use('Unlock');
    expect(actor.flags.essence20.zord1Form.uuid).toBe(FORM_SOURCES.beast);

    // The vortex: the target rolls Athletics with a Snag against the Cheetah's Speed; a failure knocks it Prone.
    const target = makeActor('npc', 'Putty');
    global.game.user.targets = new Set([{ actor: target }]);
    rollTest.mockResolvedValue({ success: false });
    expect(await use('Cheetah vortex')).toContain('knocks them Prone');
    expect(rollTest).toHaveBeenCalledWith(target, 'athletics', 4, { snag: true });
    const { applyTimedCondition } = await import('../mechanics/combat/timed-status.mjs');
    expect(applyTimedCondition).toHaveBeenCalledWith(target, 'prone', 0);

    // The dog: a d20 under 10 Stuns until the end of the turn (out of combat, as here: 1 round - book-followups2.test.js).
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.2);
    expect(await use('A dog appears')).toContain('freezes at the sight of the dog (5)');
    expect(applyTimedCondition).toHaveBeenLastCalledWith(actor, 'stunned', 1);
    random.mockReturnValue(0.9);
    expect(await use('A dog appears')).toContain('keeps it together');
    random.mockRestore();

    // Jackrabbit: a Fumble means carrots.
    perk.flags.essence20.rules.choices.beast = 'jackrabbit';
    await fireTriggers(actor, 'afterRoll', { outcome: 'fumble', facts: { results: [], isFumble: true } });
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([expect.objectContaining({ label: 'Exhausted (needs carrots)', snag: true })]);
    expect(await use('Eat carrots')).toContain('eats carrots');
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);

    // Gorilla: a Fumble in combat means berserk until calmed.
    perk.flags.essence20.rules.choices.beast = 'gorilla';
    await fireTriggers(actor, 'afterRoll', { outcome: 'fumble', facts: { results: [], isFumble: true } });
    expect(actor.flags.essence20.ruleMarks.zord1Berserk).toBeUndefined();
    global.game.combat = { id: 'c', round: 1, turn: 0, started: true, turns: [] };
    await fireTriggers(actor, 'afterRoll', { outcome: 'fumble', facts: { results: [], isFumble: true } });
    expect(actor.flags.essence20.ruleMarks.zord1Berserk).toBeTruthy();
    expect(await use('Calmed down')).toContain('calms down');
    global.game.combat = null;
  });

  test('Ninja Storm Wind Ranger: element, 3 rounds for 1 Power, the blasts and Duplication', async () => {
    const { actor, perk } = ranger2('ninja', { health: { value: 5, max: 5 }, defenses: { toughness: { total: 10 } } });
    chooseSelect.mockResolvedValue('earth');
    await fireItemAdded(actor, perk);
    const use = label => runUse(perk, async () => true, { pick: async (item, available) => available.find(({ rule }) => rule.label.startsWith(label)) ?? null });
    await use('Unlock');
    expect(actor.system.powers.personal.value).toBe(2);
    await use('Activate your element');
    expect(actor.system.powers.personal.value).toBe(1);
    expect(actor.flags.essence20.ruleMarks.zord1NinjaElementOn).toBeTruthy();
    await use('Duplication: split');
    ruleDerived(actor);
    expect(actor.system.health.max).toBe(4);
    await use('Duplication: merge');
    actor.system.health.max = 5;
    ruleDerived(actor);
    expect(actor.system.health.max).toBe(5);

    // Air: Targeting against Toughness, Prone on a hit.
    perk.flags.essence20.rules.choices.element = 'air';
    const target = makeActor('npc', 'Putty', { defenses: { toughness: { total: 14 }, evasion: { total: 11 } } });
    global.game.user.targets = new Set([{ actor: target }]);
    rollTest.mockResolvedValue({ success: true });
    expect(await use('Air Blast')).toContain('Air Blast knocks Putty Prone');
    expect(rollTest).toHaveBeenLastCalledWith(actor, 'targeting', 14, expect.anything());
    // Water: against Evasion, a 2 Stun button for the target's owner.
    perk.flags.essence20.rules.choices.element = 'water';
    ChatMessage.create.mockClear();
    expect(await use('Water Blast')).toContain('hits Putty for 2 Stun');
    expect(rollTest).toHaveBeenLastCalledWith(actor, 'targeting', 11, expect.anything());
    expect(ChatMessage.create.mock.calls[0][0].flags.essence20.ruleButton).toMatchObject({ who: 'targets', steps: [expect.objectContaining({ do: 'damage', amount: 2, damageType: 'stun' })] });
    // De-Morphing ends the element.
    await fireTriggers(actor, 'unmorph');
    expect(actor.flags.essence20.ruleMarks.zord1NinjaElementOn).toBeUndefined();
  });

  test('Supersonic: the Xenotech armor ↓1 given back on Athletics / Acrobatics, per worn piece', () => {
    const { actor } = ranger2('supersonic');
    addItem(actor, { name: 'Xeno Plate', type: 'armor', system: { equipped: true, traits: ['xenotech'] } });
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    actor.flags.essence20.zord1Form = { uuid: FORM_SOURCES.supersonic };
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    addItem(actor, { name: 'Xeno Boots', type: 'armor', system: { equipped: true, traits: ['xenotech'] } });
    expect(ruleRollSources(actor, null, { rolledSkill: 'acrobatics' }).sources).toEqual([expect.objectContaining({ shiftUp: 2 })]);
    expect(ruleRollSources(actor, null, { rolledSkill: 'brawn' }).sources).toEqual([]);
  });

  test('Roll Out: convert into a picked Alt Mode as Initiative is rolled, not when Surprised or Mode Locked', async () => {
    const bot = makeActor('playerCharacter', 'Bot', { canTransform: true, isTransformed: false });
    bot.transform = jest.fn();
    addPackItem(bot, FORM_FILES.rollOut);
    const car = addItem(bot, { name: 'Car', type: 'altMode' });
    global.game.combat = { id: 'c', round: 0, turn: 0, started: false, turns: [] };
    chooseSelect.mockResolvedValue(car.id);
    await fireTriggers(bot, 'initiativeRolled');
    expect(bot.transform).toHaveBeenCalledWith(car.uuid);
    expect(ChatMessage.create.mock.calls.at(-1)[0].content).toContain('Bot rolls out in Car.');
    bot.transform.mockClear();
    bot.statuses.add('surprised');
    await fireTriggers(bot, 'initiativeRolled');
    bot.statuses.delete('surprised');
    global.game.combat.round = 2;
    await fireTriggers(bot, 'initiativeRolled');
    expect(bot.transform).not.toHaveBeenCalled();
    global.game.combat = null;
  });
});

/* -------------------------------------------- */
/*  Multi-Megaform                               */
/* -------------------------------------------- */

describe('Multi-Megaform', () => {
  const FILE = 'jttitems/_source/Multi_Megaform_vbySX4nIsHsIhIzJ.json';
  const TRAITS = ['a', 'b', 'c', 'd'].map(k => ({ uuid: `Compendium.x.Item.${k}`, name: k.toUpperCase() }));

  test('the rules validate', () => {
    for (const rule of packRules(FILE)) {
      expect(validateRule(rule)).toEqual([]);
    }
  });

  test('three different Megaform Traits are noted when added, leaving out another copy\'s', async () => {
    const zord = makeActor('zord', 'Zord');
    const first = addPackItem(zord, FILE, { source: 'Compendium.essence20.jtt.Item.vbySX4nIsHsIhIzJ' });
    first.flags = { essence20: { zord1MultiTraits: ['Compendium.x.Item.d'] } };
    const feature = addPackItem(zord, FILE, { source: 'Compendium.essence20.jtt.Item.vbySX4nIsHsIhIzJ' });
    findItems.mockResolvedValue(TRAITS);
    pickOne.mockImplementation(async (title, rows) => rows[0]?.uuid ?? null);
    await fireItemAdded(zord, feature);
    expect(findItems.mock.calls[0][0]).toMatchObject({ type: 'megaformTrait' });
    expect(pickOne.mock.calls.map(call => call[0])).toEqual(['Megaform Trait 1 of 3', 'Megaform Trait 2 of 3', 'Megaform Trait 3 of 3']);
    // The legacy-noted D on the other copy is never offered; each pick leaves out the earlier ones.
    expect(pickOne.mock.calls[2][1].map(row => row.uuid)).toEqual(['Compendium.x.Item.c']);
    expect(feature.flags.essence20.rules.choices.traits).toEqual(['Compendium.x.Item.a', 'Compendium.x.Item.b', 'Compendium.x.Item.c']);
  });

  test('stopping part way keeps what was chosen; stopping at once keeps the old list', async () => {
    const zord = makeActor('zord', 'Zord');
    const feature = addPackItem(zord, FILE);
    findItems.mockResolvedValue(TRAITS);
    pickOne.mockResolvedValueOnce('Compendium.x.Item.b').mockResolvedValueOnce(null);
    await fireItemAdded(zord, feature);
    expect(feature.flags.essence20.rules.choices.traits).toEqual(['Compendium.x.Item.b']);
    pickOne.mockResolvedValue(null);
    const renote = useRule => useRule.label.startsWith('Re-choose');
    await runUse(feature, async () => true, { pick: async (item, rows) => rows.find(row => renote(row.rule)) });
    expect(feature.flags.essence20.rules.choices.traits).toEqual(['Compendium.x.Item.b']);
  });

  test('the apply Use swaps the Trait the Zord carries (legacy notes and copies too)', async () => {
    const zord = makeActor('zord', 'Zord');
    const feature = addPackItem(zord, FILE);
    feature.flags = { essence20: { zord1MultiTraits: ['Compendium.x.Item.a', 'Compendium.x.Item.b'] } };
    const old = addItem(zord, { name: 'Old', type: 'megaformTrait', flags: { essence20: { grantedBy: feature.id, zord1MultiMegaform: feature.id } } });
    global.fromUuid = async uuid => (uuid.startsWith('Compendium.x') ? { toObject: () => ({ name: `Trait ${uuid.slice(-1)}`, type: 'megaformTrait', system: {} }) } : global.fromUuidSync(uuid));
    chooseSelect.mockImplementation(async (title, prompt, options) => {
      expect(options.map(option => option.value)).toEqual(['Compendium.x.Item.a', 'Compendium.x.Item.b']);
      return 'Compendium.x.Item.b';
    });
    const apply = async () => runUse(feature, async () => true, { pick: async (item, rows) => rows.find(row => row.rule.label.startsWith('Apply')) });
    await apply();
    expect(zord.items.contents.includes(old)).toBe(false);
    expect(zord.items.contents.filter(item => item.type == 'megaformTrait').map(item => item.name)).toEqual(['Trait b']);
    chooseSelect.mockImplementation(async () => 'Compendium.x.Item.a');
    await apply();
    expect(zord.items.contents.filter(item => item.type == 'megaformTrait').map(item => item.name)).toEqual(['Trait a']);
    // Nothing noted: nothing to apply.
    const bare = addPackItem(makeActor('zord', 'Bare'), FILE);
    chooseSelect.mockClear();
    await runUse(bare, async () => true, { pick: async (item, rows) => rows.find(row => row.rule.label.startsWith('Apply')) });
    expect(chooseSelect).not.toHaveBeenCalled();
    expect(bare.parent.items.contents).toHaveLength(1);
  });
});
