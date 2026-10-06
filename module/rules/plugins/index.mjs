/**
 * Rules-engine plug-ins: steps, tags, @references, recipients, pick sources, events and rule types added through the
 * register* functions in steps.mjs, predicate.mjs, formula.mjs and types.mjs, each in its own file. Imported by
 * essence20.mjs, scripts/check-rules.mjs and the tests that validate pack rules.
 */
import "./zords/zord-link-scopes.mjs";
import "./zords/megaform.mjs";
import "./effects/size.mjs";
import "./dialog/ask-choice-text-step.mjs";
import "./tags/clock-active-tag.mjs";
import "./zords/zords.mjs";
import "./effects/derived-hook-stage.mjs";
import "./rolls/before-roll-and-group-test-events.mjs";
import "./zords/zord-timing-hooks.mjs";
import "./picks/known-options.mjs";
import "./effects/team-rules-ready-reset.mjs";
import "./tags/team-holds-and-token-within.mjs";
import "./zords/form-perks.mjs";
import "./tags/target-not-beyond.mjs";
import "./rolls/roll-as-step.mjs";
import "./zords/transform-into-step.mjs";
import "./combat/hit-rider.mjs";
import "./effects/veto.mjs";
import "./combat/ignore-armor.mjs";
import "./combat/combat-steps.mjs";
import "./combat/immunity-readers.mjs";
import "./combat/rule-attacks.mjs";
import "./shared/lazy-helpers-and-targets.mjs";
import "./marks/rule-marks.mjs";
import "./dialog/dialog-select.mjs";
import "./combat/defense-modes.mjs";
import "./tags/checks-and-refs.mjs";
import "./effects/item-ladder.mjs";
import "./effects/brawn-requirement.mjs";
import "./combat/blind-roll-end-expiring.mjs";
import "./combat/reach.mjs";
import "./rolls/action-skills.mjs";
import "./rolls/lend-assistance-immune.mjs";
import "./marks/holder-steps.mjs";
import "./picks/picked-item.mjs";
import "./cards/card-offer.mjs";
import "./resources/personal-story-points.mjs";
import "./resources/spell-cost.mjs";
import "./rolls/initiative.mjs";
import "./rolls/contest.mjs";
import "./combat/canvas-points.mjs";
import "./picks/run-target-steps.mjs";
import "./marks/clear-marks-step.mjs";
import "./cards/claim-card-step.mjs";
import "./picks/remember-target-step.mjs";
import "./dialog/ask-text-step.mjs";
import "./combat/spend-actions-and-turn-queue.mjs";
import "./rolls/retry-and-recast.mjs";
import "./rolls/bonus-dice-bank.mjs";
import "./resources/temp-resource-step.mjs";
import "./tags/team-combatants.mjs";
import "./resources/spend-for-step.mjs";
import "./tags/round-allof-and-hands-tags.mjs";
import "./tags/target-uuid-and-keyed.mjs";
import "./picks/side-and-ally-picks.mjs";
import "./rolls/lend-assist-edge-step.mjs";
import "./effects/hardpoint-use.mjs";
import "./combat/stance-switch.mjs";
import "./marks/item-marks.mjs";
import "./effects/lent-alterations.mjs";
import "./combat/rigs-and-blasts.mjs";
import "./picks/picks-and-grants-setup.mjs";
import "./resources/scene-window-counters.mjs";
import "./tags/world-watch.mjs";
import "./zords/megaform-finisher.mjs";
import "./rolls/skill-die.mjs";
import "./zords/megaform-pilot-reactors.mjs";
import "./dialog/dialog-select-params.mjs";
import "./picks/pick-each.mjs";
import "./combat/hidden.mjs";
import "./cards/card-buttons.mjs";
import "./rolls/roll-vs-all.mjs";
import "./combat/only-best-defense.mjs";
import "./tags/item-copies.mjs";
import "./effects/rule-effects.mjs";
import "./rolls/ignore-drawback.mjs";
import "./rolls/initiative-edge.mjs";
import "./resources/grant-double.mjs";
import "./combat/damage-reduction.mjs";
import "./zords/mass-shift-event.mjs";
import "./tags/role-points-and-flag-lists.mjs";
import "./rolls/ally-and-picked-scopes.mjs";
import "./resources/requisition-dif.mjs";
import "./combat/cast-hit-damage.mjs";
import "./tags/skill-specialized-tag.mjs";
import "./tags/active-item-and-own-zord.mjs";
import "./picks/owned-actors.mjs";
// Round 14 (dice part): roll:damageType (Power Filter, Ice Machine).
import "./tags/roll-damage-type-tag.mjs";
// Round 14 (items1): BeforeRoll early: true (the once-per-encounter weapon effects).
import "./rolls/early-before-roll.mjs";
// Round 14 (banked): recipient nearbyEnemies:<ft> (getNearbyEnemyTokens, neutral tokens too).
import "./combat/nearby-enemies-recipient.mjs";
// Round 14 (dice part): the crewedVehicle recipient (Roadside Assistant).
import "./zords/crewed-vehicle-recipient.mjs";
// Round 14 (dice part): HitMultiplier stage "card" (Plate Piercing, Raze And Ruin).
import "./combat/card-hit-multiplier.mjs";
// Round 14 (dice part): roll:autoDownshift (Straight Shooter).
import "./tags/roll-auto-downshift-tag.mjs";
// Bug fix 2026-10-07: target:markedByMe:<key> = markedByMe:<key>.
import "./tags/target-marked-by-me.mjs";
// ---- Round 15 (rest-other, docs/rules-batches/slOther15.md) - begin ----
// ActionCost kinds reload / morph (Rapid Reload, Ammo Belt, Rev Morpher).
import "./resources/action-kinds.mjs";
// ReloadSkip (Deep Magazines, Extended Mag).
import "./combat/reload-skip.mjs";
// ActionCount (Quick Thinker, University Days, Foot Soldier).
import "./resources/action-count.mjs";
// SneakAttackGrant (Everything's A Weapon, Never Heard It Coming, Focused Charge, Sudden Strike).
import "./combat/sneak-attack-grant.mjs";
// UntrainedSnagImmunity (Green x2).
import "./rolls/untrained-snag-immunity.mjs";
// wouldBeDefeated stage, scope renegadeVehicle, tag self:ownRenegade, event essenceWouldEmpty (Immortal Rebel Soul,
// Life Supporting, Not Done Yet, We Are The Coinless).
import "./combat/defeat-stage.mjs";
// SpellCostDefer (Power Conservationist, Power Mastery).
import "./resources/spell-cost-defer.mjs";
// PreCast + step grantSpecialization (Enchant, Get To Know, Bestow Expertise).
import "./picks/pre-cast.mjs";
// Assist effects persist / rollFor (Those Who Know, Teach; Conniving).
import "./rolls/assist-extras.mjs";
// AvailabilityShift (Fieldtest).
import "./resources/availability-shift.mjs";
// SenseMultiplier (Used to the Dark).
import "./effects/sense-multiplier.mjs";
// AreaRadius (Bigger Booms).
import "./combat/area-radius.mjs";
// AllyFilter (Frenemy).
import "./combat/ally-filter.mjs";
// AttackTraits (Ram Cone).
import "./combat/attack-traits.mjs";
// RequisitionShift (Expert Guidance).
import "./resources/requisition-shift.mjs";
// GroupTestBonus (Bowling Team).
import "./rolls/group-test-bonus.mjs";
// JoinDie (Fast Modulation).
import "./zords/join-die.mjs";
// VehicleDefeat (Heavy Water Coolant).
import "./zords/vehicle-defeat-dif.mjs";
// SummonTimeBonus (Enhanced Summoner).
import "./zords/summon-time-bonus.mjs";
// Tags self:inRoughTerrain / target:inRoughTerrain (Take Point); event posted + step placeRoughTerrain (Piledriver).
import "./tags/rough-terrain-tag.mjs";
import "./effects/rough-terrain-space.mjs";
// Bonded-partner scopes bondPartner / bondHolder + tags (Advanced Link, Perfect Link, Armored Connection, Bonded Proficiency).
import "./picks/bond-link.mjs";
// Drop-time configurator: Trigger added {removeOnStop}, steps adjustItem / notify, tag self:hasItemWhere (Blast Attack,
// Multi-Limb Attack, Enhance (Attack), Increase (Essence), Light Chassis, Movement Booster).
import "./zords/drop-configure.mjs";
// applyingDamage stages attacker / reductions / lateReductions (Sudden Death, Fortitude, Extra Plates, Didn't Even Feel It,
// Invincibility Through Invisibility, Just a Graze).
import "./combat/applying-damage-stages.mjs";
// ---- Round 15 (rest-other) - end ----
// ---- Round 15 (dice, docs/rules-batches/slDice15.md) - begin ----
// grantStoryPoint step + FumbleStoryPoints rule (We Improvise, Stay Humble, Vibrating Palm, It's Right There...).
import "./resources/grant-story-point.mjs";
// SkillEssence rule (Academic Studies).
import "./rolls/skill-essence.mjs";
// attack:barehanded, self:holdingWeapon, roll:dealsDamage (Show Of Hands, Empty Hands, Brazen Strike, Smash!).
import "./tags/barehanded-tags.mjs";
// DamageModifier exceptTypes (Flame Warlord).
import "./combat/damage-except-types.mjs";
// Defense early: true (best against the per-attack value, early adds - Evasive, Psychological Warfare, Scapegoat...).
import "./combat/early-defense.mjs";
// DialogSwitch syntheticDamage (Psychoanalyst, Coax Surrender, Grinder, Deceptive Warfare).
import "./dialog/switch-synthetic-damage.mjs";
// Multiplier rule (Precision, Devastating Strike, Sucker Punch).
import "./rolls/degree-multiplier.mjs";
// DownshiftCancel rule (Expertise, Low Tech Priorities).
import "./rolls/downshift-cancel.mjs";
// Damage Role Points: self:activeRolePoints, roll:rolePointsDamage, DialogSwitch sneakAttackMultiplier (Quiet as the Grave, Hard Hitter).
import "./rolls/role-points-damage.mjs";
// Immunity kinds reachDownshift / grappleSizeDownshift / resistanceSnag / longRangeSnagForEdge (Menace, CQB Training, Nowhere to Run...).
import "./rolls/immunity-kinds.mjs";
// roll:rangeBand / roll:longRangeSnagIgnored / roll:elevationAbove + WeaponRange (Ballistics Precision, Vantage Point, Trajectory...).
import "./tags/range-facts.mjs";
// check: names inAppraisedArea... (dice part).
import "./tags/dice-checks.mjs";
// DataBridgeBonus rule (Tactical Triangulation).
import "./combat/data-bridge-bonus.mjs";
// Target tags statusFrom / resistsRolled / immuneRolled / nearby / mostConditions, holder:versusTarget, skill:roleSkill (Worst Nightmare, Gang Up, Sadistic, Heavy Ordnance, Genius...).
import "./tags/dice-target-tags.mjs";
// SizeMatrix rule (When Push Comes To Shove).
import "./combat/size-matrix-steps.mjs";
// roll:baseDie / roll:finalDie, DialogSwitch noCrit / capDie, FumbleRange, DownshiftCap (Jack Of All Trades, Time Traveler, Advantageous Fighter, Programmable).
import "./rolls/die-facts.mjs";
// EdgeOrShift rule (Expert in Your Field).
import "./rolls/edge-or-shift.mjs";
// @sneakAttack / @hardenedArmor / @volleyShots, roll:skillNoBetterThan (Sabotage, Different Perspective...).
import "./tags/dice-refs.mjs";
// Imaginative Engineering
import "./rolls/energon-spend-bonus.mjs";
// Fast Draw, Anti-Air Combat Training
import "./combat/defense-swap.mjs";
// Size Matters
import "./rolls/upshift-trade.mjs";
// Panacea
import "./effects/cure-all.mjs";
// Immovable Object, Protector's Shield
import "./combat/crit-immune.mjs";
// Titan Body
import "./combat/damage-floor.mjs";
// Pack Mule
import "./effects/round-window.mjs";
// Ambitious
import "./dialog/switch-clear-penalties.mjs";
// Move Like a Song
import "./combat/snag-or-miss.mjs";
// Consistent
import "./rolls/crit-downgrade.mjs";
// Violent
import "./tags/violent-tags.mjs";
// ---- Round 15 (dice) - end ----
// ---- Round 15 (banked, docs/rules-batches/slBanked15.md) - begin ----
// self:choiceOf:<uuid> (Tender's Empathy pick).
import "./tags/choice-of-tag.mjs";
// @skillDie.<skill> (Surface Read, Hard Target, Resilience).
import "./rolls/skill-die-ref.mjs";
// pick from: conditions (Eltarian Mettle, Balance and Harmony, Talk Them Up, Inspiring Words).
import "./picks/condition-pick.mjs";
// targetFacts step + @effectiveLevel (Studious Measures, Breaking Point, Study Weaknesses).
import "./shared/target-facts-step.mjs";
// recipient pilotedVehicleOrTarget (Engine Override, Jury Rig, Improvise Armor).
import "./zords/piloted-vehicle-or-target.mjs";
// splitBank / scaleBank steps, tag self:bankedFrom (Plan of Action's Split, Stand Firm).
import "./resources/bank-steps.mjs";
// lendAssistance step (I Got You).
import "./rolls/lend-assistance-step.mjs";
// keepTargets step (Bumper Crop, Entropic Sponge).
import "./picks/keep-targets-step.mjs";
// SnagImmunity rule type (Time Traveler) - dice.mjs reads ruleSnagImmune.
import "./rolls/snag-immunity.mjs";
// until thisRound / throughNextRound / mapScene, @combat.round (Engine Override, Hup!, Distracting Offer).
import "./effects/round-durations.mjs";
// self:stamped tags, stamp step, target:turnNeighbour, @turnOrder (The Quiet One, Work the Numbers, Stand Behind Me!).
import "./tags/combat-stamps.mjs";
// self:holdsItem tag, flagItem step (Weapon Conversion, Matured).
import "./picks/owned-item-steps.mjs";
// ---- Round 15 (banked) - end ----
// ---- Round 15 (uses, docs/rules-batches/slUses15.md) - begin ----
// tokenLight step (Candle, Torch, Headlamp, Candlesprite Lantern).
import "./effects/token-light.mjs";
// moveTo step (Checkmate, Teleporting Beam, Ghillie Suit Sniping, Wrist Communicator).
import "./combat/move-to.mjs";
// item selectors where: / withAttached: / host and @flagged.<flag>.
import "./picks/item-where.mjs";
// Companion recipients and link: tags, HitRider / Assist scope companion.
import "./picks/companions.mjs";
// refreshMorphedToughness / itemEffects steps, item:heldBySelf / item:entryOfOwned tags, {sourced.<id>.<path>} text,
// EssenceRedirect rule type (Cordial, Rough and Takes No Guff).
import "./resources/uses-grant-pieces.mjs";
// @takeMine, kitBoost / lendAssist steps, pick from specializations, item:firstAttack; CarryExemption / KitModifier
// (kit-rules.mjs, read by kits.mjs); AllyRangeMultiplier (ally-range.mjs, read by nearby-allies.mjs).
import "./resources/uses-kit-pieces.mjs";
import "./resources/kit-rules.mjs";
import "./combat/ally-range.mjs";
// check:markTarget, self:/target:status:any, item:primaryAttack; ShiftCap (dice.mjs), PetCommand (companions.mjs),
// PartyRequisition (actor.mjs); HitRider scope markedTarget; recordTurnWeapon step + @turnWeapons.
import "./tags/uses-rider-tags.mjs";
import "./rolls/shift-cap.mjs";
import "./picks/pet-command.mjs";
import "./resources/party-requisition.mjs";
import "./marks/marked-target-hits.mjs";
import "./combat/turn-weapons.mjs";
// DialogSwitch clearSnagCost (Steady Hand).
import "./dialog/clear-snag-cost.mjs";
// item:line / folderName / nameOfOwned / isVar tags; pickChildEntry, grantPerk, grantEntries, factionDrop steps.
import "./picks/entry-grants.mjs";
// self:sprinting; sprint, shove, slow steps (Wrecking Ball, Bowl-Over, Muzzle Punch).
import "./combat/sprint-shove-slow.mjs";
// Armor Upgrade tags, DialogSwitch ignoreArmorUpgrades, ArmorUpgradePenalty (Pinpoint, Make an Opening); ManeuverOption
// (Snatch, read by dice.mjs).
import "./combat/armor-upgrades.mjs";
import "./combat/maneuver-option.mjs";
// ConditionDuration (Gyro-Gun Alternate Effect, read by target-riders.mjs); BeforeArea (Concentrated Explosion / Fire,
// Shaped Charges, read by documents/item.mjs).
import "./combat/condition-duration.mjs";
import "./combat/before-area.mjs";
// SwapShrug (Unstoppable Force, read by target-riders.mjs); ManeuverOption also carries dismantle (Dismantle Firearm).
import "./combat/swap-shrug.mjs";
// Pick sources canvasItems / sceneList, addToSceneList step (I Can Do That); createCompanion step + recipient created
// (Primary / Secondary Tech).
import "./picks/canvas-items.mjs";
import "./picks/create-companion.mjs";
// ---- Round 15 (uses) - end ----
// ---- Round 15 (systems) - docs/rules-batches/slSystems15.md ----
// powerUsed Trigger event + FreeUse (the Powers' own effects).
import "./resources/power-used.mjs";
// rollCheck step (a Skill Test whose card carries Apply Damage buttons).
import "./combat/roll-card-damage.mjs";
// morph step (the sheet's Morph flow).
import "./zords/morph-step.mjs";
// Defense mode noArmor (the difficulty recomputed without armor).
import "./combat/no-armor-defense.mjs";
// askValue step (any number) and target:sameDisposition.
import "./dialog/ask-value-step.mjs";
import "./tags/same-disposition.mjs";
// ItemModifier stage item (inside the changed item's own prepareDerivedData).
import "./effects/item-modifier-stage.mjs";
// ActionCost action any / to downgrade / limit.freeIsUnlimited / scope marked, duration roundsThrough:<n>.
import "./resources/action-cost-any.mjs";
// healShared step (one roll shared among the recipients).
import "./resources/heal-shared-step.mjs";
// CriticalOption defense (1 damage to a Defense).
import "./combat/crit-defense-option.mjs";
// Action-ledger tag self:actionLog:<what>[:<cost>]<op><n> and ref @ledger.<path>.
import "./tags/action-ledger.mjs";
// Ref @rangedWeapons; Assist effect nextTurnGrant.
import "./combat/ranged-weapons-ref.mjs";
import "./rolls/assist-next-turn.mjs";
// check:vehicleInRoughTerrain.
import "./tags/vehicle-checks.mjs";
// Cover mode giveBack (the scopes).
import "./combat/cover-give-back.mjs";
// BraceUntilMoved rule type.
import "./combat/brace-until-moved.mjs";
// Tags damage:style:<style> / damage:elementOrEnergy (the applied attack card - the vehicle armors).
import "./tags/damage-source.mjs";
// RollModifier scope crewIncoming, DieSubstitution scope crew (a vehicle's rules on its occupants).
import "./combat/crew-incoming.mjs";
// SummonOption rule type (a faster Zord arrival, offered when it's summoned).
import "./zords/summon-option.mjs";
// ExplosionStep rule type (a Defeated vehicle's bigger explosion die).
import "./zords/explosion-step.mjs";
// ChoiceCount rule type (more picks in a Perk's drop-time picker).
import "./picks/choice-count.mjs";
// UniqueChoice rule type (a Perk's copies each pick a different Skill).
import "./picks/unique-choice.mjs";
// reduceTimer step (a Zord summon / Megaform combine timer comes sooner).
import "./zords/reduce-timer.mjs";
// Recipient personalVehicle:<key>, tag self:personalVehicle:<key>.
import "./picks/personal-vehicle.mjs";
// ---- Round 15 (systems) - end ----
// ---- Round 15 (items1) - start ----
// Recipient targetParticipants (Primeon Blade).
import "./zords/target-participants.mjs";
// Event defeatedEnemyStun (CBRN Defender).
import "./combat/stun-defeat-event.mjs";
// Rule types FanningShots (Storm of Lead) and TraitIgnore (Ordnance Expert).
import "./combat/fanning-shots.mjs";
import "./combat/trait-ignore.mjs";
// BeforeRoll steps read the rolled item; step targetCircle (Horseshoes and Handgrenades, Mighty Strikes, No Need To Aim).
import "./rolls/before-roll-rolled-item.mjs";
// Mark text + tags markText (Instill Weakness); rule type SuccessToCrit (No Factor).
import "./marks/mark-value.mjs";
import "./rolls/success-to-crit.mjs";
// Allies' pre-roll reactions: events allyTargeted / allyDefended, step boostDefense (Defender Step, Retribution).
import "./combat/ally-reactions.mjs";
// Steps mutateWeapon / grantAttacks (Explosive Ammo, Firestorm, Utility Loaders, Backblast, Airburst, Knuckle Up).
import "./combat/weapon-mutation.mjs";
// Rule types PoisonCoating (Poisonous, Intoxicate, Poison Tipped) and HealBonus (I've Got You, Up And At 'Em); steps lendItem
// (Support, Tech Support) and pickGeneralPerk (Why Do I Know That?).
import "./resources/poison-coating-rule.mjs";
import "./resources/heal-bonus.mjs";
import "./picks/lend-item.mjs";
import "./picks/general-perk-step.mjs";
// Rule type TargetedDefense + RollModifier scope incomingAura (Scramble, Shield Modulation); events transforming /
// rolePointsActivating, steps fireEvent / grantResistance / hideTokens, tag damage:resisted (Mode Attachment, Mass Shift,
// Elemental Adaptation, Interspatial Pause).
import "./combat/targeted-defense.mjs";
import "./effects/state-changes.mjs";
// Events applyingDamage (the card's Apply Damage: redirects, then the one hit) / damageLanding (any damage, GM); steps
// takeAsEssence / unmorph (Interpose x2, Body Shield, Heroic Sacrifice, Golden Guardian, Stand By Me, Fe-BURN!, Cyborg).
import "./combat/applying-damage.mjs";
// pickGrant {viaDrop} through the Alteration drop handler (Cybernetic Part, Enhanced / Optimized Part, the Mutations).
import "./picks/drop-grant.mjs";
// Step linkToHost: a granted item linked to its host weapon - equipped with it, gone with it (the Deflecting Weapons).
import "./effects/linked-host.mjs";
// Item-carried mark effects (rollSnag / rollShiftDown / inoperable), item selector var:<key>, tag itemVar:<key>:<tag>
// (Technical Glitch, Some Assembly Required, Complete System Failure).
import "./gear/item-disruption.mjs";
// Rule type ShapeOption, step changeShape, tag shape:skill:<key> (Shape-Shift, Face-Shift, Master Morph, Size-Shift).
import "./effects/shape-change.mjs";
// Rule type AttackChoice: a pick before the attack's template is placed (Bring It All Down).
import "./combat/attack-choice.mjs";
// Tag item:pack:<pack>|<pack> (Multimorph's other MLP Origins); pickChildEntry keeps @var.<var>Parent.
import "./tags/item-pack-tag.mjs";
// Rule type DefenseAura: a Defense bonus lent to nearby allies inside dice.mjs's per-attack Defense values (Shield Upgrade).
import "./combat/defense-aura.mjs";
// Event criticallyHit: a Critical Success's damage landing (Imperial Machine Mantle).
import "./combat/critically-hit-event.mjs";
// ---- Round 15 (items1) - end ----
// ---- Round 15 (items2) - start ----
// until "calendarDay" (Preventative Measures), event storyPointsPaid (Battle Hardened), tags combat:lowestInitiative /
// combat:currentRolled (Time To Think, Queen's Gambit), rule types NaturalTwenty (Better than the Best) and
// NoFumbleStoryPoint (Agency), steps listNames / whisper + @versus (Touch Move, Martial Artist), pick source recipients.
import "./effects/calendar-day-duration.mjs";
import "./resources/story-points-paid-event.mjs";
import "./tags/initiative-order-tags.mjs";
import "./rolls/natural-twenty.mjs";
import "./rolls/no-fumble-story-point.mjs";
import "./cards/names-and-whisper.mjs";
import "./picks/recipient-pick-source.mjs";
// Events rolePointsActivated / rolePointsDeactivated, tag self:enemiesStanding, wouldBeDefeated stage aegis (Reckless
// Abandon, Aegis, The Beat Goes On); Veto on: kitUse is in effects/veto.mjs.
import "./resources/role-points-events.mjs";
// Cross-item pick tags picked: / target:pickedBy: / target:skillDieAtLeast / self:costRuleUsed, until
// endOfNextRoundOrScene, Assist effect pay (the BFF Perks, Better Together).
import "./picks/cross-item-picks.mjs";
// Recent-roll memory: event skillTestPosted, tags recent:sideHigher / selfLower / hostile, ref @recent.lowestHostile
// (Competitive, Take in a Scene, Misplaced Confidence).
import "./rolls/recent-rolls.mjs";
// Rule type EnvironmentalExpertise + tag self:inExpertiseTerrain (Environmental Expertise, Read The Land, In Their Element).
import "./effects/environmental-expertise-rule.mjs";
// Tag terrain:picked:<key> (Environmental Enforcer).
import "./tags/terrain-picked-tag.mjs";
// Tag holder:choiceOf:<uuid> (Influential); {markSkill.<key>} text and markText $skill (Not Like That, Like This!).
import "./tags/holder-choice-of-tag.mjs";
// Step damageShield + consumeDamageShield (Elemental Shield; read by combat.mjs#applyDamage).
import "./combat/damage-shield.mjs";
// Tags self:sameSideAsHolder / target:sameSideAsHolder (Scramble Field Generator).
import "./tags/holder-side-tags.mjs";
// Tag self:pointWithin:<ft> (Timeslide).
import "./tags/point-within-tag.mjs";
// Tags target:immune:<condition> / self:immune:<condition> (Terror).
import "./tags/condition-immune-tag.mjs";
// Tag target:keyedOnMe:<path><op><n> (Anonymous).
import "./tags/keyed-on-me-tag.mjs";
// Recipient aroundSelf:<formula> (Solid-State Energon).
import "./picks/around-self-recipient.mjs";
// Tags self:/target:hasEffectFlag:<flag>, step undoEffect (They Called It a Glitch!).
import "./effects/flagged-effects.mjs";
// Step pickChassis, text ref {ruleItem.<path>} (Alt Mode Mimicry, Drone).
import "./picks/chassis-picks.mjs";
// Steps groupTest / groupTally, recipient varActor:<var> (Guardian Blast).
import "./rolls/group-test-steps.mjs";
// Tags zone:self:<key> / zone:target:<key> (Perfect Placement).
import "./combat/zone-footprint-tags.mjs";
// Step bestItem, tag roll:crit (Elemental Fury).
import "./picks/best-item.mjs";
// Pick source ownedVehicles, step windowCount, tag item:upgradeCostAtMost (Motor Pool Connections).
import "./resources/vehicle-budget-pieces.mjs";
// MovementAction countSinceTypeChange, on essence20.movementUsed (Third Dimension).
import "./combat/since-type-change.mjs";
// Event converted, step recordSeen (Unexpected Alternative).
import "./zords/converted-event-and-seen.mjs";
// Step refundUse (Delegate).
import "./resources/refund-use.mjs";
// Recipient crew (R.R.R.).
import "./zords/crew-recipient.mjs";
// Rule DriverlessEssence (Relic Key).
import "./zords/driverless-essence.mjs";
// Rule EvasiveManeuvers, tag self:crewsAerial (Fly In The Future).
import "./combat/evasive-maneuvers-rule.mjs";
// Tag self:ownerSpectrum:<colour> (Versatile Combiner).
import "./zords/zord-owner-spectrum.mjs";
// Step spendPooled (Zord Mega-Weapon System).
import "./resources/spend-pooled.mjs";
// ---- Round 15 (items2) - end ----

// ---- Round 16 (part b - docs/rules-batches/slLeftB16.md) ----
// until combatRound / combatThroughNextRound (Ground Suppression, Tech Specs).
import "./effects/combat-round-durations.mjs";
// Pick source allySpecializations, tags skill:in / bankKey / sideBankKey / sideStatus, step moveCondition (Data Bridge,
// Think Tank, Misery Loves Company).
import "./resources/bank-keys-and-borrowing.mjs";
// Step defenseFacts, tag target:amongUserTargets (Tech Specs, Danger Close).
import "./combat/defense-facts.mjs";
// RollModifier consumeCount, inMarkedArea (Eye For Appraisal, Vantage Point's check:inAppraisedArea).
import "./marks/counted-marks.mjs";
// Rule type MarkedRowOutcome (Powerful Suggestion; read by dice.mjs#_rollSkillHelper).
import "./rolls/marked-row-outcome.mjs";
// Recipient companionFlagged:<flag>, tags self:companionFlagged / item:mentions (Rally Guardians Features).
import "./picks/flagged-companion-and-mentions.mjs";
// Step scheduleNextRound + runScheduledNextRound at each turn start (Self-Destruct).
import "./combat/next-round-schedule.mjs";
// HitRider scope incoming, tags self:/target:minion, step activatePower (Metallic Armor Power Up).
import "./combat/incoming-hits-and-minions.mjs";
// Tag target:exists (Dominate).
import "./tags/target-exists-tag.mjs";
// Rule types KitOption / KitSkill, read by mechanics/resources/kits.mjs (WTNV Medicine, Science, Travel Reporter kits).
import "./resources/kit-options.mjs";
// RollModifier scope bondPartnerIncoming, Defense mode holderBest, tags target:inHolderReach / self:nearHolder (Hit
// Someone Your Own Size!).
import "./combat/bond-partner-guard.mjs";
// Step placeBeside; contest best / tieWins are in rolls/contest.mjs (Try Me).
import "./combat/place-beside.mjs";
// ---- Round 16 (part b) - end ----
// ---- Round 16 (part a) - start ----
// Rule type FlatD20: "treat a d20 as N" dialog boxes decided after the dialog (Dependable, Old Reliable, Legendary Dependability).
import "./rolls/flat-d20.mjs";
// DialogSwitch action / actionKind / baseDamageMultiply / backfireOn (Analyze Target, Surging).
import "./dialog/switch-action-cost.mjs";
// RollModifier key (roll:switch for a listed modifier), Trigger oncePerRoll (Get A Grip, Get The Horns).
import "./rolls/once-per-roll.mjs";
// Step sizeChange, tags self:/target:sizeChanged (Scarefying Appearance, the size potions).
import "./effects/timed-size.mjs";
// Step targetRowsBeating (Explosive Aftershock).
import "./combat/rows-beating.mjs";
// Rule type AttackResistance (Dispersion).
import "./combat/attack-resistance.mjs";
// Steps bankReroll / rerollLimit (Power Infusion), keyedCount (Analyze Target).
import "./rolls/reroll-bank.mjs";
import "./resources/keyed-count.mjs";
// Rule types MegaformArmor, MegaformHold, MegaformSpecializations, EnergonDonor (Armored Defense, Hardened Chassis, Keep IT Together!, Better As One).
import "./zords/megaform-contributions.mjs";
// Defense noArmor scope markedTarget, tag card:flag, recipient cardTarget (Exploit Weakness).
import "./combat/marked-no-armor.mjs";
// Tag rule:choiceHas:<key>:<value> (Scarefying Appearance's benefits).
import "./tags/rule-choice-has.mjs";
// Text {combat.id}; markText $var.<key> and combatEnd @var.combatId (Hard Corps).
import "./shared/combat-id-text.mjs";
// ---- Round 16 (part a) - end ----
// ---- Round 17 (perm - docs/rules-batches/slPerm17.md) - start ----
// DieSubstitution / CritOnD2 scope marked, DieSubstitution dieOf: holder (Trade School, Technical Mastery).
import "./marks/carried-die-and-crit.mjs";
// Step attackFacts, text {lang.<Key>} (Chrono-File Access; defenseFacts keeps the highest Defense's name and value).
import "./shared/report-facts.mjs";
// ---- Round 17 (perm) - end ----
// ---- Round 17 (split1 - docs/rules-batches/slSplit117.md) - start ----
// Link scope formedBy: a character's rule reaches the Megaform it formed (Ultimate Magna Defender's Defender Torozord).
import "./zords/formed-by-scope.mjs";
// Ref @tokensHolding.<id>.<ft>: other tokens nearby whose actor holds that item (Colony Changeling).
import "./tags/tokens-holding-ref.mjs";
// DialogSwitch setDie: the final die is fixed, no Edge or Snag (Savant Skill).
import "./dialog/switch-set-die.mjs";
// Defense ignoreArmor lookup: the points come off at the Defense lookup (Metallikato).
import "./combat/lookup-armor-points.mjs";
// ---- Round 17 (split1) - end ----
// ---- Round 17 (split2 - docs/rules-batches/slSplit217.md) - start ----
// Rule type DamageImmunity, read where applyDamage reads system.immunities (Impenetrable Shield, Energy Mastery).
import "./combat/damage-immunity.mjs";
// Rule type CardResistance + tag card:flagEquals, read by chat.mjs Apply Damage (Tough Enough).
import "./combat/card-resistance.mjs";
// Rule types AddictionSnag, CarryCapacity, ForcedMovementChoice, SkillImmunityOverride (Word of Unicron, Growth Boost, Immovable Object, Fear Is Universal).
import "./combat/subsystem-readers.mjs";
// Tags target:keptAt:<path>, self:elevation:<op>N (Nemesis, Lightspeed Boost).
import "./tags/kept-at-and-elevation.mjs";
// Step shapeSet (Basic Shape-Shifting, Ponymorph).
import "./effects/shape-set-step.mjs";
// Step makeKit (Earth Defense Command Benefits).
import "./resources/make-kit-step.mjs";
// Step clearRoughTerrain (Dozer Blade).
import "./combat/clear-rough-terrain.mjs";
// ---- Round 17 (split2) - end ----
// ---- Round 17 (split3 - docs/rules-batches/slSplit317.md) - start ----
// Recipient bondedAlly, tag self:bonded (Synaptic Linkage).
import "./picks/bonded-ally.mjs";
// Movement stages vehicleBase / vehicle, applied by vehicle-upgrades.mjs#applyToVehicle (Anti-Matter Reactor, Shallow Draft...).
import "./effects/vehicle-movement-stages.mjs";
// Rule type ContactAllegiance (Gridlock Authority).
import "./resources/contact-allegiance.mjs";
// Rule type KitUses (Reinforced Basics).
import "./resources/kit-uses.mjs";
// Trigger event roleDropped (It's Morphin Time!).
import "./effects/role-dropped-event.mjs";
// Pick source damagedEssences (EMT Crash Course), ref @countSubtype (Personal Power Supply).
import "./picks/damaged-essences.mjs";
// ---- Round 17 (split3) - end ----
// ---- Book check 2026-10-06 (limits - docs/rules-batches/book-limits.md) - start ----
// Ref @clock.<scene|encounter|mission|session> (Cache I's Private Barter once per session, Jury Rig's scene-long benefit).
import "./resources/clock-ref.mjs";
// ---- Book check (limits) - end ----
// ---- Book check 2026-10-06 (effects - docs/rules-batches/book-effects.md) - start ----
// Tag rule:firstOnHost (Deadly, Lingering, Chrono-Trigger once per weapon), step unreducibleDamage (Better You Than Me),
// event defeatedByStun (Not On My Watch).
import "./book/effects.mjs";
// ---- Book check (effects) - end ----
// ---- Book check 2026-10-06 (follow-ups - docs/rules-batches/book-followups.md) - start ----
// Tag item:usesItem (Deconstructionist), Alteration undo on rule removal (Beast Mode), out-of-combat timed Conditions.
import "./book/followups.mjs";
// ---- Book check (follow-ups) - end ----
// ---- Book check 2026-10-06 (follow-ups 2 - docs/rules-batches/book-followups2.md) - start ----
// untilOf: user - the crew member using a vehicle's Use (Electronic Countermeasures).
import "./book/followups2.mjs";
// ---- Book check (follow-ups 2) - end ----
// ---- Round 18 (convC - docs/rules-batches/slConvC18.md) - start ----
// Pick source seatmates, step swapSeats (Nu, Pogodi!'s seat swap). (SneakAttackGrant bypass is an edit in
// combat/sneak-attack-grant.mjs.)
import "./picks/seat-swap.mjs";
// ---- Round 18 (convC) - end ----
// ---- Round 18 (convA - docs/rules-batches/slConvA18.md) - start ----
// Rule type ConditionHalving (Gallantry's halved Frightened), through steps.mjs#registerConditionDuration.
import "./effects/condition-halving.mjs";
// SkillSubstitution stage: attack, read by documents/item.mjs (Brutal Might).
import "./rolls/attack-skill-substitution.mjs";
// applyingDamage redirectTo, asked by chat.mjs#onApplyDamage (Impenetrable Armor).
import "./combat/self-redirect.mjs";
// BeforeRoll scope marked (Stand Behind Me!'s attack block).
import "./rolls/marked-before-roll.mjs";
// HitRider stage: late + replace, read by target-riders.mjs#attackRiders (Concentrated Fire).
import "./combat/late-hit-rider.mjs";
// Rule type HeldUse, read by nanomite-uses.mjs#resetDailyPowerUses (Dominate).
import "./resources/held-uses.mjs";
// ---- Round 18 (convA) - end ----
// ---- Round 18 (convB - docs/rules-batches/slConvB18.md) - start ----
// Rule type HealthOverflow, a damage modifier after the reductions (Body of Energy).
import "./combat/health-overflow.mjs";
// Ref @rolePointsBonus (Renegade Commander's Bonus Health). (addEffect until + the timed-effect sweep are edits in
// effects/rule-effects.mjs and rules/triggers.mjs; updateActor notSpent in rules/steps.mjs.)
import "./resources/role-points-bonus-ref.mjs";
// Rule type PowerGate, read by mechanics/characters/power-use.mjs#canUsePower (Zeo Crystal Boost once per scene).
import "./resources/power-gate.mjs";
// Link scope drivenMegaform, tag megaform:everyDriver (Zeo Crystal Boost's team Megazord clause).
import "./zords/driven-megaform.mjs";
// Step storyPointsExpire - granted Story Points taken back at combat end unless spent (We Improvise).
import "./resources/expiring-story-points.mjs";
// Rule type SummonArrival, written with the Zord's summon-timer write (Megafauna).
import "./zords/summon-arrival.mjs";
// Step buildSorcerousPower - the Sorcery builder dialog as a Use step (Sorcery).
import "./picks/sorcery-builder-step.mjs";
// ---- Round 18 (convB) - end ----
