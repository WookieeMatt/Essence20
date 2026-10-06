import { rulesOf, rulesOfType } from "../../index.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { itemsOf, resolve, worldActors } from "./common.mjs";

/**
 * Group F: Reaction answerers found by lookup (rules/reactions.mjs#registerReactorLookup), not as canvas tokens.
 *
 *   who: "megaformPilot"   on a Megaform participant's item: when the row's target is a Megaform the participant is part
 *                          of, the Player Characters listing that participant on their sheet answer it (one button each,
 *                          however many of the Megaform's participants carry such a rule). They pay its cost; its steps
 *                          run as them, with the attacker as target.
 *
 * A Megaform Trait that carries no Reaction rule of its own - a homebrew Trait - answers with the rules of the book
 * Megaform Trait of the same `system.type` (TRAIT_TWINS), so a homebrew Defender works like the book one.
 */

export const TRAIT_TWINS = {
  defender: 'Compendium.essence20.across_the_stars.Item.yx7xdDN9HGoYLQ5n',
};

const WHO = 'megaformPilot';

const whoOptions = RULE_TYPES.Reaction?.params?.who?.options;
if (Array.isArray(whoOptions) && !whoOptions.includes(WHO)) {
  whoOptions.push(WHO);
}

/** A participant's megaformPilot Reaction rules: its items' own, and a twin's for a Megaform Trait with none. */
export function pilotReactionEntries(participant) {
  const own = rulesOfType(participant, 'Reaction').filter(({ rule }) => rule.who == WHO);
  const carrying = new Set(own.map(({ item }) => item));
  const twins = [];
  for (const item of itemsOf(participant)) {
    const twinUuid = item?.type == 'megaformTrait' ? TRAIT_TWINS[item.system?.type] : null;
    if (!twinUuid || carrying.has(item) || rulesOf(item).length) {
      continue;
    }

    const twinRules = resolve(twinUuid)?.system?.rules;
    (Array.isArray(twinRules) ? twinRules : []).forEach((rule, index) => {
      if (rule?.type == 'Reaction' && rule.who == WHO && !rule.disabled) {
        twins.push({ rule, item, index });
      }
    });
  }

  return [...own, ...twins];
}

/** The Player Characters listing an actor on their sheet. */
export function pilotsOf(participant) {
  return participant?.uuid ? worldActors().filter(pc => pc?.type == 'playerCharacter'
    && Object.values(pc.system?.actors ?? {}).some(entry => entry?.uuid == participant.uuid)) : [];
}

/** Who answers a megaformPilot rule for one card row. */
export function megaformPilotAnswerers(info, row) {
  const megaform = row ? resolve(row.targetUuid) : null;
  if (megaform?.type != 'megaform') {
    return [];
  }

  const out = [];
  const answered = new Set();
  for (const participant of Object.values(megaform.system?.actors ?? {}).map(entry => resolve(entry?.uuid)).filter(Boolean)) {
    const entries = pilotReactionEntries(participant);
    if (!entries.length) {
      continue;
    }

    for (const pilot of pilotsOf(participant)) {
      if (!answered.has(pilot)) {
        answered.add(pilot);
        out.push({ ...entries[0], actor: pilot, holder: participant });
      }
    }
  }

  return out;
}

// rules/reactions.mjs pulls in the react slice's card helpers, so it is loaded lazily (plain Node, and tests that mock
// those helpers, still load this file). Foundry loads it at start-up anyway (essence20.mjs).
export const lookupReady = import("../../reactions.mjs")
  .then(({ registerReactorLookup }) => registerReactorLookup(WHO, megaformPilotAnswerers))
  .catch(() => null);
