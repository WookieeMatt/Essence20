import { jest } from '@jest/globals';
import {
  grantChosenSpecialization, hasMatchingChosenSpecialization, pickChosenSpecialization,
} from './chosen-specialization.mjs';

function makeActor(perkId, choice) {
  return {
    items: choice !== undefined
      ? [{ type: 'perk', flags: { core: { sourceId: perkId } }, system: { choice } }]
      : [],
  };
}

describe("pickChosenSpecialization", () => {
  test("doesn't render a skill <select> when only one skill option exists", async () => {
    let capturedContent;
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn(({ content }) => {
              capturedContent = content;
              return Promise.resolve({ skill: 'driving', name: 'Motorcycles' });
            }),
          },
        },
      },
    };

    const result = await pickChosenSpecialization('Racer', ['driving']);
    expect(capturedContent).not.toContain('<select');
    expect(result).toEqual({ skill: 'driving', name: 'Motorcycles' });
  });

  test("returns the chosen skill and name when more than one skill option exists", async () => {
    global.foundry = {
      applications: {
        api: { DialogV2: { wait: jest.fn().mockResolvedValue({ skill: 'persuasion', name: 'Diplomacy' }) } },
      },
    };

    const result = await pickChosenSpecialization('Former Senator', ['deception', 'persuasion']);
    expect(result).toEqual({ skill: 'persuasion', name: 'Diplomacy' });
  });

  test("returns null when cancelled", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };
    expect(await pickChosenSpecialization('Racer', ['driving'])).toBeNull();
  });

  test("returns null when no name was typed", async () => {
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue({ skill: 'driving', name: '' }) } } },
    };
    expect(await pickChosenSpecialization('Racer', ['driving'])).toBeNull();
  });
});

describe("grantChosenSpecialization", () => {
  test("stores the encoded skill::name choice on the Perk item", async () => {
    global.foundry = {
      applications: {
        api: { DialogV2: { wait: jest.fn().mockResolvedValue({ skill: 'driving', name: 'Motorcycles' }) } },
      },
    };
    const perk = { name: 'Racer', update: jest.fn() };

    await grantChosenSpecialization(perk, ['driving']);

    expect(perk.update).toHaveBeenCalledWith({ 'system.choice': 'driving::Motorcycles' });
  });

  test("does nothing when the picker is cancelled", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };
    const perk = { name: 'Racer', update: jest.fn() };

    await grantChosenSpecialization(perk, ['driving']);

    expect(perk.update).not.toHaveBeenCalled();
  });
});

describe("hasMatchingChosenSpecialization", () => {
  const RACER_ID = "Compendium.essence20.tf_crb.Item.KjcoQiDoT7WEVsZX";

  test("true when the skill and specialization name both match, case-insensitively", () => {
    const actor = makeActor(RACER_ID, 'driving::Motorcycles');
    expect(hasMatchingChosenSpecialization(actor, RACER_ID, 'driving', 'motorcycles')).toBe(true);
  });

  test("false when the skill doesn't match", () => {
    const actor = makeActor(RACER_ID, 'driving::Motorcycles');
    expect(hasMatchingChosenSpecialization(actor, RACER_ID, 'targeting', 'Motorcycles')).toBe(false);
  });

  test("false when the specialization name doesn't match", () => {
    const actor = makeActor(RACER_ID, 'driving::Motorcycles');
    expect(hasMatchingChosenSpecialization(actor, RACER_ID, 'driving', 'Big Rigs')).toBe(false);
  });

  test("false with no specialization on the roll at all", () => {
    const actor = makeActor(RACER_ID, 'driving::Motorcycles');
    expect(hasMatchingChosenSpecialization(actor, RACER_ID, 'driving', undefined)).toBe(false);
  });

  test("false without the Perk at all", () => {
    const actor = makeActor(RACER_ID, undefined);
    expect(hasMatchingChosenSpecialization(actor, RACER_ID, 'driving', 'Motorcycles')).toBe(false);
  });
});
