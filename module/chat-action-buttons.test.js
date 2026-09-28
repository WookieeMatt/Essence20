/**
 * Where the post-roll chat buttons land in a rendered card, so this suite needs a DOM.
 *
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { addHighDensityButton, runChatDecorators } from "./chat.mjs";

// Foundry core's roll markup: the formula and total both live inside .dice-roll.
function renderCard() {
  document.body.innerHTML = `
    <li class="chat-message">
      <div class="message-content">
        <div class="e20-check-card">
          <div class="dice-roll"><div class="dice-formula">1d20</div><h4 class="dice-total">14</h4></div>
        </div>
      </div>
    </li>`;
  return document.querySelector(".chat-message");
}

function highDensityHit() {
  return {
    isRoll: true,
    isContentVisible: true,
    rolls: [{}],
    speaker: { actor: "a1" },
    flags: { essence20: { isAttack: true, isHighDensityAttack: true, rollFailed: false, itemUuid: "Actor.a1.Item.e1" } },
    getFlag: () => undefined,
  };
}

describe("post-roll chat buttons", () => {
  beforeEach(() => {
    ChatMessage.getSpeakerActor = jest.fn(() => ({ isOwner: true }));
    fromUuidSync.mockReturnValue({ uuid: "Actor.a1.Item.e1" });
  });

  afterEach(() => {
    fromUuidSync.mockReset();
  });

  // Inside .dice-roll the button sat above the formula and total and read as part of the roll.
  test("go below the roll, not inside it, styled as a chat action button", () => {
    const html = renderCard();
    addHighDensityButton(highDensityHit(), html);

    const button = html.querySelector(".e20-high-density-button");
    expect(button).not.toBeNull();
    expect(button.classList.contains("e20-chat-action-button")).toBe(true);
    expect(html.querySelector(".dice-roll .e20-high-density-button")).toBeNull();
    expect(html.querySelector(".dice-roll").nextElementSibling.classList.contains("e20-chat-action-buttons")).toBe(true);
  });

  test("several buttons on one card share the one row", () => {
    const html = renderCard();
    addHighDensityButton(highDensityHit(), html);
    addHighDensityButton(highDensityHit(), html);
    expect(html.querySelectorAll(".e20-chat-action-buttons")).toHaveLength(1);
    expect(html.querySelectorAll(".e20-chat-action-buttons button")).toHaveLength(2);
  });
});

describe("runChatDecorators", () => {
  let consoleError;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    ChatMessage.getSpeakerActor = jest.fn(() => ({ isOwner: true }));
    fromUuidSync.mockReturnValue({ uuid: "Actor.a1.Item.e1" });
  });

  afterEach(() => {
    consoleError.mockRestore();
    fromUuidSync.mockReset();
  });

  test("an earlier decorator that throws doesn't stop the High-Density button", () => {
    const html = renderCard();
    function brokenSpiteButton() {
      throw new Error("boom");
    }

    runChatDecorators([brokenSpiteButton, addHighDensityButton], highDensityHit(), html);
    expect(html.querySelector(".e20-high-density-button")).not.toBeNull();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("brokenSpiteButton"), expect.any(Error));
  });

  test("an async decorator that rejects is logged, not left unhandled, and the rest still run", async () => {
    const after = jest.fn();
    async function brokenAsync() {
      throw new Error("later");
    }

    runChatDecorators([brokenAsync, after], { id: "m1" }, document.createElement("li"));
    await Promise.resolve();
    await Promise.resolve();
    expect(after).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("brokenAsync"), expect.any(Error));
  });
});
