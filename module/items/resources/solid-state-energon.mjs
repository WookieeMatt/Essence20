import { registerUse } from "../../mechanics/item-hooks.mjs";
import {
  chooseButtons, damageButton, rollTest, TF1, tokensNear,
} from "../shared/condition-damage-buttons.mjs";
import { T } from "../shared/item-lang.mjs";
import { sourceOfOrUndefined as sourceOf } from "../shared/item-lookups.mjs";
import { sayParagraph as say } from "../shared/chat-lines.mjs";
import { tokenOf } from "../shared/sides.mjs";

/**
 * Solid-State Energon crystals: the item's Use button either refines one (a Science test) or rolls whether a
 * damaged one explodes, with damage buttons for everyone caught in the blast.
 */
export const SOLID_ENERGON_USE = {
  // Solid-State Energon (Decepticon Directive p.79): "Should it suffer damage of any type aside from
  // Cold ... Roll 1d2 and add the damage the crystals suffer. If the result is equal to or higher than
  // the number of Energon Points stored within the crystal, it explodes, inflicting 1 Energy damage
  // to everyone within a radius equal to 10ft times the number of Energon Points within the crystal. A
  // character who succeeds at a DIF 14 Science (Mineralogy) Skill Test as a Standard action can break
  // down a single solid-state Energon crystal into a useable liquid form".
  id: 'tf1SolidEnergon', matches: item => sourceOf(item) == TF1.solidStateEnergon,
  canUse: item => (Number(item.system?.quantity) || 0) > 0,
  async run(item, economy, pay) {
    const actor = item.parent;
    const choice = await chooseButtons(item.name, T('Tf1CrystalPrompt'), [['damaged', T('Tf1CrystalDamaged')], ['refine', T('Tf1CrystalRefine')]]);
    if (!choice) {
      return null;
    }

    const stored = Number(item.flags?.essence20?.tf1Points) || 0;
    const answer = await foundry.applications.api.DialogV2.wait({
      window: { title: item.name },
      classes: ["window-app", "e20-window"],
      content: `<div class="form-group"><label>${T('Tf1CrystalPoints')}</label><input type="number" name="points" min="1" value="${stored || 1}" /></div>${
        choice == 'damaged' ? `<div class="form-group"><label>${T('Tf1CrystalDamage')}</label><input type="number" name="damage" min="0" value="1" /></div>` : ''}`,
      buttons: [
        { action: 'ok', label: T('DialogConfirmButton'), default: true, callback: (event, button) => ({
          points: Math.max(1, Number(button.form.elements.points.value) || 1), damage: Math.max(0, Number(button.form.elements.damage?.value) || 0),
        }) },
        { action: 'cancel', label: T('DialogCancelButton') },
      ],
      rejectClose: false,
    });
    if (!answer || answer == 'cancel') {
      return null;
    }

    await item.setFlag('essence20', 'tf1Points', answer.points);
    const useOne = () => item.update({ 'system.quantity': Math.max(0, (Number(item.system?.quantity) || 1) - 1) });
    if (choice == 'refine') {
      if (!(await pay('standard'))) {
        return null;
      }

      const { success } = await rollTest(actor, 'science', 14);
      if (success) {
        await useOne();
      }

      return T(success ? 'Tf1CrystalRefined' : 'Tf1CrystalRefineFailed', { name: actor.name, points: answer.points });
    }

    const roll = await new Roll(`1d2 + ${answer.damage}`).evaluate();
    if (roll.total < answer.points) {
      return T('Tf1CrystalHolds', { total: roll.total, points: answer.points });
    }

    await useOne();
    const own = tokenOf(actor);
    const caught = own ? [own, ...tokensNear(own, 10 * answer.points)] : [];
    const buttons = caught.map(t => damageButton(t.actor, 1, 'element'));
    await say(actor, `${T('Tf1CrystalExplodes', { total: roll.total, points: answer.points, radius: 10 * answer.points })}${buttons.length ? `<br>${buttons.join('<br>')}` : ''}`);
    return null;
  },
};

registerUse(SOLID_ENERGON_USE);
