/**
 * Takedown Expert's "silenced" (G.I. Joe) - no such Condition in the system before this, so it is added to
 * CONFIG.statusEffects at setup. (Takedown Expert's choice itself is a miss Trigger on its pack item.)
 */

export function addSilencedStatus() {
  const list = CONFIG?.statusEffects;
  if (Array.isArray(list) && !list.some(effect => effect.id == 'silenced')) {
    list.push({ id: 'silenced', name: 'E20.Gij3StatusSilenced', img: 'icons/svg/silenced.svg', changes: [] });
  }
}

if (typeof Hooks != 'undefined') {
  Hooks.once('setup', () => {
    addSilencedStatus();
  });
}
