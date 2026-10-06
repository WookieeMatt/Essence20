import { jest } from '@jest/globals';
import { activateStayInFormation } from './stay-in-formation.mjs';

global.game = {
  i18n: { localize: (key) => key, format: (key) => key },
  combat: null,
};
global.ui = { notifications: { warn: jest.fn() } };
global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

class FakeD4Roll {
  constructor() {
    this._total = FakeD4Roll.nextTotal;
  }
  async evaluate() {
    return this;
  }
  get total() {
    return this._total;
  }
}

function makeActor({ id = 'leader1' } = {}) {
  return {
    id,
    getActiveTokens: jest.fn(() => [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }]),
  };
}

function makeAllyToken(actorId) {
  const actor = { id: actorId };
  return { actor, document: { disposition: 1 }, center: { x: 0, y: 0 } };
}

function makeCombatant({ actorId, initiative }) {
  return { actor: { id: actorId }, initiative, update: jest.fn() };
}

describe("activateStayInFormation", () => {
  beforeEach(() => {
    ui.notifications.warn.mockReset();
    canvas.tokens.placeables = [];
    global.Roll = FakeD4Roll;
    FakeD4Roll.nextTotal = 2;
  });

  afterEach(() => {
    game.combat = null;
  });

  test("sets every nearby ally's Initiative to the leader's own minus a 1d4 roll", async () => {
    const actor = makeActor();
    const allyToken = makeAllyToken('ally1');
    canvas.tokens.placeables.push(allyToken);
    const myCombatant = makeCombatant({ actorId: 'leader1', initiative: 15 });
    const allyCombatant = makeCombatant({ actorId: 'ally1', initiative: 8 });
    game.combat = { combatants: [myCombatant, allyCombatant] };

    const result = await activateStayInFormation(actor);

    expect(result).toBe(true);
    expect(allyCombatant.update).toHaveBeenCalledWith({ initiative: 13 });
  });

  test("floors the result at 1", async () => {
    FakeD4Roll.nextTotal = 4;
    const actor = makeActor();
    const allyToken = makeAllyToken('ally1');
    canvas.tokens.placeables.push(allyToken);
    const myCombatant = makeCombatant({ actorId: 'leader1', initiative: 2 });
    const allyCombatant = makeCombatant({ actorId: 'ally1', initiative: 8 });
    game.combat = { combatants: [myCombatant, allyCombatant] };

    await activateStayInFormation(actor);

    expect(allyCombatant.update).toHaveBeenCalledWith({ initiative: 1 });
  });

  test("warns and does nothing outside combat", async () => {
    game.combat = null;
    const actor = makeActor();

    const result = await activateStayInFormation(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("warns and does nothing when the leader hasn't rolled Initiative yet", async () => {
    const actor = makeActor();
    const myCombatant = makeCombatant({ actorId: 'leader1', initiative: null });
    game.combat = { combatants: [myCombatant] };

    const result = await activateStayInFormation(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("returns false with no allies seated in this combat", async () => {
    const actor = makeActor();
    const allyToken = makeAllyToken('ally1');
    canvas.tokens.placeables.push(allyToken);
    const myCombatant = makeCombatant({ actorId: 'leader1', initiative: 15 });
    game.combat = { combatants: [myCombatant] };

    const result = await activateStayInFormation(actor);

    expect(result).toBe(false);
  });
});
