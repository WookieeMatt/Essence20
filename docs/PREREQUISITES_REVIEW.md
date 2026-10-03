# Prerequisites: the review list

These are the items whose printed prerequisite (`system.prerequisite`) the Phase 2 parser could only approximate ("Partial"), or could only hand to the GM ("Ask only"). See `docs/PREREQUISITES_PLAN.md` §3.

- **Ask only:** in the packs now, as `ask:` tags. They never block; the GM is told when one is taken.
- **Partial:** approved by the user on 2026-10-02 and written into the packs as shown, except Acute Senses, whose text describes its own choice rather than a requirement.
- **Exact, with notes:** in the packs, with the assumption stated.

Generated 2026-10-02 by the parser in the session scratchpad (`prereqs/parse.cjs`).

## Partial - for human review (69 items)

| Item | Type | Printed text | when | Notes |
|---|---|---|---|---|
| Battlizer Access | perk | 5th level or higher, GM approval | `self:level>=5 ; ask:GM approval` | **Applied 2026-10-02** |
| Battlizer Access (Specific Battlizer) | perk | 5th Level or higher, GM Approval | `self:level>=5 ; ask:GM approval` | **Applied 2026-10-02** |
| Slashing Wings | upgrade/vehicle | Air vehicle with a Flyby attack | `self:data:system.traits.air ; self:data:system.traits.flyBy` | Flyby attack read as the flyBy vehicle trait. **Applied 2026-10-02** |
| Enhanced Sensors | upgrade/drone | Alertness d2 | `self:skill:alertness>=d2` | the drone's own Skill. **Applied 2026-10-02** |
| Aerodynamic Body | perk | Alt Mode with Crew 1 or more | `self:canTransform ; ask:Alt Mode with Crew 1+` | **Applied 2026-10-02** |
| Heavy Machinery | perk | Alt Mode with Crew 1 or more | `self:canTransform ; ask:Alt Mode with Crew 1+` | **Applied 2026-10-02** |
| Reinforced Shell | perk | Alt Mode with Crew 1 or more | `self:canTransform ; ask:Alt Mode with Crew 1+` | **Applied 2026-10-02** |
| Tool Compartments | perk | Alt Mode with Crew 1 or more | `self:canTransform ; ask:Alt Mode with Crew 1+` | **Applied 2026-10-02** |
| Weapon Bays | perk | Alt Mode with Crew 1 or more | `self:canTransform ; ask:Alt Mode with Crew 1+` | **Applied 2026-10-02** |
| Zord Ultra Mode | perk | Alt Mode, Personal Power Pool, Role with Zord Feature Perk, Size Class of at least Large | `self:canTransform ; self:data:system.powers.personal.max>=1 ; ask:Role with a Zord Feature Perk ; self:size>=large` | "Personal Power Pool" read as max Personal Power 1+. **Applied 2026-10-02** |
| Strobe | upgrade/weapon | Any weapon with a flashlight, the Laser trait, or that does Laser damage | `any(ask:Has a flashlight / host:trait:laser)` | Laser damage read as the laser trait. **Applied 2026-10-02** |
| Matured | perk | At least one Influence Hang-Up | `self:count:hangUp>=1` | counts any Hang-Up, not only Influence ones. **Applied 2026-10-02** |
| Spacewalker | perk | Athletics (Spacewalk) d4 or higher | `self:skill:athletics>=d4 ; ask:Spacewalk Specialization` | **Applied 2026-10-02** |
| Improved Weapon | upgrade/drone | Attack function or Integrated Specialized Weapon upgrade | `any(ask:Attack function / self:hasType:upgrade:Integrated Specialized Weapon)` | **Applied 2026-10-02** |
| Mass Reactive Rounds | upgrade/weapon | Ballistic Trait and Sharp Damage | `host:trait:ballistic ; host:trait:sharp` | Sharp damage read as the sharp trait. **Applied 2026-10-02** |
| Freight Carrier | perk | Brawn +d4, Alt Mode with Crew 1 or more | `self:skill:brawn>=d4 ; self:canTransform ; ask:Alt Mode with Crew 1+` | **Applied 2026-10-02** |
| Armor Upgrade Reinforced Shell | upgrade/armor | Carapaced, Monstrous, or Fuzor (Twofer) | `any(self:has:Carapaced / ask:Monstrous / self:has:Fuzor)` | "Fuzor (Twofer)" read as the Fuzor Origin. **Applied 2026-10-02** |
| Acute Senses | perk | Choose one of the five Senses or the Weird Skill | `(none)` | not a requirement - the text describes the Perk's own choice; left empty |
| Autonomous | upgrade/armor | Computerized, Perk that grants a drone pet | `host:trait:computerized ; ask:A Perk that grants a drone pet` | **Applied 2026-10-02** |
| Docking Charger | upgrade/armor | Computerized, Perk that grants a drone pet | `host:trait:computerized ; ask:A Perk that grants a drone pet` | **Applied 2026-10-02** |
| Sorcery | perk | Culture (Arcane) or Performance (Rituals) skill at +d2 or higher | `any(self:skill:culture>=d2 / self:skill:performance>=d2) ; ask:Arcane or Rituals Specialization` | **Applied 2026-10-02** |
| Machinist Revolutionary | perk | Culture (Machine Empire) d4 or higher | `self:skill:culture>=d4 ; ask:Machine Empire Specialization` | **Applied 2026-10-02** |
| Interpreter | perk | Culture +d4 or 3+ language | `any(self:skill:culture>=d4 / ask:Knows 3+ languages)` | **Applied 2026-10-02** |
| Robotic Animal Pet | perk | Cybertronian Origin, the Robot trait, or access to a Pet; Animal Handling d4 | `any(self:tag:robot / ask:Access to a Pet) ; self:skill:animalHandling>=d4` | Cybertronian Origin and the Robot trait both read as the robot creature tag (canTransform adds it). **Applied 2026-10-02** |
| Dogfighter | perk | Driving (Air or Aerospace) at +d4 or higher | `self:skill:driving>=d4 ; ask:Air or Aerospace Specialization` | **Applied 2026-10-02** |
| Daredevil | perk | Driving d6 with at least one specialization. | `self:skill:driving>=d6 ; ask:A Driving Specialization` | **Applied 2026-10-02** |
| Peerless Pilot | perk | Driving d6, with at least one Driving Specialization | `self:skill:driving>=d6 ; ask:A Driving Specialization` | **Applied 2026-10-02** |
| Surging | upgrade/weapon | Element | `any(host:trait:element / host:data:system.elementChoice)` | Element weapon read as the element trait or a chosen element. **Applied 2026-10-02** |
| Cybertronian Perk | perk | Energon Points Pool | `self:data:system.energon.normal.max>=1` | "Energon Points Pool" read as max Energon 1+. **Applied 2026-10-02** |
| Metallikato | perk | Finesse or Might d6 and Specialization in blades | `any(self:skill:finesse>=d6 / self:skill:might>=d6) ; ask:A blades Specialization` | **Applied 2026-10-02** |
| Aerodynamic | upgrade/weapon | Grenade or Thrown | `any(ask:Grenade / host:trait:thrown)` | **Applied 2026-10-02** |
| Aerodynamics | upgrade/weapon | Grenade or Thrown | `any(ask:Grenade / host:trait:thrown)` | **Applied 2026-10-02** |
| Aerodynamics | upgrade/weapon | Grenade or Thrown | `any(ask:Grenade / host:trait:thrown)` | **Applied 2026-10-02** |
| Independence Protocol | upgrade/drone | Initiative d2 | `self:skill:initiative>=d2` | the drone's own Skill. **Applied 2026-10-02** |
| Robust Ram | upgrade/vehicle | Land or Sea vehicle with a Ram attack | `any(self:data:system.traits.land / self:data:system.traits.sea) ; self:data:system.traits.ram` | Ram attack read as the ram vehicle trait. **Applied 2026-10-02** |
| Constrictor | perk | Large size | `self:size=large` | exactly Large; could be meant as Large or larger. **Applied 2026-10-02** |
| Contact: The White Knight | perk | Level 4 or higher; must have performed a heroic act | `self:level>=4 ; ask:Performed a heroic act` | **Applied 2026-10-02** |
| Emissary's Gift | perk | Level 5+. GM Approval | `self:level>=5 ; ask:GM approval` | **Applied 2026-10-02** |
| Field Promotion | perk | Level 6+, faction member | `self:level>=6 ; self:count:faction>=1` | "faction member" read as owning a Faction item. **Applied 2026-10-02** |
| Tongues | perk | Linguistics Perk or know 4+ Languages | `any(self:hasType:perk:Linguistics / ask:Knows 4+ languages)` | **Applied 2026-10-02** |
| Tongues | perk | Linguistics Perk or know 4+ Languages | `any(self:hasType:perk:Linguistics / ask:Knows 4+ languages)` | **Applied 2026-10-02** |
| Heavy Hitting | upgrade/weapon | Long melee weapon that deals Blunt damage | `host:data:system.classification.size=long ; ask:Melee weapon ; host:trait:blunt` | damage read as trait. **Applied 2026-10-02** |
| Flashlight | upgrade/weapon | Medium or Large | `any(host:data:system.classification.size=medium / ask:Large weapon)` | "Large" is not a weapon size. **Applied 2026-10-02** |
| Flashlight | upgrade/weapon | Medium or Large | `any(host:data:system.classification.size=medium / ask:Large weapon)` | "Large" is not a weapon size. **Applied 2026-10-02** |
| Flashlight | upgrade/weapon | Medium or Large | `any(host:data:system.classification.size=medium / ask:Large weapon)` | "Large" is not a weapon size. **Applied 2026-10-02** |
| Bullpup | upgrade/weapon | Medium or larger ranged weapon with the Reload trait | `any(host:data:system.classification.size=medium / host:data:system.classification.size=long / host:data:system.classification.size=heavy) ; ask:Ranged weapon ; host:trait:reload` | **Applied 2026-10-02** |
| Suppressor | upgrade/weapon | Medium or long targeting weapon without the Silent trait | `any(host:data:system.classification.size=medium / host:data:system.classification.size=long) ; ask:Targeting weapon ; not:host:trait:silent` | **Applied 2026-10-02** |
| Tethered | upgrade/weapon | Non-ballistic projectile weapon | `ask:Projectile weapon ; not:host:trait:ballistic` | **Applied 2026-10-02** |
| Cyborg | perk | Optimized Part or three or more permanent Cybernetic Alterations | `any(self:has:Optimized Part / ask:3+ permanent Cybernetic Alterations)` | **Applied 2026-10-02** |
| Mutant | perk | Outright Mutation or three or more permanent Genetic Alterations | `any(self:has:Outright Mutation / ask:3+ permanent Genetic Alterations)` | **Applied 2026-10-02** |
| Chrono-Trigger | upgrade/weapon | Ranged Sidearm | `host:data:system.classification.size=sidearm ; ask:Ranged weapon` | **Applied 2026-10-02** |
| Deadly | upgrade/weapon | Sharp | `host:trait:sharp` | Sharp damage read as the sharp trait. **Applied 2026-10-02** |
| Deadly | upgrade/weapon | Sharp | `host:trait:sharp` | Sharp damage read as the sharp trait. **Applied 2026-10-02** |
| Gunport | upgrade/armor | Shield of Battledress with the Shield trait | `any(host:type:shield / host:trait:shield)` | "Shield or Battledress with the Shield trait" read as a shield item or armor with the shield trait. **Applied 2026-10-02** |
| Collapsible | upgrade/weapon | Sidearm melee weapon that deals Blunt or Sharp damage | `host:data:system.classification.size=sidearm ; ask:Melee weapon ; any(host:trait:blunt / host:trait:sharp)` | damage read as trait. **Applied 2026-10-02** |
| Slender | upgrade/weapon | Sidearmor Medium melee weapon that deals Sharp damage | `any(host:data:system.classification.size=sidearm / host:data:system.classification.size=medium) ; ask:Melee weapon ; host:trait:sharp` | damage read as trait. **Applied 2026-10-02** |
| Arashikage Shozoku | upgrade/armor | Silent, Stealth | `host:trait:silent ; ask:Stealth upgrade` | **Applied 2026-10-02** |
| Empathetic | upgrade/drone | Social 2 | `self:essence:social>=2` | the drone's own Social. **Applied 2026-10-02** |
| Scramble Modulator | upgrade/weapon | Sonic Damage | `host:trait:sonic` | Sonic damage read as the sonic trait. **Applied 2026-10-02** |
| Grid Spectrum Echo | perk | Spectrum Shift Perk; Levels in former Spectrum Role | `self:hasType:perk:Spectrum Shift ; ask:Levels in a former Spectrum Role` | **Applied 2026-10-02** |
| Evasive Handling | upgrade/vehicle | Speed Essence 4 | `self:essence:speed>=4` | read as the vehicle's own Speed; may mean the driver's. **Applied 2026-10-02** |
| Larger Than Life | perk | Threat | `self:type:npc` | "Threat" read as the NPC actor type. **Applied 2026-10-02** |
| Mystic | perk | Threat | `self:type:npc` | "Threat" read as the NPC actor type. **Applied 2026-10-02** |
| Chrono Break | perk | Time Force Ranger | `self:has:Time Force` | read as owning the Time Force Perk. **Applied 2026-10-02** |
| Hybrid Bot Mode | perk | Vehicle Alt Mode | `self:canTransform ; ask:Vehicle Alt Mode` | **Applied 2026-10-02** |
| Cowcatcher | upgrade/vehicle | Vehicle with a Ram attack | `self:data:system.traits.ram` | Ram attack read as the ram vehicle trait. **Applied 2026-10-02** |
| Ongoing | upgrade/weapon | Weapon that deals Element damage | `any(host:trait:element / host:data:system.elementChoice)` | Element weapon read as the element trait or a chosen element. **Applied 2026-10-02** |
| Covering | upgrade/weapon | Weapon with a blast or area of effect | `any(host:trait:area / ask:Blast weapon)` | **Applied 2026-10-02** |
| High Density | upgrade/weapon | Weapon with a range measured in feet, with either the Ballistic or Laser trait | `ask:Range measured in feet ; any(host:trait:ballistic / host:trait:laser)` | **Applied 2026-10-02** |

## Ask only - for human review (72 items)

| Item | Type | Printed text | when | Notes |
|---|---|---|---|---|
| Face-Shift | perk | Ability to change shape | `ask:Ability to change shape` |  |
| Master Morph | perk | Ability to change shape | `ask:Ability to change shape` |  |
| Multimorph | perk | Ability to change shape | `ask:Ability to change shape` |  |
| Object-Shift | perk | Ability to change shape | `ask:Ability to change shape` |  |
| Size-Shift | perk | Ability to change shape | `ask:Ability to change shape` |  |
| Forward Observation | perk | Alertness (Perception) Specialization | `ask:Alertness (Perception) Specialization` |  |
| Ever Vigilant | perk | Alertness (Situational Awareness) Specialization | `ask:Situational Awareness Specialization` |  |
| Holographic Sights | upgrade/weapon | Any targeting weapon | `ask:Targeting weapon` |  |
| Paintball Rounds | upgrade/weapon | Any targeting weapon | `ask:Targeting weapon` |  |
| Tritium Sights | upgrade/weapon | Any targeting weapon | `ask:Targeting weapon` |  |
| Fire Selection Switch | upgrade/weapon | Assault rifle or Submachine gun | `ask:Assault rifle or Submachine gun` |  |
| Done the Impossible | perk | At least 3 successful missions | `ask:3+ successful missions` |  |
| Rock Climber | perk | Athletics (Climbing) Specialization | `ask:Athletics (Climbing) Specialization` |  |
| Skier | perk | Athletics (Skiing) or Survival (Arctic) Specialization | `ask:Skiing or Arctic Specialization` |  |
| Diver | perk | Athletics (Swimming) Specialization | `ask:Athletics (Swimming) Specialization` |  |
| Honorary Apple | perk | Awarded for finishing the In a Jam adventure with Happy, Joyous, or Overjoyed Customers | `ask:Awarded by the In a Jam adventure` |  |
| Leech Siphons | upgrade/weapon | Close Combat Blade | `ask:Close Combat Blade` |  |
| Front-Weighted | upgrade/weapon | Close Combat Blade or Bludgeon | `ask:Close Combat Blade or Bludgeon` |  |
| Non-Newtonian Gel | upgrade/armor | Counter-Ballistic, Counter-Element, or Counter-Kinetic trait, or Reinforced upgrade | `ask:Counter-Ballistic/Element/Kinetic or Reinforced` |  |
| Replacement Plate | upgrade/armor | Counter-Ballistic, Counter-Element, or Counter-Kinetic trait, or Reinforced upgrade | `ask:Counter-Ballistic/Element/Kinetic or Reinforced` |  |
| Secret Chemical Treatment | upgrade/armor | Counter-Ballistic, Counter-Element, or Counter-Kinetic trait, or Reinforced upgrade | `ask:Counter-Ballistic/Element/Kinetic or Reinforced` |  |
| Hearty Meal | perk | Culture (Cuisine) or Performance (Cooking) Specialization | `ask:Cuisine or Cooking Specialization` |  |
| Choke Point Veterans | perk | Defeated the Joes at the Red Quarry choke point | `ask:Defeated the Joes at Red Quarry` |  |
| Eruptive | upgrade/weapon | Explosive | `ask:Explosive weapon` |  |
| Eruptive | upgrade/weapon | Explosive | `ask:Explosive weapon` |  |
| Eruptive | upgrade/weapon | Explosive | `ask:Explosive weapon` |  |
| Detonator Bomb | upgrade/weapon | Grenade | `ask:Grenade` |  |
| Detonator Bomb | upgrade/weapon | Grenade | `ask:Grenade` |  |
| Detonator Bomb | upgrade/weapon | Grenade | `ask:Grenade` |  |
| Imploder | upgrade/weapon | Grenade | `ask:Grenade` |  |
| Proximity Bomb | upgrade/weapon | Grenade | `ask:Grenade` |  |
| Proximity Bomb | upgrade/weapon | Grenade | `ask:Grenade` |  |
| Proximity Bomb | upgrade/weapon | Grenade | `ask:Grenade` |  |
| Time Bomb | upgrade/weapon | Grenade | `ask:Grenade` |  |
| Time Bomb | upgrade/weapon | Grenade | `ask:Grenade` |  |
| Time Bomb | upgrade/weapon | Grenade | `ask:Grenade` |  |
| Agreeable | perk | Limited or Restricted animal pet | `ask:A Limited or Restricted animal pet` |  |
| Aerialbot Team Contact | perk | Maximum Allegiance Points 5 or higher | `ask:Max Allegiance Points 5+` | Allegiance Points live on the Contact NPC, not the PC |
| Protectobot Team Contact | perk | Maximum Allegiance Points 5 or higher | `ask:Max Allegiance Points 5+` | Allegiance Points live on the Contact NPC, not the PC |
| Corrosive Tip | upgrade/weapon | Melee | `ask:Melee weapon` |  |
| Corrosive Tip | upgrade/weapon | Melee | `ask:Melee weapon` |  |
| Corrosive Tip | upgrade/weapon | Melee | `ask:Melee weapon` |  |
| Arched | upgrade/weapon | Melee Weapon | `ask:Melee weapon` |  |
| Boarder | upgrade/weapon | Melee Weapon | `ask:Melee weapon` |  |
| Balanced Grip | upgrade/weapon | Might or Finesse | `ask:Might or Finesse weapon` |  |
| Balanced Grip | upgrade/weapon | Might or Finesse | `ask:Might or Finesse weapon` |  |
| Balanced Grip | upgrade/weapon | Might or Finesse | `ask:Might or Finesse weapon` |  |
| PAD Adapter | upgrade/weapon | Missile | `ask:Missile` |  |
| Lance of Light | perk | Must have Defeated a Threat Level 8+ enemy | `ask:Defeated a Threat Level 8+ enemy` |  |
| Nemesis (Specific Threat) | perk | must have Defeated an enemy of Threat Level 12 or higher | `ask:Defeated a Threat Level 12+ enemy` |  |
| Fortified Bond | perk | One or more Contacts | `ask:One or more Contacts` | Contacts are NPC actors, not items - no count: tag fits |
| Worthy Contact | perk | One or more Contacts | `ask:One or more Contacts` | Contacts are NPC actors, not items - no count: tag fits |
| Learned from the Best | perk | One or more Contacts with Threat stat blocks | `ask:A Contact with a Threat stat block` |  |
| Needle Drop | perk | Performance (Music) Specialization | `ask:Performance (Music) Specialization` |  |
| Perch | upgrade/armor | Perk that grants an animal pet | `ask:A Perk that grants an animal pet` |  |
| Screwball | upgrade/weapon | Projectile weaon with range measured in feet | `ask:Projectile weapon, range in feet` |  |
| Remote Skill System | perk | Purpose is a Smarts or Social Skill | `ask:Purpose is a Smarts or Social Skill` |  |
| Third Arm | upgrade/armor | Ranged weapon with the Mounted trait and without the Vehicular trait | `ask:Ranged Mounted, non-Vehicular weapon` |  |
| Biotech Performance Enhancer | upgrade/vehicle | Ranger Operator Only | `ask:Ranger Operator` | vehicle upgrade; the Perk is on the driver, not the vehicle |
| Bot-Hunter | perk | See book | `ask:See book` |  |
| Artificial Intelligence | upgrade/drone | Smarts d6 | `ask:Smarts d6` | a die on an Essence; unclear whose |
| Virtual Intelligence | upgrade/drone | Smarts d8 | `ask:Smarts d8` | a die on an Essence; unclear whose |
| Personality | upgrade/drone | Social d6 | `ask:Social d6` | a die on an Essence; unclear whose |
| Frequency Interference | perk | Technology (Computers) Specialization | `ask:Technology (Computers) Specialization` |  |
| EOD (Explosive Ordnance Disposal) | perk | Technology (Explosives) Specialization | `ask:Technology (Explosives) Specialization` |  |
| Big Swing | perk | Trained to use a heavy Anti-Tank or Ballistic weapon | `ask:Trained with a heavy Anti-Tank or Ballistic weapon` |  |
| Folding Stock | upgrade/weapon | Two-handed targeting weapon | `ask:Two-handed Targeting weapon` |  |
| Forward Grip | upgrade/weapon | Two-handed targeting weapon | `ask:Two-handed Targeting weapon` |  |
| Integrated Bipod | upgrade/weapon | Two-handed targeting weapon | `ask:Two-handed Targeting weapon` |  |
| Recoil Brace | upgrade/weapon | Two-Handed Weapon | `ask:Two-handed weapon` |  |
| Pressurized Cabin | upgrade/vehicle | Vehicle with an enclosed crew compartment | `ask:Enclosed crew compartment` |  |
| Tinted Canopy | upgrade/vehicle | Vehicle with an enclosed crew compartment | `ask:Enclosed crew compartment` |  |

## Exact, with notes (same-name items of another kind, assumptions) (5 items)

| Item | Type | Printed text | when | Notes |
|---|---|---|---|---|
| Titan Frame | upgrade/armor | Huge or Larger (Bot Mode) | `self:size>=huge` | Bot Mode size is system.size |
| Vehicular | upgrade/drone | Large | `self:size>=large` | the drone's size |
| Static Slide Inhibitor | upgrade/armor | Large or Smaller Bot Mode | `self:size<=large` | Bot Mode size is system.size |
| Retention Lanyard | upgrade/weapon | Medium or smaller weapon | `any(host:data:system.classification.size=sidearm / host:data:system.classification.size=light / host:data:system.classification.size=medium)` | Integrated weapons excluded |
| Tracer Rounds | upgrade/weapon | Ranged Weapon with the Ballistic trait | `host:trait:ballistic` | Ballistic implies ranged |

