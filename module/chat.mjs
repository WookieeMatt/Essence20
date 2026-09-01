import { E20 } from "./helpers/config.mjs";
import { _isCritIsFumble, applyDamage } from "./helpers/combat.mjs";
import { computeSystemColorVars } from "./helpers/actor.mjs";

export { _isCritIsFumble };

function normalizeRerollConfig(config) {
  if (!config) {
    return null;
  }

  const normalized = config.enabled !== undefined ? config : { enabled: true, ...config };
  if (normalized.enabled === false) {
    return null;
  }

  const values = Array.isArray(normalized.values)
    ? normalized.values.filter(value => Number.isFinite(Number(value))).map(value => Number(value))
    : typeof normalized.values === "string"
      ? normalized.values.split(",").map(value => Number(value.trim())).filter(value => Number.isFinite(value))
      : [];

  return {
    enabled: true,
    mode: normalized.mode ?? "all",
    target: normalized.target ?? "allDice",
    reset: normalized.reset ?? "none",
    maxUses: Number.isFinite(Number(normalized.maxUses)) ? Number(normalized.maxUses) : 1,
    values,
  };
}

function getRerollResetBucket(reset) {
  if (reset === "scene") {
    return `scene:${game.scenes?.current?.id ?? "default"}`;
  }

  if (reset === "day") {
    return `day:${new Date().toISOString().slice(0, 10)}`;
  }

  return "global";
}

async function trimExpiredRerollUsage(actor) {
  const usage = actor.getFlag("essence20", "rerollUsage") ?? {};
  const nextUsage = {};

  for (const [key, value] of Object.entries(usage)) {
    const separator = key.lastIndexOf("@");
    if (separator < 0) {
      continue;
    }

    const bucket = key.slice(separator + 1);
    const bucketType = bucket.split(":")[0];
    if (bucketType === "scene" && game.scenes?.current?.id && bucket !== `scene:${game.scenes.current.id}`) {
      continue;
    }

    if (bucketType === "day" && bucket !== `day:${new Date().toISOString().slice(0, 10)}`) {
      continue;
    }

    nextUsage[key] = value;
  }

  if (Object.keys(nextUsage).length !== Object.keys(usage).length) {
    await actor.setFlag("essence20", "rerollUsage", nextUsage);
  }
}

function getRerollConfigs(actor) {
  if (!actor) {
    return [];
  }

  const configs = [];

  for (const item of actor.items) {
    let config = normalizeRerollConfig(item.system?.reroll ?? item.system?.rerollConfig);
    if (!config && item.system?.advances?.type === "rerolls") {
      const value = Number(item.system.advances.currentValue ?? item.system.advances.baseValue ?? 1);
      config = normalizeRerollConfig({
        enabled: true,
        mode: "all",
        target: "allDice",
        reset: "none",
        maxUses: 1,
        values: Number.isFinite(value) ? [value] : [1],
      });
    }

    if (config) {
      configs.push({ ...config, source: item.uuid ?? item.name ?? item.type, sourceType: "item" });
    }
  }

  for (const effect of actor.effects) {
    const config = normalizeRerollConfig(
      effect.system?.reroll
      ?? effect.flags?.essence20?.reroll
      ?? effect.flags?.essence20?.rerollConfig,
    );
    if (config) {
      configs.push({ ...config, source: effect.id ?? effect.label ?? "effect", sourceType: "effect" });
    }
  }

  return configs;
}

async function canUseReroll(actor, config, sourceKey) {
  if (!actor || !config || config.maxUses <= 0) {
    return false;
  }

  await trimExpiredRerollUsage(actor);
  const usage = actor.getFlag("essence20", "rerollUsage") ?? {};
  const key = `${sourceKey}@${getRerollResetBucket(config.reset)}`;
  return Number(usage[key] ?? 0) < config.maxUses;
}

async function consumeRerollUsage(actor, config, sourceKey) {
  if (!(await canUseReroll(actor, config, sourceKey))) {
    return false;
  }

  const usage = actor.getFlag("essence20", "rerollUsage") ?? {};
  const key = `${sourceKey}@${getRerollResetBucket(config.reset)}`;
  usage[key] = Number(usage[key] ?? 0) + 1;
  await actor.setFlag("essence20", "rerollUsage", usage);
  return true;
}

function getRerollFilter(config) {
  const values = new Set(config.values?.length ? config.values : [1]);
  if (config.mode === "onesAndTwos") {
    values.add(2);
  }

  if (config.mode === "all") {
    return result => {
      if (!config.values || !config.values.length) {
        return true;
      }
      return values.has(Number(result));
    };
  }

  if (config.mode === "ones" || config.mode === "onesAndTwos") {
    return result => values.has(Number(result));
  }

  if (config.mode === "single") {
    return () => true;
  }

  return () => false;
}

async function getTargetedDieIndex(roll, target, mode) {
  if (target === "allDice") {
    return null;
  }

  const eligibleDice = target === "skillDice"
    ? roll.dice.map((die, index) => ({ die, index })).filter(({ die }) => die.faces >= 2 && die.faces <= 20)
    : roll.dice.map((die, index) => ({ die, index }));

  if (!eligibleDice.length) {
    return null;
  }

  if (eligibleDice.length === 1) {
    return eligibleDice[0].index;
  }

  const choice = await new Promise(resolve => {
    const html = `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize("E20.RerollSelectDiePrompt")}</label>
          <select name="dieIndex">
            ${eligibleDice.map(({ index, die }) => `<option value="${index}">Die ${index + 1} (d${die.faces})</option>`).join("")}
          </select>
        </div>
      </form>
    `;

    new Dialog({
      title: game.i18n.localize("E20.RerollSelectDieTitle"),
      content: html,
      buttons: {
        choose: {
          label: game.i18n.localize("E20.RerollSelectDieChoose"),
          callback: (htmlContent) => {
            const value = Number(htmlContent.find("[name='dieIndex']").val());
            resolve(Number.isInteger(value) ? value : null);
          },
        },
        cancel: {
          label: game.i18n.localize("E20.Cancel"),
          callback: () => resolve(null),
        },
      },
      default: "choose",
      close: () => resolve(null),
    }).render(true);
  });

  return choice;
}

async function rerollMessage(message, config) {
  const actor = ChatMessage.getSpeakerActor(message.speaker);
  if (!actor || !message.rolls?.length || typeof message.rolls[0]?.reroll !== "function") {
    return;
  }

  const sourceKey = `${config.sourceType}:${config.source}`;
  if (!(await consumeRerollUsage(actor, config, sourceKey))) {
    ui.notifications.warn(game.i18n.localize("E20.RerollMaxUsesReached"));
    return;
  }

  const original = message.rolls[0];
  const rerolled = original.clone();
  const mode = config.mode ?? "all";
  const target = config.target ?? "allDice";

  if (target === "anyDie" || (target === "skillDice" && mode === "single")) {
    const dieIndex = await getTargetedDieIndex(rerolled, target, mode);
    if (dieIndex === null) {
      return;
    }

    const selectedDie = rerolled.dice[dieIndex];
    rerolled.reroll({
      recursive: true,
      filter: (result, term) => term === selectedDie,
    });
  } else if (mode === "all") {
    rerolled.reroll({ recursive: true, filter: () => true });
  } else if (mode === "single") {
    const dieIndex = await getTargetedDieIndex(rerolled, target === "skillDice" ? "skillDice" : "anyDie", mode);
    if (dieIndex === null) {
      return;
    }
    const selectedDie = rerolled.dice[dieIndex];
    rerolled.reroll({
      recursive: true,
      filter: (result, term) => term === selectedDie,
    });
  } else {
    rerolled.reroll({ recursive: true, filter: getRerollFilter(config) });
  }

  const label = `${actor.name}: ${game.i18n.localize("E20.RerollDice")} (${game.i18n.localize(E20.rerollModes[mode] ?? "E20.RerollModeAll")})`;
  rerolled.toMessage({
    speaker: message.speaker,
    flavor: label,
    rollMode: game.settings.get("core", "rollMode"),
    flags: { essence20: { rerollConfig: config } },
  });
}

export const addRerollButtons = function (message, html) {
  if (!message.isRoll || !message.isContentVisible || !message.rolls?.length || !message.speaker) {
    return;
  }

  const actor = ChatMessage.getSpeakerActor(message.speaker);
  const configs = getRerollConfigs(actor);
  if (!configs.length) {
    return;
  }

  const target = html.querySelector(".dice-roll") ?? html.querySelector(".message-content") ?? html;
  if (!target) {
    return;
  }

  for (const config of configs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "e20-reroll-button";
    button.textContent = `${game.i18n.localize("E20.RerollDice")} (${game.i18n.localize(E20.rerollModes[config.mode] ?? "E20.RerollModeAll")})`;
    button.title = game.i18n.localize("E20.RerollDiceTitle");
    button.addEventListener("click", () => rerollMessage(message, config));
    target.appendChild(button);
  }
};

// Wires up the check-card.hbs "Apply Damage"/critical-effect buttons. Called on the
// renderChatMessageHTML hook. Each button carries its own data-key (e.g. "<uuid>:base" or
// "<uuid>:crit:<effectId>") so the base effect and any critical-hit bonus effect (p.205 - "the
// attacker chooses to stack on an additional attack effect") can be applied independently rather
// than one click disabling every button on the card. damageApplied (a plain boolean) is the
// pre-Critical-Hit-feature flag format - still honored so chat messages created before this
// change don't let their (single) button be re-clicked after a reload.
export const attachCheckCardListeners = function (message, html) {
  const buttons = html.querySelectorAll('[data-action="apply-damage"]');
  if (!buttons.length) {
    return;
  }

  const legacyApplied = message.getFlag('essence20', 'damageApplied');
  const appliedKeys = message.getFlag('essence20', 'damageAppliedKeys') || [];
  for (const button of buttons) {
    if (legacyApplied || appliedKeys.includes(button.dataset.key)) {
      button.disabled = true;
      continue;
    }

    button.addEventListener('click', () => onApplyDamage(message, button));
  }
};

// Cross-actor Health changes stay GM-gated, since there's no existing precedent anywhere in this
// codebase for a player mutating another actor's document.
async function onApplyDamage(message, button) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize('E20.CheckApplyDamageGmOnly'));
    return;
  }

  const target = await fromUuid(button.dataset.targetUuid);
  if (!target) {
    return;
  }

  const amount = await applyDamage(target, parseInt(button.dataset.damage), button.dataset.damageType);
  button.disabled = true;
  const appliedKeys = message.getFlag('essence20', 'damageAppliedKeys') || [];
  await message.setFlag('essence20', 'damageAppliedKeys', [...appliedKeys, button.dataset.key]);
  ChatMessage.create({
    content: `${target.name}: ${amount} ${game.i18n.localize('E20.CheckDamageApplied')}`,
    speaker: ChatMessage.getSpeaker({ actor: target }),
  });
}

// Changes the color of the roll total for crits and fumbles
// Called on the renderChatMessageHTML hook
export const highlightCriticalSuccessFailure = function (message, html) {
  if (!message.isRoll || !message.isContentVisible || !message.rolls.length) {
    return;
  }

  const [isCrit, isFumble] = _isCritIsFumble(message.rolls[0].dice, message.flags.essence20?.canCritD2);

  // Set roll total class to alter its color
  const diceTotalElement = html.getElementsByClassName('dice-total')[0];

  if (isCrit && isFumble) {
    diceTotalElement.classList.add('crumble');
  } else if (isCrit) {
    diceTotalElement.classList.add('critical');
  } else if (isFumble) {
    diceTotalElement.classList.add('fumble');
  }
};

// Hides the Targeting Difficulty ("DIF n") shown next to each target on a resolved-check chat
// card (check-card.hbs) from non-GM viewers, the same GM-only treatment the @Check[dif=...]
// enricher already gives a flat Difficulty value (helpers/enrichers.mjs). Unlike that enricher,
// this card's HTML is baked once into the ChatMessage's content and shared verbatim to every
// client, so there's no re-enrichment point to hook into - concealment has to happen by pruning
// the DOM on render instead. This is display-only: a player could still recover the value from
// the message's stored content via the console, same caveat as the enricher.
// Called on the renderChatMessageHTML hook.
export const hideDifficultyForNonGm = function (message, html) {
  if (game.user.isGM) {
    return;
  }

  for (const el of html.querySelectorAll('.e20-check-difficulty')) {
    el.remove();
  }
};

// Outlines a chat card in the speaking Actor's own system.color, the same
// --e20-system-color mechanism the actor sheet's e20-border-accent trim already uses
// (helpers/actor.mjs) - unset when the actor has no color chosen (or there's no actor at all,
// e.g. a GM-only message), leaving the card on its default themed border.
// Called on the renderChatMessageHTML hook.
export const applyChatMessageSystemColor = function (message, html) {
  const actor = ChatMessage.getSpeakerActor(message.speaker);
  const color = actor?.system?.color;
  if (!color) {
    return;
  }

  const { normalizedColor, alphaColor } = computeSystemColorVars(color);
  html.style.setProperty('--e20-system-color', normalizedColor);
  html.style.setProperty('--e20-system-color-50', alphaColor);
};
