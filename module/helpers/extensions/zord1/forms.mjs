import {
  registerAfterDamage, registerApplyDialog, registerConsumer, registerDamageModifier, registerDefenseAdjust, registerDerived,
  registerDialogToggles, registerHitRider, registerPostRoll, registerRollSources, registerUse,
} from "../../extensions.mjs";
import { activateForRounds, getSceneEpoch, isActiveForRounds } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";
import { FORM_FLAG, activeForm, isFormActive } from "./form-state.mjs";
import {
  T, ats, bth, findSourced, flagOf, giveEdge, isBladeBlaster, isPowerWeapon, isStampLive, isUnarmed, itemsOf, jtt,
  parentWeaponOf, postLine, sourceOf, spendPower, untilNextTurnStamp, writeActor,
} from "./common.mjs";

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
 * Dino Thunder [Form] (Beneath the Helmet p.52) is different - "you can activate them in your
 * non-Morphed form" - so it's one chosen power with a Use button, not part of the Morph pick.
 */

export const FORM = {
  lightspeed: ats('E3WLZpN7iKL9uzeB'),
  solar: ats('4ksM4tGqdjuyPSj1'),
  supersonic: ats('Ylo4AY4LCHTXjuuE'),
  turbo: ats('JgHUKEslM51Kfz4L'),
  operator: jtt('nZYtfaowY0EH3Z0R'),
  timeForce: jtt('DHTCWLVAKNmtm2iu'),
  beast: bth('8FGJyvGaCOd8hrSA'),
  dino: bth('uh73qYz8bwDobLFh'),
  ninjaStorm: bth('Txv1ODlLKY91hPrA'),
};

const GEAR = {
  rescueBlaster: ats('rXaEYw1MX0Zqmp6N'),
  thermoBlaster: ats('yOltN3CfcfQ1qrxk'),
  vLancer: ats('CPk5vJmroY58l2ao'),
  gridwideCommunicator: ats('aVQzWhD1oKDTcApQ'),
  autoBlaster: ats('U4XFwXCXXceKtGEl'),
  turboBlade: ats('11McvXnnzKsD3OKo'),
  turboHandBlaster: ats('vQJbFtZMiJNEeyC3'),
  turboStarChargers: ats('cQwRkKPB8u6vXkv1'),
  turboThunderCannon: ats('DVXDYbXAtmRvwceC'),
  turboWindFire: ats('E0qqh4VuNqSfVKMb'),
  nitroBlaster: jtt('PaBwCwRPJ83dYT5y'),
  railSaber: jtt('LbdzQcgY043JTTGy'),
  cloudHatchet: jtt('RNP5lNTQLostQKSB'),
  chronoBlaster: jtt('tAxCAj2iVqOXjN11'),
  chronoSaber: jtt('CZJlfyDUzfHVvUVT'),
  chronoCommunicator: jtt('gWgDokhQPxkFn3Xl'),
  timeBadge: jtt('nOL0Tboa6GOHHaWm'),
  visualScanner: jtt('1oQ2HaKfSyiSDZee'),
  electroBooster: jtt('YDAaxYbW8mr1Z0JT'),
  vectorWeapon: jtt('eUyE0OQ55s1o1IsJ'),
};

const GRANT_FLAG = 'zord1FormGrant';
const ELEMENTS = ['acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic'];

/**
 * What each Morph-time Form does on activation. cost: Personal Power. swaps: {replaces: 'blaster' |
 * 'power' | 'both', uuids, pick}. grants: gear handed over for the duration.
 */
export function formSpec(actor, uuid) {
  switch (uuid) {
  case FORM.lightspeed:
    // "Replace your Targeting-based weapon with a Rescue Blaster or Thermo Blaster. Replace your Power
    // Weapon with a V-Lancer."
    return { key: 'lightspeed', cost: 1, swaps: [
      { replaces: 'blaster', pick: [GEAR.rescueBlaster, GEAR.thermoBlaster] },
      { replaces: 'power', uuids: [GEAR.vLancer] },
    ] };
  case FORM.solar:
    // "you may change its damage to an Elemental damage type of your choice" - picked at activation.
    return { key: 'solar', cost: 1, element: true, swaps: [] };
  case FORM.supersonic:
    // "Your Morphed shell automatically contains a Gridwide Communicator."
    return { key: 'supersonic', cost: 1, swaps: [], grants: [GEAR.gridwideCommunicator] };
  case FORM.turbo:
    // "Replace your Blade Blaster with an Auto Blaster and Turbo Blade. Replace your Power Weapon with a
    // Targeting-based Turbo Weapon."
    return { key: 'turbo', cost: 1, swaps: [
      { replaces: 'blaster', uuids: [GEAR.autoBlaster, GEAR.turboBlade] },
      { replaces: 'power', pick: [GEAR.turboHandBlaster, GEAR.turboStarChargers, GEAR.turboThunderCannon, GEAR.turboWindFire] },
    ] };
  case FORM.operator:
    // "If you are a Core Ranger Spectrum Role, replace your Blade Blaster with a Nitro Blaster... your
    // standard Power Weapon with a Rail Saber. If you are an Advanced Spectrum Role, replace your Blade
    // Blaster and standard Power Weapon with a Cloud Hatchet." (The RPM Morpher is the Form's premise.)
    return { key: 'operator', cost: 0, swaps: isAdvancedRole(actor)
      ? [{ replaces: 'both', uuids: [GEAR.cloudHatchet] }]
      : [{ replaces: 'blaster', uuids: [GEAR.nitroBlaster] }, { replaces: 'power', uuids: [GEAR.railSaber] }] };
  case FORM.timeForce:
    // "You replace your Blade Blaster with a Chrono Blaster... your standard Power Weapon with a pair of
    // Chrono Sabers... your Wrist Communicator with a Chrono Communicator, Time Badge, and Visual Scanner."
    return { key: 'timeForce', cost: 0, swaps: [
      { replaces: 'blaster', uuids: [GEAR.chronoBlaster] },
      { replaces: 'power', uuids: [GEAR.chronoSaber] },
    ], grants: [GEAR.chronoCommunicator, GEAR.timeBadge, GEAR.visualScanner] };
  case FORM.beast:
    return { key: 'beast', cost: 0, swaps: [] };
  case FORM.ninjaStorm:
    // Ninja Storm Wind Ranger (Beneath the Helmet p.57): "You can spend 1 Personal Power in
    // conjunction with your 'It's Morphin Time!' Spectrum Role Feature to activate your Ninja Storm
    // power." Its effects are in formDerived (movement, Duplication), a rule on the pack item (Stealth),
    // formToggles (the mind-control Snag) and the Use button (its element - see Ninja Storm below).
    return { key: 'ninjaStorm', cost: 1, swaps: [] };
  default:
    return null;
  }
}

const MORPH_FORMS = [FORM.lightspeed, FORM.solar, FORM.supersonic, FORM.turbo, FORM.operator, FORM.timeForce, FORM.beast, FORM.ninjaStorm];

function isAdvancedRole(actor) {
  return !!itemsOf(actor).find(item => item.type == 'role')?.system?.isAdvanced;
}

/** The Form Perks this actor holds that come with the Morph. */
export function heldForms(actor) {
  return MORPH_FORMS.filter(uuid => findSourced(actor, uuid));
}

export { activeForm, isFormActive };

/* -------------------------------------------- */
/*  Activating and ending a Form                 */
/* -------------------------------------------- */

async function choose(title, prompt, rows) {
  const { chooseButtons } = await import("../../grants.mjs");
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
    const { chooseSelect } = await import("../../grants.mjs");
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
  const { grantCopy } = await import("../../grants.mjs");
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

  // Ninja Storm's element (and an Earth duplicate) go with the Morph.
  for (const key of [NINJA_ACTIVE_FLAG, NINJA_DUPLICATE_FLAG]) {
    if (flagOf(actor, key)) {
      await actor.unsetFlag('essence20', key);
    }
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

// One-shot choices made in the dialog, read back by this client's hit riders for the same roll.
const pendingHit = new Map();
// A Snag owed on someone's next roll (Cheetah's vortex: "a Strength (Athletics) Skill Test with Snag").
export const pendingSnag = new Set();

export function formRollSources(actor, target, ctx = {}) {
  const sources = [];
  const consumes = [];
  const { rolledSkill } = ctx;
  // Solar Power's Resistance to Cold and Energy (a Snag on the attack), Ninja Storm's ↑1 on
  // Infiltration, Supersonic's Xenotech weapon Edge and Beast Morpher's Gorilla ↑2 on Brawn are rules on
  // their pack items, gated on the active Form (flags.essence20.zord1Form).

  // Supersonic: "You suffer no penalties for using Xenotech of any kind." Gives back the Xenotech armor
  // ↓1 on Athletics/Acrobatics, one per worn piece.
  if (isFormActive(actor, FORM.supersonic) && ['athletics', 'acrobatics'].includes(rolledSkill)) {
    const worn = itemsOf(actor).filter(i => i.type == 'armor' && i.system?.equipped && i.system?.traits?.includes?.('xenotech')).length;
    if (worn) {
      sources.push({ id: 'zord1SupersonicXenoArmor', label: findSourced(actor, FORM.supersonic).name, shiftUp: worn });
    }
  }

  // Jackrabbit's Hang-Up: "you have a Snag on all Skill Tests until you can use a Standard action to
  // consume carrots." Lasts until the Use button clears it.
  if (flagOf(actor, 'zord1Carrots')) {
    sources.push({ id: 'zord1Carrots', label: T('Zord1JackrabbitExhausted'), snag: true });
  }

  if (actor?.uuid && pendingSnag.has(actor.uuid)) {
    sources.push({ id: 'zord1Vortex', label: T('Zord1CheetahVortex'), snag: true });
    consumes.push({ ext: 'zord1PendingSnag', actorUuid: actor.uuid });
  }

  dinoRollSources(actor, target, ctx, sources, consumes);
  return { sources, consumes };
}

export function formToggles(actor, { item, rolledSkill } = {}) {
  const toggles = [];
  // Lightspeed Response's healing Edge (pre-ticked on Science/Technology), Solar Power's Alertness
  // Edge, Time Force's time-travel Edge and Beast Morpher's Jackrabbit jump are DialogSwitch rules on
  // their pack items.

  // Supersonic: "All of your unarmed Attacks may inflict Energy damage."
  if (isFormActive(actor, FORM.supersonic) && isUnarmed(actor, item)) {
    toggles.push({ name: 'zord1SupersonicEnergy', type: 'checkbox', label: T('Zord1ToggleSupersonicEnergy') });
  }

  // Ninja Storm Wind Ranger: "Any attempts to control your mind suffer Snag." It's the TARGET's Form, and
  // only the roller knows the roll is a mind-control attempt, so it's a switch offered whenever a
  // targeted creature has the Form active.
  const ninja = targetedActors().find(target => target !== actor && isFormActive(target, FORM.ninjaStorm));
  if (ninja) {
    toggles.push({ name: 'zord1NinjaMind', type: 'checkbox', label: T('Zord1ToggleNinjaMind', { name: ninja.name }) });
  }

  dinoToggles(actor, rolledSkill, toggles);
  return toggles;
}

export async function formApplyDialog(actor, options, ctx = {}) {
  const ext = options.ext ?? {};
  if (ext.zord1NinjaMind) {
    giveSnag(options);
  }

  if (ext.zord1SupersonicEnergy && actor?.uuid) {
    pendingHit.set(actor.uuid, { supersonicEnergy: true });
  }

  await dinoApplyDialog(actor, options, ctx);
}

/** Damage changes the active Form makes to a landed hit. */
export async function formHitRider(actor, target, result, rider, tools) {
  const weapon = rider?.weaponId ? actor?.items?.get?.(rider.weaponId) : null;
  const pending = actor?.uuid ? pendingHit.get(actor.uuid) : null;

  if (isFormActive(actor, FORM.solar) && weapon) {
    const name = findSourced(actor, FORM.solar).name;
    const effectSkill = rider?.skill ?? null;
    if (isPowerWeapon(weapon) && !weapon.name?.includes?.('Blaster')) {
      // "Your Power Weapon deals 1 additional damage, and you may change its damage to an Elemental
      // damage type of your choice."
      tools.damageBonusNote(result, 1, name);
      const element = activeForm(actor)?.element;
      if (element) {
        result.damageType = element;
        result.damageTypeLabel = game.i18n.localize(CONFIG.E20?.damageTypes?.[element] ?? element);
      }
    } else if (weapon.name?.includes?.('Blaster') || effectSkill == 'targeting') {
      // "Your standard Targeting-based weapon... inflicts 1 additional Fire damage."
      tools.addRiderOption(result, { key: 'zord1SolarFire', label: name, damageValue: 1, damageType: 'fire' });
    }
  }

  if (isFormActive(actor, FORM.supersonic)) {
    // "Your Blade Blaster inflicts Sonic damage."
    if (isBladeBlaster(weapon)) {
      result.damageType = 'sonic';
      result.damageTypeLabel = game.i18n.localize(CONFIG.E20?.damageTypes?.sonic ?? 'sonic');
    } else if (!weapon && pending?.supersonicEnergy) {
      result.damageType = 'element';
      result.damageTypeLabel = game.i18n.localize(CONFIG.E20?.damageTypes?.element ?? 'element');
    }
  }
}

/** Beast Morpher Hang-Ups triggered by a Fumble, plus cleanup of this roll's pending choices. */
export async function formPostRoll(actor, results, checkContext, { isFumble } = {}) {
  if (actor?.uuid) {
    pendingHit.delete(actor.uuid);
  }

  await dinoPostRoll(actor, checkContext);
  if (!isFumble || !isFormActive(actor, FORM.beast)) {
    return;
  }

  const beast = beastChoice(actor);
  if (beast == 'gorilla' && game.combat?.started) {
    // "When you fumble during combat, you become enraged and unreasonable - attacking the nearest
    // creature whether they're friend or foe. You can either cool down over the course of 1d4 rounds..."
    const roll = await new Roll('1d4').evaluate();
    await actor.setFlag('essence20', 'zord1Berserk', { combatId: game.combat.id, untilRound: game.combat.round + roll.total });
    await postLine(actor, T('Zord1GorillaBerserk', { name: actor.name, rounds: roll.total }));
  } else if (beast == 'jackrabbit') {
    // "Whenever you roll a Fumble, you have a Snag on all Skill Tests until you can use a Standard
    // action to consume carrots."
    await actor.setFlag('essence20', 'zord1Carrots', true);
    await postLine(actor, T('Zord1JackrabbitFumble', { name: actor.name }));
  }
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
  // +20 Ground and Gorilla +2 Health, and Ninja Storm's doubled Ground are rules on their pack items.

  // Earth's Duplication: "this reduces the Health of both you and your duplicate by 1" while split.
  if (isNinjaDuplicated(actor) && system.health) {
    system.health.max = Math.max(0, (Number(system.health.max) || 0) - 1);
  }

  dinoDerived(actor);
}

/* -------------------------------------------- */
/*  Beast Morpher                                */
/* -------------------------------------------- */

export const BEAST_OPTIONS = ['cheetah', 'gorilla', 'jackrabbit'];

export function beastChoice(actor) {
  return flagOf(findSourced(actor, FORM.beast), 'zord1Beast') ?? null;
}

async function pickBeast(perk) {
  const picked = await choose(perk.name, T('Zord1BeastPrompt'), BEAST_OPTIONS.map(key => [key, T(`Zord1Beast${key.capitalize()}`)]));
  if (picked && BEAST_OPTIONS.includes(picked)) {
    await perk.setFlag('essence20', 'zord1Beast', picked);
    return picked;
  }

  return null;
}

/* -------------------------------------------- */
/*  Ninja Storm Wind Ranger [Form]               */
/* -------------------------------------------- */

/**
 * Ninja Storm Wind Ranger (Beneath the Helmet p.55): "When you first take this Perk, you must choose
 * which element is connected to you" - kept on the Perk, asked when it lands on a character (or from its
 * Use button). "Activating your element requires an extra 1 Personal Power and lasts for 3 rounds" - a
 * Use button row while the Form is active, timed with the Scene Clock's round counter (the rest of the
 * encounter out of combat). While it runs, the Use button offers what the element can do on the table:
 * Air Blast and Water Blast roll their Targeting test against the target, Earth's Duplication splits off
 * a duplicate (-1 Health while split). Aerial movement, Burrowing, Shape Earth/Water and Walk on Water
 * are narrative and left to the table, as is the duplicate's own token.
 */
export const NINJA_ELEMENTS = ['air', 'earth', 'water'];
const NINJA_ELEMENT_FLAG = 'zord1NinjaElement';
const NINJA_ACTIVE_FLAG = 'zord1NinjaElementOn';
const NINJA_DUPLICATE_FLAG = 'zord1NinjaDuplicate';
// Air Blast / Water Blast: "Choose a creature within 30 feet".
const NINJA_BLAST_RANGE = 30;

const elementLabel = element => T(`Zord1NinjaElement${element.capitalize()}`);

/** The element chosen for this actor's Ninja Storm Wind Ranger Perk, or null. */
export function ninjaElement(actor) {
  return flagOf(findSourced(actor, FORM.ninjaStorm), NINJA_ELEMENT_FLAG) ?? null;
}

/** Whether the Ninja Storm element is running: the Form is active and its 3 rounds haven't run out. */
export function isNinjaElementActive(actor) {
  return isFormActive(actor, FORM.ninjaStorm) && !!ninjaElement(actor) && isActiveForRounds(actor, NINJA_ACTIVE_FLAG);
}

/** Earth's Duplication is split off - it ends with the element. */
export function isNinjaDuplicated(actor) {
  return !!flagOf(actor, NINJA_DUPLICATE_FLAG) && ninjaElement(actor) == 'earth' && isNinjaElementActive(actor);
}

async function pickNinjaElement(perk) {
  const picked = await choose(perk.name, T('Zord1NinjaElementPrompt'), NINJA_ELEMENTS.map(key => [key, elementLabel(key)]));
  if (picked && NINJA_ELEMENTS.includes(picked)) {
    await perk.setFlag('essence20', NINJA_ELEMENT_FLAG, picked);
    return picked;
  }

  return null;
}

function targetedActors() {
  const targets = globalThis.game?.user?.targets;
  return targets ? [...targets].map(token => token?.actor).filter(Boolean) : [];
}

/** giveEdge's mirror: a Snag cancels an Edge first. */
function giveSnag(options) {
  if (options.edge) {
    options.edge = false;
  } else {
    options.snag = true;
  }
}

/** The Use button rows the Ninja Storm Form adds while it's active. */
function ninjaRows(actor) {
  const element = ninjaElement(actor);
  if (!element) {
    return [];
  }

  if (!isNinjaElementActive(actor)) {
    return [['ninjaElement', T('Zord1NinjaElementStart', { element: elementLabel(element) })]];
  }

  if (element == 'air') {
    return [['airBlast', T('Zord1NinjaAirBlast')]];
  }

  if (element == 'water') {
    return [['waterBlast', T('Zord1NinjaWaterBlast')]];
  }

  return [flagOf(actor, NINJA_DUPLICATE_FLAG) ? ['ninjaMerge', T('Zord1NinjaMerge')] : ['ninjaDuplicate', T('Zord1NinjaDuplicate')]];
}

async function startNinjaElement(actor) {
  if (!(await spendPower(actor, 1))) {
    return null;
  }

  await activateForRounds(actor, NINJA_ACTIVE_FLAG, 3);
  return T('Zord1NinjaElementStarted', { name: actor.name, element: elementLabel(ninjaElement(actor)) });
}

/**
 * Air Blast: "As a Standard action... Choose a creature within 30 feet and make a Targeting (Energy)
 * Skill Test against their Toughness. If you hit, the creature is knocked prone."
 * Water Blast: "...make a Targeting (Energy) Skill Test against them. If you hit, you inflict 2 Stun."
 * The book names no Defense for Water Blast; it's rolled against Evasion, the usual one for a ranged shot.
 */
async function ninjaBlast(actor, kind, pay) {
  const target = targetedActors()[0];
  if (!target) {
    ui.notifications.warn(T('Zord1PickTarget'));
    return null;
  }

  const distance = feetBetween(actor, target);
  if (Number.isFinite(distance) && distance > NINJA_BLAST_RANGE + 0.5) {
    ui.notifications.warn(T('Zord1DinoTooFar'));
    return null;
  }

  if (!(await pay('standard'))) {
    return null;
  }

  const defense = kind == 'air' ? 'toughness' : 'evasion';
  const dif = Number(target.system?.defenses?.[defense]?.total) || 0;
  const { rollTest } = await import("../../grants.mjs");
  const { success } = await rollTest(actor, 'targeting', dif);
  if (!success) {
    return T('Zord1NinjaBlastMiss', { name: actor.name, target: target.name });
  }

  if (kind == 'air') {
    await writeActor(target, 'toggleStatusEffect', ['prone', { active: true }]);
    return T('Zord1NinjaAirBlastHit', { name: actor.name, target: target.name });
  }

  // Whoever owns the target (usually the GM) applies the Stun with the shared damage button.
  const button = `<button type="button" data-e20-ext="o1ApplyDamage" data-target-uuid="${target.uuid}" data-amount="2" data-damage-type="stun">${T('O1ApplyDamageButton')}</button>`;
  return `${T('Zord1NinjaWaterBlastHit', { name: actor.name, target: target.name })} ${button}`;
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

async function pickDinoPower(perk) {
  const { chooseSelect } = await import("../../grants.mjs");
  const picked = await chooseSelect(perk.name, T('Zord1DinoPrompt'), DINO_POWERS.map(value => ({ value, label: T(`Zord1Dino${value.capitalize()}`) })));
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

  const label = T(`Zord1Dino${power.capitalize()}`);
  if (power == 'pteraScream') {
    await grantPteraScream(actor, item);
    ui.notifications.info(T('Zord1PteraUseWeapon'));
    return null;
  }

  // Shield Propulsion picks its use first; the rest go straight to the spend.
  let variant = null;
  if (power == 'shieldPropulsion') {
    variant = await choose(label, T('Zord1DinoPropulsionPrompt'), [['move', T('Zord1DinoPropulsionMove')], ['jump', T('Zord1DinoPropulsionJump')]]);
    if (!variant) {
      return null;
    }
  }

  const actionCost = { shieldPropulsion: 'standard', tRexSpeed: 'standard', visualTeleportation: 'move' }[power] ?? 'free';
  let point = null;
  if (power == 'tRexSpeed' || power == 'visualTeleportation') {
    const { pickCanvasPoint } = await import("../../forced-movement.mjs");
    point = await pickCanvasPoint(T('Zord1DinoPickPoint'));
    if (!point) {
      return null;
    }

    // T-Rex Speed: "disappear and reappear in any area within 30 feet".
    const from = tokenCenter(actor);
    const dims = globalThis.canvas?.dimensions;
    if (power == 'tRexSpeed' && from && dims?.size && Math.hypot(point.x - from.x, point.y - from.y) / dims.size * (dims.distance ?? 5) > 30.5) {
      ui.notifications.warn(T('Zord1DinoTooFar'));
      return null;
    }
  }

  if (!(await pay(actionCost))) {
    return null;
  }

  // Replication: "You may spend an extra Personal Power to either create an additional hologram or to
  // make all holograms 'solid'."
  let cost = 1;
  if (power == 'replication') {
    const extra = await choose(label, T('Zord1DinoReplicationPrompt'), [['1', T('Zord1DinoReplicationOne')], ['2', T('Zord1DinoReplicationTwo')]]);
    cost = extra == '2' ? 2 : 1;
  }

  if (!(await spendPower(actor, cost))) {
    return null;
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
    const { placeActorAt } = await import("../../forced-movement.mjs");
    await placeActorAt(actor, point);
    break;
  }

  default:
    break;
  }

  return T('Zord1DinoUsed', { name: actor.name, power: label });
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

async function runFormUse(item, economy, pay) {
  const actor = item.parent;
  const uuid = sourceOf(item);
  const spec = formSpec(actor, uuid);
  const active = isFormActive(actor, uuid);
  const rows = [];

  if (uuid == FORM.beast && !beastChoice(actor)) {
    const picked = await pickBeast(item);
    return picked ? T('Zord1BeastChosen', { name: actor.name, beast: T(`Zord1Beast${picked.capitalize()}`) }) : null;
  }

  if (uuid == FORM.ninjaStorm && !ninjaElement(actor)) {
    const picked = await pickNinjaElement(item);
    return picked ? T('Zord1NinjaElementChosen', { name: actor.name, element: elementLabel(picked) }) : null;
  }

  if (actor.system?.isMorphed) {
    rows.push(active ? ['end', T('Zord1FormEnd')] : ['start', spec.cost ? T('Zord1FormStartCost', { cost: spec.cost }) : T('Zord1FormStart')]);
  }

  if (active && uuid == FORM.turbo) {
    // "You may spend 1 Personal Power to summon a Turbo Cart (PR CRB p.129) of your Ranger Spectrum color."
    rows.push(['turboCart', T('Zord1TurboCart')]);
  }

  if (active && uuid == FORM.timeForce) {
    // "You may spend 1 Personal Power to convert your Chrono Sabers into an Electro Booster." / "...to
    // summon a Vector Weapon of your choice until the end of the scene."
    rows.push(['electroBooster', T('Zord1ElectroBooster')], ['vectorWeapon', T('Zord1VectorWeapon')]);
  }

  if (active && uuid == FORM.beast) {
    const beast = beastChoice(actor);
    if (beast == 'cheetah') {
      rows.push(['vortex', T('Zord1CheetahVortex')], ['dog', T('Zord1CheetahDog')]);
    }

    if (beast == 'gorilla' && flagOf(actor, 'zord1Berserk')) {
      rows.push(['calm', T('Zord1GorillaCalm')]);
    }
  }

  if (active && uuid == FORM.ninjaStorm) {
    rows.push(...ninjaRows(actor));
  }

  if (flagOf(actor, 'zord1Carrots')) {
    rows.push(['carrots', T('Zord1JackrabbitCarrots')]);
  }

  if (!rows.length) {
    ui.notifications.warn(T('Zord1FormNeedsMorph'));
    return null;
  }

  const choice = rows.length == 1 ? rows[0][0] : await choose(item.name, T('Zord1FormUsePrompt'), rows);
  switch (choice) {
  case 'start':
    await activateForm(actor, uuid);
    return null;
  case 'end':
    await endForm(actor);
    return T('Zord1FormEnded', { name: actor.name, form: item.name });
  case 'turboCart':
    if (!(await spendPower(actor, 1))) {
      return null;
    }

    return T('Zord1TurboCartSummoned', { name: actor.name });
  case 'electroBooster':
  case 'vectorWeapon': {
    if (!(await spendPower(actor, 1))) {
      return null;
    }

    const { grantCopy, temporary } = await import("../../grants.mjs");
    if (choice == 'electroBooster') {
      const sabers = itemsOf(actor).filter(i => flagOf(i, GRANT_FLAG) == FORM.timeForce && sourceOf(i) == GEAR.chronoSaber);
      if (sabers.length) {
        await actor.updateEmbeddedDocuments('Item', sabers.map(s => ({ _id: s.id, 'system.equipped': false })));
      }
    }

    const created = await grantCopy(actor, choice == 'electroBooster' ? GEAR.electroBooster : GEAR.vectorWeapon, {
      grantedBy: item, flags: { [GRANT_FLAG]: FORM.timeForce }, temporary: choice == 'vectorWeapon' ? temporary('scene') : null,
    });
    return created ? T('Zord1GearGained', { name: actor.name, gear: created.name }) : null;
  }

  case 'vortex':
    return cheetahVortex(actor, pay);
  case 'dog': {
    // "When you encounter a dog... for the first time in a scene, you must make a DIF 10 basic d20 roll or
    // be stunned until the end of your turn."
    const roll = await new Roll('1d20').evaluate();
    if (roll.total < 10) {
      const { applyTimedCondition } = await import("../../timed-status.mjs");
      await applyTimedCondition(actor, 'stunned', 1);
      return T('Zord1CheetahDogFail', { name: actor.name, total: roll.total });
    }

    return T('Zord1CheetahDogPass', { name: actor.name, total: roll.total });
  }

  case 'ninjaElement':
    return startNinjaElement(actor);
  case 'airBlast':
    return ninjaBlast(actor, 'air', pay);
  case 'waterBlast':
    return ninjaBlast(actor, 'water', pay);
  case 'ninjaDuplicate':
    // "You can split your body into two separate fighters" - the duplicate's own token is the table's.
    await actor.setFlag('essence20', NINJA_DUPLICATE_FLAG, true);
    return T('Zord1NinjaDuplicated', { name: actor.name });
  case 'ninjaMerge':
    await actor.unsetFlag('essence20', NINJA_DUPLICATE_FLAG);
    return T('Zord1NinjaMerged', { name: actor.name });
  case 'calm':
    await actor.unsetFlag('essence20', 'zord1Berserk');
    return T('Zord1GorillaCalmed', { name: actor.name });
  case 'carrots':
    if (!(await pay('standard'))) {
      return null;
    }

    await actor.unsetFlag('essence20', 'zord1Carrots');
    return T('Zord1JackrabbitAte', { name: actor.name });
  default:
    return null;
  }
}

/**
 * Cheetah: "As a Standard action, you can run around a creature and create a vortex. The victim must
 * make a Strength (Athletics) Skill Test with Snag against your Speed Essence score. If the roll
 * fails, then the victim is thrown 10 feet into the air and knocked prone."
 */
async function cheetahVortex(actor, pay) {
  const target = game.user?.targets?.first?.()?.actor;
  if (!target) {
    ui.notifications.warn(T('Zord1PickTarget'));
    return null;
  }

  if (!(await pay('standard'))) {
    return null;
  }

  const speed = Number(actor.system?.essences?.speed?.value ?? actor.system?.essences?.speed?.max) || 0;
  pendingSnag.add(target.uuid);
  const { rollTest } = await import("../../grants.mjs");
  const { success } = await rollTest(target, 'athletics', speed);
  pendingSnag.delete(target.uuid);
  if (!success) {
    await writeActor(target, 'toggleStatusEffect', ['prone', { active: true }]);
    return T('Zord1CheetahVortexHit', { name: actor.name, target: target.name });
  }

  return T('Zord1CheetahVortexMiss', { name: actor.name, target: target.name });
}

const USES = [
  {
    id: 'zord1Form',
    // Lightspeed Response keeps its existing Use (the 2 Personal Power heal, helpers/banked-buffs.mjs) -
    // an extension Use would replace it - so it's unlocked from the Morph prompt only.
    matches: item => MORPH_FORMS.includes(sourceOf(item)) && sourceOf(item) != FORM.lightspeed && item.parent?.type == 'playerCharacter',
    run: runFormUse,
  },
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
registerHitRider(formHitRider);
registerPostRoll(formPostRoll);
registerDerived(formDerived);
registerDefenseAdjust(dinoDefenseAdjust);
registerDamageModifier(dinoDamageModifier);
registerAfterDamage(dinoAfterDamage);
USES.forEach(registerUse);

registerConsumer('zord1PendingSnag', async consume => {
  pendingSnag.delete(consume.actorUuid);
});

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

  if (sourceOf(item) == FORM.beast && !flagOf(item, 'zord1Beast')) {
    pickBeast(item);
  } else if (sourceOf(item) == FORM.ninjaStorm && !flagOf(item, NINJA_ELEMENT_FLAG)) {
    pickNinjaElement(item);
  } else if (sourceOf(item) == FORM.dino && !flagOf(item, 'zord1DinoPower')) {
    pickDinoPower(item);
  }
});
