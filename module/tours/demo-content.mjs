/**
 * Demo actors for the guided tours.
 *
 * Most of what the sheet tours need to show only exists on a *populated* character: a Role at a
 * level, a weapon carrying a weapon effect and an upgrade, armor, a morph-capable actor. Rather
 * than ship those as a compendium pack, they are built at runtime from the compact definitions
 * below and the data models fill in the rest.
 *
 * Two concrete reasons for that choice, both found while building the first one:
 * - An exported demo actor is ~37KB of mostly schema defaults per actor, none of it meaningful to
 *   read or review.
 * - An attached item's entry in its parent's `system.items` carries a
 *   `uuid` of the form `Actor.<actorId>.Item.<itemId>`. Imported from a pack the actor gets a new
 *   id, so every one of those uuids goes stale and the delete-sync in attachment-handler stops
 *   matching. Built at runtime they are correct by construction.
 *
 * Everything here is original demo copy. It deliberately does not reproduce rulebook text, and the
 * numbers are chosen to make a legible sheet rather than a legal character.
 *
 * @see docs/TOURS_PLAN.md
 */

/** Folder that demo actors are created in, so they are obvious and easy to sweep. @type {string} */
const DEMO_FOLDER = "Essence20 Tours";

/** Flag marking a document as tour-created and therefore safe to delete. @type {string} */
const DEMO_FLAG = "tourDemo";

/**
 * @typedef DemoAttachment           An item hanging off a parent item: a weapon effect or upgrade
 *                                   under a weapon, or a perk under the Role, Origin or Influence
 *                                   that granted it.
 * @property {string} parent         `name` of the item in the same definition to attach to.
 * @property {string} type           Item type: `weaponEffect`, `upgrade` or `perk`.
 * @property {string} name
 * @property {object} [system]
 * @property {string} [img]
 * @property {number} [level]        Level the parent grants this at. Renders as the level badge
 *                                   beside the item's name; the sheet reads it off the parent's
 *                                   snapshot, not off the child.
 */

/**
 * @typedef DemoActor
 * @property {string} name
 * @property {string} type              Actor type.
 * @property {string} [img]
 * @property {object} system
 * @property {object[]} items           Embedded items, created in order.
 * @property {DemoAttachment[]} [attach]
 * @property {object[]} [effects]       Embedded ActiveEffects.
 * @property {string[]} [participants]  Keys of other demo actors to link into `system.actors` —
 *                                      a vehicle's crew, or the Zords a Megaform is formed from.
 */

/**
 * The demo actors, keyed by the logical name a tour step refers to them by.
 *
 * Keep each definition to the fields that actually show up in a tour. Anything omitted gets the
 * data model's default, which is both shorter to read and automatically correct when a schema
 * changes underneath us.
 * @type {Record<string, DemoActor>}
 */
export const DEMO_ACTORS = {
  character: {
    name: "Demo Ranger",
    type: "playerCharacter",
    system: {
      level: 5,
      color: "#c62828",
      canMorph: true,
      health: { value: 20 },
      stun: { value: 0 },
      powers: { personal: { value: 8, max: 10 } },
      essences: {
        strength: { value: 3, max: 3 },
        speed: { value: 4, max: 4 },
        smarts: { value: 2, max: 2 },
        social: { value: 3, max: 3 },
      },
      initiative: { skill: "initiative" },
      // Armor training, so the Gear tab's Training block has something in it. It renders a
      // boolean list per armor type, so an untrained character shows an empty table — which is
      // what a reviewer reasonably read as the block being broken rather than simply unset.
      // A Power Rangers Role hides the Weapons column, so only armor matters for this one.
      trained: { armors: { light: true, medium: true } },
      // Matches what dropping "Field Trained" would have written (its baseGroundMovement is 30).
      // Origin movement is applied by the drop handler, which building the actor directly skips -
      // leaving movementNotSet true and the sidebar showing "Set PC movement by adding an Origin"
      // on a character that plainly has one.
      movement: { ground: { base: 30 } },
      // A spread of shifts so the Skills tab has something to read and the roll tour has a trained
      // skill to roll, rather than a wall of identical defaults.
      //
      // These add up to exactly each essence's rank budget, which is the essence's own value: a
      // rank costs one step up the die ladder (d2=1, d4=2, d6=3, d8=4, d10=5, d12=6). The Skill
      // Picker displays "allocated / available" per essence, so an over-budget demo character
      // would sit there reading 12/4 through the whole tour that is meant to explain the feature.
      skills: {
        athletics: { shift: "d4" }, might: { shift: "d2" },        // Strength: 2 + 1 = 3
        targeting: { shift: "d4" }, initiative: { shift: "d4" },   // Speed:    2 + 2 = 4
        alertness: { shift: "d4" },                                // Smarts:   2     = 2
        persuasion: { shift: "d4" }, deception: { shift: "d2" },   // Social:   2 + 1 = 3
      },
    },
    items: [
      {
        name: "Signal Corps", type: "role", img: "systems/essence20/assets/icons/items/role.svg",
        system: {
          version: "powerRangers",
          description: "<p>A demonstration Role used by the guided tours. It shows how a Role fills in the sheet header and drives level-based advancement; it is not meant to be played.</p>",
          // Levels are the strings "level1".."level20", not bare numbers. A wrong value here
          // doesn't throw — the data model rejects the whole document and Foundry logs a
          // validation error, so the Role silently fails to be created at all.
          essenceLevels: { strength: ["level2"], speed: ["level1", "level4"], smarts: ["level3"], social: ["level5"] },
          perkLevels: ["level1", "level3", "level5"],
        },
      },
      {
        name: "Field Trained", type: "origin", img: "systems/essence20/assets/icons/items/origin.svg",
        system: {
          description: "<p>A demonstration Origin. Origins set starting Health, base movement, and a couple of starting skills.</p>",
          startingHealth: 20,
          baseGroundMovement: 30,
          essences: ["speed"],
          skills: ["athletics", "alertness"],
          languages: ["English"],
        },
      },
      {
        name: "Local Contact", type: "influence", img: "systems/essence20/assets/icons/items/influence.svg",
        system: { description: "<p>A demonstration Influence. Influences describe who shaped your character, and usually grant a Perk.</p>" },
      },
      {
        name: "Steady Aim", type: "perk", img: "systems/essence20/assets/icons/items/perk.svg",
        system: {
          type: "general",
          description: "<p>A demonstration Perk. Real Perks wire themselves into the roll dialog and appear there as a named modifier source whenever they apply.</p>",
        },
      },
      {
        name: "Signal Boost", type: "rolePoints", img: "systems/essence20/assets/icons/items/role.svg",
        system: {
          description: "<p>A demonstration Role Point pool. Role Points are a spendable resource a Role grants, tracked in the sidebar alongside Health.</p>",
          isActivatable: true,
          resource: { value: 3, max: 4, startingMax: 4 },
        },
      },
      {
        name: "Practice Blaster", type: "weapon", img: "systems/essence20/assets/icons/weapons/ray-gun.svg",
        system: {
          description: "<p>A training sidearm, kept deliberately unremarkable so the tour can talk about the sheet rather than the gun.</p>",
          classification: { size: "medium" },
          equipped: true,
        },
      },
      {
        name: "Drill Vest", type: "armor", img: "systems/essence20/assets/icons/items/armor.svg",
        system: {
          description: "<p>Demonstration armor. Armor contributes bonus Toughness and Evasion once it is equipped.</p>",
          bonusToughness: 2, bonusEvasion: 1, equipped: true,
        },
      },
      {
        name: "Buckler", type: "shield", img: "systems/essence20/assets/icons/items/shield.svg",
        system: { description: "<p>A demonstration shield, so the tour can show the equip and activation toggles.</p>" },
      },
      {
        name: "Field Kit", type: "gear", img: "icons/svg/item-bag.svg",
        system: { description: "<p>Demonstration gear, so the Gear list is not empty during the tour.</p>", quantity: 1 },
      },
      {
        name: "Grid Surge", type: "power", img: "systems/essence20/assets/icons/items/powers.svg",
        system: {
          type: "grid",
          description: "<p>A demonstration Power. Powers are paid for out of a power pool, and the sheet tracks the cost for you.</p>",
          powerCost: 2,
          canActivate: true,
          actionType: "standard",
        },
      },
    ],
    attach: [
      {
        parent: "Practice Blaster", type: "weaponEffect", name: "Stun Burst",
        img: "systems/essence20/assets/icons/items/weapon_effect.svg",
        system: {
          description: "<p>A demonstration weapon effect: a short, non-lethal pulse. Weapon Effects are rolled from the weapon they hang under.</p>",
          damageValue: 2, damageType: "blunt",
          // `style` is melee/energy/explosive/projectile — not "ranged".
          classification: { skill: "targeting", style: "energy" },
        },
      },
      {
        parent: "Practice Blaster", type: "upgrade", name: "Focusing Lens",
        system: {
          description: "<p>A demonstration upgrade. Upgrades attach to a weapon and change how it performs.</p>",
          benefit: "Demonstration only.",
        },
      },
      // Perks attach to whatever granted them, which is what sorts them into the Perks tab's
      // Influence / Origin / General / Role sections. A `level` on the attachment is what renders
      // the little level badge beside the perk's name.
      {
        parent: "Signal Corps", type: "perk", name: "Relay Discipline", level: 3,
        img: "systems/essence20/assets/icons/items/perk.svg",
        system: {
          type: "role",
          description: "<p>A demonstration Perk granted by the Role at level 3, so the tour has a level badge to point at.</p>",
        },
      },
      {
        parent: "Field Trained", type: "perk", name: "Drilled Reflexes",
        img: "systems/essence20/assets/icons/items/perk.svg",
        system: {
          type: "origin",
          description: "<p>A demonstration Perk granted by the Origin, so the Origin section of the Perks tab is not empty.</p>",
        },
      },
      {
        parent: "Local Contact", type: "perk", name: "Someone Who Owes You",
        img: "systems/essence20/assets/icons/items/perk.svg",
        system: {
          type: "influence",
          description: "<p>A demonstration Perk granted by the Influence, so the Influence section of the Perks tab is not empty.</p>",
        },
      },
    ],
    effects: [
      {
        name: "Field Adrenaline",
        img: "icons/svg/upgrade.svg",
        description: "<p>A demonstration Active Effect. It raises Toughness by 2, so the tour can toggle it and watch the defence in the sidebar change.</p>",
        // v14 shape: changes live under `system`, and the operation is a string `type`
        // (add / subtract / upgrade / downgrade / override / custom) rather than the old numeric
        // `mode`. `phase` defaults to "initial".
        system: {
          changes: [
            { key: "system.defenses.toughness.bonus", type: "add", value: "2" },
          ],
        },
      },
    ],
  },

  transformer: {
    name: "Demo Autobot",
    type: "playerCharacter",
    system: {
      level: 5,
      color: "#1565c0",
      // The two flags that reshape the sheet: canTransform swaps Rest for Recharge, adds the
      // Energon track and the Transform button, and turns on the per-item mode selectors.
      canTransform: true,
      transformerFaction: "autobots",
      health: { value: 22 },
      stun: { value: 0 },
      energon: { normal: { value: 6, max: 8 } },
      essences: {
        strength: { value: 4, max: 4 }, speed: { value: 2, max: 2 },
        smarts: { value: 3, max: 3 }, social: { value: 2, max: 2 },
      },
      initiative: { skill: "initiative" },
      skills: {
        athletics: { shift: "d4" }, might: { shift: "d4" },       // Strength: 2 + 2 = 4
        initiative: { shift: "d4" },                              // Speed:    2     = 2
        technology: { shift: "d4" }, alertness: { shift: "d2" },  // Smarts:   2 + 1 = 3
        persuasion: { shift: "d4" },                              // Social:   2     = 2
      },
    },
    items: [
      {
        name: "Ground Vehicle Mode", type: "altMode",
        img: "systems/essence20/assets/icons/items/altmode.svg",
        system: {
          description: "<p>A demonstration Alt Mode. Transforming swaps the character into this shape, which carries its own size and movement.</p>",
          altModesize: "common",
          altModeMovement: { ground: 40 },
        },
      },
      {
        name: "Impact Cannon", type: "weapon", img: "systems/essence20/assets/icons/weapons/field-gun.svg",
        system: {
          description: "<p>A demonstration weapon. On a Transformer, each piece of gear gains a mode selector controlling which shapes it is available in.</p>",
          classification: { size: "medium" },
          equipped: true,
        },
      },
    ],
  },

  vehicle: {
    name: "Demo Transport",
    type: "vehicle",
    system: {
      size: "large",
      color: "#6d4c41",
      // Non-PC types have no Origin item, so their Health maximum comes from this flat
      // `health.origin` field instead — setting `health.max` directly does nothing, it is derived.
      health: { origin: 18, value: 18 },
      crew: { numDrivers: 1, numPassengers: 3, description: "One driver and up to three passengers." },
      firepoints: { value: 2, description: "Two firing positions." },
      threatLevel: 2,
      essences: { strength: { value: 3 }, speed: { value: 3 }, smarts: { value: 1 }, social: { value: 1 } },
      movement: { ground: { base: 60 } },
      traits: { allTerrain: true, armoredCabin: true },
    },
    items: [],
    participants: ["character"],
  },

  zord: {
    name: "Demo Zord",
    type: "zord",
    system: {
      size: "titanic",
      color: "#c62828",
      health: { origin: 40, value: 40 },
      armor: 3,
      isCombiner: true,
      crew: { numDrivers: 1, numPassengers: 0 },
      essences: { strength: { value: 5 }, speed: { value: 3 }, smarts: { value: 2 }, social: { value: 1 } },
      movement: { ground: { base: 80 } },
    },
    items: [],
  },

  megaform: {
    name: "Demo Megazord",
    type: "megaform",
    system: {
      size: "titanic",
      color: "#1565c0",
      armor: 4,
    },
    items: [],
    // A Megaform derives almost everything — Essences, defences, movement and the combined health
    // breakdown — from its participants, so without this it renders as an empty shell.
    participants: ["zord"],
  },

  threat: {
    name: "Demo Threat",
    type: "npc",
    system: {
      level: 3,
      color: "#37474f",
      health: { value: 14 },
      essences: {
        strength: { value: 3, max: 3 }, speed: { value: 2, max: 2 },
        smarts: { value: 1, max: 1 }, social: { value: 1, max: 1 },
      },
      // isChosen is what puts a skill on an NPC-like sheet at all (npc-skill-list.hbs reads
      // base-actor-sheet.mjs#_prepareChosenNpcSkills); without it the Skills panel renders empty
      // no matter what shifts are set, and the tour step pointing at it has nothing to show.
      skills: {
        might: { shift: "d8", isChosen: true },
        alertness: { shift: "d6", isChosen: true },
        intimidation: { shift: "d6", isChosen: true },
      },
    },
    items: [
      {
        name: "Heavy Baton", type: "weapon", img: "systems/essence20/assets/icons/weapons/baseball-bat.svg",
        system: {
          description: "<p>A demonstration weapon for the opposition, so combat steps have something on the other side of the roll.</p>",
          classification: { size: "medium" }, equipped: true,
        },
      },
    ],
  },
};

/* -------------------------------------------- */
/*  Provisioning                                */
/* -------------------------------------------- */

/**
 * Serialises provisioning against teardown.
 *
 * Both are async and both are triggered by tour lifecycle events that can overlap: a tour's
 * `exit()` schedules cleanup fire-and-forget, and the next tour starts provisioning immediately
 * afterwards. Interleaved, the outgoing cleanup deletes actors the incoming tour has just created
 * — and the failure surfaces several steps later as a missing sheet, which is a miserable thing to
 * diagnose. Chaining every operation through one promise makes the ordering total.
 * @type {Promise<unknown>}
 */
let queue = Promise.resolve();

/**
 * Run an operation once every previously queued one has settled.
 * @template T
 * @param {() => Promise<T>} operation
 * @returns {Promise<T>}
 */
function serialize(operation) {
  // Swallow a rejection from the *previous* link so one failure doesn't poison the chain, while
  // still handing this caller its own result.
  const result = queue.catch(() => {}).then(operation);
  queue = result.catch(() => {});
  return result;
}

/**
 * Whether this user can create the demo actors at all.
 * @returns {boolean}
 */
export function canProvisionDemo() {
  return Actor.canUserCreate(game.user);
}

/**
 * Find an actor the user already owns to stand in for a demo actor they can't create.
 * @param {string} type              The actor type required.
 * @returns {Actor|null}
 */
export function findFallbackActor(type) {
  return game.actors.find(a => (a.type === type) && a.isOwner) ?? null;
}

/**
 * Get the folder demo actors live in, creating it if necessary.
 * @returns {Promise<Folder|null>}
 */
async function getDemoFolder() {
  const existing = game.folders.find(f => (f.type === "Actor") && (f.name === DEMO_FOLDER));
  if (existing) return existing;
  return Folder.create({ name: DEMO_FOLDER, type: "Actor", flags: { essence20: { [DEMO_FLAG]: true } } });
}

/**
 * Attach a child item (weapon effect, upgrade) to a parent item on the same actor.
 *
 * The system models an attachment two ways at once and needs both: the child is a normal embedded
 * item flagged with its `parentId` and a short `collectionId`, and the parent carries a snapshot of
 * it under `system.items[collectionId]`. The sheet renders the nested row from the *snapshot*, so
 * the flags alone produce a child that exists but appears as a loose top-level row.
 * @param {Actor} actor                   The owning actor.
 * @param {Item} parent                   The parent item.
 * @param {DemoAttachment} definition     What to attach.
 * @returns {Promise<void>}
 */
async function attachItem(actor, parent, definition) {
  const collectionId = foundry.utils.randomID(4);
  const [child] = await actor.createEmbeddedDocuments("Item", [{
    name: definition.name,
    type: definition.type,
    img: definition.img,
    system: definition.system ?? {},
    flags: { essence20: { parentId: parent.id, collectionId, [DEMO_FLAG]: true } },
  }]);

  // Snapshot the child as it ended up, not as it was requested — the data model may have rejected
  // or defaulted fields, and the sheet renders from this copy. `toObject()` rather than
  // deepClone(): system is a DataModel, and only its plain-object form survives the round trip
  // through the parent's ObjectField.
  const items = foundry.utils.deepClone(parent.system.items ?? {});
  items[collectionId] = Object.assign(child.system.toObject(), {
    name: child.name,
    img: child.img,
    type: child.type,
    uuid: child.uuid,
  });

  // The level badge is read off the parent's snapshot (base-actor-sheet resolves an item's
  // `grantedLevel` as `parent.system.items[collectionId].level`), so it belongs here rather than
  // on the child item.
  if (definition.level !== undefined) items[collectionId].level = definition.level;

  await parent.update({ "system.items": items });
}

/**
 * Create a demo actor, or return the one already present.
 *
 * Falls back to an actor of the same type that the user already owns when they lack create
 * permission, so the sheet tours still run for a player.
 * @param {string} key                  A key of {@link DEMO_ACTORS}.
 * @returns {Promise<Actor|null>}       The actor to run the tour against.
 */
async function provisionDemoActor(key, seen = new Set()) {
  const definition = DEMO_ACTORS[key];
  if (!definition) {
    console.warn(`Essence20 | No demo actor defined for "${key}"`);
    return null;
  }

  const existing = game.actors.find(a => a.getFlag("essence20", DEMO_FLAG) && (a.name === definition.name));
  if (existing) return existing;

  if (!canProvisionDemo()) return findFallbackActor(definition.type);

  const folder = await getDemoFolder();
  const actor = await Actor.create({
    name: definition.name,
    type: definition.type,
    img: definition.img,
    folder: folder?.id,
    system: definition.system,
    flags: { essence20: { [DEMO_FLAG]: true } },
  });

  if (definition.items?.length) {
    await actor.createEmbeddedDocuments("Item", definition.items.map(i => foundry.utils.mergeObject(
      foundry.utils.deepClone(i),
      { flags: { essence20: { [DEMO_FLAG]: true } } },
    )));
  }

  if (definition.effects?.length) {
    await actor.createEmbeddedDocuments("ActiveEffect", definition.effects.map(e => foundry.utils.mergeObject(
      foundry.utils.deepClone(e),
      { flags: { essence20: { [DEMO_FLAG]: true } } },
    )));
  }

  // Attachments run after the parents exist, one at a time: each one re-reads its parent's
  // `system.items`, so creating them in parallel would have them overwrite each other's snapshot.
  for (const attachment of definition.attach ?? []) {
    const parent = actor.items.find(i => i.name === attachment.parent);
    if (!parent) {
      console.warn(`Essence20 | Demo actor "${definition.name}" has no item "${attachment.parent}" to attach to`);
      continue;
    }

    await attachItem(actor, parent, attachment);
  }

  await linkParticipants(actor, definition, key, seen);
  return actor;
}

/**
 * Create a demo actor, or return the one already present. Serialised against teardown.
 * @param {string} key                  A key of {@link DEMO_ACTORS}.
 * @param {Set<string>} [seen]          Internal: keys already being provisioned, to break cycles.
 * @returns {Promise<Actor|null>}
 */
export async function ensureDemoActor(key, seen) {
  // A recursive call from linkParticipants is already inside the queue; re-entering would deadlock.
  if (seen) return provisionDemoActor(key, seen);
  return serialize(() => provisionDemoActor(key, new Set()));
}

/**
 * Delete every actor, folder and chat card this module created. Serialised against provisioning.
 * @returns {Promise<void>}
 */
export async function cleanupDemoActors() {
  return serialize(() => removeDemoActors());
}

/**
 * Link other demo actors into this one's `system.actors`.
 *
 * This is how the system models a vehicle's crew and a Megaform's constituent Zords, and it is a
 * *runtime* link — each entry stores the participant's uuid, so the participants have to exist
 * first. A Megaform in particular derives its Essences, defences, movement and combined-health
 * breakdown from whatever is in here; given an empty list it renders as a shell.
 * @param {Actor} actor               The actor being provisioned.
 * @param {DemoActor} definition      Its definition.
 * @param {string} key                Its own key, used to break reference cycles.
 * @param {Set<string>} seen          Keys already being provisioned further up the call stack.
 * @returns {Promise<void>}
 */
async function linkParticipants(actor, definition, key, seen) {
  if (!definition.participants?.length) return;

  seen.add(key);
  const entries = {};

  for (const participantKey of definition.participants) {
    // A definition that listed itself, directly or through another, would recurse forever.
    if (seen.has(participantKey)) {
      console.warn(`Essence20 | Demo actor "${key}" has a circular participant "${participantKey}"`);
      continue;
    }

    const participant = await ensureDemoActor(participantKey, seen);
    if (!participant) continue;

    entries[foundry.utils.randomID(4)] = {
      uuid: participant.uuid,
      type: participant.type,
      name: participant.name,
      img: participant.img,
    };
  }

  if (!foundry.utils.isEmpty(entries)) await actor.update({ "system.actors": entries });
}

/* -------------------------------------------- */
/*  Teardown                                    */
/* -------------------------------------------- */

/**
 * Delete every actor and folder this module created.
 *
 * Called when a tour ends and once on `ready`, the latter because a refresh or a crash mid-tour
 * skips the normal teardown and would otherwise leave demo actors in the user's world for good.
 * @returns {Promise<void>}
 */
async function removeDemoActors() {
  if (!game.user.isGM) return;

  // Two cleanups can overlap — a tour exiting while the ready sweep runs, or two tours ending in
  // quick succession — and deleting an id that a previous pass already removed throws from the
  // server backend. Re-check existence immediately before deleting, and treat a miss as success.
  const actorIds = game.actors
    .filter(a => a.getFlag("essence20", DEMO_FLAG))
    .map(a => a.id)
    .filter(id => game.actors.has(id));

  if (actorIds.length) {
    try {
      await Actor.deleteDocuments(actorIds);
    } catch (err) {
      // Anything still present after a failed batch gets picked up by the next sweep.
      console.warn("Essence20 | Some tour demo actors could not be deleted", err);
    }
  }

  const folderIds = game.folders
    .filter(f => (f.type === "Actor") && (f.name === DEMO_FOLDER) && !f.contents.length)
    .map(f => f.id)
    .filter(id => game.folders.has(id));

  if (folderIds.length) {
    try {
      await Folder.deleteDocuments(folderIds);
    } catch (err) {
      console.warn("Essence20 | The tour demo folder could not be deleted", err);
    }
  }

  // Chat cards the tour rolled. These outlive their actor otherwise, leaving messages in the log
  // attributed to a character that no longer exists.
  const messageIds = game.messages
    .filter(m => m.getFlag("essence20", DEMO_FLAG))
    .map(m => m.id)
    .filter(id => game.messages.has(id));

  if (messageIds.length) {
    try {
      await ChatMessage.deleteDocuments(messageIds);
    } catch (err) {
      console.warn("Essence20 | Some tour demo chat messages could not be deleted", err);
    }
  }
}
