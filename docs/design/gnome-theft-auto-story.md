# Gnome Theft Auto: Story & Narrative Design Bible

> **Setting:** `apocrypha` ([docs/lore/settings.md](../lore/settings.md), [R-015](../lore/rulings.md#r-015), [R-016](../lore/rulings.md#r-016))  
> **Game:** `games/gnome-theft-auto` ([README](../../games/gnome-theft-auto/README.md))  
> **Status:** Narrative & Content Design Proposal

---

## 1. Tone, Philosophy & The Gnomiverse Contract

### Serious Lore, Tongue-in-Cheek Execution
The Gnomiverse has serious bones. In **Fescue** (*Gnomes of Gnomomia*), gnomes are fired clay shaped 3,000 years ago by vanished **Tall Ones** in the **Kiln**, haunted by a jammed **Mower** grinding down the **Stopping Stone** in **the Shed**, and torn between tending the lawn, letting it grow, or cutting it all. In **The Tall House** (*Paragnormal*), porcelain gnomes shatter permanently in the dark.

*Gnome Theft Auto* does **not** throw that weight away—it **weaponizes the contrast**:
- **The lore stays serious.** Gnomes are still fired clay who chip, glaze, and fear the unseen Tall Ones. The Mower is still an existential terror in the collective gnome subconscious. Fescue refugees still carry trauma from the Rumbling. A cracked hat or a shattered friend still lands with real drama.
- **The game is unapologetically tongue-in-cheek.** Turfton is what happens when gnomes stop worshipping the Mower and start **hotwiring** it. Every character treats absurd garden-scale crime—boosting a Ride-On Mower, laundering acorns through a birdbath, dodging an HOA special assessment—with *Heat* / *Goodfellas* / *GTA* gravitas.
- **Self-aware satire (Apocrypha privilege).** Because *Gnome Theft Auto* lives in `apocrypha` (R-005, R-015, R-016), it can sarcastically poke at:
  1. **Itself & the crime-sandbox genre:** "Washed Out" at the Glaze Clinic instead of Wasted; "Hat Watch" stars instead of wanted levels; pedestrians throwing their hands up and sprinting the second a single droplet hits their glaze.
  2. **The Gnomiverse itself:** Fescue's 3,000-year-old prophecies treated like pretentious art-school nonsense by Turfton street hustlers; *Lawn Gnome Panic*'s acorn hoarding mocked as boomer-gnome prepper culture; *Gnome Front*'s endless Red Cap vs. Blue Cap war reduced to two rival corners selling bootleg Black Dew.
  3. **Yet the stakes are real.** When the jokes stop and a betrayal hits—or when a rogue Combine Harvester is bearing down on a clay village—the story plays it completely straight.

---

## 2. Overall Story Arc & Themes

### Logline
*A seemingly gnormal gnome arrives in Turfton with nothing but a fresh coat of glaze and a bounced acorn loan, only to get dragged into a four-biome turf war over a secret Tall-One super-weapon buried beneath the Dust Flats.*

### The Arc: *From Gnormal to Infamous*
1. **Act I — Fresh Glaze (Turfton):** Just trying to pay off a "Kiln-Debt" and survive petty mower-jackings, the protagonist becomes the wheel-gnome for a washed-up Fescue exile and a shady Turfton fixer.
2. **Act II — Turf & Dew (Cloverfield Farms & Mossy Wood):** Expanding operations outside the city grid reveals that someone is cornering the **Black Dew** (petrol) and **Acorn** supply—and using **The HOA** as a legal front to foreclose on entire biomes.
3. **Act III — Cold Clay & High Altitude (Frostbite Fells & The Dust Flats):** A brutal betrayal fractures the crew. The protagonist goes on the run to the frozen north, uncovers the truth about **Project Even Cut** (an apocryphal re-imagining of Fescue's doom), and hits **Fort Sandpit** and the **Desert Airfield** to steal the **Whirligig** and a **Crop Duster**.
4. **Act IV — The Unmowed Horizon (Finale):** A multi-stage heist and aerial/ground showdown across Turfton's downtown towers to stop the **Grand Combine** from turning the entire 1200×1200 map into a sterile, regulation-height putting green.

### Core Themes
- **Fired Clay vs. Paint (Identity):** Everyone in Turfton wears a flashy hat and a fresh coat of glaze (`@lawn/gnome`), but underneath, you are what you were fired from. Can a "gnormal" gnome stay whole in a city built on cracks?
- **The Grid & The Unseen:** Turfton's streets are a suspiciously perfect grid (`ROAD_LINES = [-180..180]`), and Fort Sandpit's walls are literally a child's sandbox. Who laid the grid? Why are the Tall Ones never home? Living under giants who don't even know you're having a mob war.
- **Progress vs. Tradition:** Fescue's horror of the Mower vs. Turfton's obsession with strapping twin-turbos to a Zero-Turn Racer. When does "taming the machine" become becoming the machine?

---

## 3. Intro Sequence: *"Fresh Out the Kiln"* (Playable Cold Open)

### Scene 1: The Bus Stop on `x = -6.25, z = 14`
- **Visual:** Camera pans down from Turfton's downtown towers (giant terracotta pots, upside-down buckets, stacked garden bricks) to the player's own gnome (`loadMyGnome()`) standing on the sidewalk at `SPAWN` (`-6.25, 14`), holding a battered suitcase prefab and wearing whatever ridiculous outfit the player picked in *Gnome Creator*.
- **Voiceover (Radio / Narrator — dry, noir-ish):**  
  > *"Every gnome thinks they're special. Hand-painted. Limited edition. Then you step off the snail-coach in Turfton and realize half the block was cast from the same garden-centre mould."*
- **The Setup:** Your cousin **Pip "Two-Stroke" Potsworth** promised you a "legitimate import-export gig" in Turfton. Instead, he meets you in a dented **Push-Mower Bike** (`push-mower-bike`), sweating clay dust, with a **1-Hat Watch** siren already wailing two blocks over.

### Scene 2: Tutorial Chase — *"Borrowing" 101*
- **Dialogue:**  
  - **Pip:** *"Don't look at me like that! Technically it's not stealing if the owner left the key in the ignition and went inside a flowerpot!"*
  - **Player objective:** Hop on a nearby **Ride-On Mower** (`ride-on-mower`) at the kerb (`E` / Enter button) and follow Pip through Turfton's grid while dodging two Hat Watch officers.
- **First Genre Joke:** An officer steps into the road, fires a warning shot from a pistol (`weapons.ts`), and misses—hitting a pedestrian instead. The pedestrian immediately throws both hands into the air (`poseHandsUp`) and sprints down the sidewalk screaming, *"MY GLAZE! I JUST GOT THIS BUFFED!"*
- **The Hook:** You lose the Hat Watch in an alley behind **The Gnomecino** (Turfton branch), only to find Pip's "employer"—**Tansy "Side-Valve" Clayfoot**—waiting by a smoking **Zero-Turn Racer**. Inside the mower's grass-catcher bag isn't grass clippings. It's a **sealed crate stamped with the Fescue Crown** and a glowing **Golden Acorn** humming like a battery.
- **Title Card:** **GNOME THEFT AUTO** slams onto the screen as Pip whispers: *"Okay, yeah. That might not be grass."*

---

## 4. Main Characters

| Character | Role | Appearance / Look | Backstory & Motivation | Arc |
|---|---|---|---|---|
| **The Protagonist** *(Player's Gnome)* | The "Gnormal" Outsider | `@lawn/gnome` (`getMyGnome()?.look`, fallback `DEFAULT_LOOK`) | Arrived in Turfton to pay off a kiln-repair debt after a minor mower incident back home. Quiet, pragmatic, chronically underpaid. | Goes from pawn running errands to the only gnome with the nerve to fly a Crop Duster into a Combine's intake. |
| **Pip "Two-Stroke" Potsworth** | Best Friend / Liability | Green coat, crooked red cap, grease-stained beard | Distant, disgraced cousin of **Wendel Potsworth** (Fescue's regent). Fled Fescue because he tried to put wheels on a wheelbarrow and was accused of "Mower-sympathy." Loves engines, terrible at math. | Wants to prove he's not just the family embarrassment. Nearly gets shattered in Act III protecting the protagonist's getaway. |
| **Tansy "Side-Valve" Clayfoot** | Mentor / Fixer | Charcoal coat, dark glasses, yellow cap | Claims to be a direct descendant of **Gnorwin Clayfoot**. Runs *Side-Valve Salvage* on the edge of downtown. Sharp, cynical, speaks in garden proverbs twisted into street slang. | Starts out using the protagonist to skim Black Dew; genuinely comes to care for the crew when the HOA tries to bulldoze her garage. |
| **Vesper "The Glazier" Thorne** | Main Antagonist | Crisp white porcelain finish, tall obsidian top-hat, monocle | Not earthenware like Turfton's gnomes—**porcelain**, rumored to have escaped **The Tall House**. CEO of *Thorne Lawn & Order LLC* and secret Chair of **The HOA**. Believes Turfton is "weedy, chipped, and unseemly." | Wants to seize Fort Sandpit's tech and Cloverfield's Black Dew to power **The Grand Combine**, leveling Turfton into a silent, manicured estate. |
| **Commander Diggs** | Spade Guard Hardliner | Olive cap, tactical trowel bandolier | Decorated veteran of Fort Sandpit who has spent 15 years guarding a flying mower nobody is legally allowed to turn on. | Starts as an enemy during the Fort Sandpit raid; turns reluctant ally in Act IV when he realizes Vesper plans to scrap the Spade Guard too. |
| **Granny Gnertrude** | Information Broker / Fence | Floral apron, oversized spectacles, pink bonnet | Runs a "bake shop" near the Cloverfield border. Actually the sharpest black-market acorn fence in three biomes. | Supplies the crew with forged HOA permits and heavy hardware (`Shotgun`, `Rifle`) in exchange for rare Fescue relics. |

---

## 5. Factions & Motivations

1. **The Hat Watch** *(Existing — `police.ts`)*
   - **Who:** Turfton's municipal police in navy caps and yellow coats.
   - **Motivation:** Keep the sidewalks dry, hit their monthly soaking-ticket quota, and never, *ever* file paperwork after 5:00 PM.
   - **Story Role:** Easily bribed by Vesper in Act II; turns a blind eye to HOA enforcers while ramping up to 3-Hat Heat whenever the protagonist breathes near downtown.

2. **The Spade Guard** *(Existing — `police.ts`, Fort Sandpit)*
   - **Who:** Olive-capped paramilitary guarding **Fort Sandpit** (`BASE`) and the **Desert Airfield** (`AIRFIELD`).
   - **Motivation:** Protect **The Whirligig** and the Tall Ones' abandoned sandbox relics from "civilian stupidity."
   - **Story Role:** Guarding the toys Vesper wants to weaponize. Infiltrating them is the centerpiece of Act III.

3. **The HOA (Homeowners' Association)** *(Imported & Expanded from `gnome-company` apocrypha)*
   - **Who:** Faceless, clipboard-wielding enforcers in matching beige vests, backed by Vesper Thorne.
   - **Motivation:** *"Uniformity. Curb Appeal. Zero Unapproved Grass Height."* They issue predatory fines ("Citation: Unauthorized Lawn Ornament") to foreclose on Turfton shops and Cloverfield farms.
   - **Tongue-in-cheek bite:** Their ultimate threat isn't bullets—it's a **Lien on Your Flowerpot**.

4. **The Fescue Exiles ("The Unmowed")**
   - **Who:** Traditionalist earthenware gnomes who slipped through a gap in the Fence generations ago, now living in **Mossy Wood**.
   - **Motivation:** Terrified of Turfton's mower culture. They believe every revving Ride-On is waking something older and worse.
   - **Story Role:** Initially hostile to the protagonist ("You smell of Black Dew!"), they hold the ancient knowledge of **how to jam a Mower**—the exact secret needed to stop the Grand Combine.

5. **The Carburettors (Turfton Street Crew)**
   - **Who:** Underground street-racers and chop-shop mechanics operating out of downtown alleys and **Frostbite Fells** ice tracks.
   - **Motivation:** Speed, custom paint tints (`MOWER_TINTS`), and keeping Turfton's roads wild.
   - **Story Role:** Allies you earn by winning illegal Zero-Turn races and rescuing their impounded rides.

6. **Red Cap & Blue Cap Corners** *(Easter Egg / Street Gangs)*
   - **Who:** Two petty street gangs perpetually fighting over a single grassy median in Turfton.
   - **Motivation:** Nobody remembers why they started fighting, only that the other side's hat is the wrong primary colour. (Direct nod to *Gnome Front*.)

---

## 6. High-Level Chapters (Acts & Mission Arcs)

### Prologue: *Fresh Out the Kiln* (Turfton)
- **Beats:** Arrival at `SPAWN`, Pip's botched mower-jacking, escaping the Hat Watch, meeting Tansy at *Side-Valve Salvage*, discovering the glowing Golden Acorn in the stolen mower.

### Chapter 1: *Acorns & Alibis* (Turfton Downtown)
- **Focus:** Groundwork, street hustle, learning Turfton's grid, guns, and vehicle classes.
- **Key Beats:**
  - Repossess three "delinquent" Push-Mower Bikes for Tansy (only to realize the owners are Cloverfield farmers being squeezed by the HOA).
  - Run security for an illegal **Zero-Turn Racer** street race through downtown (`ROAD_LINES`), interrupted by Red Cap / Blue Cap crossfire.
  - Break into the **Turfton Glaze & Tax Office** to steal back Tansy's deed—discovering Vesper Thorne's signature on every foreclosure in the city.
- **Climax:** A high-speed getaway through downtown in a stolen **Combine Harvester** (`combine`), smashing through HOA roadblocks while Pip hangs off the ladder firing an SMG.

### Chapter 2: *Black Dew & Greenbacks* (Cloverfield Farms & Mossy Wood)
- **Focus:** Leaving the city grid via the `south` and `west` highways (`HIGHWAYS`). Exploring biomes, convoy heists, and Fescue lore.
- **Key Beats:**
  - **Cloverfield Farms:** Help Granny Gnertrude defend her acorn silos from HOA "Code Enforcement" squads. Hijack a Black Dew tanker convoy on the `south` highway.
  - **Mossy Wood:** Track a missing shipment into the deep woods, where **The Unmowed** (Fescue exiles) ambush you—not with guns, but with tangled vines and an ancient, rusted **Stopping Stone** shard.
  - **The Serious Turn:** An Elder of the Unmowed shows the protagonist a cracked earthenware tablet: *the Grand Combine Vesper is building isn't a Turfton toy—it's patterned after Fescue's original Mower.* For the first time, the jokes drop. Pip asks quietly: *"Wait... they're really gonna level the whole lawn?"*

### Chapter 3: *Cold Clay* (Frostbite Fells)
- **Focus:** Betrayal, exile, tundra survival, and rebuilding the crew.
- **Key Beats:**
  - **The Ambush:** Vesper frames Tansy and the protagonist for soaking the Hat Watch Commissioner. *Side-Valve Salvage* is raided and burned (well, *hosed down and demolished*). Pip takes a heavy hit—his clay arm cracks clean off—and the protagonist flees north up the `north` highway into **Frostbite Fells**.
  - **Tundra Hustle:** Hide out in a frozen cabin, smuggle Black Dew and Glaze-Glue across frozen lakes for the Carburettors, and patch Pip back together using **Kiln-Resin** from an abandoned shrine.
  - **The Plan:** Tansy surfaces via encrypted snail-mail (literally a snail). If Vesper is building the Grand Combine in downtown Turfton, they need **air superiority** and **the Unmowed's Stopping Stone**. That means hitting **The Dust Flats**.

### Chapter 4: *Sandpit Protocol* (The Dust Flats: Fort Sandpit & Airfield)
- **Focus:** Military heist, planes, parachutes, and the Whirligig.
- **Key Beats:**
  - **Prep 1 — The Runway:** Sneak into the **Desert Airfield** (`AIRFIELD`) at `x: 480, z: -110`, steal a **Crop Duster** (`plane`), and fly low under radar through the canyons to drop flares for the Unmowed's covert team.
  - **Prep 2 — Bailout:** Parachute directly into **Fort Sandpit** (`BASE`, `x: 340..408, z: -34..34`) to avoid the main gate's Spade Guard turrets.
  - **The Heist:** Fight through the sandbox walls, raise **3-Hat Heat**, and lift **The Whirligig** (`whirligig`) off the pad (`padX: 358, padZ: -8`) while Commander Diggs chases you on a Zero-Turn.
  - **The Truce:** Mid-air, Diggs radios in—Vesper's HOA goons just locked Fort Sandpit's armory remotely and declared the Spade Guard "redundant." Diggs mutters: *"Nobody fires the Guard. Especially not a guy in a porcelain hat."*

### Chapter 5: *The Even Cut* (Turfton Finale)
- **Focus:** Multi-angle finale combining driving, shooting, flying, and Fescue's oldest myth.
- **Key Beats:**
  - Vesper activates **The Grand Combine**—a skyscraper-sized, autonomous harvester rolling down `x = 0` toward downtown Turfton, escorted by HOA enforcers and bribed Hat Watch cruisers.
  - **Phase 1 (Air):** Pilot the **Crop Duster** / **Whirligig** to strafe the Grand Combine's escort and drop Pip onto its moving deck (`parachute` bailout).
  - **Phase 2 (Deck):** Fight across the Combine's roof while Vesper monologues over the PA system about "eliminating chaos, weeds, and crooked hats forever."
  - **Phase 3 (The Jam):** Instead of blowing it up with Hollywood C4, the protagonist rams the **Fescue Stopping Stone** into the Combine's main intake—honoring Gnorwin Clayfoot's original move—before bailing out as the machine locks up and tips into the drainage ditch.
- **Epilogue:** Turfton is scarred, *Side-Valve Salvage* is reopening, Commander Diggs is drinking at The Gnomecino, and the protagonist finally pays off their Kiln-Debt... only to get a mysterious text from **Club Gnome** about a "small job at a bowling alley."

---

## 7. Easter Eggs from Other Gnome Games

Every biome and block in Turfton can quietly nod to the wider Gnomiverse without breaking *Gnome Theft Auto*'s flow:

| Source Game | Easter Egg in *Gnome Theft Auto* | Where / How Found |
|---|---|---|
| **Gnomes of Gnomomia** | A weathered statue of **Gnorwin Clayfoot** in Turfton's park with a traffic cone on its head; graffiti reading *"EVEN CUT WAS HERE"*. | Downtown Turfton park / alleyways |
| **Lawn Gnome Panic** | A conspiracy-theorist radio caller screaming about **"THE GIANT ARMADILLO"** in the Dust Flats—and a rare unmarked Combine spawn in the desert named *Old Combine*. | Desert highway / Radio |
| **Lawn Prix** | Illegal midnight **Zero-Turn** time-trial checkpoints marked with Lawn Prix checkered flags; a billboard for *"The Grand Zero-Turn — No Guns Allowed (Mostly)"*. | Turfton & Cloverfield roads |
| **Gnome Front** | Red Cap and Blue Cap NPCs eternally having a turf standoff over a single picnic table ("upwind of the verge"). | Turfton suburban block |
| **Gnome Company** | A rusty van parked behind a church in Mossy Wood painted **"CHAPEL OF MULCH — QUOTA DUE FRIDAY"**; a **Cursed Truffle** pickup that whispers passive-aggressive HOA complaints. | Mossy Wood / HOA HQ |
| **Paragnormal** | A boarded-up, oversized **Tall House** porch at the far edge of Mossy Wood where the ambient audio drops out and a porcelain gnome warns: *"Don't look at the lantern."* | Far west Mossy Wood edge |
| **Incregnomtal** | A giant muddy pawprint crater in Cloverfield Farms called **"Biscuit's Nap"** where acorns spawn twice as fast. | Cloverfield Farms |
| **Gnaft** | A battered turf-raft washed up in the southern drainage canal with a "Castaway" NPC muttering about lawn sharks. | South edge of Turfton / Farmland |
| **Gnome Bowling / Billiards / Blackjack / Club Gnome** | **The Gnomecino** neon sign downtown; **Big Lou** occasionally spotted as a VIP bouncer outside who refuses to let anyone in wearing a wet hat. | Downtown Turfton |
| **Cooking Gnoma** | **Gnoma's Food Truck** parked near the Glaze Clinic, selling *Acorn-Flour Cake* (+100% Dryness) while Gnoma yells *"Oops, a little wobbly! We learn from it!"* if you bump her truck. | Outside Glaze Clinic |
| **Aether Board** | A glowing blue ley-line ramp on the highest peak of **Frostbite Fells**—hitting it on a Push-Mower Bike triggers a brief zero-gravity trick chime. | North Frostbite Fells |

---

## 8. Lore-Enriched Side Quests (*Strangers & Freaks of Turfton*)

Each side quest pushes the Gnomiverse's lore forward while keeping the dry, sarcastic GTA-parody voice:

1. **"The Grid Truthers"** *(Turfton — Pushes `turfton` loose thread)*
   - **Giver:** **Mossley "Plumb-Line" Inkcap**, a paranoid surveyor gnome with a chalkboard.
   - **Plot:** Mossley is convinced Turfton's perfect 60-unit grid (`ROAD_PITCH = 60`) proves the Tall Ones are *still* watching—or that Turfton is a scale model in someone's hobby room. You drive him to four survey markers while dodging Hat Watch patrols who think he's vandalizing sidewalks.
   - **Lore Payoff:** Finds a buried **Tall-One Pencil** (the size of a redwood) under `x = 0, z = 0`. Mossley realizes the truth is even weirder—and promptly sells the graphite as "artisan eyebrow pencil" to fund his retirement.

2. **"Porcelain Blues"** *(Mossy Wood — Connects `the-tall-house` to `apocrypha`)*
   - **Giver:** **Clara**, a cracked porcelain gnome hiding in a hollow log near the boarded-up porch.
   - **Plot:** Unlike Turfton's earthenware gnomes, Clara can't just "wash out" and walk away—she's brittle. She asks you to recover three **Wax Lanterns** stolen by HOA scavengers before nightfall so she can seal the porch door for good.
   - **Lore Payoff:** Explores the real tragedy of porcelain gnomes vs. earthenware gnomes (R-003), ending on a quiet, sincere note before Clara gifts you a **Porcelain-Glaze Charm** (reduces vehicle/fall soak damage).

3. **"The Fescue Fugitive"** *(Mossy Wood / Cloverfield — Connects `fescue` myths to `apocrypha`)*
   - **Giver:** **Elder Bracken**, a grumpy Unmowed scholar.
   - **Plot:** Bracken wants you to steal back a **Replica Stopping Stone** from Vesper's private museum—not because it's magical, but because Vesper is using it as a *doorstop*.
   - **Lore Payoff:** Reveals how Fescue's sacred history gets commodified into tacky lawn ornaments in Turfton, forcing the protagonist to choose between returning it to Bracken or fencing it to Granny Gnertrude for a massive acorn payout.

4. **"The HOA Audit"** *(All Biomes — Develops `hoa` lore)*
   - **Giver:** **Burt**, a nervous former HOA junior inspector who grew a conscience (or just got stiffed on overtime).
   - **Plot:** Repossess five absurdly petty HOA citation drones/vans across the biomes (citing a cactus in the Dust Flats for "unruly needles", citing a snowman in Frostbite Fells for "exceeding seasonal height").
   - **Lore Payoff:** Exposes how the HOA isn't run by Tall Ones at all—it's a cartel of middle-management gnomes pretending to speak for the Tall Ones to scare everyone else into paying tribute.

5. **"Castaway's Dry-Dock"** *(Cloverfield / Canal — Connects `gnaft`)*
   - **Giver:** **Driftwood**, a sun-bleached gnome sitting on a lawn-boat trailer.
   - **Plot:** Tow his makeshift raft across Cloverfield Farms using a Combine Harvester's hitch so he can reach the "Big Puddle" before the dry season hits.
   - **Reward:** Unlocks a custom **Sea-Foam Mower Tint** and a **Captain's Hat** cosmetic.

---

## 9. Storyboarded Main Story Quests

### Quest 1: *"Mower's Keepers"* (Chapter 1 — Early Game)
- **Trigger:** Talk to **Tansy** at *Side-Valve Salvage* (`x: -120, z: 60` area) after the Prologue.
- **Briefing (Cutscene/Dialogue):**  
  Tansy is welding a Push-Mower Bike with a kitchen blowtorch.  
  > **Tansy:** *"The HOA put a 'boot' on three of my client's bikes. Technically it's a giant clothespin, and technically it's illegal for me to touch it. Good thing you're not me."*
- **Beats:**
  1. **Go to Downtown Block (`x: 60, z: -60`):** Locate three clamped Push-Mower Bikes guarded by two HOA Enforcers (using `Pistol`s).
  2. **The Complication:** The moment you hop on the first bike (`E`), a Hat Watch cruiser spawns nearby—someone called in a noise complaint. **Heat jumps to 1 Hat.**
  3. **Objective:** Drive all three bikes (or tow/clear the lot and ride the target bike) back to *Side-Valve Salvage* while losing the Watch out of `SEEN_DISTANCE` (`30` units).
  4. **The Twist:** On the third bike's handlebars, you find an HOA eviction notice addressed to **Tansy's own garage**.
- **Gameplay Systems Used:** `vehicles.ts` (`push-bike`), `police.ts` (1-Hat Watch pursuit + cooling), `weapons.ts` (optional firefight), `hud.ts` (waypoint + objective banner).

### Quest 2: *"Dew Run on Route South"* (Chapter 2 — Mid Game Convoy Heist)
- **Trigger:** Meet **Granny Gnertrude** at her Cloverfield Farmhouse (`south` highway).
- **Briefing:**  
  > **Granny Gnertrude:** *"Vesper's boys are draining the Cloverfield Dew-Wells dry. Go park a Combine across the south highway, stop their convoy, and bring me the fuel. And try not to splatter my prize pumpkins—they're load-bearing."*
- **Beats:**
  1. **Acquire Heavy Iron:** Steal a **Combine Harvester** (`combine`) from a nearby Cloverfield barn.
  2. **The Blockade:** Drive onto the `south` highway bend (`[0, 260] -> [-40, 320]`) and block the lane before the HOA convoy timer expires.
  3. **The Ambush:** Two **Ride-On Mowers** and an armored **Zero-Turn** escort screech to a halt. HOA guards dismount and open fire. Use the Combine as cover and clear them with the `Shotgun` or `Rifle`.
  4. **The Getaway:** Ditch the wrecked Combine, hop into the lead Dew-Hauler Ride-On, and race back to Granny's barn while dodging a **2-Hat Watch** response.
- **Climax / Dialogue:** Granny inspects the Dew canister, sniffs it, and grins: *"Pure 87-octane. Now we can cook."*

### Quest 3: *"The Sandpit Drop"* (Chapter 4 — Late Game Military Heist)
- **Trigger:** Meet **Tansy** and **Pip** (arm freshly glued with Kiln-Resin) at the **Dust Flats** overlook (`x: 280, z: 40`).
- **Briefing:**  
  > **Pip:** *"Okay, hear me out. The gate at Fort Sandpit is guarded by five Spade Guard snipers. So we don't use the gate."*  
  > **Player:** *(stares blankly)*  
  > **Pip:** *"We steal a Crop Duster from the airfield, fly over the wall, and jump out without checking if the parachute actually works."*
- **Beats:**
  1. **Infiltrate Airfield (`AIRFIELD`, `x: 480, z: -110`):** Sneak or shoot past two Spade Guard patrols on the apron and board a **Crop Duster** (`plane`).
  2. **Takeoff:** Build airspeed above `stallSpeed` (`22`) down the 170-unit runway (`yaw: Math.PI / 2`) and pull up (`Space`).
  3. **The Drop:** Fly west toward **Fort Sandpit** (`BASE`, `x: 340..408, z: -34..34`). When the HUD target ring turns green above the base, hit `E` to bail out.
  4. **Freefall & Landing:** Automatic parachute deploys after ~1s. Steer your glide onto the Whirligig landing pad (`padX: 358, padZ: -8`).
  5. **The Lift:** Entering Fort Sandpit immediately triggers **2-Hat Heat**; boarding **The Whirligig** (`whirligig`) spikes it to **3-Hat Heat**. Climb straight up (`Space`, `ceiling: 100`) over the sandbox walls while Spade Guard shots ping off the blades, then fly back to the safehouse to clear heat.
- **Gameplay Systems Used:** `vehicles.ts` (`plane` takeoff/stall, `whirligig` vertical flight), `player.ts` (parachute bailout & glide), `police.ts` (Fort Sandpit guards + 3-Hat Heat).

---

## 10. Architecture: Connecting to What Exists vs. What's Next

### What Already Exists in `games/gnome-theft-auto/src/`
| Existing Module | Story Hook / Ready Today |
|---|---|
| `config.ts` & `biomes.ts` | 1200×1200 map with 5 named biomes (`Turfton`, `The Dust Flats`, `Mossy Wood`, `Frostbite Fells`, `Cloverfield Farms`), `HIGHWAYS`, `BASE` (Fort Sandpit), and `AIRFIELD` are already built and named. |
| `vehicles.ts` & `simdrive.ts` | All 6 signature vehicles (`push-bike`, `ride-on`, `zero-turn`, `combine`, `plane`, `whirligig`) + damage stages (`dented`, `wrecked`) + `@lawn/vehicle` sim physics. |
| `weapons.ts` & `fx.ts` | Hitscan `Pistol`, `SMG`, `Shotgun`, `Rifle` + reload/swap + projectile tracers. |
| `police.ts` & `npcs.ts` | **Hat Watch** (1–3 Hats), **Spade Guard** at `BASE.guardPosts`, hands-up flee reactions (`poseHandsUp`), and `ragdoll.ts` flings. |
| `gnomes.ts` | `@lawn/gnome` integration (`loadMyGnome`, `getMyGnome`) so the player's own gnome is the protagonist. |
| `net.ts` & `remotes.ts` | `@lawn/mp` drop-in online free-roam (`1–16` players) — co-op story or free-roam mayhem ready. |

### What Has Yet to Exist (Implementation Roadmap)
1. **Mission & Quest State Machine (`src/story.ts` / `src/missions/`):**
   - Mission registry (`id`, `chapter`, `giver`, `objectives[]`, `onComplete`), save state (via `@lawn/cloudsave` + `localStorage`), and active-mission lock (switching between Free Roam and Story Mission mode).
2. **Dialogue, Cutscene & Radio UI (`src/dialogue.ts` / `src/radio.ts`):**
   - Bottom-third subtitle & portrait box for briefings/banter while driving (mobile-friendly, tap-to-advance, 44px+ buttons).
   - **Turfton FM Radio** (synthesized via `@lawn/music` / Tone.js + text-ticker DJ banter): *K-DEW Classic Mower Rock*, *Fescue Public Radio* (dry lore lectures), and *HOA Compliance Beats*.
3. **Quest Givers, Waypoints & World Markers (`src/markers.ts`):**
   - Glowing 3D ground rings (`T`, `P`, `G`, `!`) on the map + minimap icons in `hud.ts` to start missions and mark mission targets.
4. **Faction Hostility & Escort/Convoy AI:**
   - Extending `police.ts` / `npcs.ts` with mission-spawned enemy squads (HOA Enforcers, Red/Blue Caps) that shoot back rather than immediately fleeing on first hit.
5. **Economy & Safehouses:**
   - **Acorns** currency (`hud.ts`), Glaze Clinic "Washed Out" fee, weapon/ammo shop, and **Pay 'n' Glaze** (re-tint your mower with `MOWER_TINTS` to drop Hat Watch heat).
6. **New `@lawn/prefabs` & `@lawn/achievements`:**
   - Prefabs: `stopping-stone`, `hoa-clipboard`, `dew-tanker`, `grand-combine-boss`, `tall-one-pencil`, `porcelain-lantern`.
   - Achievements (`packages/achievements/src/catalog.ts`): e.g. *Fresh Out the Kiln*, *Sandpit Air-Drop*, *HOA Defier*, *The Even Cut* (with cosmetic hat/back/hand rewards!).

---

## 11. New Content & Feature Ideas (In-Theme)

- **Turfton Radio ("99.3 THE BLADE"):** While driving any mower or flying the Crop Duster, a subtle radio pill lets players cycle stations—including satirical commercials for *Side-Valve Salvage*, *Glaze Clinic* ("We'll dry you out, no questions asked"), and *Gnomecino* ("Now with 100% fewer chair-thrown brawls!").
- **Pay 'n' Glaze:** Drive a smoking, dented mower with 3-Hat Heat into Tansy's garage to repair it, swap its `MOWER_TINTS` colour, and instantly clear Hat Watch heat.
- **The Heist Board (Act IV):** A visual planning board in the safehouse (and a great future **Party Slice** candidate for `@lawn/party`—e.g. a 45-second *Sandpit Air-Drop* parachute-to-Whirligig race!).
- **Wanted Escalation (4th Hat — "THE HOA"):** Above 3 Hats, instead of more cops, an HOA **Code-Enforcement Van** arrives with megaphones reading municipal bylaws aloud, slowing nearby mowers until you smash it.
