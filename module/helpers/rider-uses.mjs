import { getUses } from "./scene-clock.mjs";

/**
 * The compendium entries helpers/target-riders.mjs works from, and which of them get a Use button.
 * Kept apart from that file so helpers/action-perks.mjs can ask about the Use button without pulling
 * in everything target-riders.mjs imports (which would loop back round to action-perks.mjs).
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

export const RIDER = {
  checkmate: uuid('gi_joe_crb', 'BcFM3JhWdk5XHIZL'),
  shapedCharges: uuid('gi_joe_crb', 'xFMzM5pycDmmw4u3'),
  suppressingFire: uuid('gi_joe_crb', 'MVUiiMad4HYe5xL7'),
  unstoppableForce: uuid('gi_joe_crb', 'DwnPEw2POcj3f0Za'),
  wreckingBall: uuid('gi_joe_crb', 't8OnOh6dQ0FoWBsG'),
  perfectDisguise: uuid('gi_joe_crb', 'ELktMVNYsiBPTX2c'),
  allOutAttack: uuid('gi_joe_crb', 'Rhz1k6gTl2XTs8Nk'),
  evasiveFighting: uuid('gi_joe_crb', 'tBXpROuVSuAxGZpR'),
  artilleryLobberEffect: uuid('gi_joe_crb', '6SNB0WmDWMUkpr2X'),
  jammer: uuid('gi_joe_crb', 'gFTHcdhnTZojAqPM'),
  whiteNoise: uuid('gi_joe_crb', 'F80nn3atqFJWhRWQ'),
  muzzlePunch: uuid('quartermasters_guide_to_gear', 'uwr8mZd2KXIZt61D'),
  scapegoatHangUp: uuid('cobra_codex', 'T2NO8rvrvvVYOuAP'),
  concentratedExplosion: uuid('cobra_codex', '1Dsom5S1ByB6Egbk'),
  concentratedFire: uuid('cobra_codex', '2UPKeLtWRXIoDlux'),
  geneticDecoding: uuid('cobra_codex', '3I9h6aspI3Cg0Fd0'),
  hacker: uuid('cobra_codex', 's56rG7h3is1WNpz2'),
  poisonProdigy: uuid('cobra_codex', 'qkvDR7I1tBwOyStY'),
  poisonChemistry: uuid('cobra_codex', 'MOOrbfVEyGTDExfv'),
  consistent: uuid('cobra_codex', 'vaAhMXXlzNWHIikR'),
  fearIsUniversal: uuid('cobra_codex', 'oGVp2hIxNBT8g1QW'),
  disarmingShot: uuid('general_hawk_s_personel_files', 'b4v1GUBwSqnCTozq'),
  worstNightmare: uuid('general_hawk_s_personel_files', 'eju1fItsi7O0utmh'),
  snatch: uuid('ferocious_fighters', 'a5DNgno8XV7pVBzO'),
  dismantleFirearm: uuid('intercontinental_adventures', '6XYgRBQGPm7gF41b'),
  energicShields: uuid('pr_crb', 'Lxmp3gfs8TmtUOI5'),
  bowlOver: uuid('pr_crb', '3oeSWdRfUpOq6b9y'),
  enhancedImpactPoints: uuid('jump_through_time', 'FLV4BgCGfPPDxoAY'),
  gremlinsMischief: uuid('jump_through_time', 'tOaR4ftVJadvAgbC'),
  allyAwareness: uuid('tf_crb', 'WzccenAOAQxiARf7'),
  pinpoint: uuid('tf_crb', 'r810HCughuqpIhaZ'),
  energyResistor: uuid('tf_crb', 'lKnjgN4TdHHNktpF'),
  vineBombsEffect: uuid('technorganic_secrets', 'WGWGdiX8drI5SFi6'),
  disarmingShotDD: uuid('decepticon_directive', 'K2uvTIYYzCixgBD7'),
  fanatic: uuid('decepticon_directive', 'QhiG6aB3Z2GM1Get'),
  makeAnOpening: uuid('decepticon_directive', 'DezsS1cuMwU8Qiwb'),
  onMyMark: uuid('decepticon_directive', 'rkAvOCaF0RxnawZe'),
  secondaryQuarry: uuid('decepticon_directive', 'GS8YX7V6rYJLnkfQ'),
  coDependent: uuid('enigma_of_combination', '2tPC2AgganNw2GgO'),
  ablativeHeavy: uuid('enigma_of_combination', 'fuztUMiuiIXsk2sI'),
  ablativeLight: uuid('enigma_of_combination', 'wAVLN1sPaIxqxgN2'),
  ablativeMedium: uuid('enigma_of_combination', 'llGkZPM7l7hhyPs2'),
  gyroGunAlternate: uuid('enigma_of_combination', 'pkAJxZG4ujXfdBem'),
  barrelingBeam: uuid('mlp_crb', 'FpQsQ0FCBFGHThQV'),
  teleportingBeam: uuid('mlp_crb', 'RhSRS4n3dG9TQ92L'),
  scarefyingAppearance: uuid('knights_of_canterlot', '110Rq0wQaqFuugUc'),
  headache: uuid('wtnv_citizens_guide', 'Y9vCqznF8qHKHyO9'),
  intervene: uuid('field_guide_action_adventure', 'b1Ev6biHOHxXXQo4'),
  shotsFired: uuid('field_guide_action_adventure', 'lcUcWMZxVUdLkycD'),
  revealWeakness: uuid('field_guide_action_adventure', 'r2VrdENpcDTo0WGO'),
};

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

export function riderUseFor(item) {
  const source = sourceOf(item);
  if (item?.type == 'weapon' && item.system?.isPoison && item.system.poisonApplication?.contact) {
    return 'coat';
  }

  return {
    [RIDER.checkmate]: 'checkmate',
    [RIDER.suppressingFire]: 'suppressingFire',
    [RIDER.wreckingBall]: 'wreckingBall',
    [RIDER.jammer]: 'device',
    [RIDER.whiteNoise]: 'device',
    [RIDER.muzzlePunch]: 'muzzlePunch',
    [RIDER.revealWeakness]: 'revealWeakness',
    [RIDER.poisonChemistry]: 'poisonChemistry',
    [RIDER.poisonProdigy]: 'poisonProdigy',
    [RIDER.hacker]: 'hacker',
    [RIDER.energicShields]: 'energicShields',
    [RIDER.energyResistor]: 'energyResistor',
    [RIDER.geneticDecoding]: 'geneticDecoding',
    [RIDER.coDependent]: 'coDependent',
    [RIDER.secondaryQuarry]: 'secondaryQuarry',
    [RIDER.allyAwareness]: 'allyAwareness',
    [RIDER.bowlOver]: 'bowlOver',
    [RIDER.gremlinsMischief]: 'gremlinsMischief',
    [RIDER.checkmate]: 'checkmate',
  }[source] ?? null;
}

export function isRiderUse(item) {
  return !!riderUseFor(item);
}

export function canUseRider(item) {
  const kind = riderUseFor(item);
  const actor = item?.parent;
  if (!kind || !actor) {
    return false;
  }

  if (kind == 'allyAwareness') {
    return getUses(actor, 'allyAwarenessAssist', 'scene') < 1;
  }

  if (kind == 'bowlOver') {
    return !!game.combat;
  }

  return true;
}
