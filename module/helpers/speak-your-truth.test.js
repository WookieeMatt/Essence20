import { jest } from '@jest/globals';
import { grantSpeakYourTruthEssence, pickSpeakYourTruthEssence } from './speak-your-truth.mjs';

global.game = {
  i18n: { localize: (key) => key, format: (key) => key },
};

function makeEffect(essence) {
  return {
    changes: [{ key: `system.skills.persuasion.essences.${essence}`, mode: 5, value: 'true' }],
    disabled: true,
    update: jest.fn(),
  };
}

function makePerk() {
  const strength = makeEffect('strength');
  const speed = makeEffect('speed');
  const smarts = makeEffect('smarts');
  return { effects: { find: (fn) => [strength, speed, smarts].find(fn) }, strength, speed, smarts };
}

describe("pickSpeakYourTruthEssence", () => {
  test("returns the chosen Essence", async () => {
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn(async ({ buttons }) => buttons[0].callback(null, {
              form: { elements: { essence: { value: 'speed' } } },
            })),
          },
        },
      },
    };

    expect(await pickSpeakYourTruthEssence()).toBe('speed');
  });

  test("null when cancelled", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn(async () => 'cancel') } } } };
    expect(await pickSpeakYourTruthEssence()).toBeNull();
  });
});

describe("grantSpeakYourTruthEssence", () => {
  test("enables only the matching effect", async () => {
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn(async ({ buttons }) => buttons[0].callback(null, {
              form: { elements: { essence: { value: 'smarts' } } },
            })),
          },
        },
      },
    };
    const perk = makePerk();

    await grantSpeakYourTruthEssence(perk);

    expect(perk.smarts.update).toHaveBeenCalledWith({ disabled: false });
    expect(perk.strength.update).not.toHaveBeenCalled();
    expect(perk.speed.update).not.toHaveBeenCalled();
  });

  test("does nothing when cancelled", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn(async () => 'cancel') } } } };
    const perk = makePerk();

    await grantSpeakYourTruthEssence(perk);

    expect(perk.strength.update).not.toHaveBeenCalled();
    expect(perk.speed.update).not.toHaveBeenCalled();
    expect(perk.smarts.update).not.toHaveBeenCalled();
  });
});
