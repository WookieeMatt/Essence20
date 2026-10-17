import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";

/**
 * My Little Pony - Dark Skies over Equestria and Knights of Canterlot: the changed shape (flags.essence20.mlpShape) and
 * the shape spells. Shape-Shift, Face-Shift, Master Morph and Size-Shift are item rules (a changeShape Use and their
 * ShapeOption / RollModifier / DialogSwitch rules - rules/plugins/effects/shape-change.mjs, rules/conv15-items1.test.js).
 * Pinkie Sense is its item's own rule now; so are Softenblows (rules/conv10-slB10.test.js), Illusion Casting, Reach Out,
 * Brilliant Sight's fog option (SpellCost rules), Sharpcaster, Sorcerous Support and the Smoke Bomb
 * (rules/conv10-slD10.test.js), and Brilliant Sight's darkvision (rules/conv12-slI12.test.js). Basic Shape-Shifting and
 * Ponymorph record their spell on the shape with an afterRoll Trigger (step shapeSet - rules/conv17-split2.test.js).
 */

const SHAPE_FLAG = 'mlpShape';

/** The current changed shape: {scene, faceSkill, morphSkill, originalSize, spell}, or null. */
export function shapeOf(actor) {
  const shape = actor?.flags?.essence20?.[SHAPE_FLAG];
  return shape && shape.scene == getSceneEpoch() ? shape : null;
}

/** Take a shape for this scene. */
export async function setShape(actor, shape) {
  await actor.setFlag('essence20', SHAPE_FLAG, { ...shape, scene: getSceneEpoch() });
}
