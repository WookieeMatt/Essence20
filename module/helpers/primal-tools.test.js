import { jest } from '@jest/globals';
import { grantPrimalTools } from './primal-tools.mjs';

function makeActor(items = []) {
  return { items };
}

beforeEach(() => {
  global.Item = {
    create: jest.fn(async (data) => ({
      id: data.name + '-id',
      _id: data.name + '-id',
      name: data.name,
      type: data.type,
      system: JSON.parse(JSON.stringify(data.system)),
      flags: data.flags ?? {},
      setFlag: jest.fn(async function (scope, key, value) {
        this.flags[scope] = this.flags[scope] ?? {};
        this.flags[scope][key] = value;
      }),
      update: jest.fn(async function (updateData) {
        for (const [path, value] of Object.entries(updateData)) {
          const keys = path.replace(/^system\./, '').split('.');
          let target = this.system;
          for (let i = 0; i < keys.length - 1; i++) {
            target = target[keys[i]];
          }

          target[keys[keys.length - 1]] = value;
        }
      }),
    })),
  };
});

describe("Primal Tools (Decepticon Directive, Shredder Focus, 1st level, p.58)", () => {
  test("grants an integrated weapon with a Stun and a Sharp weaponEffect, both Multiple(2) (↓1)", async () => {
    const actor = makeActor();

    await grantPrimalTools(actor);

    expect(Item.create).toHaveBeenCalledTimes(3);
    const weaponCall = Item.create.mock.calls[0][0];
    expect(weaponCall).toMatchObject({ name: 'Primal Tools', type: 'weapon' });

    const stunCall = Item.create.mock.calls[1][0];
    expect(stunCall).toMatchObject({
      name: 'Primal Tools (Stun)',
      type: 'weaponEffect',
      system: expect.objectContaining({ damageType: 'stun', damageValue: 1, numTargets: 2, shiftDown: 1 }),
    });

    const sharpCall = Item.create.mock.calls[2][0];
    expect(sharpCall).toMatchObject({
      name: 'Primal Tools (Sharp)',
      type: 'weaponEffect',
      system: expect.objectContaining({ damageType: 'sharp', damageValue: 1, numTargets: 2, shiftDown: 1 }),
    });
  });

  test("is a no-op if the actor already has one", async () => {
    const existing = { type: 'weapon', flags: { essence20: { isPrimalTools: true } } };
    const actor = makeActor([existing]);

    await grantPrimalTools(actor);

    expect(Item.create).not.toHaveBeenCalled();
  });
});
