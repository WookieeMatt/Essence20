import { jest } from '@jest/globals';
import { createEffectMacro, toggleEffectMacro } from './effects.mjs';

/* Shared harness. These two functions talk to the Foundry globals directly (ui, game, Macro,
   fromUuid, ChatMessage), the same way createItemMacro/rollItemMacro in essence20.mjs do, so the
   tests stand those up rather than refactoring the production code to take them as arguments. */

let warnings;
let createdMacros;
let assigned;

function makeEffect({ id = "eff1", name = "Field Adrenaline", disabled = false, img } = {}) {
  const effect = { id, name, disabled, img };
  effect.update = jest.fn(async (changes) => Object.assign(effect, changes));
  return effect;
}

function setupGlobals({ effects = [], macros = [], speaker = { actor: "actor1" }, uuidDoc } = {}) {
  warnings = [];
  createdMacros = [];
  assigned = [];

  const actor = {
    allApplicableEffects: function* () {
      yield* effects;
    },
  };

  global.ui = { notifications: { warn: (m) => warnings.push(m) } };
  global.ChatMessage = { getSpeaker: () => speaker };
  global.fromUuid = jest.fn(async () => uuidDoc);
  global.Macro = {
    create: jest.fn(async (data) => {
      createdMacros.push(data);
      return { ...data, id: `macro${createdMacros.length}` };
    }),
  };
  global.game = {
    i18n: {
      localize: (k) => k,
      format: (k, d) => `${k}:${JSON.stringify(d)}`,
    },
    actors: { get: () => actor, tokens: {} },
    macros: { find: (fn) => macros.find(fn) ?? null },
    user: { assignHotbarMacro: (macro, slot) => assigned.push({ macro, slot }) },
  };

  return { actor };
}

afterEach(() => {
  delete global.ui;
  delete global.game;
  delete global.Macro;
  delete global.fromUuid;
  delete global.ChatMessage;
});

/* createEffectMacro */
describe("createEffectMacro", () => {
  test("creates a toggle macro for a dropped ActiveEffect and assigns it to the slot", async () => {
    const effect = makeEffect({ id: "abc", name: "Field Adrenaline", img: "icons/svg/upgrade.svg" });
    setupGlobals({ uuidDoc: effect });

    const result = await createEffectMacro({ type: "ActiveEffect", uuid: "Actor.x.ActiveEffect.abc" }, 3);

    expect(result).toBe(false);
    expect(createdMacros).toHaveLength(1);
    expect(createdMacros[0]).toMatchObject({
      name: "Field Adrenaline",
      type: "script",
      img: "icons/svg/upgrade.svg",
      command: 'game.essence20.toggleEffectMacro("abc", "Field Adrenaline");',
      flags: { "essence20.effectMacro": true },
    });
    expect(assigned).toEqual([{ macro: expect.objectContaining({ name: "Field Adrenaline" }), slot: 3 }]);
  });

  test("falls back to a default image when the effect has none", async () => {
    setupGlobals({ uuidDoc: makeEffect({ img: undefined }) });

    await createEffectMacro({ type: "ActiveEffect", uuid: "Actor.x.ActiveEffect.eff1" }, 1);

    expect(createdMacros[0].img).toBe("icons/svg/aura.svg");
  });

  test("reuses an existing identical macro instead of creating a duplicate", async () => {
    const effect = makeEffect({ id: "abc", name: "Field Adrenaline" });
    const existing = {
      name: "Field Adrenaline",
      command: 'game.essence20.toggleEffectMacro("abc", "Field Adrenaline");',
    };
    setupGlobals({ uuidDoc: effect, macros: [existing] });

    await createEffectMacro({ type: "ActiveEffect", uuid: "Actor.x.ActiveEffect.abc" }, 2);

    expect(createdMacros).toHaveLength(0);
    expect(assigned).toEqual([{ macro: existing, slot: 2 }]);
  });

  test("ignores a drop that is not an ActiveEffect", async () => {
    setupGlobals({ uuidDoc: makeEffect() });

    const result = await createEffectMacro({ type: "Item", uuid: "Actor.x.Item.abc" }, 1);

    expect(result).toBe(false);
    expect(global.fromUuid).not.toHaveBeenCalled();
    expect(createdMacros).toHaveLength(0);
  });

  test("warns and creates nothing for an unowned effect with no uuid", async () => {
    setupGlobals({});

    await createEffectMacro({ type: "ActiveEffect" }, 1);

    expect(warnings).toEqual(["E20.EffectMacroUnowned"]);
    expect(createdMacros).toHaveLength(0);
    expect(assigned).toHaveLength(0);
  });

  test("creates nothing when the uuid no longer resolves", async () => {
    setupGlobals({ uuidDoc: null });

    const result = await createEffectMacro({ type: "ActiveEffect", uuid: "Actor.x.ActiveEffect.gone" }, 1);

    expect(result).toBe(false);
    expect(createdMacros).toHaveLength(0);
  });
});

/* toggleEffectMacro */
describe("toggleEffectMacro", () => {
  test("disables an enabled effect found by id", () => {
    const effect = makeEffect({ id: "abc", disabled: false });
    setupGlobals({ effects: [effect] });

    toggleEffectMacro("abc", "Field Adrenaline");

    expect(effect.update).toHaveBeenCalledWith({ disabled: true });
  });

  test("enables a disabled effect", () => {
    const effect = makeEffect({ id: "abc", disabled: true });
    setupGlobals({ effects: [effect] });

    toggleEffectMacro("abc", "Field Adrenaline");

    expect(effect.update).toHaveBeenCalledWith({ disabled: false });
  });

  test("falls back to matching by name when the id no longer exists", () => {
    // The macro outlives the document it was dragged from: delete and recreate the effect and the
    // id changes, but a macro keyed on the name still finds it.
    const effect = makeEffect({ id: "recreated", name: "Field Adrenaline" });
    setupGlobals({ effects: [effect] });

    toggleEffectMacro("abc", "Field Adrenaline");

    expect(effect.update).toHaveBeenCalledWith({ disabled: true });
  });

  test("prefers an id match over a name match", () => {
    const byName = makeEffect({ id: "other", name: "Field Adrenaline" });
    const byId = makeEffect({ id: "abc", name: "Field Adrenaline" });
    setupGlobals({ effects: [byName, byId] });

    toggleEffectMacro("abc", "Field Adrenaline");

    expect(byId.update).toHaveBeenCalled();
    expect(byName.update).not.toHaveBeenCalled();
  });

  test("warns when the controlled actor has no such effect", () => {
    setupGlobals({ effects: [makeEffect({ id: "zzz", name: "Something Else" })] });

    toggleEffectMacro("abc", "Field Adrenaline");

    expect(warnings).toEqual(['E20.EffectMacroMissing:{"name":"Field Adrenaline"}']);
  });

  test("warns rather than throwing when nothing is controlled", () => {
    setupGlobals({});
    global.game.actors.get = () => null;

    expect(() => toggleEffectMacro("abc", "Field Adrenaline")).not.toThrow();
    expect(warnings).toHaveLength(1);
  });

  test("reads the token's actor when the speaker is a token", () => {
    const effect = makeEffect({ id: "abc" });
    setupGlobals({ effects: [], speaker: { token: "tok1", actor: "actor1" } });
    global.game.actors.tokens = {
      tok1: {
        allApplicableEffects: function* () {
          yield effect;
        },
      },
    };

    toggleEffectMacro("abc", "Field Adrenaline");

    expect(effect.update).toHaveBeenCalledWith({ disabled: true });
  });

  test("falls back to actor.effects for an actor without allApplicableEffects", () => {
    const effect = makeEffect({ id: "abc" });
    setupGlobals({});
    global.game.actors.get = () => ({ effects: [effect] });

    toggleEffectMacro("abc", "Field Adrenaline");

    expect(effect.update).toHaveBeenCalledWith({ disabled: true });
  });
});
