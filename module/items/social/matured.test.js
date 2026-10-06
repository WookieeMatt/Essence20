import { jest } from '@jest/globals';
import { applyMatured, pickMaturedHangUp } from './matured.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeEffectsCollection(effects) {
  return {
    size: effects.length,
    [Symbol.iterator]: () => effects[Symbol.iterator](),
  };
}

function makeEffect(disabled) {
  return { disabled, update: jest.fn(async function (data) {
    this.disabled = data.disabled; 
  }) };
}

function makeHangUp({ id, name, ignored = false, effects = [] } = {}) {
  const flags = { maturedIgnored: ignored || undefined };
  return {
    id, name, type: 'hangUp',
    effects: makeEffectsCollection(effects),
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value; 
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[key]; 
    }),
  };
}

function makeActor(hangUps) {
  return { items: hangUps };
}

describe("pickMaturedHangUp", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("returns null when the actor has no Hang-Up at all", async () => {
    const actor = makeActor([]);
    expect(await pickMaturedHangUp(actor)).toBeNull();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("prompts and returns the chosen Hang-Up item", async () => {
    const hangUp = makeHangUp({ id: 'h1', name: 'Angry' });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('h1');
    const actor = makeActor([hangUp]);

    expect(await pickMaturedHangUp(actor)).toBe(hangUp);
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor([makeHangUp({ id: 'h1', name: 'Angry' })]);
    expect(await pickMaturedHangUp(actor)).toBeNull();
  });
});

describe("applyMatured", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("flags the chosen Hang-Up and disables its single effect", async () => {
    const effect = makeEffect(false);
    const hangUp = makeHangUp({ id: 'h1', name: 'Chemist', effects: [effect] });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('h1');
    const actor = makeActor([hangUp]);

    const ignored = await applyMatured(actor);

    expect(ignored).toBe(hangUp);
    expect(hangUp.setFlag).toHaveBeenCalledWith('essence20', 'maturedIgnored', true);
    expect(effect.disabled).toBe(true);
  });

  test("re-picking un-ignores the previous Hang-Up and re-enables its single effect", async () => {
    const oldEffect = makeEffect(true);
    const oldHangUp = makeHangUp({ id: 'h1', name: 'Chemist', ignored: true, effects: [oldEffect] });
    const newHangUp = makeHangUp({ id: 'h2', name: 'Angry' });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('h2');
    const actor = makeActor([oldHangUp, newHangUp]);

    await applyMatured(actor);

    expect(oldHangUp.unsetFlag).toHaveBeenCalledWith('essence20', 'maturedIgnored');
    expect(oldEffect.disabled).toBe(false);
    expect(newHangUp.setFlag).toHaveBeenCalledWith('essence20', 'maturedIgnored', true);
  });

  test("does NOT touch effects on a multi-effect (choose-one-of-N) Hang-Up", async () => {
    const effects = [makeEffect(false), makeEffect(true), makeEffect(true)];
    const hangUp = makeHangUp({ id: 'h1', name: 'Tragedy', effects });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('h1');
    const actor = makeActor([hangUp]);

    await applyMatured(actor);

    expect(hangUp.setFlag).toHaveBeenCalledWith('essence20', 'maturedIgnored', true);
    expect(effects.map(e => e.disabled)).toEqual([false, true, true]);
  });

  test("returns null and sets nothing with no Hang-Up to pick", async () => {
    const actor = makeActor([]);
    const ignored = await applyMatured(actor);
    expect(ignored).toBeNull();
  });
});
