import { jest } from '@jest/globals';
import { canUsePower, onPowerUse } from './power-use.mjs';

const SPEED_BOOST_ID = "Compendium.essence20.pr_crb.Item.CDbaCheOK2rUsqli";
const ZEO_CRYSTAL_BOOST_ID = "Compendium.essence20.across_the_stars.Item.NiEaLWcx8N48fvvN";

// jest.setup.js's own global.Roll stub has no .evaluate() (only used by tests that don't roll
// dice) - this file keeps a real fake with one for the Powers that roll.
class FakeRoll {
  constructor() {
    this.total = 2;
  }

  async evaluate() {
    return this;
  }
}
global.Roll = FakeRoll;

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

  // (Chrono-File Access is a powerUsed Trigger on the Power - rules/conv17-perm.test.js.)

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
    const actor = { ...makeActor(), getFlag: jest.fn(() => ({ epoch: 1, window: 'encounter', count: 1 })), setFlag: jest.fn() };
    global.game.combat = { id: 'combat1' };
    const item = { name: 'Zeo Crystal Boost', flags: { core: { sourceId: ZEO_CRYSTAL_BOOST_ID } } };

    await onPowerUse(actor, item);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
    delete global.game.combat;
  });

  // Bug fix 2026-10-06: Codename Jolt used to toggle Augmented Combat's own flag, so switching one switched both.
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
});

describe('canUsePower', () => {
  afterEach(() => {
    global.game.combat = undefined;
  });

  test('false for a non-Power item', () => {
    expect(canUsePower({ type: 'perk', system: { canActivate: true } })).toBe(false);
  });

  test('false when canActivate is false', () => {
    expect(canUsePower({ type: 'power', system: { canActivate: false } })).toBe(false);
  });

  test('true for a Power with no dynamic gate, once canActivate is true', () => {
    const item = {
      type: 'power', system: { canActivate: true },
      flags: { core: { sourceId: SPEED_BOOST_ID } },
    };
    expect(canUsePower(item)).toBe(true);
  });

  test("delegates to canUseZeoCrystalBoost for Zeo Crystal Boost", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    const item = {
      type: 'power', system: { canActivate: true }, parent: actor,
      flags: { core: { sourceId: ZEO_CRYSTAL_BOOST_ID } },
    };
    global.game.combat = { id: 'combat1' };

    expect(canUsePower(item)).toBe(true);

    actor.getFlag = jest.fn(() => ({ epoch: 1, window: 'encounter', count: 1 }));
    expect(canUsePower(item)).toBe(false);
  });
});
