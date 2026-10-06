import { getSceneEpoch, getUses, markUsed } from "../resources/scene-clock.mjs";
import { companionsOf, hasSourced, worldActors } from "./companion-link.mjs";

/**
 * Things summoned or carried along: personal vehicles (Shark Cycle, Galaxy Glider, Jet Jammer, the
 * Time Jet, Strata and Vector Cycles, a Dino Raptor, Hitch A Ride's magic ride, the Riding Rig and the
 * Cobra Jet Pack), Battlizers, faster Zord arrivals, Toxo-Zombies and summoned allies.
 *
 * - A personal vehicle is a `vehicle` actor tied to its owner the way a companion is
 *   (mechanics/companions/companion-link.mjs). The first summon builds it from the book's stat block
 *   (VEHICLES below); later summons bring the same one back beside its owner.
 * - "you gain Edge on Driving Skill Tests when piloting it": personalVehicleEdge() is read when the
 *   crew rolls (mechanics/combat/target-riders.mjs#rollRiderSources).
 * - A Battlizer is its armor item. Its Use button summons it - "once per scene by paying the listed
 *   Personal Power cost and spending a Standard action while Morphed" - which equips it and gives its
 *   attacks for the scene.
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const SUMMON = {
  sharkcycleRider: uuid('pr_crb', 'h9646p1jwreQl4K3'),
  galaxyGlider: uuid('across_the_stars', 'tDuSm78HrB37tryx'),
  jetJammer: uuid('across_the_stars', 'eMvNAg1jmYnIY94x'),
  dinoRaptor: uuid('beneath_the_helmet', 'mxMNLyOCoRigDeBJ'),
  timeJet: uuid('jump_through_time', 'ZfwG2Plmejc0u1OU'),
  vectorStrataCycle: uuid('jump_through_time', 'rpeE4NVb9NoJloi7'),
  summonCycle: uuid('finster_s_monster_matic_cookbook', 'NQZyIHZEkb8PJt7t'),
  hitchARide: uuid('mlp_crb', 'XGsSvbK8OOfI8Che'),
  ridingRig: uuid('cobra_codex', '5g0w2qL8O7EV3RJg'),
  biker: uuid('cobra_codex', '5clUVTBFl8JMpw8t'),
  rigUpgrade: uuid('cobra_codex', 'FmJF8idUZpHAxIPM'),
  racerAbandon: uuid('cobra_codex', 'rNESO3bo1apEjd6p'),
  riggedRider: uuid('cobra_codex', 'UquFEmbtdvb08ipH'),
  skybound: uuid('cobra_codex', 'KlBjsk6QBMl8J90j'),
  hardTarget: uuid('cobra_codex', 'ZV00Jdj5O9u3OC7F'),
  crashingFromTheSkies: uuid('cobra_codex', '9CF0mXhOO0QNFc5n'),
  necroscientist: uuid('cobra_codex', 'Ze9reKJEEpzWYBxd'),
  alliesFromBelow: uuid('finster_s_monster_matic_cookbook', 'zCOrbOjtfagynf8Q'),
  battleWarrior: uuid('across_the_stars', 'yWsLaZOGVlaCXh1Y'),
  spdBattlizer: uuid('across_the_stars', 'qc82QDtZN3qVWqxV'),
  redFury: uuid('beneath_the_helmet', 'k7svIPp9YYkzjxwB'),
  triassic: uuid('beneath_the_helmet', 'sVYZLXhPZqdVhNax'),
  quantumMega: uuid('jump_through_time', 'WiaxmqhCQSYpJIeK'),
  qRexPortal: uuid('jump_through_time', 'QRexPortalJTTxxx'),
  assistedSummoning: uuid('jump_through_time', 'atPA5nGheYDzzmaZ'),
  manifestedZord: uuid('through_the_shattered_grid', 'fNMbLGJk5RiSi49J'),
  accelerateConversion: uuid('field_guide_action_adventure', 'fmDJTf8pXl0Hjnyw'),
  rallyGuardians: uuid('through_the_shattered_grid', 'FhQLam5IgFFIuzah'),
  spiritsHost: uuid('through_the_shattered_grid', 'HQaLM23Y7hnKbLFQ'),
  organicZord: uuid('beneath_the_helmet', 'UCy4agcbYPMWqG5N'),
  carrier: uuid('pr_crb', 'h1b0cjGJP1xqtfVv'),
};

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return Array.isArray(items.contents) ? items.contents : (typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

/* -------------------------------------------- */
/*  Vehicle stat blocks                          */
/* -------------------------------------------- */

// extra: {usesPerScene} (a "1/scene" attack, see battlizerAttackUsedUp) and {critMultiplier} (a
// "Critical Effect: Triples base damage instead of double", read by dice.mjs#_applyCritMultiplier).
const attack = (name, skill, damage, type, range = null, traits = [], extra = {}) => ({ name, skill, damage, type, range, traits, ...extra });

/**
 * The books' stat blocks. Defenses are 10 + Essence + armor, the way the vehicle sheet adds them.
 */
export const VEHICLES = {
  // Shark Cycle (PR CRB p.129): Health 6, 60ft Ground, Toughness 15 (Light Plating +1), Evasion 15.
  sharkCycle: { name: 'Shark Cycle', threatLevel: 4, size: 'common', health: 6, move: { ground: 60 }, strength: 4, speed: 5, armor: 1,
    skills: { might: 'd6', brawn: 'd4', initiative: 'd6' }, traits: ['land', 'vehicle', 'responsive'], attacks: [attack('Ram', 'might', 2, 'blunt')] },
  // Galaxy Glider (Across the Stars p.72, PR CRB p.125): Health 5, 50ft, Strength 3, Speed 7, Medium Plating +2.
  galaxyGlider: { name: 'Galaxy Glider', threatLevel: 2, size: 'common', health: 5, move: { ground: 50, aerial: 50 }, strength: 3, speed: 7, armor: 2,
    skills: { acrobatics: 'd6', might: 'd4', initiative: 'd6' }, traits: ['vehicle', 'air'], attacks: [] },
  // Jet Jammer (Across the Stars p.91): Health 6, 60ft Aerial, Strength 7, Speed 4, Light Plating +1.
  jetJammer: { name: 'Jet Jammer', threatLevel: 3, size: 'common', health: 6, move: { aerial: 60 }, strength: 7, speed: 4, armor: 1,
    skills: { acrobatics: 'd4', brawn: 'd2', might: 'd4', initiative: 'd4' }, traits: ['aerospace', 'air', 'vehicle', 'vtol'],
    attacks: [attack('Spark Cannon', 'targeting', 2, 'energy', [40, 90]), attack('Ram', 'might', 2, 'blunt')] },
  // Dino Raptor (Beneath the Helmet p.56) rides as the book's Raptor Rider (p.70): Health 9, 50ft,
  // Strength 14, Speed 8, Light Plating +1.
  dinoRaptor: { name: 'Dino Raptor', threatLevel: 7, size: 'common', health: 9, move: { ground: 50 }, strength: 14, speed: 8, armor: 1,
    skills: { acrobatics: 'd8', athletics: 'd8', brawn: 'd8', might: 'd8', initiative: 'd4' }, traits: ['land', 'vehicle'],
    attacks: [attack('Bite', 'might', 2, 'sharp'), attack('Ram', 'might', 2, 'blunt')] },
  // Time Jet (Jump Through Time p.71): Huge, Health 6, 45ft Aerial / 30ft Ground, Strength 4, Speed 7, +1.
  timeJet: { name: 'Time Jet', threatLevel: 2, size: 'huge', health: 6, move: { aerial: 45, ground: 30 }, strength: 4, speed: 7, armor: 1, passengers: 5,
    skills: { acrobatics: 'd4', brawn: 'd6', driving: 'd4', initiative: 'd2', targeting: 'd4' }, traits: ['air', 'autopilot', 'takeOff', 'vehicle'],
    attacks: [attack('Flyby', 'driving', 1, 'blunt'), attack('Medium Vector Cannons', 'targeting', 1, 'energy', [50, 150])] },
  // Strata Cycle (Jump Through Time p.70): Long, Health 2, 45ft Aerial (hover), Strength 2, Speed 6, +1.
  strataCycle: { name: 'Strata Cycle', threatLevel: 1, size: 'long', health: 2, move: { aerial: 45 }, strength: 2, speed: 6, armor: 1, passengers: 1,
    skills: { acrobatics: 'd4', brawn: 'd4', driving: 'd2', initiative: 'd4', targeting: 'd2' }, traits: ['autopilot', 'hover', 'vehicle'],
    attacks: [attack('Ram', 'driving', 1, 'blunt'), attack('V-Lasers', 'targeting', 1, 'laser', [60, 200])] },
  // Vector Cycle (Jump Through Time p.73): Long, Health 2, 45ft Ground, Strength 4, Speed 2, +1.
  vectorCycle: { name: 'Vector Cycle', threatLevel: 1, size: 'long', health: 2, move: { ground: 45 }, strength: 4, speed: 2, armor: 1, passengers: 1,
    skills: { athletics: 'd4', brawn: 'd4', initiative: 'd4' }, traits: ['land', 'vehicle'],
    attacks: [attack('Ram', 'driving', 1, 'blunt'), attack('Twin Energy Cannons', 'targeting', 1, 'energy', [40, 120])] },
  // Riding Rig (Cobra Codex p.61): Health 2, 45ft ground, Strength 2, Speed 2, Toughness 13, Evasion 12.
  ridingRig: { name: 'Riding Rig', threatLevel: 1, size: 'common', health: 2, move: { ground: 45 }, strength: 2, speed: 2, armor: 1,
    skills: { initiative: 'd4', might: 'd4' }, traits: ['land', 'vehicle', 'wearable', 'responsive'], attacks: [attack('Ram', 'might', 1, 'blunt')] },
  // Cobra Jet Pack (Cobra Codex p.105): Health 3, 30ft Aerial, Strength 2, Speed 3, Micromesh +1.
  // Skybound's comes "without its Quad Blast 25mm Axial Machine Guns".
  jetPack: { name: 'Jet Pack', threatLevel: 2, size: 'common', health: 3, move: { aerial: 30 }, strength: 2, speed: 3, armor: 1,
    skills: { alertness: 'd4', brawn: 'd2', driving: 'd4', targeting: 'd2' }, traits: ['air', 'autopilot', 'multiPurpose', 'sensors', 'vehicle', 'vtol', 'wearable'],
    attacks: [attack('Flyby', 'driving', 1, 'blunt')] },
  // Hitch A Ride (MLP CRB p.138): "large enough for you and 9 other Common sized creatures ... drives
  // itself, has a d10 Driving Skill, is Specialized in Driving itself, and has a Ground and Aerial
  // movement of 60ft." No Health or Defenses are given; these are the Shark Cycle's.
  hitchARide: { name: 'Magical Ride', threatLevel: 1, size: 'huge', health: 6, move: { ground: 60, aerial: 60 }, strength: 4, speed: 5, armor: 0, passengers: 9,
    skills: { driving: 'd10' }, specialized: ['driving'], traits: ['air', 'autopilot', 'land', 'vehicle'], attacks: [] },
};

function vehicleItems(spec) {
  return spec.attacks.flatMap(a => {
    const id = foundry.utils.randomID();
    return [
      { _id: id, name: a.name, type: 'weapon', system: {
        classification: { size: 'sidearm' }, availability: 'standard', equipped: true, hardpoint: { type: 'integrated' },
        ...(a.traits?.length ? { traits: a.traits } : {}),
        ...(a.usesPerScene ? { usesPerScene: a.usesPerScene } : {}),
      } },
      { name: a.name, type: 'weaponEffect', system: {
        classification: { skill: a.skill, style: a.range ? 'energy' : 'melee' }, damageType: a.type, damageValue: a.damage, numTargets: 1, numHands: '0',
        range: a.range ? { value: a.range[0], long: a.range[1] } : { reachMultiplier: 1 },
      }, flags: { essence20: { parentId: id, ...(a.critMultiplier ? { critMultiplier: a.critMultiplier } : {}) } } },
    ];
  });
}

/**
 * Actor data for a vehicle stat block.
 * @param {Object} spec   One of VEHICLES.
 * @returns {Object}
 */
export function vehicleData(spec) {
  const system = {
    threatLevel: spec.threatLevel, size: spec.size,
    health: { origin: spec.health, value: spec.health },
    essences: { strength: { value: spec.strength }, speed: { value: spec.speed } },
    defenses: { toughness: { base: 10, armor: spec.armor ?? 0 }, evasion: { base: 10 } },
    crew: { numDrivers: 1, numPassengers: spec.passengers ?? 0 },
    movement: Object.fromEntries(['ground', 'aerial', 'swim', 'climb'].map(key => [key, { base: spec.move[key] ?? 0 }])),
    traits: Object.fromEntries((spec.traits ?? []).map(t => [t, true])),
    skills: Object.fromEntries(Object.entries(spec.skills ?? {}).map(([key, shift]) => [key, { shift, isSpecialized: (spec.specialized ?? []).includes(key) }])),
  };
  return { name: spec.name, type: 'vehicle', system, items: vehicleItems(spec) };
}

/* -------------------------------------------- */
/*  Summoning a vehicle                          */
/* -------------------------------------------- */

function vehiclesOf(owner, key) {
  return companionsOf(owner).filter(a => a.type == 'vehicle' && a.flags?.essence20?.personalVehicle == key);
}

/**
 * Bring a personal vehicle: build it the first time, then place it beside its owner.
 * @param {Actor} owner
 * @param {String} key   A key of VEHICLES.
 * @param {Object} [options]
 * @param {Item} [options.grantor]
 * @param {Object} [options.extra]   Extra actor data (Crashing From The Skies' guns, a colour).
 * @param {Number} [options.arrivalRounds]   Arrives after this many rounds rather than now.
 * @param {String} [options.until]   'scene' - it goes back at the end of the scene.
 * @returns {Promise<Actor|null>}
 */
export async function summonVehicle(owner, key, { grantor = null, extra = {}, arrivalRounds = 0, until = null } = {}) {
  let vehicle = vehiclesOf(owner, key)[0];
  if (!vehicle) {
    const { createViaGm } = await import("../world/gm-relay.mjs");
    const data = foundry.utils.mergeObject(vehicleData(VEHICLES[key]), {
      name: T('E20.PersonalVehicleName', { name: owner.name, vehicle: VEHICLES[key].name }),
      ownership: foundry.utils.deepClone(owner.ownership ?? {}),
      flags: { essence20: { companionOf: owner.uuid, personalVehicle: key, grantedBy: grantor ? sourceOf(grantor) ?? null : null } },
    }, { inplace: false });
    foundry.utils.mergeObject(data, extra);
    const createdUuid = await createViaGm('actor', { data });
    vehicle = createdUuid ? await fromUuid(createdUuid) : null;
    if (!vehicle) {
      return null;
    }

    const { linkCompanion } = await import("./companion-link.mjs");
    await linkCompanion(owner, vehicle);
  }

  if (arrivalRounds > 0 && game.combat?.started) {
    await vehicle.setFlag('essence20', 'arrivesRound', game.combat.round + arrivalRounds);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: owner }), content: T('E20.VehicleArrivesIn', { vehicle: vehicle.name, rounds: arrivalRounds, round: game.combat.round + arrivalRounds }) });
    return vehicle;
  }

  await vehicle.setFlag('essence20', 'summoned', { scene: until == 'scene' ? getSceneEpoch() : null });
  await placeNear(owner, vehicle);
  return vehicle;
}

async function placeNear(owner, actor) {
  const token = owner.getActiveTokens?.()?.[0];
  if (!token || !canvas?.scene || canvas.scene.tokens.some(t => t.actorId == actor.id)) {
    return null;
  }

  const size = canvas.grid?.size ?? 100;
  const { createViaGm } = await import("../world/gm-relay.mjs");
  return createViaGm('token', { actorUuid: actor.uuid, sceneId: canvas.scene.id, x: token.document.x + (token.document.width ?? 1) * size, y: token.document.y });
}

/** "It returns to its capsule-storage form at the end of the scene." Called on essence20.sceneAdvanced by the GM. */
export async function dismissSceneSummons() {
  if (!game.user?.isGM) {
    return;
  }

  for (const actor of worldActors()) {
    const summoned = actor.flags?.essence20?.summoned;
    if (summoned?.scene != null && summoned.scene != getSceneEpoch()) {
      for (const scene of game.scenes ?? []) {
        const ids = scene.tokens.filter(t => t.actorId == actor.id).map(t => t.id);
        if (ids.length) {
          await scene.deleteEmbeddedDocuments('Token', ids);
        }
      }

      await actor.unsetFlag('essence20', 'summoned');
    }

    // Toxo-Zombies: "Even if they survive the combat, your Toxo-Zombies are once again Defeated at the end
    // of the scene." Summoned allies leave too.
    const zombie = actor.flags?.essence20?.sceneSummon;
    if (zombie != null && zombie != getSceneEpoch()) {
      await actor.delete();
    }
  }

  // Battlizers go back.
  for (const actor of worldActors()) {
    for (const armor of itemsOf(actor).filter(i => i.type == 'armor' && i.flags?.essence20?.battlizerScene != null && i.flags.essence20.battlizerScene != getSceneEpoch())) {
      await dismissBattlizer(actor, armor);
    }
  }
}

/**
 * A vehicle answering "like a Zord" turns up when its round comes. Called by the GM on each new round.
 */
export async function onRoundChange(combat) {
  if (!game.user?.isGM) {
    return;
  }

  for (const actor of worldActors()) {
    const round = actor.flags?.essence20?.arrivesRound;
    if (round != null && combat?.round >= round) {
      await actor.unsetFlag('essence20', 'arrivesRound');
      const owner = globalThis.fromUuidSync?.(actor.flags?.essence20?.companionOf);
      if (owner) {
        await placeNear(owner, actor);
        ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: owner }), content: T('E20.VehicleArrived', { vehicle: actor.name }) });
      }
    }
  }
}

/**
 * "you gain Edge on Driving Skill Tests while using it" - Sharkcycle Rider, Jet Jammer, the Strata and
 * Vector Cycles; Galaxy Glider: "Edge on Acrobatics Skill Tests to pilot it".
 * @param {Actor} actor   The driver.
 * @param {String} skill
 * @returns {Boolean}
 */
export function personalVehicleEdge(actor, skill, crewedVehicle) {
  const key = crewedVehicle?.flags?.essence20?.personalVehicle;
  if (!key || crewedVehicle.flags?.essence20?.companionOf != actor?.uuid) {
    return false;
  }

  if (key == 'galaxyGlider') {
    return skill == 'acrobatics';
  }

  return skill == 'driving' && ['sharkCycle', 'jetJammer', 'strataCycle', 'vectorCycle'].includes(key);
}

/* -------------------------------------------- */
/*  Battlizers                                   */
/* -------------------------------------------- */

export const BATTLIZERS = {
  // Battle Warrior (Across the Stars p.85): "Personal Power Cost to Summon: 1 ... Golden Sword (Might or
  // Finesse): Reach, 2 Sharp damage ... Battle Fire Saber (Might or Finesse): Range 5ft/10ft, 3 Fire
  // damage; usable only once per scene".
  [SUMMON.battleWarrior]: { cost: 1, attacks: [attack('Golden Sword', 'might', 2, 'sharp'), attack('Battle Fire Saber', 'might', 3, 'fire', [5, 10], [], { usesPerScene: 1 })] },
  // S.P.D. Battlizer: "Personal Power Cost to Summon: 1 ... Energy Sword (Finesse): Reach, 1 Energy damage".
  [SUMMON.spdBattlizer]: { cost: 1, attacks: [attack('Energy Sword', 'finesse', 1, 'energy')] },
  // Red Fury Mode (Beneath the Helmet p.68): "Personal Power Cost to Summon: 1 ... Cheetah Claws (Might):
  // Reach, 2 Sharp damage ... Every time this Battlizer is called, the wearer loses 1 Smarts Essence."
  [SUMMON.redFury]: { cost: 1, smartsLoss: 1, attacks: [attack('Cheetah Claws', 'might', 2, 'sharp')] },
  // Triassic Battlizer: "Personal Power Cost to Summon: 3 ... effective reach of 100ft ... tripling their
  // movement rates." Dragon Yo-yo, Forearm Blaster, Shoulder Cannons, Stretch Kick.
  [SUMMON.triassic]: { cost: 3, tripleMovement: true, attacks: [
    attack('Dragon Yo-yo', 'targeting', 2, 'energy', [40, 100]), attack('Forearm Blaster', 'targeting', 1, 'energy', [40, 100]),
    attack('Shoulder Cannons', 'targeting', 3, 'energy', [30, 120]), attack('Stretch Kick', 'might', 1, 'blunt', [100, 100]),
  ] },
  // Quantum Mega Battle Armor (A Jump Through Time p.69): "Personal Power Cost to Summon: 5 ... Wing
  // Blades (Might): Reach, (2 Sharp damage) Wing Blaster (Targeting): Range 50ft/120ft, (2 Energy
  // damage) Energy Sword Time Strike (Might, 1/scene): Reach, (5 Energy damage) Critical Effect:
  // Triples base damage instead of double ... Inaccurate". Its armor, Ground and Aerial Movement are
  // the armor item's own (equipped on summon). The Time Strike's "Anti-Armor" trait isn't defined in
  // A Jump Through Time; the only printed Anti-Armor is Across the Stars' Zord Feature (Anti-Tank,
  // Wrecker and an armor-shredding Critical Effect for a Zord attack), so it isn't mapped here.
  [SUMMON.quantumMega]: { cost: 5, attacks: [
    attack('Wing Blades', 'might', 2, 'sharp'), attack('Wing Blaster', 'targeting', 2, 'energy', [50, 120]),
    attack('Energy Sword Time Strike', 'might', 5, 'energy', null, ['inaccurate'], { usesPerScene: 1, critMultiplier: 3 }),
  ] },
};

export function isBattlizer(item) {
  return item?.type == 'armor' && !!BATTLIZERS[sourceOf(item)];
}

const battlizerAttackKey = weapon => `battlizerAttack.${weapon.id}`;

/**
 * A Battlizer attack marked "1/scene" (Energy Sword Time Strike, Battle Fire Saber) that has already
 * been used this scene. Checked by dice.mjs before the attack is rolled.
 * @param {Actor} actor
 * @param {?Item} weapon   The attack's parent weapon.
 * @returns {Boolean}
 */
export function battlizerAttackUsedUp(actor, weapon) {
  const max = weapon?.system?.usesPerScene;
  return !!weapon?.flags?.essence20?.battlizerOf && max > 0 && getUses(actor, battlizerAttackKey(weapon), 'scene') >= max;
}

/** Counts one use of a "1/scene" Battlizer attack, once it's actually rolled. */
export async function markBattlizerAttack(actor, weapon) {
  if (weapon?.flags?.essence20?.battlizerOf && weapon.system?.usesPerScene > 0) {
    await markUsed(actor, battlizerAttackKey(weapon), { window: 'scene' });
  }
}

/**
 * Summon a Battlizer: "once per scene by paying the listed Personal Power cost and spending a
 * Standard action while Morphed."
 */
export async function summonBattlizer(actor, armor, pay) {
  const spec = BATTLIZERS[sourceOf(armor)];
  if (!spec) {
    return null;
  }

  if (armor.flags?.essence20?.battlizerScene == getSceneEpoch()) {
    return dismissBattlizer(actor, armor);
  }

  if (!actor.system?.isMorphed) {
    ui.notifications.warn(T('E20.BattlizerNotMorphed', { name: actor.name }));
    return null;
  }

  if (getUses(actor, `battlizer.${armor.id}`, 'scene') >= 1) {
    ui.notifications.warn(T('E20.OncePerScene'));
    return null;
  }

  const power = actor.system?.powers?.personal;
  if (!power || (power.value ?? 0) < spec.cost) {
    ui.notifications.warn(T('E20.NoPower', { name: actor.name }));
    return null;
  }

  if (!(await pay('standard'))) {
    return null;
  }

  const updates = { 'system.powers.personal.value': power.value - spec.cost };
  if (spec.smartsLoss) {
    updates['system.essences.smarts.value'] = Math.max(0, (Number(actor.system?.essences?.smarts?.value) || 0) - spec.smartsLoss);
  }

  await actor.update(updates);
  await markUsed(actor, `battlizer.${armor.id}`, { window: 'scene' });
  await armor.update({ 'system.equipped': true, 'flags.essence20.battlizerScene': getSceneEpoch() });
  const created = await actor.createEmbeddedDocuments('Item', vehicleItems({ attacks: spec.attacks }).map(item => foundry.utils.mergeObject(item, {
    flags: { essence20: { battlizerOf: armor.id } }, system: item.type == 'weapon' ? { hardpoint: { type: 'none' } } : {},
  })));
  if (spec.tripleMovement) {
    await actor.createEmbeddedDocuments('ActiveEffect', [{
      name: armor.name, img: armor.img, flags: { essence20: { battlizerOf: armor.id } },
      changes: ['ground', 'aerial', 'swim', 'climb'].map(key => ({ key: `system.movement.${key}.base`, mode: 1, value: '3' })),
    }]);
  }

  return T('E20.BattlizerSummoned', { name: actor.name, battlizer: armor.name, cost: spec.cost, attacks: created.filter(i => i.type == 'weapon').length });
}

export async function dismissBattlizer(actor, armor) {
  const ids = itemsOf(actor).filter(i => i.flags?.essence20?.battlizerOf == armor.id).map(i => i.id);
  if (ids.length) {
    await actor.deleteEmbeddedDocuments('Item', ids);
  }

  const effects = [...(actor.effects ?? [])].filter(e => e.flags?.essence20?.battlizerOf == armor.id).map(e => e.id);
  if (effects.length) {
    await actor.deleteEmbeddedDocuments('ActiveEffect', effects);
  }

  await armor.update({ 'system.equipped': false });
  await armor.unsetFlag('essence20', 'battlizerScene');
  return T('E20.BattlizerDismissed', { name: actor.name, battlizer: armor.name });
}

/* -------------------------------------------- */
/*  Zords                                        */
/* -------------------------------------------- */

/**
 * The faster ways a Zord can arrive, offered when it's summoned (mechanics/vehicles/zord-summon.mjs):
 * - Manifested Zord (Through the Shattered Grid p.33): "you may spend 4 Personal Power ... ready to pilot
 *   at the beginning of the following turn".
 * - Q-Rex Portal (Jump Through Time p.46): "By spending one Personal Power, you can summon your
 *   Quantasaurus Rex to arrive at the beginning of the next round."
 * - Assisted Summoning (Jump Through Time p.83): "you can spend a Standard action to coordinate with your
 *   team's support members ... This Zord arrives at the end of the following turn".
 * @returns {Array<{key, label, cost, rounds}>}
 */
export function fastSummonOptions(pilot, zord) {
  const options = [];
  if (hasSourced(zord, SUMMON.manifestedZord)) {
    options.push({ key: 'manifested', label: T('E20.ZordManifested'), power: 4, rounds: 1 });
  }

  if (hasSourced(pilot, SUMMON.qRexPortal)) {
    options.push({ key: 'qRex', label: T('E20.ZordQRexPortal'), power: 1, rounds: 1 });
  }

  if (hasSourced(zord, SUMMON.assistedSummoning)) {
    options.push({ key: 'assisted', label: T('E20.ZordAssisted'), action: 'standard', rounds: 1 });
  }

  return options;
}

/**
 * Accelerate Conversion (Field Guide p.70): "once per scene, you may reduce the time before you can
 * summon your Zord or before your team can combine into a Megaform by 2 rounds."
 */
export async function accelerate(actor) {
  if (getUses(actor, 'accelerateConversion', 'scene') >= 1) {
    ui.notifications.warn(T('E20.OncePerScene'));
    return null;
  }

  const options = [];
  for (const entry of Object.values(actor.system?.actors ?? {})) {
    const other = globalThis.fromUuidSync?.(entry?.uuid);
    if (other?.flags?.essence20?.zordSummonReadyRound) {
      options.push({ value: other.uuid, label: other.name, flag: 'zordSummonReadyRound' });
    }
  }

  for (const megaform of worldActors().filter(a => a.type == 'megaform' && a.flags?.essence20?.combineReadyRound
    && Object.values(a.system?.actors ?? {}).some(e => e?.uuid == actor.uuid))) {
    options.push({ value: megaform.uuid, label: megaform.name, flag: 'combineReadyRound' });
  }

  if (!options.length) {
    ui.notifications.warn(T('E20.AccelerateNothing'));
    return null;
  }

  const { chooseSelect } = await import("../resources/grants.mjs");
  const picked = options.length == 1 ? options[0].value : await chooseSelect(T('E20.AccelerateConversion'), T('E20.AcceleratePick'), options);
  const option = options.find(o => o.value == picked);
  const target = option ? await fromUuid(option.value) : null;
  if (!target) {
    return null;
  }

  const ready = Math.max(game.combat?.round ?? 0, Number(target.flags.essence20[option.flag]) - 2);
  await target.setFlag('essence20', option.flag, ready);
  await markUsed(actor, 'accelerateConversion', { window: 'scene' });
  return T('E20.Accelerated', { name: target.name, round: ready });
}

/* -------------------------------------------- */
/*  Toxo-Zombies and summoned allies             */
/* -------------------------------------------- */

/**
 * Necroscientist (Cobra Codex p.65): "As a Standard action, you can revive a Defeated organic creature
 * as a Toxo-Zombie (see page 180). Even if they survive the combat, your Toxo-Zombies are once again
 * Defeated at the end of the scene." The Toxo-Zombie's stat block (p.180): Health 5, 30ft, Strength 4,
 * Speed 2, Smarts 3, Toughness 16 (Ballistic armor +2), Evasion 12, Willpower 13, Cleverness 11; Bite
 * (Might) +d6, Reach, 1 Sharp and Grapple.
 */
export async function reviveToxoZombie(actor, pay) {
  const target = game.user?.targets?.first?.();
  const victim = target?.actor;
  if (!victim || !victim.statuses?.has?.('defeated')) {
    ui.notifications.warn(T('E20.NecroscientistPick'));
    return null;
  }

  const { isNonHuman } = await import("../characters/creature-tags.mjs").catch(() => ({}));
  if (victim.type == 'vehicle' || victim.type == 'zord' || (isNonHuman?.(victim) && /robot|machine/i.test(victim.system?.creatureTags ?? ''))) {
    ui.notifications.warn(T('E20.NecroscientistOrganic'));
    return null;
  }

  if (!(await pay('standard'))) {
    return null;
  }

  const { createViaGm } = await import("../world/gm-relay.mjs");
  const zombie = {
    name: T('E20.ToxoZombieName', { name: victim.name }), type: 'npc', img: victim.img,
    ownership: foundry.utils.deepClone(actor.ownership ?? {}),
    system: {
      health: { origin: 5, value: 5 }, size: 'common',
      essences: { strength: { max: 4, value: 4 }, speed: { max: 2, value: 2 }, smarts: { max: 3, value: 3 }, social: { max: 0, value: 0 } },
      defenses: { toughness: { base: 10, armor: 2 }, evasion: { base: 10 }, willpower: { base: 10 }, cleverness: { base: 11 } },
      movement: { ground: { base: 30 } },
      skills: { alertness: { shift: 'd6' }, initiative: { shift: 'd4' }, might: { shift: 'd6', isSpecialized: true } },
    },
    items: vehicleItems({ attacks: [attack('Bite', 'might', 1, 'sharp')] }),
    flags: { essence20: { companionOf: actor.uuid, sceneSummon: getSceneEpoch() } },
  };
  const createdUuid = await createViaGm('actor', { data: zombie });
  const created = createdUuid ? await fromUuid(createdUuid) : null;
  if (created && canvas?.scene) {
    await createViaGm('token', { actorUuid: created.uuid, sceneId: canvas.scene.id, x: target.document.x, y: target.document.y });
  }

  return created ? T('E20.ToxoZombieRisen', { name: actor.name, victim: victim.name }) : null;
}

/**
 * Allies From Below (Finster's Cookbook p.272): "Summons 3d4 Threat Levels worth of allied creatures as
 * a Standard action". The Threat Levels are rolled; the creatures are picked from the world's NPCs up
 * to that total and placed beside the caster, leaving at the end of the scene.
 */
export async function alliesFromBelow(actor) {
  const roll = await new Roll('3d4').evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: T('E20.AlliesFromBelowRoll') });
  const budget = roll.total;
  const npcs = worldActors().filter(a => a.type == 'npc' && Number(a.system?.threatLevel) > 0 && !a.flags?.essence20?.sceneSummon);
  const rows = npcs.map(a => `<label class="flexrow"><input type="number" name="n-${a.id}" value="0" min="0" max="10" style="flex:0 0 3em" /> ${foundry.utils.escapeHTML(a.name)} (${a.system.threatLevel})</label>`).join('');
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: T('E20.AlliesFromBelow') },
    classes: ["window-app", "e20-window"],
    content: `<p>${T('E20.AlliesFromBelowPrompt', { budget })}</p>${rows}`,
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => npcs.map(a => [a, Number(button.form.elements[`n-${a.id}`].value) || 0]).filter(([, n]) => n > 0) },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!Array.isArray(picked)) {
    return null;
  }

  const spent = picked.reduce((sum, [a, n]) => sum + n * Number(a.system.threatLevel), 0);
  if (spent > budget) {
    ui.notifications.warn(T('E20.AlliesFromBelowOver', { budget, spent }));
    return null;
  }

  const { createViaGm } = await import("../world/gm-relay.mjs");
  const token = actor.getActiveTokens?.()?.[0];
  let placed = 0;
  for (const [npc, n] of picked) {
    for (let i = 0; i < n; i++) {
      const data = npc.toObject();
      delete data._id;
      data.name = T('E20.SummonedAllyName', { name: npc.name });
      data.ownership = foundry.utils.deepClone(actor.ownership ?? {});
      foundry.utils.setProperty(data, 'flags.essence20.companionOf', actor.uuid);
      foundry.utils.setProperty(data, 'flags.essence20.sceneSummon', getSceneEpoch());
      const createdUuid = await createViaGm('actor', { data });
      if (createdUuid && token && canvas?.scene) {
        const size = canvas.grid?.size ?? 100;
        placed += 1;
        await createViaGm('token', { actorUuid: createdUuid, sceneId: canvas.scene.id, x: token.document.x + placed * size, y: token.document.y + size });
      }
    }
  }

  return T('E20.AlliesFromBelowDone', { name: actor.name, count: placed, spent, budget });
}

/* -------------------------------------------- */
/*  Riders and Rocketeers                        */
/* -------------------------------------------- */

/**
 * Skybound (Cobra Codex p.65): "your Jet Pack counts as 2 hands of equipment." For
 * documents/actor.mjs#_prepareLoadout.
 */
export function vehicleHands(actor) {
  return hasSourced(actor, SUMMON.skybound) && vehiclesOf(actor, 'jetPack').length ? 2 : 0;
}

/**
 * Hard Target (Cobra Codex p.66): "When wearing your Jet Pack, you gain 2 Health, and +2 to your
 * Toughness." Wearing = crewing it.
 * @returns {{health: Number, defenses: Object}}
 */
export function hardTargetBonus(actor, crewedVehicle) {
  if (hasSourced(actor, SUMMON.hardTarget) && crewedVehicle?.flags?.essence20?.personalVehicle == 'jetPack') {
    return { health: 2, defenses: { toughness: 2 } };
  }

  return { health: 0, defenses: {} };
}

/**
 * Racer Abandon (Cobra Codex p.61): "when driving a vehicle, including your Riding Rig, certain Renegade
 * Perks grant different effects". Rigged Rider (20th): "you gain both". Read by the Renegade Perks.
 * @returns {{vehicle: Boolean, self: Boolean}}   Which of the two effects apply.
 */
export function racerAbandonMode(actor, crewedVehicle) {
  if (!crewedVehicle || !hasSourced(actor, SUMMON.racerAbandon)) {
    return { vehicle: false, self: true };
  }

  return { vehicle: true, self: hasSourced(actor, SUMMON.riggedRider) };
}

/**
 * Whose Renegade Perks protect this actor. Racer Abandon moves Fortitude, Didn't Even Feel It and Not
 * Done Yet onto the vehicle its holder drives - "Fortitude: You reduce the amount of Damage your vehicle
 * suffers from any source by 1", "Not Done Yet: If your vehicle is Defeated, it drops to 1 Health
 * instead" - and Rigged Rider keeps them on the driver too.
 * @param {Actor} actor   Who is taking the damage.
 * @returns {Actor|null}   Whose Perks to read, or null for none.
 */
export function renegadeHolderFor(actor) {
  if (actor?.type == 'vehicle') {
    for (const entry of Object.values(actor.system?.actors ?? {})) {
      if ((entry?.vehicleRole ?? 'passenger') != 'driver') {
        continue;
      }

      const driver = globalThis.fromUuidSync?.(entry.uuid);
      if (driver && hasSourced(driver, SUMMON.racerAbandon)) {
        return driver;
      }
    }

    return null;
  }

  const driving = worldActors().some(v => v.type == 'vehicle' && Object.values(v.system?.actors ?? {})
    .some(entry => entry?.uuid == actor?.uuid && entry.vehicleRole == 'driver'));
  if (driving && hasSourced(actor, SUMMON.racerAbandon) && !hasSourced(actor, SUMMON.riggedRider)) {
    return null;
  }

  return actor;
}

/**
 * Racer Abandon's Reckless Abandon: "You gain ↑2 on Driving Skill Tests instead of Strength Skill
 * Tests". Whether a driver's Strength ↑2 still applies, and whether their Driving gets it.
 */
export function racerRecklessShifts(actor) {
  const driving = worldActors().some(v => v.type == 'vehicle' && Object.values(v.system?.actors ?? {})
    .some(entry => entry?.uuid == actor?.uuid && entry.vehicleRole == 'driver'));
  if (!driving || !hasSourced(actor, SUMMON.racerAbandon)) {
    return { strength: true, driving: false };
  }

  return { strength: hasSourced(actor, SUMMON.riggedRider), driving: true };
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

const ONE_PP = 1;

async function spendPower(actor, amount) {
  const power = actor.system?.powers?.personal;
  if (!power || (power.value ?? 0) < amount) {
    ui.notifications.warn(T('E20.NoPower', { name: actor.name }));
    return false;
  }

  await actor.update({ 'system.powers.personal.value': power.value - amount });
  return true;
}

const HANDLERS = {
  // Sharkcycle Rider (PR CRB p.101): "summon a Sharkcycle by spending 1 Power, teleporting it to
  // anywhere within 30 feet of you."
  async sharkcycleRider(actor, item, pay) {
    return (await pay('standard')) && (await spendPower(actor, ONE_PP)) ? vehicleLine(actor, await summonVehicle(actor, 'sharkCycle', { grantor: item })) : null;
  },
  // Summon Cycle (Finster's p.274): "DIF 12 Performance (Rituals) Skill Test in a 10-minute ritual to
  // recreate the effects of the Shark Cycle Rider Grid Power for 1 hour."
  async summonCycle(actor, item) {
    const { rollTest } = await import("../resources/grants.mjs");
    const { success } = await rollTest(actor, 'performance', 12);
    return success ? vehicleLine(actor, await summonVehicle(actor, 'sharkCycle', { grantor: item, until: 'scene' })) : T('E20.GrantFailed', { name: actor.name, item: item.name });
  },
  async galaxyGlider(actor, item, pay) {
    return (await pay('free')) && (await spendPower(actor, ONE_PP)) ? vehicleLine(actor, await summonVehicle(actor, 'galaxyGlider', { grantor: item })) : null;
  },
  async jetJammer(actor, item, pay) {
    return (await pay('standard')) && (await spendPower(actor, ONE_PP)) ? vehicleLine(actor, await summonVehicle(actor, 'jetJammer', { grantor: item })) : null;
  },
  // Dino Raptor: "This costs 1 Personal Power and a Dino Raptor answers the call like a Zord, arriving
  // within 3d2 game rounds."
  async dinoRaptor(actor, item, pay) {
    if (!(await pay('standard')) || !(await spendPower(actor, ONE_PP))) {
      return null;
    }

    const roll = game.combat?.started ? (await new Roll('3d2').evaluate()).total : 0;
    return vehicleLine(actor, await summonVehicle(actor, 'dinoRaptor', { grantor: item, arrivalRounds: roll }));
  },
  // Vector/Strata Cycle: "by spending 1 Personal Power ... It returns to its capsule-storage form at the
  // end of the scene."
  async vectorStrataCycle(actor, item, pay) {
    const { chooseButtons } = await import("../resources/grants.mjs");
    const key = await chooseButtons(item.name, T('E20.CyclePick'), [['strataCycle', 'Strata Cycle'], ['vectorCycle', 'Vector Cycle']]);
    return key && (await pay('standard')) && (await spendPower(actor, ONE_PP)) ? vehicleLine(actor, await summonVehicle(actor, key, { grantor: item, until: 'scene' })) : null;
  },
  // Time Jet: "Stored in a collapsed quantum state until 3 Personal Power are spent in any combination by
  // you and your teammates". The card lets teammates chip in.
  async timeJet(actor, item) {
    const { chooseButtons } = await import("../resources/grants.mjs");
    const own = await chooseButtons(item.name, T('E20.TimeJetHowMuch'), [['1', '1'], ['2', '2'], ['3', '3']]);
    if (!own || !(await spendPower(actor, Number(own)))) {
      return null;
    }

    const pool = Number(own);
    if (pool >= 3) {
      return vehicleLine(actor, await summonVehicle(actor, 'timeJet', { grantor: item }));
    }

    await actor.setFlag('essence20', 'timeJetPool', { pool, scene: getSceneEpoch() });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${T('E20.TimeJetNeedsMore', { name: actor.name, pool })}</p><button type="button" data-e20-social="timeJet" data-owner="${actor.uuid}">${T('E20.TimeJetContribute')}</button>`,
    });
    return null;
  },
  // Hitch A Ride (MLP CRB p.138): "3 Spellcasting, 1 day, 20ft. You summon a magical vehicle".
  async hitchARide(actor, item) {
    return vehicleLine(actor, await summonVehicle(actor, 'hitchARide', { grantor: item }));
  },
  // Riding Rig (Cobra Codex p.60): "You gain a Riding Rig as personal gear." Biker: "you gain the benefits
  // of the Rigger Focus's Riding Rig Perk."
  ridingRig: (actor, item) => vehicleLine(actor, summonVehicle(actor, 'ridingRig', { grantor: item })),
  biker: (actor, item) => vehicleLine(actor, summonVehicle(actor, 'ridingRig', { grantor: item })),
  // Rig Upgrade: "At 6th level, you gain a Standard Drone Upgrade ... At 10th level ... a Limited Drone
  // Upgrade. At 17th level ... a Restricted Drone Upgrade." Picked onto the Rig as they become due.
  async rigUpgrade(actor, item) {
    const rig = vehiclesOf(actor, 'ridingRig')[0];
    if (!rig) {
      ui.notifications.warn(T('E20.RigNone', { name: actor.name }));
      return null;
    }

    const level = Number(actor.system?.level) || 1;
    const due = [[6, 'standard'], [10, 'standard'], [10, 'limited'], [17, 'standard'], [17, 'limited'], [17, 'restricted']].filter(([l]) => level >= l);
    const taken = Number(item.flags?.essence20?.rigUpgrades) || 0;
    if (taken >= due.length) {
      ui.notifications.info(T('E20.GrantAlready'));
      return null;
    }

    const { pickAndGrant } = await import("../resources/grants.mjs");
    const got = await pickAndGrant(rig, item, item.name, { type: 'upgrade', availabilities: [due[taken][1]], matches: e => e.system?.type == 'drone' });
    if (got) {
      await item.setFlag('essence20', 'rigUpgrades', taken + 1);
    }

    return got ? T('E20.GrantGained', { name: rig.name, item: item.name, what: got.name }) : null;
  },
  // Skybound: "You gain a Jet Pack ... but without its Quad Blast 25mm Axial Machine Guns ... If your
  // Jet Pack gets destroyed on a mission, you gain a new Jet Pack the following mission."
  skybound: (actor, item) => vehicleLine(actor, summonVehicle(actor, 'jetPack', { grantor: item })),
  // Crashing From The Skies: "your Jet Pack's Aerial Movement increases to 45 feet. Additionally, your Jet
  // Pack now comes equipped with a Quad Blast 25mm Axial Machine Guns."
  async crashingFromTheSkies(actor, item) {
    const jetPack = vehiclesOf(actor, 'jetPack')[0];
    if (!jetPack || item.flags?.essence20?.granted) {
      ui.notifications.info(T(jetPack ? 'E20.GrantAlready' : 'E20.JetPackNone'));
      return null;
    }

    await jetPack.update({ 'system.movement.aerial.base': 45 });
    await jetPack.createEmbeddedDocuments('Item', vehicleItems({ attacks: [attack('Quad Blast 25mm Axial Machine Guns', 'targeting', 1, 'sharp', [40, 1600])] }));
    await item.setFlag('essence20', 'granted', true);
    return T('E20.GrantGained', { name: jetPack.name, item: item.name, what: 'Quad Blast 25mm Axial Machine Guns' });
  },
  necroscientist: (actor, item, pay) => reviveToxoZombie(actor, pay),
  async alliesFromBelow(actor, item, pay) {
    return (await pay('standard')) ? alliesFromBelow(actor) : null;
  },
  // Accelerate Conversion: "Once per scene, you may spend 1 Personal Power or Energon Point to Convert as a
  // Free action if you are a Cybertronian. Additionally, once per scene, you may reduce the time before
  // you can summon your Zord or before your team can combine into a Megaform by 2 rounds."
  async accelerateConversion(actor, item) {
    const { chooseButtons } = await import("../resources/grants.mjs");
    const choice = await chooseButtons(item.name, T('E20.AcceleratePrompt'), [
      ...(actor.system?.canTransform ? [['convert', T('E20.AccelerateConvert')]] : []), ['wait', T('E20.AccelerateWait')],
    ]);
    if (choice == 'wait') {
      return accelerate(actor);
    }

    if (choice != 'convert' || getUses(actor, 'accelerateConvertPaid', 'scene') >= 1) {
      return choice ? (ui.notifications.warn(T('E20.OncePerScene')), null) : null;
    }

    const energon = Number(actor.system?.energon?.normal?.value) || 0;
    const power = Number(actor.system?.powers?.personal?.value) || 0;
    if (energon < 1 && power < 1) {
      ui.notifications.warn(T('E20.NoPower', { name: actor.name }));
      return null;
    }

    await actor.update(energon >= 1 ? { 'system.energon.normal.value': energon - 1 } : { 'system.powers.personal.value': power - 1 });
    await markUsed(actor, 'accelerateConvertPaid', { window: 'scene' });
    await actor.setFlag('essence20', 'accelerateConvert', getSceneEpoch());
    return T('E20.AccelerateConvertReady', { name: actor.name });
  },
  // Rally Guardians (Through the Shattered Grid p.72): "Your company of Guardians uses the same rules and
  // statistics for Zords". A Zord actor for the company.
  async rallyGuardians(actor, item) {
    if (companionsOf(actor).some(a => a.flags?.essence20?.guardians)) {
      ui.notifications.info(T('E20.GrantAlready'));
      return null;
    }

    const { createViaGm } = await import("../world/gm-relay.mjs");
    const createdUuid = await createViaGm('actor', { data: {
      name: T('E20.GuardianCompanyName', { name: actor.name }), type: 'zord', ownership: foundry.utils.deepClone(actor.ownership ?? {}),
      flags: { essence20: { companionOf: actor.uuid, guardians: true, grantedBy: item.id } },
    } });
    const company = createdUuid ? await fromUuid(createdUuid) : null;
    if (company) {
      const { setEntryAndAddActor } = await import("../../sheet-handlers/drop-handler.mjs");
      await setEntryAndAddActor(company, actor);
    }

    return company ? T('E20.GuardianCompanyRallied', { name: actor.name }) : null;
  },
  // Organic Zord (Beneath the Helmet p.42): "enhance your or another Power Ranger's Zord with a Feature
  // chosen from the Upgraded Zord features."
  async organicZord(actor, item) {
    const zords = worldActors().filter(a => a.type == 'zord' && a.isOwner);
    const { chooseSelect, pickAndGrant } = await import("../resources/grants.mjs");
    const picked = await chooseSelect(item.name, T('E20.OrganicZordPick'), zords.map(z => ({ value: z.uuid, label: z.name })));
    const zord = picked ? await fromUuid(picked) : null;
    const got = zord ? await pickAndGrant(zord, item, item.name, { type: 'feature' }) : null;
    return got ? T('E20.GrantGained', { name: zord.name, item: item.name, what: got.name }) : null;
  },
};

async function vehicleLine(actor, vehiclePromise) {
  const vehicle = await vehiclePromise;
  return vehicle ? T('E20.VehicleSummoned', { name: actor.name, vehicle: vehicle.name }) : null;
}

const BY_SOURCE = Object.fromEntries(Object.keys(HANDLERS).filter(k => SUMMON[k]).map(k => [SUMMON[k], k]));

export function summonKindOf(item) {
  if (isBattlizer(item)) {
    return 'battlizer';
  }

  return BY_SOURCE[sourceOf(item)] ?? null;
}

/**
 * The Use button.
 */
export async function runSummonUse(item, economy) {
  const kind = summonKindOf(item);
  const actor = item?.parent;
  if (!kind || !actor) {
    return null;
  }

  const pay = async (cost) => {
    if (!cost || !game.combat || !economy) {
      return true;
    }

    const paid = await economy.spend(actor, cost, { source: item.name });
    return !paid.blocked;
  };

  if (kind == 'battlizer') {
    return summonBattlizer(actor, item, pay);
  }

  return HANDLERS[kind](actor, item, pay);
}

/**
 * A teammate chipping in to the Time Jet.
 */
export async function onTimeJetContribute(button) {
  const owner = await fromUuid(button.dataset.owner);
  const helper = canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character;
  const state = owner?.flags?.essence20?.timeJetPool;
  if (!owner || !helper?.isOwner || !state || state.scene != getSceneEpoch()) {
    return;
  }

  if (!(await spendPower(helper, 1))) {
    return;
  }

  const pool = state.pool + 1;
  const { needsGmRelay, relayToGm } = await import("../world/gm-relay.mjs");
  const write = (key, value) => (needsGmRelay(owner) ? relayToGm(owner, 'setFlag', ['essence20', key, value]) : owner.setFlag('essence20', key, value));
  if (pool >= 3) {
    await write('timeJetPool', { pool: 0, scene: null });
    const vehicle = vehiclesOf(owner, 'timeJet')[0];
    if (vehicle) {
      await placeNear(owner, vehicle);
    } else if (owner.isOwner) {
      await summonVehicle(owner, 'timeJet');
    }

    ChatMessage.create({ content: T('E20.TimeJetReady', { name: owner.name }) });
  } else {
    await write('timeJetPool', { pool, scene: getSceneEpoch() });
    ChatMessage.create({ content: T('E20.TimeJetContributed', { name: helper.name, pool }) });
  }
}
