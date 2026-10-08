/**
 * The visible packs' Origins and Alt Mode chassis, for the Decepticon Directive Perks that pick a chassis by its
 * Origin (Alt Mode Mimicry, the Drone Origin).
 */

export async function originIndex() {
  const { getVisibleItemPacks } = await import("../../util/compendium-browser.mjs");
  const origins = [];
  const altModes = new Map();
  for (const pack of getVisibleItemPacks()) {
    const index = await pack.getIndex({ fields: ['type', 'system.items', 'system.altModesize', 'system.botModeSize', 'system.baseGroundMovement', 'system.baseAerialMovement', 'system.baseAquaticMovement'] });
    for (const entry of index.values()) {
      if (entry.type == 'origin') {
        origins.push(entry);
      } else if (entry.type == 'altMode') {
        altModes.set(entry.uuid, entry);
      }
    }
  }

  return { origins, altModes };
}

export const altModeUuidsOf = origin => Object.values(origin?.system?.items ?? {}).filter(e => e?.type == 'altMode').map(e => e.uuid);
