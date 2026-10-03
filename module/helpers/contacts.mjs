import { getMissionEpoch, getSceneEpoch, getUses, markUsed } from "./scene-clock.mjs";

/**
 * Contacts (Field Guide to Action & Adventure p.153-155, Hawk's Personnel Files p.6-7, Enigma of
 * Combination p.39).
 *
 * "Summon Contact: Once per scene as a Standard action, you can call on an available Contact. Your
 * group can use your Contact starting this turn. The Contact remains available until the end of the
 * scene or until they run out of Allegiance Points." "Contacts only regain Allegiance Points after the
 * mission, at which point they regain all their Allegiance Points."
 *
 * - A Contact is an NPC with system.isContact, listed on a PC's Contacts tab. Its Allegiance Points
 *   (system.allegiancePoints) are what it starts a mission with; what is left is kept in
 *   flags.essence20.contact.left, which the New Mission button (helpers/scene-clock.mjs) refreshes.
 * - Summon, on the Contacts tab, posts a card with a button per Contact Perk (a perk of type
 *   'contact', costing system.allegianceCost). Anyone at the table spends from it.
 * - flags.essence20.contactRules on the Contact says how often it may be called (a Trusted Contact
 *   "once per day", Networker's "once per Mission"), and whether calling it costs a Story Point
 *   (Enigma of Combination: "Activating a Contact Perk requires the character with access to it to
 *   expend a Story Point").
 * - The Perks: Networker (and its Hang-Up), Trusted Contact, Contact Connection, International
 *   Network, Contact: Nebulan Technician, Contact: Combiner Team, Fortified Bond, Worthy Contact,
 *   Lasting Alliances, Hometown Hero, Emissary, Devious Alliance, Learned from the Best.
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const CONTACT = {
  networker: uuid('ferocious_fighters', 'TfkbGe9bsMThgNUj'),
  networkerHangUp: uuid('ferocious_fighters', 'q02Yuz0TvTJPRTdQ'),
  deviousAlliance: uuid('ferocious_fighters', 'SNFbEUpL7dzNtNtl'),
  emissary: uuid('ferocious_fighters', 'YP8urAbkSotNV7E8'),
  fortifiedBond: uuid('ferocious_fighters', 'l9enKfeOdGypyAEW'),
  lastingAlliance: uuid('ferocious_fighters', 'NEdXGHwdSOZ29E46'),
  worthyContact: uuid('ferocious_fighters', 'Iujzsc3bhRFNY9MO'),
  internationalNetwork: uuid('intercontinental_adventures', 'lN2fxK3eWzesZ11r'),
  learnedFromTheBest: uuid('general_hawk_s_personel_files', 'FPE1tFVfl0zTvioz'),
  combinerTeam: uuid('enigma_of_combination', 'cSikKrTZCSL53EKk'),
  nebulanTechnician: uuid('enigma_of_combination', 'saOB2B0VyYv6B3xP'),
  hometownHero: uuid('field_guide_action_adventure', 'pJXbVsqZFoYgSBnZ'),
  contactConnection: uuid('field_guide_action_adventure', '9cASTw6nAfEr8B9B'),
  trustedContact: uuid('field_guide_action_adventure', 'jggXA81nelTSlRNV'),
  gridlockAuthority: uuid('field_guide_action_adventure', 'EiS24nGsgSsroa16'),
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

const has = (actor, id) => itemsOf(actor).some(item => sourceOf(item) == id);
const count = (actor, id) => itemsOf(actor).filter(item => sourceOf(item) == id).length;

const USE_KINDS = ['networker', 'deviousAlliance', 'emissary', 'fortifiedBond', 'lastingAlliance', 'worthyContact', 'internationalNetwork',
  'learnedFromTheBest', 'combinerTeam', 'nebulanTechnician', 'contactConnection', 'trustedContact'];
const BY_SOURCE = Object.fromEntries(USE_KINDS.map(kind => [CONTACT[kind], kind]));

export function contactKindOf(item) {
  return BY_SOURCE[sourceOf(item)] ?? null;
}

export function isContact(actor) {
  return actor?.type == 'npc' && !!actor.system?.isContact;
}

/**
 * The NPC sheet's header buttons: an NPC is used as an NPC, a Contact, or both (both on). Flipping
 * one returns the update to make, or null when it would switch the last one off - it has to be
 * used as something.
 * @param {Object} system The NPC's system data
 * @param {'isNPC'|'isContact'} field The button clicked
 * @returns {Object|null}
 */
export function npcUseToggle(system, field) {
  const other = { isNPC: 'isContact', isContact: 'isNPC' }[field];
  if (!other) {
    return null;
  }

  const next = !system?.[field];
  if (!next && !system?.[other]) {
    return null;
  }

  return { [`system.${field}`]: next };
}

/**
 * Only a Contact can be added to a character. An NPC dropped on one that isn't a Contact yet asks
 * whether to make it one; No or closing the prompt calls the drop off, and a user who can't edit the
 * NPC is told the GM has to tick its Contact box.
 * @param {Actor} npc The dropped NPC
 * @returns {Promise<boolean>} true when the NPC is (now) a Contact and the drop goes ahead
 */
export async function offerMakeContact(npc) {
  if (npc?.type != 'npc' || npc.system?.isContact) {
    return true;
  }

  if (!npc.isOwner) {
    ui.notifications.warn(game.i18n.format('E20.ContactDropNotContact', { name: npc.name }));
    return false;
  }

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize('E20.ContactDropPromptTitle') },
    content: `<p>${game.i18n.format('E20.ContactDropPrompt', { name: foundry.utils.escapeHTML(npc.name) })}</p>`,
    rejectClose: false,
  });
  if (!confirmed) {
    return false;
  }

  await npc.update({ 'system.isContact': true });
  return true;
}

/**
 * The characters that list this NPC on their Contacts tab, with the system.actors key it sits under.
 * @param {Actor} npc
 * @returns {{actor: Actor, key: string}[]}
 */
export function contactHolders(npc) {
  const holders = [];
  for (const actor of globalThis.game?.actors ?? []) {
    if (actor.type != 'playerCharacter') {
      continue;
    }

    for (const [key, entry] of Object.entries(actor.system?.actors ?? {})) {
      if (entry?.uuid == npc?.uuid) {
        holders.push({ actor, key });
      }
    }
  }

  return holders;
}

/**
 * Unticking Contact on an NPC that characters list as a Contact: confirm, then take it off their
 * Contacts tabs, so only Contacts are ever on one (the drop side is offerMakeContact). Refused
 * outright when the user can't edit one of those characters.
 * @param {Actor} npc
 * @returns {Promise<boolean>} true when the untick can go ahead
 */
export async function confirmStopBeingContact(npc) {
  const holders = contactHolders(npc);
  if (!holders.length) {
    return true;
  }

  const names = holders.map(holder => holder.actor.name).join(', ');
  if (holders.some(holder => !holder.actor.isOwner)) {
    ui.notifications.error(game.i18n.format('E20.ContactUntickBlocked', { name: npc.name, holders: names }));
    return false;
  }

  const escape = foundry.utils.escapeHTML;
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize('E20.ContactUntickTitle') },
    content: `<p>${game.i18n.format('E20.ContactUntickPrompt', { name: escape(npc.name), holders: escape(names) })}</p>`,
    rejectClose: false,
  });
  if (!confirmed) {
    return false;
  }

  for (const { actor, key } of holders) {
    await actor.update({ [`system.actors.${key}`]: new foundry.data.operators.ForcedDeletion() });
  }

  return true;
}

/** The Contacts listed on a PC's sheet. */
export function contactsOf(actor) {
  return Object.values(actor?.system?.actors ?? {}).map(entry => {
    try {
      return globalThis.fromUuidSync?.(entry?.uuid);
    } catch (error) {
      return null;
    }
  }).filter(isContact);
}

/* -------------------------------------------- */
/*  Allegiance Points                            */
/* -------------------------------------------- */

function stateOf(contact) {
  return contact?.flags?.essence20?.contact ?? {};
}

/** What a Contact starts a mission with. */
export function startingAllegiance(contact) {
  return Math.max(0, Number(contact?.system?.allegiancePoints) || 0);
}

/**
 * The Allegiance Points left this mission.
 * @param {Actor} contact
 * @returns {Number}
 */
export function allegianceLeft(contact) {
  const state = stateOf(contact);
  if (state.mission != getMissionEpoch() || state.left == null) {
    return startingAllegiance(contact);
  }

  return Number(state.left) || 0;
}

async function setLeft(contact, left, extra = {}) {
  await contact.setFlag('essence20', 'contact', { ...stateOf(contact), ...extra, left: Math.max(0, left), mission: getMissionEpoch() });
}

/* -------------------------------------------- */
/*  Summoning                                    */
/* -------------------------------------------- */

function rulesOf(contact) {
  return contact?.flags?.essence20?.contactRules ?? {};
}

/**
 * How many more times this Contact can be called in its window.
 * @returns {Number}
 */
function callsLeft(contact, summoner) {
  const rules = rulesOf(contact);
  const window = rules.window ?? 'mission';
  const max = (rules.uses ?? 1) + (rules.extraCalls?.mission == getMissionEpoch() ? rules.extraCalls.count : 0);
  if (window == 'day') {
    return max - (Number(contact.flags?.essence20?.contactDailyCalls) || 0);
  }

  return max - getUses(contact, 'contactCalls', window == 'scene' ? 'scene' : 'mission') - (summoner ? 0 : 0);
}

/**
 * Summon a Contact: a Standard action, once per scene for the summoner.
 * @param {Actor} summoner
 * @param {Actor} contact
 * @param {Object} [options]
 * @param {Function} [options.pay]
 * @param {Boolean} [options.again]   Worthy Contact's second call: "The Contact regains all of their
 *   Allegiance Points when you call them again."
 * @returns {Promise<ChatMessage|null>}
 */
export async function summonContact(summoner, contact, { pay = async () => true, again = false } = {}) {
  if (!isContact(contact)) {
    return null;
  }

  if (!again && getUses(summoner, 'summonContact', 'scene') >= 1) {
    ui.notifications.warn(T('E20.ContactOncePerScene', { name: summoner.name }));
    return null;
  }

  if (!again && callsLeft(contact, summoner) <= 0) {
    ui.notifications.warn(T('E20.ContactNoCallsLeft', { name: contact.name }));
    return null;
  }

  if (rulesOf(contact).storyPoint) {
    const { canSpendForActor, spendForActor } = await import("./story-points.mjs");
    if (!canSpendForActor?.(summoner)) {
      ui.notifications.warn(T('E20.ContactNeedsStoryPoint'));
      return null;
    }

    await spendForActor(summoner, 1, { announce: false });
  }

  if (!(await pay('standard'))) {
    return null;
  }

  // What they arrive with: the pool left this mission - or, on a mission's first call, the full
  // starting pool, doubled by Fortified Bond ("Double their starting Allegiance Points when you
  // summon them") - plus Contact Connection's "when you summon Contacts ... they gain an additional
  // Allegiance Point" and Hometown Hero's "Your Contacts from your hometown gain +1 Allegiance Point
  // when called".
  const fresh = stateOf(contact).mission != getMissionEpoch() || stateOf(contact).left == null;
  const fortified = fresh && (summoner.flags?.essence20?.fortifiedBond == contact.uuid);
  let left = again ? startingAllegiance(contact) : allegianceLeft(contact) + (fortified ? startingAllegiance(contact) : 0);
  if (has(summoner, CONTACT.contactConnection)) {
    left += 1;
  }

  if (contact.flags?.essence20?.hometown && has(summoner, CONTACT.hometownHero)) {
    left += 1;
  }

  // Gridlock Authority (Field Guide p.70): "civilian or government Contacts begin play with 1 extra
  // Allegiance Point."
  if (contact.flags?.essence20?.government && has(summoner, CONTACT.gridlockAuthority)) {
    left += 1;
  }

  const { needsGmRelay, relayToGm } = await import("./gm-relay.mjs");
  const write = async (key, value) => (needsGmRelay(contact) ? relayToGm(contact, 'setFlag', ['essence20', key, value]) : contact.setFlag('essence20', key, value));
  await write('contact', { ...stateOf(contact), left, mission: getMissionEpoch(), summoned: { scene: getSceneEpoch(), by: summoner.uuid } });
  if (rulesOf(contact).window == 'day') {
    await write('contactDailyCalls', (Number(contact.flags?.essence20?.contactDailyCalls) || 0) + 1);
  } else if (!again) {
    const { epochFor } = await import("./scene-clock.mjs");
    const window = rulesOf(contact).window == 'scene' ? 'scene' : 'mission';
    await write('contactCalls', { epoch: epochFor(window), window, count: getUses(contact, 'contactCalls', window) + 1 });
  }

  if (!again) {
    await markUsed(summoner, 'summonContact', { window: 'scene' });
  }

  return postContactCard(summoner, contact, left);
}

function perksOf(contact) {
  return itemsOf(contact).filter(item => item.type == 'perk' && item.system?.type == 'contact');
}

async function postContactCard(summoner, contact, left) {
  const buttons = perksOf(contact).map(perk => `<button type="button" data-e20-social="contactPerk" data-contact="${contact.uuid}" data-perk="${perk.id}">${
    foundry.utils.escapeHTML(perk.name)} (${perk.system?.allegianceCost ?? 1})</button>`).join('');
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: summoner }),
    content: `<div class="e20-contact-card"><p>${T('E20.ContactSummoned', { name: summoner.name, contact: contact.name, left })}</p><div class="flexcol">${buttons}</div></div>`,
    flags: { essence20: { contactCard: { contact: contact.uuid } } },
  });
}

/**
 * A Contact Perk from the card: spend its cost from the pool, and post what it does.
 * @param {HTMLElement} button
 */
export async function onContactPerk(button) {
  const contact = await fromUuid(button.dataset.contact);
  const perk = contact?.items?.get?.(button.dataset.perk);
  if (!contact || !perk) {
    return;
  }

  const cost = Number(perk.system?.allegianceCost) || 1;
  const left = allegianceLeft(contact);
  if (left < cost) {
    ui.notifications.warn(T('E20.ContactNotEnough', { name: contact.name, left, cost }));
    return;
  }

  const { needsGmRelay, relayToGm } = await import("./gm-relay.mjs");
  const next = { ...stateOf(contact), left: left - cost, mission: getMissionEpoch() };
  if (needsGmRelay(contact)) {
    await relayToGm(contact, 'setFlag', ['essence20', 'contact', next]);
  } else {
    await contact.setFlag('essence20', 'contact', next);
  }

  const description = perk.system?.description ? `<div>${perk.system.description}</div>` : '';
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: contact }),
    content: `<p>${T('E20.ContactPerkUsed', { contact: contact.name, perk: perk.name, cost, left: left - cost })}</p>${description}`,
  });
}

/** The New Mission button: every Contact's pool is fresh (allegianceLeft reads the mission). Daily calls clear on a Rest. */
export async function restContact(actor) {
  if (actor?.flags?.essence20?.contactDailyCalls) {
    await actor.unsetFlag('essence20', 'contactDailyCalls');
  }

  for (const contact of contactsOf(actor)) {
    if (contact.flags?.essence20?.contactDailyCalls && contact.isOwner) {
      await contact.unsetFlag('essence20', 'contactDailyCalls');
    }
  }
}

/* -------------------------------------------- */
/*  Making Contacts                              */
/* -------------------------------------------- */

/**
 * Make a Contact for a PC and list it on their Contacts tab.
 * @param {Actor} owner
 * @param {Object} options   {name, allegiance, rules, perks: [{name, cost}], temporary}
 * @param {Item} grantor
 */
export async function createContact(owner, { name, allegiance = 3, rules = {}, perks = [], temporary = false }, grantor = null) {
  const { createViaGm } = await import("./gm-relay.mjs");
  const data = {
    name, type: 'npc', img: grantor?.img ?? undefined,
    system: { isContact: true, allegiancePoints: allegiance },
    ownership: foundry.utils.deepClone(owner.ownership ?? {}),
    items: perks.map(perk => ({ name: perk.name, type: 'perk', system: { type: 'contact', allegianceCost: perk.cost ?? 1 } })),
    flags: { essence20: { contactOf: owner.uuid, contactRules: rules, grantedBy: grantor ? sourceOf(grantor) ?? null : null, temporaryContact: temporary || null } },
  };
  const createdUuid = await createViaGm('actor', { data });
  const contact = createdUuid ? await fromUuid(createdUuid) : null;
  if (contact) {
    const { setEntryAndAddActor } = await import("../sheet-handlers/drop-handler.mjs");
    await setEntryAndAddActor(contact, owner);
  }

  return contact;
}

function madeBy(owner, grantor) {
  const source = sourceOf(grantor);
  return contactsOf(owner).filter(c => c.flags?.essence20?.grantedBy == source);
}

async function askName(title, value) {
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `<div class="form-group"><label>${T('E20.ContactName')}</label><input type="text" name="name" value="${foundry.utils.escapeHTML(value)}" /></div>`,
    ok: { label: T('E20.DialogConfirmButton'), callback: (event, button) => button.form.elements.name.value },
    rejectClose: false,
  });
  return result || null;
}

const HANDLERS = {
  // Networker (Ferocious Fighters, Influence Perk, p.8): "You gain a Contact that you can summon during
  // missions ... once per Mission ... This Contact has 3 Allegiance Points and 3 Contact Perks, which
  // you and your GM must clearly define". Hang-Up: "only 2 Allegiance Points and 2 Contact Perks."
  async networker(owner, item) {
    if (madeBy(owner, item).length) {
      ui.notifications.info(T('E20.ContactAlreadyMade'));
      return null;
    }

    const name = await askName(item.name, T('E20.ContactDefaultName'));
    const small = has(owner, CONTACT.networkerHangUp);
    const size = small ? 2 : 3;
    const contact = name && await createContact(owner, {
      name, allegiance: size, rules: { window: 'mission', uses: 1 },
      perks: Array.from({ length: size }, (_, i) => ({ name: T('E20.ContactPerkBlank', { n: i + 1 }), cost: 1 })),
    }, item);
    return contact ? T('E20.ContactMade', { name: owner.name, contact: contact.name }) : null;
  },
  // Trusted Contact (Field Guide p.72): "a Contact that you can call on once per day. This Contact has
  // 3 Allegiance Points and 1 Contact Perk ... You can take this General Perk multiple times, gaining an
  // additional use per day and an additional Contact Perk each time."
  async trustedContact(owner, item) {
    const uses = count(owner, CONTACT.trustedContact);
    const existing = madeBy(owner, item)[0];
    if (existing) {
      const perks = itemsOf(existing).filter(i => i.type == 'perk' && i.system?.type == 'contact').length;
      if (perks < uses) {
        await existing.createEmbeddedDocuments('Item', Array.from({ length: uses - perks }, (_, i) => ({ name: T('E20.ContactPerkBlank', { n: perks + i + 1 }), type: 'perk', system: { type: 'contact', allegianceCost: 1 } })));
      }

      await existing.setFlag('essence20', 'contactRules', { window: 'day', uses });
      return T('E20.ContactImproved', { contact: existing.name, uses });
    }

    const name = await askName(item.name, T('E20.ContactDefaultName'));
    const contact = name && await createContact(owner, { name, allegiance: 3, rules: { window: 'day', uses }, perks: [{ name: T('E20.ContactPerkBlank', { n: 1 }), cost: 1 }] }, item);
    return contact ? T('E20.ContactMade', { name: owner.name, contact: contact.name }) : null;
  },
  // Contact Connection (Field Guide p.66): "At 5th level, you gain a Contact that you can call on once
  // per Mission ... This Contact gains 3 Contact Perks. You gain an additional Contact at 9th and 14th
  // levels".
  async contactConnection(owner, item) {
    const level = Number(owner.system?.level) || 1;
    const allowed = [5, 9, 14].filter(l => level >= l).length;
    const made = madeBy(owner, item).length;
    if (made >= allowed) {
      ui.notifications.info(T('E20.ContactAlreadyMade'));
      return null;
    }

    const name = await askName(item.name, T('E20.ContactDefaultName'));
    const contact = name && await createContact(owner, {
      name, allegiance: 3, rules: { window: 'mission', uses: 1 },
      perks: [1, 2, 3].map(n => ({ name: T('E20.ContactPerkBlank', { n }), cost: 1 })),
    }, item);
    return contact ? T('E20.ContactMade', { name: owner.name, contact: contact.name }) : null;
  },
  // International Network (Intercontinental Adventures p.99): "you can spend a Story Point to instantly
  // gain them as a temporary Contact you can call on once per mission."
  async internationalNetwork(owner, item) {
    const { canSpendForActor, spendForActor } = await import("./story-points.mjs");
    if (!canSpendForActor?.(owner)) {
      ui.notifications.warn(T('E20.ContactNeedsStoryPoint'));
      return null;
    }

    const name = await askName(item.name, T('E20.ContactDefaultName'));
    if (!name) {
      return null;
    }

    await spendForActor(owner, 1, { announce: false });
    const contact = await createContact(owner, { name, allegiance: 3, rules: { window: 'mission', uses: 1 }, temporary: getMissionEpoch() }, item);
    return contact ? T('E20.ContactMade', { name: owner.name, contact: contact.name }) : null;
  },
  // Contact: Nebulan Technician (Enigma of Combination p.40): 3 Allegiance Points and three Contact
  // Perks - Here, Let Me (1), I Brought a Little Something (2), Just a Little Adjustment (1).
  async nebulanTechnician(owner, item) {
    if (madeBy(owner, item).length) {
      ui.notifications.info(T('E20.ContactAlreadyMade'));
      return null;
    }

    const contact = await createContact(owner, {
      name: item.name.replace(/^Contact:\s*/, ''), allegiance: 3, rules: { window: 'mission', uses: 1, storyPoint: true },
      perks: [{ name: 'Here, Let Me', cost: 1 }, { name: 'I Brought a Little Something', cost: 2 }, { name: 'Just a Little Adjustment', cost: 1 }],
    }, item);
    return contact ? T('E20.ContactMade', { name: owner.name, contact: contact.name }) : null;
  },
  // Contact: Combiner Team (Enigma of Combination p.40): "The number of Allegiance Points this Contact
  // has and their Contact Perks depend upon the team." Asked.
  async combinerTeam(owner, item) {
    const answer = await foundry.applications.api.DialogV2.wait({
      window: { title: item.name },
      classes: ["window-app", "e20-window"],
      content: `<div class="form-group"><label>${T('E20.ContactName')}</label><input type="text" name="name" value="${T('E20.ContactCombinerTeamDefault')}" /></div>
        <div class="form-group"><label>${T('E20.ContactAllegiancePoints')}</label><input type="number" name="ap" value="3" min="1" max="6" /></div>`,
      buttons: [
        { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => ({ name: button.form.elements.name.value, ap: Number(button.form.elements.ap.value) || 3 }) },
        { action: 'cancel', label: T('E20.DialogCancelButton') },
      ],
      rejectClose: false,
    });
    if (!answer || answer == 'cancel') {
      return null;
    }

    const contact = await createContact(owner, { name: answer.name, allegiance: answer.ap, rules: { window: 'mission', uses: 1, storyPoint: true } }, item);
    return contact ? T('E20.ContactMade', { name: owner.name, contact: contact.name }) : null;
  },
  // Fortified Bond (Ferocious Fighters p.9): "Choose one of your Contacts. Double their starting
  // Allegiance Points when you summon them."
  async fortifiedBond(owner, item) {
    const contact = await pickContact(owner, item);
    if (!contact) {
      return null;
    }

    await owner.setFlag('essence20', 'fortifiedBond', contact.uuid);
    return T('E20.FortifiedBondChosen', { name: owner.name, contact: contact.name });
  },
  // Worthy Contact (Ferocious Fighters p.9): "Once per mission, you summon a Contact a second time. The
  // Contact regains all of their Allegiance Points when you call them again."
  async worthyContact(owner, item, pay) {
    if (getUses(owner, 'worthyContact', 'mission') >= 1) {
      ui.notifications.warn(T('E20.OncePerMission'));
      return null;
    }

    const contact = await pickContact(owner, item);
    const card = contact ? await summonContact(owner, contact, { pay, again: true }) : null;
    if (card) {
      await markUsed(owner, 'worthyContact', { window: 'mission' });
    }

    return null;
  },
  // Lasting Alliances (Ferocious Fighters, Peacekeeper 20th, p.14): "after the end of a scene in which you
  // summoned a Contact, roll a DIF 15 Culture Skill Test. On a success, that Contact regains 2
  // Allegiance Points, and you can call on them one additional time during this mission."
  async lastingAlliance(owner, item) {
    const contact = await pickContact(owner, item, c => stateOf(c).summoned?.by == owner.uuid);
    if (!contact) {
      return null;
    }

    const { rollTest } = await import("./grants.mjs");
    const { success } = await rollTest(owner, 'culture', 15);
    if (!success) {
      return T('E20.GrantFailed', { name: owner.name, item: item.name });
    }

    const rules = rulesOf(contact);
    const extra = rules.extraCalls?.mission == getMissionEpoch() ? rules.extraCalls.count : 0;
    await setLeft(contact, allegianceLeft(contact) + 2);
    await contact.setFlag('essence20', 'contactRules', { ...rules, extraCalls: { mission: getMissionEpoch(), count: extra + 1 } });
    return T('E20.LastingAllianceDone', { name: owner.name, contact: contact.name });
  },
  // Emissary (Ferocious Fighters, Peacekeeper 3rd): "you gain Edge on Skill Tests to gain Contacts."
  // Devious Alliance: "You can use Deception when you attempt to gain a Contact." The test itself.
  emissary: (owner, item) => gainContactTest(owner, item),
  deviousAlliance: (owner, item) => gainContactTest(owner, item),
  // Learned from the Best (Hawk's Personnel Files p.174): "You gain one of the Perks from your
  // Contact's Threat stat block."
  async learnedFromTheBest(owner, item) {
    if (item.flags?.essence20?.granted) {
      ui.notifications.info(T('E20.GrantAlready'));
      return null;
    }

    const contact = await pickContact(owner, item, c => itemsOf(c).some(i => i.type == 'perk' && i.system?.type != 'contact'));
    const perks = contact ? itemsOf(contact).filter(i => i.type == 'perk' && i.system?.type != 'contact') : [];
    const { chooseSelect } = await import("./grants.mjs");
    const picked = perks.length ? await chooseSelect(item.name, T('E20.LearnedFromTheBestPrompt'), perks.map(p => ({ value: p.id, label: p.name }))) : null;
    const perk = picked ? contact.items.get(picked) : null;
    if (!perk) {
      return null;
    }

    const data = perk.toObject();
    delete data._id;
    foundry.utils.setProperty(data, 'system.type', 'general');
    foundry.utils.setProperty(data, 'flags.essence20.grantedBy', item.id);
    await owner.createEmbeddedDocuments('Item', [data]);
    await item.setFlag('essence20', 'granted', true);
    return T('E20.GrantGained', { name: owner.name, item: item.name, what: perk.name });
  },
};

async function pickContact(owner, item, filter = () => true) {
  const contacts = contactsOf(owner).filter(filter);
  if (!contacts.length) {
    ui.notifications.warn(T('E20.ContactNone', { name: owner.name }));
    return null;
  }

  if (contacts.length == 1) {
    return contacts[0];
  }

  const { chooseSelect } = await import("./grants.mjs");
  const picked = await chooseSelect(item.name, T('E20.ContactPick'), contacts.map(c => ({ value: c.uuid, label: c.name })));
  return picked ? contacts.find(c => c.uuid == picked) : null;
}

async function gainContactTest(owner, _item) {
  const deceptive = has(owner, CONTACT.deviousAlliance);
  const skills = ['persuasion', 'culture', 'streetwise', ...(deceptive ? ['deception'] : [])];
  const answer = await foundry.applications.api.DialogV2.wait({
    window: { title: T('E20.GainContactTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${T('E20.PetCommandSkill')}</label><select name="skill">${
      skills.map(s => `<option value="${s}">${T(CONFIG.E20.skills[s])}</option>`).join('')}</select></div>
      <div class="form-group"><label>${T('E20.GroupTestDif')}</label><input type="number" name="dif" value="12" /></div>`,
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => ({ skill: button.form.elements.skill.value, dif: Number(button.form.elements.dif.value) || 0 }) },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!answer || answer == 'cancel') {
    return null;
  }

  const { rollTest } = await import("./grants.mjs");
  const { success } = await rollTest(owner, answer.skill, answer.dif, has(owner, CONTACT.emissary) ? { edge: true } : {});
  return T(success ? 'E20.GainContactSuccess' : 'E20.GainContactFailure', { name: owner.name });
}

/**
 * The Use button for the Contact Perks.
 * @param {Item} item
 * @param {Object} economy
 */
export async function runContactUse(item, economy) {
  const kind = contactKindOf(item);
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

  return HANDLERS[kind](actor, item, pay);
}

/**
 * The Summon link on a PC's Contacts tab.
 * @param {HTMLElement} target   Carries the Contact's uuid.
 * @param {Actor} summoner
 */
export async function onSummonContact(target, summoner) {
  const contact = await fromUuid(target?.dataset?.systemActorsUuid);
  const economy = await import("./action-economy.mjs");
  const pay = async (cost) => {
    if (!game.combat) {
      return true;
    }

    const paid = await economy.spend(summoner, cost, { source: contact?.name });
    return !paid.blocked;
  };

  return summonContact(summoner, contact, { pay });
}

/** A temporary Contact (International Network) leaves at the end of the mission it was gained in. */
export function isContactAvailable(contact) {
  const temporary = contact?.flags?.essence20?.temporaryContact;
  return !temporary || temporary == getMissionEpoch();
}
