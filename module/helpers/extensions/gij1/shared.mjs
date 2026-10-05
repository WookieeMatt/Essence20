import { getSceneEpoch } from "../../scene-clock.mjs";

/**
 * Small helpers shared by the gij1 extension modules (Cobra Codex gear, Perks and Hang-Ups, plus
 * the GI Joe CRB's Asleep/Defeated Conditions).
 */

export const CC = id => `Compendium.essence20.cobra_codex.Item.${id}`;
export const GIJ = id => `Compendium.essence20.gi_joe_crb.Item.${id}`;

export const G1 = {
  // Battledress upgrades (Cobra Codex, Table 3-5, p.100-101).
  adjustableFaceplate: CC('kEJP9jn7Q0LLufmG'),
  anonymous: CC('yFikSROr3NzaEoaL'),
  ceremonial: CC('vf9rJxOwuxDzrPKp'),
  uniform: CC('VkSI68BkpXLOC5ys'),
  // Weapon upgrade (p.97).
  recoilBrace: CC('2gURwr6VrgTuIRFQ'),
  // General Perks (p.79-81).
  cyberneticPart: CC('wCL3rJOEDZVHVg6g'),
  scavenger: CC('VjLTohjkJJtJPXdE'),
  seaLegs: CC('mKsSa2HBOimHqS7i'),
  // Role / Focus Perks.
  demolitionArtist: CC('QzcZLhyVvdbn09Es'),
  improviseBomb: CC('BUqXOt90M4yAsA7b'),
  extractPoison: CC('0kcuvCeRhmneAJTl'),
  primalFear: CC('xoD8fbVVqymTidNJ'),
  feedOnFear: CC('dZkRZSH5X88PrSyK'),
  letItRip: CC('dtB9EUFE45oZNAOR'),
  // Origin (Assassin, p.40).
  metier: CC('EcVOkUJE40sKSg8v'),
  assassin: CC('HCIbetyFvjJGuDcV'),
  // Elsewhere.
  weaponTraining: GIJ('rFnoQTbnYQX2tlMe'),
  inundation: GIJ('Q09tkHIaVX65lokl'),
  informedAccuracy: 'Compendium.essence20.tf_crb.Item.JtWhjDRI0HDewaKe',
};

// Troublemaker's Signature Weapon (Cobra Codex p.63) grants one of these four GI Joe CRB weapons -
// the same list Overwhelming's own item rule keys on.
export const SIGNATURE_WEAPONS = [
  GIJ('PFuzUrcYw14JRLf9'), GIJ('xthnRWfhbfXvpmZN'), GIJ('vy8VGcdoFiacJ3bT'), GIJ('Jnjio1DtAx0QgE85'),
];

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
}

export function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return items.contents ?? [...items];
}

export function findSourced(actor, uuid) {
  if (!uuid) {
    return null;
  }

  return itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null;
}

export const isFrom = uuid => item => !!uuid && sourceOf(item) == uuid;

/** An upgrade counts while it is loose on the actor or sits on something equipped. */
export function isWorn(upgrade) {
  const parentId = upgrade?.flags?.essence20?.parentId;
  return !parentId || upgrade.parent?.items?.get?.(parentId)?.system?.equipped !== false;
}

/** The actor's worn copy of an upgrade, if any. */
export function wornUpgrade(actor, uuid) {
  return itemsOf(actor).find(item => item.type == 'upgrade' && sourceOf(item) == uuid && isWorn(item)) ?? null;
}

/** The user's first targeted token's actor, if any. */
export function firstTarget() {
  const targets = game.user?.targets;
  const first = targets?.first?.() ?? (targets ? [...targets][0] : null);
  return first?.actor ?? null;
}

export async function post(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

/**
 * A stamp for "until the end of your turn". In combat it is the current turn; out of combat there
 * are no turns, so it lasts until something consumes it or the scene changes.
 */
export function turnStamp() {
  const combat = game?.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : { scene: getSceneEpoch() };
}

export function isStampActive(stamp) {
  if (!stamp) {
    return false;
  }

  const combat = game?.combat;
  if (stamp.combatId) {
    return !!combat && combat.id == stamp.combatId && combat.round == stamp.round && combat.turn == stamp.turn;
  }

  return !combat && stamp.scene == getSceneEpoch();
}

/** Whether the actor is a combatant in the current combat. */
export function inCombat(actor) {
  const combatants = game?.combat?.combatants;
  if (!combatants || !actor) {
    return false;
  }

  return [...combatants].some(c => c.actor?.id == actor.id || c.actorId == actor.id);
}

export async function actorFromUuid(uuid) {
  try {
    return uuid ? await fromUuid(uuid) : null;
  } catch (error) {
    return null;
  }
}

/** The Smarts and Social skill keys. */
export function skillsOf(essences) {
  const map = CONFIG.E20?.skillToEssence ?? {};
  return Object.keys(CONFIG.E20?.skills ?? {}).filter(skill => !essences || essences.includes(map[skill]));
}

/**
 * Ask for a skill (from a list) and a line of text. Resolves {skill, text} or null.
 */
export async function askSkillAndText(title, prompt, skills, textLabel) {
  const options = skills.map(skill => `<option value="${skill}">${foundry.utils.escapeHTML(game.i18n.localize(CONFIG.E20.skills[skill]))}</option>`).join('');
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    content: `<p>${prompt}</p><div class="form-group"><select name="skill">${options}</select></div>`
      + `<div class="form-group"><label>${textLabel}</label><input type="text" name="text"/></div>`,
    buttons: [
      {
        action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true,
        callback: (event, button) => ({ skill: button.form.elements.skill.value, text: button.form.elements.text.value.trim() }),
      },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  return result && typeof result == 'object' && result.skill ? result : null;
}
