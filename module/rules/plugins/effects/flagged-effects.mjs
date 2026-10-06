import { registerTag } from "../../predicate.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { escape, listOf, localize, write } from "../shared/copy-and-data-helpers.mjs";

/**
 * Round 15 (items2) - Active Effects an addEffect step made, found again by their flag (They Called It a Glitch!'s
 * reversible cybersurgery):
 *
 *   tag  self:hasEffectFlag:<flag> / target:hasEffectFlag:<flag>
 *        The actor carries an Active Effect with flags.essence20.<flag>.
 *   step undoEffect {flag, to?, linkedItem?, prompt?}
 *        For the (first) recipient: one of its Active Effects carrying flags.essence20.<flag> - the only one, or the one
 *        the player picks (by name) - is deleted, and with `linkedItem` also the actor's item whose id that flag keeps
 *        at that key (flags.essence20.<flag>.<linkedItem>). @var.undone is the effect's name. None: stops.
 */

const flagged = (actor, flag) => listOf(actor?.effects).filter(effect => effect?.flags?.essence20?.[flag]);

registerTag('self:hasEffectFlag', (rest, ctx) => (ctx?.self ? flagged(ctx.self, rest).length > 0 : false));
registerTag('target:hasEffectFlag', (rest, ctx) => (ctx?.other ? flagged(ctx.other, rest).length > 0 : false));

registerStep('undoEffect', async (step, ctx) => {
  const [actor] = recipients(step, ctx);
  const effects = flagged(actor, step.flag);
  if (!effects.length) {
    return false;
  }

  let effect = effects[0];
  if (effects.length > 1) {
    const { chooseSelect } = ctx.grantHelpers ?? await import("../../../mechanics/resources/grants.mjs");
    const id = await chooseSelect(ctx.item?.name ?? '', escape(localize(step.prompt ?? '') || ''), effects.map(e => ({ value: e.id, label: e.name })));
    effect = effects.find(e => e.id == id) ?? null;
    if (!effect) {
      return false;
    }
  }

  const linked = step.linkedItem ? effect.flags.essence20[step.flag]?.[step.linkedItem] : null;
  await write(actor, 'deleteEmbeddedDocuments', ['ActiveEffect', [effect.id]]);
  if (linked && actor.items?.get?.(linked)) {
    await write(actor, 'deleteEmbeddedDocuments', ['Item', [linked]]);
  }

  ctx.vars.undone = effect.name ?? '';
}, {
  errors: (step, where) => [
    ...(typeof step.flag == 'string' && /^[\w-]+$/.test(step.flag) ? [] : [`${where}: undoEffect needs a flag name`]),
    ...(step.linkedItem === undefined || /^[\w-]+$/.test(String(step.linkedItem)) ? [] : [`${where}: linkedItem must be a plain key`]),
  ],
});
