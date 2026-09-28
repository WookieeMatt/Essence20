import { jest } from '@jest/globals';
import { getDrawnStatusEffects, getStackBadges, makeEssence20Token } from './token.mjs';

const SHOW_ICON = { NONE: 0, CONDITIONAL: 1, ALWAYS: 2 };

beforeAll(() => {
  global.CONST = { ...(global.CONST ?? {}), ACTIVE_EFFECT_SHOW_ICON: SHOW_ICON };
});

const effect = (stacks, showIcon = SHOW_ICON.ALWAYS, isTemporary = true) => ({
  showIcon, isTemporary, flags: stacks ? { essence20: { stacks } } : {},
});

describe("getDrawnStatusEffects / getStackBadges", () => {
  test("keeps core's own filter and order, so each badge lines up with its icon", () => {
    const actor = { appliedEffects: [effect(0), effect(3, SHOW_ICON.NONE), effect(2), effect(0, SHOW_ICON.CONDITIONAL, false), effect(4)] };
    expect(getDrawnStatusEffects(actor)).toHaveLength(3);
    expect(getStackBadges(actor)).toEqual([{ index: 1, stacks: 2 }, { index: 2, stacks: 4 }]);
  });

  test("nothing without an actor", () => {
    expect(getStackBadges(null)).toEqual([]);
  });
});

describe("makeEssence20Token", () => {
  test("draws the stack count onto the matching status icon after core's own drawing", async () => {
    class Text {
      constructor(text) {
        this.text = text;
        this.anchor = { set: jest.fn() };
        this.position = { set: jest.fn() };
      }
    }
    global.PIXI = { Text };

    const icon = { zIndex: 1, texture: { width: 100, height: 100 }, addChild: jest.fn() };
    const plain = { zIndex: 0, texture: { width: 100, height: 100 }, addChild: jest.fn() };
    class CoreToken {
      async _drawEffects() {
        this.effects = { bg: {}, children: [plain, icon] };
      }
    }

    const Token = makeEssence20Token(CoreToken);
    const token = new Token();
    token.actor = { appliedEffects: [effect(0), effect(3)] };
    await token._drawEffects();

    expect(plain.addChild).not.toHaveBeenCalled();
    expect(icon.addChild).toHaveBeenCalledWith(expect.objectContaining({ text: "3" }));
    delete global.PIXI;
  });
});
