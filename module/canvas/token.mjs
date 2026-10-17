import { getEffectStacks } from "../mechanics/vehicles/vessel-conditions.mjs";

/**
 * The effects core's Token#_drawEffects draws as small status icons, in the order it draws them
 * (each icon's zIndex is its index here) - the same filter core applies.
 * @param {Actor} actor
 * @returns {Array<ActiveEffect>}
 */
export function getDrawnStatusEffects(actor) {
  const SHOW_ICON = CONST.ACTIVE_EFFECT_SHOW_ICON;
  return actor?.appliedEffects?.filter(effect => (effect.showIcon === SHOW_ICON.ALWAYS)
    || ((effect.showIcon === SHOW_ICON.CONDITIONAL) && effect.isTemporary)) ?? [];
}

/**
 * The stack badges one token needs: `{index, stacks}` for every drawn effect carrying more than
 * one stack (Space Vessel Conditions - see mechanics/vehicles/vessel-conditions.mjs).
 * @param {Actor} actor
 * @returns {Array<{index: Number, stacks: Number}>}
 */
export function getStackBadges(actor) {
  return getDrawnStatusEffects(actor)
    .map((effect, index) => ({ index, stacks: getEffectStacks(effect) }))
    .filter(badge => badge.stacks > 1);
}

/**
 * Builds the Token placeable class this system installs as CONFIG.Token.objectClass: core's Token,
 * plus a small count drawn over any status icon that stacks. Built from the live core class on
 * demand, so this file stays importable in unit tests.
 * @param {typeof foundry.canvas.placeables.Token} Token
 * @returns {Class}
 */
export function makeEssence20Token(Token) {
  return class Essence20Token extends Token {
    /**
     * A status filter (Invisible) applied before the token has drawn its mesh - a Condition landing on a token placed a
     * moment ago - threw inside core and failed the whole actor's data preparation (play-through 2026-10-07). Core
     * applies the filter again once the token draws (_updateSpecialStatusFilterEffects), so waiting is safe.
     * @override
     */
    _configureFilterEffect(statusId, active) {
      if (!this.mesh) {
        return;
      }

      return super._configureFilterEffect(statusId, active);
    }

    /** @override */
    async _drawEffects() {
      await super._drawEffects();

      for (const { index, stacks } of getStackBadges(this.actor)) {
        const icon = this.effects.children.find(child => child !== this.effects.bg && child.zIndex === index);
        if (!icon?.texture) {
          continue;
        }

        // A child of the icon sprite, so it follows the icon's own size and position as core
        // lays the icons out; sized in the texture's own pixels for the same reason.
        const size = icon.texture.height || 100;
        const badge = new PIXI.Text(String(stacks), {
          fontFamily: "Signika", fontSize: size * 0.6, fontWeight: "bold", fill: 0xffffff,
          stroke: 0x000000, strokeThickness: size * 0.12,
        });
        badge.anchor.set(1, 1);
        badge.position.set(icon.texture.width || size, size);
        icon.addChild(badge);
      }
    }
  };
}
