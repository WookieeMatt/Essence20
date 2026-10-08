// Rules-engine plug-in, book check 2026-10-06 (limits - docs/rules-batches/book-limits.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { epochFor } from "../../../mechanics/resources/scene-clock.mjs";
import { registerRef } from "../../formula.mjs";
import { sessionEpoch } from "../../limits.mjs";

/**
 * Ref `@clock.<scene | encounter | mission | session>` - the current count of that window (the Scene Clock's epochs; the
 * session counter the Story Points app's New Session advances). Stored on an actor with `updateActor {set}` and compared
 * back with a `calc:` tag, it marks "used in this window" for a choice inside a run - Private Barter's once-per-session
 * pick inside Cache I, a Jury Rig benefit that lasts until the scene ends. Anything else - 0.
 */
registerRef('clock', key => {
  const window = String(key ?? '');
  if (window == 'session') {
    return sessionEpoch();
  }

  return ['scene', 'encounter', 'mission'].includes(window) ? Number(epochFor(window)) || 0 : 0;
});
