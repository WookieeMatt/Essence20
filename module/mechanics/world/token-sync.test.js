import { jest } from '@jest/globals';
import { resizeTokens, changeTokenImage } from "./token-sync.mjs";

describe("resizeTokens", () => {
  const token = (extra = {}) => ({ actorId: 'a1', actorLink: false, isOwner: true, width: 1, height: 1, update: jest.fn(), ...extra });

  test("resizes the actor's linked tokens and its unlinked ones on every scene (they share its Size)", () => {
    const linked = token({ actorLink: true });
    const unlinked = token();
    const elsewhere = token();
    const other = token({ actorId: 'b2' });
    global.game.scenes = [{ tokens: [linked, unlinked, other] }, { tokens: [elsewhere] }];

    resizeTokens({ id: 'a1' }, 2, 3);

    for (const t of [linked, unlinked, elsewhere]) {
      expect(t.update).toHaveBeenCalledWith({ height: 3, width: 2 });
    }

    expect(other.update).not.toHaveBeenCalled();
  });

  test("leaves an unlinked token whose copy keeps its own Size, one already that size, and one this user can't change", () => {
    const ownSize = token({ delta: { _source: { system: { size: 'small' } }, system: { size: 'small' } } });
    const already = token({ width: 2, height: 3 });
    const notMine = token({ isOwner: false });
    global.game.scenes = [{ tokens: [ownSize, already, notMine] }];

    resizeTokens({ id: 'a1' }, 2, 3);

    for (const t of [ownSize, already, notMine]) {
      expect(t.update).not.toHaveBeenCalled();
    }
  });

  test("an unlinked token's own copy resizes just its token", () => {
    const own = token();
    resizeTokens({ isToken: true, token: own }, 4, 4);
    expect(own.update).toHaveBeenCalledWith({ height: 4, width: 4 });
  });
});

describe("changeTokenImage", () => {
  test("updates every active token's texture", () => {
    const token = { document: { update: jest.fn() } };
    const actor = { getActiveTokens: jest.fn(() => [token]) };

    changeTokenImage(actor, "path/to/image.webp");

    expect(token.document.update).toHaveBeenCalledWith({ "texture.src": "path/to/image.webp" });
  });

  // An unset Morphed / Alt Mode image used to blank the token and throw from the token animation.
  test("leaves the tokens alone when there is no image to switch to", () => {
    const token = { document: { update: jest.fn() } };
    const actor = { getActiveTokens: jest.fn(() => [token]) };

    changeTokenImage(actor, null);
    changeTokenImage(actor, "");

    expect(token.document.update).not.toHaveBeenCalled();
  });
});
