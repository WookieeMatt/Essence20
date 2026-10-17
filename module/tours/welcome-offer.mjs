/**
 * The one-off "this system has guided tours" chat card.
 *
 * Tours nobody knows about are wasted, and Tour Management is three clicks deep in the Settings
 * sidebar — nobody finds it by accident. This posts a single card into a new world pointing at the
 * welcome tour.
 *
 * Deliberately an *offer*, never an auto-start: a tour that seizes the screen the moment someone
 * logs in is hostile, and would be worst for the person it is least aimed at — the GM mid-prep who
 * has seen it before.
 *
 * @see docs/TOURS_PLAN.md §4
 */

/** Flag identifying our card, so the render hook only wires up its own messages. @type {string} */
const OFFER_FLAG = "tourOffer";

/** The tour the card offers. @type {string} */
const OFFER_TOUR = "essence20.welcome";

/**
 * Post the welcome card, once per world.
 *
 * Only the GM posts — the setting is world-scoped, so five players connecting at once would
 * otherwise race to create five identical cards.
 * @returns {Promise<void>}
 */
export async function offerWelcomeTour() {
  if (!game.user.isGM) return;
  if (game.settings.get("essence20", "tourWelcomeOffered")) return;

  const tour = game.tours.get(OFFER_TOUR);
  if (!tour || (tour.status !== foundry.nue.Tour.STATUS.UNSTARTED)) return;

  // Set the flag first. If the message fails to create we would rather skip the card than retry
  // it on every single load forever.
  await game.settings.set("essence20", "tourWelcomeOffered", true);

  await ChatMessage.create({
    content: `
      <div class="essence20-tour-offer">
        <h3>${game.i18n.localize("E20.TourOfferTitle")}</h3>
        <p>${game.i18n.localize("E20.TourOfferContent")}</p>
        <button type="button" data-action="startWelcomeTour">
          <i class="fas fa-route"></i> ${game.i18n.localize("E20.TourOfferButton")}
        </button>
      </div>`,
    flags: { essence20: { [OFFER_FLAG]: true } },
    whisper: [game.user.id],
  });
}

/**
 * Wire up the card's button. Called from the system's `renderChatMessageHTML` hook.
 * @param {ChatMessage} message   The message being rendered.
 * @param {HTMLElement} html      Its rendered element.
 */
export function activateWelcomeOfferListeners(message, html) {
  if (!message.getFlag("essence20", OFFER_FLAG)) return;

  const button = html.querySelector("[data-action='startWelcomeTour']");
  if (!button) return;

  button.addEventListener("click", async () => {
    const tour = game.tours.get(OFFER_TOUR);
    if (!tour) return;

    button.disabled = true;
    await tour.start();
  });
}
