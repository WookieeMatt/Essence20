import { isSuppressedWhileUnmorphed } from './morph-gated-effects.mjs';

function makeActor(isMorphed) {
  return { documentName: 'Actor', system: { isMorphed } };
}

describe('isSuppressedWhileUnmorphed', () => {
  test('suppresses a whileMorphed effect on an unmorphed actor', () => {
    const effect = { parent: makeActor(false) };
    expect(isSuppressedWhileUnmorphed({ whileMorphed: true, parent: effect })).toBe(true);
  });

  test('lets it apply while Morphed (undefined, so duration expiry still decides)', () => {
    const effect = { parent: makeActor(true) };
    expect(isSuppressedWhileUnmorphed({ whileMorphed: true, parent: effect })).toBeUndefined();
  });

  test('reads the owning actor through an Item for a transferred effect', () => {
    const unmorphedItem = { documentName: 'Item', actor: makeActor(false) };
    const morphedItem = { documentName: 'Item', actor: makeActor(true) };

    expect(isSuppressedWhileUnmorphed({ whileMorphed: true, parent: { parent: unmorphedItem } })).toBe(true);
    expect(isSuppressedWhileUnmorphed({ whileMorphed: true, parent: { parent: morphedItem } })).toBeUndefined();
  });

  test('suppresses on an Item with no owning actor', () => {
    const item = { documentName: 'Item', actor: null, parent: null };
    expect(isSuppressedWhileUnmorphed({ whileMorphed: true, parent: { parent: item } })).toBe(true);
  });

  test('has nothing to say about an ordinary effect', () => {
    const effect = { parent: makeActor(false) };
    expect(isSuppressedWhileUnmorphed({ whileMorphed: false, parent: effect })).toBeUndefined();
    expect(isSuppressedWhileUnmorphed(null)).toBeUndefined();
  });
});
