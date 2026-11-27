/**
 * Swapping words in a rendered sheet needs a DOM.
 *
 * @jest-environment jsdom
 */
import { setCustomLines } from './custom-game-lines.mjs';
import {
  applyElementDamageWord, applyTermsToElement, applyWorldTerms, elementDamageWord, replacerFor, termsLineOf,
} from './line-terms-hooks.mjs';

const lines = [
  { label: 'Voltron', family: 'powerRangers', terms: { Zord: 'Lion', Megazord: 'Voltron' } },
  { label: 'ThunderCats', family: 'transformers', terms: { Zord: 'Thundertank' } },
];

function world(gameLine, crossover = false) {
  globalThis.game = {
    settings: { get: (scope, key) => ({ gameLine, crossoverTerms: crossover })[key] },
    i18n: { translations: { E20: { A: 'Join the Zord', B: 'The Megazord {name}' }, TYPES: { Actor: { zord: 'Zord' } }, CORE: 'Zord' } },
  };
}

const roleActor = (version, gameLine) => ({ type: 'playerCharacter', items: [{ type: 'role', system: { version, gameLine } }] });

beforeAll(() => setCustomLines(lines));
afterEach(() => {
  delete globalThis.game;
  delete globalThis.CONFIG;
});

test("the world line's words go into the system's own strings, not anyone else's", () => {
  world('voltron');
  expect(applyWorldTerms()).toBe(3);
  expect(game.i18n.translations).toEqual({ E20: { A: 'Join the Lion', B: 'The Voltron {name}' }, TYPES: { Actor: { zord: 'Lion' } }, CORE: 'Zord' });
  world('giJoe');
  expect(applyWorldTerms()).toBe(0);
});

test("a sheet's text and tooltips are swapped once; what's typed is left alone", () => {
  world('voltron');
  const el = document.createElement('div');
  el.innerHTML = '<h1 data-tooltip="<b>Zord</b>">Red Zord</h1><input value="Zord" placeholder="Zord name"><textarea>Zord</textarea>';
  const replace = replacerFor(null);
  applyTermsToElement(el, replace);
  applyTermsToElement(el, replace);
  expect(el.querySelector('h1').textContent).toBe('Red Lion');
  expect(el.querySelector('h1').dataset.tooltip).toBe('<b>Lion</b>');
  expect(el.querySelector('input').value).toBe('Zord');
  expect(el.querySelector('input').placeholder).toBe('Lion name');
  expect(el.querySelector('textarea').textContent).toBe('Zord');
  expect(() => applyTermsToElement(el, null)).not.toThrow();
});

test("with Crossover on, each actor reads in its own Role's line's words", () => {
  world('voltron', true);
  expect(replacerFor(roleActor('powerRangers', 'voltron'))('Lion Zord')).toBe('Lion Lion');
  expect(replacerFor(roleActor('transformers', 'thundercats'))('Lion Zord')).toBe('Thundertank Thundertank');
  expect(replacerFor(roleActor('giJoe', ''))('Lion and Voltron')).toBe('Zord and Megazord');
  // Off: everyone is in the world's words.
  world('voltron', false);
  expect(replacerFor(roleActor('giJoe', ''))('Zord')).toBe('Lion');
});

test("under Crossover a Zord or Megaform with no Role reads in its pilot's line; with no pilot, the world's", () => {
  world('voltron', true);
  const paladin = roleActor('powerRangers', 'voltron');
  const joe = roleActor('giJoe', '');
  const byUuid = { 'Actor.paladin': paladin, 'Actor.joe': joe };
  globalThis.fromUuidSync = uuid => byUuid[uuid] ?? null;
  const zord = (pilot) => ({ type: 'zord', items: [], system: { actors: pilot ? { a: { uuid: `Actor.${pilot}` } } : {} } });
  byUuid['Actor.lion'] = zord('paladin');
  expect(termsLineOf(zord('joe'))).toBe('gij');
  expect(termsLineOf(zord(null))).toBe('voltron');
  expect(termsLineOf({ type: 'megaform', items: [], system: { actors: { a: { uuid: 'Actor.lion' } } } })).toBe('voltron');
  expect(replacerFor(zord('joe'))('Lion')).toBe('Zord');
  delete globalThis.fromUuidSync;
});

test("a world playing every line is a crossover: each actor reads in its own line's words", () => {
  world('');
  expect(replacerFor(roleActor('powerRangers', 'voltron'))('Zord')).toBe('Lion');
  expect(replacerFor(roleActor('giJoe', ''))).toBeNull();
});

describe("the 'element' damage type's name by line (Energy in PR / MLP / TF, Element in G.I. Joe)", () => {
  function withLabel(gameLine, crossover = false) {
    world(gameLine, crossover);
    Object.assign(game.i18n.translations.E20, {
      DamageElement: 'Element/Energy', WeaponTraitEnergy: 'Element/Energy', WeaponStyleEnergy: 'Element/Energy',
      DamageElementWord: { element: 'Element', energy: 'Energy' },
    });
    globalThis.CONFIG = { E20: { damageTypes: { element: 'Element/Energy', fire: 'Fire' }, weaponTraits: { energy: 'Element/Energy' }, list: ['Element/Energy'] } };
  }

  test('each book line has its word; a homebrew line has its family\'s; Night Vale and every-line have none', () => {
    withLabel('');
    expect(elementDamageWord('powerRangers')).toBe('Energy');
    expect(elementDamageWord('pr')).toBe('Energy');
    expect(elementDamageWord('mlp')).toBe('Energy');
    expect(elementDamageWord('transformers')).toBe('Energy');
    expect(elementDamageWord('gij')).toBe('Element');
    expect(elementDamageWord('voltron')).toBe('Energy');
    expect(elementDamageWord('welcomeToNightVale')).toBeNull();
    expect(elementDamageWord('')).toBeNull();
  });

  test("a one-line world's label reads in that line's word", () => {
    withLabel('giJoe');
    expect(applyWorldTerms()).toBe(3);
    expect(game.i18n.translations.E20).toMatchObject({ DamageElement: 'Element', WeaponTraitEnergy: 'Element', WeaponStyleEnergy: 'Element' });
    // Foundry localized CONFIG's lists before i18nInit: they're changed too.
    expect(CONFIG.E20).toEqual({ damageTypes: { element: 'Element', fire: 'Fire' }, weaponTraits: { energy: 'Element' }, list: ['Element/Energy'] });
    withLabel('powerRangers');
    applyElementDamageWord();
    expect(game.i18n.translations.E20.DamageElement).toBe('Energy');
    // Every line, or Night Vale: both names stay.
    withLabel('');
    expect(applyElementDamageWord()).toBe(0);
    withLabel('welcomeToNightVale');
    expect(applyElementDamageWord()).toBe(0);
    expect(game.i18n.translations.E20.DamageElement).toBe('Element/Energy');
  });

  test('under Crossover the label stays, and each actor reads it in its own line\'s word', () => {
    withLabel('powerRangers', true);
    expect(applyElementDamageWord()).toBe(0);
    expect(replacerFor(roleActor('giJoe', ''))('2 Element/Energy damage')).toBe('2 Element damage');
    expect(replacerFor(roleActor('powerRangers', ''))('2 Element/Energy damage')).toBe('2 Energy damage');
    // A world playing every line is a crossover too.
    withLabel('');
    expect(replacerFor(roleActor('transformers', ''))('Element/Energy')).toBe('Energy');
    // Nothing to swap for no actor (world text) - the label says both.
    expect(replacerFor(null)).toBeNull();
  });

  test("a line's own Words for the label win", () => {
    setCustomLines([...lines, { label: 'Mask', family: 'giJoe', terms: { 'Element/Energy': 'Venom' } }]);
    withLabel('mask');
    expect(applyWorldTerms()).toBe(3);
    expect(game.i18n.translations.E20.DamageElement).toBe('Venom');
    withLabel('', true);
    expect(replacerFor(roleActor('giJoe', 'mask'))('Element/Energy')).toBe('Venom');
    setCustomLines(lines);
  });
});
