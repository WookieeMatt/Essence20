/**
 * Across the Stars (Power Rangers) items for the pr1 slice.
 *
 * - Be an Example (Noble Blood Origin, p.40): "You can spend a Free action to reflect on your
 *   training and traditions to gain ↑1 to the skill you chose to increase or advance as part of this
 *   Origin." A Use button (Free action) banks ↑1 on system.originSkillsIncrease for the next test.
 * - Lightspeed Boost, Zord Feature (p.103): "Increase its Health by 2 [Active Effect] and choose one of
 *   the following": Aeronautic (Aerial 40ft, +2 Evasion while in flight), Aquatic (Aquatic 40ft, +2
 *   Evasion while submerged), HAZMAT (Resistance to two or Immunity to one of Acid, Cold, Electricity,
 *   Poison, Sonic), Medical (+10ft to existing Movement, ↑2 on Science/Technology first aid or repair
 *   by the Zord or its crew), Pyrotechnic (Immunity to Fire; a Standard action extinguishes a 20x20ft
 *   area). "In flight"/"submerged" read the Zord token's elevation (above/below 0) - that Evasion and
 *   the picker stay here; the Movement, Resistances / Immunities, Medical's ↑2 and Pyrotechnic's
 *   extinguish button are the item's own rules (they read the pick below).
 * - S.W.A.T. Upgrade, Zord Feature (p.104): Armor Up! +2 plating (Active Effect); Drop It! "The pilot
 *   may use Intimidation and Persuasion Skills through the Zord's loudspeakers, gaining Edge";
 *   Incapacitation Ammo "an alternate firing mode for any ranged attacks, changing the effect to Stun
 *   with a numerical effect 1 higher than the damage dealt"; Incarceration Protocols "answers its Call
 *   to Action with 6 containment cards... any enemy Defeated by your Zord's attacks is automatically
 *   digitally detained if there are vacant containment cards" (6 per scene here).
 * - Stand Behind Me! (Gold Ranger, p.53): "force all enemies within 60 feet to make you the target of
 *   their attacks unless they succeed on a DIF 14 Alertness Skill Test." mechanics/resources/banked-buffs.mjs
 *   spends the Power and marks the taunt; here each enemy within 60ft gets a DIF 14 Alertness button
 *   at the start of its turn, and one that failed can't attack anyone else.
 * - Tactical Size Shift, Zord Feature (p.104): its own rules (the direction / Skill pick, its Active Effect, the
 *   Skill die put back on removal, the size steps - module/rules/ext/h/).
 * - Warzord, Zord Feature (p.104): Titanic Size; +3 Health, +3 Strength, Edge on Initiative (Active
 *   Effects); "All the Zord's Might or Finesse-based attacks increase their base damage by 1". The
 *   Combiner reminder when it joins a Megaform is the item's own megaformCombined Trigger.
 * - Xeno-Location Study (p.71): "Edge on Animal Handling, Deception, Insight, Persuasion, and Survival
 *   Skill Tests when in the chosen location or interacting with people from it" - a checkbox (the
 *   Culture half is dice.mjs's). This system has no Insight skill.
 */
import {
  registerApplyDialog, registerChatButton, registerDefenseAdjust, registerRollSources,
  registerTurnStart, registerUse, registerPreRoll,
} from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import {
  PR1, T, allSourced, feetBetween, findSourced, flagOf, has, isEnemyOf,
  isItem, kept, num, postLine, tokenOf, writeDoc,
} from "../shared/crew-allies-turn-stamps.mjs";

const pushTo = (list, entry) => {
  list.push({ shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...entry });
};

/* -------------------------------------------- */
/*  Be an Example                                */
/* -------------------------------------------- */

const EXAMPLE_FLAG = 'pr1BeAnExample';

export function originSkillOf(actor) {
  const skill = actor?.system?.originSkillsIncrease;
  return skill && actor.system?.skills?.[skill] ? skill : null;
}

registerUse({
  id: 'pr1-be-an-example',
  matches: item => isItem(item, PR1.beAnExample),
  canUse: item => !flagOf(item.parent, EXAMPLE_FLAG),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    let skill = originSkillOf(actor);
    if (!skill) {
      const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
      skill = await chooseSelect(item.name, T('Pr1BeAnExamplePick'), Object.keys(actor.system?.skills ?? {})
        .filter(key => CONFIG.E20?.skills?.[key])
        .map(key => ({ value: key, label: game.i18n.localize(CONFIG.E20.skills[key]) })));
    }

    if (!skill || !(await pay('free'))) {
      return null;
    }

    await actor.setFlag('essence20', EXAMPLE_FLAG, { skill });
    return T('Pr1BeAnExampleLine', { name: actor.name, skill: game.i18n.localize(CONFIG.E20?.skills?.[skill] ?? skill) });
  },
});

/* -------------------------------------------- */
/*  Lightspeed Boost                             */
/* -------------------------------------------- */

const LIGHTSPEED_FLAG = 'pr1LightspeedBoost';
export const LIGHTSPEED_OPTIONS = ['aeronautic', 'aquatic', 'hazmat', 'medical', 'pyrotechnic'];
const HAZMAT_TYPES = ['acid', 'cold', 'electric', 'poison', 'sonic'];

export const lightspeedOf = zord => allSourced(zord, PR1.lightspeedBoost).map(f => flagOf(f, LIGHTSPEED_FLAG)).filter(Boolean);

async function pickLightspeed(feature) {
  const { chooseSelect, chooseButtons } = await import("../../mechanics/resources/grants.mjs");
  const option = await chooseSelect(feature.name, T('Pr1LightspeedPick'),
    LIGHTSPEED_OPTIONS.map(value => ({ value, label: T(`Pr1Lightspeed.${value}`) })));
  if (!option) {
    return null;
  }

  const choice = { option };
  if (option == 'hazmat') {
    const label = t => game.i18n.localize(CONFIG.E20?.damageTypes?.[t] ?? t);
    const how = await chooseButtons(feature.name, T('Pr1HazmatHow'), [['resist', T('Pr1HazmatResist')], ['immune', T('Pr1HazmatImmune')]]);
    if (!how) {
      return null;
    }

    const types = [];
    for (let i = 0; i < (how == 'resist' ? 2 : 1); i++) {
      const type = await chooseSelect(feature.name, T('Pr1HazmatType'),
        HAZMAT_TYPES.filter(t => !types.includes(t)).map(value => ({ value, label: label(value) })));
      if (!type) {
        return null;
      }

      types.push(type);
    }

    Object.assign(choice, { how, types });
  }

  await feature.setFlag('essence20', LIGHTSPEED_FLAG, choice);
  return T('Pr1LightspeedChosen', { name: feature.parent?.name ?? '', option: T(`Pr1Lightspeed.${option}`) });
}

// The picks' Movement (Aerial / Swim 40, Medical +10 at stage afterGravity), HAZMAT's Resistances /
// Immunity and Pyrotechnic's Fire Immunity and extinguish Use are the item's own rules (they read the
// pick above); the in-flight / submerged Evasion stays here (token elevation).
export function elevationOf(actor) {
  const doc = tokenOf(actor)?.document;
  return num(doc?.elevation);
}

export function lightspeedDefenseAdjust(defender, defenseType) {
  if (defenseType != 'evasion' || defender?.type != 'zord') {
    return 0;
  }

  const options = lightspeedOf(defender).map(c => c.option);
  const elevation = elevationOf(defender);
  if ((options.includes('aeronautic') && elevation > 0) || (options.includes('aquatic') && elevation < 0)) {
    return 2;
  }

  return 0;
}

// Only until the pick is made: Pyrotechnic's extinguish button is then the item's own Use rule.
registerUse({
  id: 'pr1-lightspeed-boost',
  matches: item => isItem(item, PR1.lightspeedBoost) && !flagOf(item, LIGHTSPEED_FLAG),
  run: item => pickLightspeed(item),
});

// Power Flux is the Feature's own rule: a crew-scoped sceneStart Trigger (the Zord on the canvas) that
// tops each crew member's Personal Power up by at most 6.

// S.W.A.T. Upgrade's Incarceration Protocols are the Feature's own rules: a `hit` Trigger moves an
// exclusive "last hit" mark onto the Zord's target, and a watch Trigger on an enemy's `defeated`
// detains whoever carries it (6 per scene, the count kept on a scene-long mark). Incapacitation
// Ammo's alternate fire stays below.

/* -------------------------------------------- */
/*  Stand Behind Me!                             */
/* -------------------------------------------- */

const TAUNT_FLAG = 'standBehindMeActive';
const TAUNTED_FLAG = 'pr1Taunted';

export function tauntLive(record) {
  const combat = game.combat;
  return !!record && !!combat && record.combatId == combat.id && combat.round - num(record.round) <= 1;
}

export function tauntersNear(actor) {
  return worldActors().filter(other => other?.uuid != actor?.uuid && has(other, PR1.standBehindMe)
    && tauntLive(flagOf(other, TAUNT_FLAG)) && isEnemyOf(other, actor)
    && (feetBetween(other, actor) ?? Infinity) <= 60);
}

registerTurnStart(async (actor) => {
  const record = flagOf(actor, TAUNTED_FLAG);
  for (const taunter of tauntersNear(actor)) {
    if (record?.by == taunter.uuid && tauntLive(record)) {
      continue;
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: taunter }),
      whisper: game.users?.filter?.(u => u.isGM).map(u => u.id) ?? [],
      content: `<p>${T('Pr1TauntCard', { name: actor.name, taunter: taunter.name })}</p>`
        + `<button type="button" class="e20-chat-action-button" data-e20-ext="pr1TauntTest" data-actor="${actor.uuid}" data-taunter="${taunter.uuid}">${T('Pr1TauntButton')}</button>`,
    });
  }
});

registerChatButton('pr1TauntTest', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  const taunter = await fromUuid(button.dataset.taunter);
  if (!actor || !taunter || button.dataset.done) {
    return;
  }

  button.dataset.done = '1';
  button.disabled = true;
  const { rollTest } = await import("../../mechanics/resources/grants.mjs");
  const { success } = await rollTest(actor, 'alertness', 14);
  const combat = game.combat;
  await writeDoc(actor, 'setFlag', 'essence20', TAUNTED_FLAG, {
    by: taunter.uuid, combatId: combat?.id ?? null, round: combat?.round ?? 0, resisted: success,
  });
  await postLine(actor, T(success ? 'Pr1TauntResisted' : 'Pr1TauntForced', { name: actor.name, taunter: taunter.name }));
});

/** An attack by a creature forced to target the taunter, at someone else. */
export function tauntBlocks(actor, item, targets) {
  const record = flagOf(actor, TAUNTED_FLAG);
  if (item?.type != 'weaponEffect' || !record || record.resisted || !tauntLive(record)) {
    return null;
  }

  const taunter = globalThis.fromUuidSync?.(record.by);
  if (!taunter || !tauntLive(flagOf(taunter, TAUNT_FLAG))) {
    return null;
  }

  return targets.length && targets.every(t => t?.uuid == taunter.uuid) ? null : taunter;
}

registerPreRoll((actor, dataset, item) => {
  const targets = [...(game.user?.targets ?? [])].map(token => token.actor).filter(Boolean);
  const taunter = tauntBlocks(actor, item, targets);
  if (taunter) {
    ui.notifications.warn(T('Pr1TauntBlocked', { name: actor.name, taunter: taunter.name }));
    dataset.cancelRoll = true;
  }
});

/* -------------------------------------------- */
/*  Roll sources, dialog, riders                 */
/* -------------------------------------------- */

export function atsSources(actor, target, ctx = {}) {
  const sources = [];
  const { rolledSkill } = ctx;

  const example = flagOf(actor, EXAMPLE_FLAG);
  if (example?.skill && example.skill == rolledSkill) {
    pushTo(sources, { id: 'pr1BeAnExample', label: findSourced(actor, PR1.beAnExample)?.name ?? 'Be an Example', shiftUp: 1 });
  }

  return sources;
}

registerRollSources((actor, target, ctx) => ({ sources: atsSources(actor, target, ctx) }));

registerDefenseAdjust((attacker, defender, defenseType) => lightspeedDefenseAdjust(defender, defenseType));

// S.W.A.T. Upgrade's Incapacitation Ammo is a DialogSwitch + HitRider rule pair on its pack item.

registerApplyDialog(async (actor, options, ctx = {}) => {
  const example = flagOf(actor, EXAMPLE_FLAG);
  if (example?.skill && example.skill == ctx.rolledSkill && kept(options, 'pr1BeAnExample')) {
    await actor.unsetFlag('essence20', EXAMPLE_FLAG);
  }
});

// A Feature that needs a choice asks for it the moment it lands on a Zord, for whoever dropped it.
globalThis.Hooks?.on?.('createItem', async (item, options, userId) => {
  if (userId != globalThis.game?.user?.id || item.parent?.type != 'zord') {
    return;
  }

  let line = null;
  if (isItem(item, PR1.lightspeedBoost) && !flagOf(item, LIGHTSPEED_FLAG)) {
    line = await pickLightspeed(item);
  }

  if (line) {
    await postLine(item.parent, line);
  }
});

