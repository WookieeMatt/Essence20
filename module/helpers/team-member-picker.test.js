import { jest } from '@jest/globals';
import { pickSelfOrTeamMember } from './team-member-picker.mjs';

function makeActor(uuid, name, type = 'playerCharacter') {
  return { uuid, name, type };
}

beforeEach(() => {
  global.fromUuidSync = jest.fn();
});

describe("pickSelfOrTeamMember", () => {
  test("returns the caster when 'Yourself' is chosen", async () => {
    const caster = makeActor('Actor.caster1', 'Aqua Ranger');
    global.game.actors = [caster];
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('Actor.caster1') } } },
    };

    const result = await pickSelfOrTeamMember(caster, 'Wind Whispers');

    expect(result).toBe(caster);
  });

  test("resolves and returns the chosen teammate", async () => {
    const caster = makeActor('Actor.caster1', 'Aqua Ranger');
    const teammate = makeActor('Actor.teammate1', 'Silver Ranger');
    global.game.actors = [caster, teammate];
    global.fromUuidSync.mockReturnValue(teammate);
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('Actor.teammate1') } } },
    };

    const result = await pickSelfOrTeamMember(caster, 'Wind Whispers');

    expect(result).toBe(teammate);
    expect(global.fromUuidSync).toHaveBeenCalledWith('Actor.teammate1');
  });

  test("excludes non-playerCharacter actors and the caster from the teammate list", async () => {
    const caster = makeActor('Actor.caster1', 'Aqua Ranger');
    const npc = makeActor('Actor.npc1', 'A Threat', 'npc');
    let capturedContent;
    global.game.actors = [caster, npc];
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn(({ content }) => {
              capturedContent = content;
              return Promise.resolve('cancel');
            }),
          },
        },
      },
    };

    await pickSelfOrTeamMember(caster, 'Wind Whispers');

    expect(capturedContent).not.toContain('A Threat');
    // The caster's own uuid appears exactly once, as the "Yourself" option - not a second time
    // as its own separate teammate entry.
    expect(capturedContent.match(/Actor\.caster1/g)).toHaveLength(1);
  });

  test("returns null when cancelled", async () => {
    const caster = makeActor('Actor.caster1', 'Aqua Ranger');
    global.game.actors = [caster];
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } },
    };

    expect(await pickSelfOrTeamMember(caster, 'Wind Whispers')).toBeNull();
  });
});
