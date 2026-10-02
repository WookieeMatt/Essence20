/**
 * Shared bits for the Decepticon Directive / Technorganic Secrets slice (tf1): item ids, lookups,
 * and the small "apply a Condition / offer a damage button / roll a skill vs a Defense" helpers the
 * Use buttons below share. Light imports only - anything heavy is imported inside a function.
 */

const dd = id => `Compendium.essence20.decepticon_directive.Item.${id}`;

export const TF1 = {
  altModeMimicry: dd('ARtFFscnVBo183hV'),
  brutalDisplay: dd('11Q2KXJ7qxlddusg'),
  collectionOfSecrets: dd('61XIiQPoIhycqgA2'),
  commsAssault: dd('pKArYQ259zpdsR7o'),
  commsProbe: dd('kcU17jzso2caxVJ1'),
  drone: dd('ZdvE8MB35jg1A8wK'),
  easyInEasyOut: dd('N36G5U8c8HSX3e9c'),
  eideticBuffer: dd('DlyxYU8RfDeSmS1q'),
  falseData: dd('Xo62YAhi8lULOZpR'),
  fearsomeAdditions: dd('jh4FiaiLPb40jqkv'),
  fearsomeVoice: dd('ZQl2qzyBNHUYYHS5'),
  feedbackField: dd('P7dmKCP99DAYqptj'),
  flexibleSwitch: dd('pTHenJt0kG3umsUk'),
  focusedBlast: dd('zu38NCr99BFPgEBJ'),
  loadedQuestions: dd('nkqk7AfXUJkigqbq'),
  makeAnExample: dd('mroTcYJKFpAAiqP5'),
  mine: dd('7NGQHft6V1wAfGPw'),
  myAlliesAreMyShield: dd('pralmStmjjgVLatX'),
  partnered: dd('6I4IIvDP3SOCJ5cR'),
  pickingUpTheTrail: dd('lE4u6aGvWm86L6hY'),
  showRespect: dd('oowLckrIBcn1Zff3'),
  solidStateEnergon: dd('aUxtcuKUb40JYoqx'),
  steadyFirepower: dd('svqVyP2tyYzSUtn6'),
  storageCompartments: dd('NnHqdvBfYNq7J0l2'),
  targetRichEnvironment: dd('BF1fKwzQQb1LFKGP'),
  theyCalledItAGlitch: dd('IKPWMfs5ZSp6ijiv'),
  toxEn: dd('uJRbkLx1BiXNpo3p'),
  favoriteWeapon: dd('emaXxo2XzoHMoNCe'),
  // Transformers CRB: Disappear (Scout Cybertronian Perk) and Alt Mode Mastery (Modemaster, 10th).
  disappear: 'Compendium.essence20.tf_crb.Item.aD6N6hTvFhsQFZnB',
};

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
}

export function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return Array.isArray(items.contents) ? items.contents : (typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

export const itemOf = (actor, uuid) => (uuid ? itemsOf(actor).find(i => sourceOf(i) == uuid) ?? null : null);
export const has = (actor, uuid) => !!itemOf(actor, uuid);
export const nameOf = (actor, uuid, fallback) => itemOf(actor, uuid)?.name ?? fallback;

export function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export async function say(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${content}</p>` });
}

export function tokenOf(actor) {
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

export function feetBetween(a, b) {
  if (!a || !b || !canvas?.grid) {
    return Infinity;
  }

  return canvas.grid.measurePath([a.center, b.center]).distance;
}

/** Tokens (other than `center` itself) within `radius` feet of a token, optionally filtered. */
export function tokensNear(center, radius, filter = () => true) {
  if (!center || !canvas?.tokens) {
    return [];
  }

  return canvas.tokens.placeables.filter(t => t !== center && t.actor && feetBetween(t, center) <= radius && filter(t));
}

export function firstTarget() {
  return game.user?.targets?.first?.() ?? [...(game.user?.targets ?? [])][0] ?? null;
}

export function isDefeated(actor) {
  return !!actor?.statuses?.has?.('defeated') || (Number(actor?.system?.health?.value) <= 0 && actor?.system?.health?.max > 0);
}

export async function spendEnergon(actor, amount = 1) {
  const value = Number(actor?.system?.energon?.normal?.value) || 0;
  if (value < amount) {
    ui.notifications.warn(T('Tf1NoEnergon', { name: actor.name }));
    return false;
  }

  await actor.update({ 'system.energon.normal.value': value - amount });
  return true;
}

/** A Condition on someone else, relayed through the GM when the user can't write to them. */
export async function applyCondition(target, status, rounds = 0) {
  if (!target) {
    return;
  }

  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(target)) {
    await relayToGm(target, 'toggleStatusEffect', [status, { active: true }]);
    return;
  }

  const { applyTimedCondition } = await import("../../timed-status.mjs");
  await applyTimedCondition(target, status, rounds);
}

/** A chat button that applies damage to one creature when clicked (the GM usually does). */
export function damageButton(target, value, type) {
  const label = T('Tf1ApplyDamage', { name: foundry.utils.escapeHTML?.(target.name) ?? target.name, value, type: game.i18n.localize(CONFIG.E20?.damageTypes?.[type] ?? type) });
  return `<button type="button" data-e20-ext="tf1Damage" data-uuid="${target.uuid}" data-value="${value}" data-type="${type}">${label}</button>`;
}

export async function onDamageButton(message, button) {
  const target = await fromUuid(button.dataset.uuid);
  if (!target) {
    return;
  }

  if (!target.isOwner) {
    ui.notifications.warn(T('Tf1GmApplies'));
    return;
  }

  const { applyDamage } = await import("../../combat.mjs");
  await applyDamage(target, Number(button.dataset.value) || 0, button.dataset.type);
  button.disabled = true;
}

/**
 * Target these tokens and roll a Skill against each one's Defense. The riderSpec kind comes back in
 * registerPostRoll as rider.spec.kind.
 */
export async function rollAgainst(actor, tokens, { skill, defenseType, kind, extra = {} }) {
  canvas?.tokens?.setTargets?.(tokens.map(t => t.id));
  const essence = CONFIG.E20?.skillToEssence?.[skill] ?? 'strength';
  return actor._dice?.rollSkill({
    skill, essence, shiftUp: 0, shiftDown: 0, defenseType, riderSpec: JSON.stringify({ kind, ...extra }),
  }, actor);
}

export async function chooseButtons(title, prompt, choices) {
  const grants = await import("../../grants.mjs");
  return grants.chooseButtons(title, prompt, choices);
}

export async function chooseSelect(title, prompt, options) {
  const grants = await import("../../grants.mjs");
  return grants.chooseSelect(title, prompt, options);
}

export async function rollTest(actor, skill, dif) {
  const grants = await import("../../grants.mjs");
  return grants.rollTest(actor, skill, dif);
}

/** The Favorite Weapon Perk's chosen weapon (helpers/favorite-weapon.mjs keeps it on system.choice). */
export function favoriteWeaponOf(actor) {
  const perk = itemOf(actor, TF1.favoriteWeapon);
  const choice = perk?.system?.choice;
  return choice ? actor.items?.get?.(choice) ?? null : null;
}

/** The weapon a weaponEffect belongs to. */
export function weaponOfEffect(actor, effect) {
  const parentId = effect?.flags?.essence20?.parentId;
  return parentId ? actor?.items?.get?.(parentId) ?? null : null;
}

export function combatStamp() {
  const combat = game?.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : null;
}
