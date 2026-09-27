import { jest } from '@jest/globals';
import { onZordFeatureDrop } from './zord-feature-handler.mjs';

const MULTI_LIMB_ATTACK_ID = "Compendium.essence20.through_the_shattered_grid.Item.cRtPjBG1OoXwKJ0b";
const RESTRAINING_CHAINS_ID = "Compendium.essence20.through_the_shattered_grid.Item.AVXOwNhDWQJewKAl";
const INCREASE_ESSENCE_ID = "Compendium.essence20.pr_crb.Item.oKGzWCOUCuefWuqD";
const LIGHT_CHASSIS_ID = "Compendium.essence20.pr_crb.Item.rVW7mvnV4MbGuxoq";
const MOVEMENT_BOOSTER_ID = "Compendium.essence20.pr_crb.Item.9YQmZGdNCmtXLAd4";

function mockPickerDialog(choice) {
  global.foundry = {
    applications: {
      api: {
        DialogV2: {
          wait: jest.fn(async ({ buttons }) => buttons[0].callback(null, {
            form: { elements: { choice: { value: choice } } },
          })),
        },
      },
    },
    utils: { escapeHTML: (s) => s },
  };
}

function mockCancelledDialog() {
  global.foundry = {
    applications: { api: { DialogV2: { wait: jest.fn(async () => 'cancel') } } },
    utils: { escapeHTML: (s) => s },
  };
}

function makeMovementEffect(type, bonus = 30) {
  return {
    changes: [{ key: `system.movement.${type}.bonus`, mode: 2, value: String(bonus) }],
    disabled: true,
    update: jest.fn(),
  };
}

function makeSourceItem(sourceId) {
  return { flags: { core: { sourceId } }, uuid: sourceId };
}

describe("Multi-Limb Attack (Through the Shattered Grid, Zord Feature, p.118)", () => {
  function makeActor(meleeEffects) {
    const weapon = { id: 'weapon1' };
    const items = [
      weapon,
      ...meleeEffects,
    ];
    items.get = (id) => items.find(i => i.id === id);
    return { items, createEmbeddedDocuments: jest.fn() };
  }

  test("grants Multi-Weapon (3) to the Zord's only melee attack, no dialog needed", async () => {
    const effect = {
      type: 'weaponEffect', name: 'Claw',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { style: 'melee' }, numTargets: 1 },
      update: jest.fn(),
    };
    const actor = makeActor([effect]);
    const dropFunc = jest.fn(async () => [effect]);

    await onZordFeatureDrop(actor, makeSourceItem(MULTI_LIMB_ATTACK_ID), dropFunc);

    expect(effect.update).toHaveBeenCalledWith({ 'system.numTargets': 3 });
    expect(dropFunc).toHaveBeenCalled();
  });

  test("doesn't lower an existing higher numTargets", async () => {
    const effect = {
      type: 'weaponEffect', name: 'Claw',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { style: 'melee' }, numTargets: 5 },
      update: jest.fn(),
    };
    const actor = makeActor([effect]);

    await onZordFeatureDrop(actor, makeSourceItem(MULTI_LIMB_ATTACK_ID), jest.fn(async () => []));

    expect(effect.update).toHaveBeenCalledWith({ 'system.numTargets': 5 });
  });

  test("warns and cancels the drop when the Zord has no melee attacks", async () => {
    const actor = makeActor([]);
    const dropFunc = jest.fn();

    const result = await onZordFeatureDrop(actor, makeSourceItem(MULTI_LIMB_ATTACK_ID), dropFunc);

    expect(result).toBeNull();
    expect(dropFunc).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Restraining Chains (Through the Shattered Grid, Zord Feature, p.35)", () => {
  test("creates a fixed Grapple ranged attack (30ft/65ft, no dialog)", async () => {
    const weapon = { id: 'newWeapon' };
    const actor = {
      items: Object.assign([], { get: () => null }),
      createEmbeddedDocuments: jest.fn()
        .mockResolvedValueOnce([weapon])
        .mockResolvedValueOnce([{ id: 'effect1' }]),
    };
    const dropFunc = jest.fn(async () => []);

    await onZordFeatureDrop(actor, makeSourceItem(RESTRAINING_CHAINS_ID), dropFunc);

    expect(actor.createEmbeddedDocuments).toHaveBeenNthCalledWith(1, 'Item', [
      expect.objectContaining({ type: 'weapon' }),
    ]);
    expect(actor.createEmbeddedDocuments).toHaveBeenNthCalledWith(2, 'Item', [
      expect.objectContaining({
        type: 'weaponEffect',
        flags: { essence20: { parentId: 'newWeapon' } },
        system: expect.objectContaining({
          damageType: 'grapple',
          range: expect.objectContaining({ value: 30, long: 65 }),
        }),
      }),
    ]);
    expect(dropFunc).toHaveBeenCalled();
  });
});

describe("Increase (Essence) (PR CRB, Zord Feature, p.137)", () => {
  function mockDialog(choice) {
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn(async ({ buttons }) => buttons[0].callback(null, {
              form: { elements: { choice: { value: choice } } },
            })),
          },
        },
      },
      utils: { escapeHTML: (s) => s },
    };
  }

  function makeEffect(essence) {
    return {
      changes: [{ key: `system.essences.${essence}.value`, mode: 2, value: '2' }],
      disabled: true,
      update: jest.fn(),
    };
  }

  test("enables only the chosen Essence's bundled Active Effect", async () => {
    mockDialog('speed');
    const strength = makeEffect('strength');
    const speed = makeEffect('speed');
    const newItem = { effects: { find: (fn) => [strength, speed].find(fn) } };
    const dropFunc = jest.fn(async () => [newItem]);

    const result = await onZordFeatureDrop({ items: [] }, makeSourceItem(INCREASE_ESSENCE_ID), dropFunc);

    expect(speed.update).toHaveBeenCalledWith({ disabled: false });
    expect(strength.update).not.toHaveBeenCalled();
    expect(dropFunc).toHaveBeenCalled();
    expect(result).toEqual([newItem]);
  });

  test("cancels the drop (dropFunc never called) when the dialog is dismissed", async () => {
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn(async () => 'cancel') } } },
      utils: { escapeHTML: (s) => s },
    };
    const dropFunc = jest.fn();

    const result = await onZordFeatureDrop({ items: [] }, makeSourceItem(INCREASE_ESSENCE_ID), dropFunc);

    expect(result).toBeNull();
    expect(dropFunc).not.toHaveBeenCalled();
  });
});

describe("Light Chassis (PR CRB, Zord Feature, p.137)", () => {
  function makeActor(movement) {
    return { items: [], system: { movement } };
  }

  test("enables the pre-baked +10ft AE for the chosen (already-possessed) movement type", async () => {
    mockPickerDialog('aerial');
    const aerial = makeMovementEffect('aerial', 10);
    const ground = makeMovementEffect('ground', 10);
    const newItem = { name: 'Light Chassis', effects: { find: (fn) => [aerial, ground].find(fn) } };
    const dropFunc = jest.fn(async () => [newItem]);
    const actor = makeActor({ aerial: { base: 40 }, ground: { base: 30 } });

    await onZordFeatureDrop(actor, makeSourceItem(LIGHT_CHASSIS_ID), dropFunc);

    expect(aerial.update).toHaveBeenCalledWith({
      disabled: false,
      changes: [{ key: 'system.movement.aerial.bonus', mode: 2, value: '10' }],
    });
    expect(ground.update).not.toHaveBeenCalled();
    expect(dropFunc).toHaveBeenCalled();
  });

  test("warns and cancels the drop when the Zord has no movement at all", async () => {
    const dropFunc = jest.fn();
    const actor = makeActor({ aerial: { base: 0 }, ground: { base: 0 } });

    const result = await onZordFeatureDrop(actor, makeSourceItem(LIGHT_CHASSIS_ID), dropFunc);

    expect(result).toBeNull();
    expect(dropFunc).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("cancels the drop when the dialog is dismissed", async () => {
    mockCancelledDialog();
    const dropFunc = jest.fn();
    const actor = makeActor({ ground: { base: 30 } });

    const result = await onZordFeatureDrop(actor, makeSourceItem(LIGHT_CHASSIS_ID), dropFunc);

    expect(result).toBeNull();
    expect(dropFunc).not.toHaveBeenCalled();
  });
});

describe("Movement Booster (PR CRB, Zord Feature, p.137)", () => {
  function makeActor(movement) {
    return { items: [], system: { movement } };
  }

  test("enables the pre-baked +30ft AE for a movement type the Zord already has", async () => {
    mockPickerDialog('ground');
    const ground = makeMovementEffect('ground', 30);
    const newItem = { name: 'Movement Booster', effects: { find: (fn) => [ground].find(fn) } };
    const dropFunc = jest.fn(async () => [newItem]);
    const actor = makeActor({ ground: { base: 40 } });

    await onZordFeatureDrop(actor, makeSourceItem(MOVEMENT_BOOSTER_ID), dropFunc);

    expect(ground.update).toHaveBeenCalledWith({
      disabled: false,
      changes: [{ key: 'system.movement.ground.bonus', mode: 2, value: '30' }],
    });
  });

  test("creates a new +45ft AE for a movement type the Zord doesn't already have", async () => {
    mockPickerDialog('burrow');
    const newItem = {
      name: 'Movement Booster',
      effects: { find: () => undefined },
      createEmbeddedDocuments: jest.fn(),
    };
    const dropFunc = jest.fn(async () => [newItem]);
    const actor = makeActor({ burrow: { base: 0 } });

    await onZordFeatureDrop(actor, makeSourceItem(MOVEMENT_BOOSTER_ID), dropFunc);

    expect(newItem.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
      expect.objectContaining({
        disabled: false,
        changes: [{ key: 'system.movement.burrow.bonus', mode: 2, value: '45' }],
      }),
    ]);
  });
});

describe("onZordFeatureDrop default case", () => {
  test("falls through to dropFunc for any other Feature", async () => {
    const dropFunc = jest.fn(async () => ['ok']);
    const result = await onZordFeatureDrop({ items: [] }, makeSourceItem('some-other-id'), dropFunc);

    expect(result).toEqual(['ok']);
    expect(dropFunc).toHaveBeenCalled();
  });
});
