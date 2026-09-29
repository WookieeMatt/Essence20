import { extCostRules, findExtUse } from "./extensions.mjs";
import { canUseCompanion, COMP, isCompanionUse } from "./companion-uses.mjs";
import { commandIsMove } from "./companions.mjs";
import { contactKindOf } from "./contacts.mjs";
import { summonKindOf } from "./summons.mjs";
import { teamKindOf } from "./team-actions.mjs";
import { isBondUse } from "./bonded.mjs";
import { BFF, bffsOf, isBffUse } from "./bff.mjs";
import { CMD } from "./commands.mjs";
import { getSceneEpoch as getSceneEpochSafe } from "./scene-clock.mjs";

// Issue Command and Loyal Minions' Use button (helpers/commands.mjs).
const isCommandUse = item => (item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource) == CMD.issueCommand;
import { canUseKit, kitUseKind } from "./kits.mjs";
import { canUseRider, isRiderUse } from "./rider-uses.mjs";
import { canUseGrant, GRANT, isGrantUse } from "./grant-uses.mjs";
import { canUseVehicleUpgrade, useVehicleUpgrade, vehicleUpgradeUse } from "./vehicle-upgrades.mjs";
import { combineWeapons, isCombinedWeapon } from "./combined-weapons.mjs";
import { E20 } from "./config.mjs";
import { getUses, markUsed } from "./scene-clock.mjs";
import { isPowerAdaptationActive } from "./power-adaptation.mjs";
import { isWisdomOfTheEldersActive } from "./wisdom-of-the-elders.mjs";
import { hasChronoTrigger } from "./weapon-upgrades.mjs";
import { WEAPON_USE_IDS } from "./weapon-perk-uses.mjs";

/**
 * The Perks that bend the action economy.
 *
 * helpers/action-economy.mjs is the ledger - what an action costs and what is left. This file is
 * everything a Perk (or an Upgrade, a Feature, a Power) does to that: make one action cheaper, let
 * one Attack action make several attacks, hand out a free attack, or give an ally an action now or
 * on their next turn. action-economy.mjs calls in here; nothing in here writes the ledger itself,
 * which keeps the two apart the same way named-actions.mjs is kept apart from it.
 *
 * Three shapes, one table each:
 *
 * 1. COST_RULES - "you may X as a Free action instead of a Standard action". Matched against what
 *    is being spent (a named action's key, or a kind such as 'attack' or 'conversion'). A rule the
 *    system can verify on its own applies automatically; one that depends on the fiction ("an
 *    action related to Kindness", "a Contingency that will be used to Attack") is OFFERED in a
 *    small dialog, and the player says whether it applies. Picking "normal cost" there is always
 *    possible, because using a once-per-turn discount on the wrong action would waste it.
 *
 * 2. ATTACK_RULES - "you can attack twice, instead of once, when you take the Attack action".
 *    The first qualifying attack pays for the Attack action; the rest ride on it for free (see
 *    action-economy.mjs#consumeForItem).
 *
 * 3. Use buttons - Perks that grant actions on demand (Motivate, Adrenaline Surge...). Listed in
 *    ACTION_PERK_USES and dispatched from banked-buffs.mjs#canUsePerk/onPerkUse like every other
 *    Perk with a Use control.
 *
 * Usage windows: "once per turn" and "once per round" are both counted on the turn's ledger - in
 * Essence20 an actor only acts on its own turn, so the two can't come apart. Once per scene uses
 * the scene clock (helpers/scene-clock.mjs), and once per encounter the encounter clock. "Per day"
 * is counted on the actor and given back by a Rest (resetDailyActionPerkUses).
 */

const ID = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
const GIJ = id => ID('gi_joe_crb', id);
const TF = id => ID('tf_crb', id);
const MLP = id => ID('mlp_crb', id);
const PR = id => ID('pr_crb', id);

export const ACTION_PERK_IDS = {
  // G.I. Joe
  mobility: GIJ('yFwBVeGDHIf3EmGp'),
  superiorAthlete: GIJ('C9HN9cz5Yxxb3jBj'),
  followTheLeader: GIJ('Ksv6Zqg1Km3Gx4iu'),
  quickShield: GIJ('bCUlka9kCmkyKwAC'),
  rousingPresence: GIJ('tF2Gl0OOl2ZgFkZV'),
  vigilance: GIJ('H7qXtrSfxDx2z9Wk'),
  notGettingAwayThatEasy: GIJ('bWJGPyaTU2OPw34y'),
  overwatch: GIJ('YXn7VKSgEXGigNtV'),
  tightBond: GIJ('92993RGDPLq08u1D'),
  instantKillMode: GIJ('JxTGMCJPHgWPQWbJ'),
  snapShots: GIJ('HP7gDs3IaxZ8ud2a'),
  sling: GIJ('oIo9wLE4jZZYfqEv'),
  extraAttack: GIJ('aQjUa46mn4kHvsVO'),
  adrenalineSurge: GIJ('TeCGfRZW9Ax9ajmB'),
  mobilize: GIJ('tLsCk8n8tqhQ6XQf'),
  motivate: GIJ('BB9Z5wEmjIvclAVx'),
  momentum: GIJ('Czabb7MnyglRRo2P'),
  fightOrFlight: GIJ('UpZjnv99mGdT4lLL'),
  aggressive: GIJ('HzbJFluxv3lbg9nx'),
  theHitsKeepComing: GIJ('FGrl4swULa62vet8'),
  deadMansSwitch: GIJ('Qwg8WPHHJ1Cl8M8m'),
  dockingTool: GIJ('8S7Q4MKBuYbTOLH1'),
  aGeniusForAPatient: ID('cobra_codex', 'SvdRlZhhycMM2RJY'),
  shootYouFools: ID('cobra_codex', 'OjNB0uwTOwEQjo85'),
  detailOriented: MLP('FBIg9BWG2CyjqgBP'),
  lookout: GIJ('y7PlJwTFIWQBjJmP'),
  thisIsForMe: ID('sgt_slaughter_sourcebook', 'rbgupnDh25Pij5Gp'),
  forwardGrip: ID('quartermasters_guide_to_gear', '0cgWEY00pB4zLD5z'),
  integratedBipod: ID('quartermasters_guide_to_gear', 'dD0We78dzfsH98Bw'),
  holdTheLine: ID('cobra_codex', 'uU6Q6JPWc3GMRffE'),
  sustainedFire: ID('cobra_codex', 'PE6UeC7BcKIg5peF'),
  heavyHolster: ID('cobra_codex', 'F3L7eF2c07G2B12o'),
  roughAndTough: ID('cobra_codex', 'C3ZHrihM3Ucwokev'),
  ambushPredator: ID('cobra_codex', 'DBNeGHS1WBi7CyuR'),
  shootFirst: ID('cobra_codex', 'QN5iC2K5VaMItBVX'),
  readyForAction: ID('general_hawk_s_personel_files', 'NSweXvUIBdqLiOsz'),
  groundAndPound: ID('general_hawk_s_personel_files', '2qdpoSqrOeBhWF1C'),
  blinkOfAnEye: ID('intercontinental_adventures', '5D4jxcQnpSOWfQMc'),
  hereToHelp: ID('intercontinental_adventures', 'tnkEUHbDaXUaSPME'),
  throwingLead: ID('intercontinental_adventures', '52UZXhcB7XJdcUdT'),
  // Power Rangers
  prExtraAttack: PR('mtwdgpBBU7zNXnTh'),
  zordExtraAttack: PR('9Zp7hPE0xHDCbs77'),
  relentlessBlows: PR('ypRIRuDdxgCJRSPh'),
  tripleStrikeAttacks: PR('hnbSzD1qg9P0RiAH'),
  stealthyMisdirection: PR('fcFhvADLYv9xE0jU'),
  shogunUpgrade: PR('1Bp1o4k9VhkKPXnd'),
  followThrough: ID('across_the_stars', 'QsFiUE0YYjwQHPgh'),
  barrageAttack: ID('through_the_shattered_grid', 'oq4wQuilR0aHwxso'),
  zephyrGrace: ID('through_the_shattered_grid', 'grOi10SLawqjUB8g'),
  // Transformers
  bangBang: TF('IYvmwPoPLXWPpSp5'),
  bangBangBang: TF('LWxBgQtPtnCOD2fn'),
  bulletBarrage: TF('lET3yffxwg5YWXBJ'),
  makeAnOpening: TF('aSJP1DXIH2ZaQbQa'),
  mayhemAttack: TF('kFyggRo3fEFsHqcJ'),
  newPlan: TF('E7Vgx6US6PgS63pe'),
  quickChange: TF('pgWBzR5IRAhucHzo'),
  quickChangeFocus: TF('vNbbACKhZhbz9T54'),
  quickChangeII: TF('Sng7P5DkHMPlxBtq'),
  quickChangeIII: TF('vWK0nmeks2SLUEze'),
  quickStudy: TF('l3PjztNqfgYgLtVg'),
  strategize: TF('Gvh0iaxbcohFtYGe'),
  surfaceInvasion: TF('foFGF3OSzj9NpQ3M'),
  swiftStudy: TF('k9vTsANvhJ6jWAC8'),
  opportunist: ID('enigma_of_combination', 'eKrqFE4vv1PInOZz'),
  quickFix: ID('intercontinental_adventures', 'QbFchvvKkIKRjIVl'),
  quickDraw: TF('p8DTLro2sc2kPYQl'),
  // My Little Pony
  talentForGenerosity: MLP('W4zuPnXnGsb0EE91'),
  talentForHonesty: MLP('adqw9O68ByBpwNwQ'),
  talentForKindness: MLP('SKviFM3gryyTrJV5'),
  talentForLaughter: MLP('rcaZoNtniTFDklY3'),
  talentForLoyalty: MLP('KB7usfPNxRUGRk5S'),
  talentForMagic: MLP('0POa5TuUxinLfFBn'),
  talented: MLP('UGFiK8wMXQ8fhXbT'),
  harmonyUnleashed: MLP('2Xfo11o9Qb2P7s3M'),
  desperateTimes: MLP('tfRFV2g3gkug0l2a'),
  goodExample: MLP('TQE5h6CYfvO6zOvH'),
  hereLetMe: MLP('PldYR4nBQ9zwjBVJ'),
  noIInsist: MLP('yWrCHyJFxQelBJQR'),
  stealthHelper: MLP('iJPzTlcS5A9pjy25'),
  subtleHelper: MLP('kepGfqwF3OgkVgap'),
  laughtracting: MLP('lXIAufB3PnE5a6P8'),
  distraughter: MLP('HjbUGlyY8T9T4ZpH'),
  cannyCombatant: ID('knights_of_canterlot', 'Yk2CE81sRx24gtXl'),
  // Welcome to Night Vale
  newHerd: ID('wtnv_citizens_guide', 'zwm8CrmmYvMj3bMc'),
  leaderInCrisis: ID('wtnv_citizens_guide', 'ly70FgOnHG7IrM1A'),
  biscuitFactory: ID('wtnv_citizens_guide', '0f9ZSctK20tO99Wt'),
  favoriteCommand: ID('wtnv_citizens_guide', 'GeHPKfuWe24HpYcQ'),
  favoritePerson: ID('wtnv_citizens_guide', '6pLg6eMITF2y6k9s'),
};
const P = ACTION_PERK_IDS;

/* -------------------------------------------- */
/*  Lookups                                     */
/* -------------------------------------------- */

/**
 * The actor's copy of an item by compendium source - any item type, since several of these are
 * Upgrades, Features, Powers or Spells rather than Perks (perks.mjs#findPerk only finds Perks).
 * An Upgrade counts wherever it sits: loose on the actor, or embedded as an attachment entry.
 * @param {Actor} actor
 * @param {String} uuid
 * @returns {Item|undefined}
 */
export function findSourced(actor, uuid) {
  return actor?.items?.find?.(item => item.flags?.core?.sourceId == uuid || item._stats?.compendiumSource == uuid);
}

export function hasSourced(actor, uuid) {
  return !!findSourced(actor, uuid);
}

// How far along an advancing Perk is - 1 on first pick, 2 after the next, and so on.
function advances(item) {
  return Math.max(1, Number(item?.system?.advances?.currentValue) || 0);
}

function essence(actor, key) {
  const value = actor?.system?.essences?.[key];
  return Number(typeof value == 'object' ? (value?.value ?? value?.max) : value) || 0;
}

function actorLevel(actor) {
  return Number(actor?.system?.level) || 0;
}

/**
 * The weapon behind an attack - a Weapon Effect's parent Weapon, or null for an unarmed attack.
 * Passed in by the caller where it's known; looked up by the Effect's own parentId flag otherwise.
 */
function parentWeaponOf(actor, item) {
  if (item?.type != 'weaponEffect') {
    return null;
  }

  const parentId = item.getFlag?.('essence20', 'parentId') ?? item.flags?.essence20?.parentId;
  return parentId ? actor?.items?.get?.(parentId) ?? null : null;
}

/**
 * The attack's own shape, for the rules that care which weapon is in hand.
 * @returns {{weapon: ?Item, traits: String[], skill: ?String, melee: Boolean, unarmed: Boolean, size: ?String}}
 */
export function describeAttack(actor, item, weapon = undefined) {
  const parent = weapon === undefined ? parentWeaponOf(actor, item) : weapon;
  return {
    weapon: parent,
    traits: parent?.system?.traits ?? [],
    skill: item?.system?.classification?.skill ?? null,
    melee: item?.system?.classification?.style == 'melee',
    unarmed: item?.type == 'weaponEffect' && !parent,
    size: parent?.system?.size ?? null,
  };
}

/* -------------------------------------------- */
/*  Cost ranking                                */
/* -------------------------------------------- */

// Cheapest first. 'twoFree' (Canny Combatant, Snap Shots) sits between one Free and a Move.
const COST_RANK = ['none', 'free', 'twoFree', 'move', 'standard', 'contingency', 'standardAndMove', 'fullAction', 'wholeTurn'];

function rank(actionType) {
  const index = COST_RANK.indexOf(actionType);
  return index < 0 ? COST_RANK.length : index;
}

// Talents: "treat a Standard action ... as a Move action, or a Move action as a Free action. Free
// actions related to [it] take no actions for you."
function downgrade(actionType) {
  return { standard: 'move', contingency: 'move', move: 'free', free: 'none' }[actionType] ?? actionType;
}

/* -------------------------------------------- */
/*  1. Cost rules                               */
/* -------------------------------------------- */

/**
 * Each rule: {id, has(actor), matches(ctx), to(actionType, ctx, ledger, actor), limit?, ask?}.
 *   ctx      {key} for a named action (E20.namedActions), or {kind, item, attack} otherwise.
 *   to       the action type to pay instead; a rule that returns the same or a dearer type is
 *            simply not offered.
 *   limit    {window: 'turn'|'scene'|'encounter', max: Number|fn(actor)} - omitted = unlimited.
 *   ask      a localization key for the question the player answers - omitted = applies itself.
 *   blocks   rule ids this one shares a limit with (Mobility's once per turn covers Sprint AND Hide).
 */
const TALENTS = [
  ['talentForGenerosity', 'E20.ActionPerkAskGenerosity'],
  ['talentForHonesty', 'E20.ActionPerkAskHonesty'],
  ['talentForKindness', 'E20.ActionPerkAskKindness'],
  ['talentForLaughter', 'E20.ActionPerkAskLaughter'],
  ['talentForLoyalty', 'E20.ActionPerkAskLoyalty'],
  ['talentForMagic', 'E20.ActionPerkAskMagic'],
];

const perk = key => actor => hasSourced(actor, P[key]);
const named = (...keys) => ctx => keys.includes(ctx?.key);
const kind = (...kinds) => ctx => kinds.includes(ctx?.kind);
const always = to => () => to;

export const COST_RULES = [
  // A Hint of Independence's Slow Conversion (Decepticon Directive, Table 2-11): "Converting Modes takes
  // an entire turn's worth of your actions."
  { id: 'slowConversion', has: actor => actor?.items?.find?.(i => (i.flags?.core?.sourceId ?? i._stats?.compendiumSource) == GRANT.hintOfIndependence)?.flags?.essence20?.imperfection?.n == 6, matches: kind('conversion'), to: always('wholeTurn') },
  // Quick Draw (Cobra Codex, Trooper, 3rd level, p.52): "you can draw and stow your Adept Armaments as
  // if they were one size smaller. For example, you could draw a medium weapon as a Free Action like a
  // sidearm, instead of a Move Action." Which weapon is being drawn is asked.
  { id: 'adeptQuickDraw', has: actor => hasSourced(actor, GRANT.adeptQuickDraw), matches: named('drawWeapon'), to: always('free'), ask: 'E20.ActionPerkAskAdeptDraw' },
  // Favorite Command (Animal Perk): "You can Command your animal pet to perform this Skill as a Move
  // action instead of a Standard action." An Attack pet is "Commanded to Attack as a Move action".
  { id: 'favoriteCommand', has: actor => commandIsMove(actor), matches: named('commandPet'), to: always('move'), ask: 'E20.ActionPerkAskFavoriteCommand' },
  // BFF (MLP CRB, Spirit of Loyalty, 3rd level): "You can Lend Assistance to a BFF as a Free action once
  // per round."
  { id: 'bffAssist', has: actor => hasSourced(actor, BFF.bff) && bffsOf(actor).length > 0, matches: named('lendAssistance'), to: always('free'), ask: 'E20.ActionPerkAskBff', limit: { window: 'turn', max: 1 } },
  // Prowl (Mini-Con Perk, Decepticon Directive p.67): "This Mini-Con can attempt an Infiltration Skill
  // Test to sneak or hide as a Free action."
  { id: 'prowl', has: actor => actor?.type == 'companion' && hasSourced(actor, COMP.prowl), matches: named('hide'), to: always('free') },
  // Accelerate Conversion (Field Guide p.70): "Once per scene, you may spend 1 Personal Power or Energon
  // Point to Convert as a Free action" - paid from its Use button, which readies this.
  { id: 'accelerateConversion', has: actor => actor?.flags?.essence20?.accelerateConvert === getSceneEpochSafe(), matches: kind('conversion'), to: always('free'), limit: { window: 'scene', max: 1 } },
  // Mobility (GI Joe CRB, Commando, p.73): "Once per turn, you may now Sprint or Hide as a Free action."
  { id: 'mobility', has: perk('mobility'), matches: named('sprint', 'hide'), to: always('free'), limit: { window: 'turn', max: 1 } },
  // Superior Athlete (GI Joe CRB, Blitzer, 10th level, p.98): "You may Sprint as a free action once per turn."
  { id: 'superiorAthlete', has: perk('superiorAthlete'), matches: named('sprint'), to: always('free'), limit: { window: 'turn', max: 1 } },
  // Follow The Leader (GI Joe CRB, Frontline Leader, p.87): "if one of your teammates is ahead of you
  // on the battlefield at the beginning of your turn, you can Sprint as a Free action." Who is
  // "ahead" is a battlefield judgement, so it's asked.
  { id: 'followTheLeader', has: perk('followTheLeader'), matches: named('sprint'), to: always('free'), ask: 'E20.ActionPerkAskTeammateAhead' },
  // Canny Combatant (Knights of Canterlot, Fighter): "you can always spend two Free actions to
  // Defend instead of using a Standard action." A choice, not a discount - offered, never forced.
  { id: 'cannyCombatant', has: perk('cannyCombatant'), matches: named('defend'), to: always('twoFree'), ask: 'E20.ActionPerkAskTwoFree' },
  // Here To Help (Intercontinental Adventures, p.102): "The first time you Lend Assistance on your
  // turn in Combat, it costs a Free action. The second time, it costs a Move action. The third
  // time, it costs a Standard action."
  {
    id: 'hereToHelp', has: perk('hereToHelp'), matches: named('lendAssistance'),
    to: (type, ctx, ledger) => ['free', 'move'][(ledger?.log ?? []).filter(e => e.namedKey == 'lendAssistance').length] ?? type,
  },
  // Desperate Times (MLP CRB, Spirit of Generosity, 15th level, p.75): "you can use a Move action
  // instead of a Standard action to Lend Assistance, but only if you have already used your
  // Standard action to Lend Assistance this round."
  {
    id: 'desperateTimes', has: perk('desperateTimes'), matches: named('lendAssistance'),
    to: (type, ctx, ledger) => (ledger?.log ?? []).some(e => e.namedKey == 'lendAssistance' && e.cost?.standard) ? 'move' : type,
  },
  // Good Example (MLP CRB, Spirit of Honesty, 13th level, p.79): "you can Lend Assistance on
  // Persuasion Skill Tests to your friends as a Free action." The skill is chosen after the cost
  // is paid, so it's asked.
  { id: 'goodExample', has: perk('goodExample'), matches: named('lendAssistance'), to: always('free'), ask: 'E20.ActionPerkAskPersuasion' },
  // Favorite Person (Welcome to Night Vale, Animal Perk): the pet Lends Assistance as a Free action.
  { id: 'favoritePerson', has: perk('favoritePerson'), matches: named('lendAssistance'), to: always('free') },
  // A.I. / Autopilot / Computerized (GI Joe CRB, Vehicle Traits, p.172): the vehicle's computers
  // Lend Assistance as a Free action.
  {
    id: 'vehicleAssist', has: actor => actor?.type == 'vehicle' && ['ai', 'autopilot', 'computerized'].some(t => actor.system?.traits?.includes?.(t)),
    matches: named('lendAssistance'), to: always('free'),
  },
  // Vigilance (GI Joe CRB, Vanguard, 11th level, p.109) / Not Getting Away That Easy (p.97): "you
  // can take a Contingency action as a Free action, but it can only be used to take the Attack
  // action against an enemy you can see that enters your range or reach."
  { id: 'vigilance', has: perk('vigilance'), matches: named('contingency'), to: always('free'), ask: 'E20.ActionPerkAskContingencyAttack' },
  { id: 'notGettingAwayThatEasy', has: perk('notGettingAwayThatEasy'), matches: named('contingency'), to: always('free'), ask: 'E20.ActionPerkAskContingencyAttack' },
  // Overwatch (GI Joe CRB, Infantry, 9th level, p.80): an extra Standard action each turn that can
  // only be a Contingency - modelled as one Contingency per turn that costs nothing.
  { id: 'overwatch', has: perk('overwatch'), matches: named('contingency'), to: always('none'), limit: { window: 'turn', max: 1 } },
  // Make An Opening (TF CRB, Scout Outrider, 20th level, p.91): "once per turn, you can take a
  // Contingency action to Attack as a Free action."
  { id: 'makeAnOpening', has: perk('makeAnOpening'), matches: named('contingency'), to: always('free'), ask: 'E20.ActionPerkAskContingencyAttack', limit: { window: 'turn', max: 1 } },
  // Strategize (TF CRB, Leader Strategist, p.66) / Leader in Crisis (Welcome to Night Vale,
  // Politician): "set a number of Contingency actions as Free actions up to your Smarts [Social]."
  { id: 'strategize', has: perk('strategize'), matches: named('contingency'), to: always('free'), limit: { window: 'turn', max: actor => essence(actor, 'smarts') } },
  { id: 'leaderInCrisis', has: perk('leaderInCrisis'), matches: named('contingency'), to: always('free'), limit: { window: 'turn', max: actor => essence(actor, 'social') } },
  // Tight Bond (GI Joe CRB, Beastmaster, 3rd level, p.92): "once per turn, you can command your pet
  // as a Free action. At 6th level, and every 3 levels thereafter ... an additional time per turn."
  {
    id: 'tightBond', has: perk('tightBond'), matches: named('commandPet'), to: always('free'),
    limit: { window: 'turn', max: actor => 1 + Math.max(0, Math.floor((actorLevel(actor) - 3) / 3)) },
  },
  // New Herd (Welcome to Night Vale, Rancher Farmer): "You can attempt Animal Handling Skill Tests as
  // a Move action during conflict." Commanding a pet is that test.
  { id: 'newHerd', has: perk('newHerd'), matches: named('commandPet'), to: always('move') },
  // Favorite Command (Welcome to Night Vale, Animal Perk): the pet's chosen Command is a Move action.
  { id: 'favoriteCommand', has: perk('favoriteCommand'), matches: named('commandPet'), to: always('move'), ask: 'E20.ActionPerkAskFavoriteCommand' },
  // Biscuit Factory (Welcome to Night Vale, Animal Perk): "Your pet can spend its Move action to
  // attack" - on the pet's own attacks.
  { id: 'biscuitFactory', has: perk('biscuitFactory'), matches: kind('attack'), to: always('move') },
  // Quick Fix (Intercontinental Adventures, Wrench Jockey, p.70): "Once per turn, you can repair a
  // vehicle as a Free action instead of a Standard action."
  { id: 'quickFix', has: perk('quickFix'), matches: kind('vehicleRepair'), to: always('free'), limit: { window: 'turn', max: 1 } },
  // Quick Draw (TF CRB, Gunslinger, 1st level, p.70): "you can switch two hands of weapons between
  // your External Hardpoints as a Free action."
  { id: 'quickDraw', has: perk('quickDraw'), matches: named('drawWeapon'), to: always('free') },
  // Quick Change (TF CRB, General Perk p.111 / Focus p.73) and II/III: one chosen conversion
  // sequence per copy becomes a Free action. Which sequences were chosen isn't recorded anywhere,
  // so the player confirms this is one of them.
  {
    id: 'quickChange', has: actor => ['quickChange', 'quickChangeFocus', 'quickChangeII', 'quickChangeIII'].some(k => hasSourced(actor, P[k])),
    matches: kind('conversion'), to: always('free'), ask: 'E20.ActionPerkAskQuickChange',
  },
  // Quick Study (TF CRB, Analyst, 7th level, p.60): "using Analyze Target is a Move action." Swift
  // Study (18th level): "a Free action. You can use any number of Free actions on Analyze Target in
  // a single turn."
  { id: 'quickStudy', has: perk('quickStudy'), matches: kind('analyzeTarget'), to: always('move') },
  { id: 'swiftStudy', has: perk('swiftStudy'), matches: kind('analyzeTarget'), to: always('free') },
  // Rousing Presence (GI Joe CRB, Officer, 15th level, p.86): "your Rouse ability takes a Move action
  // instead of a Standard action."
  { id: 'rousingPresence', has: perk('rousingPresence'), matches: kind('rouse'), to: always('move') },
  // Quick Shield (GI Joe CRB, Vanguard, 7th level, p.109): "activate your personal shield with a Free
  // action on your turn."
  { id: 'quickShield', has: perk('quickShield'), matches: kind('personalShield'), to: always('free') },
  // Hold The Line (Cobra Codex, p.68): "you can raise and lower your shield as a Free action."
  { id: 'holdTheLine', has: perk('holdTheLine'), matches: kind('shieldToggle'), to: always('free') },
  // Sustained Fire (Cobra Codex, p.81) / Forward Grip (Quartermaster's Guide, p.34): Bracing is a
  // Free action instead of a Move action.
  { id: 'sustainedFire', has: perk('sustainedFire'), matches: named('brace'), to: always('free') },
  { id: 'forwardGrip', has: perk('forwardGrip'), matches: named('brace'), to: always('free') },
  // Heavy Holster (Cobra Codex, armor upgrade, p.100): "draw and stow a Medium weapon as a Free
  // action instead of the usual Move action." Sling (GI Joe CRB, weapon upgrade, p.148): "Draw ...
  // a medium weapon as a Free action."
  { id: 'heavyHolster', has: perk('heavyHolster'), matches: named('drawWeapon'), to: always('free'), ask: 'E20.ActionPerkAskMediumWeapon' },
  { id: 'sling', has: perk('sling'), matches: named('drawWeapon'), to: always('free'), ask: 'E20.ActionPerkAskMediumWeapon' },
  // Instant Kill Mode (GI Joe CRB, Heavy Ordnance, 17th level, p.105): "Once per mission, you can
  // attack as a Free action for 1 turn" - switched on by its Use button for the current turn.
  { id: 'instantKillMode', has: actor => isInstantKillModeActive(actor), matches: kind('attack'), to: always('free') },
  // Snap Shots (GI Joe CRB, General Perk, p.134): "When you Attack with a pistol or thrown Finesse
  // weapon, you may spend 2 of your Free actions to make an additional Attack with the same type of
  // weapon once per turn." Offered once an Attack with such a weapon has already been made.
  {
    id: 'snapShots', has: perk('snapShots'), limit: { window: 'turn', max: 1 }, ask: 'E20.ActionPerkAskSnapShots',
    matches: ctx => ctx?.kind == 'attack' && isSnapShotWeapon(ctx.attack),
    to: (type, ctx, ledger) => (ledger?.log ?? []).some(e => e.snapShotWeapon) ? 'twoFree' : type,
  },
  // Ground and Pound (Hawk's Personnel Files, p.174): "You can make Unarmed attacks against this
  // target as Free actions" once its Use button has boxed a Prone target in. Counted, because each
  // attack "suffers a Downshift for each attack that came before it in this turn" (dice.mjs).
  {
    id: 'groundAndPound', has: actor => isGroundAndPoundActive(actor), limit: { window: 'turn', max: 99 },
    matches: ctx => ctx?.kind == 'attack' && !!ctx.attack?.unarmed, to: always('free'),
  },
  // This Is For Me (Sgt. Slaughter Sourcebook, 3rd level, p.12): after an unarmed Attack that beats
  // Defense by 5, or a successful grapple/shove/trip, the follow-up is a Move action.
  { id: 'thisIsForMe', has: perk('thisIsForMe'), matches: ctx => ctx?.kind == 'attack' && !!ctx.attack?.unarmed, to: always('move'), ask: 'E20.ActionPerkAskThisIsForMe' },
  // Dead Man's Switch (GI Joe CRB, Demolitionist, 7th level, p.81): "you may activate explosives in
  // your equipment as a Free action on your turn."
  { id: 'deadMansSwitch', has: perk('deadMansSwitch'), matches: ctx => ctx?.kind == 'attack' && ctx.item?.system?.classification?.style == 'explosive', to: always('free'), ask: 'E20.ActionPerkAskDetonate' },
  // Opportunist (Enigma of Combination, p.41): "you are allowed to set up a single Contingency action
  // when you test Initiative at the beginning of a combat."
  { id: 'opportunist', has: perk('opportunist'), matches: named('contingency'), to: always('none'), ask: 'E20.ActionPerkAskInitiative', limit: { window: 'encounter', max: 1 } },
  // Ninja Powered - Stealthy Misdirection (PR CRB, Zord Feature, p.138): "Can take the Defend action as
  // part of any move action that is more than 20 feet." Upgraded Zord - Shogun Upgrade (p.138):
  // "ability to Defend as a Free action".
  { id: 'stealthyMisdirection', has: perk('stealthyMisdirection'), matches: named('defend'), to: always('none'), ask: 'E20.ActionPerkAskLongMove' },
  { id: 'shogunUpgrade', has: perk('shogunUpgrade'), matches: named('defend'), to: always('free') },
  // The Use a Skill action (GI Joe CRB p.192, a Standard action) made cheaper for particular tests.
  // Detail Oriented (MLP CRB, Precise Origin, p.58): "When you make a Finesse Skill Test you may
  // choose to use either a Move or a Standard Action for the Test. You may use this Perk three
  // times/day."
  {
    id: 'detailOriented', has: perk('detailOriented'), matches: named('useASkill'), to: always('move'),
    ask: 'E20.ActionPerkAskFinesse', limit: { window: 'day', max: 3 },
  },
  // Docking Tool (GI Joe CRB, drone upgrade, p.168): "The drone can connect to adjacent technology and
  // make Technology Skill Tests that would normally be Standard actions as Move actions."
  { id: 'dockingTool', has: perk('dockingTool'), matches: named('useASkill'), to: always('move'), ask: 'E20.ActionPerkAskDocked' },
  // A Genius For A Patient (Cobra Codex, Dr. Mindbender, 10th level, p.65): "Once per turn, you can
  // make a Science Skill Test to heal your own wounds as a Free action instead of a Standard action."
  {
    id: 'aGeniusForAPatient', has: perk('aGeniusForAPatient'), matches: named('useASkill'), to: always('free'),
    ask: 'E20.ActionPerkAskSelfHeal', limit: { window: 'turn', max: 1 },
  },
  // Balance Your Enthusiasm (MLP CRB, Spirit of Loyalty, p.91): Curb Your Enthusiasm as a Move
  // action instead of a Standard action.
  {
    id: 'balanceYourEnthusiasm', has: perk('balanceYourEnthusiasm'), to: always('move'),
    matches: ctx => ctx?.kind == 'item' && /curb your enthusiasm/i.test(ctx.item?.name ?? ''),
  },
  // Harmony Unleashed (MLP CRB, spell, p.139): Cutie-Mark-related actions become Free actions for 3
  // rounds - switched on when the spell is cast.
  {
    id: 'harmonyUnleashed', has: actor => isHarmonyUnleashedActive(actor), to: always('free'),
    matches: ctx => !!ctx, ask: 'E20.ActionPerkAskCutieMark',
  },
  // A Talent for <Spirit> (MLP CRB, each Spirit's 1st-level Role Perk): "Once per round, treat a
  // Standard action related to <Spirit> as a Move action, or a Move action as a Free action. Free
  // actions related to <Spirit> take no actions for you."
  ...TALENTS.map(([key, ask]) => ({
    id: key, has: perk(key), matches: ctx => !!ctx, ask, to: type => downgrade(type),
    limit: { window: 'turn', max: 1, freeIsUnlimited: true },
  })),
  // Talented (MLP CRB, General Perk, p.125): the same downgrade, once per scene, for your Talent.
  {
    id: 'talented', has: perk('talented'), matches: ctx => !!ctx, ask: 'E20.ActionPerkAskTalent', to: type => downgrade(type),
    limit: { window: 'scene', max: 1 },
  },
];

function isSnapShotWeapon(attack) {
  return !!attack && (attack.size == 'sidearm' || (attack.traits.includes('thrown') && attack.skill == 'finesse'));
}

/**
 * How many times a rule has been used in its window.
 */
const DAILY_FLAG = 'actionPerkDailyUses';

function usesOf(actor, rule, ledger) {
  if (!rule.limit) {
    return 0;
  }

  if (rule.limit.window == 'turn') {
    return ledger?.perkUses?.[rule.id] ?? 0;
  }

  if (rule.limit.window == 'day') {
    return actor?.getFlag?.('essence20', DAILY_FLAG)?.[rule.id] ?? 0;
  }

  return getUses(actor, `actionPerk.${rule.id}`, rule.limit.window);
}

/**
 * A Rest is the new day: every "per day" action discount is available again. Called from the
 * sheet's Rest action alongside the nanomite powers' own daily reset.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether anything had been used.
 */
export async function resetDailyActionPerkUses(actor) {
  const used = actor?.getFlag?.('essence20', DAILY_FLAG);
  if (!used || !Object.keys(used).length) {
    return false;
  }

  await actor.unsetFlag('essence20', DAILY_FLAG);
  return true;
}

function limitOf(actor, rule) {
  const max = rule.limit?.max;
  return typeof max == 'function' ? max(actor) : max ?? Infinity;
}

/**
 * Every cheaper way this actor could pay for this action right now.
 * @param {Actor} actor
 * @param {String} actionType   What the action normally costs.
 * @param {Object} ctx          {key} or {kind, item, attack}.
 * @param {Object} ledger       The actor's current ledger.
 * @returns {{auto: ?Object, offers: Object[]}}   Each option: {rule, actionType, label, question}.
 */
export function getCostOptions(actor, actionType, ctx, ledger) {
  const options = [];
  const asking = promptsEnabled();
  for (const rule of [...COST_RULES, ...extCostRules()]) {
    if (!rule.has(actor) || !rule.matches(ctx)) {
      continue;
    }

    if (rule.ask && !asking) {
      continue;
    }

    const to = rule.to(actionType, ctx, ledger, actor);
    if (!to || rank(to) >= rank(actionType)) {
      continue;
    }

    // A Talent's "Free actions ... take no actions" has no once-per-round cap; only its
    // Standard->Move and Move->Free halves do.
    const limited = rule.limit && !(rule.limit.freeIsUnlimited && actionType == 'free');
    if (limited && usesOf(actor, rule, ledger) >= limitOf(actor, rule)) {
      continue;
    }

    options.push({
      rule, actionType: to, counts: !!limited,
      label: labelFor(actor, rule),
      question: rule.ask ? game.i18n.localize(rule.ask) : null,
    });
  }

  options.sort((a, b) => rank(a.actionType) - rank(b.actionType));
  const auto = options.find(option => !option.question) ?? null;
  const offers = options.filter(option => option.question && (!auto || rank(option.actionType) < rank(auto.actionType)));
  return { auto, offers };
}

// The per-client "ask me about situational discounts" switch - see settings.js. On unless turned off.
function promptsEnabled() {
  try {
    return game.settings.get('essence20', 'actionPerkPrompts') !== false;
  } catch {
    return true;
  }
}

function labelFor(actor, rule) {
  if (rule.label) {
    return rule.label;
  }

  const uuid = P[rule.id];
  return findSourced(actor, uuid)?.name ?? game.i18n.localize(`E20.ActionPerk.${rule.id}`);
}

function costLabel(actionType) {
  if (actionType == 'twoFree') {
    return game.i18n.localize('E20.ActionTypeTwoFree');
  }

  if (actionType == 'none') {
    return game.i18n.localize('E20.ActionPerkNoCost');
  }

  return game.i18n.localize(E20.actionTypes[actionType] ?? actionType);
}

/**
 * Decide what this action actually costs, asking the player when a cheaper option depends on the
 * fiction. Returns null when the player closes the dialog - the action isn't taken at all.
 * @returns {Promise<{actionType: String, option: ?Object}|null>}
 */
export async function resolveCost(actor, actionType, ctx, ledger) {
  const { auto, offers } = getCostOptions(actor, actionType, ctx, ledger);
  if (!offers.length) {
    return { actionType: auto?.actionType ?? actionType, option: auto };
  }

  const base = auto ?? { actionType, rule: null, label: null };
  const buttons = [
    {
      action: 'base', default: true,
      label: base.rule
        ? game.i18n.format('E20.ActionPerkPayVia', { cost: costLabel(base.actionType), source: base.label })
        : game.i18n.format('E20.ActionPerkPayNormal', { cost: costLabel(actionType) }),
    },
    ...offers.map((offer, index) => ({
      action: `offer${index}`,
      label: game.i18n.format('E20.ActionPerkPayVia', { cost: costLabel(offer.actionType), source: offer.label }),
    })),
  ];
  const questions = offers.map(offer => `<li><b>${foundry.utils.escapeHTML(offer.label)}:</b> ${offer.question}</li>`).join('');

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ActionPerkDialogTitle') },
    classes: ["window-app", "e20-window"],
    position: { width: 420 },
    content: `<p>${game.i18n.format('E20.ActionPerkDialogIntro', { name: actor.name })}</p><ul>${questions}</ul>`,
    buttons,
    rejectClose: false,
  });

  if (!choice) {
    return null;
  }

  if (choice == 'base') {
    return { actionType: base.actionType, option: base.rule ? base : null };
  }

  const offer = offers[Number(choice.replace('offer', ''))];
  return { actionType: offer.actionType, option: offer };
}

/**
 * Count one use of the rule that paid for an action. Turn-window uses go on the ledger the caller is
 * about to write; scene/encounter uses are stamped on the actor.
 */
export async function recordRuleUse(actor, option, ledger) {
  if (!option?.rule || !option.counts) {
    return;
  }

  const { rule } = option;
  if (rule.limit.window == 'turn') {
    ledger.perkUses = { ...(ledger.perkUses ?? {}), [rule.id]: (ledger.perkUses?.[rule.id] ?? 0) + 1 };
    return;
  }

  if (rule.limit.window == 'day') {
    const used = actor.getFlag?.('essence20', DAILY_FLAG) ?? {};
    await actor.setFlag('essence20', DAILY_FLAG, { ...used, [rule.id]: (used[rule.id] ?? 0) + 1 });
    return;
  }

  await markUsed(actor, `actionPerk.${rule.id}`, { window: rule.limit.window });
}

/* -------------------------------------------- */
/*  2. Several attacks per Attack action        */
/* -------------------------------------------- */

/**
 * Each: {id, count(actor) -> total attacks, has(actor), filter}. count is the TOTAL number of
 * attacks one Attack action makes; filter (see attackMatchesFilter) says which weapons it works
 * with, and the free attacks that follow must match it too. The best one applies.
 */
export const ATTACK_RULES = [
  // Extra Attack (GI Joe CRB, Infantry/Vanguard, 5th level+): "(2 attacks)", then 3 and 4 as it
  // advances.
  { id: 'extraAttack', count: actor => 1 + advances(findSourced(actor, P.extraAttack)), has: perk('extraAttack'), filter: null },
  // Extra Attack (PR CRB, every Role, p.34): "you can attack twice, instead of once, whenever you take
  // the Attack action on your turn. This Role Perk only functions while Morphed and fighting as an
  // individual." "Extra Attack (2)" at the later level makes it three.
  {
    id: 'prExtraAttack', count: actor => 1 + advances(findSourced(actor, P.prExtraAttack)),
    has: actor => hasSourced(actor, P.prExtraAttack) && !!actor.system?.isMorphed, filter: null,
  },
  // Rough and Tough (Cobra Codex, Primal Feral, p.60): twice at 10th level, three times at 20th.
  { id: 'roughAndTough', count: actor => (actorLevel(actor) >= 20 ? 3 : 2), has: perk('roughAndTough'), filter: null },
  // Bang Bang / Bang Bang Bang (TF CRB, Gunner, 7th/18th level, p.68-69): "attack twice [three
  // times] instead of once when you use the Attack action to attack with a ballistic weapon."
  { id: 'bangBang', count: () => 2, has: perk('bangBang'), filter: { ballistic: true } },
  { id: 'bangBangBang', count: () => 3, has: perk('bangBangBang'), filter: { ballistic: true } },
  // Throwing Lead (Intercontinental Adventures, p.71): two attacks per Attack action with Ballistic
  // or Computerized weapons.
  { id: 'throwingLead', count: () => 2, has: perk('throwingLead'), filter: { ballisticOrComputerized: true } },
  // Blink of an Eye (Intercontinental Adventures, Arashikage, 6th level, p.13): "Attack twice ...
  // with a Silent Martial Arts weapon."
  { id: 'blinkOfAnEye', count: () => 2, has: perk('blinkOfAnEye'), filter: { silentMartialArts: true } },
  // Extra Attack (PR CRB, Zord Feature, p.137): one more melee attack per Attack action.
  { id: 'zordExtraAttack', count: () => 2, has: perk('zordExtraAttack'), filter: { melee: true } },
  // Bullet Barrage (TF CRB, Gunslinger, 20th level, p.70): "use an Attack action to fire each of your
  // ballistic weapons in an External Hardpoint once, without penalty."
  {
    id: 'bulletBarrage', has: perk('bulletBarrage'), filter: { ballistic: true },
    count: actor => Math.max(1, (actor.items ?? []).filter(i => i.type == 'weapon' && i.system?.equipped && i.system?.traits?.includes('ballistic')).length),
  },
  // Power Adaptation - Fast Trigger (Across the Stars, p.57): "Make one additional ranged Attack per
  // Attack action"; Wisdom of the Elders - Ferocious Strikes (Through the Shattered Grid, p.73): "one
  // additional melee Attack per Attack action". While switched on; they add to Extra Attack rather
  // than competing with it.
  // Chrono-Trigger (A Jump Through Time p.69): "Multiple Attacks (3, ↓2)" with that sidearm; the ↓2
  // is dice.mjs's own source.
  { id: 'chronoTrigger', count: () => 3, has: () => true, filter: { chronoTrigger: true } },
  { id: 'fastTrigger', additional: 1, has: actor => isPowerAdaptationActive(actor, 'fastTrigger'), filter: { ranged: true } },
  { id: 'ferociousStrikes', additional: 1, has: actor => isWisdomOfTheEldersActive(actor, 'ferociousStrikes'), filter: { melee: true } },
];

/**
 * How many attacks one Attack action makes with this attack, and what grants it.
 * @returns {{count: Number, source: ?String}}
 */
export function getAttacksPerAction(actor, item, attack = describeAttack(actor, item)) {
  let best = { count: 1, source: null, filter: null };
  const extras = [];
  for (const rule of ATTACK_RULES) {
    if (!rule.has(actor) || !attackMatchesFilter(rule.filter, attack)) {
      continue;
    }

    if (rule.additional) {
      extras.push(rule);
      continue;
    }

    const count = rule.count(actor);
    if (count > best.count) {
      best = { count, source: findSourced(actor, P[rule.id])?.name ?? rule.id, filter: rule.filter };
    }
  }

  for (const rule of extras) {
    best = {
      count: best.count + rule.additional,
      source: best.source ?? game.i18n.localize(`E20.ActionPerk.${rule.id}`),
      filter: best.filter ?? rule.filter,
    };
  }

  return best;
}

/**
 * Whether a free attack (a chain from the Attack action, or a granted bonus attack) can be spent
 * on this attack.
 * @param {Object} filter   {ballistic, melee, unarmed, might, silentMartialArts} - all optional.
 */
export function attackMatchesFilter(filter, attack) {
  if (!filter || !attack) {
    return true;
  }

  const checks = {
    ballistic: () => attack.traits.includes('ballistic'),
    ballisticOrComputerized: () => ['ballistic', 'computerized'].some(t => attack.traits.includes(t)),
    melee: () => attack.melee,
    ranged: () => !attack.melee,
    mightOrFinesse: () => ['might', 'finesse'].includes(attack.skill),
    chronoTrigger: () => hasChronoTrigger(attack.weapon),
    unarmed: () => attack.unarmed,
    mightMelee: () => attack.melee && attack.skill == 'might',
    silentMartialArts: () => attack.traits.includes('silent') && attack.traits.includes('martialArts'),
  };

  return Object.entries(filter).every(([key, wanted]) => !wanted || !checks[key] || checks[key]());
}

/* -------------------------------------------- */
/*  Timed switches                              */
/* -------------------------------------------- */

const INSTANT_KILL_FLAG = 'instantKillModeTurn';
const GROUND_AND_POUND_FLAG = 'groundAndPoundTurn';
const HARMONY_FLAG = 'harmonyUnleashedUntil';

export function isInstantKillModeActive(actor) {
  const stamp = actor?.getFlag?.('essence20', INSTANT_KILL_FLAG);
  const combat = game?.combat;
  return !!stamp && !!combat && stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn;
}

export function isGroundAndPoundActive(actor) {
  const stamp = actor?.getFlag?.('essence20', GROUND_AND_POUND_FLAG);
  const combat = game?.combat;
  return !!stamp && !!combat && stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn;
}

export function isHarmonyUnleashedActive(actor) {
  const stamp = actor?.getFlag?.('essence20', HARMONY_FLAG);
  const combat = game?.combat;
  return !!stamp && !!combat && stamp.combatId == combat.id && combat.round <= stamp.untilRound;
}

/* -------------------------------------------- */
/*  3. Use buttons                              */
/* -------------------------------------------- */

/**
 * Perks whose Use button grants actions. `self` grants go to the user of the Perk; `ally` grants go
 * to the one token the player is targeting.
 *
 *   cost        what using the Perk itself costs (a named action type), if anything
 *   now         actions granted immediately: {standard, move, free, fullTurn}
 *   nextTurn    actions granted at the start of the recipient's next turn
 *   bonusAttack a free attack granted now: {cost, filter}
 *   limit       {window, max}
 *   available   fn(actor) - extra precondition for the button to show
 */
export const ACTION_PERK_USES = {
  // Motivate (GI Joe CRB, Officer, 14th level, p.86): "as a Standard action, you may grant an ally an
  // immediate Standard action."
  [P.motivate]: { id: 'motivate', target: 'ally', cost: 'standard', now: { standard: 1 } },
  // Mobilize (GI Joe CRB, Officer, 5th level, p.85): "as a Move action, you may grant an ally within line
  // of sight an immediate Move action."
  [P.mobilize]: { id: 'mobilize', target: 'ally', cost: 'move', now: { move: 1 } },
  // Momentum (GI Joe CRB, Officer, 18th level, p.86): "as a Standard action, you may grant an ally an
  // immediate bonus turn."
  [P.momentum]: { id: 'momentum', target: 'ally', cost: 'standard', now: { fullTurn: true } },
  // Adrenaline Surge (GI Joe CRB, Infantry, 13th level, p.80): once per combat, take an extra turn.
  [P.adrenalineSurge]: { id: 'adrenalineSurge', target: 'self', now: { fullTurn: true }, limit: { window: 'encounter', max: 1 } },
  // Instant Kill Mode - see the cost rule above. "Once per mission" has no clock of its own; the
  // encounter is the narrowest window that can't be abused turn over turn.
  [P.instantKillMode]: { id: 'instantKillMode', target: 'self', switchOn: INSTANT_KILL_FLAG, limit: { window: 'encounter', max: 1 } },
  // Aggressive (GI Joe CRB, Renegade, p.95): "spend a Story Point once per turn to move up to your full
  // Movement Rating in addition to your Move action."
  [P.aggressive]: { id: 'aggressive', target: 'self', storyPoint: true, now: { move: 1 }, limit: { window: 'turn', max: 1 } },
  // Shoot First (Cobra Codex, Renegade, p.60): "spend a Story Point when you roll Initiative to
  // Attack a target within range."
  [P.shootFirst]: { id: 'shootFirst', target: 'self', storyPoint: true, bonusAttack: { cost: 'none' }, limit: { window: 'encounter', max: 1 } },
  // Ready for Action (Hawk's Personnel Files, p.174): "If you are first in Initiative Order, you can
  // make one Attack Skill Test as a Free action once in the first round."
  [P.readyForAction]: {
    id: 'readyForAction', target: 'self', bonusAttack: { cost: 'free' }, limit: { window: 'encounter', max: 1 },
    available: actor => isFirstInInitiativeRoundOne(actor),
  },
  // Fight or Flight (GI Joe CRB, Scout Commando, 20th level, p.93): "when you successfully sneak
  // attack a target, you can make another attack or another move as a free action once per round."
  [P.fightOrFlight]: { id: 'fightOrFlight', target: 'self', choice: ['attack', 'move'], bonusAttack: { cost: 'free' }, nowIfMove: { move: 1 }, limit: { window: 'turn', max: 1 } },
  // The Hits Keep Coming (GI Joe CRB, Blitzer, 3rd level, p.98): "once per turn when you Defeat an
  // enemy, you may use a Free action to move up to your Movement Rating and make a melee Might
  // attack."
  [P.theHitsKeepComing]: { id: 'theHitsKeepComing', target: 'self', bonusAttack: { cost: 'free', filter: { mightMelee: true } }, limit: { window: 'turn', max: 1 } },
  // Ambush Predator (Cobra Codex, Primal, 17th level, p.60): after Animal Gait movement, "an attack as
  // a Free action at the end of your Movement once per turn."
  [P.ambushPredator]: { id: 'ambushPredator', target: 'self', bonusAttack: { cost: 'free' }, limit: { window: 'turn', max: 1 } },
  // Mayhem Attack (TF CRB, General Perk, p.110): "After making an Attack aided by an ally ... you can
  // immediately spend a Free action to make another Attack with the same benefits."
  [P.mayhemAttack]: { id: 'mayhemAttack', target: 'self', bonusAttack: { cost: 'free' }, limit: { window: 'turn', max: 1 } },
  // Surface Invasion (TF CRB, Cutter Alt Mode perk, p.49): "Once per scene, after Moving in your Alt
  // Mode, you can Move an additional 10ft ... [and] make a single attack as a Free action with the
  // benefits of Surprise."
  [P.surfaceInvasion]: { id: 'surfaceInvasion', target: 'self', bonusAttack: { cost: 'free' }, limit: { window: 'scene', max: 1 } },
  // New Plan (TF CRB, Leader Tactician, 14th level, p.85): "if the triggering action never occurs, you
  // gain an additional Move action or two additional Free actions on your next turn." Used at the
  // start of that next turn, so the grant lands on the turn now under way.
  [P.newPlan]: {
    id: 'newPlan', target: 'self', choice: ['move', 'twoFree'], limit: { window: 'turn', max: 1 },
    available: actor => !!actor && lastTurnHadContingency(actor),
  },
  // Harmony Unleashed (MLP CRB, spell, p.139) - see the cost rule above. "You ignite the spark that's
  // inside of a pony" within 30ft: the targeted pony, or the caster with nothing targeted.
  [P.harmonyUnleashed]: { id: 'harmonyUnleashed', target: 'targetOrSelf', switchOn: HARMONY_FLAG, rounds: 3 },
  // Laughtracting (MLP CRB, Spirit of Laughter, 9th level, p.86): "as a Standard action, you roll a
  // Performance Skill Test against a creature's Willpower. On a success, they can't use any Free
  // actions on their next turn." Rolled here; dice.mjs applies it to each target it beat.
  [P.laughtracting]: { id: 'laughtracting', target: 'enemy', cost: 'standard', custom: 'laughtracting' },
  // Ground and Pound (Hawk's Personnel Files, p.174): "As a Standard action, you use your body to box
  // in a Prone target ... You are considered Prone while in this position." Its unarmed attacks
  // are then Free actions for the rest of the turn - see the cost rule.
  [P.groundAndPound]: { id: 'groundAndPound', target: 'enemy', cost: 'standard', switchOn: GROUND_AND_POUND_FLAG, selfStatus: 'prone' },
  // Follow Through (Across the Stars, Phantom Ranger, 2nd level, p.60): "the first time each round you
  // Defeat an enemy target with a Might or Finesse Attack Skill Test, you may move a distance equal to
  // your Burst Speed and immediately make the same Attack against another target." Morphed only.
  [P.followThrough]: {
    id: 'followThrough', target: 'self', bonusAttack: { cost: 'none', filter: { mightOrFinesse: true } }, limit: { window: 'turn', max: 1 },
    available: actor => !!actor.system?.isMorphed,
  },
  // Triple Strike Attacks (PR CRB, Yellow Ranger, 1st level, p.56): "whenever you make an Finesse attack
  // action, spend a Personal Power to make an attack with EACH of your hands at no penalty, and then
  // make a third, Follow-Up martial arts attack" - two more attacks after the first.
  [P.tripleStrikeAttacks]: { id: 'tripleStrikeAttacks', target: 'self', powerCost: 1, bonusAttack: { cost: 'none', count: 2 }, limit: { window: 'turn', max: 1 } },
  // Barrage Attack (Through the Shattered Grid, Zord Feature, p.117): "When it makes a ranged attack,
  // you can spend one Personal Power, and it can make a ranged attack with every other ranged weapon
  // it has."
  [P.barrageAttack]: {
    id: 'barrageAttack', target: 'self', powerCost: 1, bonusAttack: { cost: 'none', filter: { ranged: true }, count: actor => Math.max(0, rangedWeaponCount(actor) - 1) },
    limit: { window: 'turn', max: 1 },
  },
  // Shoot, You Fools! (Cobra Codex, Baroness, 17th level, p.57): "as a Standard action, you can grant
  // all allies who can hear you an immediate attack. Any ally who attacks and fails suffers 1 Psychic
  // Damage." Every ally in the combat - who can hear is the table's call. The Psychic Damage lands
  // when that attack misses (documents/item.mjs).
  [P.shootYouFools]: { id: 'shootYouFools', target: 'allies', cost: 'standard', bonusAttack: { cost: 'none', psychicOnMiss: 1 } },
  // Weapons changed for a while - Explosive Ammo, Utility Loaders, Kitbash Upgrade, Knuckle Up, HUD
  // and the rest. Each one's rule text and effect is in helpers/weapon-perk-uses.mjs.
  ...Object.fromEntries(Object.entries(WEAPON_USE_IDS)
    .filter(([id]) => !['tooledMunitions', 'hammerItOut'].includes(id))
    .map(([id, uuid]) => [uuid, {
      id, target: 'self', custom: 'weaponUse',
      // "Once per turn during combat" (HUD); Motor Lancer and Knuckle Up last to the end of the turn.
      outOfCombat: !['hud', 'motorLancer', 'knuckleUp', 'beatdown', 'jackhammer', 'armamentUpgrade', 'airburst', 'firestorm'].includes(id),
      limit: id == 'hud' ? { window: 'turn', max: 1 } : null,
    }])),
  // Lookout (GI Joe CRB, Environmental Expertise, p.91): "When you roll for Initiative in your
  // environment of expertise, you can make a free Move action before the surprise round."
  [P.lookout]: {
    id: 'lookout', target: 'self', now: { move: 1 }, limit: { window: 'encounter', max: 1 },
    available: () => (game?.combat?.round ?? 0) <= 1,
  },
};

/**
 * How many separate ranged weapons an actor attacks with - an Effect's parent Weapon, or the Effect
 * itself when it has none (a Zord's built-in attacks).
 */
function rangedWeaponCount(actor) {
  const keys = new Set();
  for (const item of actor?.items ?? []) {
    if (item.type == 'weaponEffect' && item.system?.classification?.style != 'melee') {
      keys.add(item.flags?.essence20?.parentId ?? item.id ?? item.name);
    }
  }

  return keys.size;
}

/**
 * What a successful Laughtracting takes from its target's next turn. Distraughter (MLP CRB, Spirit
 * of Laughter, 15th level, p.87) takes their Move action as well.
 * @param {Actor} actor   The one laughing.
 * @returns {String[]}   Categories blocked.
 */
export function getLaughtractingBlock(actor) {
  return hasSourced(actor, P.distraughter) ? ['free', 'move'] : ['free'];
}

// Set by action-economy.mjs so this file doesn't import it back (the two would be circular).
let economy = null;
export function bindEconomy(api) {
  economy = api;
}

function isFirstInInitiativeRoundOne(actor) {
  const combat = game?.combat;
  if (!combat || combat.round > 1) {
    return false;
  }

  const first = combat.turns?.[0];
  return !!first && (first.actor?.id == actor?.id || first.actorId == actor?.id);
}

function lastTurnHadContingency(actor) {
  return !!economy?.getLedger(actor)?.lastTurnContingency;
}

// A weapon with the Combined trait gets a Use button to combine with allies (combined-weapons.mjs).
const COMBINE_USE = { id: 'combine', target: 'self', custom: 'combine', outOfCombat: true };

const VEHICLE_USE = { id: 'vehicleUpgrade', target: 'self', custom: 'vehicleUpgrade', outOfCombat: true };

// Checkmate, Suppressing Fire, poisons, Jammer and the rest of helpers/target-riders.mjs's table.
const RIDER_USE = { id: 'rider', target: 'self', custom: 'rider', outOfCombat: true };

// Free picks, Role Perks from elsewhere, made-on-the-spot items and lights - helpers/grants.mjs.
const GRANT_USE = { id: 'grant', target: 'self', custom: 'grant', outOfCombat: true };

// Kits used up, scrounged or re-specialized, and the gear that heals or recharges - helpers/kits.mjs.
const KIT_USE = { id: 'kit', target: 'self', custom: 'kit', outOfCombat: true };

// Pets, drones, Mini-Cons and companions (helpers/companions.mjs); Contacts (contacts.mjs); personal
// vehicles, Battlizers and summons (summons.mjs); team Perks (team-actions.mjs); bonded partners
// (bonded.mjs); BFFs (bff.mjs).
const COMPANION_USE = { id: 'companion', target: 'self', custom: 'companion', outOfCombat: true };
const CONTACT_USE = { id: 'contact', target: 'self', custom: 'contact', outOfCombat: true };
const SUMMON_USE = { id: 'summon', target: 'self', custom: 'summon', outOfCombat: true };
const TEAM_USE = { id: 'team', target: 'self', custom: 'team', outOfCombat: true };
const BOND_USE = { id: 'bond', target: 'self', custom: 'bond', outOfCombat: true };
const BFF_USE = { id: 'bff', target: 'self', custom: 'bff', outOfCombat: true };
const COMMAND_USE = { id: 'issueCommand', target: 'self', custom: 'issueCommand', outOfCombat: true };
// Extension Use buttons (helpers/extensions.mjs#registerUse).
const EXT_USE = { id: 'ext', target: 'self', custom: 'ext', outOfCombat: true };

function useFor(item) {
  return ACTION_PERK_USES[sourceOf(item)] ?? (isCombinedWeapon(item) ? COMBINE_USE : null)
    ?? (vehicleUpgradeUse(item) ? VEHICLE_USE : null)
    ?? (isRiderUse(item) ? RIDER_USE : null)
    ?? (isGrantUse(item) ? GRANT_USE : null)
    ?? (kitUseKind(item) ? KIT_USE : null)
    ?? (isCompanionUse(item) ? COMPANION_USE : null)
    ?? (contactKindOf(item) ? CONTACT_USE : null)
    ?? (summonKindOf(item) ? SUMMON_USE : null)
    ?? (teamKindOf(item) ? TEAM_USE : null)
    ?? (isBondUse(item) ? BOND_USE : null)
    ?? (isBffUse(item) ? BFF_USE : null)
    ?? (isCommandUse(item) ? COMMAND_USE : null)
    ?? (findExtUse(item) ? EXT_USE : null);
}

export function isActionPerkUse(item) {
  return !!useFor(item);
}

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
}

function usesKey(use) {
  return `actionPerkUse.${use.id}`;
}

function useCount(actor, use) {
  if (!use.limit) {
    return 0;
  }

  return use.limit.window == 'turn'
    ? (economy?.getLedger(actor)?.perkUses?.[usesKey(use)] ?? 0)
    : getUses(actor, usesKey(use), use.limit.window);
}

/**
 * Whether the Use button shows. Only in combat - every one of these is about turns and actions.
 */
export function canUseActionPerk(item) {
  const use = useFor(item);
  const actor = item?.parent;
  if (!use || !actor || (!game?.combat && !use.outOfCombat)) {
    return false;
  }

  if (use.available && !use.available(actor)) {
    return false;
  }

  if (use.custom == 'vehicleUpgrade') {
    return canUseVehicleUpgrade(item);
  }

  if (use.custom == 'rider') {
    return canUseRider(item);
  }

  if (use.custom == 'grant') {
    return canUseGrant(item);
  }

  if (use.custom == 'kit') {
    return canUseKit(item);
  }

  if (use.custom == 'companion') {
    return canUseCompanion(item);
  }

  if (use.custom == 'ext') {
    const ext = findExtUse(item);
    return !ext?.canUse || !!ext.canUse(item);
  }

  return !use.limit || useCount(actor, use) < use.limit.max;
}

async function pickChoice(use, item) {
  const buttons = use.choice.map(key => ({ action: key, label: game.i18n.localize(`E20.ActionPerkChoice.${key}`) }));
  return foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: `<p>${game.i18n.format('E20.ActionPerkChoicePrompt', { perk: item.name })}</p>`,
    buttons,
    rejectClose: false,
  });
}

/**
 * Run a Perk's Use button. Returns the chat line to post, or null if nothing happened.
 */
export async function useActionPerk(item) {
  const use = useFor(item);
  const actor = item?.parent;
  if (!use || !actor || !economy) {
    return null;
  }

  if (use.target == 'enemy' && !game.user?.targets?.size) {
    ui.notifications.warn(game.i18n.format('E20.ActionPerkNeedsTarget', { perk: item.name }));
    return null;
  }

  if (use.target == 'allies') {
    return useOnAllies(use, item, actor);
  }

  let recipient = actor;
  if (use.target == 'ally') {
    recipient = game.user?.targets?.first?.()?.actor ?? null;
    if (!recipient || recipient.id == actor.id) {
      ui.notifications.warn(game.i18n.format('E20.ActionPerkNeedsAlly', { perk: item.name }));
      return null;
    }

    if (!economy.getCombatant(recipient)) {
      ui.notifications.warn(game.i18n.format('E20.ActionPerkNotInCombat', { name: recipient.name }));
      return null;
    }
  }

  if (use.target == 'targetOrSelf') {
    recipient = game.user?.targets?.first?.()?.actor ?? actor;
  }

  const choice = use.choice ? await pickChoice(use, item) : null;
  if (use.choice && !choice) {
    return null;
  }

  if (use.storyPoint) {
    const { canSpendForActor, spendForActor } = await import("./story-points.mjs");
    if (!canSpendForActor(actor, 1)) {
      ui.notifications.warn(game.i18n.format('E20.ActionPerkNoStoryPoint', { perk: item.name }));
      return null;
    }

    await spendForActor(actor, 1);
  }

  if (use.powerCost) {
    const value = Number(actor.system?.powers?.personal?.value) || 0;
    if (value < use.powerCost) {
      ui.notifications.warn(game.i18n.format('E20.ActionPerkNoPower', { name: actor.name }));
      return null;
    }

    await actor.update({ 'system.powers.personal.value': value - use.powerCost });
  }

  if (use.cost) {
    const paid = await economy.spend(actor, use.cost, { source: item.name });
    if (paid.blocked) {
      return null;
    }
  }

  if (use.custom == 'vehicleUpgrade') {
    return useVehicleUpgrade(item, economy);
  }

  if (use.custom == 'rider') {
    const { useRider } = await import("./target-riders.mjs");
    return useRider(item, economy);
  }

  if (use.custom == 'grant') {
    const { runGrant } = await import("./grants.mjs");
    return runGrant(item, economy);
  }

  if (use.custom == 'kit') {
    const { runKitUse } = await import("./kits.mjs");
    return runKitUse(item, economy);
  }

  if (use.custom == 'companion') {
    const { runCompanionUse } = await import("./companions.mjs");
    return runCompanionUse(item, economy);
  }

  if (use.custom == 'contact') {
    const { runContactUse } = await import("./contacts.mjs");
    return runContactUse(item, economy);
  }

  if (use.custom == 'summon') {
    const { runSummonUse } = await import("./summons.mjs");
    return runSummonUse(item, economy);
  }

  if (use.custom == 'team') {
    const { runTeamUse } = await import("./team-actions.mjs");
    return runTeamUse(item, economy);
  }

  if (use.custom == 'bond') {
    const { runBondUse } = await import("./bonded.mjs");
    const pay = async (cost) => !cost || !game.combat || !(await economy.spend(actor, cost, { source: item.name })).blocked;
    return runBondUse(item, pay);
  }

  if (use.custom == 'bff') {
    const { chooseBffs } = await import("./bff.mjs");
    return chooseBffs(actor);
  }

  if (use.custom == 'ext') {
    const ext = findExtUse(item);
    const pay = async (cost) => !cost || !game.combat || !(await economy.spend(actor, cost, { source: item.name })).blocked;
    return ext ? ext.run(item, economy, pay) : null;
  }

  if (use.custom == 'issueCommand') {
    const { issueCommand } = await import("./commands.mjs");
    const pay = async (cost) => !cost || !game.combat || !(await economy.spend(actor, cost, { source: item.name })).blocked;
    return issueCommand(actor, { pay });
  }

  if (use.custom == 'combine') {
    return combineWeapons(actor, item, economy);
  }

  if (use.custom == 'weaponUse') {
    const { runWeaponUse } = await import("./weapon-perk-uses.mjs");
    const message = await runWeaponUse(use.id, actor, item, economy);
    if (message && use.limit) {
      await economy.markTurnUse(actor, usesKey(use));
    }

    return message;
  }

  if (use.custom == 'laughtracting') {
    await actor._dice.rollSkill({
      skill: 'performance', essence: 'social', shiftUp: 0, shiftDown: 0, defenseType: 'willpower', isLaughtracting: true,
    }, actor);
    return null;
  }

  const granted = [];
  if (use.now || (choice == 'move' && use.nowIfMove)) {
    const now = choice == 'move' && use.nowIfMove ? use.nowIfMove : use.now;
    const grants = now.fullTurn ? fullTurnFor(recipient) : now;
    await economy.grantActionsThisTurn(recipient, grants, item.name);
    granted.push(economy.describeGrant(grants));
  }

  if (choice == 'twoFree') {
    await economy.grantActionsThisTurn(recipient, { free: 2 }, item.name);
    granted.push(economy.describeGrant({ free: 2 }));
  } else if (choice == 'move' && !use.nowIfMove) {
    await economy.grantActionsThisTurn(recipient, { move: 1 }, item.name);
    granted.push(economy.describeGrant({ move: 1 }));
  }

  if (use.bonusAttack && (!use.choice || choice == 'attack')) {
    const count = typeof use.bonusAttack.count == 'function' ? use.bonusAttack.count(actor) : use.bonusAttack.count ?? 1;
    for (let i = 0; i < count; i++) {
      await economy.grantBonusAttack(recipient, { source: item.name, cost: use.bonusAttack.cost, filter: use.bonusAttack.filter ?? null });
    }

    granted.push(game.i18n.format(count > 1 ? 'E20.ActionPerkBonusAttacks' : 'E20.ActionPerkBonusAttack', { count }));
  }

  if (use.selfStatus && !actor.statuses?.has?.(use.selfStatus)) {
    await actor.toggleStatusEffect?.(use.selfStatus, { active: true });
  }

  if (use.switchOn) {
    const combat = game.combat;
    const stamp = use.rounds
      ? { combatId: combat.id, untilRound: combat.round + use.rounds - 1 }
      : { combatId: combat.id, round: combat.round, turn: combat.turn };
    const { needsGmRelay, relayToGm } = await import("./gm-relay.mjs");
    if (needsGmRelay(recipient)) {
      await relayToGm(recipient, 'setFlag', ['essence20', use.switchOn, stamp]);
    } else {
      await recipient.setFlag('essence20', use.switchOn, stamp);
    }

    granted.push(game.i18n.localize(`E20.ActionPerkSwitchedOn.${use.id}`));
  }

  if (use.limit) {
    if (use.limit.window == 'turn') {
      await economy.markTurnUse(actor, usesKey(use));
    } else {
      await markUsed(actor, usesKey(use), { window: use.limit.window });
    }
  }

  return game.i18n.format(recipient.id == actor.id ? 'E20.ActionPerkUsedSelf' : 'E20.ActionPerkUsedAlly', {
    name: actor.name, perk: item.name, ally: recipient.name, grant: granted.join(', '),
  });
}

/**
 * Every ally in the current combat: the combatants sharing the user's token disposition.
 */
function alliesInCombat(actor) {
  const own = actor.getActiveTokens?.()?.[0]?.document?.disposition ?? economy.getCombatant(actor)?.token?.disposition;
  return (game.combat?.combatants?.contents ?? [...(game.combat?.combatants ?? [])])
    .filter(c => c.actor && c.actor.id != actor.id && (c.token?.disposition ?? own) == own)
    .map(c => c.actor);
}

async function useOnAllies(use, item, actor) {
  const allies = alliesInCombat(actor);
  if (!allies.length) {
    ui.notifications.warn(game.i18n.format('E20.ActionPerkNoAllies', { perk: item.name }));
    return null;
  }

  if (use.cost) {
    const paid = await economy.spend(actor, use.cost, { source: item.name });
    if (paid.blocked) {
      return null;
    }
  }

  for (const ally of allies) {
    await economy.grantBonusAttack(ally, {
      source: item.name, cost: use.bonusAttack.cost, filter: use.bonusAttack.filter ?? null,
      psychicOnMiss: use.bonusAttack.psychicOnMiss ?? 0,
    });
  }

  return game.i18n.format('E20.ActionPerkUsedAllies', {
    name: actor.name, perk: item.name, allies: allies.map(a => a.name).join(', '),
  });
}

/**
 * "An immediate bonus turn" / "an extra turn": the recipient's whole per-turn budget again.
 */
function fullTurnFor(actor) {
  const actions = actor?.system?.actions ?? {};
  return {
    standard: actions.standard?.max ?? 1,
    move: actions.move?.max ?? 1,
    free: actions.free?.max ?? 0,
  };
}

/**
 * Powers that hand out attacks when used. A Power pays its own Personal Power through the Power's
 * own use (sheet-handlers/power-handler.mjs), so only the grant happens here.
 *
 * Relentless Blows (PR CRB, Grid Power, p.101): "If you make an unarmed attack on your turn, you may
 * spend 1 Power to make two additional unarmed strikes as a Free Action."
 * @param {Actor} actor
 * @param {Item} power
 * @returns {Promise<Boolean>}   Whether anything was granted.
 */
export async function onPowerUsed(actor, power) {
  if (!economy || sourceOf(power) != P.relentlessBlows || !economy.getCombatant(actor)) {
    return false;
  }

  for (let i = 0; i < 2; i++) {
    await economy.grantBonusAttack(actor, { source: power.name, cost: 'none', filter: { unarmed: true } });
  }

  return true;
}

/* -------------------------------------------- */
/*  Turn-start grants                           */
/* -------------------------------------------- */

/**
 * Anything granted automatically at the start of an actor's turn.
 *
 * Zephyr Grace (Through the Shattered Grid, Grid Power, p.115): "While Morphed, you gain 2 Free
 * actions per turn to buy extra Movement. These Free actions cannot be used for any other activity."
 * The "movement only" restriction is the player's to keep; the +5 Evasion for leaving them unused is
 * not modelled.
 * @returns {{free: Number, move: Number, standard: Number, sources: String[]}}
 */
export function getTurnStartGrants(actor) {
  const grants = { free: 0, move: 0, standard: 0, sources: [] };
  const zephyr = findSourced(actor, P.zephyrGrace);
  if (zephyr && actor.system?.isMorphed) {
    grants.free += 2;
    grants.sources.push(zephyr.name);
  }

  return grants;
}

/* -------------------------------------------- */
/*  Lend Assistance variants                    */
/* -------------------------------------------- */

/**
 * The next-turn grants a helper can give "instead of the normal effect" of Lend Assistance.
 * Here, Let Me (MLP CRB, Spirit of Generosity, 9th level, p.74): "Lend Assistance to give a friend an
 * extra Move action on their next turn." No, I Insist (17th level, p.75): "an extra Standard action".
 * @returns {Array<{mode: String, label: String, grant: Object}>}
 */
export function getLendAssistanceGrantModes(actor) {
  const modes = [];
  if (hasSourced(actor, P.hereLetMe)) {
    modes.push({ mode: 'nextMove', label: game.i18n.localize('E20.LendAssistanceModeNextMove'), grant: { move: 1 } });
  }

  if (hasSourced(actor, P.noIInsist)) {
    modes.push({ mode: 'nextStandard', label: game.i18n.localize('E20.LendAssistanceModeNextStandard'), grant: { standard: 1 } });
  }

  return modes;
}

/**
 * What using Secret Helper costs the helper next turn. Base (MLP CRB, 3rd level): "On your next
 * turn, you can't take a Standard action." Subtle Helper (11th level): "you can take a Standard
 * action on your next turn, but you can't take a Move action." Stealth Helper (18th level): "you
 * can take a Standard action and a Move action on your next turn, but one of your free actions is
 * used up." The highest one the helper has applies.
 * @returns {{block: String[], prespend: Object}}
 */
export function getSecretHelperPenalty(actor) {
  if (hasSourced(actor, P.stealthHelper)) {
    return { block: [], prespend: { free: 1 } };
  }

  if (hasSourced(actor, P.subtleHelper)) {
    return { block: ['move'], prespend: {} };
  }

  return { block: ['standard'], prespend: {} };
}
