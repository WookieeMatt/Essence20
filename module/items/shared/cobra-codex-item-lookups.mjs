/**
 * Small helpers shared by the gij1 extension modules (Cobra Codex gear, Perks and Hang-Ups, plus
 * the GI Joe CRB's Asleep/Defeated Conditions).
 */

export const CC = id => `Compendium.essence20.cobra_codex.Item.${id}`;
export const GIJ = id => `Compendium.essence20.gi_joe_crb.Item.${id}`;

export const G1 = {
  // Battledress upgrades (Cobra Codex, Table 3-5, p.100-101).
  anonymous: CC('yFikSROr3NzaEoaL'),
  // General Perks (p.79-81).
  cyberneticPart: CC('wCL3rJOEDZVHVg6g'),
  // Elsewhere.
  inundation: GIJ('Q09tkHIaVX65lokl'),
  informedAccuracy: 'Compendium.essence20.tf_crb.Item.JtWhjDRI0HDewaKe',
};

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

export async function post(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
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
