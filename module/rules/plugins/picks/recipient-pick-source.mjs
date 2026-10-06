import { recipients, registerPickSource } from "../../steps.mjs";

/**
 * Round 15 (items2): pick source `recipients {of}` - choose one of whoever a step with `to: <of>` would reach
 * (`of: "combatAllies+self"`, `"allies:30"`, `"party"`, ...; the step's own `filter` narrows them, asked as the target).
 * The value is the actor's uuid, so `to: picked:<key>` reaches it afterwards; labelled by name. (Queen's Gambit: "an
 * ally you designate", among the combat's allies and the holder.)
 */
registerPickSource('recipients', (step, ctx) => {
  const list = recipients({ to: step.of ?? 'self', filter: step.filter }, ctx);
  return [...new Set(list)].filter(Boolean).map(actor => ({ value: actor.uuid, label: actor.name }));
});
