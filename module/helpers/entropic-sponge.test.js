import { jest } from '@jest/globals';
import { activateEntropicSponge } from './entropic-sponge.mjs';

function makeActor(id = 'actor1', personalPower = 5) {
  return {
    id,
    system: { powers: { personal: { value: personalPower } } },
    update: jest.fn(async function (data) {
      this.system.powers.personal.value = data['system.powers.personal.value'];
    }),
    getActiveTokens: jest.fn(() => [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }]),
  };
}

function makeCombatant(actor, initiative) {
  return {
    actor, initiative,
    update: jest.fn(async function (data) {
      this.initiative = data.initiative;
    }),
  };
}

function makeEnemyToken(actor) {
  return { actor, document: { disposition: -1 }, center: { x: 5, y: 0 } };
}

describe("activateEntropicSponge", () => {
  let waitMock;

  beforeEach(() => {
    global.canvas = { tokens: { placeables: [] }, grid: { measurePath: jest.fn(() => ({ distance: 5 })) } };
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
    global.game = { i18n: { localize: jest.fn((key) => key), format: jest.fn((key) => key) } };
  });

  test("spends Personal Power to boost its own Initiative and Snag each affected enemy's", async () => {
    const actor = makeActor('actor1', 5);
    const combatant = makeCombatant(actor, 10);
    const enemy1 = makeActor('enemy1');
    const enemy2 = makeActor('enemy2');
    const enemyCombatant1 = makeCombatant(enemy1, 8);
    const enemyCombatant2 = makeCombatant(enemy2, 6);
    global.canvas.tokens.placeables = [
      { document: { disposition: 1 }, center: { x: 0, y: 0 } }, makeEnemyToken(enemy1), makeEnemyToken(enemy2),
    ];
    global.game.combat = { round: 1, combatants: [combatant, enemyCombatant1, enemyCombatant2] };
    waitMock.mockResolvedValue('2');

    const result = await activateEntropicSponge(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 3 });
    expect(combatant.update).toHaveBeenCalledWith({ initiative: 14 });
    expect(enemyCombatant1.update).toHaveBeenCalledWith({ initiative: 6 });
    expect(enemyCombatant2.update).toHaveBeenCalledWith({ initiative: 4 });
  });

  test("caps the spend at the number of enemies present, and at available Personal Power", async () => {
    const actor = makeActor('actor1', 1);
    const combatant = makeCombatant(actor, 10);
    const enemy1 = makeActor('enemy1');
    const enemyCombatant1 = makeCombatant(enemy1, 8);
    global.canvas.tokens.placeables = [
      { document: { disposition: 1 }, center: { x: 0, y: 0 } }, makeEnemyToken(enemy1),
    ];
    global.game.combat = { round: 1, combatants: [combatant, enemyCombatant1] };
    waitMock.mockResolvedValue('1');

    await activateEntropicSponge(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
  });

  test("does nothing outside round 1 of combat", async () => {
    const actor = makeActor();
    global.game.combat = { round: 2, combatants: [makeCombatant(actor, 10)] };

    const result = await activateEntropicSponge(actor);

    expect(result).toBe(false);
    expect(waitMock).not.toHaveBeenCalled();
  });

  test("does nothing outside of combat entirely", async () => {
    const actor = makeActor();
    global.game.combat = null;

    const result = await activateEntropicSponge(actor);

    expect(result).toBe(false);
  });

  test("does nothing with no Personal Power or no enemies present", async () => {
    const actor = makeActor('actor1', 0);
    const combatant = makeCombatant(actor, 10);
    global.canvas.tokens.placeables = [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }];
    global.game.combat = { round: 1, combatants: [combatant] };

    const result = await activateEntropicSponge(actor);

    expect(result).toBe(false);
    expect(waitMock).not.toHaveBeenCalled();
  });

  test("returns false when the picker is cancelled", async () => {
    const actor = makeActor('actor1', 5);
    const combatant = makeCombatant(actor, 10);
    const enemy1 = makeActor('enemy1');
    const enemyCombatant1 = makeCombatant(enemy1, 8);
    global.canvas.tokens.placeables = [
      { document: { disposition: 1 }, center: { x: 0, y: 0 } }, makeEnemyToken(enemy1),
    ];
    global.game.combat = { round: 1, combatants: [combatant, enemyCombatant1] };
    waitMock.mockResolvedValue('cancel');

    const result = await activateEntropicSponge(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });
});
