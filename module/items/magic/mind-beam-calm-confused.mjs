import {
  registerAfterDamage, registerApplyDialog, registerPostRoll, registerRollSources,
} from "../../mechanics/item-hooks.mjs";
import { esc, gmDo, SCOPE, sourceOf } from "../../mechanics/combat/reaction-engine.mjs";
import { T } from "../shared/item-lang.mjs";

export const MIND_BEAM = "Compendium.essence20.mlp_crb.Item.gF8otV8Ag9axRp2Z";

// Mind Beam (MLP CRB p.139-140): mastering it picks a default effect (Calm, Confuse, Frighten, Impair
// or Stunned); the others cost ↓1 more. 3 rounds. Calm: ↑2 on Social tests against the target, broken
// by harm. Confused: the target wanders at random and attacks no one.
globalThis.Hooks?.once('setup', () => {
  const list = CONFIG.statusEffects;
  if (!Array.isArray(list)) {
    return;
  }

  for (const [id, img] of [['calm', 'icons/svg/heal.svg'], ['confused', 'icons/svg/daze.svg']]) {
    if (!list.some(s => s.id == id)) {
      list.push({ id, name: `E20.ReactStatus_${id}`, img, changes: [] });
    }
  }
});

registerApplyDialog(async (actor, options, ctx) => {
  const effect = ctx?.dataset?.mindBeamEffect;
  if (!effect || sourceOf(ctx?.item) != MIND_BEAM) {
    return;
  }

  // The first effect cast is taken as the one Mastered - it's stored on the spell and can be
  // changed by clearing the flag.
  const chosen = ctx.item.getFlag?.(SCOPE, 'mindBeamDefault');
  if (!chosen) {
    await ctx.item.setFlag?.(SCOPE, 'mindBeamDefault', effect);
  } else if (chosen != effect) {
    options.shiftDown = (Number(options.shiftDown) || 0) + 1;
  }
});

registerPostRoll(async (actor, results, checkContext) => {
  const effect = checkContext?.mindBeamEffect;
  if (checkContext?.spellSourceId != MIND_BEAM || !effect) {
    return;
  }

  for (const result of (results ?? []).filter(r => r.success && r.targetUuid)) {
    const target = await fromUuid(result.targetUuid);
    await gmDo({ kind: 'status', uuid: result.targetUuid, status: effect, rounds: 3 },
      T('ReactMindBeamLasts', { target: esc(target?.name ?? ''), effect: game.i18n.localize(CONFIG.statusEffects?.find(s => s.id == effect)?.name ?? effect) }), actor);
  }
});

registerRollSources((actor, target, ctx) => {
  const social = CONFIG.E20?.skillsByEssence?.social ?? [];
  if (!target?.statuses?.has?.('calm') || !social.includes(ctx?.rolledSkill)) {
    return null;
  }

  return { sources: [{ id: 'reactCalm', label: T('ReactStatus_calm'), shiftUp: 2 }] };
});

registerAfterDamage(async (actor, dealt) => {
  if (dealt > 0 && actor?.statuses?.has?.('calm')) {
    await actor.toggleStatusEffect('calm', { active: false });
  }
});
