import { jest } from '@jest/globals';
import {
  ALT_MODE_STATUS, MORPHED_STATUS, announcementsFor, morphTransitions, syncMorphState, warnMissingStateImage,
} from './morph-state.mjs';

const altMode = { id: 'am1', name: 'Ground Vehicle Mode', img: 'alt.png', system: { tokenImage: 'alt-token.png' } };

function makeActor({ isMorphed = false, isTransformed = false, altModeId = '', effects = [] } = {}) {
  return {
    name: 'Jason',
    system: { isMorphed, isTransformed, altModeId, image: { morphed: null } },
    items: { get: (id) => (id === 'am1' ? altMode : undefined) },
    effects: { contents: effects },
    update: jest.fn(),
    toggleStatusEffect: jest.fn(async () => ({ update: jest.fn() })),
    deleteEmbeddedDocuments: jest.fn(),
  };
}

const makeEffect = (statusId) => ({ id: `e-${statusId}`, statuses: new Set([statusId]), update: jest.fn() });

describe("morphTransitions", () => {
  test("nothing for an unrelated update", () => {
    expect(morphTransitions({ system: { health: { value: 3 } } }, makeActor())).toEqual({});
  });

  test("reports morphing on and off", () => {
    expect(morphTransitions({ system: { isMorphed: true } }, makeActor({ isMorphed: true }))).toEqual({ morphed: true });
    expect(morphTransitions({ system: { isMorphed: false } }, makeActor())).toEqual({ morphed: false });
  });

  test("names the Alt Mode being entered, with its token image", () => {
    const actor = makeActor({ isTransformed: true, altModeId: 'am1' });
    expect(morphTransitions({ system: { isTransformed: true, altModeId: 'am1' } }, actor))
      .toEqual({ altMode: { active: true, name: 'Ground Vehicle Mode', img: 'alt-token.png' } });
  });

  test("a straight switch between two Alt Modes counts as entering the new one", () => {
    const actor = makeActor({ isTransformed: true, altModeId: 'am1' });
    expect(morphTransitions({ system: { altModeId: 'am1' } }, actor).altMode).toMatchObject({ active: true, name: 'Ground Vehicle Mode' });
  });

  test("an Alt Mode id change while not transformed is not a transition", () => {
    expect(morphTransitions({ system: { altModeId: 'am1' } }, makeActor())).toEqual({});
  });

  test("transforming back", () => {
    expect(morphTransitions({ system: { isTransformed: false, altModeId: '' } }, makeActor()))
      .toEqual({ altMode: { active: false, name: null, img: null } });
  });
});

describe("announcementsFor", () => {
  test("one line per transition", () => {
    const actor = makeActor();
    expect(announcementsFor({ morphed: true }, actor)).toEqual([{ key: 'E20.MorphAnnounceOn', data: { name: 'Jason' } }]);
    expect(announcementsFor({ morphed: false }, actor)).toEqual([{ key: 'E20.MorphAnnounceOff', data: { name: 'Jason' } }]);
    expect(announcementsFor({ altMode: { active: true, name: 'Jet Mode' } }, actor))
      .toEqual([{ key: 'E20.TransformAnnounceOn', data: { name: 'Jason', mode: 'Jet Mode' } }]);
    expect(announcementsFor({ altMode: { active: false, name: null } }, actor))
      .toEqual([{ key: 'E20.TransformAnnounceOff', data: { name: 'Jason' } }]);
  });

  test("nothing to say for nothing", () => {
    expect(announcementsFor({}, makeActor())).toEqual([]);
  });
});

describe("syncMorphState", () => {
  beforeEach(() => {
    global.game.user = { id: 'u1' };
    global.game.i18n = { format: jest.fn((key, data) => `${key}:${data.name}${data.mode ? ':' + data.mode : ''}`), localize: jest.fn((k) => k) };
    global.ChatMessage.create.mockClear();
  });

  test("only the client that made the update acts", async () => {
    const actor = makeActor({ isMorphed: true });
    await syncMorphState(actor, { system: { isMorphed: true } }, {}, 'someone-else');
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test("morphing adds the status and says so", async () => {
    const actor = makeActor({ isMorphed: true });

    await syncMorphState(actor, { system: { isMorphed: true } }, {}, 'u1');

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith(MORPHED_STATUS, { active: true });
    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: '<p>E20.MorphAnnounceOn:Jason</p>' }));
    // Nothing is written to the actor itself - the status is the whole visible half.
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("unmorphing removes the status", async () => {
    const actor = makeActor({ effects: [makeEffect(MORPHED_STATUS)] });

    await syncMorphState(actor, { system: { isMorphed: false } }, {}, 'u1');

    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['e-morphed']);
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("the Alt Mode status wears the Alt Mode's own name and token image", async () => {
    const created = { update: jest.fn() };
    const actor = makeActor({ isTransformed: true, altModeId: 'am1' });
    actor.toggleStatusEffect.mockResolvedValue(created);

    await syncMorphState(actor, { system: { isTransformed: true, altModeId: 'am1' } }, {}, 'u1');

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith(ALT_MODE_STATUS, { active: true });
    expect(created.update).toHaveBeenCalledWith({ name: 'Ground Vehicle Mode', img: 'alt-token.png' });
    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: '<p>E20.TransformAnnounceOn:Jason:Ground Vehicle Mode</p>' }));
  });

  test("switching Alt Modes redresses the status it already has", async () => {
    const existing = makeEffect(ALT_MODE_STATUS);
    const actor = makeActor({ isTransformed: true, altModeId: 'am1', effects: [existing] });

    await syncMorphState(actor, { system: { altModeId: 'am1' } }, {}, 'u1');

    expect(existing.update).toHaveBeenCalledWith({ name: 'Ground Vehicle Mode', img: 'alt-token.png' });
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("a Perk borrowing the Morphed benefits can keep the chat quiet", async () => {
    const actor = makeActor({ isMorphed: true });
    await syncMorphState(actor, { system: { isMorphed: true } }, { essence20: { silentState: true } }, 'u1');
    expect(actor.toggleStatusEffect).toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test("an unrelated update does nothing at all", async () => {
    const actor = makeActor();
    await syncMorphState(actor, { system: { health: { value: 1 } } }, {}, 'u1');
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("warnMissingStateImage", () => {
  beforeEach(() => {
    global.game.i18n = { format: jest.fn((key) => key), localize: jest.fn((k) => k) };
    global.ui.notifications.info.mockClear();
  });

  test("says so when no Morphed image is set", () => {
    expect(warnMissingStateImage(makeActor(), 'morph')).toBe(true);
    expect(global.ui.notifications.info).toHaveBeenCalledWith('E20.MorphNoImage');
  });

  test("stays quiet when there is one", () => {
    const actor = makeActor();
    actor.system.image.morphed = 'morphed.png';
    expect(warnMissingStateImage(actor, 'morph')).toBe(false);
    expect(global.ui.notifications.info).not.toHaveBeenCalled();
  });

  test("an Alt Mode without token art", () => {
    expect(warnMissingStateImage(makeActor(), 'altMode', { name: 'Jet Mode', system: { tokenImage: '' } })).toBe(true);
    expect(warnMissingStateImage(makeActor(), 'altMode', altMode)).toBe(false);
  });
});
