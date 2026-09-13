import { getNearbyEnemyTokens } from "./enemies.mjs";

/**
 * Human Bullet (Cobra Codex, Technician Rocketeer Focus, 17th level, p.66): "As long as you used
 * your Jet Pack to move this turn, you can hurl yourself to the ground as a Standard action,
 * dealing 1 Fire Damage to all creatures and objects within 30 feet of your landing position, or
 * 2 Fire Damage to all creatures and objects within 10 feet." "Used your Jet Pack this turn" is
 * dropped, the same narrow-qualifier idiom this project already applies elsewhere.
 *
 * Same Absolute-Menace-style shape as Explosive Morph/Elemental Storm (auto-target every nearby
 * enemy via canvas.tokens.setTargets(), then a real interactive roll via
 * actor._dice.rollSkill() with a synthetic dataset) - the radius/damage tradeoff is picked once up
 * front via a DialogV2 select, the same "ask before anything is spent" idiom Elemental Storm's own
 * Condition picker already established. "All creatures and objects" is narrowed to enemies only,
 * the same accepted simplification every other AoE Perk in this project already uses (an ally
 * standing in the blast isn't modeled). No Defense is named in RAW - Evasion is used, the same
 * judgment call Explosive Morph's own identical shape already made.
 */
export async function pickHumanBulletRadius() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.HumanBulletPickRadiusTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.HumanBulletPickRadiusLabel')
    }</label><select name="radius">
      <option value="30">${game.i18n.localize('E20.HumanBulletWideBlast')}</option>
      <option value="10">${game.i18n.localize('E20.HumanBulletTightBlast')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.radius.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? parseInt(chosen) : null;
}

/**
 * Prompts for the radius/damage tradeoff, auto-targets every nearby enemy at that radius, and
 * kicks off the synthetic Fire Attack.
 * @param {Actor} actor
 */
export async function activateHumanBullet(actor) {
  const radiusFeet = await pickHumanBulletRadius();
  if (!radiusFeet) {
    return;
  }

  const damageValue = radiusFeet == 30 ? 1 : 2;
  const enemies = getNearbyEnemyTokens(actor, radiusFeet);
  canvas.tokens.setTargets(enemies.map(token => token.id));

  await actor._dice.rollSkill({
    skill: 'athletics',
    essence: 'strength',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'evasion',
    isHumanBullet: true,
    humanBulletDamage: damageValue,
  }, actor);
}
