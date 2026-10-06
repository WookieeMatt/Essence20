import { jest } from '@jest/globals';
import { checkAndActivateDefenderStep } from './defender-step.mjs';

const DEFENDER_STEP_ID = "Compendium.essence20.through_the_shattered_grid.Item.X59RRGMww6UZQJ78";
const SWIFT_DEFENDER_ID = "Compendium.essence20.through_the_shattered_grid.Item.MPAZdtX3Ob76h90Y";
const CONTINUOUS_STANCE_ID = "Compendium.essence20.through_the_shattered_grid.Item.yNtX8ky7O8v50C5l";

global.foundry.applications.api.DialogV2 = { wait: jest.fn() };
global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 5 })) },
};

function makeTargetActor(name = 'Target') {
  const token = { document: { disposition: 1 }, center: {} };
  return { name, getActiveTokens: jest.fn(() => [token]), __token: token };
}

function makeReactor({ name = 'Reactor', perkIds = [DEFENDER_STEP_ID], power = 1, healthBonus = 0 } = {}) {
  const actor = {
    name,
    items: perkIds.map(id => ({ type: 'perk', flags: { core: { sourceId: id } } })),
    system: { powers: { personal: { value: power } }, health: { bonus: healthBonus } },
  };
  actor.update = jest.fn(async (data) => {
    if (data['system.powers.personal.value'] !== undefined) actor.system.powers.personal.value = data['system.powers.personal.value'];
    if (data['system.health.bonus'] !== undefined) actor.system.health.bonus = data['system.health.bonus'];
  });

  return actor;
}

describe("checkAndActivateDefenderStep", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
    global.foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("returns 0 and prompts nobody when no nearby ally holds the Perk", async () => {
    const target = makeTargetActor();
    canvas.tokens.placeables = [target.__token];

    const { bonus } = await checkAndActivateDefenderStep(target, { name: 'Attacker' });

    expect(bonus).toBe(0);
    expect(global.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("returns 0 when the holder has no Personal Power to spend", async () => {
    const target = makeTargetActor();
    const reactor = makeReactor({ power: 0 });
    canvas.tokens.placeables = [target.__token, { actor: reactor, document: { disposition: 1 }, center: {} }];

    const { bonus } = await checkAndActivateDefenderStep(target, { name: 'Attacker' });

    expect(bonus).toBe(0);
    expect(global.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("spends 1 Personal Power and returns the Combat Stance number (1) on confirmation", async () => {
    const target = makeTargetActor();
    const reactor = makeReactor();
    canvas.tokens.placeables = [target.__token, { actor: reactor, document: { disposition: 1 }, center: {} }];
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('yes');

    const { bonus } = await checkAndActivateDefenderStep(target, { name: 'Attacker' });

    expect(bonus).toBe(1);
    expect(reactor.system.powers.personal.value).toBe(0);
  });

  test("returns 2 (the Combat Stance number) once Continuous Stance is held", async () => {
    const target = makeTargetActor();
    const reactor = makeReactor({ perkIds: [DEFENDER_STEP_ID, CONTINUOUS_STANCE_ID] });
    canvas.tokens.placeables = [target.__token, { actor: reactor, document: { disposition: 1 }, center: {} }];
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('yes');

    const { bonus } = await checkAndActivateDefenderStep(target, { name: 'Attacker' });

    expect(bonus).toBe(2);
  });

  test("also grants Swift Defender's +1 temporary Health on confirmation", async () => {
    const target = makeTargetActor();
    const reactor = makeReactor({ perkIds: [DEFENDER_STEP_ID, SWIFT_DEFENDER_ID] });
    canvas.tokens.placeables = [target.__token, { actor: reactor, document: { disposition: 1 }, center: {} }];
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('yes');

    await checkAndActivateDefenderStep(target, { name: 'Attacker' });

    expect(reactor.system.health.bonus).toBe(1);
  });

  test("doesn't grant Swift Defender's temporary Health without that Perk", async () => {
    const target = makeTargetActor();
    const reactor = makeReactor(); // Defender Step only
    canvas.tokens.placeables = [target.__token, { actor: reactor, document: { disposition: 1 }, center: {} }];
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('yes');

    await checkAndActivateDefenderStep(target, { name: 'Attacker' });

    expect(reactor.system.health.bonus).toBe(0);
  });

  test("returns 0 and doesn't spend anything when the reactor declines", async () => {
    const target = makeTargetActor();
    const reactor = makeReactor();
    canvas.tokens.placeables = [target.__token, { actor: reactor, document: { disposition: 1 }, center: {} }];
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('no');

    const { bonus } = await checkAndActivateDefenderStep(target, { name: 'Attacker' });

    expect(bonus).toBe(0);
    expect(reactor.update).not.toHaveBeenCalled();
    expect(reactor.system.powers.personal.value).toBe(1);
  });

  test("moves on to the next eligible ally if an earlier one declines", async () => {
    const target = makeTargetActor();
    const reactor1 = makeReactor({ name: 'Reactor1' });
    const reactor2 = makeReactor({ name: 'Reactor2' });
    canvas.tokens.placeables = [
      target.__token,
      { actor: reactor1, document: { disposition: 1 }, center: {} },
      { actor: reactor2, document: { disposition: 1 }, center: {} },
    ];
    global.foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('no')
      .mockResolvedValueOnce('yes');

    const { bonus } = await checkAndActivateDefenderStep(target, { name: 'Attacker' });

    expect(bonus).toBe(1);
    expect(reactor1.update).not.toHaveBeenCalled();
    expect(reactor2.system.powers.personal.value).toBe(0);
  });

  test("an enemy holding the Perk is never prompted", async () => {
    const target = makeTargetActor();
    const reactor = makeReactor();
    canvas.tokens.placeables = [target.__token, { actor: reactor, document: { disposition: -1 }, center: {} }];

    const { bonus } = await checkAndActivateDefenderStep(target, { name: 'Attacker' });

    expect(bonus).toBe(0);
    expect(global.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });
});
