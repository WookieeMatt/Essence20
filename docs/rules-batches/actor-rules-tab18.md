# Actor sheet Rules tab (batch 18)

The actor sheet's Effects tab is now a **Rules** tab, matching the item sheet's merged Rules tab
(2026-10-01). The data is unchanged. Active Effects are still Active Effects, and rules are still
`system.rules` on items. Only the view is new.

## What changed

- `module/rules/actor-view.mjs` (new, tested in `actor-view.test.js`) builds the tab's data:
  - `actorEffectGroups(actor)` takes every effect from `Actor#allApplicableEffects()`, so the
    actor's own effects **and the effects its items transfer** both show. It sorts them into
    **Conditions** (has a status), **Area Effects** (origin is a Region/RegionBehavior, the v14
    `applyActiveEffect` behavior used for lingering AoE), **Temporary** (has a duration),
    **Always On** and **Inactive**. Conditions and Area are hidden while empty. The other three
    always show, with their Add buttons. The transient groups get an accent bar and a
    "Remaining" column showing v14's `duration.label`.
  - `actorRuleGroups(actor)` gives a read-only summary of the live rules (`collectRules`). It has
    one card per source item, sorted by name, showing the item type, "Attached to <host>" for
    upgrades, and each rule's `summarizeRule` line. Toggles show On/Off, Pools show value/max and
    ChoiceSets show the current pick. Rules that only apply under conditions are in italics.
    Rules that reach another actor (crew, aura and so on) have an accent-coloured tag.
- `templates/actor/tabs/effects.hbs` was rewritten. The tab id stays `effects`, so saved tab state
  and the tour selectors (`.effects-list`, `li.items-header[data-effect-type]`, the
  toggle/edit/create actions) still work.
- `base-actor-sheet.mjs`: `_prepareEffectsContext` uses `actorRulesContext`. There is a new
  `openRuleSource` action that opens the item an effect or rule comes from (click the source
  name).
- Tab label is `E20.Rules.Tab` on the character, NPC, companion, zord, megaform, vehicle and party
  sheets, plus `pc-tabs.hbs`. All of them share the one template and prep.
- Delete is only offered for the actor's own effects. An effect carried by an item shows a lock;
  you toggle or edit it here and delete it from the item.
- New styles are in `sass/views/_actor-rules.scss`, scoped under `.essence20 .tab.effects
  .e20-actor-rules` and using theme tokens only. `css/essence20.css` is rebuilt. Images are fixed
  28px thumbnails.
- New strings are under `E20.ActorRules.*`. The tour got a new `itemRules` step plus reworded
  `EffectsTab`/`Categories` text in `tours/active-effects.json` and `E20.Tours.Effects.*`.

## Check live

1. **Reload the browser (F5)** so the new lang keys load. Raw `E20.ActorRules.*` keys mean the
   page was not reloaded.
2. Character sheet, Rules tab: own effects plus item effects (for example armor or a Perk with an
   AE) are listed, and their source links open the item. A 300px item icon (Yo Joe!) shows as a
   small thumbnail.
3. Apply a status from the token HUD. It should appear under Conditions with its status chip and
   "Until removed". A timed effect should show its rounds left under Temporary.
4. Stand a token in a lingering AoE region. Its effect should appear under Area Effects.
5. Toggle, edit and delete on the actor's own effect. Toggle and edit on an item's effect. The
   Add buttons on Temporary, Always On and Inactive should work.
6. "Rules from items": groups per item, Pool/Toggle/Choice states are correct, and long condition
   text wraps inside the tab.
7. Repeat on the NPC, companion, zord, megaform, vehicle and party sheets, in the Sci-fi and MLP
   frames with the light and dark schemes.
8. Run the Active Effects tour. The new "Rules from Items" step should anchor on the summary.
