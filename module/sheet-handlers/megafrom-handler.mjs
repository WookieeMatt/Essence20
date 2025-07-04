export async function setMegaformValues(droppedActor, targetActor) {
 const essences = {};
 const skills = {};
  if (targetActor.system.subtype.includes("megaformCombiner")) {
    for (const values of Object.values(targetActor.system.actors)) {
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
    }

  }
}
