import { recipients, registerStep } from "../../steps.mjs";
import { escape, write } from "../shared/chat-speaker-helpers.mjs";

/**
 * Step `tokenLight {bright, dim, angle?, to?}` (round 15, uses) - a carried light on the token: each press switches it.
 * Lighting it keeps the token's light as it was on the rule's item (flags.essence20.previousLight) and sets the token
 * to `bright` / `dim` feet (`angle` degrees, default 360); the next press puts the kept light back. Whether it is lit is
 * flags.essence20.lit on the rule's item - the flags the hand-written Candle / Torch / Headlamp / Candlesprite Lantern
 * Uses kept, so a light already lit goes out on the next press. An actor with no token on the canvas only flips `lit`.
 * Chat: E20.LightOn / E20.LightOff ({name}, {item}).
 */

const localize = (key, data) => {
  const i18n = globalThis.game?.i18n;
  const text = data ? i18n?.format?.(key, data) : i18n?.localize?.(key);
  return text && text != key ? text : key;
};

export async function switchTokenLight(actor, item, light) {
  const token = actor?.getActiveTokens?.()?.[0]?.document;
  const on = !item?.flags?.essence20?.lit;
  if (token) {
    if (on) {
      const kept = token.light?.toObject?.() ?? { bright: token.light?.bright ?? 0, dim: token.light?.dim ?? 0, angle: token.light?.angle ?? 360 };
      await write(item, 'setFlag', ['essence20', 'previousLight', kept]);
      await write(token, 'update', [{ 'light.bright': light.bright, 'light.dim': light.dim, 'light.angle': light.angle ?? 360 }]);
    } else {
      const previous = item?.flags?.essence20?.previousLight ?? { bright: 0, dim: 0, angle: 360 };
      await write(token, 'update', [{ 'light.bright': previous.bright ?? 0, 'light.dim': previous.dim ?? 0, 'light.angle': previous.angle ?? 360 }]);
    }
  }

  await write(item, 'setFlag', ['essence20', 'lit', on]);
  return on;
}

registerStep('tokenLight', async (step, ctx) => {
  const light = { bright: Number(step.bright) || 0, dim: Number(step.dim) || 0, angle: step.angle === undefined ? 360 : Number(step.angle) || 360 };
  for (const actor of recipients(step, ctx)) {
    const on = await switchTokenLight(actor, ctx.item, light);
    ctx.chat.push(escape(localize(on ? 'E20.LightOn' : 'E20.LightOff', { name: actor?.name ?? '', item: ctx.item?.name ?? '' })));
  }
}, {
  errors: (step, where) => ['bright', 'dim', 'angle'].filter(key => step[key] !== undefined && !Number.isFinite(Number(step[key])))
    .map(key => `${where}: ${key} must be a number`),
});
