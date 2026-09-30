import { registerChatButton, registerDerived, registerRest, registerUse } from "../../extensions.mjs";
import { DD, DSOE, T, addToDefense, firstTarget, isFrom, itemsOf, post, sourceOf } from "./shared.mjs";

/**
 * Decepticon Directive (Armor Matrix's one-matrix limit; the Champion His Way, Distill His Essence
 * and Eat the Weak Rites of the All-Consuming) and Dark Skies over Equestria (Multimorph).
 */
export const O1_MORE = {
  armorMatrixLight: DD('z3Nb6mrcAZ1c8R3q'),
  armorMatrixMedium: DD('COIQnaWsN7JorDuv'),
  armorMatrixHeavy: DD('Gha7PEUJKSOmLnIx'),
  championHisWay: DD('j9FW3wF6mKnVFj0s'),
  distillHisEssence: DD('QKJ19OgpdHNXUBQy'),
  eatTheWeak: DD('hzCEZfTNDsQcOjUB'),
  addictedDarkEnergon: DD('e3c7wuCA7JQS7rTA'),
  multimorph: DSOE('HGKHAbwZ43I564vd'),
};

// A second copy of each Rite was briefly in the compendium (since removed); a character who took
// one of those still matches.
const RITE_COPIES = {
  championHisWay: [O1_MORE.championHisWay, DD('0SqZMH14YFCxrnGa')],
  distillHisEssence: [O1_MORE.distillHisEssence, DD('VT906hPZfbHx7vYK')],
  eatTheWeak: [O1_MORE.eatTheWeak, DD('kIeIcRQVWg4v9CZL')],
};
const isRite = key => item => RITE_COPIES[key].includes(sourceOf(item));
const hasRite = (actor, key) => itemsOf(actor).some(isRite(key));

/* -------------------------------------------- */
/*  Armor Matrix                                 */
/* -------------------------------------------- */

// Armor Matrix (Decepticon Directive, p.75): "An armor matrix is installed in one Integrated
// Hardpoint, and a character can benefit from only one armor matrix." A second one can't be added,
// and if an actor already carries two, only the best one's Toughness counts.
const MATRICES = [O1_MORE.armorMatrixLight, O1_MORE.armorMatrixMedium, O1_MORE.armorMatrixHeavy];
export const isArmorMatrix = item => item?.type == 'upgrade' && (MATRICES.includes(sourceOf(item)) || /^armor matrix\b/i.test(String(item?.name ?? '')));

Hooks.on('preCreateItem', (item) => {
  const actor = item.parent;
  if (!actor || !isArmorMatrix(item) || item.flags?.essence20?.parentId) {
    return true;
  }

  if (itemsOf(actor).some(other => isArmorMatrix(other) && !other.flags?.essence20?.parentId)) {
    ui.notifications?.warn?.(T('O1ArmorMatrixOne', { name: actor.name }));
    return false;
  }

  return true;
});

/** The Toughness the extra matrices add beyond the best one (what derived data takes back off). */
export function extraMatrixToughness(actor) {
  if (!actor?.system?.canTransform) {
    return 0;
  }

  const values = itemsOf(actor)
    .filter(item => isArmorMatrix(item) && !item.flags?.essence20?.parentId && item.system?.armorBonus?.defense == 'toughness')
    .map(item => Number(item.system.armorBonus.value) || 0)
    .sort((a, b) => b - a);
  return values.slice(1).reduce((sum, value) => sum + value, 0);
}

/* -------------------------------------------- */
/*  Rites of the All-Consuming                   */
/* -------------------------------------------- */

// Rites of the All-Consuming (Decepticon Directive, p.111): "For every Skill Rank in the Culture
// skill, a Follower with the Word of Unicron General Perk... gains the Rite associated with the die
// of that Skill Rank." Each Rite is its own Perk (prerequisite: Word of Unicron and the Culture die).
const underDarkEnergon = actor => (Number(actor?.system?.energon?.dark?.value) || 0) > 0;

// Champion His Way (+d10): "The Follower gains a +2 bonus to all Defenses while under the influence
// of Dark Energon." Under the influence = holding at least one Dark Energon Point (p.80: "Having at
// least one Dark Energon Point grants...").
export const CHAMPION_BONUS = 2;

registerDerived((actor) => {
  const defenses = actor?.system?.defenses;
  if (!defenses) {
    return;
  }

  const extra = extraMatrixToughness(actor);
  if (extra && defenses.toughness) {
    addToDefense(defenses.toughness, -extra, T('O1ArmorMatrixLabel'));
  }

  if (underDarkEnergon(actor) && hasRite(actor, 'championHisWay')) {
    for (const defense of Object.values(defenses)) {
      addToDefense(defense, CHAMPION_BONUS, T('O1ChampionHisWay'));
    }
  }
});

// Distill His Essence (+d4): "Once per day in a ritual that takes 10 minutes, the Follower can turn 2
// standard Energon Points into 1 Dark Energon Point." The day ends with the sheet's Rest.
registerUse({
  id: 'o1DistillHisEssence',
  matches: isRite('distillHisEssence'),
  canUse: item => !item.flags?.essence20?.o1UsedToday && (Number(item.parent?.system?.energon?.normal?.value) || 0) >= 2,
  run: async (item) => {
    const actor = item.parent;
    const energon = actor.system.energon;
    await actor.update({
      'system.energon.normal.value': energon.normal.value - 2,
      'system.energon.dark.value': (Number(energon.dark?.value) || 0) + 1,
    });
    await item.setFlag('essence20', 'o1UsedToday', true);
    return T('O1DistillHisEssence', { name: actor.name });
  },
});

registerRest(async (actor) => {
  for (const item of itemsOf(actor)) {
    if (isRite('distillHisEssence')(item) && item.flags?.essence20?.o1UsedToday) {
      await item.unsetFlag('essence20', 'o1UsedToday');
    }
  }
});

// Eat the Weak (+d2): "The Follower may attempt a Culture Skill Test versus a target's Willpower
// Defense to remove the Addicted (Dark Energon) Hang-Up from that target. This takes 10 minutes."
const addictionOf = actor => itemsOf(actor).find(item => item.type == 'hangUp'
  && (sourceOf(item) == O1_MORE.addictedDarkEnergon || /^addicted \(dark energon\)/i.test(item.name ?? ''))) ?? null;

registerUse({
  id: 'o1EatTheWeak',
  matches: isRite('eatTheWeak'),
  run: async (item) => {
    const actor = item.parent;
    const target = firstTarget() ?? actor;
    const addiction = addictionOf(target);
    if (!addiction) {
      ui.notifications.warn(T('O1NotAddicted', { name: target.name }));
      return null;
    }

    const { rollTest } = await import("../../grants.mjs");
    const { success } = await rollTest(actor, 'culture', Number(target.system?.defenses?.willpower?.total) || 10);
    if (!success) {
      return T('O1EatTheWeakFail', { name: actor.name, target: target.name });
    }

    if (target.isOwner) {
      await addiction.delete();
      return T('O1EatTheWeak', { name: actor.name, target: target.name });
    }

    await post(actor, `<p>${T('O1EatTheWeak', { name: actor.name, target: target.name })}</p>`
      + `<button type="button" data-e20-ext="o1RemoveItem" data-uuid="${addiction.uuid}">${T('O1RemoveHangUp')}</button>`);
    return null;
  },
});

registerChatButton('o1RemoveItem', async (message, button) => {
  const item = await fromUuid(button.dataset.uuid);
  if (!item?.isOwner) {
    ui.notifications.warn(T('O1NotOwner'));
    return;
  }

  await item.delete();
  button.disabled = true;
});

/* -------------------------------------------- */
/*  Multimorph                                   */
/* -------------------------------------------- */

// Multimorph (Dark Skies over Equestria, General Perk, p.21): "When you change your shape, you
// temporarily gain the benefits of two Origin Perks of your choice from two different Origins.
// Alternatively, you can gain the benefits of one of the other Origin's Origin Perks of your choice
// and keep the benefits of your Natural Shape." The Use button is the shape change: it grants the
// chosen Origin Perks as temporary copies for the scene; pressed again it changes back.
const MLP_PACKS = /\.(mlp_crb|knights_of_canterlot|dark_skies_over_equestria|in_a_jam|story_of_the_seasons)\./;
const morphCopies = actor => itemsOf(actor).filter(item => item.flags?.essence20?.o1Multimorph);

export function otherOrigins(rows, actor) {
  const own = new Set(itemsOf(actor).filter(item => item.type == 'origin').map(item => item.name));
  return rows.filter(row => MLP_PACKS.test(row.uuid ?? '') && !own.has(row.name)
    && Object.values(row.system?.items ?? {}).some(entry => entry?.type == 'perk'));
}

async function pickOriginPerk(title, origins, excludeOrigin) {
  const { chooseSelect } = await import("../../grants.mjs");
  const options = [];
  for (const origin of origins) {
    if (origin.uuid == excludeOrigin) {
      continue;
    }

    for (const entry of Object.values(origin.system?.items ?? {})) {
      if (entry?.type == 'perk' && entry.uuid) {
        options.push({ value: `${origin.uuid}|${entry.uuid}`, label: `${origin.name}: ${entry.name}` });
      }
    }
  }

  options.sort((a, b) => a.label.localeCompare(b.label));
  const choice = await chooseSelect(title, T('O1MultimorphPick'), options);
  return choice ? choice.split('|') : null;
}

registerUse({
  id: 'o1Multimorph',
  matches: isFrom(O1_MORE.multimorph),
  run: async (item) => {
    const actor = item.parent;
    const current = morphCopies(actor);
    if (current.length) {
      await actor.deleteEmbeddedDocuments('Item', current.map(copy => copy.id));
      return T('O1MultimorphEnd', { name: actor.name });
    }

    const { chooseButtons, findItems, grantCopy, temporary } = await import("../../grants.mjs");
    const mode = await chooseButtons(item.name, T('O1MultimorphMode'), [['two', T('O1MultimorphTwo')], ['one', T('O1MultimorphOne')]]);
    if (!['two', 'one'].includes(mode)) {
      return null;
    }

    const origins = otherOrigins(await findItems({ type: 'origin' }), actor);
    const first = await pickOriginPerk(item.name, origins, null);
    if (!first) {
      return null;
    }

    const picks = [first[1]];
    if (mode == 'two') {
      const second = await pickOriginPerk(item.name, origins, first[0]);
      if (!second) {
        return null;
      }

      picks.push(second[1]);
    }

    const names = [];
    for (const uuid of picks) {
      const created = await grantCopy(actor, uuid, { grantedBy: item, temporary: temporary('scene'), flags: { o1Multimorph: true } });
      if (created) {
        names.push(created.name);
      }
    }

    return T(mode == 'two' ? 'O1MultimorphTwoDone' : 'O1MultimorphOneDone', { name: actor.name, perks: names.join(', ') });
  },
});
