import { jest } from '@jest/globals';
import { onPowerUse } from './power-use.mjs';

const SPEED_BOOST_ID = "Compendium.essence20.pr_crb.Item.CDbaCheOK2rUsqli";

// jest.setup.js's own global.Roll stub has no .evaluate() (only used by tests that don't roll
// dice) - Faster Regeneration/Repair Zord both do, so this file needs a real fake with one.
class FakeRoll {
  constructor() {
    this.total = 2;
  }

  async evaluate() {
    return this;
  }
}
global.Roll = FakeRoll;

function makeEffectsCollection(effects) {
  return {
    size: effects.length,
    every: fn => effects.every(fn),
    [Symbol.iterator]: () => effects[Symbol.iterator](),
  };
}

function makeEffect(disabled) {
  return { disabled, update: jest.fn(async function (data) { this.disabled = data.disabled; }) };
}

function makeActor(name = 'Test Actor') {
  return { name };
}

describe('onPowerUse', () => {
  beforeEach(() => {
    global.ChatMessage.create.mockClear();
  });

  test('does nothing when there is no actor or no item', async () => {
    await onPowerUse(null, { flags: {} });
    await onPowerUse(makeActor(), null);
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test('silently no-ops for a Power with no registered handler (matches onPerkUse\'s own fallthrough)', async () => {
    const actor = makeActor();
    const item = { flags: { core: { sourceId: 'Compendium.essence20.pr_crb.Item.NotRegistered' } } };

    await onPowerUse(actor, item);

    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test('recognizes Speed Boost via flags.core.sourceId, applies it, and posts a chat card', async () => {
    const actor = makeActor('Power Ranger Test');
    const ground = makeEffect(true);
    const initiative = makeEffect(true);
    const item = {
      name: 'Speed Boost',
      flags: { core: { sourceId: SPEED_BOOST_ID } },
      effects: makeEffectsCollection([ground, initiative]),
    };

    await onPowerUse(actor, item);

    expect(ground.disabled).toBe(false);
    expect(initiative.disabled).toBe(false);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Speed Boost via _stats.compendiumSource too (the flags.core.sourceId fallback)', async () => {
    const actor = makeActor();
    const ground = makeEffect(true);
    const item = {
      name: 'Speed Boost',
      flags: {},
      _stats: { compendiumSource: SPEED_BOOST_ID },
      effects: makeEffectsCollection([ground]),
    };

    await onPowerUse(actor, item);

    expect(ground.disabled).toBe(false);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('does not post a chat card a second time once Speed Boost is already active (idempotent)', async () => {
    const actor = makeActor();
    const item = {
      name: 'Speed Boost',
      flags: { core: { sourceId: SPEED_BOOST_ID } },
      effects: makeEffectsCollection([makeEffect(false)]),
    };

    await onPowerUse(actor, item);

    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test('recognizes Power Shield, enables its effect, and posts a chat card', async () => {
    const POWER_SHIELD_ID = "Compendium.essence20.pr_crb.Item.F7QPCcXW9822L5Xs";
    const actor = makeActor();
    const shield = makeEffect(true);
    const item = { name: 'Power Shield', flags: { core: { sourceId: POWER_SHIELD_ID } }, effects: makeEffectsCollection([shield]) };

    await onPowerUse(actor, item);

    expect(shield.disabled).toBe(false);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Faster Regeneration, heals, and posts a chat card', async () => {
    const FASTER_REGENERATION_ID = "Compendium.essence20.pr_crb.Item.UsZ8twgjWJO5B3R4";
    const actor = { ...makeActor(), system: { health: { value: 5, max: 10 } }, getFlag: jest.fn(), setFlag: jest.fn(), getRollData: jest.fn(() => ({})), update: jest.fn() };
    const item = { name: 'Faster Regeneration', flags: { core: { sourceId: FASTER_REGENERATION_ID } } };

    await onPowerUse(actor, item);

    expect(actor.update).toHaveBeenCalled();
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Boost Initiative and dispatches with the spent amount', async () => {
    const BOOST_INITIATIVE_ID = "Compendium.essence20.pr_crb.Item.IuQ0tsM2G99fQlSz";
    const actor = { ...makeActor(), id: 'actor1' };
    const combatant = { actor, initiative: 10, update: jest.fn(async function (data) { this.initiative = data.initiative; }) };
    global.game.combat = { combatants: [combatant] };
    const item = { name: 'Boost Initiative', flags: { core: { sourceId: BOOST_INITIATIVE_ID } } };

    await onPowerUse(actor, item, 2);

    expect(combatant.update).toHaveBeenCalledWith({ initiative: 14 });
    delete global.game.combat;
  });

  test('recognizes Augment Power Weapon, activates it, and posts a chat card', async () => {
    const AUGMENT_POWER_WEAPON_ID = "Compendium.essence20.pr_crb.Item.n7kXeiPmmdg55K1X";
    const actor = { ...makeActor(), getFlag: jest.fn(() => false), setFlag: jest.fn() };
    const item = { name: 'Augment Power Weapon', flags: { core: { sourceId: AUGMENT_POWER_WEAPON_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'augmentPowerWeaponActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Penetrating Strikes, activates it, and posts a chat card', async () => {
    const PENETRATING_STRIKES_ID = "Compendium.essence20.pr_crb.Item.fgufss1xeV96LDcu";
    const actor = { ...makeActor(), getFlag: jest.fn(() => false), setFlag: jest.fn() };
    const item = { name: 'Penetrating Strikes', flags: { core: { sourceId: PENETRATING_STRIKES_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'penetratingStrikesActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Repair Zord, heals the piloted Zord, and posts a chat card', async () => {
    const REPAIR_ZORD_ID = "Compendium.essence20.pr_crb.Item.9S0fkRqxjfiOJ8ip";
    const zord = { system: { health: { value: 5, max: 10 } }, update: jest.fn(async function (data) { this.system.health.value = data['system.health.value']; }) };
    const actor = { ...makeActor(), getRollData: jest.fn(() => ({})), _dice: { _getPilotedVehicle: jest.fn(() => zord) } };
    const item = { name: 'Repair Zord', flags: { core: { sourceId: REPAIR_ZORD_ID } } };

    await onPowerUse(actor, item, 4);

    expect(zord.update).toHaveBeenCalled();
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Repair Zord but posts nothing when not piloting a Zord', async () => {
    const REPAIR_ZORD_ID = "Compendium.essence20.pr_crb.Item.9S0fkRqxjfiOJ8ip";
    const actor = { ...makeActor(), getRollData: jest.fn(() => ({})), _dice: { _getPilotedVehicle: jest.fn(() => null) } };
    const item = { name: 'Repair Zord', flags: { core: { sourceId: REPAIR_ZORD_ID } } };

    await onPowerUse(actor, item, 4);

    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test('recognizes Chrono-File Access, reveals target info, and posts it as a chat card', async () => {
    const CHRONO_FILE_ACCESS_ID = "Compendium.essence20.jump_through_time.Item.PDOUlIOgO7YoPVvm";
    const targetActor = { name: 'Target', system: { defenses: { toughness: { total: 10 }, evasion: { total: 8 }, willpower: { total: 6 }, cleverness: { total: 4 } } }, items: [] };
    global.game.user = { targets: { first: jest.fn(() => ({ actor: targetActor })) } };
    const actor = makeActor();
    const item = { name: 'Chrono-File Access', flags: { core: { sourceId: CHRONO_FILE_ACCESS_ID } } };

    await onPowerUse(actor, item);

    expect(global.ChatMessage.create).toHaveBeenCalled();
    delete global.game.user;
  });

  test('recognizes Willful Strength and grants bonus Health', async () => {
    const WILLFUL_STRENGTH_ID = "Compendium.essence20.jump_through_time.Item.8a7YRcCUxcx6KgQl";
    const actor = {
      ...makeActor(),
      system: { skills: { survival: { shift: 'd6' } }, health: { bonus: 0 } },
      getFlag: jest.fn(() => undefined),
      setFlag: jest.fn(),
      update: jest.fn(),
    };
    const item = { name: 'Willful Strength', flags: { core: { sourceId: WILLFUL_STRENGTH_ID } } };

    await onPowerUse(actor, item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 2 }); // d6's own rank index
  });

  test('recognizes Blazing Strikes, activates it, and posts a chat card', async () => {
    const BLAZING_STRIKES_ID = "Compendium.essence20.across_the_stars.Item.hr0SY24JAM7I91qA";
    const actor = { ...makeActor(), getFlag: jest.fn(() => false), setFlag: jest.fn() };
    const item = { name: 'Blazing Strikes', flags: { core: { sourceId: BLAZING_STRIKES_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'blazingStrikesActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Void Warrior, activates it, and posts a chat card', async () => {
    const VOID_WARRIOR_ID = "Compendium.essence20.across_the_stars.Item.gyDCPmqswCQJYN6e";
    const actor = { ...makeActor(), getFlag: jest.fn(() => false), setFlag: jest.fn() };
    const item = { name: 'Void Warrior', flags: { core: { sourceId: VOID_WARRIOR_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'voidWarriorActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Rev Your Engines! and banks a shiftUp scaled by the spent amount', async () => {
    const REV_YOUR_ENGINES_ID = "Compendium.essence20.jump_through_time.Item.Eu8CsCA470XBEer0";
    const actor = { ...makeActor(), setFlag: jest.fn(), getFlag: jest.fn() };
    const item = { name: 'Rev Your Engines!', flags: { core: { sourceId: REV_YOUR_ENGINES_ID } } };

    await onPowerUse(actor, item, 2);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingRevYourEnginesShiftUp', expect.objectContaining({ shiftUp: 2 }));
  });

  test('recognizes Morphblast and triggers a real roll', async () => {
    const MORPHBLAST_ID = "Compendium.essence20.jump_through_time.Item.jPTF96WV19T37AqG";
    global.canvas = { tokens: { placeables: [], setTargets: jest.fn() }, grid: { measurePath: jest.fn(() => ({ distance: 0 })) } };
    const actor = { ...makeActor(), getActiveTokens: jest.fn(() => []), _dice: { rollSkill: jest.fn() } };
    const item = { name: 'Morphblast', flags: { core: { sourceId: MORPHBLAST_ID } } };

    await onPowerUse(actor, item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ isMorphblast: true }), actor);
  });

  test('recognizes Megazord Link and banks a fixed +2 Driving shiftUp', async () => {
    const MEGAZORD_LINK_ID = "Compendium.essence20.jump_through_time.Item.c7e7enVe96wOikd9";
    const actor = { ...makeActor(), setFlag: jest.fn(), getFlag: jest.fn() };
    const item = { name: 'Megazord Link', flags: { core: { sourceId: MEGAZORD_LINK_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingMegazordLinkShiftUp', expect.objectContaining({ shiftUp: 2 }));
  });

  test('recognizes Future Vision and writes the spent amount as the item\'s own reroll.maxUses', async () => {
    const FUTURE_VISION_ID = "Compendium.essence20.jump_through_time.Item.z9ZMxCd5DZDHlDYL";
    const actor = makeActor();
    const item = { name: 'Future Vision', flags: { core: { sourceId: FUTURE_VISION_ID } }, update: jest.fn() };

    await onPowerUse(actor, item, 3);

    expect(item.update).toHaveBeenCalledWith({ 'system.reroll.enabled': true, 'system.reroll.maxUses': 3 });
  });

  test.each([
    ['Mnemonic Recall', "Compendium.essence20.pr_crb.Item.jOYqRnHMYz6nETD0"],
    ['Power Transfer', "Compendium.essence20.pr_crb.Item.QYluNF8M04MmP40d"],
    ['Longevity', "Compendium.essence20.beneath_the_helmet.Item.2PWhz49B168yOdU6"],
  ])('recognizes %s and posts a narrative chat card, with nothing further to compute', async (name, sourceId) => {
    const actor = makeActor();
    const item = { name, flags: { core: { sourceId } } };

    await onPowerUse(actor, item);

    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Power Heal, heals whichever ally was targeted, and posts a chat card', async () => {
    const POWER_HEAL_ID = "Compendium.essence20.pr_crb.Item.eiTUR08GXw03M21m";
    const actor = { ...makeActor(), id: 'actor1', getActiveTokens: jest.fn(() => []) };
    const ally = { id: 'actor2', name: 'Ally', system: { health: { value: 5, max: 10 } }, update: jest.fn(async function (data) { this.system.health.value = data['system.health.value']; }) };
    global.game.user = { targets: new Set([{ actor: ally }]) };
    const item = { name: 'Power Heal', flags: { core: { sourceId: POWER_HEAL_ID } } };

    await onPowerUse(actor, item, 3);

    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 8 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
    delete global.game.user;
  });

  test('recognizes (Grid) Power Strike and banks a pending damage bonus, with no chat card of its own', async () => {
    const GRID_POWER_STRIKE_ID = "Compendium.essence20.pr_crb.Item.DT0TOaHfuJzkgUeO";
    const actor = { ...makeActor(), setFlag: jest.fn(), getFlag: jest.fn() };
    const item = { name: 'Power Strike', flags: { core: { sourceId: GRID_POWER_STRIKE_ID } } };

    await onPowerUse(actor, item, 3);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingGridPowerStrikeDamage', expect.objectContaining({ damageBonus: 3 }));
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test('recognizes Power Blast and triggers a real roll, with no chat card of its own', async () => {
    const POWER_BLAST_ID = "Compendium.essence20.pr_crb.Item.EeNQjO1VHh1SiNzy";
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const item = { name: 'Power Blast', flags: { core: { sourceId: POWER_BLAST_ID } } };

    await onPowerUse(actor, item, 4);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ powerBlastAmount: 4 }), actor);
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test('recognizes Zeo Crystal Boost, prompts for an option, activates it, and posts a chat card', async () => {
    const ZEO_CRYSTAL_BOOST_ID = "Compendium.essence20.across_the_stars.Item.NiEaLWcx8N48fvvN";
    const actor = { ...makeActor(), getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
    global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('morpher') };
    const item = { name: 'Zeo Crystal Boost', flags: { core: { sourceId: ZEO_CRYSTAL_BOOST_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'zeoCrystalBoostOption', 'morpher');
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Zeo Crystal Boost but does nothing once already used this scene', async () => {
    const ZEO_CRYSTAL_BOOST_ID = "Compendium.essence20.across_the_stars.Item.NiEaLWcx8N48fvvN";
    const actor = { ...makeActor(), getFlag: jest.fn(() => ({ combatId: 'combat1' })), setFlag: jest.fn() };
    global.game.combat = { id: 'combat1' };
    const item = { name: 'Zeo Crystal Boost', flags: { core: { sourceId: ZEO_CRYSTAL_BOOST_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
    delete global.game.combat;
  });

  test('recognizes Mobile Mode, prompts for a movement type, activates it, and posts a chat card', async () => {
    const MOBILE_MODE_ID = "Compendium.essence20.through_the_shattered_grid.Item.TO3TazEeI35FUOOU";
    const actor = { ...makeActor(), setFlag: jest.fn() };
    global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('aerial') };
    const item = { name: 'Mobile Mode', flags: { core: { sourceId: MOBILE_MODE_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'mobileModeType', 'aerial');
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Mobile Mode but does nothing when the picker is cancelled', async () => {
    const MOBILE_MODE_ID = "Compendium.essence20.through_the_shattered_grid.Item.TO3TazEeI35FUOOU";
    const actor = { ...makeActor(), setFlag: jest.fn() };
    global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('cancel') };
    const item = { name: 'Mobile Mode', flags: { core: { sourceId: MOBILE_MODE_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test('recognizes Metallic Armor Power Up, activates it, and posts a chat card', async () => {
    const METALLIC_ARMOR_ID = "Compendium.essence20.through_the_shattered_grid.Item.LotTM0zOcCBLkki4";
    const actor = {
      ...makeActor(),
      system: { health: { bonus: 0 } },
      getFlag: jest.fn(() => undefined),
      setFlag: jest.fn(),
      update: jest.fn(),
    };
    const item = { name: 'Metallic Armor Power Up', flags: { core: { sourceId: METALLIC_ARMOR_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'metallicArmorActive', true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 3 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Metallic Armor Power Up but does nothing if already active', async () => {
    const METALLIC_ARMOR_ID = "Compendium.essence20.through_the_shattered_grid.Item.LotTM0zOcCBLkki4";
    const actor = {
      ...makeActor(),
      system: { health: { bonus: 3 } },
      getFlag: jest.fn(() => true),
      setFlag: jest.fn(),
      update: jest.fn(),
    };
    const item = { name: 'Metallic Armor Power Up', flags: { core: { sourceId: METALLIC_ARMOR_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test('recognizes Grid Empowered, deals 1 Electric damage to the target, and posts a chat card', async () => {
    const GRID_EMPOWERED_ID = "Compendium.essence20.through_the_shattered_grid.Item.17iN2ZzSaTvqX0PL";
    const actor = makeActor();
    const targetActor = { system: { health: { value: 5 }, stun: { value: 0 } }, update: jest.fn(), toggleStatusEffect: jest.fn() };
    global.game.user = { targets: { first: () => ({ actor: targetActor }) } };
    const item = { name: 'Grid Empowered', flags: { core: { sourceId: GRID_EMPOWERED_ID } } };

    await onPowerUse(actor, item);

    expect(targetActor.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
    delete global.game.user;
  });

  test('recognizes Grid Empowered but does nothing without a target', async () => {
    const GRID_EMPOWERED_ID = "Compendium.essence20.through_the_shattered_grid.Item.17iN2ZzSaTvqX0PL";
    const actor = makeActor();
    global.game.user = { targets: { first: () => undefined } };
    const item = { name: 'Grid Empowered', flags: { core: { sourceId: GRID_EMPOWERED_ID } } };

    await onPowerUse(actor, item);

    expect(global.ChatMessage.create).not.toHaveBeenCalled();
    delete global.game.user;
  });

  test('recognizes Shattered Memories, prompts, banks the Smarts shiftUp option, and posts a chat card', async () => {
    const SHATTERED_MEMORIES_ID = "Compendium.essence20.through_the_shattered_grid.Item.faME3nQl9NjbafOG";
    const actor = { ...makeActor(), getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
    global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('recallTimeline') };
    const item = { name: 'Shattered Memories', flags: { core: { sourceId: SHATTERED_MEMORIES_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingShatteredMemoriesSmarts', expect.objectContaining({}));
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Shattered Memories but does nothing when the picker is cancelled', async () => {
    const SHATTERED_MEMORIES_ID = "Compendium.essence20.through_the_shattered_grid.Item.faME3nQl9NjbafOG";
    const actor = { ...makeActor(), getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
    global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('cancel') };
    const item = { name: 'Shattered Memories', flags: { core: { sourceId: SHATTERED_MEMORIES_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test('recognizes Protection, toggles the boost, and posts a chat card', async () => {
    const PROTECTION_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.IF9v9C3tCJSQYRjd";
    const actor = { ...makeActor(), getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
    const item = { name: 'Protection', flags: { core: { sourceId: PROTECTION_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'protectionBoostActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Augmented Combat, toggles it, and posts a chat card', async () => {
    const AUGMENTED_COMBAT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.6Ku40JiKZCMbGMtM";
    const actor = { ...makeActor(), getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
    const item = { name: 'Augmented Combat', flags: { core: { sourceId: AUGMENTED_COMBAT_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'augmentedCombatActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Codename Jolt: Augmented Combat Nanomite Infusion, toggles the same flag, and posts a chat card', async () => {
    const CODENAME_JOLT_ID = "Compendium.essence20.operation_snakebit.Item.Q7p4Mn6NN4BL7ARl";
    const actor = { ...makeActor(), getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
    const item = {
      name: 'Codename Jolt: Augmented Combat Nanomite Infusion',
      flags: { core: { sourceId: CODENAME_JOLT_ID } },
    };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'augmentedCombatActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Swiftness, prompts for a movement type, activates it, and posts a chat card', async () => {
    const SWIFTNESS_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.GBsBp9umblOcz7lu";
    const actor = { ...makeActor(), getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
    global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('ground') };
    const item = { name: 'Swiftness', flags: { core: { sourceId: SWIFTNESS_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'swiftnessMovementType', 'ground');
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Swiftness but does nothing when the picker is cancelled', async () => {
    const SWIFTNESS_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.GBsBp9umblOcz7lu";
    const actor = { ...makeActor(), getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
    global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('cancel') };
    const item = { name: 'Swiftness', flags: { core: { sourceId: SWIFTNESS_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test('recognizes Repair Machine, banks the Edge, and posts a chat card', async () => {
    const REPAIR_MACHINE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.HOM0e2W0aBYnZ8Z3";
    const actor = { ...makeActor(), setFlag: jest.fn() };
    const item = { name: 'Repair Machine', flags: { core: { sourceId: REPAIR_MACHINE_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingRepairMachineEdge', expect.objectContaining({}));
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Electric Discharge and triggers a real roll', async () => {
    const ELECTRIC_DISCHARGE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.KeDQbX62owtITKDo";
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const item = { name: 'Electric Discharge', flags: { core: { sourceId: ELECTRIC_DISCHARGE_ID } } };

    await onPowerUse(actor, item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ isElectricDischarge: true }), actor);
  });

  test('recognizes Disintegrate and triggers a real roll against a vehicle target', async () => {
    const DISINTEGRATE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.mVwWAgFyNUDfoUJQ";
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    global.game.user = { targets: { first: () => ({ actor: { type: 'vehicle' } }) } };
    const item = { name: 'Disintegrate', flags: { core: { sourceId: DISINTEGRATE_ID } } };

    await onPowerUse(actor, item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ isDisintegrate: true }), actor);
    delete global.game.user;
  });

  test('recognizes Regeneration, heals 1 Health, and posts a chat card', async () => {
    const REGENERATION_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.312ubjCA7mCBDoea";
    const actor = { ...makeActor(), system: { health: { value: 5, max: 10 } }, update: jest.fn() };
    const item = { name: 'Regeneration', flags: { core: { sourceId: REGENERATION_ID } } };

    await onPowerUse(actor, item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('recognizes Bolster Defense and triggers a real roll after the picker', async () => {
    const BOLSTER_DEFENSE_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.HVOFIDBiXNckFaAP";
    const actor = { ...makeActor(), uuid: 'Actor.caster1', _dice: { rollSkill: jest.fn() } };
    global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue({ mode: 'all', defenseType: 'toughness' }) };
    global.game.user = { targets: { first: () => undefined } };
    const item = { name: 'Bolster Defense', flags: { core: { sourceId: BOLSTER_DEFENSE_ID } } };

    await onPowerUse(actor, item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ isBolsterDefenseAttempt: true }), actor);
    delete global.game.user;
  });

  test('recognizes Monster... Grow!, toggles it on the current target, and posts a chat card', async () => {
    const MONSTER_GROW_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.KR4KuZlalNywMvSb";
    const actor = makeActor();
    const targetActor = { system: { size: 'common' }, getFlag: jest.fn(() => undefined), setFlag: jest.fn(), update: jest.fn() };
    global.game.user = { targets: { first: () => ({ actor: targetActor }) } };
    const item = { name: 'Monster... Grow!', flags: { core: { sourceId: MONSTER_GROW_ID } } };

    await onPowerUse(actor, item);

    expect(targetActor.update).toHaveBeenCalledWith({ 'system.size': 'gigantic' });
    expect(global.ChatMessage.create).toHaveBeenCalled();
    delete global.game.user;
  });

  test('recognizes Lucky Charm and triggers a real roll', async () => {
    const LUCKY_CHARM_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.Rv3Bhyeo4XBxHLpX";
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const item = { name: 'Lucky Charm', uuid: 'Item.lucky1', flags: { core: { sourceId: LUCKY_CHARM_ID } } };

    await onPowerUse(actor, item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ isLuckyCharmAttempt: true }), actor);
  });

  test('recognizes Illusory Disguise and triggers a real roll', async () => {
    const ILLUSORY_DISGUISE_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.7r9RSyoSvZxNx7El";
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const item = { name: 'Illusory Disguise', flags: { core: { sourceId: ILLUSORY_DISGUISE_ID } } };

    await onPowerUse(actor, item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ isIllusoryDisguiseAttempt: true }), actor);
  });
});
