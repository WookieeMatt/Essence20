import { jest } from '@jest/globals';
import { resizeTokens, changeTokenImage } from "./token-sync.mjs";

describe("resizeTokens", () => {
  test("updates every active token's document with the new dimensions", () => {
    const tokenA = { document: { update: jest.fn() } };
    const tokenB = { document: { update: jest.fn() } };
    const actor = { getActiveTokens: jest.fn(() => [tokenA, tokenB]) };

    resizeTokens(actor, 2, 3);

    expect(tokenA.document.update).toHaveBeenCalledWith({ height: 3, width: 2 });
    expect(tokenB.document.update).toHaveBeenCalledWith({ height: 3, width: 2 });
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
