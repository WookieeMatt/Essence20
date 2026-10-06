import { COMP, companionKindOf, isOnceCompanionUse } from "./companion-uses.mjs";
import { companionsOf, countSourced, hasSourced, linkCompanion, ownerOf, worldActors } from "./companion-link.mjs";
import { getSceneEpoch } from "../resources/scene-clock.mjs";
import { rulePetCommandTier, rulePetCommandUpshift } from "../../rules/plugins/picks/pet-command.mjs";
import { itemsOf, sourceOfOrUndefined as sourceOf } from "../../items/shared/item-lookups.mjs";

/**
 * Companions: pets (GI JOE CRB p.163-168, MLP CRB p.154-157, WTNV Citizens' Guide p.73-75), drones
 * (GI JOE CRB p.167-169), Mini-Cons (TF CRB p.74-76, Decepticon Directive p.49-50), and human and
 * alien companions (TF CRB p.109, Enigma of Combination p.39).
 *
 * - A companion is a `companion` actor tied to its owner by mechanics/companions/companion-link.mjs. The Perk that
 *   grants one has a Use button that builds it the first time and improves it after that (the Perk
 *   can be taken up to three times, each step moving the pet up one Availability).
 * - Actors and tokens are made through mechanics/world/gm-relay.mjs#createViaGm, since a player may not make
 *   them by default.
 * - The numbers are the books': build tables for pets and drones, the Mini-Con stat block. Where a
 *   book gives none (an MLP pet's Health, a human companion's Defenses), the nearest table is used and
 *   the actor is left editable.
 */

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const TIERS = ['standard', 'limited', 'restricted'];
const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
const ITEM = {
  animalGij: uuid('gi_joe_crb', 'YeGzq0XETdv7LeBn'),
  animalMlp: uuid('mlp_crb', 'oCYovZheSrNIvrti'),
  animalWtnv: uuid('wtnv_citizens_guide', 'xNiPMhVMQQUzlRg8'),
  robot: uuid('gi_joe_crb', 'xV4nnjMxlb4dmyxo'),
  acuteSense: uuid('gi_joe_crb', 'WvjGJ5AcC0z07d0J'),
  protectedTarget: uuid('gi_joe_crb', 'llnU5dWqYlfgLA5V'),
  bodyShield: uuid('gi_joe_crb', 'CBfLvmIWdbLuucts'),
  defendersOath: uuid('gi_joe_crb', 'LuQoEjHVOM8Yoc0Y'),
  canineCannon: uuid('across_the_stars', 'x51EQgTwqoC7f5ua'),
};

const level = actor => Number(actor?.system?.level) || 1;

async function skillRanks(actor, skill) {
  const { getSkillRanks } = await import("../combat/combat.mjs");
  return actor?.system?.skills ? getSkillRanks(actor, skill) : 0;
}

/* -------------------------------------------- */
/*  Pet and drone statistics                     */
/* -------------------------------------------- */

// Movement by form and availability (GI JOE CRB p.165 / p.168; Cobra Codex p.102 adds Climbing).
const MOVEMENT = {
  land: { standard: { ground: 30 }, limited: { ground: 45 }, restricted: { ground: 60 } },
  sea: { standard: { ground: 15, swim: 15 }, limited: { ground: 30, swim: 30 }, restricted: { ground: 45, swim: 45 } },
  air: { standard: { aerial: 15 }, limited: { aerial: 30 }, restricted: { aerial: 45 } },
  climb: { standard: { ground: 15, climb: 15 }, limited: { ground: 30, climb: 30 }, restricted: { ground: 45, climb: 45 } },
};

/**
 * An animal pet by the G.I. JOE / Night Vale tables (GI JOE CRB p.165): Standard Attack is
 * Strength/Speed 2, Smarts/Social 1, 3 Health; Standard Utility is the reverse with 2 Health;
 * Limited adds 2 Essence and 1 Health, Restricted 4 Essence and 3 Health.
 * Size: Small gives +1/+2/+3 Evasion, Common +1/+2/+3 Toughness, Large (Restricted) +1 Toughness.
 * Cobra Codex's Sacrificial Pet: 3/4/6 Health on the Attack Essences.
 * The added Essence goes to the function's own pair; it stays editable on the sheet.
 * @param {Object} build   {availability, fn: attack|utility|sacrificial, size, move}
 * @returns {Object}   system data.
 */
export function animalStats({ availability = 'standard', fn = 'attack', size = 'small', move = 'land' } = {}) {
  const tier = Math.max(0, TIERS.indexOf(availability));
  const utility = fn == 'utility';
  const essences = utility ? { strength: 1, speed: 1, smarts: 2, social: 2 } : { strength: 2, speed: 2, smarts: 1, social: 1 };
  const extra = [0, 2, 4][tier];
  const pair = utility ? ['smarts', 'social'] : ['strength', 'speed'];
  essences[pair[0]] += Math.ceil(extra / 2);
  essences[pair[1]] += Math.floor(extra / 2);
  const health = fn == 'sacrificial' ? [3, 4, 6][tier] : (utility ? 2 : 3) + [0, 1, 3][tier];
  const defenses = { toughness: 0, evasion: 0 };
  if (size == 'small') {
    defenses.evasion += tier + 1;
  } else if (size == 'large') {
    defenses.toughness += 1;
  } else {
    defenses.toughness += tier + 1;
  }

  return statsData({ essences, health, defenses, movement: MOVEMENT[move]?.[TIERS[tier]] ?? MOVEMENT.land.standard, size });
}

/**
 * A drone (GI JOE CRB p.168): Standard 2 Health, every Essence 1; Limited 3 Health, every Essence 1
 * plus 2 increases; Restricted 4 Health, every Essence 2 plus 2 increases. The increases go to
 * Speed and Smarts.
 */
export function droneStats({ availability = 'standard', size = 'small', move = 'air' } = {}) {
  const tier = Math.max(0, TIERS.indexOf(availability));
  const base = tier == 2 ? 2 : 1;
  const essences = { strength: base, speed: base, smarts: base, social: base };
  if (tier > 0) {
    essences.speed += 1;
    essences.smarts += 1;
  }

  const defenses = { toughness: 0, evasion: 0 };
  defenses[size == 'small' ? 'evasion' : 'toughness'] += size == 'large' ? 1 : tier + 1;
  return statsData({ essences, health: [2, 3, 4][tier], defenses, movement: MOVEMENT[move]?.[TIERS[tier]] ?? MOVEMENT.air.standard, size });
}

/**
 * An MLP pet (MLP CRB p.154-157): Small, 30ft Land, Strength 1 / Speed 3 / Smarts 2 / Social 2,
 * +3 Evasion. The book gives no Health; 3 is the G.I. JOE Attack pet's.
 */
export function ponyPetStats() {
  return statsData({ essences: { strength: 1, speed: 3, smarts: 2, social: 2 }, health: 3, defenses: { toughness: 0, evasion: 3 }, movement: { ground: 30 }, size: 'small' });
}

/**
 * The Mini-Con stat block (TF CRB p.75): Common, 20ft Aerial and Ground, 2 in every Essence, 12 in
 * every Defense. Its Health is whatever its owner gives it when it deploys.
 */
export function miniConStats() {
  return statsData({ essences: { strength: 2, speed: 2, smarts: 2, social: 2 }, health: 0, defenses: { toughness: 0, evasion: 0 }, movement: { ground: 20, aerial: 20 }, size: 'common' });
}

function statsData({ essences, health, defenses, movement, size }) {
  const system = { size, 'health.origin': health, 'health.value': health };
  for (const [key, value] of Object.entries(essences)) {
    system[`essences.${key}.max`] = value;
    system[`essences.${key}.value`] = value;
  }

  for (const [key, value] of Object.entries(defenses)) {
    system[`defenses.${key}.base`] = 10 + value;
  }

  for (const key of ['ground', 'aerial', 'swim', 'climb']) {
    system[`movement.${key}.base`] = movement[key] ?? 0;
  }

  return system;
}

function expand(flat) {
  const out = {};
  for (const [key, value] of Object.entries(flat)) {
    foundry.utils.setProperty(out, key, value);
  }

  return out;
}

/* -------------------------------------------- */
/*  Items a companion is built with              */
/* -------------------------------------------- */

async function copyOf(uuidOrNull, extra = {}) {
  const source = uuidOrNull ? await fromUuid(uuidOrNull) : null;
  if (!source) {
    return null;
  }

  const data = source.toObject();
  delete data._id;
  foundry.utils.setProperty(data, 'flags.core.sourceId', uuidOrNull);
  return foundry.utils.mergeObject(data, extra);
}

/** A natural attack: the weapon plus its effect, as the embedded-item pair the sheet expects. */
function naturalAttack(name, { skill = 'might', damage = 1, type = 'blunt', range = null } = {}) {
  const id = foundry.utils.randomID();
  return [
    { _id: id, name, type: 'weapon', system: { classification: { size: 'sidearm' }, availability: 'standard', equipped: true, hardpoint: { type: 'none' } }, flags: { essence20: { natural: true } } },
    {
      name, type: 'weaponEffect',
      system: {
        classification: { skill, style: range ? 'energy' : 'melee' }, damageType: type, damageValue: damage, numTargets: 1, numHands: '0',
        range: range ? { value: range[0], long: range[1] } : { reachMultiplier: 1 },
      },
      flags: { essence20: { parentId: id } },
    },
  ];
}

/* -------------------------------------------- */
/*  Making and improving one                     */
/* -------------------------------------------- */

/**
 * Make a companion for an owner. Asks the GM to when the player may not.
 * @param {Actor} owner
 * @param {Object} data   Actor data: {name, system, items, flags}.
 * @param {Item} [grantor]
 * @returns {Promise<Actor|null>}
 */
export async function createCompanion(owner, data, grantor = null) {
  const { createViaGm } = await import("../world/gm-relay.mjs");
  const actorData = foundry.utils.mergeObject({
    type: 'companion', img: owner?.img ?? undefined, folder: owner?.folder?.id ?? null,
    ownership: foundry.utils.deepClone(owner?.ownership ?? {}),
    flags: { essence20: { companionOf: owner.uuid, grantedBy: grantor ? sourceOf(grantor) ?? grantor.uuid : null } },
  }, data, { inplace: false });
  const createdUuid = await createViaGm('actor', { data: actorData });
  const companion = createdUuid ? await fromUuid(createdUuid) : null;
  if (companion) {
    await linkCompanion(owner, companion);
  }

  return companion;
}

async function buildForm(title, fields) {
  const content = fields.map(field => `<div class="form-group"><label>${field.label}</label>${
    field.options
      ? `<select name="${field.name}">${field.options.map(([value, label]) => `<option value="${value}">${foundry.utils.escapeHTML(label)}</option>`).join('')}</select>`
      : `<input type="${field.type ?? 'text'}" name="${field.name}" value="${foundry.utils.escapeHTML(String(field.value ?? ''))}" />`
  }</div>`).join('');
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    content,
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true,
        callback: (event, button) => Object.fromEntries(fields.map(f => [f.name, button.form.elements[f.name].value])) },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  return result && result != 'cancel' ? result : null;
}

const MOVE_OPTIONS = () => [['land', T('E20.PetMoveLand')], ['sea', T('E20.PetMoveSea')], ['air', T('E20.PetMoveAir')], ['climb', T('E20.PetMoveClimb')]];

/**
 * How many times the owner holds a Perk - and so which availability its pet has reached.
 */
function tierFor(owner, grantorUuid) {
  return TIERS[Math.min(3, Math.max(1, countSourced(owner, grantorUuid))) - 1];
}

/**
 * Night Vale Community Adoption Center's "improving a single pet with a new Animal Perk": pick one of
 * the owner's Adoption Center pets (if several) and one Animal Perk from the Citizens' Guide.
 * @param {Array<Actor>} pets
 * @param {Item} grantor
 * @param {Function} [pick]   (title, rows) => a picked uuid; defaults to grants.mjs#pickOne.
 * @returns {Promise<String|null>}
 */
export async function addNightValeAnimalPerk(pets, grantor, pick = null) {
  let pet = pets[0];
  if (pets.length > 1) {
    const answer = await buildForm(grantor.name, [{ name: 'pet', label: T('E20.PetLabel'), options: pets.map(p => [p.uuid, p.name]) }]);
    pet = pets.find(p => p.uuid == answer?.pet);
  }

  if (!pet) {
    return null;
  }

  const pack = game.packs?.get?.('essence20.wtnv_citizens_guide');
  const folder = (pack?.folders?.contents ?? [...(pack?.folders ?? [])]).find(f => /^animal perks?$/i.test(f.name));
  const index = folder ? await pack.getIndex({ fields: ['folder', 'type'] }) : [];
  const rows = [...index.values()].filter(entry => entry.type == 'perk' && entry.folder == folder.id && entry.uuid != ITEM.animalWtnv)
    .map(entry => ({ uuid: entry.uuid, name: entry.name })).sort((a, b) => a.name.localeCompare(b.name));
  const { grantCopy, pickOne } = await import("../resources/grants.mjs");
  const uuid = await (pick ?? pickOne)(grantor.name, rows);
  const got = uuid ? await grantCopy(pet, uuid, { grantedBy: grantor }) : null;
  return got ? T('E20.GrantGained', { name: pet.name, item: grantor.name, what: got.name }) : null;
}

function petsFrom(owner, grantor) {
  const source = sourceOf(grantor);
  return companionsOf(owner).filter(pet => pet.flags?.essence20?.grantedBy == source);
}

/**
 * Animal pets and drones: build one, or raise the pet this Perk gave to the availability its
 * number of picks allows.
 * @param {Actor} owner
 * @param {Item} grantor
 * @param {Object} options
 * @param {String} options.kind   'animal', 'drone', 'robotAnimal' or 'pony'.
 * @param {String} [options.line]   'gij', 'mlp' or 'wtnv' - whose Animal Perk and Favorite Command to give.
 * @returns {Promise<String|null>}
 */
export async function grantPet(owner, grantor, { kind = 'animal', line = 'gij', maxPets = 1 } = {}) {
  // Night Vale pets have no Availability tiers: each extra pick of the Adoption Center is a new pet
  // or one more Animal Perk on an existing pet (Citizens' Guide p.47).
  const nightVale = line == 'wtnv';
  const availability = kind == 'pony' || nightVale ? 'standard' : tierFor(owner, sourceOf(grantor));
  const existing = petsFrom(owner, grantor);
  const pet = existing[0];
  const canAddAnother = kind == 'pony' || maxPets > existing.length;
  // Improve, or (MLP / Night Vale) gain another.
  if (pet) {
    const improve = nightVale || (kind != 'pony' && TIERS.indexOf(pet.system?.availability) < TIERS.indexOf(availability));
    const improveLabel = nightVale ? T('E20.PetAddAnimalPerk', { name: pet.name })
      : T('E20.PetImprove', { name: pet.name, availability: T(`E20.Availability${availability.capitalize()}`) });
    const { chooseButtons } = await import("../resources/grants.mjs");
    const choice = improve && !canAddAnother ? 'improve' : (!improve && !canAddAnother ? null : await chooseButtons(grantor.name, T('E20.PetImproveOrNew'), [
      ...(improve ? [['improve', improveLabel]] : []),
      ...(canAddAnother ? [['new', T('E20.PetNew')]] : []),
    ]));
    if (!choice) {
      ui.notifications.info(T('E20.PetAlreadyHave', { name: pet.name }));
      return null;
    }

    if (choice == 'improve' && nightVale) {
      return addNightValeAnimalPerk(existing, grantor);
    }

    if (choice == 'improve') {
      const build = pet.flags?.essence20?.petBuild ?? {};
      const stats = kind == 'drone' ? droneStats({ ...build, availability }) : animalStats({ ...build, availability });
      await pet.update({ ...stats, 'system.availability': availability, 'flags.essence20.petBuild': { ...build, availability } });
      return T('E20.PetImproved', { name: owner.name, pet: pet.name, availability: T(`E20.Availability${availability.capitalize()}`) });
    }
  }

  const fields = [{ name: 'name', label: T('E20.PetName'), value: kind == 'drone' ? T('E20.DroneDefaultName', { name: owner.name }) : T('E20.PetDefaultName', { name: owner.name }) }];
  if (kind != 'pony') {
    const fnOptions = kind == 'drone'
      ? [['attack', T('E20.PetFunctionAttack')], ['utility', T('E20.PetFunctionUtility')], ['shield', T('E20.PetFunctionShield')]]
      : [['attack', T('E20.PetFunctionAttack')], ['utility', T('E20.PetFunctionUtility')], ['sacrificial', T('E20.PetFunctionSacrificial')],
        ...(availability != 'standard' ? [['venomous', T('E20.PetFunctionVenomous')]] : [])];
    fields.push({ name: 'fn', label: T('E20.PetFunction'), options: fnOptions });
    fields.push({ name: 'size', label: T('E20.PetSize'), options: [['small', T('E20.SizeSmall')], ['common', T('E20.SizeCommon')], ...(availability == 'restricted' ? [['large', T('E20.SizeLarge')]] : [])] });
    fields.push({ name: 'move', label: T('E20.PetMovement'), options: MOVE_OPTIONS() });
  }

  const build = await buildForm(grantor.name, fields);
  if (!build) {
    return null;
  }

  const fn = build.fn == 'venomous' ? 'attack' : build.fn;
  const stats = kind == 'pony' ? ponyPetStats() : (kind == 'drone' ? droneStats({ availability, ...build }) : animalStats({ availability, ...build, fn }));
  const items = [];
  const animalPerk = { gij: ITEM.animalGij, mlp: ITEM.animalMlp, wtnv: ITEM.animalWtnv }[line] ?? ITEM.animalGij;
  if (kind != 'drone') {
    items.push(await copyOf(animalPerk));
  }

  if (kind == 'drone' || kind == 'robotAnimal') {
    items.push(await copyOf(ITEM.robot));
  }

  if (fn == 'utility' && kind != 'drone') {
    const favorite = { gij: COMP.favoriteCommandGij, mlp: COMP.favoriteCommandMlp, wtnv: COMP.favoriteCommandWtnv }[line] ?? COMP.favoriteCommandGij;
    items.push(await copyOf(favorite));
  }

  // Acute Senses as a General Perk once for a Standard animal pet, twice for Limited, three times
  // for Restricted.
  if (kind == 'animal' || kind == 'robotAnimal') {
    for (let i = 0; i <= TIERS.indexOf(availability); i++) {
      items.push(await copyOf(ITEM.acuteSense));
    }
  }

  // Attack: "treated as Brawling or a Strike" (Standard), "a close combat blade or a close combat
  // bludgeon" (Limited), "heavy blade or heavy bludgeon" (Restricted). Venomous: "treated as Unarmed
  // Combat" or "a Close Combat Blade", plus a poison.
  if (fn == 'attack' || fn == 'sacrificial' || kind == 'pony') {
    const tier = TIERS.indexOf(availability);
    items.push(...naturalAttack(T('E20.PetNaturalAttack'), { damage: build.fn == 'venomous' ? tier : tier + 1, type: tier == 0 ? 'blunt' : 'sharp' }));
  }

  // Sacrificial Pet / Shield Drone: the Bodyguard Perks, by availability (Cobra Codex p.102-103).
  if (fn == 'sacrificial' || fn == 'shield') {
    for (const perk of [ITEM.protectedTarget, ITEM.bodyShield, ITEM.defendersOath].slice(0, TIERS.indexOf(availability) + 1)) {
      items.push(await copyOf(perk));
    }
  }

  const companion = await createCompanion(owner, {
    name: build.name || grantor.name,
    system: { ...expand(stats), type: kind == 'drone' ? 'drone' : 'pet', availability },
    items: items.filter(Boolean),
    flags: { essence20: { petBuild: { fn, size: build.size ?? 'small', move: build.move ?? 'land', kind, line } } },
  }, grantor);
  if (!companion) {
    return null;
  }

  const { pickAndGrant } = await import("../resources/grants.mjs");
  // Drone Attack/Utility: one integrated weapon of the drone's own availability / one integrated
  // kit. Shield Drone: one shield of its tier.
  if (kind == 'drone') {
    if (fn == 'attack') {
      await pickAndGrant(companion, grantor, grantor.name, { type: 'weapon', availabilities: [availability] }, { integrated: true });
    } else if (fn == 'utility') {
      await pickAndGrant(companion, grantor, grantor.name, { type: 'gear', availabilities: [availability], matches: e => e.system?.gearType == 'kits' }, { integrated: true });
    } else if (fn == 'shield') {
      await pickAndGrant(companion, grantor, grantor.name, { type: 'shield', availabilities: [availability] });
    }
  }

  // Venomous: a chosen Standard (or Limited) poison whose effect lands on a hit. The poison is kept on the pet and coats its natural attack.
  if (build.fn == 'venomous') {
    const poison = await pickAndGrant(companion, grantor, grantor.name, {
      type: 'weapon', availabilities: availability == 'restricted' ? ['standard', 'limited'] : ['standard'], matches: e => !!e.system?.isPoison,
    });
    const bite = itemsOf(companion).find(i => i.type == 'weapon' && i.flags?.essence20?.natural);
    const effect = itemsOf(companion).find(i => i.type == 'weaponEffect' && i.flags?.essence20?.parentId == poison?.id);
    if (poison && bite) {
      // A coating that never wipes (items/gear/poison-coating.mjs#wipeCoating skips `permanent`).
      await bite.setFlag('essence20', 'poisonCoating', {
        name: poison.name, damageValue: effect?.system?.damageValue ?? 0, damageType: effect?.system?.damageType ?? 'poison', hacker: false, permanent: true,
      });
    }
  }

  const perks = kind == 'drone' ? await skillRanks(owner, 'technology') : await skillRanks(owner, 'animalHandling');
  return T(kind == 'drone' ? 'E20.DroneGained' : 'E20.PetGained', { name: owner.name, pet: companion.name, perks });
}

/**
 * Mini-Cons (TF CRB p.74-76): a Mini-Con ally with a purpose Skill.
 * Every two Skill Points in the purpose Skill give the Mini-Con two Essence increases, or one
 * increase and a Mini-Con Perk; one increase always goes to the purpose's Essence. The required increase is made here; the rest are the player's.
 */
export async function grantMiniCon(owner, grantor, { count = 1 } = {}) {
  const skills = Object.entries(CONFIG.E20.skills).filter(([key]) => key != 'initiative').map(([key, label]) => [key, T(label)]);
  const altModes = [['firearm', T('E20.MiniConAltFirearm')], ['cassette', T('E20.MiniConAltCassette')], ['vehicle', T('E20.MiniConAltVehicle')], ['conduit', T('E20.MiniConAltConduit')]];
  // Mini-Con Affinity: every Mini-Con the holder has shares one Alt Mode.
  const affinity = hasSourced(owner, COMP.miniConAffinity);
  const sharedAlt = affinity ? companionsOf(owner, { type: 'miniCon' })[0]?.flags?.essence20?.miniCon?.altMode : null;
  const made = [];
  for (let i = 0; i < count; i++) {
    const fields = [
      { name: 'name', label: T('E20.PetName'), value: T('E20.MiniConDefaultName', { name: owner.name }) },
      { name: 'purpose', label: T('E20.MiniConPurpose'), options: skills },
    ];
    if (affinity && !sharedAlt && !made.length) {
      fields.push({ name: 'altMode', label: T('E20.MiniConAltMode'), options: altModes });
    }

    const build = await buildForm(grantor.name, fields);
    if (!build) {
      break;
    }

    const altMode = build.altMode ?? sharedAlt ?? made[0]?.flags?.essence20?.miniCon?.altMode ?? null;
    const stats = expand(miniConStats());
    const essence = CONFIG.E20.skillToEssence?.[build.purpose];
    const points = await skillRanks(owner, build.purpose);
    const increases = Math.floor(points / 2) * 2;
    if (essence && increases > 0) {
      stats.essences[essence].max += 1;
      stats.essences[essence].value += 1;
    }

    const companion = await createCompanion(owner, {
      name: build.name || T('E20.MiniCon'),
      system: { ...stats, type: 'miniCon', availability: 'standard' },
      items: [
        ...naturalAttack(T('E20.MiniConUnarmed'), { skill: 'might', damage: 1, type: 'blunt' }),
        ...naturalAttack(T('E20.MiniConLaser'), { skill: 'targeting', damage: 1, type: 'laser', range: [10, 50] }),
      ],
      flags: { essence20: { miniCon: { purpose: build.purpose, purposes: [build.purpose], altMode, docked: true, increases: Math.max(0, increases - 1) } } },
    }, grantor);
    if (companion) {
      made.push(companion);
    }
  }

  return made.length ? T('E20.MiniConGained', { name: owner.name, count: made.length, names: made.map(m => m.name).join(', ') }) : null;
}

/**
 * Human Companion (TF CRB p.109): two chosen Essences, each half the owner's level (rounded up) +2.
 * Alien Companion (Enigma of Combination p.39): the same, +1 instead.
 */
async function grantPerson(owner, grantor, bonus, typeKey) {
  const existing = petsFrom(owner, grantor)[0];
  const value = Math.ceil(level(owner) / 2) + bonus;
  const essences = Object.keys(CONFIG.E20.essences ?? { strength: 1, speed: 1, smarts: 1, social: 1 });
  if (existing) {
    const chosen = existing.flags?.essence20?.companionEssences ?? [];
    await existing.update(Object.fromEntries(chosen.flatMap(e => [[`system.essences.${e}.max`, value], [`system.essences.${e}.value`, value]])));
    return T('E20.CompanionRaised', { name: existing.name, value });
  }

  const options = essences.map(e => [e, T(`E20.Essence${e.capitalize()}`)]);
  const build = await buildForm(grantor.name, [
    { name: 'name', label: T('E20.PetName'), value: grantor.name },
    { name: 'first', label: T('E20.CompanionEssence1'), options },
    { name: 'second', label: T('E20.CompanionEssence2'), options: [...options.slice(1), options[0]] },
  ]);
  if (!build || build.first == build.second) {
    return null;
  }

  const stats = {};
  for (const essence of essences) {
    const score = [build.first, build.second].includes(essence) ? value : 1;
    stats[`essences.${essence}.max`] = score;
    stats[`essences.${essence}.value`] = score;
  }

  const companion = await createCompanion(owner, {
    name: build.name, system: { ...expand({ ...stats, 'health.origin': 3, 'health.value': 3 }), type: typeKey, availability: 'standard' },
    flags: { essence20: { companionEssences: [build.first, build.second] } },
  }, grantor);
  return companion ? T('E20.CompanionGained', { name: owner.name, companion: companion.name }) : null;
}

/* -------------------------------------------- */
/*  Mini-Con docking                             */
/* -------------------------------------------- */

export function isDocked(miniCon) {
  return miniCon?.flags?.essence20?.miniCon?.docked !== false;
}

export function dockedMiniCons(owner) {
  return companionsOf(owner, { type: 'miniCon' }).filter(isDocked);
}

/**
 * Deploy (TF CRB p.75): a Free action by either partner; the Mini-Con lands next to its owner.
 * Linked: the owner moves 1 or more Health to the Mini-Con without dropping to 0 - under 2 Health,
 * no deploy. Reinforced Bond: +1 or +2 to the Mini-Con's Defenses, taken off the owner's own.
 */
export async function deployMiniCon(owner, miniCon, { health = null, defenses = 0, free = false } = {}) {
  const current = Number(owner.system?.health?.value) || 0;
  if (current < 2 && !free) {
    ui.notifications.warn(T('E20.MiniConNoHealth', { name: owner.name }));
    return null;
  }

  const give = free ? 0 : Math.max(1, Math.min(current - 1, Number(health) || 1));
  if (give) {
    await owner.update({ 'system.health.value': current - give });
  }

  const updates = { 'flags.essence20.miniCon.docked': false, 'flags.essence20.miniCon.deployedRound': game.combat ? { combatId: game.combat.id, round: game.combat.round } : null,
    'flags.essence20.miniCon.defenseShift': defenses };
  if (give) {
    updates['system.health.origin'] = give;
    updates['system.health.value'] = give;
  }

  await miniCon.update(updates);
  await placeNear(owner, miniCon);
  return T('E20.MiniConDeployed', { name: owner.name, miniCon: miniCon.name, health: give });
}

/**
 * Dock (TF CRB p.75): a Free action by either partner while adjacent, even Defeated; the owner gains
 * the Mini-Con's current Health, which counts as being Repaired.
 */
export async function dockMiniCon(owner, miniCon) {
  const back = Number(miniCon.system?.health?.value) || 0;
  const health = owner.system?.health ?? {};
  await owner.update({ 'system.health.value': Math.min(health.max ?? Infinity, (health.value ?? 0) + back) });
  await miniCon.update({ 'flags.essence20.miniCon.docked': true, 'flags.essence20.miniCon.defenseShift': 0, 'system.health.value': 0 });
  const { createViaGm } = await import("../world/gm-relay.mjs");
  if (canvas?.scene?.tokens?.some(t => t.actorId == miniCon.id)) {
    await createViaGm('deleteToken', { actorUuid: miniCon.uuid, sceneId: canvas.scene.id });
  }

  return T('E20.MiniConDocked', { name: owner.name, miniCon: miniCon.name, health: back });
}

async function placeNear(owner, companion) {
  const token = owner.getActiveTokens?.()?.[0];
  if (!token || !canvas?.scene || canvas.scene.tokens.some(t => t.actorId == companion.id)) {
    return null;
  }

  const size = canvas.grid?.size ?? 100;
  const { createViaGm } = await import("../world/gm-relay.mjs");
  return createViaGm('token', { actorUuid: companion.uuid, sceneId: canvas.scene.id, x: token.document.x + (token.document.width ?? 1) * size, y: token.document.y });
}

async function dockOrDeploy(owner, grantor, pay) {
  const miniCons = companionsOf(owner, { type: 'miniCon' });
  const { chooseSelect } = await import("../resources/grants.mjs");
  const options = miniCons.map(m => ({ value: m.uuid, label: `${m.name} - ${T(isDocked(m) ? 'E20.MiniConStateDocked' : 'E20.MiniConStateDeployed')}` }));
  const picked = options.length == 1 ? options[0].value : await chooseSelect(grantor.name, T('E20.MiniConPick'), options);
  const miniCon = picked ? await fromUuid(picked) : null;
  if (!miniCon || !(await pay('free'))) {
    return null;
  }

  if (!isDocked(miniCon)) {
    return dockMiniCon(owner, miniCon);
  }

  const reinforced = hasSourced(owner, COMP.reinforcedBondTf) || hasSourced(owner, COMP.reinforcedBondDd);
  const fields = [{ name: 'health', label: T('E20.MiniConGiveHealth', { max: Math.max(1, (owner.system?.health?.value ?? 1) - 1) }), type: 'number', value: 1 }];
  if (reinforced) {
    fields.push({ name: 'defenses', label: T('E20.MiniConGiveDefenses'), options: [['0', '0'], ['1', '+1'], ['2', '+2']] });
  }

  const answer = await buildForm(miniCon.name, fields);
  return answer ? deployMiniCon(owner, miniCon, { health: answer.health, defenses: Number(answer.defenses) || 0 }) : null;
}

/* -------------------------------------------- */
/*  Commanding a pet                             */
/* -------------------------------------------- */

const COMMAND_FLAG = 'petCommand';

/** Who may command this pet: its owner, and a Backup Master / Extra Friend designee. */
export function canCommand(actor, pet) {
  if (ownerOf(pet)?.uuid == actor?.uuid) {
    return true;
  }

  return itemsOf(pet).some(item => [COMP.backupMaster, COMP.extraFriend].includes(sourceOf(item)) && item.flags?.essence20?.designee == actor?.uuid);
}

export function commandablePets(actor) {
  const own = companionsOf(actor).filter(c => ['pet', 'drone'].includes(c.system?.type));
  const others = worldActors().filter(a => a.type == 'companion' && !own.includes(a) && canCommand(actor, a));
  return [...own, ...others];
}

// Favorite Command: "Choose a Skill." Picked with the Perk's Use rule (flags.essence20.favoriteSkill) or, for
// a copy dropped onto the pet's sheet, the Perk's own Skill picker (system.choice).
function favoriteSkill(pet) {
  const perk = itemsOf(pet).find(item => [COMP.favoriteCommandGij, COMP.favoriteCommandMlp, COMP.favoriteCommandWtnv].includes(sourceOf(item)));
  const choice = perk?.flags?.essence20?.favoriteSkill || perk?.system?.choice;
  return choice && choice != 'none' ? choice : null;
}

/**
 * The DIF to command: G.I. JOE 0 / 10 / 15 for a Standard / Limited / Restricted animal pet (a
 * drone the same by its availability); MLP and Night Vale DIF 10. Agreeable (G.I. JOE): the pet
 * counts one Availability step up for that DIF.
 */
export function commandDif(pet) {
  const line = pet.flags?.essence20?.petBuild?.line;
  if (line == 'mlp' || line == 'wtnv') {
    return 10;
  }

  // PetCommand rules on the pet (Agreeable's one step - rules/plugins/picks/pet-command.mjs).
  const tier = Math.max(0, Math.max(0, TIERS.indexOf(pet.system?.availability ?? 'standard')) + rulePetCommandTier(pet));

  return [0, 10, 15][tier];
}

/**
 * The Command a Pet action: a Standard action - Animal Handling for an animal pet, Technology for a
 * drone - naming the Skill it should use and a target. Favorite Command: one chosen Skill can be
 * commanded as a Move action instead - that cost is set in
 * mechanics/actions/action-perks.mjs before this runs.
 * @param {Actor} actor
 * @returns {Promise<Object>}   {message} or {cancelled: true}.
 */
export async function commandPet(actor) {
  const pets = commandablePets(actor);
  if (!pets.length) {
    ui.notifications.warn(T('E20.PetNone', { name: actor.name }));
    return { cancelled: true };
  }

  const skills = [['attack', T('E20.PetCommandAttack')], ...Object.entries(CONFIG.E20.skills).map(([key, label]) => [key, T(label)])];
  const answer = await buildForm(T('E20.ActionCommandPet'), [
    { name: 'pet', label: T('E20.PetLabel'), options: pets.map(p => [p.uuid, p.name]) },
    { name: 'skill', label: T('E20.PetCommandSkill'), options: skills },
  ]);
  const pet = answer ? pets.find(p => p.uuid == answer.pet) : null;
  if (!pet) {
    return { cancelled: true };
  }

  const drone = pet.system?.type == 'drone' && !hasSourced(pet, ITEM.animalGij);
  const { rollTest } = await import("../resources/grants.mjs");
  // PetCommand rules' upshift on the pet (Agreeable, MLP: its incoming RollModifier covers rolls that target the pet;
  // commanding it need not target it - rules/plugins/picks/pet-command.mjs).
  const shiftUp = rulePetCommandUpshift(pet);
  const { success } = await rollTest(actor, drone ? 'technology' : 'animalHandling', commandDif(pet), { shiftUp });
  if (!success) {
    return { message: T('E20.PetCommandFailed', { name: actor.name, pet: pet.name }) };
  }

  const label = answer.skill == 'attack' ? T('E20.PetCommandAttack') : T(CONFIG.E20.skills[answer.skill]);
  await pet.setFlag('essence20', COMMAND_FLAG, {
    skill: answer.skill, label, by: actor.uuid, target: game.user?.targets?.first?.()?.actor?.uuid ?? null,
    combatId: game.combat?.id ?? null, round: game.combat?.round ?? null, scene: getSceneEpoch(),
  });
  return { message: T('E20.PetCommanded', { name: actor.name, pet: pet.name, command: label }) };
}

/** Whether the action is a Move action for this actor: a Favorite Command pet, or an Attack pet. */
export function commandIsMove(actor) {
  return commandablePets(actor).some(pet => favoriteSkill(pet) || pet.flags?.essence20?.petBuild?.fn == 'attack');
}

/**
 * A companion's turn start: the Mini-Con tractor beam. (Artificial Intelligence's "it issues itself a Command" and
 * Constrictor's squeeze are turnStart Trigger rules on their items.)
 */
export async function onCompanionTurnStart(actor, _combat) {
  if (actor?.type != 'companion') {
    return;
  }

  // Emergency Deployment and Docking: a Defeated Mini-Con of a standing owner is pulled 30ft closer
  // each time, until it is within the owner's Reach.
  const owner = ownerOf(actor);
  if (actor.system?.type == 'miniCon' && owner && actor.statuses?.has?.('defeated') && !owner.statuses?.has?.('defeated')
    && hasSourced(owner, COMP.emergencyDeployment)) {
    await tractorBeam(owner, actor);
  }
}

async function tractorBeam(owner, miniCon) {
  const from = miniCon.getActiveTokens?.()?.[0];
  const to = owner.getActiveTokens?.()?.[0];
  if (!from || !to || !canvas?.grid) {
    return;
  }

  const distance = canvas.grid.measurePath([from.center, to.center]).distance;
  const step = Math.min(30, Math.max(0, distance - 5));
  if (step <= 0) {
    return;
  }

  const ratio = step / distance;
  const x = from.document.x + (to.document.x - from.document.x) * ratio;
  const y = from.document.y + (to.document.y - from.document.y) * ratio;
  const snapped = from.document.getSnappedPosition?.({ x, y }) ?? { x, y };
  await from.document.update({ x: snapped.x, y: snapped.y });
}

/**
 * Emergency Deployment and Docking: when the owner is Defeated, every docked Mini-Con deploys with
 * 2 Temporary Health. Called when an owner becomes Defeated.
 */
export async function onOwnerDefeated(owner) {
  if (!hasSourced(owner, COMP.emergencyDeployment)) {
    return;
  }

  for (const miniCon of dockedMiniCons(owner)) {
    await deployMiniCon(owner, miniCon, { free: true });
    await miniCon.update({ 'system.health.origin': 2, 'system.health.value': 2, 'flags.essence20.miniCon.emergencyHealth': true });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: miniCon }), content: T('E20.MiniConEmergency', { name: miniCon.name }) });
  }
}

/* -------------------------------------------- */
/*  What owners and companions give each other   */
/* -------------------------------------------- */

/**
 * Health and Defense bonuses a companion or its owner gets from the other's Perks, applied in
 * documents/actor.mjs after Health and Defenses are prepared.
 * @param {Actor} actor
 * @returns {{health: Number, defenses: Object, energonMax: Number, labels: Array<String>}}
 */
export function linkedBonuses(actor) {
  const out = { health: 0, defenses: {}, energonMax: 0, labels: [] };
  const add = (defense, value, label) => {
    out.defenses[defense] = (out.defenses[defense] ?? 0) + value;
    out.labels.push(label);
  };

  if (actor?.type == 'companion') {
    // (Tough Together's pet Health is a DerivedStat rule with scope companion on the owner's Perk.)
    // Reinforced Bond: the Defense bonus the owner handed over on deploy.
    const shift = Number(actor.flags?.essence20?.miniCon?.defenseShift) || 0;
    for (const defense of shift ? ['toughness', 'evasion', 'willpower', 'cleverness'] : []) {
      add(defense, shift, 'Reinforced Bond');
    }

    return out;
  }

  const miniCons = companionsOf(actor, { type: 'miniCon' });
  if (miniCons.length) {
    // Linked: +2 Health per Mini-Con; with Mini-Con Affinity only +1 each.
    out.health += miniCons.length * (hasSourced(actor, COMP.miniConAffinity) ? 1 : 2);
    // Reinforced Bond: the owner's Defenses drop by what was handed over.
    const handed = miniCons.filter(m => !isDocked(m)).reduce((sum, m) => Math.max(sum, Number(m.flags?.essence20?.miniCon?.defenseShift) || 0), 0);
    for (const defense of handed ? ['toughness', 'evasion', 'willpower', 'cleverness'] : []) {
      add(defense, -handed, 'Reinforced Bond');
    }

    // Mini-Con Master: +1 per two docked Mini-Cons of the type.
    if (hasSourced(actor, COMP.miniConMaster)) {
      const docked = miniCons.filter(isDocked);
      const pairs = Math.floor(docked.length / 2);
      const altMode = docked[0]?.flags?.essence20?.miniCon?.altMode;
      const defense = { firearm: 'toughness', cassette: 'willpower', vehicle: 'evasion' }[altMode];
      if (pairs && defense) {
        add(defense, pairs, 'Mini-Con Master');
      } else if (pairs && altMode == 'conduit') {
        out.energonMax += pairs;
      }
    }
  }

  return out;
}

/**
 * Roll sources from companions and owners - a docked Mini-Con's Helper - for mechanics/combat/target-riders.mjs#rollRiderSources.
 * @param {Actor} actor   The roller.
 * @param {Actor|null} target
 * @param {Object} ctx   {rolledSkill, isAttack}
 * @returns {Array<Object>}   Sources {id, label, shiftUp, edge}.
 */
export function companionRollSources(actor, target, { rolledSkill } = {}) {
  const sources = [];
  const add = (id, label, mods) => sources.push({ id, label, shiftUp: mods.shiftUp ?? 0, shiftDown: 0, edge: !!mods.edge, snag: false });
  // (Pack Attack, Automatic Harmonics and Ambush Deployment are RollModifier rules on their Perks, scopes self and
  // companion - the link: tags of rules/plugins/picks/companions.mjs.)

  // Helper (TF CRB p.75): ↑1 on the purpose Skill while the Mini-Con is docked.
  if (actor?.type != 'companion' && rolledSkill && dockedMiniCons(actor).some(m => (m.flags?.essence20?.miniCon?.purposes ?? [m.flags?.essence20?.miniCon?.purpose]).includes(rolledSkill))) {
    add('miniConHelper', T('E20.MiniConHelper'), { shiftUp: 1 });
  }

  return sources;
}

export function isAdjacent(a, b) {
  const ta = a?.getActiveTokens?.()?.[0];
  const tb = b?.getActiveTokens?.()?.[0];
  if (!ta || !tb || !canvas?.grid) {
    return false;
  }

  return canvas.grid.measurePath([ta.center, tb.center]).distance <= 5 + ((ta.document.width ?? 1) + (tb.document.width ?? 1) - 2) * 2.5;
}

/* -------------------------------------------- */
/*  Who rolled against whom this round           */
/* -------------------------------------------- */

const ROLLED_FLAG = 'rolledThisRound';

function roundKey() {
  return game?.combat ? `${game.combat.id}:${game.combat.round}` : `scene:${getSceneEpoch()}`;
}

/**
 * Record the targets of a roll - for Pack Attack and Automatic Harmonics. Called after every roll.
 * @param {Actor} actor
 * @param {Array<Actor>} targets
 * @param {Boolean} isAttack
 */
export async function noteRolledAgainst(actor, targets, isAttack) {
  if (!actor || !targets?.length) {
    return;
  }

  const partnered = actor.type == 'companion' || companionsOf(actor).length;
  if (!partnered) {
    return;
  }

  const key = roundKey();
  const record = actor.flags?.essence20?.[ROLLED_FLAG];
  const list = record?.key == key ? record.list : [];
  const next = [...list, ...targets.map(t => ({ uuid: t.uuid, attack: !!isAttack }))];
  await actor.setFlag('essence20', ROLLED_FLAG, { key, list: next });
}

export function rolledAgainst(actor, target, { attack = false } = {}) {
  const record = actor?.flags?.essence20?.[ROLLED_FLAG];
  if (!record || record.key != roundKey()) {
    return false;
  }

  return record.list.some(entry => entry.uuid == target?.uuid && (!attack || entry.attack));
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

const HANDLERS = {
  animalPetGij: (owner, item) => grantPet(owner, item, { kind: 'animal', line: 'gij' }),
  robotPet: (owner, item) => grantPet(owner, item, { kind: 'drone', line: 'gij' }),
  animalPetMlp: (owner, item) => grantPet(owner, item, { kind: 'pony', line: 'mlp' }),
  // Night Vale Community Adoption Center: each pick is a new pet or a new Animal Perk on one pet.
  adoptionCenter: (owner, item) => grantPet(owner, item, { kind: 'animal', line: 'wtnv', maxPets: countSourced(owner, COMP.adoptionCenter) }),
  // Faithful Companion: grants the Adoption Center Perk, and the pet gets 5 Animal Perks rather than 3.
  async faithfulCompanion(owner, item) {
    if (!hasSourced(owner, COMP.adoptionCenter)) {
      const { grantCopy } = await import("../resources/grants.mjs");
      await grantCopy(owner, COMP.adoptionCenter, { grantedBy: item });
    }

    const center = itemsOf(owner).find(i => sourceOf(i) == COMP.adoptionCenter);
    return center ? grantPet(owner, center, { kind: 'animal', line: 'wtnv', maxPets: 1 }) : null;
  },
  // Morphin Pet: a Standard animal pet that can Morph alongside its owner for 1 Personal Power.
  // Robotic Animal Pet: carries both the Animal and Robot traits.
  morphinPet: (owner, item) => grantPet(owner, item, { kind: 'animal', line: 'gij' }),
  roboticAnimalPet: (owner, item) => grantPet(owner, item, { kind: 'robotAnimal', line: 'gij' }),

  // (Assistant is a Use rule on the Animal Perk: the lendAssist step. Night Vale's Favorite Command picks its Skill with a
  // Use rule.)

  // Direct Control (Quartermaster's Guide p.21): the Standard drone becomes Limited, with one free
  // Standard upgrade. Master Control Program: Restricted, with up to two Standard or Limited upgrades.
  directControl: (owner, item) => raiseDrone(owner, item, 'limited', [['standard']]),
  masterControlProgram: (owner, item) => raiseDrone(owner, item, 'restricted', [['standard', 'limited'], ['standard', 'limited']]),
  // (Telemetry Data, Terminal Guidance and Buzz The Tower are Use rules on their Perks.)

  // R.I.C. (Across the Stars p.85): a robot S.P.D. companion with up to 2 integrated kits that can
  // turn into a canine cannon. A Limited drone with the Canine
  // Cannon.
  async ric(owner, item) {
    if (petsFrom(owner, item).length) {
      ui.notifications.info(T('E20.PetAlreadyHave', { name: item.name }));
      return null;
    }

    const companion = await createCompanion(owner, {
      name: 'R.I.C.', system: { ...expand(droneStats({ availability: 'limited', size: 'common', move: 'land' })), type: 'drone', availability: 'limited' },
      items: [await copyOf(ITEM.robot), await copyOf(ITEM.canineCannon)].filter(Boolean),
    }, item);
    if (companion) {
      const { pickAndGrant } = await import("../resources/grants.mjs");
      for (let i = 0; i < 2; i++) {
        await pickAndGrant(companion, item, item.name, { type: 'gear', availabilities: ['standard', 'limited'], matches: e => e.system?.gearType == 'kits' }, { integrated: true });
      }
    }

    return companion ? T('E20.CompanionGained', { name: owner.name, companion: companion.name }) : null;
  },

  // Mini-Con Ally: the first Use builds the Mini-Con; after that it docks and deploys them.
  async miniConAlly(owner, item, pay) {
    if (!companionsOf(owner, { type: 'miniCon' }).length) {
      return grantMiniCon(owner, item);
    }

    return dockOrDeploy(owner, item, pay);
  },
  // Multi-Purpose (TF CRB p.74): either a second purpose for the Mini-Con, or a second Mini-Con.
  async multiPurpose(owner, item) {
    if (item.flags?.essence20?.granted) {
      ui.notifications.info(T('E20.GrantAlready'));
      return null;
    }

    const { chooseButtons, chooseSelect } = await import("../resources/grants.mjs");
    const choice = await chooseButtons(item.name, T('E20.MultiPurposePrompt'), [['purpose', T('E20.MultiPurposePurpose')], ['ally', T('E20.MultiPurposeAlly')]]);
    let result = null;
    if (choice == 'ally') {
      result = await grantMiniCon(owner, item);
    } else if (choice == 'purpose') {
      const miniCon = companionsOf(owner, { type: 'miniCon' })[0];
      const current = miniCon?.flags?.essence20?.miniCon?.purposes ?? [];
      const skill = miniCon ? await chooseSelect(item.name, T('E20.MiniConPurpose'),
        Object.entries(CONFIG.E20.skills).filter(([key]) => !current.includes(key)).map(([value, label]) => ({ value, label: T(label) }))) : null;
      if (skill) {
        await miniCon.setFlag('essence20', 'miniCon', { ...miniCon.flags.essence20.miniCon, purposes: [...current, skill] });
        result = T('E20.MultiPurposeAdded', { name: miniCon.name, skill: T(CONFIG.E20.skills[skill]) });
      }
    }

    if (result) {
      await item.setFlag('essence20', 'granted', true);
    }

    return result;
  },
  // (Enhanced Sensors is a Use rule on the Mini-Con Perk.)
  // Additional Mini-Con (Decepticon Directive p.64): one more basic Mini-Con. Mini-Con Hub: that Perk
  // gives two instead of one.
  additionalMiniCon: (owner, item) => grantOnce(owner, item, () => grantMiniCon(owner, item, { count: hasSourced(owner, COMP.miniConHub) ? 2 : 1 })),
  // Mini-Con Affinity: two Mini-Con allies. Hub and Master: one more of the same Alt Mode.
  miniConAffinity: (owner, item) => grantOnce(owner, item, () => grantMiniCon(owner, item, { count: 2 })),
  miniConHub: (owner, item, pay) => grantOnce(owner, item, () => grantMiniCon(owner, item), () => dockOrDeployTwo(owner, item, pay)),
  miniConMaster: (owner, item) => grantOnce(owner, item, () => grantMiniCon(owner, item)),
  humanCompanion: (owner, item) => grantPerson(owner, item, 2, 'human'),
  alienCompanion: (owner, item) => grantPerson(owner, item, 1, 'human'),
};

async function grantOnce(owner, item, first, after = null) {
  if (!item.flags?.essence20?.granted) {
    const result = await first();
    if (result) {
      await item.setFlag('essence20', 'granted', true);
    }

    return result;
  }

  return after ? after() : (ui.notifications.info(T('E20.GrantAlready')), null);
}

/** Mini-Con Hub: one Free action docks or deploys up to two Mini-Cons. */
async function dockOrDeployTwo(owner, item, pay) {
  if (!(await pay('free'))) {
    return null;
  }

  const lines = [];
  const free = async () => true;
  for (let i = 0; i < 2; i++) {
    const line = await dockOrDeploy(owner, item, free);
    if (!line) {
      break;
    }

    lines.push(line);
  }

  return lines.join('<br>') || null;
}

async function raiseDrone(owner, item, availability, upgrades) {
  const drone = companionsOf(owner, { type: 'drone' })[0];
  if (!drone) {
    ui.notifications.warn(T('E20.DroneNone', { name: owner.name }));
    return null;
  }

  const build = drone.flags?.essence20?.petBuild ?? {};
  await drone.update({ ...droneStats({ ...build, availability }), 'system.availability': availability, 'flags.essence20.petBuild': { ...build, availability } });
  const { pickAndGrant } = await import("../resources/grants.mjs");
  for (const availabilities of upgrades) {
    await pickAndGrant(drone, item, item.name, { type: 'upgrade', availabilities, matches: e => e.system?.type == 'drone' });
  }

  return T('E20.PetImproved', { name: owner.name, pet: drone.name, availability: T(`E20.Availability${availability.capitalize()}`) });
}

/**
 * The Use button for everything in companion-uses.mjs.
 * @param {Item} item
 * @param {Object} economy   mechanics/actions/action-economy.mjs.
 * @returns {Promise<String|null>}
 */
export async function runCompanionUse(item, economy) {
  const kind = companionKindOf(item);
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

  const result = await HANDLERS[kind]?.(actor, item, pay);
  if (result && isOnceCompanionUse(kind)) {
    await item.setFlag('essence20', 'granted', true);
  }

  return result ?? null;
}
