import { getDefenseValue } from "./combat.mjs";
import { actorHasPerk } from "./perks.mjs";

// Technical Mastery (Quartermaster's Guide to Gear, Tech Officer Focus, Officer, 20th level,
// p.22): "when using your Tech Specs ability... your allies gain Edge on their attacks in
// addition to the benefits of Tech Specs." Widens markTechSpecsTarget's own mark with the
// caster's id (not just their disposition), so checkTechSpecsEdge below can look the caster up
// again and confirm THEY specifically hold Technical Mastery (not just anyone sharing their
// disposition) before granting the extra Edge - Tech Specs' own shiftUp stays ungated by this,
// since RAW's base ability already grants that to everyone regardless. The Critical-Success-on-a-
// d2/Trade-School-extension half of Technical Mastery lives directly in dice.mjs (a plain
// canCritD2 grant, the same shape Perimeter Defender's identical clause already uses).
const TECHNICAL_MASTERY_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.QKlXoVgNMq7Kv58L";

/**
 * Tech Specs (Quartermaster's Guide to Gear, Tech Officer Focus, Officer, 10th level, p.22): "As
 * a Standard action, make a Technology Skill Test against the highest Defense of a vehicle or
 * weapon-wielding target you can see. On a success, you identify it along with its weakest point
 * of failure and learn the vehicle's Hang-Up and its current Defense scores. In addition, you and
 * all allies gain ↑1 to attack that target until the end of your next turn."
 *
 * The Skill Test itself is the same "trigger a real dialog roll via actor._dice.rollSkill()"
 * single-target shape Duty Of The Graphite/Absolute Menace already establish, aimed at whichever
 * DIF this specific target's own highest Defense resolves to - computed up front via
 * getHighestDefenseType() below, then passed through as an ordinary `defenseType` (dice.mjs's own
 * per-target checkEntries construction already knows how to resolve any named Defense type, no
 * new "raw numeric difficulty" plumbing needed).
 *
 * On a success: the info-reveal half posts a chat card (target's Hang-Ups + all 4 Defense scores -
 * "weakest point of failure" is folded into "which Defense is lowest," not narrated separately,
 * since this system has no other per-target weakness data to surface). The shiftUp half is a
 * target-marked, disposition-shared broadcast - the same "mark the TARGET, credit whoever shares
 * the marking actor's own disposition" shape Team Focus already establishes, widened here to
 * include the marking actor's own attacks too (RAW says "you AND allies," unlike Team Focus's own
 * "your teammate," so the caster isn't excluded the way Team Focus excludes the original attacker).
 * "Until the end of your next turn" is approximated at the same round granularity Shining Leader/
 * Rallying Cry's own "this round and the next" window already uses.
 */
const TECH_SPECS_MARK_FLAG = 'techSpecsMarked';
const DEFENSE_TYPES = ['toughness', 'evasion', 'willpower', 'cleverness'];

/**
 * Which of a target's 4 Defenses is currently highest - ties broken by DEFENSE_TYPES' own listed
 * order (first one reached wins).
 * @param {Actor} targetActor
 * @returns {String}   A defenseType key from DEFENSE_TYPES.
 */
export function getHighestDefenseType(targetActor) {
  let highestType = DEFENSE_TYPES[0];
  let highestValue = -Infinity;
  for (const type of DEFENSE_TYPES) {
    const value = getDefenseValue(targetActor, type);
    if (value > highestValue) {
      highestValue = value;
      highestType = type;
    }
  }

  return highestType;
}

/**
 * Triggers the actual Technology-vs-highest-Defense Skill Test against whichever token is
 * currently targeted.
 * @param {Actor} actor
 */
export async function activateTechSpecs(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.TechSpecsNoTarget'));
    return;
  }

  await actor._dice.rollSkill({
    skill: 'technology',
    essence: 'smarts',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: getHighestDefenseType(targetActor),
    isTechSpecs: true,
  }, actor);
}

/**
 * Builds the chat content revealing the target's Hang-Ups and current Defense scores, per a
 * successful Tech Specs check.
 * @param {Actor} targetActor
 * @returns {String}
 */
export function buildTechSpecsResult(targetActor) {
  const defenseNames = { toughness: 'Toughness', evasion: 'Evasion', willpower: 'Willpower', cleverness: 'Cleverness' };
  const defenses = DEFENSE_TYPES
    .map(type => `${defenseNames[type]} ${getDefenseValue(targetActor, type)}`)
    .join(', ');
  const hangUps = (targetActor.items?.filter(item => item.type == 'hangUp') ?? []).map(item => item.name);

  return game.i18n.format('E20.TechSpecsResult', {
    target: targetActor.name,
    defenses,
    hangUps: hangUps.length ? hangUps.join(', ') : game.i18n.localize('E20.ChronoFileAccessNoHangUps'),
  });
}

/**
 * Marks the target with the attacking actor's own disposition, for markTechSpecsShiftUp's own
 * reciprocal check this round and next to read back.
 * @param {Actor} actor   The actor who just landed the successful Tech Specs check.
 * @param {Actor} targetActor
 */
export async function markTechSpecsTarget(actor, targetActor) {
  if (!game.combat || !targetActor?.setFlag) {
    return;
  }

  const actorToken = actor.getActiveTokens?.()?.[0];
  await targetActor.setFlag('essence20', TECH_SPECS_MARK_FLAG, {
    combatId: game.combat.id,
    round: game.combat.round,
    disposition: actorToken?.document?.disposition,
    casterId: actor.id,
  });
}

/**
 * Whether the given actor's attack against target should get Tech Specs' own shiftUp - true when
 * the target is currently marked (this round or next) by someone sharing the roller's own
 * disposition, the marking actor themselves included.
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {Boolean}
 */
export function checkTechSpecsShiftUp(actor, target) {
  if (!game.combat || !target) {
    return false;
  }

  const flag = target.getFlag?.('essence20', TECH_SPECS_MARK_FLAG);
  if (!flag || flag.combatId != game.combat.id
    || !(game.combat.round == flag.round || game.combat.round == flag.round + 1)) {
    return false;
  }

  const actorToken = actor.getActiveTokens?.()?.[0];
  return !!actorToken && flag.disposition === actorToken.document.disposition;
}

/**
 * Whether the given actor's attack against target should ALSO get Technical Mastery's own extra
 * Edge - true under the same "currently marked, shared disposition" window checkTechSpecsShiftUp
 * already checks, but only when the ORIGINAL Tech Specs caster (looked up by the id stamped in
 * the mark, not the attacking actor themselves) holds Technical Mastery.
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {Boolean}
 */
export function checkTechSpecsEdge(actor, target) {
  if (!checkTechSpecsShiftUp(actor, target)) {
    return false;
  }

  const flag = target.getFlag('essence20', TECH_SPECS_MARK_FLAG);
  const caster = game.actors?.get(flag.casterId);
  return !!caster && actorHasPerk(caster, TECHNICAL_MASTERY_ID);
}
