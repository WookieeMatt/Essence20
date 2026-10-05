/**
 * PR CRB / Beneath the Helmet General and Role Perk leftovers: Privileged and the White Ranger's
 * Grid Relic Weapon.
 */
import { PR2, T, itemsOf, sourceOf } from "./common.mjs";
import { postLine } from "../zord1/common.mjs";

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
