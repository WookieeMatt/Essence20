import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 11, group G (slG11): Warhead Magazines, Pop Out, Telltale Sign and Armor Matrix's best-only Toughness, moved
 * from hand-written code (pr1/jtt.mjs, other3/hide.mjs, other1/more.mjs) to item rules on the group G engine pieces
 * (module/rules/ext/g/). Each item is loaded from its pack source and must do what the removed code did.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const spend = jest.fn(async () => ({ blocked: false }));
jest.unstable_mockModule('./helpers/action-economy.mjs', () => ({ spend, setNextTurn: jest.fn(), getLedger: () => null, isTracking: () => true }));
const answers = [];
const chooseSelect = jest.fn(async (title, prompt, options) => (answers.length ? answers.shift() : options[0]?.value ?? null));
jest.unstable_mockModule('./helpers/grants.mjs', () => ({ chooseSelect, rollTest: jest.fn(async () => ({ success: true })), chooseButtons: jest.fn() }));
jest.unstable_mockModule('./helpers/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const timed = [];
jest.unstable_mockModule('./helpers/timed-status.mjs', () => ({
  applyTimedCondition: jest.fn(async (actor, status, rounds) => {
    timed.push({ name: actor.name, status, rounds });
    actor.statuses.add(status);
  }),
}));

await import('./ext/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { fireItemAdded, runUse, useAvailable } = await import('./triggers.mjs');
const { pressRuleButton } = await import('./buttons.mjs');
const { runApplyDialog, extDialogToggles, runPostRoll, runDerived } = await import('../helpers/extensions.mjs');
const { hitRiderOnAttack } = await import('./ext/b/hit-rider.mjs');
const { pressCardButton } = await import('./ext/g/cards.mjs');
const { rolls } = await import('./ext/g/rolls.mjs');
const { isHidden } = await import('./ext/g/hidden.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');
// The generic Hide code: attacking while Hidden ends it and fires brokeHiding.
await import('../helpers/extensions/other3/hide.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const P = {
  warhead: 'jttitems/_source/Warhead_Magazines_57an1eB6FMmcpKlk.json',
  popOut: 'tfcrbitems/_source/Pop_Out_xAAzOb9sYmEN7qmv.json',
  telltale: 'tfcrbitems/_source/Telltale_Sign_LM5pwZWroo1QKrSN.json',
  matrixLight: 'dditems/_source/Armor_Matrix__Light_z3Nb6mrcAZ1c8R3q.json',
  matrixMedium: 'dditems/_source/Armor_Matrix__Medium_COIQnaWsN7JorDuv.json',
  matrixHeavy: 'dditems/_source/Armor_Matrix__Heavy_Gha7PEUJKSOmLnIx.json',
};

let nextId = 1;
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

function makeItem(data) {
  const made = {
    id: `i${nextId++}`, flags: {}, system: {}, ...data,
    async update(changes) {
      Object.entries(changes).forEach(([key, value]) => setPath(this, key, value));
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
  };
  made.uuid = `Item.${made.id}`;
  byUuid.set(made.uuid, made);
  return made;
}

function packItem(file, extra = {}) {
  const doc = fromPack(file);
  return makeItem({
    name: doc.name, type: doc.type, system: JSON.parse(JSON.stringify({ ...doc.system, ...(extra.system ?? {}) })),
    flags: { core: { sourceId: `Compendium.x.Item.${doc._id}` }, essence20: { ...(extra.flags ?? {}) } },
  });
}

function makeActor(name, items = [], { type = 'playerCharacter', system = {}, flags = {} } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: { ...flags } },
    system: { level: 5, defenses: {}, skills: {}, ...system },
    async update(changes) {
      Object.entries(changes).forEach(([key, value]) => setPath(this, key, value));
    },
    testUserPermission: () => true,
    getActiveTokens: () => [],
  };
  actor.uuid = `Actor.${actor.id}`;
  const list = items.map(entry => (entry.uuid ? entry : makeItem(entry)));
  actor.items = { contents: list, get: id => list.find(i => i.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  list.forEach(i => (i.parent = actor));
  rebuildIndex(actor);
  byUuid.set(actor.uuid, actor);
  game.actors.contents.push(actor);
  return actor;
}

function addItem(actor, entry) {
  entry.parent = actor;
  actor.items.contents.push(entry);
  rebuildIndex(actor);
  return entry;
}

let posted = [];
beforeEach(() => {
  byUuid.clear();
  posted = [];
  timed.length = 0;
  answers.length = 0;
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] },
    actors: { contents: [] }, i18n: { localize: k => k, format: (k, d) => `${k} ${JSON.stringify(d)}`, has: k => k.startsWith('E20.O3') || k.startsWith('E20.Pr1') }, settings: { get: () => 4 },
  };
  global.canvas = { tokens: { placeables: [], setTargets: jest.fn() } };
  global.CONFIG = { E20: {
    damageTypes: Object.fromEntries(['acid', 'blunt', 'cold', 'electric', 'emp', 'element', 'fire', 'sharp', 'sonic', 'stun', 'psychic'].map(type => [type, `Dmg.${type}`])),
    skillToEssence: { infiltration: 'speed' },
  } };
  global.ChatMessage = {
    create: jest.fn(async data => {
      const made = {
        ...data, flags: data.flags ?? {},
        async update(changes) {
          Object.entries(changes).forEach(([key, value]) => setPath(this, key, value));
        },
      };
      posted.push(made);
      return made;
    }),
    getSpeaker: () => ({}),
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuidSync = uuid => byUuid.get(uuid) ?? null;
  global.fromUuid = async uuid => byUuid.get(uuid) ?? null;
  global.foundry = { utils: { setProperty: setPath, getProperty: getPath, deepClone: v => JSON.parse(JSON.stringify(v)) } };
  spend.mockReset();
  spend.mockImplementation(async () => ({ blocked: false }));
  chooseSelect.mockClear();
});

test('every rule on the converted items validates', () => {
  for (const file of Object.values(P)) {
    const rules = fromPack(file).system.rules;
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect([file, validateRule(rule)]).toEqual([file, []]);
    }
  }
});

/* -------------------------------------------- */
/*  Warhead Magazines                            */
/* -------------------------------------------- */

describe('Warhead Magazines', () => {
  const areaAttack = () => makeItem({ type: 'weaponEffect', name: 'Missiles', system: { damageValue: 3, damageType: 'blunt', radius: 10 } });

  test('gained: three different types picked one at a time (prompt n of 3), leaving out other copies\' types; the line', async () => {
    const zord = makeActor('Zord', [], { type: 'zord' });
    const first = addItem(zord, packItem(P.warhead));
    answers.push('acid', 'fire', 'cold');
    await fireItemAdded(zord, first);
    expect(first.flags.essence20.rules.choices.pr1Warhead).toEqual(['acid', 'fire', 'cold']);
    expect(chooseSelect.mock.calls.map(call => call[1])).toEqual(['E20.Pr1WarheadPick', 'E20.Pr1WarheadPick', 'E20.Pr1WarheadPick']);
    expect(chooseSelect.mock.calls[0][2].map(o => o.value)).toEqual(['acid', 'blunt', 'cold', 'electric', 'emp', 'element', 'fire', 'sharp', 'sonic', 'stun']);
    expect(chooseSelect.mock.calls[1][2].map(o => o.value)).not.toContain('acid');
    expect(posted.at(-1).content).toContain('Zord&#39;s Warhead Magazines: Dmg.acid, Dmg.fire, Dmg.cold.');

    // A second copy: the first copy's types aren't offered.
    chooseSelect.mockClear();
    const second = addItem(zord, packItem(P.warhead));
    answers.push('sonic', 'stun', 'emp');
    await fireItemAdded(zord, second);
    expect(chooseSelect.mock.calls[0][2].map(o => o.value)).toEqual(['blunt', 'electric', 'emp', 'element', 'sharp', 'sonic', 'stun']);
    expect(second.flags.essence20.rules.choices.pr1Warhead).toEqual(['sonic', 'stun', 'emp']);
  });

  test('a cancelled pick keeps nothing; the Use button is offered until the types are picked (an old flag counts)', async () => {
    const zord = makeActor('Zord', [], { type: 'zord' });
    const feature = addItem(zord, packItem(P.warhead));
    answers.push('acid', null);
    await fireItemAdded(zord, feature);
    expect(feature.flags.essence20.rules).toBeUndefined();
    const use = feature.system.rules.findIndex(rule => rule.type == 'Use');
    expect(useAvailable(feature, feature.system.rules[use], use)).toBe(true);
    answers.push('acid', 'fire', 'cold');
    await runUse(feature, async () => true);
    expect(feature.flags.essence20.rules.choices.pr1Warhead).toEqual(['acid', 'fire', 'cold']);
    expect(useAvailable(feature, feature.system.rules[use], use)).toBe(false);

    const old = packItem(P.warhead, { flags: { pr1WarheadTypes: ['sonic'] } });
    makeActor('Old Zord', [old], { type: 'zord' });
    expect(useAvailable(old, old.system.rules[use], use)).toBe(false);
    // The start-up linking pass moves the old flag into the pick.
    expect(legacyChoiceUpdates(old.parent)).toEqual([{ _id: old.id, 'flags.essence20.rules.choices.pr1Warhead': ['sonic'] }]);
  });

  test('dialog: on a Zord\'s area attack, the base type or any copy\'s picked type (Free action); the hit gets an Apply as that type', async () => {
    const attack = areaAttack();
    const first = packItem(P.warhead);
    first.flags.essence20.rules = { choices: { pr1Warhead: ['acid', 'fire', 'cold'] } };
    const legacy = packItem(P.warhead, { flags: { pr1WarheadTypes: ['sonic', 'fire'] } });
    const zord = makeActor('Zord', [attack, first, legacy], { type: 'zord' });
    const selects = extDialogToggles(zord, { item: attack }).filter(t => t.type == 'select');
    expect(selects).toHaveLength(1);
    expect(selects[0]).toMatchObject({ label: 'Warhead Magazines (Free action): damage type', value: '0' });
    expect(selects[0].options.map(o => o.label)).toEqual(['Base damage type', 'Dmg.acid', 'Dmg.fire', 'Dmg.cold', 'Dmg.sonic']);

    // Out of combat: no action to spend.
    let options = { ext: { [selects[0].name]: 'v:sonic' } };
    await runApplyDialog(zord, options, { item: attack });
    expect(spend).not.toHaveBeenCalled();
    let hit = { damageValue: 4, damageType: 'blunt' };
    hitRiderOnAttack(zord, null, hit, { itemUuid: attack.uuid, switches: options.ruleKeys }, { damageBonusNote: jest.fn() });
    expect(hit.riderOptions).toEqual([expect.objectContaining({ key: 'pr1Warhead', label: 'Warhead Magazines', damageValue: 4, damageType: 'sonic' })]);

    // In combat: a Free action; refused - no Apply button.
    game.combat = { id: 'c' };
    options = { ext: { [selects[0].name]: 'v:fire' } };
    await runApplyDialog(zord, options, { item: attack });
    expect(spend).toHaveBeenCalledWith(zord, 'free', expect.objectContaining({ source: 'Warhead Magazines' }));
    spend.mockImplementation(async () => ({ blocked: true }));
    options = { ext: { [selects[0].name]: 'v:fire' } };
    await runApplyDialog(zord, options, { item: attack });
    hit = { damageValue: 4, damageType: 'blunt' };
    hitRiderOnAttack(zord, null, hit, { itemUuid: attack.uuid, switches: options.ruleKeys ?? [] }, { damageBonusNote: jest.fn() });
    expect(hit.riderOptions).toBeUndefined();
  });

  test('no select on a non-area attack, on a non-Zord, or with nothing picked', () => {
    const melee = makeItem({ type: 'weaponEffect', name: 'Punch', system: { damageValue: 2 } });
    const picked = packItem(P.warhead);
    picked.flags.essence20.rules = { choices: { pr1Warhead: ['acid'] } };
    const zord = makeActor('Zord', [melee, picked], { type: 'zord' });
    expect(extDialogToggles(zord, { item: melee }).filter(t => t.type == 'select')).toEqual([]);
    // An area trait on the weapon counts too.
    const launcher = makeItem({ type: 'weapon', name: 'Launcher', system: { traits: ['area'] } });
    const shot = makeItem({ type: 'weaponEffect', name: 'Shot', flags: { essence20: { parentId: launcher.id } }, system: { damageValue: 2 } });
    addItem(zord, launcher);
    addItem(zord, shot);
    expect(extDialogToggles(zord, { item: shot }).filter(t => t.type == 'select')).toHaveLength(1);
    const attack = areaAttack();
    const pc = makeActor('PC', [attack, packItem(P.warhead)]);
    pc.items.contents[1].flags.essence20.rules = { choices: { pr1Warhead: ['acid'] } };
    expect(extDialogToggles(pc, { item: attack }).filter(t => t.type == 'select')).toEqual([]);
    const empty = areaAttack();
    const bare = makeActor('Bare', [empty, packItem(P.warhead)], { type: 'zord' });
    expect(extDialogToggles(bare, { item: empty }).filter(t => t.type == 'select')).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Pop Out / Telltale Sign                      */
/* -------------------------------------------- */

describe('Pop Out and Telltale Sign', () => {
  const observer = (name, willpower, cleverness) => makeActor(name, [], { type: 'npc', system: { defenses: { willpower: { total: willpower }, cleverness: { total: cleverness } } } });
  const attackFrom = (actor, targets) => runPostRoll(actor, targets.map(() => ({ success: true })), { isAttack: true }, { hits: targets.map(target => ({ target })), rider: {} });

  test('attacking while Hidden ends it; with Pop Out a button rolls Infiltration against every target\'s better of Willpower / Cleverness', async () => {
    const a = observer('A', 12, 14);
    const b = observer('B', 16, 10);
    const sneak = makeActor('Sneak', [packItem(P.popOut)], { flags: { o3Hidden: { epoch: 4 } } });
    await attackFrom(sneak, [a, b]);
    expect(isHidden(sneak)).toBe(false);
    const card = posted.find(m => m.flags?.essence20?.ruleButton);
    expect(card.content).toContain('Sneak attacked from hiding.');
    expect(card.content).toContain('Pop Out: roll Infiltration');

    rolls.total = jest.fn(async () => 15);
    expect(await pressRuleButton(card)).toBe(true);
    expect(rolls.total).toHaveBeenCalledWith(sneak, 'infiltration');
    expect(isHidden(sneak)).toBe(false);
    expect(posted.at(-1).content).toContain('Sneak is seen after the attack and loses the benefits of Hide.');
    // The card works once.
    expect(await pressRuleButton(card)).toBe(false);
  });

  test('beating them all hides again; without Pop Out (or not Hidden, or no target) nothing is offered', async () => {
    const a = observer('A', 12, 14);
    const sneak = makeActor('Sneak', [packItem(P.popOut)], { flags: { o3Hidden: { epoch: 4 } } });
    await attackFrom(sneak, [a]);
    rolls.total = jest.fn(async () => 14);
    await pressRuleButton(posted.find(m => m.flags?.essence20?.ruleButton));
    expect(isHidden(sneak)).toBe(true);
    expect(posted.at(-1).content).toContain('Sneak pops out and stays Hidden.');
    expect(posted.at(-1).content).not.toContain('<button');

    posted.length = 0;
    const plain = makeActor('Plain', [], { flags: { o3Hidden: { epoch: 4 } } });
    await attackFrom(plain, [a]);
    expect(isHidden(plain)).toBe(false);
    const seen = makeActor('Seen', [packItem(P.popOut)]);
    await attackFrom(seen, [a]);
    const alone = makeActor('Alone', [packItem(P.popOut)], { flags: { o3Hidden: { epoch: 4 } } });
    await attackFrom(alone, []);
    expect(isHidden(alone)).toBe(false);
    expect(posted.filter(m => m.flags?.essence20?.ruleButton)).toEqual([]);
  });

  test('Telltale Sign: a Frighten button per unseen creature on the success card; three presses each, a Free action in combat, rounds grow with each success', async () => {
    const a = observer('A', 12, 14);
    const b = observer('B', 10, 10);
    const sneak = makeActor('Sneak', [packItem(P.popOut), packItem(P.telltale)], { flags: { o3Hidden: { epoch: 4 } } });
    await attackFrom(sneak, [a, b]);
    rolls.total = jest.fn(async () => 20);
    await pressRuleButton(posted.find(m => m.flags?.essence20?.ruleButton));
    const card = posted.at(-1);
    expect(card.content).toContain('Sneak pops out and stays Hidden.');
    expect(card.content).toContain('E20.O3TelltaleFrighten');
    expect(card.flags.essence20.ruleButtons.buttons.map(button => button.targets)).toEqual([[a.uuid], [b.uuid]]);

    game.combat = { id: 'c' };
    await pressCardButton(card, 0);
    expect(spend).toHaveBeenCalledWith(sneak, 'free', expect.objectContaining({ source: 'Telltale Sign' }));
    expect(timed.at(-1)).toEqual({ name: 'A', status: 'frightened', rounds: 1 });
    expect(posted.at(-1).content).toContain('Sneak leaves a calling card: A is Frightened for 1 round(s).');

    // A miss: the press still counts, the rounds don't grow.
    rolls.total = jest.fn(async () => 13);
    await pressCardButton(card, 0);
    expect(posted.at(-1).content).toContain('A isn&#39;t frightened by Sneak.');
    rolls.total = jest.fn(async () => 14);
    await pressCardButton(card, 0);
    expect(timed.at(-1)).toEqual({ name: 'A', status: 'frightened', rounds: 2 });

    // A fourth press on the same creature: refused before the action is spent.
    spend.mockClear();
    await pressCardButton(card, 0);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.O3TelltaleMax');
    expect(spend).not.toHaveBeenCalled();

    // The other creature counts on its own; a blocked Free action uses no press.
    spend.mockImplementation(async () => ({ blocked: true }));
    await pressCardButton(card, 1);
    expect(card.flags.essence20.ruleButtons.buttons[1].vars).toEqual({});
    spend.mockImplementation(async () => ({ blocked: false }));
    await pressCardButton(card, 1);
    expect(timed.at(-1)).toEqual({ name: 'B', status: 'frightened', rounds: 1 });
    expect(card.flags.essence20.ruleButtons.buttons.map(button => button.vars)).toEqual([{ presses: 3, rounds: 2 }, { presses: 1, rounds: 1 }]);

    // Out of combat no action is spent; a cancelled roll is a miss.
    game.combat = null;
    spend.mockClear();
    rolls.total = jest.fn(async () => null);
    await pressCardButton(card, 1);
    expect(spend).not.toHaveBeenCalled();
    expect(posted.at(-1).content).toContain('B isn&#39;t frightened by Sneak.');
  });
});

/* -------------------------------------------- */
/*  Armor Matrix                                 */
/* -------------------------------------------- */

describe('Armor Matrix: only the best matrix\'s Toughness counts', () => {
  const bot = (items, canTransform = true) => makeActor('Bot', items, { system: { canTransform, defenses: { toughness: { total: 20, string: '20' } } } });

  test('two loose matrices: the lesser one\'s Toughness comes off, noted', () => {
    const light = packItem(P.matrixLight);
    const heavy = packItem(P.matrixHeavy);
    const actor = bot([light, heavy]);
    runDerived(actor);
    expect(actor.system.defenses.toughness).toEqual({ total: 20 - Number(light.system.armorBonus.value), string: `20 - ${light.system.armorBonus.value} (Only one Armor Matrix)` });
  });

  test('three: all but the best; one, an attached one, or a creature that can\'t transform - nothing', () => {
    const items = [packItem(P.matrixLight), packItem(P.matrixMedium), packItem(P.matrixHeavy)];
    const values = items.map(entry => Number(entry.system.armorBonus.value)).sort((x, y) => y - x);
    const three = bot(items);
    runDerived(three);
    expect(three.system.defenses.toughness.total).toBe(20 - values[1] - values[2]);

    const one = bot([packItem(P.matrixHeavy)]);
    runDerived(one);
    expect(one.system.defenses.toughness.total).toBe(20);

    const host = makeItem({ type: 'armor', name: 'Plating', system: { equipped: true } });
    const attached = bot([host, packItem(P.matrixLight, { flags: { parentId: host.id } }), packItem(P.matrixHeavy)]);
    runDerived(attached);
    expect(attached.system.defenses.toughness.total).toBe(20);

    const grounded = bot([packItem(P.matrixLight), packItem(P.matrixHeavy)], false);
    runDerived(grounded);
    expect(grounded.system.defenses.toughness.total).toBe(20);
  });
});
