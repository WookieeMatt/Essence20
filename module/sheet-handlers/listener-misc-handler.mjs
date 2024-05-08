

  /**
   * Handle clickable rolls.
   * @param {Actor} actor The Actor making the roll
   * @param {Event} event The originating click event
   * @private
   */
  export async function onRoll(event, actor) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;
    const rollType = dataset.rollType;

    if (!rollType) {
      return;
    }

    // Handle type-specific rolls.
    if (rollType == 'skill') {
      actor.rollSkill(dataset);
    } else if (rollType == 'initiative') {
      actor.rollInitiative({createCombatants: true});
    } else { // Handle items
      let item = null;

      const childKey = element.closest('.item').dataset.itemKey || null;
      if (childKey) {
        const childUuid = element.closest('.item').dataset.itemUuid;
        item = await fromUuid(childUuid);
      } else {
        const itemId = element.closest('.item').dataset.itemId;
        item = actor.items.get(itemId);
      }

      if (rollType == 'power') {
        return await powerCost(actor, item);
      } else if (rollType == 'rolePoints') {
        if (item.system.resource.max != null && item.system.resource.value < 1 && !actor.system.useUnlimitedResource) {
          ui.notifications.error(game.i18n.localize('E20.RolePointsOverSpent'));
          return;
        } else {
          const spentStrings = [];

          // Ensure we have enough Personal Power, if needed
          if (item.system.powerCost) {
            if (actor.system.powers.personal.value < item.system.powerCost) {
              ui.notifications.error(game.i18n.localize('E20.PowerOverSpent'));
              return;
            } else {
              await actor.update({
                ['system.powers.personal.value']:
                  actor.system.powers.personal.value - item.system.powerCost,
              });

              spentStrings.push(`${item.system.powerCost} Power`);
            }
          }

          // If Role Points are being used and not unlimited, decrement uses
          if (!actor.system.useUnlimitedResource) {
            await item.update({ 'system.resource.value': item.system.resource.value - 1 });
            spentStrings.push('1 point');
          }

          if (spentStrings.length) {
            const spentString = spentStrings.join(', ');
            ui.notifications.info(game.i18n.format('E20.RolePointsSpent', { spentString, name: item.name }));
          }
        }
      }

      if (item) {
        return item.roll(dataset, childKey);
      }
    }
  }
