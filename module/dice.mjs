export async function GetSkillRollOptions() {
  const template = "systems/essence20/templates/dialog/roll-dialog.hbs"

  const html = await renderTemplate(template, {});

  return new Promise(resolve => {
    const data = {
      title: game.i18n.format("Configure your skill roll"),
      content: html,
      buttons: {
        normal: {
          label: "Roll",
          callback: html => resolve(_processSkillRollOptions(html[0].querySelector("form"))),
        },
        cancel: {
          label: "Cancel",
          callback: html => resolve({canceled: true}),
        },
      },
      default: "normal",
      close: () => resolve({cancelled: true}),
    }
    new Dialog(data, null).render(true);
  });
}

function _processSkillRollOptions(form) {
  return {
    shiftUp: form.shiftUp.value,
    shiftDown: form.shiftDown.value,
    snag: form.snag.checked,
    edge: form.edge.checked,
  }
}
