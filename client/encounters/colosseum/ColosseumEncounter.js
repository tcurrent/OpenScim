// The waves of the Fortis Colosseum: the encounter class and its definition.
//
// A run starts on the wave chosen in the set-up (controls.js), with the
// modifiers chosen there. Before each wave Minimus offers three more
// modifiers to choose one from (modifiers.js): before the first wave when the
// player clicks him, after a wave by himself. Five ticks after the choice the
// wave's monsters are placed (waves.js says which and where): the Fremennik
// warband, which is Sol Heredit's (../sol-heredit/minions.js), and the wave's
// own monsters, one module each. 66 ticks after that the reinforcements
// arrive, unless the wave is cleared by then. A wave is cleared when every
// monster placed for it has been defeated, and completed on the first tick
// on which none of them is left in the world. Three ticks after that Minimus
// comes; after wave 11 too, and the choice made there leads into Sol
// Heredit's fight (startWave). With the choice of modifiers switched off in
// the set-up there is no Minimus: the first wave starts with the run and the
// next one three ticks after a wave is completed; after wave 11 the run is
// won.
//
// The order of the hooks within one tick (docs/ARCHITECTURE.md, "One tick"):
//   0. executeCommand    a click on Minimus; the player's choice of a
//                        modifier
//   1. resolveHazards    a javelin that a colossus threw high comes down; a
//                        dead monster explodes; molten sand burns
//   2. for each NPC, in the order they were added to the world: it walks
//      (the engine asks its definition), then processNpcTick hands its turn
//      to its definition, with the wave's random generator
//   3. completeNpcBand   the modifiers' swarms, orb and totem
//      (the hits on the player land; the player moves, unless Minimus holds
//      him: moveDisplacedPlayer; the player attacks)
//   4. processPostTick   a dead monster is removed when its death has played
//                        out; Minimus comes; the wave's monsters are placed
//                        when its countdown is over; the reinforcements
//                        arrive; a cleared wave is completed; a won run
//                        becomes a victory
//   5. onNpcDefeated     once for each monster that died this tick; with the
//                        last one the wave is cleared
import { isArenaFootprintWalkable } from "../shared/npcMovement.js";
import { defineNpc, NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import { solMessageColors } from "../sol-heredit/constants.js";
import { warbanderSlotOffsets, warbanderNpcDefinition } from "../sol-heredit/minions.js";
import { createWarbanderActor } from "../sol-heredit/modifierEffects.js";
import { solHereditModifiers, SolModifierState } from "../sol-heredit/modifiers.js";
import {
  colosseumKind,
  colosseumMapSquare,
  colosseumPlayerStart,
  lastWave,
  waveStartDelayTicks,
  reinforcementDelayTicks,
  intermissionDelayTicks,
  secondsPerTick,
  warbandDeathTicks,
  colosseumMonsters,
  minimus,
  venomFromPoisonVarp,
} from "./constants.js";
import {
  colosseumStartWaveKey,
  colosseumModifierChoiceKey,
  colosseumSouthKeys,
  getSouthSpawnSetting,
  retryWaveCommandType,
  rerollWaveCommandType,
  getColosseumStartWave,
  buildColosseumControls,
} from "./controls.js";
import { colosseumModifiers, readModifierSelection, getInterfaceModifier, buildModifierOffer } from "./modifiers.js";
import { WaveModifierEffects } from "./modifierEffects.js";
import { buildWaveSpawns, buildReinforcementSpawns, getWaveReinforcementKinds, createWaveCombatRandom, createWaveOfferShuffle, warbandTurnOrder } from "./waves.js";
import { createWaveMonsterActor } from "./waveMonster.js";
import { registerWithInfernoVisuals } from "./visuals.js";
import { chooseModifierCommandType, talkToMinimusCommandType } from "./intermission.js";
import { buildLosLink } from "./losLinks.js";
import { shamanNpcDefinition } from "./shaman.js";
import { jaguarNpcDefinition } from "./jaguar.js";
import { javelinNpcDefinition, createJavelinState, landHighJavelins, highJavelinSource } from "./javelin.js";
import { manticoreNpcDefinition, createManticoreState } from "./manticore.js";
import { shockwaveNpcDefinition } from "./shockwave.js";
import { minotaurNpcDefinition } from "./minotaur.js";
import { emitInfernoVisual } from "../inferno/events.js";

const monsterDefinitions = {
  shaman: shamanNpcDefinition,
  jaguar: jaguarNpcDefinition,
  javelin: javelinNpcDefinition,
  manticore: manticoreNpcDefinition,
  shockwave: shockwaveNpcDefinition,
  minotaur: minotaurNpcDefinition,
};
// The state a monster's definition keeps on its actor, where it keeps one.
const createMonsterState = { javelin: createJavelinState, manticore: createManticoreState };
// The set-up offers a wave when its monsters are in colosseumMonsters
// (controls.js); each of those must have its definition here.
for (const kind of Object.keys(colosseumMonsters)) {
  if (!monsterDefinitions[kind]) {
    throw new TypeError(`Colosseum monster '${kind}' has no NPC definition`);
  }
}

// The RuneLite plugin Fortis Colosseum reminds of Volatility for 5 ticks after a monster died.
const deathReminderTicks = 5;
// Minimus stands where he is put and does nothing by himself.
const minimusNpcDefinition = defineNpc({ id: "colosseum-minimus", move: false });
function createMinimusActor(position, spawnTick) {
  return minimusNpcDefinition.createActor(
    {
      id: minimus.actorId,
      kind: "npc",
      role: "npc",
      npcTypeId: minimus.npcTypeId,
      // The interface names an NPC by this.
      archetypeId: "minimus",
      size: 1,
      alive: true,
      position: [...position],
      previousPosition: [...position],
      facing: 0,
      spawnTick,
      // The monsters walk through him and he through them.
      blocksNpcMovement: false,
      passThruNpcs: true,
      history: new Map(),
      vitals: { hp: 1, maxHp: 1 },
      combat: { attackSpeed: 0, attackRange: 0, attackStyle: "melee", nextActionTick: Number.MAX_SAFE_INTEGER, targetId: null, lastAttackTick: null, animations: { idle: null, walk: null, run: null, attack: null, death: null } },
    },
    {},
  );
}

// An actor for what waves.js calls `kind`, placed on `spawnTick`. `slot` is
// "quartet" for the fourth warbander of that modifier; `relentless` the level
// of that modifier.
function createWaveActor(kind, { id, position, spawnTick, slot, relentless }) {
  if (!warbandTurnOrder.includes(kind)) {
    return monsterDefinitions[kind].createActor(createWaveMonsterActor(kind, { id, position, spawnTick }), createMonsterState[kind]?.() ?? {});
  }
  return createWarbanderActor({
    id,
    role: kind,
    position,
    // OBS: the warband of a wave does what Sol's definition has his
    // warbander do. It stands for two ticks after it appears and then runs
    // to the player's sides; its attacks come 3 (berserker), 4 (seer) and 5
    // (archer) ticks after it appeared and every 6 from then, only from its
    // slot and not on a tick on which it moved; a hit lands one tick after
    // the attack. (SIM has it walk at once, attack a tick later and hit on
    // the tick of the attack.)
    spawnTick,
    slotOffset: warbanderSlotOffsets[slot ?? kind],
    // Sol's module: his fourth warbander has no other slot to fall back on.
    ...(slot === "quartet" ? { fallbackOffsets: [] } : {}),
    relentless,
  });
}

export class ColosseumEncounter {
  kind = colosseumKind;
  // The mechanics that stay as they were once a run has started.
  runStartMechanicsKeys = [colosseumStartWaveKey, colosseumModifierChoiceKey, colosseumSouthKeys.a, colosseumSouthKeys.b];

  // `setupModifiers` is { id: level } of the modifiers chosen in the set-up.
  constructor(setupModifiers = {}) {
    this.setupModifiers = readModifierSelection(setupModifiers);
    this.modifiers = { ...this.setupModifiers };
    this.effects = new WaveModifierEffects(() => this.modifiers);
    // The engine asks for the rules once a run and keeps what it is handed,
    // and a choice from Minimus's offer changes them in the middle of one.
    // So it is handed one object for good, each rule of which asks the rules
    // of the moment: `this.rules`, which setModifiers makes anew.
    const encounter = this;
    this.engineRules = {
      get playerMaxHpReduction() {
        return encounter.rules.playerMaxHpReduction;
      },
      get itemRestrictions() {
        return encounter.rules.itemRestrictions;
      },
      modifyPlayerCombatParams: (combatParams, rulesContext) => this.rules.modifyPlayerCombatParams?.(combatParams, rulesContext) ?? combatParams,
      onTickStart: (...hookArguments) => this.rules.onTickStart?.(...hookArguments),
      onPlayerDamageTaken: (hit, rulesContext) => {
        // WIKI (Javelin Colossus): with Doom a javelin thrown high that hits
        // adds two stacks. The state counts one for every hit.
        if (this.modifiers.doom && hit.sourceKind === "environment" && hit.source === highJavelinSource && hit.effectiveDamage > 0) {
          this.modifierState.doomStacks++;
        }
        return this.rules.onPlayerDamageTaken?.(hit, rulesContext);
      },
    };
    // What every monster's definition is handed as `config`.
    const monsterConfig = {
      modifiers: () => this.modifiers,
      // A javelin colossus hands over a javelin it threw high: { tile, landTick }.
      throwHigh: (javelin) => this.highJavelins.push(javelin),
    };
    this.definitions = new NpcDefinitionRegistry([
      registerWithInfernoVisuals(warbanderNpcDefinition.register(undefined)),
      ...Object.values(monsterDefinitions).map((definition) => definition.register(monsterConfig)),
      minimusNpcDefinition.register(undefined),
      ...this.effects.registrations(),
    ]);
    this.reset();
  }

  // --- what the engine always calls ---------------------------------------
  // A new run. `seeds` is what getSeeds returned, when a run is repeated;
  // a practice restart (planPracticeRestart) adds the modifiers the run had
  // by then.
  reset(seeds) {
    // A seed is 32 bits: one of 4294967296.
    this.encounterSeed = seeds?.encounterSeed ?? Math.floor(Math.random() * 4294967296);
    this.startModifiers = seeds?.modifiers ? readModifierSelection(seeds.modifiers) : null;
    this.outcome = { phase: "active" };
    this.nextActorId = 0;
    // The monsters in the world, alive or dying: actor id to its kind.
    this.monsters = new Map();
    // Every monster placed in this run, by actor id.
    this.placedIds = [];
    // The kill that cleared the last wave so far: { npcId, tick, encounterOwned }.
    this.lastDefeat = null;
    // A new run has no stacks of Doom: setModifiers would carry them over.
    this.modifierState = null;
    this.setModifiers({ ...(this.startModifiers ?? this.setupModifiers) });
    this.effects.reset();
    // What Minimus offers, while he does: { requestId, wave, options }; and
    // how often an offer was opened or asked for again in this run.
    this.offer = null;
    this.offerRequests = 0;
    // For the overlays (overlays.js): the waves completed in this run, each
    // { wave, ticks }; where the wave's monsters died in the last ticks, each
    // { position, size, tick }; and the links to the LoS tool.
    this.splits = [];
    this.deaths = [];
    this.losLinks = { spawns: null, reinforcements: null, current: null };
    // The tiles the orbs of Solarflare stand on at the end of the last tick.
    this.orbTiles = [];
    this.configureRunStart({});
  }
  getSeeds() {
    return { encounterSeed: this.encounterSeed, ...(this.startModifiers ? { modifiers: { ...this.startModifiers } } : {}) };
  }
  getDefaultMechanicsConfig() {
    return buildColosseumControls().defaultMechanicsConfig;
  }
  getDefaultPlayerStart() {
    return [...colosseumPlayerStart];
  }
  getIntroConfig() {
    return null;
  }
  // Used until the application has built the arena from the map square (the
  // descriptor's `collision`).
  getArenaConfig() {
    return { bounds: null, collisionMap: null, walkableTiles: null };
  }
  // The monsters are placed by processPostTick, when the countdown is over.
  createNpcs() {
    return [];
  }
  resolveHazards(context, mechanics) {
    // Doom does not kill a player with infinite health: the state asks the mechanics.
    this.modifierState.configureRunStart(mechanics);
    const { inTheAir, landedTiles, damages } = landHighJavelins(this.highJavelins, context);
    this.highJavelins = inTheAir;
    for (const tile of landedTiles) {
      this.effects.onHighJavelinLanded(tile);
    }
    return [...damages, ...this.effects.resolveHazards(context, this.isWaveOn())];
  }
  processPostTick(context) {
    this.removeDeadMonsters(context);
    this.deaths = this.deaths.filter((death) => context.tick < death.tick + deathReminderTicks);
    if (this.outcome.phase === "resolving") {
      if (context.tick >= this.outcome.completionTick && context.world.getPlayer()?.alive) {
        this.outcome = { ...this.outcome, phase: "victory" };
      }
    } else if (this.phase === "lobby" || this.phase === "intermission") {
      if (context.tick >= this.minimusTick && !context.world.getNpc(minimus.actorId)) {
        this.placeMinimus(context);
      }
    } else if (this.phase === "countdown") {
      // SIM: the spawn points are chosen by where the player stood one tick
      // before the monsters are placed.
      if (context.tick === this.placeTick - 1) {
        this.playerTileBeforePlacing = [...context.playerPos];
      }
      if (context.tick >= this.placeTick) {
        this.placeWave(context);
      }
    } else if (this.phase === "active" && this.reinforcementTick !== null && context.tick >= this.reinforcementTick) {
      this.placeReinforcements(context);
    } else if (this.phase === "cleared") {
      // OBS: a wave is completed on the first tick on which none of its
      // monsters is left: the tick after the last of them was removed.
      if (this.completeTick === null) {
        if (this.monsters.size === 0) {
          this.completeTick = context.tick + 1;
        }
      } else if (context.tick >= this.completeTick) {
        this.completeWave(context);
      }
    }
    this.losLinks.current = this.phase === "active" || this.phase === "cleared" ? this.buildLosLink(context, () => true) : null;
    this.orbTiles = this.effects.getOrbTiles(context.world);
    return [];
  }
  getOutcome() {
    return this.outcome;
  }
  // The replay's auto markers (client/replay/markers.js): the tick the wave's monsters are placed on, and that of the reinforcements.
  getAutoMarkers() {
    if (this.phase !== "active") {
      return [];
    }
    const names = [`wave ${this.wave}`, ...(this.reinforcementsPlacedTick === null ? [] : [`wave ${this.wave} reinforcements`])];
    return names.map((name) => ({ id: name, label: name }));
  }
  getSnapshot() {
    return {
      kind: colosseumKind,
      state: {
        wave: this.wave,
        phase: this.phase,
        placeTick: this.placeTick,
        reinforcementTick: this.reinforcementTick,
        modifiers: { ...this.modifiers },
        doomStacks: this.modifierState.doomStacks,
        // For the dialog of intermission.js.
        offer: this.offer && {
          requestId: this.offer.requestId,
          wave: this.offer.wave,
          // OBS: the interface's title before the first wave of a run, and after a wave.
          title: this.phase === "lobby" ? "Fortis Colosseum" : `Wave ${this.offer.wave - 1} Completed!`,
          options: this.offer.options.map(({ id, level, ...shown }) => shown),
          // The modifiers of the run so far, in the order they were taken.
          active: Object.entries(this.modifiers).map(([id, level]) => {
            const { label, text, glory, spriteId } = getInterfaceModifier(id, level);
            return { label, text, glory, spriteId };
          }),
        },
        // The tiles under molten sand, for the scene.
        sand: this.effects.getSandTiles(),
        // For the overlays.
        splits: this.splits.map((split) => ({ ...split })),
        deaths: this.deaths.map(({ position, size }) => ({ position: [...position], size })),
        losLinks: { ...this.losLinks },
        orbTiles: this.orbTiles.map((tile) => [...tile]),
      },
      visuals: {},
    };
  }
  // An actor's id holds its kind ("colosseum_shaman_3"), so that a hit that
  // lands after its monster has left the world still has its name.
  getNpcDamageSourceLabel(npcId) {
    return this.effects.getLabel(npcId) ?? colosseumMonsters[npcId.split("_")[1]]?.name ?? (npcId === minimus.actorId ? minimus.name : "Fremennik warband");
  }

  // --- what the engine calls if it is there ---------------------------------
  getNpcDefinitions() {
    return this.definitions;
  }
  // The rules of the engine that the modifiers change: Frailty, Myopia, Doom
  // and Blasphemy, as Sol Heredit's fight has them.
  getEngineRules() {
    return this.engineRules;
  }
  // At tick 0, whenever the mechanics change.
  configureRunStart(mechanics) {
    const startWave = getColosseumStartWave(mechanics);
    // Whether Minimus offers a modifier before each wave.
    this.choosing = mechanics[colosseumModifierChoiceKey] !== false;
    // The practice switches of waves.js: what stands on the south spawns.
    this.practiceSouth = { a: getSouthSpawnSetting(mechanics, "a"), b: getSouthSpawnSetting(mechanics, "b") };
    if (!this.choosing) {
      this.beginWave(startWave, 0);
    } else {
      this.awaitChoice(startWave, "lobby", 1);
    }
  }
  processNpcTick(npc, context) {
    return this.definitions.tick(npc, { ...context, random: this.random });
  }
  // When every NPC has moved and taken its turn.
  completeNpcBand(context) {
    // inferred: between waves the swarms and the orb hurt nobody, as molten
    // sand does not (modifierEffects.js).
    if (!this.isWaveOn()) {
      return [];
    }
    const monsters = [...this.monsters.keys()].map((npcId) => context.world.getNpc(npcId)).filter(Boolean);
    return this.effects.completeNpcBand({ ...context, random: this.random }, monsters);
  }
  // WIKI: after a wave "the player will not be able to move when Minimus
  // appears until they make a selection". Returning false tells the engine
  // that the encounter has moved the player, by no step at all; his prayers
  // and his inventory stay his. The engine then leaves what his last step
  // set on him: it is taken off here, or he would go on running on the spot
  // and lose run energy for it.
  moveDisplacedPlayer(player) {
    if (this.phase !== "intermission" || this.offer === null) {
      return undefined;
    }
    player.previousPosition = [...player.position];
    player.movementPath = [];
    player.isMoving = false;
    player.isRunning = false;
    return false;
  }
  // The practice commands of controls.js restart the run on the wave being
  // fought, with the modifiers it had as the wave began, the player on the tile he
  // stood on one tick before its monsters were placed (where he stands, if
  // they are not placed yet). "Retry Wave" keeps the seed, and so the spawns
  // of a player who stands still until they are placed; "Random Spawns"
  // draws a new one. The engine restarts with what is returned here.
  planPracticeRestart(command) {
    if (command.type !== retryWaveCommandType && command.type !== rerollWaveCommandType) {
      return null;
    }
    return {
      encounterSeeds: {
        encounterSeed: command.type === retryWaveCommandType ? this.encounterSeed : Math.floor(Math.random() * 4294967296),
        modifiers: { ...this.modifiersAtWaveStart },
      },
      runMechanics: { [colosseumStartWaveKey]: String(Math.min(this.wave, lastWave)) },
      ...(this.playerTileBeforePlacing ? { startPosition: [...this.playerTileBeforePlacing] } : {}),
    };
  }
  // Whether a wave is being fought: its monsters are placed and it is not completed yet.
  isWaveOn() {
    return this.phase === "active" || this.phase === "cleared";
  }
  // The two commands of the waves, each from the interface or from a script:
  //   { encounter: "colosseum", type: "talk-to-minimus" }
  //       a click on Minimus (his option is "Start-wave")
  //   { encounter: "colosseum", type: "choose-modifier", choice: 0 | 1 | 2 }
  //       the choice of what he offers, from the dialog (intermission.js)
  // Returns the tick events to emit when the command was run.
  executeCommand(command, context) {
    if (command.type === talkToMinimusCommandType) {
      return this.talkToMinimus(context);
    }
    // The choice is 0, 1 or 2: anything else would name a property of the list.
    const option = command.type === chooseModifierCommandType && Number.isInteger(command.choice) ? this.offer?.options[command.choice] : undefined;
    if (!option) {
      return null;
    }
    const reductionBefore = this.rules.playerMaxHpReduction ?? 0;
    this.setModifiers({ ...this.modifiers, [option.id]: option.level });
    this.lowerMaxHp(context.world.getPlayer(), reductionBefore, this.rules.playerMaxHpReduction ?? 0);
    this.offer = null;
    // OBS: Minimus is gone on the tick the interface closes, and the monsters
    // appear 5 ticks after it.
    context.despawnNpc(minimus.actorId);
    this.startWave(context);
    return { gameEvents: [] };
  }
  // Frailty. The engine lowers the player's hitpoints by the rules' fraction
  // when a run starts; when a choice changes that fraction it is done here,
  // the engine's way, from the hitpoints he has without the modifier.
  lowerMaxHp(player, reductionBefore, reduction) {
    if (!player || reduction === reductionBefore) {
      return;
    }
    const lowered = (maxHp, fraction) => Math.max(1, maxHp - Math.floor(maxHp * fraction));
    let unreduced = player.vitals.maxHp;
    while (lowered(unreduced, reductionBefore) < player.vitals.maxHp) {
      unreduced++;
    }
    player.vitals.maxHp = lowered(unreduced, reduction);
    player.vitals.hp = Math.min(player.vitals.hp, player.vitals.maxHp);
  }
  onNpcDefeated(defeat, context, completionOwnership) {
    this.effects.onNpcDefeated(defeat, context.world);
    const dead = this.monsters.has(defeat.npcId) ? context.world.getNpc(defeat.npcId) : undefined;
    if (dead) {
      this.deaths.push({ position: [...dead.position], size: dead.size, tick: defeat.tick });
    }
    if (!this.undefeated.delete(defeat.npcId) || this.phase !== "active") {
      return;
    }
    // WIKI: reinforcements that arrive on the tick the wave is cleared are
    // killed at once. Here they leave the world.
    if (this.reinforcementsPlacedTick === defeat.tick && [...this.undefeated].every((npcId) => this.reinforcementIds.includes(npcId))) {
      for (const npcId of this.undefeated) {
        context.despawnNpc(npcId);
        this.monsters.delete(npcId);
      }
      this.undefeated.clear();
    }
    if (this.undefeated.size > 0) {
      return;
    }
    this.phase = "cleared";
    this.reinforcementTick = null;
    this.lastDefeat = { npcId: defeat.npcId, tick: defeat.tick, encounterOwned: completionOwnership === "encounter-owned" };
  }

  // --- its own ----------------------------------------------------------------
  // The modifiers of the run change: at its start, and with every choice.
  setModifiers(modifiers) {
    const doomStacks = this.modifierState?.doomStacks ?? 0;
    this.modifiers = modifiers;
    // Sol Heredit's state of Frailty, Myopia, Doom and Blasphemy keeps the
    // selection it was made with.
    this.modifierState = new SolModifierState(modifiers);
    this.modifierState.doomStacks = doomStacks;
    this.rules = this.modifierState.getEngineRules();
  }
  // The run waits for the player to choose a modifier for `wave`: in the
  // "lobby" before the first wave, in an "intermission" after a wave. Minimus
  // comes on `minimusTick`.
  awaitChoice(wave, phase, minimusTick) {
    this.wave = wave;
    this.phase = phase;
    // Before Sol Heredit a practice restart is still one of the last wave.
    if (wave <= lastWave) {
      this.modifiersAtWaveStart = { ...this.modifiers };
    }
    this.playerTileBeforePlacing = null;
    this.minimusTick = minimusTick;
    this.placeTick = null;
    this.reinforcementTick = null;
    this.undefeated = new Set();
    this.highJavelins = [];
  }
  // OBS: before the first wave Minimus stands at 32,34 and says "Let me know
  // when you want to begin."; the interface opens when he is clicked. After a
  // wave he appears on the tile north of the player, four times out of
  // four, and the interface opens with him.
  placeMinimus(context) {
    const [x, y] = context.playerPos;
    // inferred: with no floor north of the player, the first neighbouring tile that has some.
    const tile =
      this.phase === "lobby"
        ? minimus.startTile
        : ([[x, y + 1], [x + 1, y], [x, y - 1], [x - 1, y]].find((candidate) => isArenaFootprintWalkable(candidate, 1)) ?? [x, y]);
    context.spawnNpc(createMinimusActor(tile, context.tick));
    emitInfernoVisual(context.tickEvents, { animations: [{ actorId: minimus.actorId, clipId: "spawn", delayCycles: 0 }], projectiles: [], graphics: [] });
    if (this.phase === "lobby") {
      this.minimusSays(context, minimus.greeting);
    } else {
      this.openOffer(context);
    }
  }
  minimusSays(context, text) {
    // The text stays over him for 5 ticks, as Sol Heredit's does.
    context.tickEvents.emit({ type: "overhead_text", anchor: { kind: "actor", actorId: minimus.actorId }, overheadText: text, overheadCycle: 5 });
    context.tickEvents.emit({ type: "game_message", kind: "public", speaker: minimus.name, segments: [{ text }] });
  }
  // A click on Minimus (OBS: his option is "Start-wave") opens his offer, at
  // any distance. With the choice still open it shows the offer again, under
  // the line the game then prints.
  talkToMinimus(context) {
    if (!context.world.getNpc(minimus.actorId)) {
      return null;
    }
    if (!this.offer) {
      this.openOffer(context);
      return { gameEvents: [] };
    }
    this.offer = { ...this.offer, requestId: ++this.offerRequests };
    return { gameEvents: [{ type: "game_message", kind: "game", segments: [{ text: "You must make a choice before continuing!" }] }] };
  }
  // `context` is a hook's. With nothing left to offer (every modifier that
  // is open to the wave at its last level) Minimus goes and the wave begins.
  openOffer(context) {
    const options = buildModifierOffer(this.modifiers, this.wave, createWaveOfferShuffle(this.encounterSeed, this.wave));
    if (options.length === 0 && context) {
      context.despawnNpc(minimus.actorId);
      this.startWave(context);
      return;
    }
    this.offer = { requestId: ++this.offerRequests, wave: this.wave, options };
  }
  // The choice is made: the wave begins, or after the last wave the run goes
  // on as Sol Heredit's fight (WIKI: wave 12), an encounter of its own. The
  // application enters the fight an outcome names as `next`, with the
  // modifiers of the run that his fight has.
  startWave(context) {
    if (this.wave <= lastWave) {
      this.beginWave(this.wave, context.tick);
      return;
    }
    this.phase = "completed";
    const modifiers = Object.fromEntries(Object.entries(this.modifiers).filter(([id]) => solHereditModifiers.some((modifier) => modifier.id === id)));
    this.outcome = { phase: "active", next: { encounterKind: "sol_heredit", modifiers } };
  }
  // A wave begins on `startTick`; its monsters are placed five ticks later.
  beginWave(wave, startTick) {
    this.wave = wave;
    this.phase = "countdown";
    // What a practice restart of this wave starts with: with Minimus, what
    // the run had before his offer (awaitChoice), so that he offers it again.
    if (!this.choosing) {
      this.modifiersAtWaveStart = { ...this.modifiers };
    }
    this.placeTick = startTick + waveStartDelayTicks;
    // The tick the wave is completed on, once none of its monsters is left.
    this.completeTick = null;
    this.playerTileBeforePlacing = null;
    this.reinforcementTick = null;
    this.reinforcementsPlacedTick = null;
    this.reinforcementIds = [];
    // The monsters of this wave that are yet to be defeated, by actor id.
    this.undefeated = new Set();
    // The javelins a colossus has thrown high that have not come down: { tile, landTick }.
    this.highJavelins = [];
    this.random = createWaveCombatRandom(this.encounterSeed, wave);
  }
  placeMonster({ kind, position, slot }, context) {
    const id = `colosseum_${kind}_${this.nextActorId++}`;
    context.spawnNpc(createWaveActor(kind, { id, position, spawnTick: context.tick, slot, relentless: this.modifiers.relentless ?? 0 }));
    this.monsters.set(id, kind);
    this.undefeated.add(id);
    this.placedIds.push(id);
    // OBS: the warband, the shaman, the jaguar and the manticore play a spawn
    // animation as they appear (the javelin colossus none). SIM: so does the
    // minotaur, and it is not held back by it.
    if (warbandTurnOrder.includes(kind) || colosseumMonsters[kind].clips.spawn !== undefined) {
      emitInfernoVisual(context.tickEvents, { animations: [{ actorId: id, clipId: "spawn", delayCycles: 0 }], projectiles: [], graphics: [] });
    }
    return id;
  }
  placeWave(context) {
    // OBS: the line, and that it is red.
    context.tickEvents.emit({ type: "game_message", kind: "game", segments: [{ text: `Wave: ${this.wave}`, color: solMessageColors.red }] });
    const spawns = buildWaveSpawns(this.encounterSeed, this.wave, this.playerTileBeforePlacing ?? context.playerPos, this.modifiers, { south: this.practiceSouth });
    for (const spawn of spawns) {
      this.placeMonster(spawn, context);
      if (spawn.kind === "shockwave" && this.modifiers.dynamicduo) {
        this.placeSecondShockwave(spawn, spawns, context);
      }
    }
    this.effects.placeForWave(context, this.random);
    this.phase = "active";
    this.losLinks = { spawns: this.buildLosLink(context, () => true, true), reinforcements: null, current: null };
    this.reinforcementTick = getWaveReinforcementKinds(this.wave).length > 0 ? context.tick + reinforcementDelayTicks : null;
  }
  // WIKI, the modifier Dynamic Duo: "Shockwave Colossi will now spawn in
  // pairs. The paired Colossus spawns near the main Colossus, but not
  // necessarily on one of the 12 default spawns." inferred: on the first of
  // the four places beside the first, east, west, north, south, that is all
  // floor and holds no other monster of the wave; with none, the pair is not
  // placed.
  placeSecondShockwave(first, spawns, context) {
    const size = colosseumMonsters.shockwave.size;
    const [x, y] = first.position;
    const isFree = ([left, bottom]) =>
      spawns.every((spawn) => {
        const otherSize = colosseumMonsters[spawn.kind]?.size ?? 1;
        const [otherLeft, otherBottom] = spawn.position;
        return left + size <= otherLeft || otherLeft + otherSize <= left || bottom + size <= otherBottom || otherBottom + otherSize <= bottom;
      });
    const position = [[x + size, y], [x - size, y], [x, y + size], [x, y - size]].find((candidate) => isArenaFootprintWalkable(candidate, size) && isFree(candidate));
    if (position) {
      this.placeMonster({ kind: "shockwave", position }, context);
    }
  }
  placeReinforcements(context) {
    this.reinforcementIds = buildReinforcementSpawns(this.encounterSeed, this.wave, context.playerPos).map((spawn) => this.placeMonster(spawn, context));
    this.reinforcementsPlacedTick = context.tick;
    this.reinforcementTick = null;
    this.losLinks.reinforcements = this.buildLosLink(context, (npcId) => this.reinforcementIds.includes(npcId));
  }
  // The link to the LoS tool for the living monsters of the wave that `isWanted(npcId)` picks.
  buildLosLink(context, isWanted, isWaveStart = false) {
    const monsters = [...this.monsters]
      .filter(([npcId]) => isWanted(npcId))
      .map(([npcId, kind]) => [context.world.getNpc(npcId), kind, npcId])
      .filter(([npc]) => npc?.alive)
      .map(([npc, kind, npcId]) => ({ kind, position: npc.position, isReinforcement: this.reinforcementIds.includes(npcId), orbOrder: npc.state?.orbOrder ?? null }));
    return buildLosLink(monsters, context.playerPos, { isWaveStart, mantimayhem: this.modifiers.mantimayhem ?? 0 });
  }
  // The wave's last monster has left the world: the line that says so, then
  // Minimus, the next wave, or after the last one his offer before Sol
  // Heredit (without Minimus, the victory).
  completeWave(context) {
    // OBS: the duration counts from the tick of "Wave: N", and it is red.
    const seconds = Math.round((context.tick - this.placeTick) * secondsPerTick);
    this.splits.push({ wave: this.wave, ticks: context.tick - this.placeTick });
    context.tickEvents.emit({
      type: "game_message",
      kind: "game",
      segments: [{ text: `Wave ${this.wave} completed! Wave duration: ` }, { text: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`, color: solMessageColors.red }],
    });
    // WIKI: the stacks of Doom are cleared when a wave is completed, the
    // venom of Mantimayhem is cured, and molten sand that is not permanent
    // goes. The totem goes with its wave (modifierEffects.js).
    this.modifierState.reset();
    this.effects.endWave(context);
    const player = context.world.getPlayer();
    if (this.modifiers.mantimayhem >= 2 && player?.poisonState?.poisonVarp >= venomFromPoisonVarp) {
      player.poisonState = { ...player.poisonState, poisonVarp: 0 };
    }
    const interfaceTick = context.tick + intermissionDelayTicks;
    if (this.wave < lastWave) {
      if (this.choosing) {
        this.awaitChoice(this.wave + 1, "intermission", interfaceTick);
      } else {
        this.beginWave(this.wave + 1, interfaceTick);
      }
      return;
    }
    // WIKI: Minimus offers a modifier before Sol Heredit too. The tutorial
    // may own the completion of a run; then there is no offer.
    if (this.choosing && this.lastDefeat.encounterOwned) {
      this.awaitChoice(this.wave + 1, "intermission", interfaceTick);
      return;
    }
    this.phase = "completed";
    // The tutorial may own the completion of a run; then the outcome is left alone.
    if (this.lastDefeat.encounterOwned) {
      this.outcome = {
        phase: "resolving",
        decisiveTick: this.lastDefeat.tick,
        completionTick: interfaceTick,
        primaryActorId: this.lastDefeat.npcId,
        // The victory screen counts the damage dealt to these.
        completionActorIds: [...this.placedIds],
      };
    }
  }
  // A dead monster is gone at the end of the last tick its death takes
  // (OBS, SIM), counted from the tick its death animation starts: the tick of
  // the kill, or for a warbander, whose death is queued, the tick after it or
  // the third after its last step. Until then it is in the world, and a
  // monster that blocks the others when alive does so dead. (The engine
  // would keep it for 10 ticks.)
  removeDeadMonsters(context) {
    for (const [npcId, kind] of this.monsters) {
      const npc = context.world.getNpc(npcId);
      if (!npc) {
        this.monsters.delete(npcId);
      } else if (npc.death !== undefined && context.tick >= (npc.deathAnimationTick ?? npc.death.killTick) + (colosseumMonsters[kind]?.deathTicks ?? warbandDeathTicks)) {
        this.effects.onMonsterRemoved(npc, kind, context.tick);
        context.despawnNpc(npcId);
        this.monsters.delete(npcId);
      }
    }
  }
}

export const colosseumDefinition = {
  kind: colosseumKind,
  // `options.modifiers` is the set-up's choice of modifiers, { id: level }.
  factory: (options) => new ColosseumEncounter(options?.modifiers),
  descriptor: {
    kind: colosseumKind,
    displayName: "Fortis Colosseum",
    description: "The waves of the Fortis Colosseum that lead up to Sol Heredit. Start from any wave.",
    // The texts of the page for search engines (client/seo/routes.js).
    seo: {
      title: "OSRS Fortis Colosseum Simulator",
      description: "Practice the waves of the Fortis Colosseum in your browser. Start from any wave and fight your way up to Sol Heredit.",
      h1: "Fortis Colosseum Simulator",
      intro: "The Fortis Colosseum is a wave-based challenge in OSRS that ends with Sol Heredit. This sim covers the waves that lead up to him: start from any wave, with the modifiers you choose, and retry it as often as you need.",
      keywords: ["Fortis Colosseum", "OSRS Colosseum simulator", "Fortis Colosseum simulator", "Colosseum waves", "Colosseum practice"],
    },
    mapSquare: colosseumMapSquare,
    playerStart: [...colosseumPlayerStart],
    loadsMapLocs: true,
    // The modifiers the set-up offers to start a run with.
    modifiers: colosseumModifiers,
    // The arena is every tile that can be walked to from the start tile.
    collision: { mode: "auto", seed: [...colosseumPlayerStart] },
    victory: { eyebrow: "Triumphant", title: "VICTORY", narrative: "THE WAVES ARE CLEARED", accent: "gold" },
  },
  controls: buildColosseumControls(),
};
