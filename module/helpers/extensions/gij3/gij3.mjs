import {
  registerChatButton, registerPreRoll, registerRollSources, registerUse,
} from "../../extensions.mjs";
import {
  csfSource, inoperableWarning, onCsfRepairButton, onRebootButton, SOME_ASSEMBLY_REQUIRED_ID, TECHNICAL_GLITCH_ID,
  useSomeAssemblyRequired, useTechnicalGlitch,
} from "./disrupt.mjs";

/**
 * Item Review, slice gij3 - G.I. Joe Perks, Hang-Ups and an Alteration from the Core Rulebook,
 * Factions in Action 1 & 2, Hawk's Personnel Files, the Sgt Slaughter Sourcebook and the
 * Quartermaster's Guide to Gear. Every rule is quoted where it's implemented.
 *
 * Situational qualifiers the system can't read ("in polite society", "people you haven't met
 * before", "works toward your Syndicate's endgame") are Roll Options Dialog switches, off by
 * default, shown only on the rolls they can apply to - the player (or the GM watching) flips them
 * when the situation holds. Everything with a cost or a choice is a Use button on the item.
 *
 * The roll-internal rule Better than the Best is in dice-hooks.mjs, called from dice.mjs via
 * SCRATCH/integration/gij3-patch.cjs (Seconds Between Click & Boom's miss clause and Takedown Expert's
 * choice are rules on their pack items). Equipment disruption is disrupt.mjs.
 */

const U = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const G3 = {
  touchMove: U('gi_joe_crb', 'wv5vpbiCZXiwTpdm'),
  technicalGlitch: TECHNICAL_GLITCH_ID,
  someAssemblyRequired: SOME_ASSEMBLY_REQUIRED_ID,
};

// Junker and Targeting Eye are item rules (rules/conv7-slC7.test.js); so are Pillage and Dreadnok Recruit
// (rules/conv9-slC9.test.js), and Early Adopter, Field Trials and Peak Performance (rules/conv10-slE10.test.js).

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));
const escape = text => foundry.utils.escapeHTML(String(text ?? ''));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

function listOf(collection) {
  if (Array.isArray(collection?.contents)) {
    return collection.contents;
  }

  if (Array.isArray(collection)) {
    return collection;
  }

  return collection && typeof collection[Symbol.iterator] == 'function' ? [...collection] : [];
}

export function findSourced(actor, id) {
  return id ? listOf(actor?.items).find(item => sourceOf(item) == id) ?? null : null;
}

const has = (actor, id) => !!findSourced(actor, id);
// Pillage's two-handed switch (rules/conv9-slC9.test.js), Subtle Snake's select and Second Skin's asked
// substitution (rules/conv10-slC10.test.js) are item rules.

/* -------------------------------------------- */
/*  Automatic roll sources                       */
/* -------------------------------------------- */

export function gij3RollSources(actor, target, ctx = {}) {
  const sources = [];
  const consumes = [];

  // Complete System Failure - disrupt.mjs.
  const csf = csfSource(actor, ctx);
  if (csf) {
    sources.push(csf);
  }

  return { sources, consumes };
}

/* -------------------------------------------- */
/*  Before the roll                              */
/* -------------------------------------------- */

export async function gij3PreRoll(actor, dataset, item) {
  inoperableWarning(actor, dataset, item);
}

// (The Sound of Angels is an afterRoll Trigger on its Perk - rules/conv10-slD10.test.js.)

/**
 * Touch Move (GI Joe CRB, Grandmaster, 6th level, p.87): "when you roll Initiative, all of your
 * teammates who aren't surprised can immediately make a Move Action." Nothing in the action economy
 * can hand out an action before the first turn, so the active GM posts who may move, the moment the
 * holder's Initiative lands.
 */
const touchMovePosted = new Set();
export async function onTouchMoveInitiative(combatant, changes) {
  if (!game.users?.activeGM?.isSelf || changes?.initiative == null || !has(combatant?.actor, G3.touchMove)) {
    return;
  }

  const key = `${combatant.parent?.id}.${combatant.id}`;
  if (touchMovePosted.has(key)) {
    return;
  }

  touchMovePosted.add(key);
  const holder = combatant.actor;
  const disposition = combatant.token?.disposition;
  const allies = listOf(combatant.parent?.combatants).map(other => other.actor)
    .filter(other => other && other.id != holder.id && !other.statuses?.has?.('surprised'))
    .filter(other => {
      const token = listOf(combatant.parent?.combatants).find(c => c.actor?.id == other.id)?.token;
      return disposition != null && token?.disposition != null ? token.disposition == disposition : other.type == 'playerCharacter';
    });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: holder }),
    content: T('Gij3TouchMoveChat', {
      name: escape(holder.name),
      perk: escape(findSourced(holder, G3.touchMove).name),
      allies: escape(allies.map(a => a.name).join(', ') || T('Gij3Nobody')),
    }),
  });
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

export const USES = [
  {
    id: 'gij3TechnicalGlitch',
    matches: item => sourceOf(item) == G3.technicalGlitch,
    run: (item, economy, pay) => useTechnicalGlitch(item, pay),
  },
  {
    id: 'gij3SomeAssemblyRequired',
    matches: item => sourceOf(item) == G3.someAssemblyRequired,
    canUse: () => !game.combat,
    run: item => useSomeAssemblyRequired(item),
  },
];

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

/** Takedown Expert's "silenced" - no such Condition in the system before this. */
export function addSilencedStatus() {
  const list = CONFIG?.statusEffects;
  if (Array.isArray(list) && !list.some(effect => effect.id == 'silenced')) {
    list.push({ id: 'silenced', name: 'E20.Gij3StatusSilenced', img: 'icons/svg/silenced.svg', changes: [] });
  }
}

registerRollSources(gij3RollSources);
registerPreRoll(gij3PreRoll);
registerChatButton('gij3Reboot', onRebootButton);
registerChatButton('gij3CsfRepair', onCsfRepairButton);
USES.forEach(use => registerUse(use));

if (typeof Hooks != 'undefined') {
  Hooks.once('setup', () => {
    addSilencedStatus();
  });
  Hooks.on('updateCombatant', (combatant, changes) => {
    onTouchMoveInitiative(combatant, changes).catch(error => console.error('Essence20 | Touch Move', error));
  });
}
