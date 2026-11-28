# The waves of the Fortis Colosseum: sources and what is inferred

`client/encounters/colosseum/` is the kind `colosseum`: the waves before Sol
Heredit, who is an encounter of his own (`sol_heredit`). Every number in
those modules names its source in a comment. This page lists the sources,
the places where they disagree and which one the code follows, and
everything that no source says.

## Sources

| In comments | What | How it was read |
|---|---|---|
| OBS | The game itself, recorded from the client: what it was told, written to a file. One run on 2026-11-23, waves 1 to 4 | Where it and another source differ, it wins. The recordings are not in the repository |
| WIKI | oldschool.runescape.wiki: `Fortis_Colosseum`, `Fortis_Colosseum/Strategies`, `Fortis_Colosseum/Modifiers`, and the pages of the monsters (`Serpent_shaman`, `Jaguar_warrior`, `Javelin_Colossus`, `Manticore`, `Shockwave_Colossus`, `Minotaur_(Fortis_Colosseum)`, the three `Fremennik_warband_...`) | 2026-11-23. The main page wins over the strategy page |
| SIM | beta.colosim.com/waves.html, its script `main.js` | 2026-11-23. Numbers and the order of steps only: the script has no licence statement and none of its code is here. It fills what the wiki does not say and the recording does not show: tiles and tick counts |
| CACHE | the game cache (OpenRS2 2762): the names of NPCs, sequences and spot animations from its table of names, definitions as `node tools/cache-objects.mjs npc <id>` and `spot <id>` print them | |
| TABLE | `client/data/monsters.js`: hitpoints, levels and bonuses by NPC type | the simulator's stats for the six monsters are the same |

A tile of the simulator converts as `ours = (simX + 6, 60 - simY)`: its y
grows south, and both anchor an NPC at its south-west tile. Checked on the
four pillars and on the gate recesses of the north and south wall. A tile of
a recording is ours already.

What a projectile does (when it leaves, when it arrives, its heights and
its slope) is in no file of the game: the server sends it with every shot.
Only a recording has it. On the three counts where the simulator and Sol
Heredit's module differ about the warband, the recording showed the module
right, and it showed the simulator's hit delays for the shaman wrong: so
what is still SIM below (the shockwave colossus, the minotaur, two
manticores together) is the least sure part of the waves.

## The arena and a wave

S is the tick on which a wave's monsters appear.

| What | Value | Source |
|---|---|---|
| Map square | (28, 48), region 7216: Sol Heredit's, without his fence | CACHE |
| Start tile | 23,36 | SIM (17, 24) |
| Monsters placed | 5 ticks after the wave starts, with the line "Wave: N" in red | OBS: 5 ticks after the interface closes on which a modifier is chosen; SIM the same |
| Spawn points | twelve; one within 4 steps of where the player stood a tick before the placing is not used | SIM. OBS: every monster of four waves appeared on one of the twelve |
| Who goes where | the wave's monsters shuffled, the remaining points shuffled, monster i on point i | SIM |
| Warband | the archer on a random tile of x 28..34, y 33..39, the seer 2 east of it, the berserker 1 east and 1 north | SIM. OBS: those offsets, and the archer inside that square, in four waves |
| First attack | not before S+3; on its first turn a monster takes one step even with the player in reach | SIM. OBS: a shaman's first cast and the start of a manticore's first charge at S+3, a manticore's step at S+1 |
| Spawn animation | the warband, the shaman, the jaguar and the manticore play one as they appear; the javelin colossus none | OBS. The minotaur's: SIM |
| Reinforcements, when | S+66 | OBS, four waves. SIM: 67. WIKI: after 40 seconds |
| Reinforcements, which row | the north row (y 48) when the player stands at y 33 or more, else the south row (y 19) | SIM. WIKI: the nearer of the north and south gate. OBS: north four times, the player at y 36 to 42 |
| A monster's death | it stays 3 ticks after the kill (the manticore 4) and blocks the others meanwhile | OBS for the shaman, the jaguar, the javelin colossus and the manticore; SIM for the other two |
| A wave's end | the line "Wave N completed! Wave duration: m:ss" on the first tick on which none of its monsters is left; the duration is the ticks since S at 0.6 seconds, rounded to the nearest second | OBS, four waves |
| The next wave | starts 3 ticks after that line, so its monsters appear 8 ticks after it | OBS: the interface opens 3 ticks after the line, and the monsters appear 5 ticks after it closes. That the next wave starts as the interface would open is inferred: the waves have no such interface |
| Waves | 1 to 11, their monsters and reinforcements | WIKI and SIM agree; OBS for waves 1 to 4 |

## The monsters

| Monster | From the sources | Inferred, or not yet observed |
|---|---|---|
| Fremennik warband | Sol Heredit's definition (`../sol-heredit/minions.js`), unchanged: it stands two ticks, runs to its slot (berserker north of the player, archer west, seer east, the one whose side is blocked south); attacks 3, 4 and 5 ticks after it appeared and every 6 from then, only from its slot and not on a tick on which it moved; a hit lands one tick after the attack; max hits 29, 14 and 12; each is always hit for the most by the style that beats it. OBS found the standing, the running, the attack ticks and the hit delay as that module has them, and the archer's arrow with its constants | |
| Serpent shaman | magic, every 5 ticks, reach 10, max 28 (WIKI main page, SIM). The hit lands 3 ticks after the cast at 1, 2, 4, 5 and 8 tiles and 4 ticks after it at 9; the projectile leaves 67 cycles after the cast and flies 4 cycles a tile, 13 at the least; its heights and slope; an effect on the shaman as it casts and one on the player as the projectile arrives (OBS) | the hit delay at 3, 6, 7 and 10 tiles (taken as their neighbours') |
| Jaguar warrior | melee slash, every 5 ticks, three hits of up to 47 each with rolls of their own (WIKI, SIM); the three hitsplats on the tick of the attack; it attacks on the tick it steps beside the player (OBS) | |
| Javelin colossus | ranged, every 5 ticks, reach 15, max 48 (WIKI); the hit lands 3 ticks after the throw at 3 to 9 tiles; the javelin leaves 58 cycles after the throw and arrives at 90 at every distance; its heights and slope; every fifth attack is thrown high: an effect on the colossus, a shadow and the falling javelin on one tile 4 ticks after the throw, its blast there 6 ticks after it; a player one tile off took nothing (OBS). It ignores prayer (WIKI) | its damage (up to 40: the wiki's strategy page as the first data sheet has it; the least it deals is not known); whether the tile is the player's at the throw or 3 ticks later (he stood still in every sample) |
| Manticore | reach 15; three orbs, ranged and magic in either order and melee last; max 36 ranged, 31 magic, 31 melee; another manticore within 15 tiles and in sight takes the same order; one that is ready when another throws is held back 5 ticks (WIKI). With T the tick the first orb leaves: the charge animation at T-6, the orbs over it at T-5, T-4 and T-3, 300, 400 and 500 high; an orb leaves at T, T+1 and T+2, flies 30 cycles from its height down to 50, and its hitsplat comes a tick later; the prayer that counts is the one up when it leaves; a volley every 10 ticks, the first at S+13; the charge goes on while it walks; an orb that was not prayed against draws an impact on the player (OBS, one manticore, nine volleys) | all nine volleys were ranged, magic, melee: that the heights go with an orb's place in the order, and the impact effects of the other two styles (by their names in CACHE); what two manticores do to each other (WIKI and SIM only); that it waits with a charged volley while the player is out of sight (SIM) |
| Shockwave colossus | magic, every 5 ticks, reach 15, max 56 (WIKI); the hit lands floor((2 x steps + 4) / 7) + 2 ticks after the clap (SIM, "observed"; OBS agrees at 3 to 5 steps); the projectile (2520) leaves 50 cycles after the clap and flies 26 + 8 cycles a step, 158 to 100 high; an effect (2254) on the player as it arrives (OBS, 14 claps) | that the effect comes with a clap whose accuracy roll succeeds (10 of 14; the 4 without were prayed against) |
| Minotaur | melee crush, every 5 ticks, max 74; the hit lands a tick after the swing and "is calculated" then; while the player is not within melee distance, diagonals included, it heals to full a monster under 75 % whose centre is in sight and within 7 tiles of its own; no routefinding (WIKI). It plays its spawn animation when placed and is not held back by it (SIM) | that a heal takes the place of an attack on its attack timer; which of several wounded monsters it heals (the first in turn order). Not in the recording |

## Minimus and the modifiers

OBS, one run of four waves: Minimus (NPC 12808) stands at 32,34 before the
first wave and says "Let me know when you want to begin."; a click on him
("Start-wave") opens interface 865, in which one of three modifiers is
chosen. After a wave he appears three ticks after the line "Wave N
completed!", on the tile north of the player, and the interface opens with
him; the player cannot walk until he has chosen (WIKI). Closing the
interface without a choice and clicking him again gives "You must make a
choice before continuing!". He is gone on the tick the interface closes
after "Continue", and the wave's monsters appear five ticks later.

Here: the phases "lobby" and "intermission" of `ColosseumEncounter.js`, the
commands `talk-to-minimus` and `choose-modifier`, and the set-up toggle
"Minimus offers modifiers", which switches all of it off (the waves then
follow each other with the modifiers of the set-up).

**What is offered** (`modifiers.js`). Before wave 1: Blasphemy, Relentless,
Frailty (OBS, WIKI). After that WIKI says "picked at random with a
preference towards upgrades"; OBS, four offers: every upgrade that was open
was offered, before any modifier not yet taken. That is what is coded, and
it is inferred from four offers. Red Flag and Dynamic Duo from wave 7
(WIKI, strategy page).

**The fourteen modifiers.** Ten are Sol Heredit's, and what they do is his
module's (`../sol-heredit/`), taken over; four exist only in the waves.

| Modifier | In the waves | Source, and what is inferred |
|---|---|---|
| Blasphemy, Doom, Frailty, Myopia | the engine's rules of Sol's `SolModifierState` | Sol's module. WIKI: Doom's stacks are cleared when a wave is completed, and a javelin thrown high that hits adds two |
| Relentless | every monster's attack: part of the player's Defence bypassed, a higher max hit, at level III no accuracy roll | WIKI; applied as Sol's module applies it to his warband |
| Quartet | a fourth warbander of a random role, in the slot south of the player | WIKI. inferred: placed one tile south-east of the archer |
| Bees! | one to three swarms, Sol's actors and tiles | Sol's module. inferred: they appear with the next wave's monsters and stay |
| Solarflare | an orb circles each pillar on the ring of tiles touching it, Sol's actor; at levels I and II it hits a player on its tile on its second tick there, at level III on contact, once a contact; the hit lands a tick later; level III turns the protection prayer off | WIKI: "Pillars are orbited by an orb" that "damages the player on contact", and levels II and III deal more; the strategy page's tips: at I and II "the flare damages only on its second tick". The rings: reported from the game by players, not recorded. VIDEO (a player's Solarflare III wave, youtu.be/hOMVTeauUHg, 0:05 to 0:08): each orb appears on its ring's corner that faces the middle of the arena and goes clockwise. inferred: the second tick is the only one at a corner where an orb rests; what counts as contact at III; the damage of II and III, 15 to 25 and 20 to 30 (I: Sol's module's 10 to 20) |
| Totemic | a totem beside a monster at half its hitpoints or less, healing it by 30 %; it comes again two minutes after it was destroyed | WIKI; the timing of the heal is Sol's module's. inferred: one totem at a time |
| Volatility | a dead monster explodes on the first tick it is gone, one tile round its footprint (two at level II and III); at level III the centre tile is left under molten sand | OBS (level I, 14 deaths: the tick, the tiles, the graphics); WIKI (levels II and III). inferred: the damage, 16 to 25 (two samples: 16 and 25) |
| Mantimayhem | each orb is two hits; at level II an orb that is not prayed against inflicts venom, cured when the wave ends; at level III the three orbs come in any order | WIKI. The second projectile is not drawn |
| Reentry | a javelin thrown high leaves molten sand where it lands; at level II it is permanent and covers the tile south-west too, at level III also the tile west of that | WIKI. inferred: a tile that cannot be walked on is left out; the sand's damage, 6 to 8 a tick, is Sol's module's |
| Dynamic Duo | a second shockwave colossus beside the first | WIKI. inferred: where (east, west, north or south of the first, the first that is all floor) |
| Red Flag | the minotaur finds its way round what blocks it | WIKI. inferred: the route goes round other monsters as round a pillar |

**The interface** (`intermission.js`) is the game's interface 865, widget
by widget: the recording has seventeen dumps of it, and every rectangle,
sprite, font, colour and text is a widget's. Its sprites are the cache's
(`assets/encounters/colosseum-interface/`). What it says of a modifier is
the game's own text, from CACHE: structs 891 to 915 of config group 34
hold, for each modifier, its name, a text per level, the Glory it is worth
a wave and its place among the pictures. (The wiki's table is the wiki's
wording: of eight texts compared with the recording one matched.) Its
sounds are the recording's: 2266 on "Set", 7986 with the pointer over a
tile, 8010 as it closes after "Continue". It is drawn at the application's
UI scale. Drawn and without effect, because the waves have no loot and no
Glory: "Claim", the tabs "Loot" and "Summary", the two loot boxes.

**The overlays** (`overlays.js`, `losLinks.js`) rebuild what two RuneLite
plugins show, each part switched by a toggle under the game panel's
assists. The application's own plugins are written into its bundles one by
one, so these are the module's own elements and cannot be dragged.

- github.com/LlemonDuck/fortis-colosseum (BSD 2-Clause): the waves overlay
  (the current and the next wave), the modifiers overlay, the names on the
  selector, the splits, the LoS links to los.colosim.com, and the
  Volatility reminder, which here marks the tiles a monster died on for 5
  ticks where the plugin draws a picture. Not built: its loot and
  LiveSplit parts, the bee swarms' line.
- github.com/tylerwgrass/attack-ranges is the application's own plugin
  now, in the Plugins panel, for every encounter
  (`client/plugins/attackRanges.js`).

Behaviour and constants were taken from the two plugins as agents read
them (`.scratch/colo-plugin-notes.md`, `.scratch/colo-attack-ranges-notes.md`);
no code of either is here.

**Bundle edits**, each asked for and allowed: in `Grid.js` a listener for
the window event `colosseum-command`, two entries in the replay's schema
(`choose-modifier`, `talk-to-minimus`), and Minimus's option "Start-wave"
with its left click; in `application.js` the default loadout and a
tile-marker preset (`colosseum_waves`, the user's ground markers).

## The sounds

A monster's sounds come from two places.

- **The frames of its animations** (a throw, a clap, a step, a death): in
  the cache with the animation, each with how far it carries. The scene
  plays them without a line here; `node tools/cache-objects.mjs deps`
  lists them for the trimmed cache. For both colossi that is 5 tiles from
  the middle tile (4 for a step), counted as steps east-west plus steps
  north-south, less one: a colossus that attacks from across the arena is
  not heard doing it. OBS: the game sends the same sounds with the same
  ranges, on the frames the cache names.
- **What the server sends**: in no file, so only OBS knows them. They are
  the rules of `audio.js`, and their ids must be in a list of the trimmed
  cache's groups (`node tools/cache-objects.mjs deps --add --to colosseum
  sound:<id>`; `test/test-colosseum-audio.mjs` fails for one that is not).

| Sound (CACHE's name) | When (OBS) | Here |
|---|---|---|
| 513 `human_hit`, 8353 `varlamore_colossi_javelin_hit_01`, 600 `magmaquiris_hit` | a hit that hurts a shaman (25 of 26; none of 5 hits of 0), a javelin colossus (26 of 26; none of 6) or a manticore (10 of 10; none of 2), on the hitsplat's tick, 10 tiles from its middle tile. The jaguar has none: its sound is on a frame of the animation it plays when hit | `hit_applied` on it with damage |
| 8356 `..._javelin_artillery_attack_falling_whoosh_01` | 90 cycles after a javelin is thrown high, with no place | the throw's `zuk_attack` |
| 8352 `..._javelin_range_attack_hit_floor_01` | 180 cycles after that throw, 15 tiles from the tile it comes down on | the same |
| 8339 `varl_serpent_shaman_water_impact_01` | with 50 of 64 of the shaman's casts, the same 50 that drew the effect on the player; sent at the cast to sound as the projectile arrives (80 to 103 cycles), with no place. The 14 without were all prayed against and hit 0; the two casts not prayed against had it and hurt | the cast's `zuk_attack` when its `accurate` is true |
| 8348 `..._javelin_range_attack_hit_player_01` | with 7 of 29 javelins, sent at the throw to sound 90 cycles later, with no place; each time the hitsplat was 0 under Protect from Missiles. Three javelins not prayed against dealt 0 and had none | the throw's `zuk_attack` when its `accurate` is true |

Inferred from the last two: the game sends an attack's impact sound, and
the shaman's effect on the player, when the attack's accuracy roll
succeeds, whether or not a prayer then takes the damage. A module says so
with `accurate` in what it hands `emitInfernoNpcAttack`.

The minotaur's heal (OBS, once): the healed monster draws spot animation
444 (`tzhaar_heal`) on the tick of the heal animation. The game sends no
sound with it; the only ones are the two on the animation's frames.

The shockwave colossus (OBS, 14 claps): sound 5774
(`toa_akka_projectle_impact_01`) comes with every clap, sent with it to
sound as the projectile arrives, with no place; the other sounds are those
of its animations' frames, and a hit on it has none.

## Practice

Not the game's: tools to practise a wave.

- **Retry Wave** and **Random Spawns** (debug actions, `controls.js`)
  restart the run on the wave being fought, with the modifiers it had as
  the wave began (with Minimus, those before his offer), the player on the
  tile he stood on one tick before its monsters were placed. Retry Wave
  keeps the seed, so a player who stands still until the monsters are
  placed gets the same spawns; Random Spawns draws a new seed
  (`ColosseumEncounter.planPracticeRestart`).
- **South spawn A (near)** and **South spawn B (far)** (set-up choices)
  say what stands on the two south spawn points, 29,31 (A) and 32,27 (B):
  Random (the game's draw), Any monster, or one kind, by WIKI's
  colloquial names: Shaman (serpent shaman), Ranger (javelin colossus),
  Manti (manticore), Shocker (shockwave colossus); "Mager" is both the
  shaman's and the shocker's. Both set is a double south: a mager on A
  and a Ranger on B is "mage front, range back", a Manti on A or B with a
  Ranger or a mager the "A/B mantis" of the strategy page's A/B offtick. A kind
  the wave has no monster of, or a point near the player, is left to
  chance; the other monsters keep the game's shuffled order (`waves.js`).
  The wiki's strategy page speaks of south spawns without naming them;
  the RuneLite ground markers of the preset "Colosseum Tiles" mark them
  with their south A (30,32) and B (33,28).

## Where the sources differ

| What | One says | The other says | The code |
|---|---|---|---|
| When the warband starts to walk | SIM: on its first turn | OBS and Sol's module: two ticks after it appeared | OBS |
| The warband's first attacks | SIM: 4, 5 and 6 ticks after the placing | OBS and Sol's module: 3, 4 and 5, and not on a tick on which it moved | OBS |
| When the warband's hits land | SIM: on the tick of the attack | OBS and Sol's module: one tick later | OBS |
| A warbander on the tick it is killed | SIM: neither moves nor attacks | Sol's module: its death is queued, so it still takes that turn. OBS: its death animation starts the tick after the kill, or 3 ticks after its last step | Sol's module |
| When the shaman's hit lands | SIM: floor((1 + tiles) / 3) ticks after the cast | OBS: 3 ticks, 4 at 9 tiles | OBS |
| When the shaman's projectile leaves | SIM: 20 cycles after the cast | OBS: 67 | OBS |
| Shaman's max hit | 28: WIKI main page, the shaman's own page, SIM | 27: WIKI strategy page | 28 |
| When the reinforcements arrive | SIM: 67 ticks after the placing | OBS: 66 | OBS |
| Where the reinforcements stand | SIM: a row from x 31 eastward, its order shuffled | OBS: a jaguar alone at x 32, 32 and 33; a jaguar at 32 with a shaman at 31 | see "Inferred" |
| When a manticore's first charge begins | SIM: on its second turn | OBS: at S+3 | OBS |
| When a manticore's orb lands | OBS and SIM: one tick after it leaves | WIKI: the orbs "land with a projectile travel time of 0" | OBS |
| Turn order of reinforcements | SIM: they take their turns before the monsters placed earlier | this engine gives turns in the order NPCs were added | the engine's: reinforcements go last |
| The order of the warband's attacks | WIKI strategy page: melee, magic, ranged | Sol's module, SIM and OBS: berserker, seer, archer | |
| How long a dead monster stays | OBS and SIM: 3 ticks, the manticore 4 (SIM: the minotaur 4 too) | this engine: 10 ticks unless the encounter removes it | OBS and SIM; for a warbander counted from the tick its death animation starts |
| Which prayer counts against the minotaur | WIKI: its damage "is calculated one tick later than its attack animation" | SIM: the prayer up at the swing | WIKI |
| How far the minotaur heals | WIKI, its conditions: the centre "no more than 7 tiles away" | WIKI, the same page's introduction: "within 6 tiles" | 7, centre to centre |
| A manticore copying another | WIKI: within 15 tiles of it and in its sight | SIM: any living manticore that has an order | WIKI |

## Inferred

No source says these. Each is marked "inferred" where it stands in the code.

- Where the reinforcements stand in their row: the largest at x 32 or 33 by
  chance, a smaller one beside it on its west. That fits the four waves
  recorded and nothing more is known: the south row and a minotaur were not
  seen.
- With Minimus switched off, the next wave starts on the tick his
  interface would open; after wave 11 the victory comes on that tick.
- With Minimus, his offer after wave 11 is drawn as the others are, from
  all fourteen modifiers; the choice leads into Sol Heredit's fight with the
  run's modifiers that his fight has, and with his own loadout: the
  hitpoints and supplies left of the waves are not carried over.
- Which modifiers are offered after wave 1 (above), and everything the
  table of the modifiers marks as inferred.
- A walk order given while Minimus holds the player is walked when he lets
  go; the game may drop it.
- Between waves nothing of the modifiers hurts. WIKI's list of changes has
  it for molten sand ("no longer deals damage between waves"); that the
  swarms and the orb are the same is inferred. A javelin thrown high that
  would come down after its wave is completed is dropped.
- Frailty taken from an offer lowers the hitpoints on the tick of the
  choice, as the engine does it at a run's start.
- With nothing left to offer (every modifier open to the wave at its last
  level) Minimus goes and the wave begins.
- The minotaur of Red Flag keeps NPC type 12812; the monster table has
  12813 for the one "with routefinding", whose stats may differ.
- In the overlays: the colour of the reinforcements' lines and of the
  Volatility reminder's tiles, and that the LoS tool names a monster by its
  south-west tile.
- A manticore's orb heights and start offsets go with the orb's place in the
  order.
- The shaman's hit delay at the distances that were not recorded.
- The least a javelin thrown high deals.
- A reinforcement that arrives on the tick the wave is cleared leaves the
  world; WIKI says it is "automatically killed".
- On its first turn a monster's reach counts as 1 (SIM: as 0): this engine
  does not move an NPC whose reach is 0. The two differ only for a monster
  placed beside the player.
- The camera (looking east from the west wall).

## To be observed

What a recording would settle, in the order it matters:

1. The minotaur: its attack, its heal, where it stands in the row of
   reinforcements.
2. Two manticores: whether the second copies the first, and the 5 ticks.
3. A manticore that starts with magic (the orbs' heights).
4. A javelin thrown high that hits: its damage, and a step off the tile
   between the throw and the third tick after it.
5. Reinforcements with the player in the south half.
6. The sounds the server sends: javelins without a protection
   prayer that hurt, to settle that 8348 goes with the accuracy roll.

## What the waves do not have yet

- The rewards and Glory: the interface's "Claim", "Loot" and "Summary" are
  drawn and do nothing. The recording has the rewards interface (864)
  widget by widget.
- The modifiers in a recording: only Blasphemy and Volatility I were
  recorded. The orbs' timing at levels I and II, Quartet's place, the second colossus of
  Dynamic Duo, a totem, molten sand and its damage, Mantimayhem's second
  projectile and Bees! in the waves are to be observed.
- A panel with the wave, as the Inferno has. ("Retry Wave" and "Random
  Spawns" are debug actions; see "Practice".)
- What a dead monster leaves when the modifier Volatility is on (the NPCs
  the cache calls `colosseum_human_gib`, `..._manticore_gib` and
  `..._colossi_gib`).

Each of the first three is a table or a component in a bundle
(`application.js`, `Grid.js`), keyed by kind.
