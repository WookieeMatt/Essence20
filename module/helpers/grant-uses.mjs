import { getUses } from "./scene-clock.mjs";

/**
 * Which items give something to pick - a free upgrade, another Role's Perk, a made-on-the-spot
 * weapon, a light - and so get a Use button. The picking and granting is in helpers/grants.mjs;
 * this table stays apart from it so helpers/action-perks.mjs can ask about the button without
 * importing everything grants.mjs does (which would loop back round to action-perks.mjs).
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

export const GRANT = {
  customGear: uuid('gi_joe_crb', '15b9YumuRnzL16XW'),
  environmentalWeapon: uuid('gi_joe_crb', 'K6taaZgeGFxX4lA3'),
  forage: uuid('gi_joe_crb', 'QXpG3NuwaFgbdc0x'),
  kitbasher: uuid('gi_joe_crb', 'az09yEPydnE1tBTj'),
  primaryTech: uuid('gi_joe_crb', '5eOqntPaqp1g4M7k'),
  secondaryTech: uuid('gi_joe_crb', 'p301AoQlteHsA4pH'),
  customizedArmor: uuid('gi_joe_crb', 'smvGDC2LdShGs0UK'),
  safetyFirst: uuid('gi_joe_crb', 'hLWet58M7NV6c0Sn'),
  spottersScope: uuid('gi_joe_crb', 'yxCVYAmJTk68pAQt'),
  ghillieSuitSniping: uuid('gi_joe_crb', 'O3w2NL8H2gCtkWzN'),
  integratedOffense: uuid('gi_joe_crb', 'H1ITRVeP9229PlfU'),
  kitbashEquipment: uuid('gi_joe_crb', '4F6GJqqpHSZYFNqA'),
  quickbash: uuid('gi_joe_crb', 'YlihpNSSspqwfMv6'),
  crossTrainingGij: uuid('gi_joe_crb', 'V4ufZix4uyHjYITJ'),
  splitFocus: uuid('gi_joe_crb', 'JE6gXmak0TZvk0U1'),
  droneBasicWeapon: uuid('gi_joe_crb', '6x7H1Br7te7T3klR'),
  droneAdvancedWeapon: uuid('gi_joe_crb', 'QCuxONjk27SKggQw'),
  droneSpecializedWeapon: uuid('gi_joe_crb', 'ddLUrsn3t96NpUqL'),
  weaponTraining: uuid('gi_joe_crb', 'rFnoQTbnYQX2tlMe'),
  animalize: uuid('cobra_codex', '362Yyjs1INvYufPN'),
  standardSkinTempering: uuid('cobra_codex', '0DQYk8jWOPkur9GQ'),
  limitedSkinTempering: uuid('cobra_codex', 'XmFMrfsM3PH4GQBG'),
  restrictedSkinTempering: uuid('cobra_codex', 'A7eEbdF3e9aaXj7S'),
  zetaSkinTransplant: uuid('cobra_codex', 'UTJumLUCsoKuUfVT'),
  standardWeaponization: uuid('cobra_codex', 'zNN9bu7QMXzpUgHB'),
  limitedWeaponization: uuid('cobra_codex', 'nzX5e7PPoHU3nLM3'),
  martialWeaponization: uuid('cobra_codex', 'IOum6G4uZdTDh4J9'),
  ySeriesWeaponization: uuid('cobra_codex', 'W6ZrWSY6ux3ki9D1'),
  armed: uuid('cobra_codex', 'tH6Osix0iQGxowNz'),
  adeptQuickDraw: uuid('cobra_codex', 'YGr6vNEv9MKoVlyS'),
  highlyEffective: uuid('cobra_codex', 'KEDIY0wDCLbOIXuR'),
  steadyHand: uuid('cobra_codex', '1zreGdgegCeRjJPT'),
  flurryOfAttacks: uuid('cobra_codex', 'Fv2fYJxjgGyqAbq6'),
  baseTechAdvancement: uuid('cobra_codex', '3ZW6OOOli170AwsW'),
  branchLeader: uuid('cobra_codex', 'EwIMxCkVn5mj9ArG'),
  branchPerk: uuid('cobra_codex', 'IZeAhxUAZkdehxAF'),
  multifaceted: uuid('ferocious_fighters', '05INUNEBfKDL6GmJ'),
  multifacetedHangUp: uuid('ferocious_fighters', 'g6bxWMq3UDSstUfp'),
  cordial: uuid('ferocious_fighters', 'I4tkodAyDsVPSXCU'),
  factionReservist: uuid('ferocious_fighters', 'w6fjujYpg8DrnuMX'),
  fieldPromotion: uuid('ferocious_fighters', 'aeXmsn13l790Jxqr'),
  onTheJobTraining: uuid('intercontinental_adventures', 'uSPdZBM1S7VZ0lyy'),
  thickSkulls: uuid('intercontinental_adventures', '03a1UE6KBI1LIHOq'),
  roughAndTakesNoGuff: uuid('sgt_slaughter_sourcebook', '2SHHZs1qVMFBB2kW'),
  brainstorm: uuid('pr_crb', 'iVpoqL7ZY4SK4iLc'),
  gridSpectrumEcho: uuid('across_the_stars', 'R3sNusi5EbBBB88u'),
  spdAsset: uuid('across_the_stars', 'CFK7VW0uFK2dtfCo'),
  prismaticBoon: uuid('across_the_stars', 'z38SPXkEqeuxuypj'),
  iCanDoThat: uuid('jump_through_time', 'e26WbtPYfNCm12LO'),
  iCanStillDoThat: uuid('jump_through_time', 'JgHOsyaD5WR5lgMk'),
  inventiveApplication1: uuid('jump_through_time', 'ubR7N8PYKDMSxmkM'),
  inventiveApplication2: uuid('jump_through_time', 'As1eUnG5W54GwotE'),
  construct: uuid('tf_crb', 'RoA7zBnU4Ke517k6'),
  perpetualPowerSource: uuid('tf_crb', 'zFB2pS1PIJc6gzUE'),
  crossTrainingTf: uuid('tf_crb', 'Swuy85Kou1qbV4H8'),
  manifestMeleeWeapon: uuid('tf_crb', 'MSCVNucCT6yMtptv'),
  expandedArsenal: uuid('tf_crb', 'doPXx4JM7nS998Ue'),
  instrumentsOfDestruction: uuid('tf_crb', 'ybrluGy9norsyiMm'),
  manifestEnhancement: uuid('tf_crb', 'syJ8looy53vONS0X'),
  hintOfIndependence: uuid('decepticon_directive', 'TkzfZUNiGvv5iWDh'),
  minorTweak: uuid('decepticon_directive', 'p07kuAT0RhfjudPo'),
  majorAugments: uuid('decepticon_directive', '0XjyYHChhc0VStRn'),
  extensiveEnhancements: uuid('decepticon_directive', 'UavRPwxwYnLr4BHA'),
  monstrousAttack: uuid('decepticon_directive', 'nDEA1W86XvYR2ab4'),
  neverUnarmed: uuid('decepticon_directive', 'zNRAyM9Y8y13eLhU'),
  volatileDelivery: uuid('decepticon_directive', 'HJd2dd41bj3oY899'),
  augur: uuid('enigma_of_combination', 'yk2MnBePZ5gxOEOj'),
  candle: uuid('mlp_crb', 's0uI9etsaZdaP3xN'),
  torch: uuid('mlp_crb', 'oVB4sfY5HHIEGTA3'),
  headlamp: uuid('knights_of_canterlot', 'm2hiT236MOKHKyvJ'),
  candlespriteLantern: uuid('knights_of_canterlot', 'MhKwWyukMEdzsfRC'),
  glow: uuid('knights_of_canterlot', 'pGXJEVMqygJhFDgn'),
  riotGear: uuid('wtnv_citizens_guide', 'SivYuju5Qcwu3npg'),
  cybertronianMilitary: uuid('field_guide_action_adventure', 'j1EQkzPX3k5HgVMQ'),
  cybertronianWithAttitude: uuid('field_guide_action_adventure', 'me3jAybxn8Smb83w'),
  gridPowerFg: uuid('field_guide_action_adventure', 'atYoqZDXQz1PoDLP'),
  cybertronianPerkFg: uuid('field_guide_action_adventure', 'VoYFiyFRGgMQ7ob0'),
  personalPowerSupply: uuid('field_guide_action_adventure', 'Uy3t5KLbeGHv08ho'),
  factionsEnvoy: uuid('field_guide_action_adventure', 'Y9FmJITVz3nXJQCc'),
  weaponForage: uuid('ferocious_fighters', 'OWVl8HRXBI7mwJ0j'),
  forageFamiliarity: uuid('ferocious_fighters', '2MvQyj4AUcr4QOtU'),
  salvaged: uuid('ferocious_fighters', 'sA8GbXKPcRuPHzNt'),
};

/** Items that make their grant once and then stay done. */
export const ONCE = new Set([
  'customGear', 'primaryTech', 'secondaryTech', 'customizedArmor', 'safetyFirst', 'spottersScope', 'crossTrainingGij', 'crossTrainingTf',
  'splitFocus', 'droneBasicWeapon', 'droneAdvancedWeapon', 'droneSpecializedWeapon', 'animalize', 'standardSkinTempering',
  'limitedSkinTempering', 'restrictedSkinTempering', 'zetaSkinTransplant', 'standardWeaponization', 'limitedWeaponization',
  'martialWeaponization', 'ySeriesWeaponization', 'armed', 'adeptQuickDraw', 'steadyHand', 'branchLeader', 'onTheJobTraining',
  'gridSpectrumEcho', 'spdAsset', 'prismaticBoon', 'inventiveApplication1', 'inventiveApplication2', 'crossTrainingTf', 'hintOfIndependence',
  'monstrousAttack', 'cybertronianMilitary', 'cybertronianWithAttitude', 'gridPowerFg', 'cybertronianPerkFg', 'cordial', 'factionsEnvoy',
]);

const USE_KINDS = new Set([
  ...ONCE, 'forage', 'environmentalWeapon', 'ghillieSuitSniping', 'integratedOffense', 'kitbashEquipment', 'quickbash', 'branchPerk',
  'multifaceted', 'multifacetedHangUp', 'factionReservist', 'fieldPromotion', 'thickSkulls', 'roughAndTakesNoGuff', 'brainstorm',
  'iCanDoThat', 'iCanStillDoThat', 'construct', 'manifestMeleeWeapon', 'manifestEnhancement', 'minorTweak', 'neverUnarmed',
  'volatileDelivery', 'augur', 'candle', 'torch', 'headlamp', 'candlespriteLantern', 'glow', 'riotGear', 'personalPowerSupply',
  'weaponForage',
]);

const BY_SOURCE = Object.fromEntries(Object.entries(GRANT).filter(([kind]) => USE_KINDS.has(kind)).map(([kind, id]) => [id, kind]));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
}

export function grantKindOf(item) {
  return BY_SOURCE[sourceOf(item)] ?? null;
}

export function isGrantUse(item) {
  return !!grantKindOf(item);
}

/**
 * Whether the Use button shows right now.
 * @param {Item} item
 * @returns {Boolean}
 */
export function canUseGrant(item) {
  const kind = grantKindOf(item);
  const actor = item?.parent;
  if (!kind || !actor) {
    return false;
  }

  if (ONCE.has(kind)) {
    return !item.flags?.essence20?.granted;
  }

  const level = Number(actor.system?.level) || 0;
  switch (kind) {
  // "equal to half your Technician level" - more as the Technician levels.
  case 'integratedOffense':
    return (item.flags?.essence20?.grantedCount ?? 0) < Math.floor(level / 2);
  case 'branchPerk':
    return !item.flags?.essence20?.granted;
  case 'ghillieSuitSniping':
    return !item.flags?.essence20?.granted || (!!game.combat && game.combat.round <= 1);
  case 'factionReservist':
    return getUses(actor, 'factionReservist', 'scene') < 1;
  case 'manifestMeleeWeapon':
    return !!game.combat && getUses(actor, 'manifestMeleeWeapon', 'encounter') < 1;
  case 'volatileDelivery':
    return getUses(actor, 'volatileDelivery', 'scene') < 1;
  case 'riotGear':
    return !!game.combat && getUses(actor, 'riotGear', 'scene') < 1;
  case 'personalPowerSupply':
    return (actor.items?.contents ?? [...(actor.items ?? [])]).filter(i => i.type == 'power' && i.system?.type == 'grid').length
        < (Number(actor.system?.powers?.personal?.max) || 0);
  default:
    return true;
  }
}
