export async function prepareAttachedActors(actor, context) {
  if(actor.system.actors) {
    let attachedActors = [];

    for (const [, crew] of Object.entries(actor.system.actors)) {
        attachedActors.push(await fromUuid(crew.uuid));
    }

    context.attachedActors = attachedActors;
  }
}
