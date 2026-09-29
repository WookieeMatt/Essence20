/**
 * Shared bits for the tf2 slice (Transformers: Technorganic Secrets, The Enigma of Combination and
 * the TF Core Rulebook): compendium ids, item identity, and small helpers. Light module - imports
 * nothing heavy (see the extension registry's import-cycle rule).
 */
import { worldActors } from "../../companion-link.mjs";

const C = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

export const TF2 = {
  // Technorganic Secrets
  mutantBeast: C('technorganic_secrets', 'gkcyg7KWih6QAZlq'),
  mutantBeastPerk: C('technorganic_secrets', 'R85uJNpYbXd9C9Eh'),
  lingeringSideEffects: C('technorganic_secrets', 'jDRfmpsy1ElT2Kkn'),
  // The Enigma of Combination
  arrogant: C('enigma_of_combination', 'duMjTyfREHYmDFJs'),
  charger: C('enigma_of_combination', 'QNhq3rRVOu1EfeyD'),
  dominantThought: C('enigma_of_combination', 'aHgTDkCIBHjBnt0L'),
  notLikeThat: C('enigma_of_combination', 'OrK3XyNIyJcorMxp'),
  obscuringMatrixBasic: C('enigma_of_combination', 'L8ZXz1h0DlCy85UC'),
  obscuringMatrixAdvanced: C('enigma_of_combination', 'HH4q8lx09mV2hhcv'),
  pillarExtended: C('enigma_of_combination', 'j0CJWQ858tbQvVUs'),
  pillarLong: C('enigma_of_combination', 'SroTzxuu57HoaN9V'),
  rollerDrum: C('enigma_of_combination', 'Hjo7mZ7eLs8EwKeu'),
  scrambleModulator: C('enigma_of_combination', '5o2qpfqpwRPeUBPA'),
  speakerAerial: C('enigma_of_combination', 'ilL3CyLQDydjxBHf'),
  speakerGround: C('enigma_of_combination', 'GPW2T5OEC0KtlJpX'),
  speakerLongAerial: C('enigma_of_combination', 'wwFXrMqJd0YJHqkX'),
  speakerLongGround: C('enigma_of_combination', '48zFIrJCoULshGtm'),
  supportingCast: C('enigma_of_combination', 'GjHqKI3n7lLp3lVn'),
  sustainedBeam: C('enigma_of_combination', 'BIlS9uwDfZquX9hf'),
  weAreOne: C('enigma_of_combination', '1MtovibPOMw9O2hP'),
  // Transformers Core Rulebook
  acuteSense: C('tf_crb', 'rl8hs6ezb6VSDahM'),
  allOutAttack: C('tf_crb', 'OCQ8ZuC793JHQ4YU'),
  appliedScience: C('tf_crb', 'qjDBmRlTNvuJxyum'),
  broadUnderstanding: C('tf_crb', '7BZXi4zvS6GAhGOY'),
  bullbar: C('tf_crb', '4Wfhy9VD0mMGgJbx'),
  cage: C('tf_crb', 'w1E74WXrvwQJlS1Q'),
  caterpillarTread: C('tf_crb', 'pi0wUVrd4tb1emod'),
  deconstruct: C('tf_crb', '7tc7EWwKSFQ76tly'),
  determineProbability: C('tf_crb', 'RK9cboEVTiJKdjbN'),
  distressed: C('tf_crb', 'sYz93Ud4qoob9PsA'),
  diversion: C('tf_crb', 'LDi9BUkXFtaCSoTe'),
  dukeItOut: C('tf_crb', 'jkuNDvRt4D9jyDsn'),
  dustUp: C('tf_crb', '7aKjiqEZ3LYuvwmu'),
  earthspoiled: C('tf_crb', 'L2oBtS3KAwncY2xY'),
  electroDisruptor: C('tf_crb', 'Boj0xRCCDi1dpoQe'),
  energonBank: C('tf_crb', 'W87huLqKeOCJJ66L'),
  evasiveFighting: C('tf_crb', 'fQJF7zvHjd39qw99'),
  extraCrewCapacity: C('tf_crb', 'PCwgQWKmTOl8va3I'),
  flexibleDirectives: C('tf_crb', 'YCLo0a3kpBeB67HW'),
  forTheAllspark: C('tf_crb', 'UMlH70vmM3kJzWvS'),
  ram: C('tf_crb', 'AVVUjFaqNYhl5q4m'),
  flyby: C('tf_crb', '3L0eAnm4GVoQi7Df'),
  // Special-attack weapons the Decepticon Directive / Technorganic Secrets Alt Modes print.
  spikedRam: C('decepticon_directive', 'leQVbl8vdpkwiCdw'),
  miniVehicleRam: C('decepticon_directive', 'WrSVycvwI2mlmp2y'),
  naturalWeapon: C('technorganic_secrets', 'uAW0sOmaPXl8DaX8'),
  floraWeapon: C('technorganic_secrets', 'au05ekMECrDqVlkm'),
  naturalFlyby: C('technorganic_secrets', 'IJTQr6XGgmfxDPoY'),
  smash: C('technorganic_secrets', 'e2LbSl8llOCJ2I6o'),
  unarmedCombat: C('tf_crb', 'OU9rXvoKfXtcpvFy'),
  // The G.I. JOE printings of All Out Attack / Evasive Fighting, already wired in target-riders.mjs.
  gijAllOutAttack: C('gi_joe_crb', 'Rhz1k6gTl2XTs8Nk'),
  gijEvasiveFighting: C('gi_joe_crb', 'tBXpROuVSuAxGZpR'),
  gijAcuteSense: C('gi_joe_crb', 'WvjGJ5AcC0z07d0J'),
};

/** Alt Modes by chassis, as compendium uuids (the special-attack table and Bestial Articulation). */
export const ALT_MODES = {
  // Transformers Core Rulebook: every vehicle chassis prints Ram (the Monolith's hits for 2), the Seeker Flyby.
  crbRam: ['IFssZkdjKb6vcYfk', '5sxhsXAHh97KTpwa', 'FlN4FCnbTP7RRz8K', 'ZS3kX8oKogmsH6OK', 'NaF9feAfujLYwDfO', 'WYlv5KoOv8WTUtKN',
    'OlLBvRl06PVw9OQx', 'hr00Kzgshnz67400'].map(id => C('tf_crb', id)),
  monolith: C('tf_crb', '62Su4NGv4ejOIvLv'),
  seeker: C('tf_crb', 'RXTZuPJnnAlkgHX2'),
  // The Decepticon Directive
  salvaged: C('decepticon_directive', 'cGGEXSdCI170AaM4'),
  miniVehicle: ['oSn5EyMwso8Z1Ohh', 'JVIOxmSpPwPQDY1z'].map(id => C('decepticon_directive', id)),
  // Technorganic Secrets: the chassis whose Natural Weapon is Might, 1 Blunt or Sharp, Maneuver alternate.
  natural: ['w8BzKEttZEoz5nz7', 'dEacdn0EEQJ2ZB2f', 'vgN6uRrRCJ7fKO1z', 'aTevGfLML1dlbErs', '2mSP6mVx0axvOlXf', 'RsTuLWH6FrWHcVeF',
    'ycX3lh5ZqNkyFw0e', 'wCu6HyM9dWB1XpV4', 'P17ah6xfjqjqzcmU', 'hs2BII8uOIk7wgpJ', 'Kj8DtQoNrUf2dmI5', 'yeeGDdU2LDKyNhBd',
    '5TrH7WOOUnEi6vDt', 'HdGY7qG1aJE69N2P', 'fO2tbcFJOmvlxOXh', 'hsY5k4vCyBw1Xs8W', 'wrG4V7yi5wHnQMbL', 'Y2WR7POqwxnoXzwh',
    'LwiC3DmOCm1jNbmY', '696g72VgjR2kzwXO'].map(id => C('technorganic_secrets', id)),
  climber: ['A1zJJJOvCKzxzdI0', 'y91e1C5LXS2vviUQ'].map(id => C('technorganic_secrets', id)),
  flora: ['gah8pRWSMDvXsUax', 'TfIrQViYdkBkqR7q'].map(id => C('technorganic_secrets', id)),
  flyer: ['z0DXIKiccQbcT7cQ', '8M5milnnYu2fyJnr'].map(id => C('technorganic_secrets', id)),
  behemoth: ['hF2rJtS3SzcjqnLr', 'qZQyZDntWJdNeDQy'].map(id => C('technorganic_secrets', id)),
  // Monstrosity, both printings (Decepticon Directive p.37, Technorganic Secrets p.41): Natural Weapon
  // plus Bestial Articulation.
  monstrosity: [
    ...['IW0xRwpT2RU6Eyso', 'CeAcrZMp5T9ZhuzO', 'isx1XflgpBp18ND0', 'rz9Kdesd5C7RBhtm', 'rtQAraNbxCoIplbH', 'ula8VtBnEtz8y4jS']
      .map(id => C('decepticon_directive', id)),
    ...['8eySZa8oyATSLALr', 'hRTGCxvA7dI4dSAS', '7WsWk1gEk9q9Z29k', 'UriqxySzFuQBK01d', 'KL3FeHBqAIZ66BgQ', 'Rk3mT9vQx2LpW7nZ']
      .map(id => C('technorganic_secrets', id)),
  ],
};

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? null;

export function itemsOf(actor) {
  const items = actor?.items;
  if (Array.isArray(items?.contents)) {
    return items.contents;
  }

  if (Array.isArray(items)) {
    return items;
  }

  return items && typeof items[Symbol.iterator] == 'function' ? [...items] : [];
}

/** The actor's first item copied from this compendium entry. */
export function itemOf(actor, uuid) {
  return uuid ? itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null : null;
}

export const has = (actor, uuid) => !!itemOf(actor, uuid);

/** An item's name, or a fallback, for labels. */
export const nameOf = (actor, uuid, fallback) => itemOf(actor, uuid)?.name ?? fallback;

/** A weaponEffect's parent weapon, if it has one. */
export function parentWeaponOf(actor, item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? itemsOf(actor).find(other => other.id == parentId) ?? null : null;
}

/** The upgrades of one compendium entry attached to this weapon. */
export function upgradesOn(actor, weapon, uuid) {
  if (!weapon) {
    return [];
  }

  return itemsOf(actor).filter(item => item.type == 'upgrade' && item.flags?.essence20?.parentId == weapon.id && sourceOf(item) == uuid);
}

/** The first targeted token's actor. */
export function targetedActor() {
  const targets = globalThis.game?.user?.targets;
  const first = targets?.first?.() ?? (targets ? [...targets][0] : null);
  return first?.actor ?? null;
}

export function targetedActors() {
  return [...(globalThis.game?.user?.targets ?? [])].map(token => token.actor).filter(Boolean);
}

/** A chat line spoken by the actor. */
export async function say(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

/** Distance between two actors' tokens in feet, or null when either isn't on the canvas. */
export function feetBetween(a, b) {
  const ta = a?.getActiveTokens?.()?.[0];
  const tb = b?.getActiveTokens?.()?.[0];
  if (!ta || !tb || !globalThis.canvas?.grid?.measurePath) {
    return null;
  }

  return canvas.grid.measurePath([ta.center, tb.center]).distance;
}

/** Whether it is this actor's turn in the active combat. */
export function isOwnTurn(actor) {
  const combat = globalThis.game?.combat;
  return !!combat && combat.combatant?.actor?.id == actor?.id;
}

/** Write to an actor this user may not own, through the GM when needed. */
export async function writeActor(actor, method, args) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(actor)) {
    return relayToGm(actor, method, args);
  }

  return actor[method](...args);
}

/** The Defense total, or null. */
export const defenseOf = (actor, defense) => {
  const value = Number(actor?.system?.defenses?.[defense]?.total);
  return Number.isFinite(value) ? value : null;
};

/** Whether the one client that should do an automatic write is this one (active GM, else owner). */
export function isResponsible(doc) {
  const gm = globalThis.game?.users?.activeGM;
  if (gm) {
    return !!gm.isSelf;
  }

  return !!doc?.isOwner;
}

export { worldActors };
