import { jest } from '@jest/globals';
import { applySpeedBoost, consumeSpeedBoostEdge, isSpeedBoostEdgeActive } from './speed-boost.mjs';

function makeEffect(disabled, key) {
  return {
    disabled,
    changes: [{ key, mode: 2, value: '10' }],
    update: jest.fn(async function (data) {
      this.disabled = data.disabled;
    }),
  };
}

function makeItem() {
  const ground = makeEffect(true, 'system.movement.ground.morphed');
  const initiative = makeEffect(true, 'system.skills.initiative.edge');
  return { ground, initiative, item: { effects: [ground, initiative] } };
}

function makeActor(flags = {}) {
  const store = { ...flags };
  return {
    getFlag: jest.fn((scope, key) => store[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      store[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete store[key];
    }),
  };
}

describe('applySpeedBoost', () => {
  test('banks one Initiative Edge and reports it changed something', async () => {
    const actor = makeActor();
    const { item } = makeItem();

    const changed = await applySpeedBoost(actor, item);

    expect(changed).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'speedBoostInitiativeEdge', true);
    expect(isSpeedBoostEdgeActive(actor)).toBe(true);
  });

  test('switches the passive Ground Movement effect on, but never the always-on Initiative Edge effect', async () => {
    const { ground, initiative, item } = makeItem();

    await applySpeedBoost(makeActor(), item);

    expect(ground.update).toHaveBeenCalledWith({ disabled: false });
    expect(initiative.update).not.toHaveBeenCalled();
  });

  test('is a no-op when an Edge is already banked', async () => {
    const actor = makeActor({ speedBoostInitiativeEdge: true });
    const { item } = makeItem();

    const changed = await applySpeedBoost(actor, item);

    expect(changed).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe('consumeSpeedBoostEdge', () => {
  test('clears the banked Edge', async () => {
    const actor = makeActor({ speedBoostInitiativeEdge: true });

    await consumeSpeedBoostEdge(actor);

    expect(isSpeedBoostEdgeActive(actor)).toBe(false);
  });
});
