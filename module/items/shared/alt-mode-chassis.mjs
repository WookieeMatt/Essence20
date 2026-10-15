/**
 * Alt Mode chassis printed with choices (2026-10-14): a size for each Mode ("Size: Common or Large"), and for some a
 * movement ("40 feet Ground or 40 feet Aerial"). Each was once one compendium item per combination; now it is one item
 * with the choices on it (data/item/alt-mode.mjs - altModeSizeOptions, botModeSizeOptions, botModeSizeFor,
 * movementOptions), asked when the Origin is added and changeable on the Alt Mode's row.
 *
 * This table is the record of that merge, read three ways: item-lookups.mjs reads each retired item's uuid as the one
 * kept; migration.mjs#migrateAltModeChoices gives a copy made before the merge its choices; and the pack test checks
 * every kept item carries exactly these. Data only - imports nothing.
 *
 * Per chassis, by the kept item's uuid: name; alt / bot - the sizes each Mode may be (one entry: fixed, no question);
 * botFor - an Alt Mode size that fixes the Bot Mode's ("corresponds to Large Bot Mode"); movement - the Alt Mode's
 * movement choices ({ground, aerial, aquatic, climb, burrow}, feet); retired - the item uuids merged into it.
 *
 * Book checks (2026-10-14): Technorganic Secrets p.36-45, Decepticon Directive p.33-38, Enigma of Combination p.26-28,
 * Field Guide to Action & Adventure p.62-63, Transformers Core Rulebook p.49-52.
 */

const TS = id => `Compendium.essence20.technorganic_secrets.Item.${id}`;
const DD = id => `Compendium.essence20.decepticon_directive.Item.${id}`;
const EOC = id => `Compendium.essence20.enigma_of_combination.Item.${id}`;
const FG = id => `Compendium.essence20.field_guide_action_adventure.Item.${id}`;
const TF = id => `Compendium.essence20.tf_crb.Item.${id}`;

const MONSTROSITY_MOVES = [{ ground: 40 }, { aerial: 40 }, { aquatic: 40 }];
const PRETENDER_MOVES = [{ ground: 45 }, { ground: 30, aerial: 20 }, { ground: 30, aquatic: 20 }];

export const ALT_MODE_CHASSIS = Object.freeze({
  // Technorganic Secrets
  [TS('hF2rJtS3SzcjqnLr')]: { name: 'Behemoth', alt: ['large', 'huge'], bot: ['large', 'huge'], retired: [TS('qZQyZDntWJdNeDQy')] },
  [TS('aTevGfLML1dlbErs')]: {
    name: 'Carapaced', alt: ['common', 'large'], bot: ['common', 'large'],
    movement: [{ ground: 60 }, { ground: 40, burrow: 25 }], retired: [TS('2mSP6mVx0axvOlXf')],
  },
  [TS('A1zJJJOvCKzxzdI0')]: { name: 'Climber/Nimble', alt: ['small', 'common'], bot: ['small', 'common'], retired: [TS('y91e1C5LXS2vviUQ')] },
  [TS('gah8pRWSMDvXsUax')]: { name: 'Flora', alt: ['common', 'large'], bot: ['common', 'large'], retired: [TS('TfIrQViYdkBkqR7q')] },
  [TS('z0DXIKiccQbcT7cQ')]: { name: 'Flyer', alt: ['small', 'common'], bot: ['small', 'common'], retired: [TS('8M5milnnYu2fyJnr')] },
  [TS('w8BzKEttZEoz5nz7')]: {
    name: 'Fuzor', alt: ['common', 'large', 'long'], bot: ['common', 'large', 'long'], retired: [TS('dEacdn0EEQJ2ZB2f'), TS('vgN6uRrRCJ7fKO1z')],
  },
  [TS('RsTuLWH6FrWHcVeF')]: { name: 'Insecticon', alt: ['long'], bot: ['large'], retired: [] },
  [TS('ycX3lh5ZqNkyFw0e')]: {
    name: 'Many-Armed', alt: ['common', 'large'], bot: ['common', 'large'], movement: [{ ground: 50 }, { ground: 30, aquatic: 40 }],
    retired: [TS('wCu6HyM9dWB1XpV4'), TS('P17ah6xfjqjqzcmU'), TS('hs2BII8uOIk7wgpJ')],
  },
  [TS('hRTGCxvA7dI4dSAS')]: {
    name: 'Monstrosity', alt: ['huge', 'extended'], bot: ['huge'], movement: MONSTROSITY_MOVES,
    retired: ['7WsWk1gEk9q9Z29k', 'UriqxySzFuQBK01d', '8eySZa8oyATSLALr', 'KL3FeHBqAIZ66BgQ', 'Rk3mT9vQx2LpW7nZ'].map(TS),
  },
  [TS('Kj8DtQoNrUf2dmI5')]: {
    name: 'Primate', alt: ['common', 'large'], bot: ['common', 'large'], movement: [{ ground: 50, climb: 30 }], retired: [TS('yeeGDdU2LDKyNhBd')],
  },
  [TS('5TrH7WOOUnEi6vDt')]: { name: 'Quadruped', alt: ['large'], bot: ['large'], retired: [] },
  [TS('HdGY7qG1aJE69N2P')]: {
    name: 'Saurian', alt: ['common', 'large', 'long'], bot: ['common', 'large'], botFor: { long: 'large' },
    retired: [TS('fO2tbcFJOmvlxOXh'), TS('hsY5k4vCyBw1Xs8W')],
  },
  [TS('wrG4V7yi5wHnQMbL')]: {
    name: 'Slitherer', alt: ['common', 'long'], bot: ['common', 'large'], botFor: { long: 'large' }, retired: [TS('Y2WR7POqwxnoXzwh')],
  },
  [TS('LwiC3DmOCm1jNbmY')]: { name: 'Swimmer', alt: ['common', 'large'], bot: ['common', 'large'], retired: [TS('696g72VgjR2kzwXO')] },
  [TS('fNQgesw5yxrOdEGN')]: {
    name: 'Pretender', alt: ['small', 'common'], bot: ['small', 'common'], movement: PRETENDER_MOVES,
    retired: ['MdcWdpv4LpyyVrhW', 'Bd7iE2XK7mKZaB5y', '7bbbOV0Z2GxPzQTe', 'px3ggYpFhJqOU9l7', '6s8rw4NKrZ0N935Q'].map(TS),
  },

  // Decepticon Directive
  [DD('ula8VtBnEtz8y4jS')]: {
    name: 'Monstrosity', alt: ['huge', 'extended'], bot: ['huge'], movement: MONSTROSITY_MOVES,
    retired: ['IW0xRwpT2RU6Eyso', 'CeAcrZMp5T9ZhuzO', 'isx1XflgpBp18ND0', 'rz9Kdesd5C7RBhtm', 'rtQAraNbxCoIplbH'].map(DD),
  },
  [DD('JVIOxmSpPwPQDY1z')]: {
    name: 'Mini-Con (Mini-Vehicle)', alt: ['common'], bot: ['common'], movement: [{ ground: 40 }, { aerial: 40 }], retired: [DD('oSn5EyMwso8Z1Ohh')],
  },
  [DD('dUNk3ylraMY7348P')]: { name: 'Mini-Con (Firearm Enhancment Module)', alt: ['small'], bot: ['common'], retired: [] },
  [DD('i8jLfvRkKOFmPdnF')]: { name: 'Mini-Con (Mini-Cassette)', alt: ['small'], bot: ['common'], retired: [] },
  [DD('1Phg0rsbVHuCOpJb')]: { name: 'Mini-Con (Power Conduit)', alt: ['small'], bot: ['common'], retired: [] },
  [DD('LQuQIm8rqeGu84ga')]: { name: 'Insecticon', alt: ['long'], bot: ['large'], retired: [] },
  [DD('cGGEXSdCI170AaM4')]: { name: 'Salvaged', alt: ['long'], bot: ['large'], retired: [] },
  [DD('UO5WlCGHXtPOKFFY')]: { name: 'Armory Call', alt: ['small'], bot: ['large'], retired: [] },

  // Enigma of Combination
  [EOC('QNhq3rRVOu1EfeyD')]: { name: 'Charger', alt: ['long'], bot: ['large'], movement: [{ ground: 45 }, { aerial: 45 }], retired: [] },
  [EOC('SroTzxuu57HoaN9V')]: { name: 'Pillar', alt: ['long', 'extended'], bot: ['large', 'huge'], retired: [EOC('j0CJWQ858tbQvVUs')] },
  [EOC('GPW2T5OEC0KtlJpX')]: {
    name: 'Speaker', alt: ['common', 'long'], bot: ['common', 'large'], movement: [{ ground: 45 }, { aerial: 30 }],
    retired: ['ilL3CyLQDydjxBHf', 'wwFXrMqJd0YJHqkX', '48zFIrJCoULshGtm'].map(EOC),
  },

  // Field Guide to Action & Adventure
  [FG('ca4svWchRNjMhEMf')]: {
    name: 'Pretender', alt: ['small', 'common'], bot: ['small', 'common'], movement: PRETENDER_MOVES,
    retired: ['VGMl0WRUi7JlpeHD', '2RdkwgXojDbxqZwG', 'WYhFLk3UNGrPpkDc', 'YBPRmUSQ8YWltd1T', 'sew02e01Cw2m4cUd'].map(FG),
  },

  // Transformers Core Rulebook - Bot Mode Common or Large and Alt Mode Common or Long, chosen apart (p.49, p.52).
  [TF('5sxhsXAHh97KTpwa')]: { name: 'Cutter', alt: ['common', 'long'], bot: ['common', 'large'], retired: [TF('FlN4FCnbTP7RRz8K')] },
  [TF('NaF9feAfujLYwDfO')]: { name: 'Outrider', alt: ['common', 'long'], bot: ['common', 'large'], retired: [TF('WYlv5KoOv8WTUtKN')] },
});

/** Retired item uuid => the kept one. */
export const MERGED_ALT_MODE_UUIDS = Object.freeze(Object.fromEntries(Object.entries(ALT_MODE_CHASSIS)
  .flatMap(([kept, chassis]) => chassis.retired.map(uuid => [uuid, kept]))));

export const MOVEMENT_TYPES = ['ground', 'aerial', 'aquatic', 'climb', 'burrow'];

/** A movement choice with every type filled in (0 for the ones it doesn't have). */
export const fullMovement = option => Object.fromEntries(MOVEMENT_TYPES.map(type => [type, Number(option?.[type]) || 0]));

/** Which of an Alt Mode's movement choices it has now (its altModeMovement), or -1. */
export function movementChoiceIndex(system) {
  const current = fullMovement(system?.altModeMovement);
  return (system?.movementOptions ?? []).findIndex(option => MOVEMENT_TYPES.every(type => fullMovement(option)[type] == current[type]));
}

/** The Bot Mode size an Alt Mode size fixes (Saurian / Slitherer: a Long Alt Mode is a Large Bot Mode), or null. */
export const botSizeFor = (system, altSize) => system?.botModeSizeFor?.[altSize] ?? null;

const MOVEMENT_LABELS = { ground: 'Ground', aerial: 'Aerial', aquatic: 'Aquatic', climb: 'Climb', burrow: 'Burrow' };

/** A movement choice in words - "30 ft Ground, 20 ft Aerial". `localize` reads E20.AltModeMovement<Type>. */
export function movementLabel(option, localize = key => key) {
  const full = fullMovement(option);
  return MOVEMENT_TYPES.filter(type => full[type]).map(type => `${full[type]} ft ${localize(`E20.AltModeMovement${MOVEMENT_LABELS[type]}`)}`).join(', ');
}
