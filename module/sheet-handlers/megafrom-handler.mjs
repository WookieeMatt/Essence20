export async function setMegaformValues(targetActor) {
  const actorSizes = Object.keys(CONFIG.E20.actorSizes);
  const newEssences = {};
  let size = 0;
  const newSkills = {};
  const newHealth = [];
  let newSize = null;
  let isTitanic = false;
  let numberOfMembers = 0;
  const newMovement = {
    aerial: {
      base: 0,
    },
    climb: {
      base: 0,
    },
    ground: {
      base: 0,
    },
    swim: {
      base: 0,
    },
  };

  if (targetActor.system.subtype == "megaformCombiner") {
    for (const actor of Object.values(targetActor.system.actors)) {
      numberOfMembers += 1;
      const fullActor = await fromUuid(actor.uuid);

      for (const [key, essence] of Object.entries(fullActor.system.essences)) {
        if (!newEssences[key] || essence.max > newEssences[key]){
          newEssences[key] = essence.max;
          for (const [skill, skillData] of Object.entries(fullActor.system.skills)){
            if (skillData.essences[key]){
              newSkills[skill] = skillData;
            }
          }
        }
      }

      isTitanic = fullActor.system.size == "gigantic";

      const currentSize = Math.max(0, (actorSizes.indexOf(fullActor.system.size)));
      if (currentSize > size)  {
        size = currentSize;
      }

      if (numberOfMembers >= 4) {
        newSize = isTitanic ? "titanic" : "towering";
      } else {
        newSize = actorSizes[size + 1];
      }

      newHealth.push(fullActor.system.health.value);

      for (const [type, movementValues] of Object.entries(fullActor.system.movement)) {
        if ((newMovement[type].base == 0 && movementValues.base > 0) || (movementValues.base > 0 && movementValues.base < newMovement[type].base)) {
          newMovement[type].base = movementValues.base;
        }
      }
    }

    targetActor.update({
      "system.health": newHealth,
      "system.size": newSize,
      "system.skills": newSkills,
      "system.essences.smarts.value": newEssences.smarts,
      "system.essences.social.value": newEssences.social,
      "system.essences.speed.value": newEssences.speed,
      "system.essences.strength.value": newEssences.strength,
      "system.movement.aerial.base": newMovement.aerial.base,
      "system.movement.climb.base": newMovement.climb.base,
      "system.movement.ground.base": newMovement.ground.base,
      "system.movement.swim.base": newMovement.swim.base,
    });
  } else if (targetActor.system.subtype == "megaformZord") {
    for (const actor of Object.values(targetActor.system.actors)) {
      const fullActor = await fromUuid(actor.uuid);

      for (const [key, essence] of Object.entries(fullActor.system.essences)) {
        if (key == "strength" || key == "speed") {
          if (!newEssences[key] || essence.value > newEssences[key]) {
            newEssences[key] = essence.value;
          }
        }
      }

      for (const childActor of Object.values(fullActor.system.actors)) {
        const fullChildActor = await fromUuid(childActor.uuid);

        for (const [key, essence] of Object.entries(fullChildActor.system.essences)) {
          if (key == "strength" || key == "speed") {
            if (essence.max > newEssences[key]) {
              newEssences[key] = essence.max;
            }
          }
        }
      }

      newHealth.push(fullActor.system.health.value);

      for (const [type, movementValues] of Object.entries(fullActor.system.movement)) {
        if ((newMovement[type].base == 0 && movementValues.base > 0) || (movementValues.base > 0 && movementValues.base < newMovement[type].base)) {
          newMovement[type].base = movementValues.base;
        }
      }
    }

    if (targetActor.system.size == "towering" || targetActor.system.size == "titanic") {
      newSize = targetActor.system.size;
    } else {
      newSize = "towering";
    }

    targetActor.update({
      "system.health": newHealth,
      "system.essences.speed.value": newEssences.speed,
      "system.essences.strength.value": newEssences.strength,
      "system.size": newSize,
      "system.movement.aerial.base": newMovement.aerial.base,
      "system.movement.climb.base": newMovement.climb.base,
      "system.movement.ground.base": newMovement.ground.base,
      "system.movement.swim.base": newMovement.swim.base,
    });
  }
}
