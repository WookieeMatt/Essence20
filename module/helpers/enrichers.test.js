/**
 * @jest-environment jsdom
 *
 * enrichCheck builds real DOM nodes (document.createElement) - scoped to just this file via
 * the docblock above rather than changing jest.config.js's shared default (jsdom is heavier
 * and every other test file's mocks assume the lighter default "node" environment).
 */
import { jest } from '@jest/globals';
import { enrichCheck, onCheckLinkClick, onCheckSendToChat } from './enrichers.mjs';

// Following the pattern established in dice.test.js: fully replace jest.setup.js's global.game
// stub with one tailored to what this file's exports actually read (game.user.isGM,
// game.user.character, i18n passthrough), rather than extending the shared default.
function setGameUser(isGM, character = null) {
  global.game = {
    user: { isGM, character },
    i18n: {
      localize: (key) => key,
      format: (key, data) => `${key}${data ? ` ${JSON.stringify(data)}` : ''}`,
    },
  };
}

/** A minimal RegExpMatchArray stand-in - enrichCheck only ever indexes match[1]/match[2]. */
function checkMatch(paramsString, customLabel) {
  return [`@Check[${paramsString}]`, paramsString, customLabel];
}

describe("enrichCheck", () => {
  beforeEach(() => setGameUser(true));

  test("GM viewing a skill+dif check sees the DIF in the label and dataset", async () => {
    // GM view returns the wrapper (this describe block's next test covers that shape) - the
    // skill/dif dataset actually being asserted here lives on the inner content-link anchor.
    const wrapper = await enrichCheck(checkMatch("skill=technology dif=15"));
    const anchor = wrapper.querySelector('.content-link');
    expect(anchor.dataset.skill).toBe("technology");
    expect(anchor.dataset.dif).toBe("15");
    expect(anchor.innerHTML).toContain("15");
  });

  test("GM check renders as a wrapper with a send-to-chat trigger alongside the anchor", async () => {
    const wrapper = await enrichCheck(checkMatch("skill=technology dif=15"));
    expect(wrapper.classList.contains('e20-check-wrapper')).toBe(true);
    expect(wrapper.querySelector('.content-link')).not.toBeNull();
    expect(wrapper.querySelector('.e20-check-send-to-chat')).not.toBeNull();
  });

  test("non-GM viewer never sees the DIF, in the label or the dataset", async () => {
    setGameUser(false);
    const anchor = await enrichCheck(checkMatch("skill=technology dif=15"));
    expect(anchor.dataset.dif).toBeUndefined();
    expect(anchor.innerHTML).not.toContain("15");
  });

  test("non-GM check renders as a bare anchor, not the GM's wrapper+send-to-chat", async () => {
    setGameUser(false);
    const result = await enrichCheck(checkMatch("skill=technology dif=15"));
    expect(result.classList.contains('content-link')).toBe(true);
    expect(result.classList.contains('e20-check-wrapper')).toBe(false);
  });

  test("a defense reference shows for both GM and non-GM viewers", async () => {
    setGameUser(false);
    const anchor = await enrichCheck(checkMatch("skill=technology defense=toughness"));
    expect(anchor.dataset.defense).toBe("toughness");
    // The stub i18n.localize() just echoes the key back rather than a real human string, so
    // the real config's localization key is what shows up in the rendered label here.
    expect(anchor.innerHTML).toContain("E20.DefenseToughness");
  });

  test("a spec reference adds the Specialization to the label and dataset for both GM and non-GM viewers", async () => {
    setGameUser(false);
    const anchor = await enrichCheck(checkMatch("skill=alertness spec=investigation dif=12"));
    // Only a hint lives on the rendered link - whether the CLICKING actor actually has this
    // Specialization (and so whether the roll should really be Specialized) is resolved later,
    // per-actor, in onCheckLinkClick - see its own describe block below.
    expect(anchor.dataset.specializationHint).toBe("investigation");
    expect(anchor.dataset.isSpecialized).toBeUndefined();
    expect(anchor.innerHTML).toContain("Investigation");
    // dif is still GM-only even alongside spec.
    expect(anchor.dataset.dif).toBeUndefined();
    expect(anchor.innerHTML).not.toContain("12");
  });

  test("a camelCase spec key is split into separate title-cased words for display", async () => {
    setGameUser(false);
    const anchor = await enrichCheck(checkMatch("skill=alertness spec=underTheRadar"));
    expect(anchor.innerHTML).toContain("Under The Radar");
  });

  test("GM check with spec also carries it on the send-to-chat trigger", async () => {
    const wrapper = await enrichCheck(checkMatch("skill=alertness spec=investigation dif=12"));
    const sendToChat = wrapper.querySelector('.e20-check-send-to-chat');
    expect(sendToChat.dataset.spec).toBe("investigation");
  });

  test("a custom {Label} suffix overrides the generated label", async () => {
    const wrapper = await enrichCheck(checkMatch("skill=technology dif=15", "Hack the Mainframe"));
    const anchor = wrapper.querySelector('.content-link');
    expect(anchor.innerHTML).toContain("Hack the Mainframe");
    // The generated "(DIF 15)" suffix is what the custom label replaces - dif=15 legitimately
    // still lives on the anchor's own dataset (asserted separately above) and on the sibling
    // send-to-chat button (so it can reconstruct the original @Check[...] source), so this
    // checks the visible label text specifically rather than the wrapper's full innerHTML.
    expect(anchor.textContent).not.toContain("15");
  });
});

describe("onCheckLinkClick", () => {
  test("rolls the clicked skill for the user's assigned character", async () => {
    const rollSkill = jest.fn();
    const actor = { _dice: { rollSkill } };
    setGameUser(false, actor);

    const event = { preventDefault: jest.fn() };
    const link = { dataset: { skill: "technology", dif: "15" } };
    await onCheckLinkClick(event, link);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: "technology", dif: "15" }),
      actor,
    );
  });

  test("resolves the spec hint against the actor's own Specializations and rolls it Specialized", async () => {
    const rollSkill = jest.fn();
    const actor = {
      _dice: { rollSkill },
      system: {
        skills: {
          alertness: {
            specializations: {
              investigation: { name: "Investigation", shiftUp: 0, shiftDown: 0 },
            },
          },
        },
      },
    };
    setGameUser(false, actor);

    const event = { preventDefault: jest.fn() };
    const link = { dataset: { skill: "alertness", specializationHint: "investigation" } };
    await onCheckLinkClick(event, link);

    expect(rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: "alertness", specializationKey: "investigation", specializationName: "Investigation", isSpecialized: true,
      }),
      actor,
    );
  });

  test("rolls as an ordinary, unspecialized skill test when the actor doesn't have the hinted Specialization", async () => {
    const rollSkill = jest.fn();
    // No system.skills.alertness.specializations at all - the actor has never taken it.
    const actor = { _dice: { rollSkill }, system: { skills: {} } };
    setGameUser(false, actor);

    const event = { preventDefault: jest.fn() };
    const link = { dataset: { skill: "alertness", specializationHint: "investigation" } };
    await onCheckLinkClick(event, link);

    expect(rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: "alertness", isSpecialized: false, specializationKey: undefined, specializationName: undefined,
      }),
      actor,
    );
  });

  test("falls back to a single controlled token's actor when no character is assigned", async () => {
    const rollSkill = jest.fn();
    const tokenActor = { _dice: { rollSkill } };
    setGameUser(false, null);
    global.canvas = { tokens: { controlled: [{ actor: tokenActor }] } };

    const event = { preventDefault: jest.fn() };
    const link = { dataset: { skill: "technology" } };
    await onCheckLinkClick(event, link);

    expect(rollSkill).toHaveBeenCalledWith(expect.anything(), tokenActor);
  });

  test("warns and does not roll when there's no character or controlled token", async () => {
    setGameUser(false, null);
    global.canvas = { tokens: { controlled: [] } };
    global.ui = { notifications: { warn: jest.fn() } };

    const event = { preventDefault: jest.fn() };
    const link = { dataset: { skill: "technology" } };
    await onCheckLinkClick(event, link);

    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("onCheckSendToChat", () => {
  beforeEach(() => {
    setGameUser(true);
    global.ChatMessage = {
      create: jest.fn(),
      getSpeaker: jest.fn(() => ({})),
    };
  });

  test("posts the raw @Check[...] source with skill and dif", async () => {
    const event = { preventDefault: jest.fn() };
    const button = { dataset: { skill: "technology", dif: "15" } };
    await onCheckSendToChat(event, button);

    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: "@Check[skill=technology dif=15]",
    }));
  });

  test("posts the raw @Check[...] source with spec", async () => {
    const event = { preventDefault: jest.fn() };
    const button = { dataset: { skill: "alertness", spec: "investigation", dif: "12" } };
    await onCheckSendToChat(event, button);

    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: "@Check[skill=alertness spec=investigation dif=12]",
    }));
  });

  test("omits dif from the posted source when the button didn't carry one", async () => {
    const event = { preventDefault: jest.fn() };
    const button = { dataset: { skill: "technology", defense: "toughness" } };
    await onCheckSendToChat(event, button);

    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: "@Check[skill=technology defense=toughness]",
    }));
  });
});
