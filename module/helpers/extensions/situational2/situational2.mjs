import {
  registerApplyDialog, registerChatButton, registerConsumer, registerDefenseAdjust, registerDerived, registerDialogToggles,
  registerPostRoll, registerPreRoll, registerRollSources, registerRoundStart, registerSpecializes, registerUse,
} from "../../extensions.mjs";
import { getEmpathyChoice } from "../../tender.mjs";
import {
  S2, FLAG, deps, T, findById, has, wornGear, sceneOf, terrainOf, isInWater, isOnLand,
  isSeaOrWetlands, isAquaticVehicle, isAboardAquaticVessel, isCompleteDarkness,
  isStrexAgent, sameSide, parentWeapon, weaponHasUpgradeId, idOf, sourceOf,
} from "./common.mjs";
import { situationalInitiative, takeInASceneButton, misplacedConfidenceRound } from "./initiative.mjs";

/**
 * Situational items (Item Review "situational" group, slice 2) - rules that only apply in a place
 * (a town, the wild, the sea, a library, complete darkness), against someone (a StrexCorp agent, a
 * creature that attacked you, an ally who out-rolled you), or at the start of a fight (Surprise).
 *
 * Where the scene can answer (the GM-set terrain/environment - helpers/environment.mjs - the scene's
 * darkness level, a target's name or creature tags), the rule applies by itself as a labelled roll
 * source. Where it can't, the Roll Options Dialog offers a checkbox instead, so a table that never
 * tags its scenes still gets the rule.
 *
 * Initiative-time rules (Take in a Scene, Misplaced Confidence, Amphibious Assault, Shark's Fin and
 * the Tracking Outfit / Bookworm Initiative halves) live in initiative.mjs.
 */

const POISON_PATTERN = /poison|venom|toxi|disease|illness|sick|plague|infect/i;

/* -------------------------------------------- */
/*  Small helpers                               */
/* -------------------------------------------- */

async function writeFlag(doc, key, value) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, value === null ? 'unsetFlag' : 'setFlag', value === null ? ['essence20', key] : ['essence20', key, value]);
  }

  return value === null ? doc.unsetFlag('essence20', key) : doc.setFlag('essence20', key, value);
}

const isWeaponEffect = item => item?.type == 'weaponEffect';

/** Tritium Sights on the rolled weapon (attached upgrade, or the pre-built Rifle (Tritium Sight)). */
function hasTritium(actor, item) {
  const weapon = parentWeapon(actor, item);
  return !!weapon && (weaponHasUpgradeId(actor, weapon, S2.tritiumSights) || idOf(sourceOf(weapon)) == S2.rifleTritium);
}

/** A poison or illness attack/effect (Seafarer's Hang-Up). */
function isPoisonous(actor, item) {
  if (!item) {
    return false;
  }

  const weapon = parentWeapon(actor, item);
  return item.system?.damageType == 'poison' || !!weapon?.system?.isPoison
    || POISON_PATTERN.test(item.name ?? '') || POISON_PATTERN.test(weapon?.name ?? '');
}

/** A save roll (helpers/save-riders.mjs) against a poison or illness. */
function isPoisonSave(dataset) {
  if (!dataset?.riderSpec) {
    return false;
  }

  try {
    const rider = JSON.parse(dataset.riderSpec);
    const spec = rider?.kind == 'save' ? rider.spec : null;
    return !!spec && (spec.damage?.type == 'poison' || spec.damageAlways?.type == 'poison'
      || spec.status == 'poisoned' || POISON_PATTERN.test(spec.title ?? ''));
  } catch (error) {
    return false;
  }
}

/* -------------------------------------------- */
/*  Feet Wet / Ship Shape / Plow / Cartography  */
/* -------------------------------------------- */

function driversOf(vehicle) {
  return Object.values(vehicle?.system?.actors ?? {})
    .filter(entry => entry?.vehicleRole == 'driver')
    .map(entry => (typeof fromUuidSync == 'function' ? fromUuidSync(entry.uuid) : null))
    .filter(Boolean);
}

const drivenBy = (vehicle, id) => driversOf(vehicle).some(driver => has(driver, id, 'perk'));

/**
 * Feet Wet (Quartermaster's Guide p.25): "while on board an aquatic vessel or in a sea environment...
 * You ignore the penalties for moving through Rough Terrain. You gain Edge on non-combat Skill Tests,
 * and all your attacks in this environment are considered Specialized."
 * Ship Shape (p.25, 10th level): "your Feet Wet abilities now also function in wetlands
 * environments. Aquatic vehicles you drive also gain the benefits of Feet Wet..."
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isFeetWetActive(actor) {
  if (actor?.type == 'vehicle') {
    return isAquaticVehicle(actor) && drivenBy(actor, S2.shipShape);
  }

  if (!has(actor, S2.feetWet, 'perk')) {
    return false;
  }

  const terrain = terrainOf(actor);
  return terrain == 'sea' || isAboardAquaticVessel(actor) || (terrain == 'wetlands' && has(actor, S2.shipShape, 'perk'));
}

/** Plow holder for this Ram: the actor itself, or the driver of the vehicle making it. */
export function plowApplies(actor) {
  return has(actor, S2.plow, 'perk') || (actor?.type == 'vehicle' && drivenBy(actor, S2.plow));
}

/**
 * Plow (TF CRB, Warrior, 6th level, p.91): "when you make a Ram attack... your Ram attack gains
 * Multiple Targets (3)." Pushed onto multiple-targets.mjs's MULTIPLE_TARGETS_GRANTS.
 */
export function plowMultipleTargets(actor, item) {
  return isWeaponEffect(item) && !!item.system?.isRam && plowApplies(actor);
}

/** "...any movement you make this turn ignores Rough Terrain" - stamped when the Ram is rolled. */
export function isPlowRamActive(actor) {
  const stamp = actor?.flags?.essence20?.[FLAG.plowRam];
  const combat = game?.combat;
  if (!stamp) {
    return false;
  }

  if (!combat) {
    return stamp.combatId == null;
  }

  return stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn;
}

/**
 * Cartography Suite (Enigma of Combination, Cartographer Focus, p.36): "As long as you are given at
 * least 1 hour to look over an area... you receive several benefits when in that area. Your allies
 * also gain these benefits as long as they are within 60 feet of you." The survey is the Use button
 * below; "that area" is the scene it was made on.
 */
export function hasSurveyedHere(actor) {
  const survey = actor?.flags?.essence20?.[FLAG.survey];
  const scene = sceneOf(actor);
  return !!survey && !!scene && survey.sceneId == scene.id;
}

export function hasCartographyBenefits(actor) {
  if (has(actor, S2.cartographySuite, 'perk') && hasSurveyedHere(actor)) {
    return true;
  }

  return (deps.nearbyAllies?.(actor, 60) ?? [])
    .some(token => has(token.actor, S2.cartographySuite, 'perk') && hasSurveyedHere(token.actor));
}

/**
 * Lay of the Land (p.36): "when in the terrain you scouted for your Cartography Suite Focus Perk...
 * you are immune to the effects of Rough Terrain." (The Edge half is the item's own Active Effects.)
 */
export const layOfTheLandIgnoresRough = actor => has(actor, S2.layOfTheLand, 'perk') && hasSurveyedHere(actor);

/** Every Rough Terrain grant here, for rough-terrain.mjs's ROUGH_TERRAIN_IGNORERS. */
export function ignoresRoughTerrainS2(actor) {
  return isFeetWetActive(actor) || isPlowRamActive(actor) || layOfTheLandIgnoresRough(actor);
}

/* -------------------------------------------- */
/*  Roll sources                                */
/* -------------------------------------------- */

/**
 * @returns {{sources: Array, consumes: Array}}
 */
export function situational2RollSources(actor, target, ctx = {}) {
  const sources = [];
  const consumes = [];
  const { item, rolledSkill, dataset } = ctx;
  const isAttack = ctx.isAttack ?? isWeaponEffect(item);
  const add = (id, itemId, fallback, effect, type = null) => {
    sources.push({ id: `s2-${id}`, label: findById(actor, itemId, type)?.name ?? fallback, ...effect });
  };

  // Seafarer (Quartermaster's Guide, Influence Perk, p.12): "You gain Edge on Athletics (Swimming)
  // and Driving (Sea) Skill Tests." The Driving half is dice.mjs; this is the swimming half.
  if (rolledSkill == 'athletics' && has(actor, S2.seafarer, 'perk') && isInWater(actor)) {
    add('seafarerSwim', S2.seafarer, 'Seafarer', { edge: true }, 'perk');
  }

  // Seafarer's Hang-Up: "When on land, poisons and effects that cause illness gain Edge when they
  // target you, and you suffer Snag on Skill Tests to resist such effects."
  if (target && has(target, S2.seafarerHangUp, 'hangUp') && isPoisonous(actor, item) && isOnLand(target)) {
    sources.push({ id: 's2-seafarerPoison', label: findById(target, S2.seafarerHangUp, 'hangUp')?.name ?? 'Seafarer', edge: true });
  }

  if (has(actor, S2.seafarerHangUp, 'hangUp') && isPoisonSave(dataset) && isOnLand(actor)) {
    add('seafarerResist', S2.seafarerHangUp, 'Seafarer', { snag: true }, 'hangUp');
  }

  // Tritium Sights (Quartermaster's Guide, Weapon Upgrade, p.34): "Gain ↑1 on Attack Skill Tests in
  // complete darkness."
  if (isAttack && hasTritium(actor, item) && isCompleteDarkness(actor) === true) {
    sources.push({ id: 's2-tritium', label: T('S2TritiumLabel'), shiftUp: 1 });
  }

  // Feet Wet / Ship Shape - see isFeetWetActive. "Edge on non-combat Skill Tests."
  if (!isAttack && rolledSkill && isFeetWetActive(actor)) {
    const holder = actor.type == 'vehicle' ? S2.shipShape : S2.feetWet;
    sources.push({ id: 's2-feetWet', label: findById(actor, holder, 'perk')?.name ?? T('S2FeetWetLabel'), edge: true });
  }

  // Forgiving (MLP CRB, Spirit of Kindness, 14th level, p.83): "if you attempt an Empathy Skill Test
  // against a creature who acted aggressively towards you since the last time you attempted an
  // Empathy Skill Test against them, you get Edge on your roll." Aggression is logged by the
  // post-roll hook below whenever someone attacks or Intimidates the holder.
  const empathy = has(actor, S2.forgiving, 'perk') ? getEmpathyChoice(actor) : null;
  if (target && empathy && rolledSkill == empathy) {
    const aggressors = actor.flags?.essence20?.[FLAG.forgiving] ?? [];
    if (aggressors.includes(target.uuid)) {
      add('forgiving', S2.forgiving, 'Forgiving', { edge: true }, 'perk');
      consumes.push({ ext: 's2Forgiving', actorUuid: actor.uuid, aggressor: target.uuid });
    }
  }

  // Competitive (MLP CRB, Hang-Up, p.60): "When you and an ally roll the same Skill Test, if your ally
  // gets a higher result than you, you have Snag on your next Skill Test this scene." Banked by the
  // chat-message watcher below, spent here.
  const pending = actor?.flags?.essence20?.[FLAG.competitive];
  if (pending && has(actor, S2.competitive, 'hangUp') && pending.epoch == deps.getSceneEpoch()) {
    add('competitive', S2.competitive, 'Competitive', { snag: true }, 'hangUp');
    consumes.push({ ext: 's2Competitive', actorUuid: actor.uuid });
  }

  return { sources, consumes };
}

/* -------------------------------------------- */
/*  Dialog checkboxes for what the scene can't say */
/* -------------------------------------------- */

export function situational2Toggles(actor, ctx = {}) {
  const { item, rolledSkill, dataset } = ctx;
  const isAttack = isWeaponEffect(item);
  const toggles = [];

  if (rolledSkill == 'athletics' && has(actor, S2.seafarer, 'perk') && !isInWater(actor)) {
    toggles.push({ name: 's2SeafarerSwim', label: T('S2SeafarerSwimToggle'), type: 'checkbox', value: false });
  }

  if (!isPoisonSave(dataset) && ['conditioning', 'athletics', 'brawn'].includes(rolledSkill)
    && has(actor, S2.seafarerHangUp, 'hangUp') && isOnLand(actor)) {
    toggles.push({ name: 's2SeafarerResist', label: T('S2SeafarerResistToggle'), type: 'checkbox', value: false });
  }

  if (isAttack && hasTritium(actor, item) && isCompleteDarkness(actor) === null) {
    toggles.push({ name: 's2Tritium', label: T('S2TritiumToggle'), type: 'checkbox', value: false });
  }

  return toggles;
}

export function situational2ApplyDialog(actor, options) {
  const ext = options?.ext ?? {};
  if (ext.s2SeafarerSwim) {
    options.edge = true;
  }

  if (ext.s2SeafarerResist) {
    options.snag = true;
  }

  if (ext.s2Tritium) {
    options.shiftUp = (options.shiftUp ?? 0) + 1;
  }
}

/** Feet Wet: "all your attacks in this environment are considered Specialized." */
export function situational2Specializes(actor, skill, item) {
  return isWeaponEffect(item) && isFeetWetActive(actor);
}

/* -------------------------------------------- */
/*  Defenses and derived data                   */
/* -------------------------------------------- */

/**
 * Arctic / Desert Expedition clothes (GI Joe CRB & MLP CRB, Clothes, p.160): "Grants +2 Toughness
 * against cold [desert] environmental effects and exposure." Desert Gear (WTNV Citizens' Guide,
 * p.71): the same against desert exposure. Cold is an Extreme Cold environment or arctic terrain;
 * desert is desert terrain or an Extreme Heat environment.
 * @returns {?Item}   The clothes whose +2 applies here, or null.
 */
export function exposureClothes(actor) {
  if (!wornGear(actor, S2.arcticExpedition) && !wornGear(actor, S2.desertExpedition) && !wornGear(actor, S2.desertGear)) {
    return null;
  }

  const environment = deps.getEnvironment(actor);
  const terrain = terrainOf(actor);
  const cold = environment == 'extremeCold' || terrain == 'arctic';
  const hot = environment == 'extremeHeat' || terrain == 'desert';
  return (cold && wornGear(actor, S2.arcticExpedition))
    || (hot && (wornGear(actor, S2.desertExpedition) || wornGear(actor, S2.desertGear)))
    || null;
}

export function situational2Derived(actor) {
  const system = actor?.system;
  if (!system) {
    return;
  }

  // Exposure clothing: shown on Toughness while exposed (it's what an environmental effect is
  // tested against); taken back off again for creatures' attacks in the Defense adjust below.
  const toughness = system.defenses?.toughness;
  const clothes = toughness ? exposureClothes(actor) : null;
  if (clothes) {
    toughness.total += 2;
    toughness.string = `${toughness.string ?? ''} + 2 (${clothes.name})`;
  }

  // Shark's Fin (Quartermaster's Guide, Freebooter, 17th level, p.25): "double your Aquatic and
  // Ground Movement while aboard aquatic vessels, as well as in sea and wetlands environments."
  if (system.movement && has(actor, S2.sharksFin, 'perk') && isSeaOrWetlands(actor)) {
    for (const key of ['ground', 'swim']) {
      if (system.movement[key]) {
        system.movement[key].total = (system.movement[key].total ?? 0) * 2;
      }
    }
  }

  // Ship Shape (p.25): "Aquatic vehicles you drive also... increase their Movement by half (round
  // down)."
  if (actor.type == 'vehicle' && system.movement && isAquaticVehicle(actor) && drivenBy(actor, S2.shipShape)) {
    for (const movement of Object.values(system.movement)) {
      if (movement && typeof movement.total == 'number') {
        movement.total = Math.floor(movement.total * 1.5);
      }
    }
  }

  // Cartography Suite: "You and your allies may still take Move actions when Surprised."
  const move = system.actions?.move;
  const statuses = actor.statuses ?? new Set();
  if (move && move.max == 0 && statuses.has('surprised') && !statuses.has('cantTakeMoveActions')
    && !['asleep', 'defeated', 'stunned', 'unconscious'].some(status => statuses.has(status))
    && hasCartographyBenefits(actor)) {
    move.max = Math.max(0, (move.base ?? 1) + (move.bonus ?? 0));
  }
}

export function situational2DefenseAdjust(attacker, defender, defenseType) {
  let total = 0;
  // Exposure clothing doesn't help against a creature's attack (see situational2Derived).
  if (defenseType == 'toughness' && attacker && exposureClothes(defender)) {
    total -= 2;
  }

  // Business (WTNV Citizens' Guide, Clothing, p.71): "Grants +2 Cleverness Defense when worn around
  // StrexCorp agents." Read off the attacker's name or creature tags.
  if (defenseType == 'cleverness' && wornGear(defender, S2.business) && isStrexAgent(attacker)) {
    total += 2;
  }

  return total;
}

/* -------------------------------------------- */
/*  After rolls                                 */
/* -------------------------------------------- */

/** Forgiving: log everyone who attacks or Intimidates a Forgiving holder. */
export async function situational2PostRoll(actor, results, checkContext, extra = {}) {
  const rider = extra.rider ?? checkContext?.riderContext ?? {};
  const aggressive = checkContext?.isAttack === true || !!rider.style || rider.skill == 'intimidation';
  if (!aggressive) {
    return;
  }

  for (const hit of extra.hits ?? []) {
    const target = hit.target?.documentName == 'Actor' ? hit.target : hit.target?.actor ?? hit.target;
    if (!target || target.uuid == actor?.uuid || !has(target, S2.forgiving, 'perk')) {
      continue;
    }

    const list = target.flags?.essence20?.[FLAG.forgiving] ?? [];
    if (!list.includes(actor.uuid)) {
      await writeFlag(target, FLAG.forgiving, [...list, actor.uuid]);
    }
  }
}

/** Plow: a Ram attack stamps the turn so its movement ignores Rough Terrain. */
export async function situational2PreRoll(actor, dataset, item) {
  if (!plowMultipleTargets(actor, item)) {
    return;
  }

  const combat = game?.combat;
  await writeFlag(actor, FLAG.plowRam, combat
    ? { combatId: combat.id, round: combat.round, turn: combat.turn }
    : { combatId: null });
}

/* -------------------------------------------- */
/*  Competitive                                 */
/* -------------------------------------------- */

const RECENT_WINDOW_MS = 5 * 60 * 1000;
const recentRolls = [];

/** For tests. */
export function resetRecentRolls() {
  recentRolls.length = 0;
}

async function markCompetitive(actor) {
  await writeFlag(actor, FLAG.competitive, { epoch: deps.getSceneEpoch() });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }),
    content: T('S2CompetitiveChat', { name: actor.name }),
  });
}

/**
 * Every Skill Test card (flags.essence20.skill + the roll's total), on the active GM: compares it to
 * the other same-side rolls of that Skill in the last few minutes of this scene.
 * @param {ChatMessage} message
 */
export async function watchCompetitive(message, now = Date.now()) {
  if (!game.user?.isActiveGM) {
    return;
  }

  const skill = message?.flags?.essence20?.skill;
  const total = message?.rolls?.[0]?.total;
  const actor = message?.speakerActor ?? (message?.speaker?.actor ? game.actors?.get?.(message.speaker.actor) : null);
  if (!skill || typeof total != 'number' || !actor) {
    return;
  }

  const epoch = deps.getSceneEpoch();
  for (let i = recentRolls.length - 1; i >= 0; i--) {
    if (now - recentRolls[i].time > RECENT_WINDOW_MS || recentRolls[i].epoch != epoch) {
      recentRolls.splice(i, 1);
    }
  }

  const marked = new Set();
  for (const roll of recentRolls) {
    if (roll.skill != skill || roll.actor == actor || !sameSide(actor, roll.actor)) {
      continue;
    }

    if (roll.total > total && has(actor, S2.competitive, 'hangUp') && !marked.has(actor)) {
      marked.add(actor);
      await markCompetitive(actor);
    }

    if (total > roll.total && has(roll.actor, S2.competitive, 'hangUp') && !marked.has(roll.actor)) {
      marked.add(roll.actor);
      await markCompetitive(roll.actor);
    }
  }

  recentRolls.push({ actor, skill, total, time: now, epoch });
}

/* -------------------------------------------- */
/*  Uses and chat buttons                       */
/* -------------------------------------------- */

/**
 * Caltrops (PR CRB, Gear, p.119): "One bag of caltrops will cover a 5-foot-square area, and any
 * creature that attempts to cross the area must succeed on a DIF 15 Acrobatics Skill Test or stop
 * moving and take 1 Speed Essence damage." The Use posts a card; whoever crosses presses its button.
 */
export async function crossCaltrops(actor) {
  if (!actor) {
    ui.notifications?.warn(T('S2CaltropsNoActor'));
    return null;
  }

  const { rollTest } = await import("../../grants.mjs");
  const { success } = await rollTest(actor, 'acrobatics', 15);
  if (success) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor }), content: T('S2CaltropsPass', { name: actor.name }) });
    return true;
  }

  const { applyEssenceDamage } = await import("../../environment-hazards.mjs");
  await applyEssenceDamage(actor, ['speed']);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor }), content: T('S2CaltropsFail', { name: actor.name }) });
  return false;
}

export const USES = [
  {
    id: 's2-caltrops',
    matches: item => item?.type == 'gear' && idOf(sourceOf(item)) == S2.caltrops,
    run: async (item) => `<p>${T('S2CaltropsScattered', { name: item.parent?.name ?? '' })}</p>`
      + `<button type="button" class="e20-chat-action-button" data-e20-ext="s2Caltrops">${T('S2CaltropsCross')}</button>`,
  },
  {
    // Cartography Suite - "given at least 1 hour to look over an area". Travel pace ("per-hour and
    // per-day travel pace rates... are doubled") has no clock here, so the card just says so.
    id: 's2-cartography',
    matches: item => item?.type == 'perk' && idOf(sourceOf(item)) == S2.cartographySuite,
    run: async (item) => {
      const actor = item.parent;
      const scene = sceneOf(actor);
      if (!scene) {
        ui.notifications?.warn(T('S2CartographyNoScene'));
        return null;
      }

      await actor.setFlag('essence20', FLAG.survey, { sceneId: scene.id, terrain: terrainOf(actor) });
      return T('S2CartographySurveyed', { name: actor.name, scene: scene.name });
    },
  },
];

function buttonActor() {
  return globalThis.canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
}

/* -------------------------------------------- */
/*  Hook-array registrations (patched in)       */
/* -------------------------------------------- */

/**
 * Loads the heavier helpers and joins the patched-in hook arrays: rough-terrain.mjs
 * ROUGH_TERRAIN_IGNORERS (situational1's patch), multiple-targets.mjs MULTIPLE_TARGETS_GRANTS and
 * dice.mjs INITIATIVE_EXTENSIONS (SCRATCH/integration/situational2-patch.cjs). Absent arrays are
 * skipped, so nothing breaks before the patches run.
 */
export async function loadDeps() {
  const environment = await import("../../environment.mjs");
  deps.getTerrain = actor => environment.getTerrain(actor);
  deps.getEnvironment = actor => environment.getEnvironment(actor, { includeInterior: false });
  const clock = await import("../../scene-clock.mjs");
  deps.getSceneEpoch = clock.getSceneEpoch;
  const allies = await import("../../allies.mjs");
  deps.nearbyAllies = allies.getNearbyAllyTokens;

  const rough = await import("../../rough-terrain.mjs");
  rough.ROUGH_TERRAIN_IGNORERS?.push({ checkFn: ignoresRoughTerrainS2 });
  const multiple = await import("../../multiple-targets.mjs");
  multiple.MULTIPLE_TARGETS_GRANTS?.push(plowMultipleTargets);
  const dice = await import("../../../dice.mjs");
  dice.INITIATIVE_EXTENSIONS?.push(situationalInitiative);
}

registerRollSources(situational2RollSources);
registerDialogToggles(situational2Toggles);
registerApplyDialog(situational2ApplyDialog);
registerSpecializes(situational2Specializes);
registerDerived(situational2Derived);
registerDefenseAdjust(situational2DefenseAdjust);
registerPostRoll(situational2PostRoll);
registerPreRoll(situational2PreRoll);
registerRoundStart(misplacedConfidenceRound);
USES.forEach(registerUse);

registerConsumer('s2Forgiving', async (consume) => {
  const actor = await fromUuid(consume.actorUuid);
  const list = actor?.flags?.essence20?.[FLAG.forgiving] ?? [];
  if (actor) {
    await writeFlag(actor, FLAG.forgiving, list.filter(uuid => uuid != consume.aggressor));
  }
});

registerConsumer('s2Competitive', async (consume) => {
  const actor = await fromUuid(consume.actorUuid);
  if (actor) {
    await writeFlag(actor, FLAG.competitive, null);
  }
});

registerChatButton('s2Caltrops', async () => crossCaltrops(buttonActor()));
registerChatButton('s2TakeInScene', takeInASceneButton);

if (typeof Hooks != 'undefined') {
  Hooks.once?.('init', () => {
    loadDeps().catch(error => console.error('Essence20 | situational2 setup failed', error));
  });
  // Terrain/environment-dependent derived data (exposure clothes, Shark's Fin) catches up as soon
  // as the token walks into or out of a Region - same trigger as environment.mjs's own refresh.
  Hooks.on?.('updateToken', (tokenDoc, changes) => {
    const actor = tokenDoc?.actor;
    if (changes && '_regions' in changes && [S2.arcticExpedition, S2.desertExpedition, S2.desertGear, S2.sharksFin].some(id => has(actor, id))) {
      actor.reset?.();
      if (actor.sheet?.rendered) {
        actor.sheet.render();
      }
    }
  });
  Hooks.on?.('createChatMessage', message => {
    watchCompetitive(message).catch(error => console.error('Essence20 | Competitive failed', error));
  });
}
