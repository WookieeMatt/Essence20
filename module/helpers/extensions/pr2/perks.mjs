/**
 * PR CRB / Beneath the Helmet General and Role Perk leftovers: Keen Eye, Privileged and the White
 * Ranger's Grid Relic Weapon.
 */
import { registerApplyDialog, registerUse } from "../../extensions.mjs";
import { PR2, T, holds, itemsOf, sourceOf } from "./common.mjs";
import { giveEdge, postLine } from "../zord1/common.mjs";

/* -------------------------------------------- */
/*  Keen Eye                                     */
/* -------------------------------------------- */

// Keen Eye (PR CRB p.96): "You gain Edge on all Alertness (Perception) tests." Only the Perception
// Specialization - matched by name, as dice.mjs does for Calm Beast/Puzzle Solver. "↑1 on Skill
// Tests based on your sense of sight" is the Perk's own opt-in effect; "a DIF 12 Alertness Skill Test
// to recall any visual detail from the last 24 hours" is its Use button.
export function isPerceptionRoll(actor, rolledSkill, dataset) {
  if (rolledSkill != 'alertness' || !dataset?.specializationKey) {
    return false;
  }

  const spec = actor?.system?.skills?.alertness?.specializations?.[dataset.specializationKey];
  return /perception/i.test(spec?.name ?? '');
}

export function keenEyeApply(actor, options, ctx = {}) {
  if (holds(actor, PR2.keenEye) && isPerceptionRoll(actor, ctx.rolledSkill, ctx.dataset)) {
    giveEdge(options);
  }
}

registerApplyDialog(keenEyeApply);

registerUse({
  id: 'pr2KeenEye',
  matches: item => sourceOf(item) == PR2.keenEye,
  run: async item => {
    const { rollTest } = await import("../../grants.mjs");
    const { success } = await rollTest(item.parent, 'alertness', 12);
    return T(success ? 'Pr2KeenEyeRecall' : 'Pr2KeenEyeNoRecall', { name: item.parent?.name ?? '' });
  },
});

/* -------------------------------------------- */
/*  Privileged                                   */
/* -------------------------------------------- */

// Privileged (Beneath the Helmet p.50): "Spend a Story Point to gain a temporary ally for the rest
// of the game session." The Story Point is spent here; who the ally is stays the GM's. (The Social
// Edge is the Perk's opt-in effect; "access to a person or area normally barred" is narrative.)
registerUse({
  id: 'pr2Privileged',
  matches: item => sourceOf(item) == PR2.privileged,
  run: async item => {
    const actor = item.parent;
    const { canSpendForActor, spendForActor } = await import("../../story-points.mjs");
    if (!canSpendForActor(actor, 1)) {
      ui.notifications?.warn(T('Pr2NoStoryPoint'));
      return null;
    }

    await spendForActor(actor, 1, { announce: false });
    return T('Pr2PrivilegedAlly', { name: actor.name });
  },
});

/* -------------------------------------------- */
/*  Grid Relic Weapon                            */
/* -------------------------------------------- */

// Grid Relic Weapon (PR CRB, White Ranger, 1st level, p.61): "you are given this truly wondrous item
// that inflicts energy damage with its attacks, plus one level in a special Might or Finesse (Grid
// Relic) specialization. Unlike other skills, this weapon's skill dice are based upon your level in
// White Ranger." The weapon's attack rolls the Role's own skill die (roleSkillDie, which the White
// Ranger Role already advances); the book prints no damage figure, so it starts at the Baseline
// melee 2 Energy and the GM may retune it.
export const RELIC_FLAG = 'pr2GridRelic';

export function relicData(style, perk) {
  const name = T('Pr2GridRelicName');
  const weapon = {
    name, type: 'weapon', img: perk?.img,
    flags: { essence20: { [RELIC_FLAG]: true, grantedBy: perk?.id ?? null } },
    system: { equipped: true, traits: ['energy', 'powerWeapon'], classification: { size: 'medium' } },
  };
  const effect = {
    name: T('Pr2GridRelicEffect', { name }), type: 'weaponEffect',
    system: {
      classification: { skill: 'roleSkillDie', style: 'melee' },
      damageType: 'element', damageValue: 2, defenseType: 'toughness',
      range: { min: null, reachMultiplier: 1, long: null, value: null },
      numHands: '1', numTargets: 1,
    },
    flags: { essence20: { [RELIC_FLAG]: style } },
  };
  return { weapon, effect };
}

export async function grantGridRelic(perk) {
  const actor = perk.parent;
  if (itemsOf(actor).some(i => i.flags?.essence20?.[RELIC_FLAG])) {
    return null;
  }

  const { chooseButtons } = await import("../../grants.mjs");
  const style = await chooseButtons(perk.name, T('Pr2GridRelicPickStyle'), [['might', T('Pr2GridRelicMight')], ['finesse', T('Pr2GridRelicFinesse')]]);
  if (!style) {
    return null;
  }

  const { weapon, effect } = relicData(style, perk);
  const [created] = await actor.createEmbeddedDocuments('Item', [weapon]);
  if (!created) {
    return null;
  }

  effect.flags.essence20.parentId = created.id;
  await actor.createEmbeddedDocuments('Item', [effect]);
  await postLine(actor, T('Pr2GridRelicGranted', { name: actor.name }));
  return created;
}

export async function onPerkCreated(item, options, userId) {
  if (userId != globalThis.game?.user?.id || item?.parent?.documentName != 'Actor') {
    return;
  }

  if (sourceOf(item) == PR2.gridRelicWeapon && item.parent.type == 'playerCharacter') {
    await grantGridRelic(item);
  }
}

globalThis.Hooks?.on?.('createItem', (...args) => onPerkCreated(...args).catch(error => console.error('Essence20 | pr2', error)));
