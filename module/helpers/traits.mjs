/**
 * Manage Active Effect instances through the Actor Sheet via effect control buttons.
 * @param {MouseEvent} event      The left-click event on the effect control
 * @param {Actor|Item} owner      The owning document which manages this effect
 */
export async function onManageSelectTrait(event, owner) {
  event.preventDefault();
  const a = event.currentTarget;
  const li = a.closest("li");
  const template = "systems/essence20/templates/dialog/trait-selector.hbs"
  const html = await renderTemplate(
    template,
    {
      traits: owner.system.traits,
      configTraits: CONFIG.E20.armorTraits,
    },
  );

  return new Promise(resolve => {
    const data = {
      title: 'E20.TraitDialogTitle',
      content: html,
      buttons: {
        normal: {
          label: 'E20.TraitDialogConfirmButton',
          callback: html => resolve({ cancelled: true }),
        },
        cancel: {
          label: 'E20.TraitDialogCancelButton',
          callback: html => resolve({ cancelled: true }),
        },
      },
      default: "normal",
      close: () => resolve({ cancelled: true }),
    };
    new Dialog(data, null).render(true);
  });
}
