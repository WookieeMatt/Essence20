import { COMP, companionKindOf, isOnceCompanionUse } from "./companion-uses.mjs";
import { companionsOf, countSourced, hasSourced, linkCompanion, ownerOf, worldActors } from "./companion-link.mjs";
import { getSceneEpoch, getUses, markUsed } from "./scene-clock.mjs";

/**
 * Companions: pets (GI JOE CRB p.163-168, MLP CRB p.154-157, WTNV Citizens' Guide p.73-75), drones
 * (GI JOE CRB p.167-169), Mini-Cons (TF CRB p.74-76, Decepticon Directive p.49-50), and human and
 * alien companions (TF CRB p.109, Enigma of Combination p.39).
 *
 * - A companion is a `companion` actor tied to its owner by helpers/companion-link.mjs. The Perk that
 *   grants one has a Use button that builds it the first time and improves it after that ("You can
 *   choose this Perk up to three times, improving or replacing your pet with a pet of the next
 *   Availability each time").
 * - Actors and tokens are made through helpers/gm-relay.mjs#createViaGm, since a player may not make
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
  acuteSenseTf: uuid('tf_crb', 'rl8hs6ezb6VSDahM'),
  protectedTarget: uuid('gi_joe_crb', 'llnU5dWqYlfgLA5V'),
  bodyShield: uuid('gi_joe_crb', 'CBfLvmIWdbLuucts'),
  defendersOath: uuid('gi_joe_crb', 'LuQoEjHVOM8Yoc0Y'),
  nightVisionGoggles: uuid('gi_joe_crb', 'XvqqYOHHpjRzb8T4'),
  laserDesignator: uuid('gi_joe_crb', 'AcNaNxZnyOfXv0f6'),
  canineCannon: uuid('across_the_stars', 'x51EQgTwqoC7f5ua'),
};

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
}

function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return Array.isArray(items.contents) ? items.contents : (typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

const level = actor => Number(actor?.system?.level) || 1;

async function skillRanks(actor, skill) {
  const { getSkillRanks } = await import("./combat.mjs");
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
 * An animal pet by the G.I. JOE / Night Vale tables: "A Standard Attack animal pet starts with 2
 * Strength and Speed, 1 Smarts and Social, 3 Health ... Standard Utility ... 1 Strength and Speed,
 * and 2 Smarts and Social, 2 Health ... a Limited animal pet gains 2 additional Essence and 1
 * additional Health. A Restricted animal pet gains 4 additional Essence and 3 additional Health."
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
 * A drone: "Standard drone pet starts with 2 Health and 1s in all Essence abilities. Limited ... 3
 * Health, 1s in all Essence abilities, and 2 Essence increases. Restricted ... 4 Health, 2s in all
 * Essence abilities, and 2 Essence increases." The increases go to Speed and Smarts.
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
 * An MLP pet: "Size of Small ... Land Movement of 30ft ... Strength 1, Speed 3, Smarts 2, Social 2 ...
 * +3 to Evasion". The book gives no Health; 3 is the G.I. JOE Attack pet's.
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
  const { createViaGm } = await import("./gm-relay.mjs");
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
  const availability = kind == 'pony' ? 'standard' : tierFor(owner, sourceOf(grantor));
  const existing = petsFrom(owner, grantor);
  const pet = existing[0];
  const canAddAnother = kind == 'pony' || maxPets > existing.length;
  // Improve, or (MLP / Night Vale) gain another.
  if (pet) {
    const improve = kind != 'pony' && TIERS.indexOf(pet.system?.availability) < TIERS.indexOf(availability);
    const { chooseButtons } = await import("./grants.mjs");
    const choice = improve && !canAddAnother ? 'improve' : (!improve && !canAddAnother ? null : await chooseButtons(grantor.name, T('E20.PetImproveOrNew'), [
      ...(improve ? [['improve', T('E20.PetImprove', { name: pet.name, availability: T(`E20.Availability${availability.capitalize()}`) })]] : []),
      ...(canAddAnother ? [['new', T('E20.PetNew')]] : []),
    ]));
    if (!choice) {
      ui.notifications.info(T('E20.PetAlreadyHave', { name: pet.name }));
      return null;
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

  // "A Standard animal pet gains Acute Senses as a General Perk once ... Limited ... twice ...
  // Restricted ... three times."
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

  const { pickAndGrant } = await import("./grants.mjs");
  // Drone Attack/Utility: "1 weapon of an availability equal to the drone's availability ...
  // integrated" / "1 integrated kit". Shield Drone: "1 Standard [Limited, Restricted] shield".
  if (kind == 'drone') {
    if (fn == 'attack') {
      await pickAndGrant(companion, grantor, grantor.name, { type: 'weapon', availabilities: [availability] }, { integrated: true });
    } else if (fn == 'utility') {
      await pickAndGrant(companion, grantor, grantor.name, { type: 'gear', availabilities: [availability], matches: e => e.system?.gearType == 'kits' }, { integrated: true });
    } else if (fn == 'shield') {
      await pickAndGrant(companion, grantor, grantor.name, { type: 'shield', availabilities: [availability] });
    }
  }

  // Venomous: "choose a Standard [or Limited] poison. On a successful hit ... it deals the effect of
  // the chosen poison." The poison is kept on the pet and coats its natural attack.
  if (build.fn == 'venomous') {
    const poison = await pickAndGrant(companion, grantor, grantor.name, {
      type: 'weapon', availabilities: availability == 'restricted' ? ['standard', 'limited'] : ['standard'], matches: e => !!e.system?.isPoison,
    });
    const bite = itemsOf(companion).find(i => i.type == 'weapon' && i.flags?.essence20?.natural);
    const effect = itemsOf(companion).find(i => i.type == 'weaponEffect' && i.flags?.essence20?.parentId == poison?.id);
    if (poison && bite) {
      // A coating that never wipes (helpers/poison-coating.mjs#wipeCoating skips `permanent`).
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
 * "For every two Skill Points you invest or have invested in your Skill that matches its purpose ...
 * your Mini-Con gains either two Essence Point Increases, or one Essence Point Increase and one
 * Mini-Con Perk. Either way, one Essence Point Increase must be used to increase the Essence Score
 * tied to your Mini-Con's purpose". The required increase is made here; the rest are the player's.
 */
export async function grantMiniCon(owner, grantor, { count = 1 } = {}) {
  const skills = Object.entries(CONFIG.E20.skills).filter(([key]) => key != 'initiative').map(([key, label]) => [key, T(label)]);
  const altModes = [['firearm', T('E20.MiniConAltFirearm')], ['cassette', T('E20.MiniConAltCassette')], ['vehicle', T('E20.MiniConAltVehicle')], ['conduit', T('E20.MiniConAltConduit')]];
  // Mini-Con Affinity: "These Mini-Con allies and any others you gain must have the same Alt Mode."
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
 * Human Companion (TF CRB p.109): "Choose two Essences for your human companion to Specialize in.
 * Those two Essences are equal to your current level divided by two (round up) +2." Alien Companion
 * (Enigma of Combination p.39): "equal to half your current level (round up) +1".
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
 * Deploy: "You or your Mini-Con can use a Free action to deploy your Mini-Con from their dock. They
 * land standing in a space adjacent to you". Linked: "reduce your Health by any amount, as long as
 * it's at least 1 and it doesn't reduce you to 0 Health. Your Mini-Con gains that amount of Health
 * ... If you do not have at least 2 Health, your Mini-Con cannot deploy." Reinforced Bond: "you can
 * also assign them +1 or +2 to all their Defenses. Reduce your bonus to Defenses an equal amount."
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
 * Dock: "Either you or your Mini-Con can use a Free action to dock as long as you're adjacent to one
 * another, even if one of you is Defeated. Your Health increases an amount equal to your Mini-Con's
 * current Health. This does count as being Repaired".
 */
export async function dockMiniCon(owner, miniCon) {
  const back = Number(miniCon.system?.health?.value) || 0;
  const health = owner.system?.health ?? {};
  await owner.update({ 'system.health.value': Math.min(health.max ?? Infinity, (health.value ?? 0) + back) });
  await miniCon.update({ 'flags.essence20.miniCon.docked': true, 'flags.essence20.miniCon.defenseShift': 0, 'system.health.value': 0 });
  const { createViaGm } = await import("./gm-relay.mjs");
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
  const { createViaGm } = await import("./gm-relay.mjs");
  return createViaGm('token', { actorUuid: companion.uuid, sceneId: canvas.scene.id, x: token.document.x + (token.document.width ?? 1) * size, y: token.document.y });
}

async function dockOrDeploy(owner, grantor, pay) {
  const miniCons = companionsOf(owner, { type: 'miniCon' });
  const { chooseSelect } = await import("./grants.mjs");
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

function favoriteSkill(pet) {
  return itemsOf(pet).find(item => [COMP.favoriteCommandGij, COMP.favoriteCommandMlp, COMP.favoriteCommandWtnv].includes(sourceOf(item)))?.flags?.essence20?.favoriteSkill ?? null;
}

/**
 * The DIF to command: G.I. JOE "0 for a Standard animal pet, 10 for a Limited animal pet, and 15 for
 * a Restricted animal pet" (the drone's the same by its availability); MLP and Night Vale "DIF 10".
 * Agreeable (G.I. JOE): "treated as one step more available for the purposes of the Animal Handling
 * DIF for commanding it".
 */
export function commandDif(pet) {
  const line = pet.flags?.essence20?.petBuild?.line;
  if (line == 'mlp' || line == 'wtnv') {
    return 10;
  }

  let tier = Math.max(0, TIERS.indexOf(pet.system?.availability ?? 'standard'));
  if (hasSourced(pet, COMP.agreeableGij)) {
    tier = Math.max(0, tier - 1);
  }

  return [0, 10, 15][tier];
}

/**
 * The Command a Pet action: "Commanding an animal pet requires a Handle Animal Skill Test as a
 * Standard action ... Commanding a drone pet requires a Technology Skill Test ... designate a Skill
 * you want it to use, and a target". Favorite Command: "Choose a Skill. You can Command your animal
 * pet to perform this Skill as a Move action instead of a Standard action" - that cost is set in
 * helpers/action-perks.mjs before this runs.
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
  const { rollTest } = await import("./grants.mjs");
  // Agreeable (MLP): "Any Animal Handling Skill Test (by anyone) gains ↑1."
  const shiftUp = hasSourced(pet, COMP.agreeableMlp) ? 1 : 0;
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
 * Artificial Intelligence (drone upgrade, GI JOE CRB p.169): "Any turn the drone is not issued a
 * Command, it issues itself a Command it has been issued previously as a Free action." Posted at the
 * drone's turn start.
 */
export async function onCompanionTurnStart(actor, combat) {
  if (actor?.type != 'companion') {
    return;
  }

  const command = actor.flags?.essence20?.[COMMAND_FLAG];
  if (hasSourced(actor, COMP.artificialIntelligence) && command && command.round != combat?.round) {
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: T('E20.DroneSelfCommand', { name: actor.name, command: command.label }) });
  }

  // Constrictor: "automatically deals 1 Blunt damage to a target it is grappling at the beginning of
  // its turn." The grappled target is the one it last commanded or attacked with a grapple.
  if (hasSourced(actor, COMP.constrictor)) {
    const grappled = actor.flags?.essence20?.grappling ? await fromUuid(actor.flags.essence20.grappling) : null;
    if (grappled?.statuses?.has?.('grappled')) {
      const { applyDamage } = await import("./combat.mjs");
      await applyDamage(grappled, 1, 'blunt');
      ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: T('E20.ConstrictorSqueeze', { name: actor.name, target: grappled.name }) });
    }
  }

  // Emergency Deployment and Docking: "when one of your Mini-Cons is Defeated but you're not, a tractor
  // beam ... moves your Defeated Mini-Con 30ft closer to you, until your Defeated Mini-Con is within
  // your Reach."
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
 * Emergency Deployment and Docking: "if you are Defeated with one or more docked Mini-Con, your
 * Mini-Cons deploy with 2 Temporary Health each." Called when an owner becomes Defeated.
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

/**
 * Perch (Cobra Codex p.100): "Your Small animal pet ... gain[s] an additional Move action on the first
 * turn of combat." Called on each combatant's first turn.
 */
export async function onFirstCombatTurn(actor) {
  const owner = ownerOf(actor);
  if (actor?.type == 'companion' && actor.system?.size == 'small' && owner && hasSourced(owner, COMP.perch)) {
    const economy = await import("./action-economy.mjs");
    await economy.grantActionsThisTurn?.(actor, { move: 1 }, T('E20.Perch'));
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
    const owner = ownerOf(actor);
    // Tough Together (GI JOE CRB, Beastmaster, 10th level): "you and your pet each gain 1 Health."
    if (owner && hasSourced(owner, COMP.toughTogether)) {
      out.health += 1;
    }

    // Reinforced Bond: the Defense bonus the owner handed over on deploy.
    const shift = Number(actor.flags?.essence20?.miniCon?.defenseShift) || 0;
    for (const defense of shift ? ['toughness', 'evasion', 'willpower', 'cleverness'] : []) {
      add(defense, shift, 'Reinforced Bond');
    }

    return out;
  }

  const miniCons = companionsOf(actor, { type: 'miniCon' });
  if (miniCons.length) {
    // Linked: "You gain 2 Health." Mini-Con Affinity: "Each Mini-Con ally you link with grants you only
    // 1 Health (instead of 2)."
    out.health += miniCons.length * (hasSourced(actor, COMP.miniConAffinity) ? 1 : 2);
    // Reinforced Bond: "Reduce your bonus to Defenses an equal amount."
    const handed = miniCons.filter(m => !isDocked(m)).reduce((sum, m) => Math.max(sum, Number(m.flags?.essence20?.miniCon?.defenseShift) || 0), 0);
    for (const defense of handed ? ['toughness', 'evasion', 'willpower', 'cleverness'] : []) {
      add(defense, -handed, 'Reinforced Bond');
    }

    // Mini-Con Master: "For every two Mini-Cons of this type you have docked, you gain a +1 bonus".
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
 * Roll sources from companions and owners - Pack Attack, Automatic Harmonics, Ambush Deployment,
 * a docked Mini-Con's Helper - for helpers/target-riders.mjs#rollRiderSources.
 * @param {Actor} actor   The roller.
 * @param {Actor|null} target
 * @param {Object} ctx   {rolledSkill, isAttack}
 * @returns {Array<Object>}   Sources {id, label, shiftUp, edge}.
 */
export function companionRollSources(actor, target, { rolledSkill, isAttack } = {}) {
  const sources = [];
  const add = (id, label, mods) => sources.push({ id, label, shiftUp: mods.shiftUp ?? 0, shiftDown: 0, edge: !!mods.edge, snag: false });
  const owner = actor?.type == 'companion' ? ownerOf(actor) : actor;
  const partners = actor?.type == 'companion' ? [owner, ...companionsOf(owner)].filter(a => a && a.uuid != actor.uuid) : companionsOf(actor);

  // Pack Attack (GI JOE CRB, Beastmaster, 20th level): "when you and your pet attack the same target,
  // you both gain an Edge on the attack Skill Test." The one attacking second sees the first's attack.
  if (isAttack && target && owner && hasSourced(owner, COMP.packAttack) && partners.some(p => rolledAgainst(p, target, { attack: true }))) {
    add('packAttack', T('E20.PackAttack'), { edge: true });
  }

  // Automatic Harmonics (Quartermaster's Guide p.21): "Once per combat ... when your drone uses a Skill
  // Test against a target that you also rolled a Skill Test against during this round, the drone gains
  // Edge."
  if (actor?.type == 'companion' && actor.system?.type == 'drone' && target && owner && hasSourced(owner, COMP.automaticHarmonics)
    && rolledAgainst(owner, target) && getUses(actor, 'automaticHarmonics', 'encounter') < 1) {
    add('automaticHarmonics', T('E20.AutomaticHarmonics'), { edge: true, consume: 'automaticHarmonics' });
    sources.at(-1).consume = 'automaticHarmonics';
  }

  // Ambush Deployment (TF CRB p.74): "if you deploy a Mini-Con in Combat, you and your Mini-Con ... gain
  // an Edge on attacks targeting enemies adjacent to you." For the round it was deployed.
  if (isAttack && target && owner && hasSourced(owner, COMP.ambushDeployment) && isAdjacent(owner, target)) {
    const deployed = companionsOf(owner, { type: 'miniCon' }).some(m => {
      const at = m.flags?.essence20?.miniCon?.deployedRound;
      return !isDocked(m) && at && at.combatId == game.combat?.id && at.round == game.combat?.round;
    });
    if (deployed && (actor.uuid == owner.uuid || actor.system?.type == 'miniCon')) {
      add('ambushDeployment', T('E20.AmbushDeployment'), { edge: true });
    }
  }

  // Helper (TF CRB p.75): "When docked with your Mini-Con, you get ↑1 on Skill Tests related to their
  // purpose."
  if (actor?.type != 'companion' && rolledSkill && dockedMiniCons(actor).some(m => (m.flags?.essence20?.miniCon?.purposes ?? [m.flags?.essence20?.miniCon?.purpose]).includes(rolledSkill))) {
    add('miniConHelper', T('E20.MiniConHelper'), { shiftUp: 1 });
  }

  // Loyal Minions: the order just given.
  if (actor?.type == 'companion' && actor.system?.type == 'miniCon') {
    const order = owner?.flags?.essence20?.loyalMinions;
    if (order && order.combatId == game.combat?.id && order.round == game.combat?.round) {
      add('loyalMinions', T('E20.LoyalMinions'), { shiftUp: 1 });
    }
  }

  return sources;
}

/**
 * Defense bonuses that depend on where companions stand - Shield Companion - for
 * helpers/target-riders.mjs#riderDefenseAdjust.
 * @param {Actor} defender
 * @param {String} defense
 * @returns {Number}
 */
export function companionDefenseBonus(defender, defense) {
  if (!['toughness', 'evasion'].includes(defense) || defender?.type == 'companion') {
    return 0;
  }

  // Shield Companion (Mini-Con Perk, TF CRB p.112): "This Mini-Con provides you with a +1 bonus to both
  // Toughness and Evasion when you are adjacent to one another."
  const shield = companionsOf(defender, { type: 'miniCon' }).some(m => !isDocked(m) && hasSourced(m, COMP.shieldCompanion) && isAdjacent(defender, m));
  return shield ? 1 : 0;
}

function isAdjacent(a, b) {
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

function rolledAgainst(actor, target, { attack = false } = {}) {
  const record = actor?.flags?.essence20?.[ROLLED_FLAG];
  if (!record || record.key != roundKey()) {
    return false;
  }

  return record.list.some(entry => entry.uuid == target?.uuid && (!attack || entry.attack));
}

/** Mark a once-per-combat source used, when the roll it fed goes ahead. */
export async function consumeCompanionSource(actor, key) {
  if (key == 'automaticHarmonics') {
    await markUsed(actor, 'automaticHarmonics', { window: 'encounter' });
  }
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

const HANDLERS = {
  animalPetGij: (owner, item) => grantPet(owner, item, { kind: 'animal', line: 'gij' }),
  robotPet: (owner, item) => grantPet(owner, item, { kind: 'drone', line: 'gij' }),
  animalPetMlp: (owner, item) => grantPet(owner, item, { kind: 'pony', line: 'mlp' }),
  // Night Vale Community Adoption Center: "each time either gaining a new pet or improving a single pet
  // with a new Animal Perk."
  adoptionCenter: (owner, item) => grantPet(owner, item, { kind: 'animal', line: 'wtnv', maxPets: countSourced(owner, COMP.adoptionCenter) }),
  // Faithful Companion: "You gain the Night Vale Community Adoption Center General Perk and have a
  // total of 5 Animal Perks to customize your pet, instead of 3."
  async faithfulCompanion(owner, item) {
    if (!hasSourced(owner, COMP.adoptionCenter)) {
      const { grantCopy } = await import("./grants.mjs");
      await grantCopy(owner, COMP.adoptionCenter, { grantedBy: item });
    }

    const center = itemsOf(owner).find(i => sourceOf(i) == COMP.adoptionCenter);
    return center ? grantPet(owner, center, { kind: 'animal', line: 'wtnv', maxPets: 1 }) : null;
  },
  // Morphin Pet: "a Standard animal as a pet ... When you use It's Morphin Time!, you can spend 1
  // Personal Power to grant your pet the same benefits." Robotic Animal Pet: "both the Animal and Robot
  // traits".
  morphinPet: (owner, item) => grantPet(owner, item, { kind: 'animal', line: 'gij' }),
  roboticAnimalPet: (owner, item) => grantPet(owner, item, { kind: 'robotAnimal', line: 'gij' }),

  // Assistant (Animal Perk): "As a Free action, you can Command your animal pet to use their Favorite
  // Command to Lend Assistance." The pet lends it.
  assistantGij: (pet, item, pay) => petAssist(pet, pay),
  assistantMlp: (pet, item, pay) => petAssist(pet, pay),

  // Altered Pet (Cobra Codex p.103): "Your pet gains a Standard Alteration".
  async alteredPet(pet, item) {
    const { pickAndGrant } = await import("./grants.mjs");
    const got = await pickAndGrant(pet, item, item.name, { type: 'alteration', availabilities: ['standard'] });
    return got ? T('E20.GrantGained', { name: pet.name, item: item.name, what: got.name }) : null;
  },

  // Direct Control (Quartermaster's Guide p.21): "replace your Standard drone with a Limited drone. You
  // may choose one Standard upgrade as a free upgrade". Master Control Program: "a Restricted drone ...
  // up to two Standard or Limited upgrades".
  directControl: (owner, item) => raiseDrone(owner, item, 'limited', [['standard']]),
  masterControlProgram: (owner, item) => raiseDrone(owner, item, 'restricted', [['standard', 'limited'], ['standard', 'limited']]),
  // Telemetry Data: "At 3rd level, your drone comes equipped with Night Vision Goggles ... At 15th
  // level, it also comes equipped with a Laser Designator."
  async telemetryData(owner, item) {
    const drone = companionsOf(owner, { type: 'drone' })[0];
    if (!drone) {
      ui.notifications.warn(T('E20.DroneNone', { name: owner.name }));
      return null;
    }

    const { grantCopy } = await import("./grants.mjs");
    const got = [await grantCopy(drone, ITEM.nightVisionGoggles, { grantedBy: item, integrated: true })];
    if (level(owner) >= 15) {
      got.push(await grantCopy(drone, ITEM.laserDesignator, { grantedBy: item, integrated: true }));
    }

    return T('E20.GrantGained', { name: drone.name, item: item.name, what: got.filter(Boolean).map(g => g.name).join(', ') });
  },
  // Terminal Guidance: "command your drone to charge into an enemy target and self-destruct. This
  // destroys the drone and deals half of its current Health (round up) in damage".
  async terminalGuidance(owner, item, pay) {
    const drone = companionsOf(owner, { type: 'drone' })[0];
    const target = game.user?.targets?.first?.()?.actor;
    if (!drone || !target) {
      ui.notifications.warn(T(drone ? 'E20.PickTarget' : 'E20.DroneNone', { name: owner.name }));
      return null;
    }

    if (!(await pay('standard'))) {
      return null;
    }

    const damage = Math.ceil((Number(drone.system?.health?.value) || 0) / 2);
    const { applyDamage } = await import("./combat.mjs");
    await applyDamage(target, damage, 'blunt');
    await drone.update({ 'system.health.value': 0 });
    await drone.toggleStatusEffect?.('defeated', { active: true });
    return T('E20.TerminalGuidance', { name: drone.name, target: target.name, damage });
  },
  // Buzz The Tower: "once per scene, when your drone moves past a space adjacent to an enemy ... it can
  // make an Acrobatics, Deception, or Driving Skill Test against the target's Willpower or Cleverness.
  // On a success, the target is flustered and suffers Snag on Skill Tests until the end of their next
  // turn."
  async buzzTheTower(owner, item) {
    const drone = companionsOf(owner, { type: 'drone' })[0];
    const target = game.user?.targets?.first?.()?.actor;
    if (!drone || !target) {
      ui.notifications.warn(T(drone ? 'E20.PickTarget' : 'E20.DroneNone', { name: owner.name }));
      return null;
    }

    if (getUses(drone, 'buzzTheTower', 'scene') >= 1) {
      ui.notifications.warn(T('E20.OncePerScene'));
      return null;
    }

    const answer = await buildForm(item.name, [
      { name: 'skill', label: T('E20.PetCommandSkill'), options: ['acrobatics', 'deception', 'driving'].map(s => [s, T(CONFIG.E20.skills[s])]) },
      { name: 'defense', label: T('E20.Defense'), options: ['willpower', 'cleverness'].map(d => [d, T(CONFIG.E20.defenses[d])]) },
    ]);
    if (!answer) {
      return null;
    }

    await markUsed(drone, 'buzzTheTower', { window: 'scene' });
    const { rollTest } = await import("./grants.mjs");
    const dif = Number(target.system?.defenses?.[answer.defense]?.total) || 10;
    const { success } = await rollTest(drone, answer.skill, dif);
    if (!success) {
      return T('E20.BuzzFailed', { name: drone.name, target: target.name });
    }

    const { addMark, untilEndOfNextTurn } = await import("./target-riders.mjs");
    await addMark(target, { kind: 'flustered', by: drone.uuid, label: item.name, ...untilEndOfNextTurn(target) });
    return T('E20.BuzzHit', { name: drone.name, target: target.name });
  },

  // R.I.C. (Across the Stars p.85): "a robotic S.P.D. companion ... up to 2 kits integrated in its
  // chassis ... the ability to transform into canine cannon mode". A Limited drone with the Canine
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
      const { pickAndGrant } = await import("./grants.mjs");
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
  // Multi-Purpose (TF CRB p.74): "Additional Purpose: Your Mini-Con gains an additional purpose. ...
  // Additional Ally: You gain a second Mini-Con."
  async multiPurpose(owner, item) {
    if (item.flags?.essence20?.granted) {
      ui.notifications.info(T('E20.GrantAlready'));
      return null;
    }

    const { chooseButtons, chooseSelect } = await import("./grants.mjs");
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
  // Enhanced Sensors (Mini-Con Perk): "This Mini-Con gains the Acute Senses General Perk."
  async enhancedSensors(holder, item) {
    const miniCon = holder.type == 'companion' ? holder : companionsOf(holder, { type: 'miniCon' })[0];
    if (!miniCon) {
      return null;
    }

    const { grantCopy } = await import("./grants.mjs");
    const got = await grantCopy(miniCon, ITEM.acuteSenseTf, { grantedBy: item });
    return got ? T('E20.GrantGained', { name: miniCon.name, item: item.name, what: got.name }) : null;
  },
  // Additional Mini-Con (Decepticon Directive p.64): "another basic Mini-Con". Mini-Con Hub: "whenever
  // you choose the Additional Mini-Con General Perk, you gain two Mini-Cons instead of one."
  additionalMiniCon: (owner, item) => grantOnce(owner, item, () => grantMiniCon(owner, item, { count: hasSourced(owner, COMP.miniConHub) ? 2 : 1 })),
  // Mini-Con Affinity: "You gain two Mini-Con allies". Hub and Master: "another Mini-Con ally of the
  // same Alt Mode".
  miniConAffinity: (owner, item) => grantOnce(owner, item, () => grantMiniCon(owner, item, { count: 2 })),
  miniConHub: (owner, item, pay) => grantOnce(owner, item, () => grantMiniCon(owner, item), () => dockOrDeployTwo(owner, item, pay)),
  miniConMaster: (owner, item) => grantOnce(owner, item, () => grantMiniCon(owner, item)),
  // Loyal Minions (20th): "spend a Free action to attempt a DIF 10 Intimidation (Command) or Persuasion
  // (Leadership) Skill Test to tell your currently deployed Mini-Cons what to do. On a success, they
  // gain ↑1 to all Skill Tests related to following those orders until the beginning of your next turn."
  async loyalMinions(owner, item, pay) {
    const { chooseButtons, rollTest } = await import("./grants.mjs");
    const skill = await chooseButtons(item.name, T('E20.LoyalMinionsPrompt'), [['intimidation', T('E20.SkillIntimidation')], ['persuasion', T('E20.SkillPersuasion')]]);
    if (!skill || !(await pay('free'))) {
      return null;
    }

    const { success } = await rollTest(owner, skill, 10);
    if (!success) {
      return T('E20.GrantFailed', { name: owner.name, item: item.name });
    }

    await owner.setFlag('essence20', 'loyalMinions', { combatId: game.combat?.id ?? null, round: game.combat?.round ?? null });
    return T('E20.LoyalMinionsGiven', { name: owner.name });
  },
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

/** Mini-Con Hub: "When you spend a Free action, you can deploy or dock up to two Mini-Cons at the same time". */
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
  const { pickAndGrant } = await import("./grants.mjs");
  for (const availabilities of upgrades) {
    await pickAndGrant(drone, item, item.name, { type: 'upgrade', availabilities, matches: e => e.system?.type == 'drone' });
  }

  return T('E20.PetImproved', { name: owner.name, pet: drone.name, availability: T(`E20.Availability${availability.capitalize()}`) });
}

async function petAssist(pet, pay) {
  const owner = ownerOf(pet) ?? pet;
  if (!favoriteSkill(pet) && !hasSourced(pet, COMP.favoriteCommandGij) && !hasSourced(pet, COMP.favoriteCommandMlp) && !hasSourced(pet, COMP.favoriteCommandWtnv)) {
    ui.notifications.warn(T('E20.PetNeedsFavorite', { name: pet.name }));
    return null;
  }

  if (!(await pay('free'))) {
    return null;
  }

  const { lendAssistanceSkill } = await import("./lend-assistance.mjs");
  const done = await lendAssistanceSkill(pet);
  return done ? T('E20.PetAssisted', { name: owner.name, pet: pet.name }) : null;
}

/**
 * The Use button for everything in companion-uses.mjs.
 * @param {Item} item
 * @param {Object} economy   helpers/action-economy.mjs.
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
