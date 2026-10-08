import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 15, part Other (docs/rules-batches/slOther15.md): the rest-other survey's "piece" items, converted onto the
 * engine pieces this round built (module/rules/plugins/**). Each item is loaded from its pack source and must do what
 * the removed code (and its removed test) did.
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { costRulesFor } = await import('./actions.mjs');
const { validateRule } = await import('./types.mjs');
const { requireReload } = await import('../mechanics/combat/reload-trait.mjs');
const { getNumActions } = await import('../mechanics/actions/action-counts.mjs');
const { useIgnoredDrawback } = await import('./plugins/rolls/ignore-drawback.mjs');
const { isMountedWeaponSetUp } = await import('../items/attacks/mounted-weapons.mjs');
const { RollDialog } = await import('../mechanics/rolls/roll-dialog.mjs');
const { applyDamage } = await import('../mechanics/combat/combat.mjs');
const { applyEssenceDamage } = await import('../mechanics/world/environment-hazards.mjs');
const { registerRenegadeLookup } = await import('./plugins/combat/defeat-stage.mjs');
const { ruleDefersSpellCost } = await import('./plugins/resources/spell-cost-defer.mjs');
const { setWorldLookups } = await import('./predicate.mjs');
const { isRecklessAbandonActive } = await import('../items/rolls/reckless-abandon.mjs');
const { runPreCast } = await import('./plugins/picks/pre-cast.mjs');
const { fireItemAdded, fireTriggers } = await import('./triggers.mjs');
const { bankedSources } = await import('./bank.mjs');
const { ruleAttackHasTrait } = await import('./plugins/combat/attack-traits.mjs');
const { ruleCover, ruleDerived, ruleDialogSwitches, ruleRollSources, ruleSpecializes } = await import('./adapter.mjs');
const { LINK_HOLDERS } = await import('./index.mjs');
const { loadRoughTerrainLookup, setRoughTerrainLookup } = await import('./plugins/tags/rough-terrain-tag.mjs');
const { firePosted } = await import('./plugins/effects/rough-terrain-space.mjs');
const { recordRollFor, rollForAvailable, rollForOffered, useAssistPersist } = await import('./plugins/rolls/assist-extras.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FILES = {
  rapidReload: ['gijcrbitems/_source/Rapid_Reload_c0woQ6aEyVd4DBvA.json', 'tfcrbitems/_source/Rapid_Reload_Vj0RpJmj7XNKXphR.json'],
  ammoBelt: ['gijcrbitems/_source/Ammo_Belt_92V9QrCXJYmY2p7O.json', 'tfcrbitems/_source/Ammo_Belt_92V9QrCXJYmY2p7O.json'],
  revMorpher: 'jttitems/_source/Rev_Morpher_iOCPWtGFV7SpuP86.json',
  deepMagazines: 'gijcrbitems/_source/Deep_Magazines_REVp8LHYJFOqQ597.json',
  extendedMag: 'qgtgitems/_source/Extended_Mag_hPUmdnAN0FjRaal3.json',
  quickThinker: 'mlpcrbitems/_source/Quick_Thinker_i0PwoR0hDC0vyDD2.json',
  universityDays: 'wtnvcgitems/_source/University_Days_5T3DHQjLjyM9J5tS.json',
  footSoldier: 'tfcrbitems/_source/Foot_Soldier_VXQ32nRPF4qEYTZR.json',
  fieldTestExpert: 'ccitems/_source/Field_Test_Expert_bCNp9CxhKmIGifyY.json',
  snipeFromTheHip: 'tfcrbitems/_source/Snipe_From_The_Hip_uX9x7VEUy4LCdVIg.json',
  green: ['tfcrbitems/_source/Green_7t0TYx5BMrEHg1BE.json', 'gijcrbitems/_source/Green_oelHthPlqIq4eDpp.json'],
  immortalRebelSoul: 'wtnvcgitems/_source/Immortal_Rebel_Soul_SYFScAH8lDshgLNM.json',
  lifeSupporting: 'ccitems/_source/Life_Supporting_VokHpoLjUYTzA3Xk.json',
  notDoneYet: 'gijcrbitems/_source/Not_Done_Yet_wGAWnAM5zUgcNP9c.json',
  coinless: 'ttsgitems/_source/We_Are_The_Coinless_DRHPP4jmrjNa53ZA.json',
  spellDefer: ['kocitems/_source/Power_Conservationist_75H9N2YqaSDUhiCQ.json', 'kocitems/_source/Power_Mastery_qDsWwo5ipmzMMuO4.json'],
  enchant: 'mlpcrbitems/_source/Enchant_afYeCCAX0o2Cwf2I.json',
  getToKnow: 'dsoeitems/_source/Get_To_Know_pyRy1dFwuiJpAKj2.json',
  bestowExpertise: 'mlpcrbitems/_source/Bestow_Expertise_stwnP4um6j1xxzIo.json',
  // Those Who Know, Teach's lending tests stay in mechanics/actions/lend-assistance.test.js (they read its pack rule).
  thoseWhoKnow: 'mlpcrbitems/_source/Those_Who_Know__Teach_Xi0qQqfZQJh0MBTu.json',
  conniving: 'ccitems/_source/Conniving_dJoVvMG3wjowbWJ8.json',
  fieldtest: 'gijcrbitems/_source/Fieldtest_bPMgz1ct8T0kgQ6K.json',
  usedToTheDark: 'ccitems/_source/Used_to_the_Dark_IYN4Bki5gbGXPkki.json',
  biggerBooms: 'gijcrbitems/_source/Bigger_Booms_8oGpBcKAnhJaSqVD.json',
  hardenedArmor: 'atsitems/_source/Hardened_Armor_LVyy4985HSSKCnGs.json',
  frenemy: 'mlpcrbitems/_source/Frenemy_N6Bs8to6G0QddMVK.json',
  ramCone: 'dditems/_source/Ram_Cone_sdrLrrdWEM6LrD7W.json',
  expertGuidance: 'iafav2items/_source/Expert_Guidance_oUQUSWSj3JZ1tBR3.json',
  bowlingTeam: 'wtnvcgitems/_source/Bowling_Team_V11B4h7plsBAaq34.json',
  fastModulation: 'prcrbitems/_source/Fast_Modulation_38bDkuZ73CmGBOSe.json',
  heavyWater: 'ocitems/_source/Heavy_Water_Coolant_e8WNnjzWGNWBd2UJ.json',
  enhancedSummoner: 'prcrbitems/_source/Enhanced_Summoner_pmA5wQDbc5oQk5Ak.json',
  takePoint: 'tfcrbitems/_source/Take_Point_efPOy3Owf2XIAykS.json',
  piledriver: 'tfcrbitems/_source/Piledriver_e4VcKpeXMlHOBkPV.json',
  advancedLink: 'eocitems/_source/Advanced_Link_fTRSvbpJrCWUY6wU.json',
  perfectLink: 'eocitems/_source/Perfect_Link_i3yGBZd2y7jT1SWm.json',
  armoredConnection: 'eocitems/_source/Armored_Connection_V7yh8guXzkF1qqAK.json',
  bondedProficiency: 'eocitems/_source/Bonded_Proficiency_ZMs9cLu6O89Lv7Oo.json',
  synapticLinkage: 'eocitems/_source/Synaptic_Linkage_3JCZlRjXovAMXmko.json',
  blastAttack: 'prcrbitems/_source/Blast_Attack_Wb8UARwQKKyiwy77.json',
  multiLimb: 'ttsgitems/_source/Multi_Limb_Attack_cRtPjBG1OoXwKJ0b.json',
  enhanceAttack: 'prcrbitems/_source/Enhance__Attack__OibmwLDNcXE6eJIO.json',
  increaseEssence: 'prcrbitems/_source/Increase_Essence_oKGzWCOUCuefWuqD.json',
  lightChassis: 'prcrbitems/_source/Light_Chassis_rVW7mvnV4MbGuxoq.json',
  movementBooster: 'prcrbitems/_source/Movement_Booster_9YQmZGdNCmtXLAd4.json',
  // The staged applyingDamage Perks: their card tests are in module/chat.test.js (which reads these pack rules).
  applyingStages: [
    'gijcrbitems/_source/Sudden_Death_bfBFQH3sxny3BfEK.json', 'gijcrbitems/_source/Fortitude_19odrVUOsp4dCiOV.json',
    'gijcrbitems/_source/Extra_Plates_xr0PvYXRNAg9cU42.json', 'gijcrbitems/_source/Didn_t_Even_Feel_It_y7hyuXOuARcKgahl.json',
    'fffav1items/_source/Invincibility_Through_Invisibility_kYYPAxXMpJRMnq6Z.json', 'gijcrbitems/_source/Just_a_Graze_YXL5dCiLZvzDgZzJ.json',
  ],
  // Their behaviour tests stay in mechanics/combat/sneak-attack.test.js, which now reads these pack rules.
  sneakAttack: [
    'gijcrbitems/_source/Everything_s_A_Weapon_hx4KzTl8iQ8Z22eq.json', 'gijcrbitems/_source/Never_Heard_It_Coming_jIUKR6chHdKQO2vr.json',
    'ccitems/_source/Focused_Charge_mQ0s9B2it1mqho3H.json', 'ccitems/_source/Sudden_Strike_G3cypoJyLtlLogzO.json',
  ],
};
const RAPID_RELOAD_GIJ = 'Compendium.essence20.gi_joe_crb.Item.c0woQ6aEyVd4DBvA';

let nextId = 1;
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

/** A pack item as an owned copy (its book source on flags.core.sourceId, or `source`), or plain data. */
function itemFrom(entry, extra = {}) {
  const doc = typeof entry == 'string' ? fromPack(entry) : entry;
  const flags = {};
  const item = {
    id: `i${nextId++}`, name: doc.name, type: doc.type, effects: [],
    flags: { core: { sourceId: extra.source ?? (doc._id ? `Compendium.essence20.pack.Item.${doc._id}` : null) }, ...(extra.flags ?? {}) },
    system: JSON.parse(JSON.stringify({ ...(doc.system ?? {}), ...(extra.system ?? {}) })),
    getFlag(scope, key) {
      return getPath(this.flags[scope] ?? flags, key);
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    async unsetFlag(scope, key) {
      delete this.flags[scope]?.[key];
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
  };
  return item;
}

function makeActor(entries = [], { system = {}, type = 'playerCharacter' } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name: 'Hero', type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { level: 3, ...system },
    getFlag(scope, key) {
      return getPath(this.flags[scope] ?? {}, key);
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }

      rebuildIndex(this);
    },
    createEmbeddedDocuments: jest.fn(async (kind, datas) => datas.map(data => {
      const made = { id: `i${nextId++}`, parent: actor, effects: [], flags: {}, system: {}, ...data };
      items.push(made);
      return made;
    })),
  };
  actor.uuid = `Actor.${actor.id}`;
  // An array (find / some / filter, as the hand-written helpers use) that is also a collection (contents, get).
  actor.items = Object.assign(items, { contents: items, get: id => items.find(item => item.id == id) });
  for (const entry of entries) {
    const item = entry?.id ? entry : itemFrom(entry);
    item.parent = actor;
    items.push(item);
  }

  rebuildIndex(actor);
  return actor;
}

const add = (actor, item) => {
  item.parent = actor;
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
};

/** A weapon on the actor, and (optionally) an upgrade from `file` attached to it. */
function weaponWith(actor, file = null, name = 'Machine Gun') {
  const weapon = add(actor, itemFrom({ name, type: 'weapon', system: { equipped: true, traits: ['reload'] } }));
  if (file) {
    add(actor, itemFrom(file, { flags: { essence20: { parentId: weapon.id } } }));
  }

  return weapon;
}

beforeAll(() => {
  global.foundry.utils.setProperty = setPath;
  global.foundry.utils.getProperty = getPath;
});

beforeEach(() => {
  global.game = { ...(global.game ?? {}), combat: null, actors: [], user: { id: 'u', isGM: false, targets: new Set() } };
  global.ui = { ...(global.ui ?? {}), notifications: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } };
});

test('every rule this round added validates', () => {
  const files = Object.values(FILES).flat();
  for (const file of files) {
    for (const rule of fromPack(file).system.rules) {
      expect([file, validateRule(rule)]).toEqual([file, []]);
    }
  }
});

/* ---- Rapid Reload x2, Ammo Belt x2 (was reload-trait.mjs#getReloadCost), Rev Morpher (was morph-state.mjs#morphActionType) ---- */

describe('ActionCost reload / morph', () => {
  test.each(FILES.rapidReload)('Rapid Reload (%s) makes every reload a Free action', file => {
    const actor = makeActor([file]);
    const weapon = weaponWith(actor);
    const [rule, ...rest] = costRulesFor(actor);
    expect(rest).toEqual([]);
    expect(rule.matches({ kind: 'reload', item: weapon })).toBe(true);
    expect(rule.to()).toBe('free');
    expect(rule.limit).toBeUndefined();
    expect(rule.label).toBe('Rapid Reload');
    expect(rule.matches({ kind: 'attack', item: weapon })).toBe(false);
  });

  test.each(FILES.ammoBelt)('Ammo Belt (%s): once per scene, its own weapon reloads as a Free action', file => {
    const actor = makeActor();
    const belted = weaponWith(actor, file);
    const other = weaponWith(actor, null, 'Pistol');
    const [rule] = costRulesFor(actor);
    expect(rule.matches({ kind: 'reload', item: belted })).toBe(true);
    expect(rule.matches({ kind: 'reload', item: other })).toBe(false);
    expect(rule.to()).toBe('free');
    expect(rule.limit).toEqual({ window: 'scene', max: 1 });
    // Counted per belt (so per weapon): two belted weapons keep separate uses.
    const second = weaponWith(actor, file, 'Rifle');
    const ids = costRulesFor(actor).map(entry => entry.id);
    expect(new Set(ids).size).toBe(2);
    expect(costRulesFor(actor).some(entry => entry.matches({ kind: 'reload', item: second }))).toBe(true);
  });

  test('with Rapid Reload, the Ammo Belt is left for later (Rapid Reload went first)', () => {
    const actor = makeActor([itemFrom(FILES.rapidReload[0], { source: RAPID_RELOAD_GIJ })]);
    const belted = weaponWith(actor, FILES.ammoBelt[0]);
    const belt = costRulesFor(actor).find(entry => entry.label == 'Ammo Belt');
    expect(belt.matches({ kind: 'reload', item: belted })).toBe(false);
  });

  test('Rev Morpher: Morphing takes a Move action (an unequipped Rev Morpher does nothing)', () => {
    const [rule, ...rest] = costRulesFor(makeActor([FILES.revMorpher]));
    expect(rest).toEqual([]);
    expect(rule.matches({ kind: 'morph' })).toBe(true);
    expect(rule.to()).toBe('move');
    expect(rule.matches({ kind: 'reload' })).toBe(false);
    expect(costRulesFor(makeActor([itemFrom(FILES.revMorpher, { system: { equipped: false } })]))).toEqual([]);
  });
});

/* ---- Deep Magazines, Extended Mag (was reload-trait.mjs#requireReload) ---- */

describe('ReloadSkip', () => {
  test('Deep Magazines ignores the first reload in a combat, then reloads as normal', async () => {
    game.combat = { id: 'c1', round: 1 };
    const actor = makeActor([FILES.deepMagazines]);
    const weapon = weaponWith(actor);
    expect(await requireReload(actor, weapon)).toBe(false);
    expect(weapon.flags.essence20?.needsReload).toBeUndefined();
    expect(ui.notifications.info).toHaveBeenCalledWith('E20.DeepMagazinesSkippedReload');
    expect(await requireReload(actor, weapon)).toBe(true);
    expect(weapon.flags.essence20.needsReload).toBe(true);
  });

  test('Deep Magazines does nothing outside combat', async () => {
    const actor = makeActor([FILES.deepMagazines]);
    expect(await requireReload(actor, weaponWith(actor))).toBe(true);
  });

  test('Extended Mag: once per scene its own weapon skips a reload, in or out of combat', async () => {
    const actor = makeActor();
    const weapon = weaponWith(actor, FILES.extendedMag);
    const other = weaponWith(actor, null, 'Pistol');
    expect(await requireReload(actor, other)).toBe(true);
    expect(await requireReload(actor, weapon)).toBe(false);
    expect(ui.notifications.info).toHaveBeenCalledWith('E20.ExtendedMagSkippedReload');
    expect(await requireReload(actor, weapon)).toBe(true);
  });

  test('with both, Deep Magazines is used first', async () => {
    game.combat = { id: 'c1', round: 1 };
    const actor = makeActor();
    const weapon = weaponWith(actor, FILES.extendedMag);
    add(actor, itemFrom(FILES.deepMagazines));
    expect(await requireReload(actor, weapon)).toBe(false);
    expect(ui.notifications.info).toHaveBeenLastCalledWith('E20.DeepMagazinesSkippedReload');
    expect(await requireReload(actor, weapon)).toBe(false);
    expect(ui.notifications.info).toHaveBeenLastCalledWith('E20.ExtendedMagSkippedReload');
    expect(await requireReload(actor, weapon)).toBe(true);
  });
});

/* ---- Quick Thinker, University Days, Foot Soldier (was mechanics/actions/action-counts.mjs) ---- */

describe('ActionCount', () => {
  test.each([['quickThinker'], ['universityDays']])('%s: Free actions come from Smarts instead of Speed', key => {
    const actor = makeActor([FILES[key]], { system: { essences: { speed: { max: 5 }, smarts: { max: 3 } } } });
    expect(getNumActions(actor)).toEqual({ free: 1, movement: 1, standard: 1 });
    // Move / Standard still key off Speed.
    const slow = makeActor([FILES[key]], { system: { essences: { speed: { max: 0 }, smarts: { max: 5 } } } });
    expect(getNumActions(slow)).toEqual({ free: 3, movement: 0, standard: 0 });
  });

  test('Foot Soldier: Speed counts 2 higher for Free actions in Bot Mode, not in Alt Mode', () => {
    const bot = makeActor([FILES.footSoldier], { system: { essences: { speed: { max: 3 } }, isTransformed: false } });
    expect(getNumActions(bot)).toEqual({ free: 3, movement: 1, standard: 1 });
    const alt = makeActor([FILES.footSoldier], { system: { essences: { speed: { max: 3 } }, isTransformed: true } });
    expect(getNumActions(alt)).toEqual({ free: 1, movement: 1, standard: 1 });
  });

  test('Quick Thinker wins over Foot Soldier (the old else-if)', () => {
    const actor = makeActor([FILES.footSoldier, FILES.quickThinker], { system: { essences: { speed: { max: 3 }, smarts: { max: 4 } } } });
    expect(getNumActions(actor).free).toBe(2);
  });
});

/* ---- Field Test Expert (was dice.mjs, Temperamental Fumble), Snipe From The Hip (was mounted-weapons.mjs) ---- */

test('Field Test Expert: once per combat a Temperamental Fumble is only a failure, with its chat line', async () => {
  const actor = makeActor([FILES.fieldTestExpert]);
  const first = await useIgnoredDrawback(actor, 'temperamentalFumble');
  expect(first.rule.message).toBe('E20.FieldTestExpertSaved');
  expect(await useIgnoredDrawback(actor, 'temperamentalFumble')).toBeNull();
  expect(await useIgnoredDrawback(makeActor(), 'temperamentalFumble')).toBeNull();
});

test("Snipe From The Hip: the Long Range Rifle counts as set up, other Mounted weapons don't", () => {
  const actor = makeActor([FILES.snipeFromTheHip]);
  const rifle = add(actor, itemFrom({ name: 'Long Range Rifle', type: 'weapon', system: { traits: ['mounted'] } }));
  const cannon = add(actor, itemFrom({ name: 'Cannon', type: 'weapon', system: { traits: ['mounted'] } }));
  expect(isMountedWeaponSetUp(rifle)).toBe(true);
  expect(isMountedWeaponSetUp(cannon)).toBe(false);
  const without = makeActor();
  expect(isMountedWeaponSetUp(add(without, itemFrom({ name: 'Long Range Rifle', type: 'weapon', system: {} })))).toBe(false);
});

/* ---- Green x2 (was roll-dialog.mjs#_isUntrainedSnag; per-printing tests in mechanics/rolls/roll-dialog.test.js) ---- */

test('Green: with both printings, the Transformers uses go first, then the GI Joe ones', async () => {
  game.combat = { id: 'c1', started: true };
  const actor = makeActor(FILES.green);
  const dialog = new RollDialog();
  for (let i = 0; i < 6; i++) {
    expect(await dialog._isUntrainedSnag({ shift: 'd20' }, actor, 'athletics')).toBe(false);
  }

  expect(await dialog._isUntrainedSnag({ shift: 'd20' }, actor, 'athletics')).toBe(true);
  const [tf, gij] = actor.items.contents;
  expect(actor.flags.essence20.ruleUses[`${tf.id}-0`].count).toBe(3);
  expect(actor.flags.essence20.ruleUses[`${gij.id}-0`].count).toBe(3);
});

/* ---- Immortal Rebel Soul, Life Supporting, Not Done Yet, We Are The Coinless (was combat.mjs's Defeat-save chain) ---- */

describe('wouldBeDefeated stages', () => {
  // essence20.mjs hands the predicate its world lookups; self:recklessAbandon reads isRecklessAbandonActive.
  beforeAll(() => setWorldLookups({ recklessAbandon: isRecklessAbandonActive }));
  afterAll(() => setWorldLookups({ recklessAbandon: null }));

  const RECKLESS_ABANDON = 'Compendium.essence20.gi_joe_crb.Item.84d0XTJwKCYMJUgY';
  function defeatable(entries, { health = 3, reckless = false, type = 'playerCharacter' } = {}) {
    const actor = makeActor(entries, { type, system: { health: { value: health, max: 10 }, immunities: {}, powers: { personal: { value: 0 } } } });
    const rolePoints = { flags: { core: { sourceId: RECKLESS_ABANDON } }, system: { isActive: reckless } };
    actor._getBaseRolePoints = () => rolePoints;
    actor.toggleStatusEffect = jest.fn(async (id, { active }) => (active ? actor.statuses.add(id) : actor.statuses.delete(id)));
    return actor;
  }

  test('Immortal Rebel Soul: Health stays at 1 once per encounter, and its Essence half shares that use', async () => {
    const actor = defeatable([FILES.immortalRebelSoul]);
    expect(await applyDamage(actor, 5, 'sharp')).toBe(2);
    expect(actor.system.health.value).toBe(1);
    expect(await applyDamage(actor, 5, 'sharp')).toBe(1);
    expect(actor.system.health.value).toBe(0);

    const drained = defeatable([FILES.immortalRebelSoul]);
    drained.system.essences = { smarts: { value: 1 } };
    expect(await applyEssenceDamage(drained, ['smarts'])).toEqual([]);
    expect(drained.system.essences.smarts.value).toBe(1);
    // ...which used up the Health half too.
    await applyDamage(drained, 5, 'sharp');
    expect(drained.system.health.value).toBe(0);
    // A hit that doesn't Defeat uses nothing.
    const healthy = defeatable([FILES.immortalRebelSoul], { health: 10 });
    await applyDamage(healthy, 5, 'sharp');
    expect(healthy.flags.essence20.ruleUses).toBeUndefined();
  });

  test('Life Supporting: worn, unattached and unspent, it keeps you at 1 and goes spent', async () => {
    const actor = defeatable([FILES.lifeSupporting]);
    const [upgrade] = actor.items.contents;
    expect(await applyDamage(actor, 5, 'sharp')).toBe(2);
    expect(upgrade.flags.essence20.lifeSupportingSpent).toBe(true);
    rebuildIndex(actor);
    expect(await applyDamage(actor, 5, 'sharp')).toBe(1);
    const attached = defeatable([itemFrom(FILES.lifeSupporting, { flags: { essence20: { parentId: 'armor1' } } })]);
    await applyDamage(attached, 5, 'sharp');
    expect(attached.system.health.value).toBe(0);
  });

  test('Immortal Rebel Soul goes before Life Supporting (one save, not both)', async () => {
    const actor = defeatable([FILES.immortalRebelSoul, FILES.lifeSupporting]);
    await applyDamage(actor, 5, 'sharp');
    expect(actor.system.health.value).toBe(1);
    expect(actor.items.contents[1].flags.essence20?.lifeSupportingSpent).toBeUndefined();
  });

  test('Not Done Yet: once per encounter while Reckless Abandon is active', async () => {
    const actor = defeatable([FILES.notDoneYet], { reckless: true });
    await applyDamage(actor, 5, 'sharp');
    expect(actor.system.health.value).toBe(1);
    await applyDamage(actor, 5, 'sharp');
    expect(actor.system.health.value).toBe(0);
    const calm = defeatable([FILES.notDoneYet], { reckless: false });
    await applyDamage(calm, 5, 'sharp');
    expect(calm.system.health.value).toBe(0);
  });

  test("Not Done Yet with Racer Abandon: protects the driven vehicle (on the driver's use), not the driver", async () => {
    const driver = defeatable([FILES.notDoneYet], { reckless: true });
    const vehicle = defeatable([], { type: 'vehicle' });
    registerRenegadeLookup(actor => (actor === vehicle ? driver : actor === driver ? null : actor));
    game.actors = { contents: [driver, vehicle], get: id => [driver, vehicle].find(a => a.id == id), [Symbol.iterator]: () => [driver, vehicle][Symbol.iterator]() };
    await applyDamage(driver, 5, 'sharp');
    expect(driver.system.health.value).toBe(0);
    await applyDamage(vehicle, 5, 'sharp');
    expect(vehicle.system.health.value).toBe(1);
    expect(Object.keys(driver.flags.essence20.ruleUses)).toEqual(['notDoneYet']);
    registerRenegadeLookup(null);
  });

  test('We Are The Coinless: a teammate on the canvas with 1 Personal Power may keep you at 1, Impaired - asked, last', async () => {
    const victim = defeatable([]);
    const rescuer = defeatable([FILES.coinless], { health: 10 });
    rescuer.name = 'Zack';
    rescuer.system.powers.personal.value = 2;
    const token = (actor, x, disposition = 1) => ({ actor, document: { disposition }, center: { x, y: 0 } });
    const tokens = [token(victim, 0), token(rescuer, 50)];
    victim.getActiveTokens = () => [tokens[0]];
    rescuer.getActiveTokens = () => [tokens[1]];
    global.canvas = { tokens: { placeables: tokens }, grid: { measurePath: () => ({ distance: 50 }) } };
    const confirm = jest.fn(async () => true);
    global.foundry.applications = { api: { DialogV2: { confirm } } };

    await applyDamage(victim, 5, 'sharp');
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(victim.system.health.value).toBe(1);
    expect(rescuer.system.powers.personal.value).toBe(1);
    expect(victim.statuses.has('impaired')).toBe(true);

    // Declined: nothing spent.
    confirm.mockResolvedValueOnce(false);
    victim.system.health.value = 3;
    await applyDamage(victim, 5, 'sharp');
    expect(victim.system.health.value).toBe(0);
    expect(rescuer.system.powers.personal.value).toBe(1);

    // Never the holder themselves; and Immortal Rebel Soul on the victim goes first.
    rescuer.system.health.value = 2;
    await applyDamage(rescuer, 5, 'sharp');
    expect(rescuer.system.health.value).toBe(0);
    const lucky = defeatable([FILES.immortalRebelSoul]);
    lucky.getActiveTokens = () => [token(lucky, 0)];
    tokens.push(lucky.getActiveTokens()[0]);
    confirm.mockClear();
    await applyDamage(lucky, 5, 'sharp');
    expect(lucky.system.health.value).toBe(1);
    expect(confirm).not.toHaveBeenCalled();
    delete global.canvas;
  });
});

/* ---- Power Conservationist, Power Mastery (was documents/item.mjs; the cast itself: documents/item.test.js) ---- */

test.each(FILES.spellDefer)("%s puts every spell's cost after its Skill Test", file => {
  expect(fromPack(file).system.rules).toEqual([expect.objectContaining({ type: 'SpellCostDefer' })]);
  const spell = itemFrom({ name: 'Bolt', type: 'spell', system: { cost: 2 } });
  expect(ruleDefersSpellCost(makeActor([file]), spell)).toBe(true);
  expect(ruleDefersSpellCost(makeActor(), spell)).toBe(false);
});

/* ---- Enchant, Get To Know, Bestow Expertise (was documents/item.mjs's pre-cast pickers + dice.mjs's post-cast blocks) ---- */

describe("PreCast + the spells' own afterRoll Triggers", () => {
  const ui = (answers) => {
    const queue = [...answers];
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async () => queue.shift()), prompt: jest.fn(async () => queue.shift()) } } };
    global.foundry.utils.escapeHTML ??= text => String(text);
  };

  const target = (actor) => {
    global.game.user.targets = new Set([{ actor }]);
  };

  // The pick offers the caster's own Skills (every Skill on a character's sheet - the old picker listed CONFIG's).
  const cast = (actor, spell, outcome = 'success') => fireTriggers(actor, 'afterRoll', { outcome, roll: { item: spell } });

  test('Enchant: the Skill is picked first (cancel = no cast); a success banks ↑1 on that Skill for the target, or the caster', async () => {
    const caster = makeActor([FILES.enchant], { system: { skills: { culture: { shift: 'd4' }, athletics: { shift: 'd2' } } } });
    const spell = caster.items.contents[0];
    ui([null]);
    expect(await runPreCast(caster, spell)).toBe(false);
    ui(['culture']);
    expect(await runPreCast(caster, spell)).toBe(true);
    const ally = makeActor();
    target(ally);
    await cast(caster, spell);
    expect(bankedSources(ally, null, { rolledSkill: 'culture' }).sources).toEqual([expect.objectContaining({ label: 'Enchant', shiftUp: 1 })]);
    expect(bankedSources(ally, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    // Nothing targeted: the caster; a failed cast banks nothing.
    global.game.user.targets = new Set();
    await cast(caster, spell, 'failure');
    expect(bankedSources(caster, null, { rolledSkill: 'culture' }).sources).toEqual([]);
    await cast(caster, spell);
    expect(bankedSources(caster, null, { rolledSkill: 'culture' }).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  });

  test('Get To Know: a success with a target banks the caster an Edge on that Skill against that target, for the scene', async () => {
    const caster = makeActor([FILES.getToKnow], { system: { skills: { culture: { shift: 'd4' }, athletics: { shift: 'd2' } } } });
    const spell = caster.items.contents[0];
    ui(['culture']);
    await runPreCast(caster, spell);
    await cast(caster, spell);
    expect(caster.flags.essence20.ruleBank).toBeUndefined();
    const foe = makeActor();
    const other = makeActor();
    target(foe);
    await cast(caster, spell);
    const [entry] = caster.flags.essence20.ruleBank;
    expect(entry).toEqual(expect.objectContaining({ edge: true, until: 'scene' }));
    expect(bankedSources(caster, foe, { rolledSkill: 'culture' }).sources).toEqual([expect.objectContaining({ edge: true })]);
    expect(bankedSources(caster, other, { rolledSkill: 'culture' }).sources).toEqual([]);
    expect(bankedSources(caster, foe, { rolledSkill: 'athletics' }).sources).toEqual([]);
  });

  test('Bestow Expertise: Skill and name first (no name = no cast); a success gives the target a scene-long Specialization', async () => {
    const caster = makeActor([FILES.bestowExpertise], { system: { skills: { culture: { shift: 'd4' }, athletics: { shift: 'd2' } } } });
    const spell = caster.items.contents[0];
    ui(['culture', '   ']);
    expect(await runPreCast(caster, spell)).toBe(false);
    ui(['culture', 'ancient lore']);
    expect(await runPreCast(caster, spell)).toBe(true);
    const ally = makeActor([], { system: { skills: { culture: { shift: 'd6', specializations: {} } } } });
    target(ally);
    await cast(caster, spell);
    expect(ally.system.skills.culture.specializations.ancientLore).toEqual(expect.objectContaining({
      name: 'Ancient Lore', shift: 'd6', granted: true, isSpecialized: true,
    }));
    expect(ally.flags.essence20.bestowedExpertise).toEqual([{ skill: 'culture', key: 'ancientLore' }]);
  });
});

/* ---- Conniving (was lend-assistance.mjs's CONNIVING_PERK_ID checks) ---- */

test('Conniving: offered when an ally holds it; once per scene for each helper with that holder', async () => {
  const holder = makeActor([FILES.conniving]);
  const helper = makeActor();
  const other = makeActor();
  expect(rollForOffered([holder], helper)).toBe(true);
  expect(rollForOffered([other], helper)).toBe(false);
  const entry = rollForAvailable(helper, holder, 'might');
  expect(entry).not.toBeNull();
  await recordRollFor(helper, holder, entry);
  expect(rollForAvailable(helper, holder, 'might')).toBeNull();
  // Another helper still may.
  expect(rollForAvailable(other, holder, 'might')).not.toBeNull();
  expect(rollForAvailable(helper, other, 'might')).toBeNull();
});

test('Those Who Know, Teach: three lasting assists a scene', async () => {
  const teacher = makeActor([FILES.thoseWhoKnow]);
  const ally = makeActor();
  for (let i = 0; i < 3; i++) {
    expect(await useAssistPersist(teacher, ally, 'might')).toBe(true);
  }

  expect(await useAssistPersist(teacher, ally, 'might')).toBe(false);
  expect(await useAssistPersist(makeActor(), ally, 'might')).toBe(false);
});

/* ---- Fieldtest, Used to the Dark, Bigger Booms: their old tests now carry these exact rules - check them against the packs ---- */

test('Fieldtest, Used to the Dark and Bigger Booms carry the rules their mechanics tests use', () => {
  expect(fromPack(FILES.fieldtest).system.rules).toEqual([expect.objectContaining({ type: 'AvailabilityShift', steps: -1 })]);
  expect(fromPack(FILES.usedToTheDark).system.rules).toEqual([expect.objectContaining({ type: 'SenseMultiplier', multiply: 2 })]);
  expect(fromPack(FILES.biggerBooms).system.rules).toEqual([expect.objectContaining({
    type: 'AreaRadius', add: 10, items: ['item:data:system.classification.style=explosive'],
  })]);
});

/* ---- Hardened Armor (was combat.mjs#grantHardenedArmorResistance) ---- */

describe('Hardened Armor: Resistance for the rest of the scene after a non-Blunt / Sharp hit', () => {
  const hurtable = (resistances = {}, entries = [FILES.hardenedArmor]) => makeActor(entries, { system: { health: { value: 10 }, immunities: {}, resistances, stun: { value: 0 } } });

  test('grants it once real damage of that type lands - Stun too', async () => {
    const actor = hurtable();
    await applyDamage(actor, 3, 'fire');
    expect(actor.flags.essence20.sceneResistances.fire).toEqual(expect.objectContaining({ window: 'scene', morphedOnly: false }));
    const stunned = hurtable();
    stunned.toggleStatusEffect = jest.fn();
    await applyDamage(stunned, 2, 'stun');
    expect(stunned.flags.essence20.sceneResistances.stun).toEqual(expect.objectContaining({ window: 'scene' }));
  });

  test('not for Blunt or Sharp, without the Perk, when already Resistant, or when nothing landed', async () => {
    for (const type of ['blunt', 'sharp']) {
      const actor = hurtable();
      await applyDamage(actor, 3, type);
      expect(actor.flags.essence20.sceneResistances).toBeUndefined();
    }

    const plain = hurtable({}, []);
    await applyDamage(plain, 3, 'fire');
    expect(plain.flags.essence20.sceneResistances).toBeUndefined();
    const resistant = hurtable({ fire: true });
    await applyDamage(resistant, 3, 'fire');
    expect(resistant.flags.essence20.sceneResistances).toBeUndefined();
    const immune = hurtable();
    immune.system.immunities = { fire: true };
    await applyDamage(immune, 3, 'fire');
    expect(immune.flags.essence20.sceneResistances).toBeUndefined();
  });
});

/* ---- Frenemy (was nearby-allies.mjs's FRENEMY_ID; the lookup itself: mechanics/combat/nearby-allies.test.js) ---- */

test('Frenemy carries the AllyFilter rule its lookup test uses', () => {
  expect(fromPack(FILES.frenemy).system.rules).toEqual([expect.objectContaining({ type: 'AllyFilter', anyDisposition: true })]);
});

/* ---- Ram Cone (was weapon-traits.mjs#ramConeAltAttack / ramConeBotUnarmed + dice.mjs) ---- */

describe('Ram Cone', () => {
  const attack = (name, system = {}, parentId = null) => itemFrom({ name, type: 'weaponEffect', system }, parentId ? { flags: { essence20: { parentId } } } : {});

  test('in Alt Mode, Flyby / Ram / Slam / Bash attacks count as Armor Piercing and Anti-Tank', () => {
    const actor = makeActor([itemFrom(FILES.ramCone, { system: { equipped: true } })], { system: { isTransformed: true } });
    for (const item of [attack('Ram', { isRam: true }), attack('Dive', { isFlyby: true }), attack('Tail Slam'), attack('Shoulder Bash')]) {
      expect(ruleAttackHasTrait(actor, item, 'armorPiercing')).toBe(true);
      expect(ruleAttackHasTrait(actor, item, 'antiTank')).toBe(true);
    }

    expect(ruleAttackHasTrait(actor, attack('Laser'), 'armorPiercing')).toBe(false);
    actor.system.isTransformed = false;
    expect(ruleAttackHasTrait(actor, attack('Ram', { isRam: true }), 'antiTank')).toBe(false);
  });

  test("in Bot Mode the unarmed Blunt attack's own ↓1 is offset by ↑1", () => {
    const actor = makeActor([itemFrom(FILES.ramCone, { system: { equipped: true } })], { system: { isTransformed: false } });
    const punch = attack('Punch', { damageType: 'blunt', shiftDown: 1 });
    expect(ruleRollSources(actor, null, { item: punch, isAttack: true }).sources).toEqual([expect.objectContaining({ label: 'Ram Cone', shiftUp: 1 })]);
    expect(ruleRollSources(actor, null, { item: attack('Kick', { damageType: 'sharp', shiftDown: 1 }), isAttack: true }).sources).toEqual([]);
    expect(ruleRollSources(actor, null, { item: attack('Sword', { damageType: 'blunt', shiftDown: 1 }, 'w1'), isAttack: true }).sources).toEqual([]);
    actor.system.isTransformed = true;
    rebuildIndex(actor);
    expect(ruleRollSources(actor, null, { item: punch, isAttack: true }).sources).toEqual([]);
  });
});

/* ---- Expert Guidance, Bowling Team, Fast Modulation, Heavy Water Coolant, Enhanced Summoner: their mechanics tests carry these rules ---- */

test('the packs carry the rules their mechanics tests use', () => {
  expect(fromPack(FILES.expertGuidance).system.rules).toEqual([expect.objectContaining({
    type: 'RequisitionShift', upshift: 2, items: ['item:data:system.totalAvailability=theoretical'],
  })]);
  expect(fromPack(FILES.bowlingTeam).system.rules).toEqual([expect.objectContaining({ type: 'GroupTestBonus', upshift: 1, who: 'led' })]);
  expect(fromPack(FILES.fastModulation).system.rules).toEqual([expect.objectContaining({ type: 'JoinDie', steps: 1, stacks: true })]);
  expect(fromPack(FILES.heavyWater).system.rules).toEqual([expect.objectContaining({ type: 'VehicleDefeat', brawnDif: 10 })]);
  expect(fromPack(FILES.enhancedSummoner).system.rules).toEqual([expect.objectContaining({ type: 'SummonTimeBonus', amount: 1, sceneAllies: true })]);
});

/* ---- Take Point (was rough-terrain.mjs#hasTakePointCover + its ROUGH_TERRAIN_IGNORERS entry) ---- */

test('Take Point: standing in Rough Terrain, ranged attacks against you count you as in Cover', async () => {
  const holder = makeActor([FILES.takePoint]);
  const attacker = makeActor();
  let rough = true;
  setRoughTerrainLookup(actor => actor === holder && rough);
  expect(ruleCover(attacker, holder, { isAttack: true }).grant).toBe(true);
  rough = false;
  expect(ruleCover(attacker, holder, { isAttack: true }).grant).toBe(false);
  rough = true;
  expect(ruleCover(attacker, makeActor(), { isAttack: true }).grant).toBe(false);
  // Its own ranged attacks aren't helped by it.
  expect(ruleCover(holder, attacker, { isAttack: true }).grant).toBe(false);
  await loadRoughTerrainLookup();
  setRoughTerrainLookup(null);
});

/* ---- Piledriver (was documents/item.mjs's isPiledriver / rough-terrain.mjs#offerPiledriverRoughTerrain) ---- */

test('Piledriver: posted from the sheet in Alt Mode, it asks to place a space of Rough Terrain', async () => {
  const confirm = jest.fn(async () => false);
  global.foundry.applications = { api: { DialogV2: { confirm } } };
  global.canvas = { ready: true, scene: { grid: { size: 100 } } };
  const actor = makeActor([itemFrom(FILES.piledriver, { system: { equipped: true } })], { system: { isTransformed: true } });
  const gear = actor.items.contents[0];
  await firePosted(actor, gear);
  expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ content: '<p>E20.RoughTerrainPiledriverPrompt</p>' }));
  confirm.mockClear();
  actor.system.isTransformed = false;
  await firePosted(actor, gear);
  expect(confirm).not.toHaveBeenCalled();
  // Another posted item doesn't fire it.
  actor.system.isTransformed = true;
  await firePosted(actor, add(actor, itemFrom({ name: 'Rope', type: 'gear', system: {} })));
  expect(confirm).not.toHaveBeenCalled();
  delete global.canvas;
});

/* ---- Advanced Link, Perfect Link, Armored Connection, Bonded Proficiency (was bonded-partners.mjs#bondBonuses / bondSpecializes) ---- */

describe('the bonded-partner rules', () => {
  function pair({ holderItems = [], partnerItems = [], linked = true } = {}) {
    const stats = () => ({ health: { max: 10, value: 10 }, defenses: { toughness: { total: 12, string: '' } }, skills: { science: { shift: 'd6', isSpecialized: false }, culture: { shift: 'd4' } } });
    const partner = makeActor(partnerItems, { system: stats() });
    const holder = makeActor(holderItems, { system: stats() });
    holder.flags.essence20.bond = { partner: partner.uuid, linked };
    global.game.actors = Object.assign([holder, partner], { contents: [holder, partner], get: id => [holder, partner].find(a => a.id == id) });
    global.fromUuidSync = uuid => [holder, partner].find(a => a.uuid == uuid) ?? null;
    [holder, partner].forEach(actor => rebuildIndex(actor));
    return { holder, partner };
  }

  afterEach(() => LINK_HOLDERS.clear());

  test('Advanced Link and Perfect Link: +1 Health each on the partner, linked or not; nothing on the holder', () => {
    const { holder, partner } = pair({ holderItems: [FILES.advancedLink, FILES.perfectLink], linked: false });
    ruleDerived(partner);
    ruleDerived(holder);
    expect(partner.system.health.max).toBe(12);
    expect(holder.system.health.max).toBe(10);
  });

  test("Armored Connection: +2 Toughness for both while linked - only the holder's copy counts", () => {
    const linked = pair({ holderItems: [FILES.armoredConnection] });
    ruleDerived(linked.partner);
    ruleDerived(linked.holder);
    expect(linked.partner.system.defenses.toughness.total).toBe(14);
    expect(linked.holder.system.defenses.toughness.total).toBe(14);
    const apart = pair({ holderItems: [FILES.armoredConnection], linked: false });
    ruleDerived(apart.partner);
    ruleDerived(apart.holder);
    expect(apart.partner.system.defenses.toughness.total).toBe(12);
    expect(apart.holder.system.defenses.toughness.total).toBe(12);
    const partnerHeld = pair({ partnerItems: [FILES.armoredConnection] });
    ruleDerived(partnerHeld.partner);
    ruleDerived(partnerHeld.holder);
    expect(partnerHeld.partner.system.defenses.toughness.total).toBe(12);
    expect(partnerHeld.holder.system.defenses.toughness.total).toBe(12);
  });

  test("Synaptic Linkage: a dialog switch for Edge when both have the rolled Skill at d2+, once a scene", () => {
    global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), skillShiftList: ['3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'] } };
    const { holder, partner } = pair({ holderItems: [FILES.synapticLinkage], linked: false });
    partner.system.skills.science.shift = 'd2';
    const offered = skill => ruleDialogSwitches(holder, { rolledSkill: skill }).filter(entry => entry.label?.startsWith('Synaptic'));
    expect(offered('science').map(entry => entry.entry.rule.edge)).toEqual([true]);
    partner.system.skills.science.shift = 'd20';
    expect(offered('science')).toEqual([]);
    expect(fromPack(FILES.synapticLinkage).system.rules[0].limit).toEqual({ per: 'scene' });
  });

  test("Bonded Proficiency (either side's copy): while linked, both count as Specialized in the other's Specialized Skills", () => {
    for (const side of ['holderItems', 'partnerItems']) {
      const { holder, partner } = pair({ [side]: [FILES.bondedProficiency] });
      partner.system.skills.science.isSpecialized = true;
      holder.system.skills.culture.specializations = { lore: { name: 'Lore' } };
      expect(ruleSpecializes(holder, 'science')).toBe(true);
      expect(ruleSpecializes(holder, 'culture')).toBe(false);
      expect(ruleSpecializes(partner, 'culture')).toBe(true);
      expect(ruleSpecializes(partner, 'science')).toBe(false);
      holder.flags.essence20.bond.linked = false;
      expect(ruleSpecializes(holder, 'science')).toBe(false);
      LINK_HOLDERS.clear();
    }
  });
});

/* ---- the Zord Features that configure on drop (was sheet-handlers/zord-feature-handler.mjs) ---- */

describe('drop-time configuring Features', () => {
  let answers;
  beforeEach(() => {
    answers = [];
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async () => answers.shift() ?? null) } } };
    global.foundry.utils.escapeHTML ??= text => String(text);
    global.game.i18n = { ...(global.game.i18n ?? {}), localize: key => key, format: (key, data) => `${key} ${JSON.stringify(data)}` };
  });

  /** A Zord holding the Feature (its pack effects as mocks) and the attacks given. */
  function zordWith(file, { attacks = [], movement = {} } = {}) {
    const actor = makeActor([], { type: 'zord', system: { movement } });
    const made = attacks.map(([name, style, extra = {}]) => {
      const weapon = add(actor, itemFrom({ name: `${name} Weapon`, type: 'weapon', system: { traits: [] } }));
      return add(actor, itemFrom({ name, type: 'weaponEffect', system: { classification: { style }, ...extra } }, { flags: { essence20: { parentId: weapon.id } } }));
    });
    const feature = add(actor, itemFrom(file));
    feature.effects = fromPack(file).effects.map((data, index) => ({ id: `e${index}`, name: data.name, changes: data.changes, disabled: data.disabled }));
    feature.updateEmbeddedDocuments = jest.fn(async (kind, updates) => updates.forEach(({ _id, disabled }) => {
      feature.effects.find(effect => effect.id == _id).disabled = disabled;
    }));
    feature.createEmbeddedDocuments = jest.fn(async (kind, datas) => feature.effects.push(...datas.map(data => ({ ...data, id: 'new' }))));
    feature.delete = jest.fn();
    return { actor, feature, attacks: made };
  }

  const enabledKeys = feature => feature.effects.filter(effect => !effect.disabled).map(effect => `${effect.changes[0].key}=${effect.changes[0].value}`);

  test('Blast Attack: the only ranged attack (no question) becomes a 10 ft burst; none - warned and taken off', async () => {
    const { actor, feature, attacks } = zordWith(FILES.blastAttack, { attacks: [['Claw', 'melee'], ['Laser', 'projectile']] });
    await fireItemAdded(actor, feature);
    expect(attacks[1].system).toEqual(expect.objectContaining({ radius: 10, shape: 'burst' }));
    expect(attacks[0].system.radius).toBeUndefined();
    expect(ui.notifications.info).toHaveBeenCalledWith(expect.stringContaining('E20.ZordFeatureBlastApplied'));
    expect(feature.delete).not.toHaveBeenCalled();
    const none = zordWith(FILES.blastAttack, { attacks: [['Claw', 'melee']] });
    await fireItemAdded(none.actor, none.feature);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.ZordFeatureNoRangedAttack');
    expect(none.feature.delete).toHaveBeenCalled();
  });

  test('Multi-Limb Attack: a melee attack gains Multi-Weapon (3) - never lowered', async () => {
    const { actor, feature, attacks } = zordWith(FILES.multiLimb, { attacks: [['Claw', 'melee', { numTargets: 5 }]] });
    await fireItemAdded(actor, feature);
    expect(attacks[0].system.numTargets).toBe(5);
    const fresh = zordWith(FILES.multiLimb, { attacks: [['Claw', 'melee']] });
    await fireItemAdded(fresh.actor, fresh.feature);
    expect(fresh.attacks[0].system.numTargets).toBe(3);
    const none = zordWith(FILES.multiLimb, { attacks: [['Laser', 'projectile']] });
    await fireItemAdded(none.actor, none.feature);
    expect(none.feature.delete).toHaveBeenCalled();
  });

  test.each([
    ['damage', [], effect => expect(effect.system.damageValue).toBe(3)],
    ['reach', [], effect => expect(effect.system.range.reachMultiplier).toBe(2)],
    ['range', [], effect => expect(effect.system.range).toEqual(expect.objectContaining({ value: 80, long: 180 }))],
    ['multiWeapon', [], effect => expect(effect.system.numTargets).toBe(2)],
    ['damageType', ['fire'], effect => expect(effect.system.damageType).toBe('fire')],
  ])('Enhance (Attack): %s', async (option, more, check) => {
    const { actor, feature, attacks } = zordWith(FILES.enhanceAttack, { attacks: [['Claw', 'melee', { damageValue: 2, range: { reachMultiplier: 1, value: 50, long: 120 } }]] });
    global.CONFIG.E20 = { ...(global.CONFIG.E20 ?? {}), damageTypes: { fire: 'E20.DamageFire', blunt: 'E20.DamageBlunt' } };
    answers = [attacks[0].id, option, ...more];
    await fireItemAdded(actor, feature);
    check(attacks[0]);
    expect(ui.notifications.info).toHaveBeenCalledWith(expect.stringContaining('E20.ZordFeatureEnhanceApplied'));
    expect(feature.delete).not.toHaveBeenCalled();
  });

  test('Enhance (Attack): Accurate goes on the weapon; the manual options only say so; a cancel takes it off', async () => {
    const { actor, feature, attacks } = zordWith(FILES.enhanceAttack, { attacks: [['Claw', 'melee']] });
    answers = [attacks[0].id, 'accurate'];
    await fireItemAdded(actor, feature);
    expect(actor.items.get(attacks[0].flags.essence20.parentId).system.traits).toEqual(['accurate']);
    const manual = zordWith(FILES.enhanceAttack, { attacks: [['Claw', 'melee']] });
    answers = [manual.attacks[0].id, 'ignoreArmor'];
    await fireItemAdded(manual.actor, manual.feature);
    expect(ui.notifications.info).toHaveBeenCalledWith('E20.ZordFeatureEnhanceManual');
    const cancelled = zordWith(FILES.enhanceAttack, { attacks: [['Claw', 'melee']] });
    answers = [null];
    await fireItemAdded(cancelled.actor, cancelled.feature);
    expect(cancelled.feature.delete).toHaveBeenCalled();
  });

  test("Increase (Essence): the chosen Essence's bundled effect is switched on", async () => {
    const { actor, feature } = zordWith(FILES.increaseEssence);
    answers = ['1'];
    await fireItemAdded(actor, feature);
    expect(enabledKeys(feature)).toEqual(['system.essences.speed.value=2']);
  });

  test("Light Chassis: one of the Zord's own movement types +10 ft (none - taken off); a Megazord's Initiative ↑1", async () => {
    const { actor, feature } = zordWith(FILES.lightChassis, { movement: { aerial: { base: 40 }, ground: { base: 30 } } });
    answers = ['1'];
    await fireItemAdded(actor, feature);
    expect(enabledKeys(feature)).toEqual(['system.essences.speed.value=1', 'system.movement.ground.bonus=10']);
    const still = zordWith(FILES.lightChassis, { movement: {} });
    await fireItemAdded(still.actor, still.feature);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.ZordFeatureNoMovement');
    expect(still.feature.delete).toHaveBeenCalled();
    expect(fromPack(FILES.lightChassis).system.rules[0]).toEqual(expect.objectContaining({
      type: 'RollModifier', scope: 'megaform', upshift: 1, stacks: false, when: ['roll:initiative', 'megaform:is:zord'],
    }));
  });

  test('Movement Booster: +30 ft to a type the Zord has, a new one at 45 ft', async () => {
    const { actor, feature } = zordWith(FILES.movementBooster, { movement: { ground: { base: 40 } } });
    answers = ['3'];
    await fireItemAdded(actor, feature);
    expect(enabledKeys(feature)).toEqual(['system.movement.ground.bonus=30']);
    const fresh = zordWith(FILES.movementBooster, { movement: { ground: { base: 40 } } });
    answers = ['1'];
    await fireItemAdded(fresh.actor, fresh.feature);
    expect(enabledKeys(fresh.feature)).toEqual(['system.movement.burrow.bonus=45']);
  });
});
