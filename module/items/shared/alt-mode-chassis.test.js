import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALT_MODE_CHASSIS, MERGED_ALT_MODE_UUIDS, botSizeFor, fullMovement, movementChoiceIndex, movementLabel,
} from './alt-mode-chassis.mjs';
import { currentUuid } from './item-lookups.mjs';

/** Alt Mode chassis printed with choices, one item each (2026-10-14) - the packs against the table. */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PACK_PATH = Object.fromEntries(JSON.parse(readFileSync(join(ROOT, 'system.json'), 'utf8')).packs.map(pack => [pack.name, pack.path]));
const sourceDir = uuid => join(ROOT, PACK_PATH[uuid.split('.')[2]], '_source');
const fileOf = uuid => readdirSync(sourceDir(uuid)).find(file => file.endsWith(`_${uuid.split('.').pop()}.json`)) ?? null;
const docOf = uuid => JSON.parse(readFileSync(join(sourceDir(uuid), fileOf(uuid)), 'utf8'));

describe('every chassis is one pack item carrying the book\'s choices', () => {
  test.each(Object.entries(ALT_MODE_CHASSIS))('%s', (uuid, chassis) => {
    const { name, type, system } = docOf(uuid);
    expect(type).toBe('altMode');
    expect(name).toBe(chassis.name);
    expect(chassis.alt).toContain(system.altModesize);
    expect(chassis.bot).toContain(system.botModeSize);
    expect(system.altModeSizeOptions ?? []).toEqual(chassis.alt.length > 1 ? chassis.alt : []);
    expect(system.botModeSizeOptions ?? []).toEqual(chassis.bot.length > 1 ? chassis.bot : []);
    expect(system.botModeSizeFor ?? null).toEqual(chassis.botFor ?? null);
    expect((system.movementOptions ?? []).map(fullMovement)).toEqual((chassis.movement?.length ?? 0) > 1 ? chassis.movement.map(fullMovement) : []);
    if (chassis.movement) {
      expect(chassis.movement.map(fullMovement)).toContainEqual(fullMovement(system.altModeMovement));
    }

    // The retired items are gone, and read as this one.
    for (const retired of chassis.retired) {
      expect(fileOf(retired)).toBeNull();
      expect(currentUuid(retired)).toBe(uuid);
    }
  });

  test('no pack item still points at a retired one', () => {
    const retired = Object.keys(MERGED_ALT_MODE_UUIDS);
    const offenders = [];
    for (const dir of new Set(Object.values(PACK_PATH))) {
      const src = join(ROOT, dir, '_source');
      let files = [];
      try {
        files = readdirSync(src);
      } catch (error) {
        continue;
      }

      for (const file of files.filter(f => f.endsWith('.json'))) {
        const text = readFileSync(join(src, file), 'utf8');
        if (retired.some(uuid => text.includes(uuid.split('.').pop()))) {
          offenders.push(file);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  test("Carapaced's Ground-or-Underground and Primate's Climb are the Alt Mode's own movement, not rules any more", () => {
    const carapaced = docOf('Compendium.essence20.technorganic_secrets.Item.aTevGfLML1dlbErs');
    expect(JSON.stringify(carapaced.system.rules)).not.toContain('zord2CarapacedChoice');
    expect(carapaced.system.movementOptions.map(fullMovement)).toContainEqual(fullMovement({ ground: 40, burrow: 25 }));
    const primate = docOf('Compendium.essence20.technorganic_secrets.Item.Kj8DtQoNrUf2dmI5');
    expect(JSON.stringify(primate.system.rules)).not.toContain('Climb 30');
    expect(primate.system.altModeMovement).toMatchObject({ ground: 50, climb: 30 });
  });
});

describe('helpers', () => {
  test('fullMovement fills every type; movementChoiceIndex finds the current one', () => {
    expect(fullMovement({ ground: 30, aerial: '20' })).toEqual({ ground: 30, aerial: 20, aquatic: 0, climb: 0, burrow: 0 });
    const system = { movementOptions: [{ ground: 45 }, { ground: 30, aerial: 20 }], altModeMovement: { ground: 30, aerial: 20, aquatic: 0 } };
    expect(movementChoiceIndex(system)).toBe(1);
    expect(movementChoiceIndex({ ...system, altModeMovement: { ground: 40 } })).toBe(-1);
    expect(movementChoiceIndex({})).toBe(-1);
  });

  test('botSizeFor and movementLabel', () => {
    expect(botSizeFor({ botModeSizeFor: { long: 'large' } }, 'long')).toBe('large');
    expect(botSizeFor({ botModeSizeFor: { long: 'large' } }, 'common')).toBeNull();
    expect(botSizeFor({}, 'long')).toBeNull();
    expect(movementLabel({ ground: 30, aerial: 20 })).toBe('30 ft E20.AltModeMovementGround, 20 ft E20.AltModeMovementAerial');
    expect(movementLabel({ burrow: 25 }, key => key.replace('E20.AltModeMovement', ''))).toBe('25 ft Burrow');
  });
});
