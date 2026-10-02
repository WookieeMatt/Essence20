import { jest } from '@jest/globals';

beforeAll(() => {
  global.Hooks = { on: jest.fn(), once: jest.fn() };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.foundry = { utils: { escapeHTML: s => s, setProperty: () => {} } };
});

const mod = await import('./gij3.mjs');
const {
  G3, deps, gij3Toggles, gij3ApplyDialog, gij3RollSources, gij3PreRoll, gij3Derived, isTargetingEyeLive, qualifiesForSoundOfAngels,
  peakPerformancePerks, dreadnokInScene, gij3TurnStart, USES, isPillageEffect, addSilencedStatus, onTouchMoveInitiative,
} = mod;
const hooks = await import('./dice-hooks.mjs');
const disrupt = await import('./disrupt.mjs');
const ext = await import('../../extensions.mjs');

const src = uuid => ({ core: { sourceId: uuid } });
const item = (uuid, extra = {}) => ({
  id: extra.id ?? String(uuid).slice(-6), uuid: `Item.${extra.id ?? 'x'}`, name: extra.name ?? 'Thing', type: extra.type ?? 'perk',
  system: extra.system ?? {}, flags: { ...src(uuid), essence20: extra.flags ?? {} },
  setFlag: jest.fn(async function (scope, key, value) {
    this.flags.essence20[key] = value;
  }),
});
function actor(items = [], extra = {}) {
  const a = {
    id: extra.id ?? 'a1', uuid: extra.uuid ?? 'Actor.a1', name: extra.name ?? 'A', type: extra.type ?? 'playerCharacter',
    system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} }, statuses: new Set(extra.statuses ?? []),
    items: { contents: items, get: id => items.find(i => i.id == id), find: fn => items.find(fn), some: fn => items.some(fn) }, documentName: 'Actor', isOwner: true,
  };
  items.forEach(i => {
    i.parent = a; 
  });
  a.getFlag = (scope, key) => a.flags.essence20[key];
  a.setFlag = jest.fn(async (scope, key, value) => {
    a.flags.essence20[key] = value;
  });
  a.unsetFlag = jest.fn(async (scope, key) => {
    delete a.flags.essence20[key];
  });
  return a;
}

beforeEach(() => {
  global.game = {
    i18n: { localize: k => k, format: k => k }, user: { targets: new Set() }, actors: [], combat: null,
    settings: { get: () => 1 }, users: { activeGM: { isSelf: true } }, scenes: { viewed: null },
  };
  global.canvas = { scene: { tokens: [] } };
  global.CONFIG = { statusEffects: [], E20: {} };
  global.ChatMessage = { create: jest.fn(async () => ({})), getSpeaker: () => ({}) };
  deps.isKnownOutsideEnvironmentOfExpertise = () => false;
});

const names = out => out.map(t => t.name);

test('social Hang-Up switches show on Social tests and apply their penalty', () => {
  const holder = actor([item(G3.brutish, { type: 'hangUp' }), item(G3.onceAMarauder, { type: 'hangUp' }), item(G3.subtleSnake, { type: 'hangUp' })]);
  expect(names(gij3Toggles(holder, { rolledSkill: 'persuasion' }))).toEqual(['gij3Brutish', 'gij3OnceAMarauder', 'gij3SubtleSnake']);
  expect(gij3Toggles(holder, { rolledSkill: 'science' })).toEqual([]);

  const options = { shiftDown: 0, ext: { gij3Brutish: true, gij3OnceAMarauder: true, gij3SubtleSnake: 'cobra' } };
  gij3ApplyDialog(holder, options);
  expect(options).toMatchObject({ snag: true, shiftDown: 2 });
  const outsider = { shiftDown: 0, ext: { gij3SubtleSnake: 'outsider' } };
  gij3ApplyDialog(holder, outsider);
  expect(outsider).toMatchObject({ snag: true, shiftDown: 0 });
});

test('Broadcaster Edge, Second Skin Edge, Petrolhead Specialized', () => {
  const holder = actor([item(G3.broadcaster), item(G3.secondSkin), item(G3.petrolhead, { system: { choice: 'ground' } })]);
  expect(names(gij3Toggles(holder, { rolledSkill: 'deception' }))).toEqual(['gij3SecondSkin', 'gij3Broadcaster']);
  expect(names(gij3Toggles(holder, { rolledSkill: 'technology' }))).toEqual(['gij3SecondSkin', 'gij3Petrolhead']);
  expect(names(gij3Toggles(holder, { rolledSkill: 'targeting', item: { type: 'weaponEffect' } }))).toEqual([]);
  const options = { ext: { gij3Broadcaster: true, gij3Petrolhead: true } };
  gij3ApplyDialog(holder, options);
  expect(options).toMatchObject({ edge: true, isSpecialized: true });
});

test('Means To An End only on the chosen Means skills once set', () => {
  const perk = item(G3.meansToAnEnd);
  const holder = actor([perk]);
  expect(names(gij3Toggles(holder, { rolledSkill: 'science' }))).toEqual(['gij3MeansToAnEnd']);
  perk.flags.essence20.gij3MeansSkills = ['might', 'finesse', 'technology', 'deception'];
  expect(gij3Toggles(holder, { rolledSkill: 'science' })).toEqual([]);
  const options = { shiftUp: 1, ext: { gij3MeansToAnEnd: true } };
  gij3ApplyDialog(holder, options);
  expect(options.shiftUp).toBe(2);
});

test('Stalk: Edge on Infiltration unless known to be outside the environment', () => {
  const holder = actor([item(G3.stalk, { name: 'Stalk' })]);
  expect(gij3RollSources(holder, null, { rolledSkill: 'infiltration' }).sources[0]).toMatchObject({ id: 'gij3Stalk', edge: true });
  deps.isKnownOutsideEnvironmentOfExpertise = () => true;
  expect(gij3RollSources(holder, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
});

test('Junker: banked Edge on the next requisition, consumed', () => {
  const holder = actor([item(G3.junker)], { flags: { gij3JunkerEdge: { edge: true } } });
  const out = gij3RollSources(holder, null, { rolledSkill: 'athletics', dataset: { requisitionItemName: 'Vest' } });
  expect(out.sources[0]).toMatchObject({ edge: true });
  expect(out.consumes).toEqual([{ ext: 'gij3Junker', actorUuid: 'Actor.a1' }]);
  expect(gij3RollSources(holder, null, { rolledSkill: 'athletics', dataset: {} }).sources).toEqual([]);
});

test('Junker Use adds an attempt to the party and banks the Edge', async () => {
  const party = { name: 'Squad', system: { requisition: { attempts: 2 } }, update: jest.fn(async () => {}), isOwner: true };
  game.actors = { party };
  const perk = item(G3.junker);
  const holder = actor([perk]);
  const use = USES.find(u => u.id == 'gij3Junker');
  expect(use.canUse(perk)).toBe(true);
  global.foundry.utils.randomID = () => 'r';
  game.user.isGM = true;
  await use.run(perk);
  expect(party.update).toHaveBeenCalledWith({ 'system.requisition.attempts': 3 });
  expect(holder.flags.essence20.gij3JunkerEdge).toMatchObject({ edge: true });
});

test('Targeting Eye: live window, melee penalties both ways, doubled projectile range', () => {
  const eye = item(G3.targetingEye, { type: 'alteration' });
  const weapon = item('Compendium.x.Item.rifle', { id: 'w1', type: 'weapon' });
  const effect = item('Compendium.x.Item.fx', { id: 'e1', type: 'weaponEffect', system: { classification: { style: 'projectile' }, range: { value: 50, long: 100 } }, flags: { parentId: 'w1' } });
  const holder = actor([eye, weapon, effect], { flags: { gij3TargetingEye: { sceneEpoch: undefined } } });
  expect(isTargetingEyeLive(holder)).toBe(true);
  gij3Derived(holder);
  expect(effect.system.range).toEqual({ value: 100, long: 200 });
  expect(effect.system.upgradeTouched).toContain('range.value');

  expect(gij3RollSources(holder, null, { isAttack: true, isMelee: true }).sources[0]).toMatchObject({ shiftDown: 1 });
  const attacker = actor([], { id: 'b' });
  expect(gij3RollSources(attacker, holder, { isAttack: true, isMelee: true }).sources[0]).toMatchObject({ shiftUp: 1 });
  expect(gij3RollSources(attacker, holder, { isAttack: true, isMelee: false }).sources).toEqual([]);

  game.combat = { id: 'c', round: 3, turn: 2, turns: [] };
  holder.flags.essence20.gij3TargetingEye = { combatId: 'c', untilRound: 2, untilTurn: 0 };
  expect(isTargetingEyeLive(holder)).toBe(false);
});

test('Scoped weapons gain nothing from the Targeting Eye', () => {
  const eye = item(G3.targetingEye, { type: 'alteration' });
  const weapon = item('Compendium.x.Item.rifle', { id: 'w1', type: 'weapon' });
  const scope = item('Compendium.essence20.gi_joe_crb.Item.cBiD2lBLRwnxu8Rx', { id: 's1', type: 'upgrade', flags: { parentId: 'w1' } });
  const effect = item('Compendium.x.Item.fx', { id: 'e1', type: 'weaponEffect', system: { classification: { style: 'projectile' }, range: { value: 50, long: 100 } }, flags: { parentId: 'w1' } });
  const holder = actor([eye, weapon, scope, effect], { flags: { gij3TargetingEye: {} } });
  gij3Derived(holder);
  expect(effect.system.range.value).toBe(50);
});

test('Second Skin swaps an armor requisition skill', async () => {
  global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async () => 'technology') } } };
  const holder = actor([item(G3.secondSkin)]);
  const dataset = { skill: 'athletics', essence: 'strength', requisitionItemName: 'Vest' };
  await gij3PreRoll(holder, dataset, null);
  expect(dataset).toMatchObject({ skill: 'technology', essence: 'smarts' });
  const weapon = { skill: 'targeting', requisitionItemName: 'Rifle' };
  await gij3PreRoll(holder, weapon, null);
  expect(weapon.skill).toBe('targeting');
});

test('Sound of Angels qualifying weapons', () => {
  const twoHand = item('x', { id: 'w', type: 'weapon', system: { traits: ['ballistic'], derivedHands: 2 } });
  const oneHand = item('y', { id: 'p', type: 'weapon', system: { traits: ['ballistic'], derivedHands: 1 } });
  const owner = actor([twoHand, oneHand]);
  const fx = parentId => ({ type: 'weaponEffect', parent: owner, system: { classification: { style: 'projectile' } }, flags: { essence20: { parentId } } });
  expect(qualifiesForSoundOfAngels(owner, fx('w'))).toBe(true);
  expect(qualifiesForSoundOfAngels(owner, fx('p'))).toBe(false);
  expect(qualifiesForSoundOfAngels(owner, { type: 'weaponEffect', parent: owner, system: { classification: { style: 'explosive' } }, flags: {} })).toBe(true);
  const jet = actor([], { type: 'vehicle', system: { movement: { aerial: { base: 300 } } } });
  expect(qualifiesForSoundOfAngels(jet, { type: 'weaponEffect', parent: jet, system: { classification: { style: 'energy' } }, flags: {} })).toBe(true);
});

test('Peak Performance: top Role Perk, Officer skips Plan of Action', () => {
  const officer = item('Compendium.essence20.gi_joe_crb.Item.VBEsSU8jqBpoGueE', { type: 'role', name: 'Officer', system: { items: {
    a: { type: 'perk', subtype: 'role', level: 18, name: 'Momentum', uuid: 'U.m' },
    b: { type: 'perk', subtype: 'role', level: 18, name: 'Plan of Action', uuid: 'U.p' },
    c: { type: 'perk', subtype: 'role', level: 10, name: 'Other', uuid: 'U.o' },
  } } });
  const oldHand = item(G3.oldHand, { type: 'role', name: 'Old Hand', system: { items: { z: { type: 'perk', subtype: 'role', level: 16, name: 'Peak Performance', uuid: 'U.z' } } } });
  const picks = peakPerformancePerks(actor([oldHand, officer]));
  expect(picks.role).toBe('Officer');
  expect(picks.entries.map(e => e.name)).toEqual(['Momentum']);
});

test('Dreadnok Recruit: a Dreadnok on the scene costs a Free action at turn start', async () => {
  const holder = actor([item(G3.dreadnokRecruit, { type: 'hangUp', name: 'Dreadnok Recruit' })]);
  expect(dreadnokInScene(holder)).toBe(false);
  canvas.scene.tokens = [{ actor: { id: 'z', type: 'npc', name: 'Dreadnok Thug' } }];
  expect(dreadnokInScene(holder)).toBe(true);
  await gij3TurnStart(holder).catch(() => {});
  expect(ChatMessage.create).toHaveBeenCalled();
});

test('Touch Move posts once, naming un-surprised allies', async () => {
  const holder = actor([item(G3.touchMove, { name: 'Touch Move' })], { id: 'h' });
  const ally = actor([], { id: 'b', name: 'Bee' });
  const surprised = actor([], { id: 's', name: 'Sue', statuses: ['surprised'] });
  const combat = { id: 'c' };
  const combatant = { id: 'x', parent: combat, actor: holder, token: { disposition: 1 } };
  combat.combatants = [combatant, { actor: ally, token: { disposition: 1 } }, { actor: surprised, token: { disposition: 1 } }];
  await onTouchMoveInitiative(combatant, { initiative: 14 });
  await onTouchMoveInitiative(combatant, { initiative: 15 });
  expect(ChatMessage.create).toHaveBeenCalledTimes(1);
});

test('Pillage effects are recognised; silenced status added once', () => {
  expect(isPillageEffect({ flags: src(G3.pillageFinesse) })).toBe(true);
  expect(isPillageEffect({ flags: src('nope') })).toBe(false);
  addSilencedStatus();
  addSilencedStatus();
  expect(CONFIG.statusEffects.filter(s => s.id == 'silenced')).toHaveLength(1);
});

test('everything registers with the extension registry', () => {
  const reg = ext.registrySnapshot();
  expect(reg.uses.some(u => u.id == 'gij3TechnicalGlitch')).toBe(true);
  expect(Object.keys(reg.chatButtons)).toEqual(expect.arrayContaining(['gij3FreePick', 'gij3Reboot', 'gij3CsfRepair']));
  expect(reg.consumers.gij3Junker).toBeDefined();
});

/* dice-hooks.mjs */

test('Better than the Best: natural 20 succeeds, or crits a success', () => {
  const holder = actor([item(hooks.BETTER_THAN_THE_BEST_ID)]);
  const roll = value => ({ dice: [{ faces: 20, values: [value] }] });
  expect(hooks.betterThanTheBestMultiplier(holder, roll(20), 0)).toBe(1);
  expect(hooks.betterThanTheBestMultiplier(holder, roll(20), 1)).toBe(2);
  expect(hooks.betterThanTheBestMultiplier(holder, roll(20), 3)).toBe(3);
  expect(hooks.betterThanTheBestMultiplier(holder, roll(19), 0)).toBe(0);
  expect(hooks.betterThanTheBestMultiplier(actor([]), roll(20), 0)).toBe(0);
});

test('Seconds Between Click & Boom: no miss effects on an Evasion attack', () => {
  const holder = actor([item(hooks.SECONDS_BETWEEN_CLICK_AND_BOOM_ID)]);
  expect(hooks.ignoresMissEffects(holder, 'evasion')).toBe(true);
  expect(hooks.ignoresMissEffects(holder, 'toughness')).toBe(false);
  expect(hooks.ignoresMissEffects(actor([]), 'evasion')).toBe(false);
  global.fromUuidSync = () => holder;
  expect(hooks.ignoresMissEffects('Actor.a1', 'evasion')).toBe(true);
});

test('Takedown Expert applies the chosen Condition', async () => {
  global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async () => 'silenced') } } };
  const holder = actor([item(hooks.TAKEDOWN_EXPERT_ID)]);
  const target = actor([], { id: 't' });
  target.toggleStatusEffect = jest.fn(async () => {});
  expect(await hooks.takedownExpertChoice(holder, target)).toBe('silenced');
  expect(target.toggleStatusEffect).toHaveBeenCalledWith('silenced', { active: true });
  expect(await hooks.takedownExpertChoice(actor([]), target)).toBe(null);
});

/* disrupt.mjs */

test('Complete System Failure penalises rolls with the disrupted weapon', () => {
  const weapon = item('w', { id: 'w1', type: 'weapon', name: 'Rifle', flags: { gij3Disrupted: { csf: true, inoperable: false } } });
  const holder = actor([weapon]);
  const fx = { type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } } };
  expect(disrupt.csfSource(holder, { item: fx })).toMatchObject({ snag: true, shiftDown: 2 });
  weapon.flags.essence20.gij3Disrupted = { csf: false, inoperable: true };
  expect(disrupt.csfSource(holder, { item: fx })).toBe(null);
  expect(gij3RollSources(holder, null, { item: fx }).sources).toEqual([]);
});

test('disruptable equipment and its DIF', () => {
  CONFIG.E20 = {};
  const computer = item('c', { type: 'gear', system: { traits: ['computerized'], availability: 'restricted' } });
  const plain = item('p', { type: 'weapon', system: { traits: [] } });
  const target = actor([computer, plain]);
  expect(disrupt.computerizedItems(target)).toEqual([computer]);
  expect(disrupt.equipmentItems(target)).toHaveLength(2);
  expect(disrupt.availabilityDif(computer)).toBe(15);
});

test('disrupting an item unequips it, and Reboot brings it back', async () => {
  CONFIG.E20 = {};
  const gear = item('c', { id: 'g1', type: 'gear', name: 'Radio', system: { traits: ['computerized'], equipped: true } });
  gear.isOwner = true;
  gear.update = jest.fn(async update => {
    for (const [key, value] of Object.entries(update)) {
      if (key == 'system.equipped') {
        gear.system.equipped = value;
      } else if (key.includes('-=')) {
        delete gear.flags.essence20.gij3Disrupted;
      } else if (key.endsWith('gij3Disrupted')) {
        gear.flags.essence20.gij3Disrupted = value;
      }
    }
  });
  const owner = actor([gear], { id: 'o' });
  const disruptor = actor([], { id: 'd', uuid: 'Actor.d' });
  await disrupt.disruptItem(disruptor, gear);
  expect(gear.system.equipped).toBe(false);
  expect(gear.flags.essence20.gij3Disrupted).toMatchObject({ inoperable: true, csf: false });
  expect(ChatMessage.create.mock.calls[0][0].content).toContain('gij3Reboot');

  global.fromUuid = async () => gear;
  await disrupt.onRebootButton(null, { dataset: { itemUuid: 'Item.g1' } });
  expect(gear.system.equipped).toBe(true);
  expect(gear.flags.essence20.gij3Disrupted).toBeUndefined();
  expect(owner.id).toBe('o');
});
