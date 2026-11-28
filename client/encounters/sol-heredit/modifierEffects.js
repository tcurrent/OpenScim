import { getMonsterHitpoints, getMonsterFormulaStats } from "../../engine/monsterStats.js";
import { getTicksFromCycles } from "../../engine/projectiles.js";
import { isArenaFootprintWalkable } from "../shared/npcMovement.js";
import { defineNpc } from "../shared/npcDefinitions.js";
import { buildActorVisualTarget, getProjectileSourcePosition, healNpc } from "../shared/npcHelpers.js";
import { quartetSpawnTiles, solarflareRouteCorners, colosseumSpotAnimIds, totemProjectileFlight, emitColosseumVisual } from "./constants.js";
import { createColosseumActor } from "./actors.js";
import { warbanderRoles, warbanderSlotOffsets, defaultWarbanderFallbackOffsets, warbanderRoleConfigs, warbanderNpcDefinition, beeSwarmSpawnTiles, beeSwarmNpcDefinition, advanceBeeSwarmRespawn } from "./minions.js";
import { solarflareNpcDefinition, createSolarflareOrb, SolarflareDamage } from "./solarflare.js";
function getVolatilityExplosionTiles(position, size, volatilityTier) {
  const reach = Math.min(volatilityTier, 2);
  const blastTiles = [];
  for (let x = position[0] - reach; x < position[0] + size + reach; x++) {
    for (let y = position[1] - reach; y < position[1] + size + reach; y++) {
      blastTiles.push([x, y]);
    }
  }
  return blastTiles;
}
function getVolatilityGraphicDelayCycles(blastTile, explosionCenter) {
  return Math.max(Math.abs(blastTile[0] - explosionCenter[0]), Math.abs(blastTile[1] - explosionCenter[1])) * 2;
}
var totemProjectileFlightTicks = getTicksFromCycles(totemProjectileFlight.endDelayCycles);
var healingTotemNpcDefinition = defineNpc({
  id: "colosseum-healing-totem",
});
function findTotemSpawnTile(target, canOccupy) {
  const [targetX, targetY] = target.position;
  const size = target.size;
  const southWestCorner = [targetX - 1, targetY - 1];
  const northEastCorner = [targetX + size, targetY + size];
  const ringTiles = [];
  for (let y = targetY - 1; y <= targetY + size; y++) {
    for (let x = targetX - 1; x <= targetX + size; x++) {
      if (x === targetX - 1 || x === targetX + size || y === targetY - 1 || y === targetY + size) {
        ringTiles.push([x, y]);
      }
    }
  }
  const distanceFromSouthWest = (tile) => Math.max(Math.abs(tile[0] - southWestCorner[0]), Math.abs(tile[1] - southWestCorner[1]));
  return (
    [
      southWestCorner,
      northEastCorner,
      ...ringTiles
        .filter(
          ([x, y]) =>
            !((x === southWestCorner[0] && y === southWestCorner[1]) || (x === northEastCorner[0] && y === northEastCorner[1])),
        )
        .sort((tileA, tileB) => distanceFromSouthWest(tileA) - distanceFromSouthWest(tileB)),
    ].find((tile) => canOccupy(tile)) ?? null
  );
}
function updateHealingTotem(totem, context) {
  const state = totem.state;
  const target = context.world.getNpc(state.targetId);
  if (!totem.alive || !target?.alive) {
    return;
  }
  const dueArrivals = state.arrivals.filter((arrivalTick) => arrivalTick <= context.tick);
  state.arrivals.splice(0, dueArrivals.length);
  for (const arrivalTick of dueArrivals) {
    if (!(healNpc(target, state.healAmount, context.tickEvents) <= 0)) {
      emitColosseumVisual(context.tickEvents, {
        animations: [],
        graphics: [
          {
            spotAnimId: colosseumSpotAnimIds.totemImpact,
            actorId: target.id,
            delayCycles: 0,
          },
        ],
      });
    }
  }
  if (!(context.tick < state.nextLaunchTick) && !(target.vitals.hp >= target.vitals.maxHp)) {
    state.nextLaunchTick = context.tick + 6;
    state.arrivals.push(context.tick + totemProjectileFlightTicks);
    emitColosseumVisual(context.tickEvents, {
      animations: [
        {
          actorId: totem.id,
          clipId: "attack",
          delayCycles: 0,
        },
      ],
      graphics: [],
      projectiles: [
        {
          ...totemProjectileFlight,
          sourcePosition: getProjectileSourcePosition(totem),
          target: buildActorVisualTarget(target),
        },
      ],
    });
  }
}
function createHealingTotemActor(totemSpawn) {
  const totemActor = createColosseumActor("healing_totem", totemSpawn.id, totemSpawn.position);
  totemActor.combat.targetId = totemSpawn.target.id;
  return healingTotemNpcDefinition.createActor(
    {
      ...totemActor,
      spawnTick: totemSpawn.tick,
    },
    {
      targetId: totemSpawn.target.id,
      healAmount: totemSpawn.healAmount,
      nextLaunchTick: totemSpawn.tick + 7,
      arrivals: [],
    },
  );
}
function createBeeSwarmActors(swarmSpawn) {
  const remainingSpawnTiles = beeSwarmSpawnTiles.map((tile) => [...tile]);
  return Array.from(
    {
      length: swarmSpawn.tier,
    },
    (unusedElement, index) => {
      const spawnTile = remainingSpawnTiles.splice(Math.floor(swarmSpawn.random() * remainingSpawnTiles.length), 1)[0];
      return beeSwarmNpcDefinition.createActor(
        {
          ...createColosseumActor("bees", `${swarmSpawn.idPrefix}_${index}`, spawnTile),
          spawnTick: swarmSpawn.tick,
        },
        {
          spawnPosition: [...spawnTile],
          nextStepTick: swarmSpawn.tick + 1,
          nextWindowTick: swarmSpawn.tick + 1,
          destination: null,
          teleportAt: null,
          resumeAt: null,
          defeatedTick: null,
        },
      );
    },
  );
}
// A warbander as an actor. `warbanderSpawn` is { id, role, position,
// spawnTick, slotOffset, fallbackOffsets?, relentless? }: its attacks are
// counted from `spawnTick`, and it walks from two ticks after it
// (minions.js).
// WIKI (Fremennik warband berserker, seer, archer): Ice Barrage needs "at
// least a +104 magic attack bonus with Augury, or +140 without Augury, to
// guarantee a freeze" on each of the three (but "This will not guarantee a
// max hit"). The wiki gives bonuses, not a roll; inferred: the bar is a
// magic attack roll, the one of 99 Magic, no prayer, +140, with the effective
// level of engine/combatFormulas.js (getEffectiveMagicAttackLevel: + 9):
// (99 + 9) * (140 + 64) = 22032; +139 falls short at 21924. With Augury that
// is +104 (132 * 168 = 22176; +103 also clears it at 22044, +102 does not at
// 21912). The berserker page's elite void line (+52 with Augury) comes out a
// little short: 187 * 116 = 21692. Change this with that formula.
const warbandIceBarrageSureFreezeAttackRoll = (99 + 9) * (140 + 64);
function createWarbanderActor(warbanderSpawn) {
  const roleProfile = warbanderRoleConfigs[warbanderSpawn.role];
  const hitpoints = getMonsterHitpoints(roleProfile.npcTypeId);
  const formulaStats = getMonsterFormulaStats(roleProfile.npcTypeId);
  if (hitpoints === undefined || formulaStats === undefined) {
    throw new TypeError(
      `Missing Colosseum monster data for ${roleProfile.npcTypeId}`,
    );
  }
  const warbanderActor = {
    id: warbanderSpawn.id,
    kind: "npc",
    npcTypeId: roleProfile.npcTypeId,
    archetypeId: `colosseum_warband_${warbanderSpawn.role}`,
    role: "minion",
    size: 1,
    alive: true,
    position: [...warbanderSpawn.position],
    previousPosition: [...warbanderSpawn.position],
    facing: 0,
    spawnTick: warbanderSpawn.spawnTick,
    blocksNpcMovement: false,
    passThruNpcs: true,
    movesWithAttackerUnder: true,
    facesStepsWhileMoving: true,
    vitals: {
      hp: hitpoints,
      maxHp: hitpoints,
    },
    history: new Map(),
    formulaStats: {
      ...structuredClone(formulaStats),
      alwaysMaximumPlayerHitStyles: [roleProfile.weakness],
      // WIKI (Fortis Colosseum/Strategies): the weakness always hits and max
      // hits, "The only exception is Ice Barrage on the berserker".
      alwaysMaximumPlayerHitExceptSpells: ["Ice Barrage"],
      playerSpellAccurateFromAttackRoll: { "Ice Barrage": warbandIceBarrageSureFreezeAttackRoll },
    },
    combat: {
      attackSpeed: 6,
      attackRange: 1,
      attackStyle: roleProfile.plan.damageType,
      nextActionTick: 0,
      targetId: "player",
      lastAttackTick: null,
      animations: {
        idle: null,
        walk: null,
        run: null,
        attack: roleProfile.seqs.attack,
        death: roleProfile.seqs.death,
      },
    },
  };
  return warbanderNpcDefinition.createActor(warbanderActor, {
    role: warbanderSpawn.role,
    slotOffset: [...warbanderSpawn.slotOffset],
    fallbackOffsets: (warbanderSpawn.fallbackOffsets ?? defaultWarbanderFallbackOffsets).map((offset) => [...offset]),
    route: {
      remainingSteps: [],
    },
    relentless: warbanderSpawn.relentless ?? 0,
  });
}
function getExplosionCenter(position, size) {
  const halfSize = Math.floor(size / 2);
  return [position[0] + halfSize, position[1] + halfSize];
}
function getVolatilityExplosionDamages(position, size, volatilityTier, playerPosition) {
  if (getVolatilityExplosionTiles(position, size, volatilityTier).some(([x, y]) => x === playerPosition[0] && y === playerPosition[1])) {
    return [
      {
        baseDamage: [16, 24],
        attackType: "typeless",
        source: "Volatility",
        playerPosition: [...playerPosition],
      },
    ];
  } else {
    return [];
  }
}
var SolModifierEffects = class {
  selection;
  spawned = false; // the solarflare orbs were spawned
  beesSpawned = false;
  quartetSpawned = false;
  beeRules = beeSwarmNpcDefinition.register(undefined);
  solarflareDamage = new SolarflareDamage();
  removeOrbsAt = null;
  explosion = null;
  // "half-hp" until Sol is down to half his hitpoints; then the tick the totem
  // spawns on; null once it has; 200 ticks after a totem's death when it dies.
  totemDue = "half-hp";
  totemCount = 0;
  constructor(selection) {
    this.selection = selection;
  }
  reset() {
    this.spawned = false;
    this.beesSpawned = false;
    this.quartetSpawned = false;
    this.solarflareDamage.reset();
    this.removeOrbsAt = null;
    this.explosion = null;
    this.totemDue = "half-hp";
    this.totemCount = 0;
  }
  orbs(world) {
    return world.getNpcs().filter(solarflareNpcDefinition.isActor);
  }
  bees(world) {
    return world.getNpcs().filter(beeSwarmNpcDefinition.isActor);
  }
  warbanders(world) {
    return world.getNpcs().filter(warbanderNpcDefinition.isActor);
  }
  totems(world) {
    return world.getNpcs().filter(healingTotemNpcDefinition.isActor);
  }
  processTotems(context, target) {
    if (this.selection.totemic) {
      if (target?.alive) {
        if (
          this.totemDue === "half-hp" &&
          target.vitals.hp <= target.vitals.maxHp * 0.5
        ) {
          this.totemDue = context.tick;
        }
        if (typeof this.totemDue == "number" && context.tick >= this.totemDue) {
          const spawnTile = findTotemSpawnTile(target, (tile) => isArenaFootprintWalkable(tile, 1));
          if (spawnTile) {
            context.spawnNpc(
              createHealingTotemActor({
                id: "sol_totem_" + this.totemCount++,
                position: spawnTile,
                target: target,
                healAmount: 75,
                tick: context.tick,
              }),
            );
            this.totemDue = null;
          }
        }
        for (const totem of this.totems(context.world)) {
          updateHealingTotem(totem, context);
        }
      } else {
        for (const totem of this.totems(context.world)) {
          context.despawnNpc(totem.id);
        }
      }
    }
  }
  onNpcDefeated(defeat, world) {
    const defeatedNpc = world.getNpc(defeat.npcId);
    if (defeatedNpc && healingTotemNpcDefinition.isActor(defeatedNpc)) {
      this.totemDue = defeat.tick + 200;
    }
  }
  resetTotems(context) {
    for (const totem of this.totems(context.world)) {
      context.despawnNpc(totem.id);
    }
    this.totemDue = "half-hp";
  }
  advanceBeeRespawns(context) {
    for (const swarm of this.bees(context.world)) {
      advanceBeeSwarmRespawn(swarm, context.tick);
    }
  }
  despawnBeesAndWarbanders(context) {
    for (const minion of [...this.bees(context.world), ...this.warbanders(context.world)]) {
      context.despawnNpc(minion.id);
    }
  }
  areOrbsActive(tick) {
    return this.removeOrbsAt === null || tick < this.removeOrbsAt;
  }
  scheduleBossDefeatEffects(defeatTick, bossPosition, bossSize) {
    this.removeOrbsAt = defeatTick + 11;
    if (this.selection.volatility) {
      this.explosion = {
        tick: defeatTick + 9,
        position: [...bossPosition],
        size: bossSize,
      };
    }
  }
  processTick(context, bossAlive, random) {
    const solarflareTier = this.selection.solarflare;
    const orbIds = new Set(this.orbs(context.world).map((orb) => orb.id));
    const orbMovements = [...(context.npcMovements?.values() ?? [])].filter((movement) =>
      orbIds.has(movement.npcId),
    );
    const environmentalDamages = solarflareTier
      ? this.solarflareDamage.resolveTick(context, orbMovements, solarflareTier)
      : [];
    if (bossAlive && this.selection.bees && !this.beesSpawned && context.tick >= 8) {
      this.beesSpawned = true;
      for (const swarm of createBeeSwarmActors({
        tier: this.selection.bees,
        tick: context.tick,
        idPrefix: "sol_bees",
        random: random,
      })) {
        context.spawnNpc(swarm);
        emitColosseumVisual(context.tickEvents, {
          animations: [
            {
              actorId: swarm.id,
              clipId: "spawn",
              delayCycles: 0,
            },
          ],
          graphics: [],
        });
      }
    }
    if (bossAlive && this.selection.quartet && !this.quartetSpawned && context.tick >= 3) {
      this.quartetSpawned = true;
      const role = warbanderRoles[Math.floor(random() * warbanderRoles.length)];
      const spawnTile = quartetSpawnTiles[Math.floor(random() * quartetSpawnTiles.length)];
      context.spawnNpc(
        createWarbanderActor({
          id: "sol_quartet_warbander",
          role: role,
          position: spawnTile,
          spawnTick: context.tick,
          slotOffset: warbanderSlotOffsets.quartet,
          fallbackOffsets: [],
          relentless: this.selection.relentless ?? 0,
        }),
      );
    }
    if (bossAlive) {
      for (const swarm of this.bees(context.world)) {
        environmentalDamages.push(
          ...this.beeRules.resolveLocalEffects(swarm, {
            ...context,
            random: random,
          }),
        );
      }
    }
    if (solarflareTier && bossAlive && !this.spawned && context.tick >= 3) {
      this.spawned = true;
      for (const [orbIndex, corners] of solarflareRouteCorners.entries()) {
        context.spawnNpc(
          createSolarflareOrb({
            id: `sol_solarflare_${orbIndex}`,
            corners: corners,
            tier: solarflareTier,
            spawnTick: context.tick,
            firstStepTick: 4,
          }),
        );
      }
    }
    if (this.removeOrbsAt !== null && context.tick >= this.removeOrbsAt) {
      for (const orb of this.orbs(context.world)) {
        context.despawnNpc(orb.id);
      }
      this.removeOrbsAt = null;
    }
    const explosion = this.explosion;
    const volatilityTier = this.selection.volatility;
    if (!explosion || !volatilityTier || context.tick < explosion.tick) {
      return environmentalDamages;
    }
    this.explosion = null;
    const explosionCenter = getExplosionCenter(explosion.position, explosion.size);
    emitColosseumVisual(context.tickEvents, {
      animations: [],
      graphics: [
        {
          spotAnimId: colosseumSpotAnimIds.finalBossExplosion,
          position: explosionCenter,
          delayCycles: 0,
        },
        ...getVolatilityExplosionTiles(explosion.position, explosion.size, volatilityTier).map((blastTile) => ({
          spotAnimId: colosseumSpotAnimIds.fireblastImpact,
          position: blastTile,
          delayCycles: getVolatilityGraphicDelayCycles(blastTile, explosionCenter),
        })),
      ],
    });
    environmentalDamages.push(
      ...getVolatilityExplosionDamages(explosion.position, explosion.size, volatilityTier, context.playerPos),
    );
    return environmentalDamages;
  }
};
export {
  healingTotemNpcDefinition,
  SolModifierEffects,
  createWarbanderActor,
  createBeeSwarmActors,
  createHealingTotemActor,
  updateHealingTotem,
  findTotemSpawnTile,
  getVolatilityExplosionTiles,
  getVolatilityGraphicDelayCycles,
};
