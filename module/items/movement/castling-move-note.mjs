import { registerChatDecorator } from "../../mechanics/item-hooks.mjs";
import { G2, perkUseCard } from "../shared/gij-crb-item-lookups.mjs";
import { TFull as T } from "../shared/item-lang.mjs";

/**
 * Castling (GI JOE CRB, Grandmaster Focus, 10th level, p.87): "They each gain one Temporary Health and may
 * immediately move up to their full Movement Rating." items/healing/castling.mjs gives the Temporary Health; the
 * Perk's use card says the move is theirs to take.
 */

export function castlingNoteDecorator(message, element) {
  if (!element?.querySelector || element.querySelector('.gij2-note')) {
    return;
  }

  const content = element.querySelector('.message-content') ?? element;
  if (perkUseCard(message, G2.castling)) {
    content.insertAdjacentHTML('beforeend', `<p class="gij2-note">${T('E20.Gij2CastlingMove')}</p>`);
  }
}

registerChatDecorator(castlingNoteDecorator);
