/**
 * Hook registration that is a no-op without a Hooks global (Jest), and "is this the client that
 * should do it" checks. Light on purpose - imports nothing.
 *
 * isActiveGm and isActiveGmById agree in a live world; they read the active GM differently
 * (its isSelf flag vs comparing user ids) and answer differently when there's no active GM.
 */

/** Hooks.on, when there is a Hooks. */
export function onHook(name, fn) {
  return globalThis.Hooks?.on?.(name, fn);
}

/** Hooks.once, when there is a Hooks. */
export function onceHook(name, fn) {
  globalThis.Hooks?.once?.(name, fn);
}

/** Whether this client should run a GM-side sweep: the active GM, or any GM when none is active. */
export function isActiveGm() {
  const active = game.users?.activeGM;
  return active ? !!active.isSelf : !!game.user?.isGM;
}

/** The Game Master's client does the world writes (one GM, so nothing runs twice). */
export const isActiveGmById = () => {
  const g = globalThis.game;
  return !!g?.user?.isGM && (!g.users?.activeGM || g.users.activeGM.id == g.user.id);
};
