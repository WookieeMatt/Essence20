/**
 * Transformers (Technorganic Secrets) - the Scramble Field Generator.
 */
import { registerRollSources, registerUse } from "../../mechanics/item-hooks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { O3, rollSkillTotal } from "../shared/mlp-pr-tf-ids-and-skill-total.mjs";
import { T } from "../shared/item-lang.mjs";
import { escapeHtml as escape } from "../shared/chat-lines.mjs";
import { isItem } from "../shared/item-lookups.mjs";
import { num } from "../shared/numbers.mjs";
import { sameSide, targetedActors } from "../shared/sides.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { writeDocResult as writeActor } from "../shared/relayed-writes.mjs";

/*
 * Scramble Field Generator (Technorganic Secrets, p.49): "Must be adhered to target with a Finesse,
 * Infiltration, or Might Skill Test against their Evasion to affect sensors. Effects: Reduces
 * Target's Alertness by ↓2. Alternate Effects: With a successful DIF 16 Technology Test on
 * activation, the user and allies in the same faction become invisible to the target until the
 * Scramble Field Generator is removed as a Free action. The user may instead attempt a DIF 20
 * Technology Test to override the target's sensors and show them an illusion that lasts until the
 * Scramble Field Generator is removed as a Free action. Traits: Consumable, Computerized."
 *
 * The Use button makes the adhering attack against the targeted creature and the activation test;
 * the field lives on the target (flags.essence20.o3Scramble, for the scene). While it holds, the
 * target's Alertness is ↓2; if invisible, its attacks on the user's side are Snagged and that side's
 * attacks on it gain Edge (the Invisible Condition's own two halves). The illusion is the GM's to
 * narrate. Using it again against the scrambled target removes it (a Free action), which uses the
 * Consumable device up - as does an adhering attack that misses.
 */
const SCRAMBLE_FLAG = 'o3Scramble';

export function scrambleOn(actor) {
  const record = actor?.flags?.essence20?.[SCRAMBLE_FLAG];
  return record && record.epoch == getSceneEpoch() ? record : null;
}

function actorByUuid(uuid) {
  return worldActors().find(a => a.uuid == uuid) ?? null;
}

registerRollSources((actor, target, ctx) => {
  const sources = [];
  const mine = scrambleOn(actor);
  if (mine && ctx?.rolledSkill == 'alertness') {
    sources.push({ id: 'o3ScrambleAlertness', label: 'Scramble Field Generator', shiftDown: 2 });
  }

  if (ctx?.isAttack && target) {
    if (mine?.mode == 'invisible' && sameSide(target, actorByUuid(mine.by))) {
      sources.push({ id: 'o3ScrambleBlind', label: 'Scramble Field Generator', snag: true });
    }

    const theirs = scrambleOn(target);
    if (theirs?.mode == 'invisible' && sameSide(actor, actorByUuid(theirs.by))) {
      sources.push({ id: 'o3ScrambleUnseen', label: 'Scramble Field Generator', edge: true });
    }
  }

  return { sources };
});

registerUse({
  id: 'o3Scramble',
  matches: item => isItem(item, O3.scrambleField),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const target = targetedActors()[0];
    if (!target) {
      ui.notifications.warn(T('O3NeedTarget'));
      return null;
    }

    const { chooseButtons } = await import("../../mechanics/resources/grants.mjs");
    if (scrambleOn(target)?.by == actor.uuid) {
      if (!(await pay('free'))) {
        return null;
      }

      await writeActor(target, 'unsetFlag', ['essence20', SCRAMBLE_FLAG]);
      await consume(item);
      return T('O3ScrambleRemoved', { target: escape(target.name) });
    }

    const skill = await chooseButtons(item.name, T('O3ScrambleSkill'), ['finesse', 'infiltration', 'might']
      .map(s => [s, game.i18n.localize(CONFIG.E20.skills?.[s] ?? s)]));
    if (!skill || !(await pay('standard'))) {
      return null;
    }

    const adhere = await rollSkillTotal(actor, skill, { dif: num(target.system?.defenses?.evasion?.total) });
    if (!adhere?.success) {
      await consume(item);
      return T('O3ScrambleMissed', { name: escape(actor.name), target: escape(target.name) });
    }

    const mode = await chooseButtons(item.name, T('O3ScrambleMode'), [
      ['alertness', T('O3ScrambleModeSensors')], ['invisible', T('O3ScrambleModeInvisible')], ['illusion', T('O3ScrambleModeIllusion')],
    ]);
    let applied = 'alertness';
    if (mode == 'invisible' || mode == 'illusion') {
      const test = await rollSkillTotal(actor, 'technology', { dif: mode == 'invisible' ? 16 : 20 });
      applied = test?.success ? mode : 'alertness';
    }

    await writeActor(target, 'setFlag', ['essence20', SCRAMBLE_FLAG, { by: actor.uuid, mode: applied, epoch: getSceneEpoch() }]);
    return T(`O3ScrambleApplied_${applied}`, { name: escape(actor.name), target: escape(target.name) });
  },
});

async function consume(item) {
  const quantity = num(item.system?.quantity ?? 1);
  if (quantity > 1) {
    await item.update({ 'system.quantity': quantity - 1 });
  } else {
    await item.delete();
  }
}
