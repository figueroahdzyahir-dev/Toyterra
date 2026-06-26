import { cardById } from "../data/cards";
import type { EffectId, GameState, PlayerId, UnitInstance } from "./types";
import { cloneState, drawCards, pushLog } from "./gameState";

const MAX_NEXUS_HEALTH = 20;

function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "player" ? "enemy" : "player";
}

function displayName(playerId: PlayerId): string {
  return playerId === "player" ? "You" : "Enemy";
}

function damageNexus(state: GameState, targetId: PlayerId, amount: number, source: string): GameState {
  const nextState = cloneState(state);
  const target = nextState.players[targetId];
  target.nexus = Math.max(0, target.nexus - amount);
  let logged = pushLog(nextState, `${source} deals ${amount} to ${displayName(targetId).toLowerCase()} Nexus.`);

  if (target.nexus <= 0) {
    logged.winner = opponentOf(targetId);
    logged.phase = "gameOver";
    logged.gameOverReason = `${displayName(opponentOf(targetId))} destroyed the enemy Nexus.`;
  }

  return logged;
}

function healNexus(state: GameState, playerId: PlayerId, amount: number, source: string): GameState {
  const nextState = cloneState(state);
  const player = nextState.players[playerId];
  const before = player.nexus;
  player.nexus = Math.min(MAX_NEXUS_HEALTH, player.nexus + amount);
  return pushLog(nextState, `${source} heals ${displayName(playerId).toLowerCase()} Nexus for ${player.nexus - before}.`);
}

function findWeakestUnit(units: UnitInstance[]): UnitInstance | undefined {
  return [...units].sort((a, b) => a.health - a.damage - (b.health - b.damage) || a.attack - b.attack)[0];
}

function findStrongestUnit(units: UnitInstance[]): UnitInstance | undefined {
  return [...units].sort((a, b) => b.attack - a.attack || b.health - b.damage - (a.health - a.damage))[0];
}

function damageUnit(state: GameState, ownerId: PlayerId, unitId: string, amount: number, source: string): GameState {
  const nextState = cloneState(state);
  const unit = nextState.players[ownerId].board.find((candidate) => candidate.instanceId === unitId);

  if (!unit) {
    return nextState;
  }

  unit.damage += amount;
  return pushLog(nextState, `${source} deals ${amount} to ${unit.name}.`);
}

export function removeDeadUnits(state: GameState): GameState {
  let nextState = cloneState(state);
  const deadCardIds: Record<PlayerId, string[]> = {
    player: [],
    enemy: [],
  };

  // Last Breath effects need to fire before the dead unit leaves the board.
  for (const playerId of ["player", "enemy"] as const) {
    const deadUnits = nextState.players[playerId].board.filter((unit) => unit.damage >= unit.health);

    for (const unit of deadUnits) {
      nextState = pushLog(nextState, `${unit.name} breaks.`);
      nextState.lastDestroyedName = unit.name;
      nextState.destructionEventId += 1;
      deadCardIds[playerId].push(unit.cardId);

      if (unit.keywords.includes("Last Breath") && unit.effect) {
        nextState = applyLastBreathEffect(nextState, playerId, unit);
      }
    }
  }

  for (const playerId of ["player", "enemy"] as const) {
    nextState.players[playerId].board = nextState.players[playerId].board.filter((unit) => unit.damage < unit.health);
    nextState.players[playerId].graveyard = [...nextState.players[playerId].graveyard, ...deadCardIds[playerId]];
  }

  return nextState;
}

export function applyEffect(
  state: GameState,
  effect: EffectId | undefined,
  sourceOwner: PlayerId,
  sourceName: string,
): GameState {
  if (!effect || state.phase === "gameOver") {
    return state;
  }

  const enemyId = opponentOf(sourceOwner);

  switch (effect) {
    case "deal_enemy_nexus_1":
      return damageNexus(state, enemyId, 1, sourceName);
    case "deal_enemy_nexus_2":
      return damageNexus(state, enemyId, 2, sourceName);
    case "deal_enemy_nexus_3":
      return damageNexus(state, enemyId, 3, sourceName);
    case "drain_enemy_nexus_1": {
      const damaged = damageNexus(state, enemyId, 1, sourceName);
      return damaged.phase === "gameOver" ? damaged : healNexus(damaged, sourceOwner, 1, sourceName);
    }
    case "drain_enemy_nexus_2": {
      const damaged = damageNexus(state, enemyId, 2, sourceName);
      return damaged.phase === "gameOver" ? damaged : healNexus(damaged, sourceOwner, 2, sourceName);
    }
    case "deal_weakest_enemy_1":
    case "deal_weakest_enemy_2": {
      const target = findWeakestUnit(state.players[enemyId].board);
      if (!target) return pushLog(state, `${sourceName} fizzles with no target.`);
      const damaged = damageUnit(state, enemyId, target.instanceId, effect === "deal_weakest_enemy_1" ? 1 : 2, sourceName);
      return removeDeadUnits(damaged);
    }
    case "deal_strongest_enemy_2": {
      const target = findStrongestUnit(state.players[enemyId].board);
      if (!target) return pushLog(state, `${sourceName} fizzles with no target.`);
      const damaged = damageUnit(state, enemyId, target.instanceId, 2, sourceName);
      return removeDeadUnits(damaged);
    }
    case "heal_ally_nexus_2":
      return healNexus(state, sourceOwner, 2, sourceName);
    case "heal_ally_nexus_3":
      return healNexus(state, sourceOwner, 3, sourceName);
    case "buff_weakest_ally_0_2": {
      const nextState = cloneState(state);
      const target = findWeakestUnit(nextState.players[sourceOwner].board);
      if (!target) return pushLog(nextState, `${sourceName} fizzles with no ally.`);
      target.health += 2;
      return pushLog(nextState, `${sourceName} gives ${target.name} +0/+2.`);
    }
    case "buff_all_allies_1_0": {
      const nextState = cloneState(state);
      if (nextState.players[sourceOwner].board.length === 0) {
        return pushLog(nextState, `${sourceName} fizzles with no allies.`);
      }
      nextState.players[sourceOwner].board = nextState.players[sourceOwner].board.map((unit) => ({
        ...unit,
        attack: unit.attack + 1,
      }));
      return pushLog(nextState, `${sourceName} gives all allied units +1/+0.`);
    }
    case "buff_random_ally_1_1": {
      const nextState = cloneState(state);
      const allies = nextState.players[sourceOwner].board;
      if (allies.length === 0) return pushLog(nextState, `${sourceName} fizzles with no ally.`);
      const target = allies[Math.floor(Math.random() * allies.length)];
      target.attack += 1;
      target.health += 1;
      return pushLog(nextState, `${sourceName} gives ${target.name} +1/+1.`);
    }
    case "draw_1":
      return drawCards(pushLog(state, `${sourceName} draws a card.`), sourceOwner, 1);
    case "draw_2":
      return drawCards(pushLog(state, `${sourceName} draws two cards.`), sourceOwner, 2);
    case "stun_strongest_enemy": {
      const nextState = cloneState(state);
      const target = findStrongestUnit(nextState.players[enemyId].board);
      if (!target) return pushLog(nextState, `${sourceName} fizzles with no target.`);
      target.stunned = true;
      return pushLog(nextState, `${sourceName} stuns ${target.name}.`);
    }
    case "last_breath_deal_1":
    case "last_breath_draw_1":
    case "strike_draw_1":
    case "strike_heal_nexus_1":
    case "strike_deal_nexus_1":
      return state;
    default:
      return state;
  }
}

export function applyStrikeEffect(state: GameState, ownerId: PlayerId, unit: UnitInstance): GameState {
  if (!unit.keywords.includes("Strike") || !unit.effect) {
    return state;
  }

  if (unit.effect === "strike_draw_1") {
    return drawCards(pushLog(state, `${unit.name} strikes and draws a card.`), ownerId, 1);
  }

  if (unit.effect === "strike_heal_nexus_1") {
    return healNexus(state, ownerId, 1, unit.name);
  }

  if (unit.effect === "strike_deal_nexus_1") {
    return damageNexus(state, opponentOf(ownerId), 1, unit.name);
  }

  return state;
}

export function applyLastBreathEffect(state: GameState, ownerId: PlayerId, unit: UnitInstance): GameState {
  if (unit.effect === "last_breath_deal_1") {
    return damageNexus(state, opponentOf(ownerId), 1, unit.name);
  }

  if (unit.effect === "last_breath_draw_1") {
    return drawCards(pushLog(state, `${unit.name} leaves a hidden card behind.`), ownerId, 1);
  }

  return state;
}

export function createUnitInstance(cardId: string, owner: PlayerId, instanceNumber: number): UnitInstance {
  const card = cardById.get(cardId);

  if (!card || card.type !== "Unit") {
    throw new Error(`Cannot create unit instance for ${cardId}.`);
  }

  return {
    instanceId: `${owner}-${instanceNumber}`,
    cardId: card.id,
    owner,
    name: card.name,
    faction: card.faction,
    rarity: card.rarity,
    description: card.description,
    attack: card.attack,
    health: card.health,
    damage: 0,
    keywords: card.keywords ?? [],
    effect: card.effect,
    stunned: false,
  };
}

export function isUsefulSpell(effect: EffectId | undefined, state: GameState, ownerId: PlayerId): boolean {
  if (!effect) return true;

  const enemyId = opponentOf(ownerId);
  const enemyBoard = state.players[enemyId].board;
  const alliedBoard = state.players[ownerId].board;

  if (effect.includes("weakest_enemy") || effect.includes("strongest_enemy") || effect === "stun_strongest_enemy") {
    return enemyBoard.length > 0;
  }

  if (effect.startsWith("heal_ally")) {
    return state.players[ownerId].nexus < MAX_NEXUS_HEALTH;
  }

  if (effect.startsWith("buff_")) {
    return alliedBoard.length > 0;
  }

  return true;
}

export function getCardName(cardId: string): string {
  return cardById.get(cardId)?.name ?? cardId;
}
