import {
  registerAfterDamage, registerApplyDialog, registerConsumer, registerDamageModifier, registerDefenseAdjust, registerDerived,
  registerDialogToggles, registerPostRoll, registerRollSources, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { FORM_FLAG, activeForm, isFormActive } from "./ranger-form-state.mjs";
import { TSafe as T } from "../shared/item-lang.mjs";
import {
  bth, giveEdge, isBladeBlaster, isPowerWeapon, parentWeaponOf, spendPower,
} from "../shared/personal-power-and-ranger-weapons.mjs";
import {
  findSourcedAny as findSourced, flagOf, itemsOfAny as itemsOf, sourceOf,
} from "../shared/item-lookups.mjs";
import { isStampLive, untilNextTurnStamp } from "../shared/turn-stamps.mjs";
import { postLine } from "../shared/chat-lines.mjs";
import { writeDoc as writeActor } from "../shared/relayed-writes.mjs";
import { ruleFormSpec, ruleFormUuids } from "../../rules/plugins/zords/form-perks.mjs";

/**
 * Form General Perks - "[Form]" Perks that change what a Ranger's Morph gives them.
 *
 * Across the Stars (p.69-71): "You can spend 1 Personal Power when you activate the 'It's Morphin
 * Time!' Spectrum Role feature to unlock..." and "You may only have one Form General Perk active at a
 * time." A Jump Through Time's Forms (Ranger Operator p.55, Time Force p.56) replace the Morpher
 * outright, so they cost nothing; Beneath the Helmet's Beast Morpher (p.51) "is connected to It's
 * Morphin Time!". So: when a Ranger Morphs and holds any Form, they pick which one (or none) and pay
 * its cost; the active Form lives in the actor flag `zord1Form` and ends when they de-Morph.
 *
 * Every Form's weapon/gear replacement is a real swap: the replaced weapons are un-equipped and the
 * Form's own are granted (flagged `zord1FormGrant`), and both are put back on de-Morph.
 *
 * What a Form does is its Perk's own `Form` rule (module/rules/plugins/zords/form-perks.mjs - cost, swaps, grants, element); its Use
 * buttons (start / end, Turbo Cart, Time Force's gear, Beast Morpher's animal and Ninja Storm's element) are its own
 * Use rules, and so is every Form's effect on rolls (Ninja Storm's mind-control Snag is an incoming DialogSwitch).
 *
 * Dino Thunder [Form] (Beneath the Helmet p.52) is different - "you can activate them in your
 * non-Morphed form" - so it's one chosen power with a Use button, not part of the Morph pick.
 */

export const FORM = {
  dino: bth('uh73qYz8bwDobLFh'),
};

const GRANT_FLAG = 'zord1FormGrant';
const ELEMENTS = ['acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic'];

/**
 * What a Morph-time Form does on activation - its Perk's own Form rule (module/rules/plugins/zords/form-perks.mjs). cost: Personal
 * Power. swaps: {replaces: 'blaster' | 'power' | 'both', uuids, pick}. grants: gear handed over for the duration.
 * element: an Element damage type picked at activation (kept as flags.essence20.zord1Form.element).
 */
export function formSpec(actor, uuid) {
  return ruleFormSpec(actor, uuid);
}

/** The Form Perks this actor holds that come with the Morph (by their Form rules). */
export function heldForms(actor) {
  return ruleFormUuids(actor);
}

export { activeForm, isFormActive };

/* -------------------------------------------- */
/*  Activating and ending a Form                 */
/* -------------------------------------------- */

async function choose(title, prompt, rows) {
  const { chooseButtons } = await import("../../mechanics/resources/grants.mjs");
  return chooseButtons(title, prompt, rows);
}

async function nameOf(uuid) {
  return (await fromUuid(uuid))?.name ?? uuid;
}

/** The weapons a swap takes off the Ranger. */
function replacedWeapons(actor, replaces) {
  return itemsOf(actor).filter(item => item.type == 'weapon' && item.system?.equipped !== false
    && !flagOf(item, GRANT_FLAG)
    && ((replaces != 'power' && isBladeBlaster(item)) || (replaces != 'blaster' && isPowerWeapon(item))));
}

/**
 * Turns a Form on: pays its cost, swaps its gear in, enables the Perk's own Active Effects.
 * @returns {Promise<Boolean>}
 */
export async function activateForm(actor, uuid, { pay = true } = {}) {
  const spec = formSpec(actor, uuid);
  const perk = findSourced(actor, uuid);
  if (!spec || !perk) {
    return false;
  }

  if (activeForm(actor)) {
    await endForm(actor);
  }

  let element = null;
  if (spec.element) {
    const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
    element = await chooseSelect(perk.name, T('Zord1SolarElementPrompt'),
      ELEMENTS.map(value => ({ value, label: game.i18n.localize(CONFIG.E20?.damageTypes?.[value] ?? value) })));
    if (!element) {
      return false;
    }
  }

  // Pick the one-of-several replacements before paying, so a cancel costs nothing.
  const toGrant = [...(spec.grants ?? [])];
  const unequip = new Set();
  for (const swap of spec.swaps) {
    let uuids = swap.uuids ?? [];
    if (swap.pick) {
      const rows = await Promise.all(swap.pick.map(async pick => [pick, await nameOf(pick)]));
      const picked = await choose(perk.name, T('Zord1FormPickWeapon'), rows);
      if (!picked || !swap.pick.includes(picked)) {
        return false;
      }

      uuids = [picked];
    }

    toGrant.push(...uuids);
    replacedWeapons(actor, swap.replaces).forEach(weapon => unequip.add(weapon.id));
  }

  if (pay && spec.cost && !(await spendPower(actor, spec.cost))) {
    return false;
  }

  if (unequip.size) {
    await actor.updateEmbeddedDocuments('Item', [...unequip].map(_id => ({ _id, 'system.equipped': false })));
  }

  const granted = [];
  const { grantCopy } = await import("../../mechanics/resources/grants.mjs");
  for (const gear of toGrant) {
    const created = await grantCopy(actor, gear, { grantedBy: perk, flags: { [GRANT_FLAG]: uuid } });
    if (created) {
      granted.push(created.id);
    }
  }

  await setPerkEffects(perk, true);
  await actor.setFlag('essence20', FORM_FLAG, { uuid, element, unequipped: [...unequip], granted });
  await postLine(actor, T('Zord1FormActivated', { name: actor.name, form: perk.name }));
  return true;
}

/** Ends the active Form: gives the swapped weapons back, removes the Form's gear, disables its effects. */
export async function endForm(actor) {
  const state = activeForm(actor);
  if (!state) {
    return;
  }

  const all = itemsOf(actor);
  const grantedIds = new Set(all.filter(item => flagOf(item, GRANT_FLAG) == state.uuid).map(item => item.id));
  const children = all.filter(item => grantedIds.has(item.flags?.essence20?.parentId)).map(item => item.id);
  const toDelete = [...grantedIds, ...children].filter(id => actor.items?.get?.(id) ?? all.find(i => i.id == id));
  if (toDelete.length) {
    await actor.deleteEmbeddedDocuments('Item', toDelete);
  }

  const back = (state.unequipped ?? []).filter(id => actor.items?.get?.(id));
  if (back.length) {
    await actor.updateEmbeddedDocuments('Item', back.map(_id => ({ _id, 'system.equipped': true })));
  }

  const perk = findSourced(actor, state.uuid);
  if (perk) {
    await setPerkEffects(perk, false);
  }

  await actor.unsetFlag('essence20', FORM_FLAG);
}

async function setPerkEffects(perk, enabled) {
  const effects = perk?.effects?.contents ?? [...(perk?.effects ?? [])];
  const updates = effects.filter(effect => effect.disabled == enabled).map(effect => ({ _id: effect.id, disabled: !enabled }));
  if (updates.length) {
    await perk.updateEmbeddedDocuments('ActiveEffect', updates);
  }
}

/** Asked as the Ranger Morphs: which Form (if any) to unlock. */
export async function promptForm(actor) {
  const held = heldForms(actor);
  if (!held.length) {
    return;
  }

  // A single free Form (Ranger Operator, Time Force, Beast Morpher) simply comes with the Morph.
  if (held.length == 1 && !formSpec(actor, held[0]).cost) {
    await activateForm(actor, held[0]);
    return;
  }

  const rows = held.map(uuid => {
    const spec = formSpec(actor, uuid);
    const name = findSourced(actor, uuid).name;
    return [uuid, spec.cost ? T('Zord1FormCostLabel', { name, cost: spec.cost }) : name];
  });
  rows.push(['none', T('Zord1FormNone')]);
  const picked = await choose(T('Zord1FormTitle'), T('Zord1FormPrompt', { name: actor.name }), rows);
  if (picked && picked != 'none') {
    await activateForm(actor, picked);
  }
}

/* -------------------------------------------- */
/*  Roll effects of the active Form              */
/* -------------------------------------------- */

export function formRollSources(actor, target, ctx = {}) {
  const sources = [];
  const consumes = [];
  // Solar Power's Resistance to Cold and Energy (a Snag on the attack), Ninja Storm's ↑1 on Infiltration,
  // Supersonic's Xenotech Edge and armor give-back, and Beast Morpher's Gorilla ↑2 on Brawn and Jackrabbit
  // Snag are rules on their pack items, gated on the active Form (form:active).
  dinoRollSources(actor, target, ctx, sources, consumes);
  return { sources, consumes };
}

export function formToggles(actor, { rolledSkill } = {}) {
  const toggles = [];
  // Lightspeed Response's healing Edge (pre-ticked on Science/Technology), Solar Power's Alertness
  // Edge, Time Force's time-travel Edge and Beast Morpher's Jackrabbit jump are DialogSwitch rules on
  // their pack items, and so is Ninja Storm Wind Ranger's mind-control Snag (an incoming DialogSwitch - the roller's
  // switch whenever a targeted creature has the Form active).
  dinoToggles(actor, rolledSkill, toggles);
  return toggles;
}

export async function formApplyDialog(actor, options, ctx = {}) {
  await dinoApplyDialog(actor, options, ctx);
}

// Solar Power's Power Weapon +1 / Element and Targeting-weapon Fire option, and Supersonic's Sonic Blade Blaster and
// Energy unarmed switch, are HitRider / DialogSwitch rules on their pack items (rules/plugins/combat/hit-rider.mjs).

/** Dino Thunder's end-of-attack clean-up. (Beast Morpher's Fumble Hang-Ups are its afterRoll Triggers.) */
export async function formPostRoll(actor, results, checkContext) {
  await dinoPostRoll(actor, checkContext);
}

/* -------------------------------------------- */
/*  Derived data                                 */
/* -------------------------------------------- */

export function formDerived(actor) {
  const system = actor?.system;
  if (!system?.defenses) {
    return;
  }

  // Ranger Operator's +2 Toughness and Evasion (in place of the armor bonus), Beast Morpher's Cheetah
  // +20 Ground and Gorilla +2 Health, and Ninja Storm's doubled Ground and Earth Duplication -1 Health are rules on
  // their pack items.
  dinoDerived(actor);
}

/* -------------------------------------------- */
/*  Dino Thunder [Form]                          */
/* -------------------------------------------- */

export const DINO_POWERS = [
  'auraReading', 'camouflage', 'invisibility', 'intangibility', 'mindReading', 'psychometry', 'pteraScream',
  'replication', 'shieldProjection', 'shieldPropulsion', 'superhumanStrength', 'triceraSkin', 'tRexSpeed', 'visualTeleportation',
];

const DINO_FLAG = 'zord1Dino';

export function dinoPowersOf(actor) {
  return itemsOf(actor).filter(item => sourceOf(item) == FORM.dino).map(item => flagOf(item, 'zord1DinoPower')).filter(Boolean);
}

function dinoState(actor, power) {
  const state = flagOf(actor, DINO_FLAG)?.[power];
  return isStampLive(state, getSceneEpoch()) ? state : null;
}

async function setDino(actor, power, value) {
  await writeActor(actor, 'setFlag', ['essence20', `${DINO_FLAG}.${power}`, value]);
}

async function clearDino(actor, power) {
  if (flagOf(actor, DINO_FLAG)?.[power]) {
    await writeActor(actor, 'unsetFlag', ['essence20', `${DINO_FLAG}.${power}`]);
  }
}

function sceneStamp() {
  return { sceneEpoch: getSceneEpoch() };
}

function tokenCenter(actor) {
  const token = actor?.getActiveTokens?.()?.[0];
  return token ? { x: token.center?.x ?? token.x, y: token.center?.y ?? token.y } : null;
}

function feetBetween(a, b) {
  const pa = tokenCenter(a);
  const pb = tokenCenter(b);
  const dims = globalThis.canvas?.dimensions;
  if (!pa || !pb || !dims?.size) {
    return Infinity;
  }

  return Math.hypot(pa.x - pb.x, pa.y - pb.y) / dims.size * (dims.distance ?? 5);
}

function dinoRollSources(actor, target, { item, rolledSkill, isAttack } = {}, sources, consumes) {
  // Aura Reading: "You have an Edge on your Alertness (Perception) Skill Tests, and any type of
  // disguise or invisibility has no effect on your test."
  if (rolledSkill == 'alertness' && dinoState(actor, 'auraReading')) {
    sources.push({ id: 'zord1AuraReading', label: T('Zord1DinoAuraReading'), edge: true });
  }

  // Camouflage: "creatures attempting to notice you suffer Snag on Alertness (Perception) Skill Tests".
  // Invisibility: "creatures making Alertness (Perception) Skill Tests notice you have a Snag".
  if (target && rolledSkill == 'alertness' && !dinoState(actor, 'auraReading')
    && (dinoState(target, 'camouflage') || dinoState(target, 'invisibility'))) {
    sources.push({ id: 'zord1Camouflage', label: T('Zord1DinoHidden', { name: target.name }), snag: true });
  }

  // Shield Propulsion (jump): "granting you an Edge and a specialty on your Athletics Skill Test."
  if (rolledSkill == 'athletics' && dinoState(actor, 'shieldPropulsionJump')) {
    sources.push({ id: 'zord1Propulsion', label: T('Zord1DinoShieldPropulsion'), edge: true });
    consumes.push({ ext: 'zord1Dino', actorUuid: actor.uuid, power: 'shieldPropulsionJump' });
  }

  // Superhuman Strength: "You have a ↑2 shift on your next Brawn Skill Test".
  if (rolledSkill == 'brawn' && dinoState(actor, 'superhumanStrength')) {
    sources.push({ id: 'zord1SuperStrength', label: T('Zord1DinoSuperhumanStrength'), shiftUp: 2 });
    consumes.push({ ext: 'zord1Dino', actorUuid: actor.uuid, power: 'superhumanStrength' });
  }

  // Ptera Scream: each scream costs 1 Personal Power.
  if (isAttack && flagOf(parentWeaponOf(actor, item), 'zord1PteraScream')) {
    consumes.push({ ext: 'zord1PteraPower', actorUuid: actor.uuid });
  }
}

function dinoToggles(actor, rolledSkill, toggles) {
  // Mind Reading: "granting you Edge on Alertness (Insight) Skill Tests" - only when reading thoughts.
  if (rolledSkill == 'alertness' && dinoState(actor, 'mindReading')) {
    toggles.push({ name: 'zord1MindReading', type: 'checkbox', label: T('Zord1ToggleMindReading'), value: true });
  }
}

async function dinoApplyDialog(actor, options, { rolledSkill } = {}) {
  if (options.ext?.zord1MindReading) {
    giveEdge(options);
  }

  if (dinoState(actor, 'shieldPropulsionJump') && rolledSkill == 'athletics') {
    options.isSpecialized = true;
  }
}

async function dinoPostRoll(actor, checkContext) {
  // Invisibility: "Your invisibility also ends after you make an attack."
  if (checkContext?.isAttack && dinoState(actor, 'invisibility')) {
    await endDinoInvisibility(actor);
  }
}

async function endDinoInvisibility(actor) {
  await clearDino(actor, 'invisibility');
  if (actor.statuses?.has?.('invisible')) {
    await writeActor(actor, 'toggleStatusEffect', ['invisible', { active: false }]);
  }
}

function dinoDerived(actor) {
  const system = actor.system;
  // Tricera Skin: "gain +5 Toughness until the start of your next turn."
  if (dinoState(actor, 'triceraSkin') && system.defenses?.toughness) {
    system.defenses.toughness.total = (Number(system.defenses.toughness.total) || 0) + 5;
    system.defenses.toughness.string = `${system.defenses.toughness.string ?? ''} + 5 (${T('Zord1DinoTriceraSkin')})`;
  }

  // Shield Propulsion (move): "You may move double your Movement on your next Move action."
  if (dinoState(actor, 'shieldPropulsionMove') && system.movement) {
    for (const movement of Object.values(system.movement)) {
      if (movement && typeof movement == 'object' && Number(movement.total)) {
        movement.total = Number(movement.total) * 2;
      }
    }
  }
}

/** Shield Projection: "+5 to your defense... If anyone is within 5 feet of you, then your defense bonus also applies to them." */
export function dinoDefenseAdjust(attacker, defender, defenseType) {
  if (!['toughness', 'evasion'].includes(defenseType) || !defender) {
    return 0;
  }

  if (dinoState(defender, 'shieldProjection')) {
    return 5;
  }

  return worldActors().some(other => other !== defender && dinoState(other, 'shieldProjection') && feetBetween(other, defender) <= 5) ? 5 : 0;
}

/** Intangibility: "nothing can harm you" until the start of your next turn. */
export function dinoDamageModifier(actor, amount) {
  return dinoState(actor, 'intangibility') ? 0 : amount;
}

/** Invisibility: "If you take damage while invisible, then your invisibility ends." */
export async function dinoAfterDamage(actor, dealt) {
  if (dealt > 0 && dinoState(actor, 'invisibility')) {
    await endDinoInvisibility(actor);
  }
}

/**
 * Asks which Dino Thunder power a Perk gives and stores it as flags.essence20.zord1DinoPower - on the Dino Thunder
 * [Form] Perk, and on Extra Dino Thunder Form Power for the second power (module/items/forms/dino-thunder-grid-powers.mjs).
 * @param {Item} perk
 * @param {String[]} [exclude]   Powers not offered (the second power can't repeat the first).
 */
export async function pickDinoPower(perk, exclude = []) {
  const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
  const picked = await chooseSelect(perk.name, T('Zord1DinoPrompt'), DINO_POWERS.filter(value => !exclude.includes(value))
    .map(value => ({ value, label: T(`Zord1Dino${value.capitalize()}`) })));
  if (picked && DINO_POWERS.includes(picked)) {
    await perk.setFlag('essence20', 'zord1DinoPower', picked);
    if (picked == 'pteraScream') {
      await grantPteraScream(perk.parent, perk);
    }

    return picked;
  }

  return null;
}

/**
 * Ptera Scream (Targeting): Range 20ft/60ft; (2 Stun damage) Hands: 0 Traits: Area of Effect (30 ft
 * cone); Sonic - as a natural attack on the sheet.
 */
export async function grantPteraScream(actor, perk) {
  if (!actor || itemsOf(actor).some(item => flagOf(item, 'zord1PteraScream') == perk.id)) {
    return;
  }

  const id = foundry.utils.randomID();
  await actor.createEmbeddedDocuments('Item', [
    {
      _id: id, name: T('Zord1DinoPteraScream'), type: 'weapon',
      system: { classification: { size: 'integrated' }, availability: 'standard', equipped: true, hands: 0, hardpoint: { type: 'none' }, traits: ['area', 'sonic', 'stun'] },
      flags: { essence20: { natural: true, zord1PteraScream: perk.id, grantedBy: perk.id } },
    },
    {
      name: T('Zord1DinoPteraScream'), type: 'weaponEffect',
      system: {
        classification: { skill: 'targeting', style: 'projectile' }, damageType: 'stun', damageValue: 2, numTargets: 1, numHands: '0',
        range: { value: 20, long: 60 },
      },
      flags: { essence20: { parentId: id } },
    },
  ], { keepId: true });
}

/** The Dino Thunder power's Use: pay 1 Personal Power and switch it on. */
async function runDinoPower(item, economy, pay) {
  const actor = item.parent;
  let power = flagOf(item, 'zord1DinoPower');
  if (!power) {
    power = await pickDinoPower(item);
    return power ? T('Zord1DinoChosen', { name: actor.name, power: T(`Zord1Dino${power.capitalize()}`) }) : null;
  }

  return (await activateDinoPower(actor, item, power, { pay })) ? T('Zord1DinoUsed', { name: actor.name, power: T(`Zord1Dino${power.capitalize()}`) }) : null;
}

/**
 * Switches one Dino Thunder power on for `actor` - its picks, action cost, Personal Power and effect. Used by the
 * Form's own Use and by the Grid Powers built on it (Dino Thunder Boost, Extra Dino Thunder Form Power, White Ranger
 * Extra Dino Thunder), which pay from the Boost pool / pay once for both powers through `spend`.
 * @param {Actor} actor
 * @param {Item} perk                 The Perk the power is on (Ptera Scream's weapon is granted by it).
 * @param {String} power              One of DINO_POWERS.
 * @param {Object} [opts]
 * @param {Function} [opts.pay]       async (actionCost) => Boolean - the action economy payment.
 * @param {Function} [opts.spend]     async (personalPower) => Boolean - defaults to spending Personal Power.
 * @returns {Promise<Boolean>}        Whether the power went off.
 */
export async function activateDinoPower(actor, perk, power, { pay = async () => true, spend = n => spendPower(actor, n) } = {}) {
  if (!DINO_POWERS.includes(power)) {
    return false;
  }

  const label = T(`Zord1Dino${power.capitalize()}`);
  if (power == 'pteraScream') {
    await grantPteraScream(actor, perk);
    ui.notifications.info(T('Zord1PteraUseWeapon'));
    return false;
  }

  // Shield Propulsion picks its use first; the rest go straight to the spend.
  let variant = null;
  if (power == 'shieldPropulsion') {
    variant = await choose(label, T('Zord1DinoPropulsionPrompt'), [['move', T('Zord1DinoPropulsionMove')], ['jump', T('Zord1DinoPropulsionJump')]]);
    if (!variant) {
      return false;
    }
  }

  const actionCost = { shieldPropulsion: 'standard', tRexSpeed: 'standard', visualTeleportation: 'move' }[power] ?? 'free';
  let point = null;
  if (power == 'tRexSpeed' || power == 'visualTeleportation') {
    const { pickCanvasPoint } = await import("../../mechanics/combat/forced-movement.mjs");
    point = await pickCanvasPoint(T('Zord1DinoPickPoint'));
    if (!point) {
      return false;
    }

    // T-Rex Speed: "disappear and reappear in any area within 30 feet".
    const from = tokenCenter(actor);
    const dims = globalThis.canvas?.dimensions;
    if (power == 'tRexSpeed' && from && dims?.size && Math.hypot(point.x - from.x, point.y - from.y) / dims.size * (dims.distance ?? 5) > 30.5) {
      ui.notifications.warn(T('Zord1DinoTooFar'));
      return false;
    }
  }

  if (!(await pay(actionCost))) {
    return false;
  }

  // Replication: "You may spend an extra Personal Power to either create an additional hologram or to
  // make all holograms 'solid'."
  let cost = 1;
  if (power == 'replication') {
    const extra = await choose(label, T('Zord1DinoReplicationPrompt'), [['1', T('Zord1DinoReplicationOne')], ['2', T('Zord1DinoReplicationTwo')]]);
    cost = extra == '2' ? 2 : 1;
  }

  if (!(await spend(cost))) {
    return false;
  }

  switch (power) {
  case 'auraReading':
    // "The psychometry ends at the end of your next turn after activating it."
    {
      const stamp = untilNextTurnStamp(actor, getSceneEpoch());
      await setDino(actor, power, stamp.untilTurn == null ? stamp : { ...stamp, untilTurn: stamp.untilTurn + 1 });
    }

    break;
  case 'camouflage':
  case 'mindReading':
    await setDino(actor, power, sceneStamp());
    break;
  case 'invisibility':
    await setDino(actor, power, sceneStamp());
    await writeActor(actor, 'toggleStatusEffect', ['invisible', { active: true }]);
    break;
  case 'intangibility':
  case 'shieldProjection':
  case 'triceraSkin':
    await setDino(actor, power, untilNextTurnStamp(actor, getSceneEpoch()));
    break;
  case 'shieldPropulsion':
    await setDino(actor, variant == 'jump' ? 'shieldPropulsionJump' : 'shieldPropulsionMove', untilNextTurnStamp(actor, getSceneEpoch()));
    break;
  case 'superhumanStrength':
    await setDino(actor, power, sceneStamp());
    break;
  case 'tRexSpeed':
  case 'visualTeleportation': {
    const { placeActorAt } = await import("../../mechanics/combat/forced-movement.mjs");
    await placeActorAt(actor, point);
    break;
  }

  default:
    break;
  }

  return true;
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

// Every Form's start / end is its own Use rules.
const USES = [
  {
    id: 'zord1DinoThunder',
    matches: item => sourceOf(item) == FORM.dino,
    run: runDinoPower,
  },
];

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(formRollSources);
registerDialogToggles(formToggles);
registerApplyDialog(formApplyDialog);
registerPostRoll(formPostRoll);
registerDerived(formDerived);
registerDefenseAdjust(dinoDefenseAdjust);
registerDamageModifier(dinoDamageModifier);
registerAfterDamage(dinoAfterDamage);
USES.forEach(registerUse);

registerConsumer('zord1Dino', async consume => {
  const actor = await fromUuid(consume.actorUuid);
  if (actor) {
    await clearDino(actor, consume.power);
  }
});

registerConsumer('zord1PteraPower', async consume => {
  const actor = await fromUuid(consume.actorUuid);
  if (actor) {
    await spendPower(actor, 1);
  }
});

// Morphing picks the Form; de-Morphing ends it. Only on the client that flipped the switch.
globalThis.Hooks?.on?.('updateActor', (actor, changes, options, userId) => {
  if (userId != globalThis.game?.user?.id) {
    return;
  }

  const morphed = changes?.system?.isMorphed;
  if (morphed === true) {
    promptForm(actor);
  } else if (morphed === false) {
    endForm(actor);
  }
});

// Beast Morpher, Ninja Storm and Dino Thunder ask for their animal / element / power when they land on a
// character.
globalThis.Hooks?.on?.('createItem', (item, options, userId) => {
  if (userId != globalThis.game?.user?.id || !item.parent) {
    return;
  }

  if (sourceOf(item) == FORM.dino && !flagOf(item, 'zord1DinoPower')) {
    pickDinoPower(item);
  }
});
