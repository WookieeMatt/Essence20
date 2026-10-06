import { isActiveForWindow } from "../../../mechanics/resources/scene-clock.mjs";
import { registerTag } from "../../predicate.mjs";

/**
 * Group A (round 10): tag `self:clockActive:<flag>` - a Scene Clock window flag (mechanics/resources/scene-clock.mjs) is
 * live for the scene or the mission (Hybridization's Change Size).
 */

registerTag('self:clockActive', (rest, ctx) => !!ctx.self && (isActiveForWindow(ctx.self, rest, 'scene') || isActiveForWindow(ctx.self, rest, 'mission')));
