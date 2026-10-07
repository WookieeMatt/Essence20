import { getShiftedSkill } from "../../util/utils.mjs";
import { addSpecialization, deleteSpecialization } from "../../sheet-handlers/specialization-handler.mjs";

/**
 * A Focus's Essence increase comes with a Skill rank (user decision 2026-10-07). At 1st and again at 10th level the
 * Focus raises an Essence by 1, and the point it brings must go into one of the Focus's Skills: "Train or specialize
 * in one of these Skills when your Focus gives you an Essence Increase" (TF CRB and most G.I. JOE books), "any one
 * Skill tied to the Essence Score you increased" when the Focus lists none (Cyber Engineer, Mimic), or "must go into
 * Alertness or a Specialization in that skill" in the G.I. JOE Core Rulebook's Focus Perks.
 *
 * Each increase asks once: train a listed Skill (one step up) or, where the book allows, specialize in one. The pick is
 * kept on the Focus (flags.essence20.focusSkillPicks.<levelN>), so a level drop below that level, or deleting the
 * Focus, takes exactly that rank or Specialization back off. A cancelled pick places nothing - the point can still be
 * placed by hand in the Skill Picker.
 */

const FLAG = 'focusSkillPicks';

/**
 * G.I. JOE Core Rulebook Foci: each Focus Perk words its increase itself, and only these four allow a Specialization
 * (Alert, Ordnance Expert, and the Mechanized Infantry and Medic increases); null = any Specialization of the Skill.
 * Every other book prints "Train or specialize".
 */
const GIJ_CRB_SPECIALIZE = {
  Bodyguard: null,
  'Heavy Ordnance': 'Heavy Weapons',
  'Mechanized Infantry': null,
  Medic: 'Medicine',
};
const GIJ_CRB_PACK = 'gi_joe_crb';

/** Skills that take no Specialization here (Conditioning is a plain number, not a die). */
const NO_SPECIALIZATION = new Set(['conditioning']);

/** The Focus's compendium pack name, from its source uuid. */
function packOf(focus) {
  const source = focus?._stats?.compendiumSource ?? focus?.flags?.core?.sourceId ?? '';
  return /^Compendium\.essence20\.([^.]+)\./.exec(source)?.[1] ?? null;
}

/**
 * Whether this Focus's increase may go into a Specialization, and the one it names (null: any name).
 * @returns {{allowed: Boolean, name: (String|null)}}
 */
export function specializationRule(focus) {
  if (packOf(focus) != GIJ_CRB_PACK) {
    return { allowed: true, name: null };
  }

  return focus?.name in GIJ_CRB_SPECIALIZE ? { allowed: true, name: GIJ_CRB_SPECIALIZE[focus.name] } : { allowed: false, name: null };
}

/**
 * The Skills an increase in `essence` may go into: the Focus's listed Skills (only the chosen Essence's, when the
 * Focus offers more than one Essence), or every Skill of that Essence when it lists none.
 * @param {Item} focus
 * @param {String} essence
 * @param {Object} [skillToEssence]   CONFIG.E20.skillToEssence.
 * @returns {Array<String>}
 */
export function focusSkillOptions(focus, essence, skillToEssence = globalThis.CONFIG?.E20?.skillToEssence ?? {}) {
  const listed = (focus?.system?.skills ?? []).filter(Boolean);
  if (!listed.length) {
    return Object.keys(skillToEssence).filter(skill => skillToEssence[skill] == essence);
  }

  // A single-Essence Focus keeps its whole list: a Focus may count a Skill under its Essence (Presence: Intimidation
  // is a Social Skill for that Focus), which a lookup by the Skill's usual Essence would drop.
  if ((focus?.system?.essences ?? []).length <= 1) {
    return listed;
  }

  const ofEssence = listed.filter(skill => skillToEssence[skill] == essence);
  return ofEssence.length ? ofEssence : listed;
}

/** The essenceLevels entries ("level1", "level10") that fall in (from, to], as numbers. */
export function increaseLevels(focus, from, to) {
  return (focus?.system?.essenceLevels ?? [])
    .map(level => Number(String(level).replace(/[^0-9]/g, '')))
    .filter(level => level > from && level <= to)
    .sort((a, b) => a - b);
}

/** The picks stored on the Focus, by "levelN". */
export function storedPicks(focus) {
  return { ...(focus?.flags?.essence20?.[FLAG] ?? {}) };
}

/**
 * Ask which Skill takes this increase. Resolves {kind: 'train'|'specialize', skill, name?} or null when cancelled.
 * @param {Actor} actor
 * @param {Item} focus
 * @param {Number} level
 * @param {Array<String>} skills
 * @param {{allowed: Boolean, name: (String|null)}} specialize
 */
export async function askFocusSkill(actor, focus, level, skills, specialize) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (typeof DialogV2?.wait != 'function' || !skills.length) {
    return null;
  }

  const label = skill => globalThis.CONFIG?.E20?.skills?.[skill] ?? skill;
  const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  const options = skills.flatMap(skill => [
    `<option value="train:${skill}">${T('E20.FocusSkillTrain', { skill: label(skill) })}</option>`,
    ...(specialize.allowed && !NO_SPECIALIZATION.has(skill)
      ? [`<option value="specialize:${skill}">${T('E20.FocusSkillSpecialize', { skill: label(skill) })}</option>`] : []),
  ]).join('');
  const nameField = specialize.allowed
    ? `<div class="form-group"><label>${T('E20.FocusSkillSpecializationName')}</label>`
      + `<input type="text" name="specName" value="${specialize.name ?? ''}" ${specialize.name ? 'readonly' : ''}`
      + ` placeholder="${T('E20.FocusSkillSpecializationHint')}"></div>` : '';

  const result = await DialogV2.wait({
    window: { title: T('E20.FocusSkillTitle', { focus: focus.name }) },
    classes: ['essence20', 'theme-wrapper', 'e20-window'],
    content: `<p>${T('E20.FocusSkillPrompt', { focus: focus.name, level })}</p>`
      + `<div class="form-group"><select name="pick">${options}</select></div>${nameField}`,
    buttons: [
      {
        action: 'ok', label: T('E20.FocusSkillPlace'), default: true,
        callback: (event, button) => ({ pick: button.form.elements.pick.value, specName: button.form.elements.specName?.value ?? '' }),
      },
      { action: 'cancel', label: T('E20.FocusSkillLater') },
    ],
    rejectClose: false,
  });

  if (!result?.pick) {
    return null;
  }

  const [kind, skill] = result.pick.split(':');
  if (kind == 'specialize') {
    const name = (specialize.name ?? result.specName ?? '').trim();
    return name ? { kind, skill, name } : null;
  }

  return { kind: 'train', skill };
}

/** Put one pick on the actor. Returns the record to keep (with the Specialization's key), or null. */
async function placePick(actor, pick) {
  if (pick.kind == 'train') {
    const [newShift, path] = getShiftedSkill(pick.skill, 1, actor);
    await actor.update({ [path]: newShift });
    return pick;
  }

  const before = new Set(Object.keys(actor.system.skills?.[pick.skill]?.specializations ?? {}));
  await addSpecialization(actor, pick.skill, pick.name);
  const key = Object.keys(actor.system.skills?.[pick.skill]?.specializations ?? {}).find(entry => !before.has(entry));
  return key ? { ...pick, key } : null;
}

/** Take one stored pick back off the actor. */
async function removePick(actor, pick) {
  if (pick?.kind == 'train' && pick.skill) {
    const [newShift, path] = getShiftedSkill(pick.skill, -1, actor);
    await actor.update({ [path]: newShift });
  } else if (pick?.kind == 'specialize' && pick.key) {
    await deleteSpecialization(actor, pick.skill, pick.key);
  }
}

/**
 * After a Focus's Essence increases are applied (drop or level change): ask for each increase gained, and take back the
 * picks of increases lost. From role-handler.mjs#_setFocusValues.
 * @param {Actor} actor
 * @param {Item} focus          The actor's own Focus.
 * @param {Number} newLevel
 * @param {Number} previousLevel   0 on the drop.
 * @param {Object} [options]
 * @param {Function} [options.ask]   The prompt (tests pass their own).
 */
export async function syncFocusSkillPicks(actor, focus, newLevel, previousLevel, { ask = askFocusSkill } = {}) {
  const essence = actor?.system?.focusEssence;
  if (!essence || !focus?.update) {
    return;
  }

  const picks = storedPicks(focus);
  if (newLevel < previousLevel) {
    for (const level of increaseLevels(focus, newLevel, previousLevel)) {
      if (!picks[`level${level}`]) {
        continue;
      }

      await removePick(actor, picks[`level${level}`]);
      // A plain key with ForcedDeletion removes it (the "-=" form is deprecated in v14).
      const Deletion = globalThis.foundry?.data?.operators?.ForcedDeletion;
      await focus.update({ [`flags.essence20.${FLAG}.level${level}`]: Deletion ? new Deletion() : null });
    }

    return;
  }

  const skills = focusSkillOptions(focus, essence);
  const specialize = specializationRule(focus);
  for (const level of increaseLevels(focus, previousLevel, newLevel)) {
    if (picks[`level${level}`]) {
      continue;
    }

    const pick = await ask(actor, focus, level, skills, specialize);
    const placed = pick ? await placePick(actor, pick) : null;
    if (placed) {
      picks[`level${level}`] = placed;
      await focus.update({ [`flags.essence20.${FLAG}.level${level}`]: placed });
    } else {
      globalThis.ui?.notifications?.info(game.i18n.format('E20.FocusSkillSkipped', { focus: focus.name }));
    }
  }
}

/** Deleting the Focus takes every rank or Specialization its increases placed back off. From onFocusDelete. */
export async function removeFocusSkillPicks(actor, focus) {
  for (const pick of Object.values(storedPicks(focus))) {
    await removePick(actor, pick);
  }
}
