export async function setMegaformValues(targetActor) {
  const actorSizes = Object.keys(CONFIG.E20.actorSizes);
  const essences = {};
  let size = 0;
  const skills = {};
  const health = [];
  let newSize = null;
  let isTitanic = false;
  let numberOfMembers = 0;
  const movement = {
    aerial: {
      base: 0
    },
    climb: {
      base: 0
    },
    ground: {
      base: 0
    },
    swim: {
      base: 0
    },
  };

  if (targetActor.system.subtype.includes("megaformCombiner")) {
    for (const values of Object.values(targetActor.system.actors)) {
      numberOfMembers += 1;
      const fullActor = await fromUuid(values.uuid);

      for (const [key, entries] of Object.entries(fullActor.system.essences)) {
        if (!essences[key]) {
          essences[key] = entries.max;
          for (const [skill, skillData] of Object.entries(fullActor.system.skills)){
            if (skillData.essences[key]) {
              skills[skill] = skillData;
            }
          }
        } else if (entries.max > essences[key]) {
          essences[key] = entries.max;
          for (const [skill, skillData] of Object.entries(fullActor.system.skills)){
            if (skillData.essences[key]) {
              skills[skill] = skillData;
            }
          }
        }
      }

      if (fullActor.system.size == "gigantic") {
          isTitanic = true;
        }
        const currentSize = Math.max(0, (actorSizes.indexOf(fullActor.system.size)));
        if (currentSize > size)  {
          size = currentSize;
        }

        if (numberOfMembers >= 4 && isTitanic) {
          newSize = "titanic";
        } else if (numberOfMembers >= 4) {
          newSize = "towering";
        } else {
          newSize = actorSizes[size + 1];
        }
      health.push(fullActor.system.health.value);

      for (const [type, movementValues] of Object.entries(fullActor.system.movement)) {
        console.log(movementValues)
        if (movement[type].base == 0 && movementValues.base > 0) {
          movement[type].base = movementValues.base;
        }
        if (movementValues.base > 0 && movementValues.base < movement[type].base) {
          movement[type].base = movementValues.base;
        }
      }
    }

    targetActor.update({
      "system.health": health,
      "system.size": newSize,
      "system.skills": skills,
      "system.essences.smarts.value": essences.smarts,
      "system.essences.social.value": essences.social,
      "system.essences.speed.value": essences.speed,
      "system.essences.strength.value": essences.strength,
      "system.movement.aerial.base": movement.aerial.base,
      "system.movement.climb.base": movement.climb.base,
      "system.movement.ground.base": movement.ground.base,
      "system.movement.swim.base": movement.swim.base,
    });

  } else if (targetActor.system.subtype.includes("megaformZord")) {
    for (const values of Object.values(targetActor.system.actors)) {
      const fullActor = await fromUuid(values.uuid);

      for (const [key, entries] of Object.entries(fullActor.system.essences)) {
        if (key == "strength" || key == "speed") {
          if (!essences[key]) {
            essences[key] = entries.value;
          } else if (entries.max > essences[key]) {
            essences[key] = entries.value;
          }
        }
      }

      if (Object.keys(fullActor.system.actors).length) {
        for (const childActor of Object.values(fullActor.system.actors)) {
          const fullChildActor = await fromUuid(childActor.uuid);

          for (const [key, entries] of Object.entries(fullChildActor.system.essences)) {
            if (key == "strength" || key == "speed") {
              console.log("Got Here")
              if (entries.max > essences[key]) {
                essences[key] = entries.max;
              }
            }
          }

        }
      }

      health.push(fullActor.system.health.value);
      if (fullActor.movement.ground.base > 0 && movement.ground.base == 0) {
        movement.ground.base = fullActor.movement.ground.base;
      }

      if (fullActor.movement.ground.base > 0 && fullActor.movement.ground.base < movement.ground.base) {
        movement.ground.base = fullActor.movement.ground.base;
      }
    }
    if (targetActor.system.size == "towering" || targetActor.system.size == "titanic") {
      newSize = targetActor.system.size;
    } else {
      newSize = "towering";
    }
    targetActor.update({
      "system.health": health,
      "system.essences.speed.value": essences.speed,
      "system.essences.strength.value": essences.strength,
      "system.size": newSize,
    });
  }
}
