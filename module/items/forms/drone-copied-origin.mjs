import { registerUse } from "../../mechanics/item-hooks.mjs";
import { chooseSelect, TF1 } from "../shared/condition-damage-buttons.mjs";
import { T } from "../shared/item-lang.mjs";
import { sourceOfOrUndefined as sourceOf } from "../shared/item-lookups.mjs";
import { altModeUuidsOf, originIndex } from "../shared/origin-chassis-index.mjs";

/**
 * The Drone Origin's copied Origin: its Use button picks the Origin (and its chassis) the Bot and Alt Mode statistics
 * come from.
 */
export const DRONE_USE = {
  // Drone (Decepticon Directive, Origin, p.33): "Choose another Origin; all your Bot and Alt Mode
  // statistics are based upon that copied Origin." Bot Mode Movement and Size, and the Alt Mode, come
  // from the copied Origin.
  id: 'tf1Drone', matches: item => sourceOf(item) == TF1.drone,
  canUse: item => !item.flags?.essence20?.copiedOrigin,
  async run(item) {
    const actor = item.parent;
    const { origins, altModes } = await originIndex();
    const rows = origins.filter(o => o.uuid != TF1.drone && altModeUuidsOf(o).length)
      .map(o => ({ value: o.uuid, label: o.name })).sort((a, b) => a.label.localeCompare(b.label));
    const originUuid = await chooseSelect(item.name, T('Tf1PickCopiedOrigin'), rows);
    const origin = origins.find(o => o.uuid == originUuid);
    if (!origin) {
      return null;
    }

    const modes = altModeUuidsOf(origin);
    const modeUuid = modes.length > 1
      ? await chooseSelect(item.name, T('Tf1PickChassis'), modes.map(u => ({ value: u, label: altModes.get(u)?.name ?? u })))
      : modes[0];
    if (!modeUuid) {
      return null;
    }

    const { grantCopy } = await import("../../mechanics/resources/grants.mjs");
    const created = await grantCopy(actor, modeUuid, { flags: { parentId: item.id } });
    const botSize = created?.system?.botModeSize;
    await actor.update({
      'system.canTransform': true,
      'system.movement.ground.base': Number(origin.system?.baseGroundMovement) || 0,
      'system.movement.aerial.base': Number(origin.system?.baseAerialMovement) || 0,
      'system.movement.swim.base': Number(origin.system?.baseAquaticMovement) || 0,
      ...(botSize ? { 'system.size': botSize } : {}),
    });
    await item.setFlag('essence20', 'copiedOrigin', origin.uuid);
    return T('Tf1DroneCopied', { name: actor.name, origin: origin.name, mode: created?.name ?? '' });
  },
};

registerUse(DRONE_USE);
