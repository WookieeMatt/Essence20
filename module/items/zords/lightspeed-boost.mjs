/**
 * Across the Stars (Power Rangers) - the Lightspeed Boost Zord Feature.
 *
 * - Lightspeed Boost, Zord Feature (p.103): "Increase its Health by 2 [Active Effect] and choose one of
 *   the following": Aeronautic (Aerial 40ft, +2 Evasion while in flight), Aquatic (Aquatic 40ft, +2
 *   Evasion while submerged), HAZMAT (Resistance to two or Immunity to one of Acid, Cold, Electricity,
 *   Poison, Sonic), Medical (+10ft to existing Movement, ↑2 on Science/Technology first aid or repair
 *   by the Zord or its crew), Pyrotechnic (Immunity to Fire; a Standard action extinguishes a 20x20ft
 *   area). "In flight"/"submerged" read the Zord token's elevation (above/below 0) - that Evasion and
 *   the picker stay here; the Movement, Resistances / Immunities, Medical's ↑2 and Pyrotechnic's
 *   extinguish button are the item's own rules (they read the pick below).
 *
 * The book's other Zord Features are their items' own rules: S.W.A.T. Upgrade (p.104 - Armor Up!'s plating, Drop It!,
 * Incapacitation Ammo's alternate fire as a DialogSwitch + HitRider pair, Incarceration Protocols' detaining
 * Triggers), Tactical Size Shift (p.104) and Warzord (p.104, including its megaformCombined reminder); so is
 * Xeno-Location Study (p.71). Be an Example is items/rolls/be-an-example.mjs and Stand Behind Me!
 * items/attacks/stand-behind-me-taunt.mjs.
 */
import { registerDefenseAdjust, registerUse } from "../../mechanics/item-hooks.mjs";
import { PR1 } from "../shared/pr-jtt-ats-item-ids.mjs";
import { TSafe as T } from "../shared/item-lang.mjs";
import { allSourcedAny as allSourced, flagOf, isItem } from "../shared/item-lookups.mjs";
import { tokenOf } from "../shared/sides.mjs";
import { numLoose as num } from "../shared/numbers.mjs";
import { postLine } from "../shared/chat-lines.mjs";

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

registerDefenseAdjust((attacker, defender, defenseType) => lightspeedDefenseAdjust(defender, defenseType));

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
