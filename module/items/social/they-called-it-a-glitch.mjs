import { registerUse } from "../../mechanics/item-hooks.mjs";
import {
  chooseButtons, chooseSelect, firstTarget, rollTest, TF1,
} from "../shared/condition-damage-buttons.mjs";
import { T } from "../shared/item-lang.mjs";
import { sourceOfOrUndefined as sourceOf } from "../shared/item-lookups.mjs";

/**
 * They Called It a Glitch! (Decepticon Directive): eight hours of cybersurgery on a willing, targeted ally - its
 * Use button operates (a General Perk and -2 maximum Health, an Active Effect) or reverses an earlier operation.
 */

const target = () => firstTarget()?.actor ?? null;

const GLITCH_FLAG = 'tf1Glitch';

export const GLITCH_USE = {
  // They Called It a Glitch! (Knock Out, 20th level, p.52): "By performing 8 hours of modification
  // work on a willing ally and succeeding at a DIF 20 Technology (Engineering) Skill Test, you reduce
  // the target's maximum Health by 2 and grant them a General Perk they meet the prerequisites for.
  // This modification is permanent, unless you reverse it with another 8 hours of cybersurgery (this
  // requires no Skill Test) ... you can't perform it on them if it would reduce their maximum Health
  // to 1 or lower."
  id: 'tf1Glitch', matches: item => sourceOf(item) == TF1.theyCalledItAGlitch,
  canUse: () => !game?.combat,
  async run(item) {
    const actor = item.parent;
    const ally = target();
    if (!ally || ally.id == actor.id) {
      ui.notifications.warn(T('Tf1PickAlly'));
      return null;
    }

    if (!ally.isOwner) {
      ui.notifications.warn(T('Tf1GmApplies'));
      return null;
    }

    const done = (ally.effects?.contents ?? [...(ally.effects ?? [])]).filter(e => e.flags?.essence20?.[GLITCH_FLAG]);
    const choice = done.length
      ? await chooseButtons(item.name, T('Tf1GlitchPrompt', { ally: ally.name }), [['operate', T('Tf1GlitchOperate')], ['reverse', T('Tf1GlitchReverse')]])
      : 'operate';
    if (choice == 'reverse') {
      const pick = done.length > 1 ? await chooseSelect(item.name, T('Tf1GlitchPickReverse'), done.map(e => ({ value: e.id, label: e.name }))) : done[0].id;
      const effect = done.find(e => e.id == pick);
      if (!effect) {
        return null;
      }

      const perkId = effect.flags.essence20[GLITCH_FLAG].itemId;
      await ally.deleteEmbeddedDocuments('ActiveEffect', [effect.id]);
      if (perkId && ally.items?.get?.(perkId)) {
        await ally.deleteEmbeddedDocuments('Item', [perkId]);
      }

      return T('Tf1GlitchReversed', { name: actor.name, ally: ally.name });
    }

    if (choice != 'operate') {
      return null;
    }

    const max = Number(ally.system?.health?.max) || 0;
    if (max - 2 <= 1) {
      ui.notifications.warn(T('Tf1GlitchTooFrail', { ally: ally.name }));
      return null;
    }

    const { findCompendiumItems, pickCompendiumItem } = await import("../../util/compendium-item-picker.mjs");
    const rows = await findCompendiumItems({ type: 'perk', fields: ['system.type'], matches: e => e.system?.type == 'general' });
    const uuid = await pickCompendiumItem(rows, { title: item.name, label: 'E20.Tf1GlitchPickPerk' });
    if (!uuid) {
      return null;
    }

    const { success } = await rollTest(actor, 'technology', 20);
    if (!success) {
      return T('Tf1GlitchFailed', { name: actor.name, ally: ally.name });
    }

    const { grantCopy } = await import("../../mechanics/resources/grants.mjs");
    const perk = await grantCopy(ally, uuid, { grantedBy: item, flags: { tf1GlitchPerk: true } });
    await ally.createEmbeddedDocuments('ActiveEffect', [{
      name: `${item.name}: ${perk?.name ?? ''}`, img: item.img,
      changes: [{ key: 'system.health.bonus', mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: '-2' }],
      flags: { essence20: { [GLITCH_FLAG]: { itemId: perk?.id ?? null, by: actor.uuid } } },
    }]);
    return T('Tf1GlitchDone', { name: actor.name, ally: ally.name, perk: perk?.name ?? '' });
  },
};

registerUse(GLITCH_USE);
