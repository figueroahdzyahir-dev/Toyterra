import type { CombatPair, GameState, PlayerId, UnitInstance } from "./types";
import { applyStrikeEffect, removeDeadUnits } from "./effects";
import { cloneState, pushLog, startNextRound } from "./gameState";

export const ATTACK_MANA_COST = 2;

function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "player" ? "enemy" : "player";
}

function findUnit(state: GameState, ownerId: PlayerId, unitId: string): UnitInstance | undefined {
  return state.players[ownerId].board.find((unit) => unit.instanceId === unitId);
}

function damageNexus(state: GameState, targetId: PlayerId, amount: number): GameState {
  const nextState = cloneState(state);
  nextState.players[targetId].nexus = Math.max(0, nextState.players[targetId].nexus - amount);
  let logged = pushLog(nextState, `${amount} unblocked damage hits ${targetId === "player" ? "your" : "enemy"} Nexus.`);

  if (logged.players[targetId].nexus <= 0) {
    logged.winner = opponentOf(targetId);
    logged.phase = "gameOver";
    logged.gameOverReason = `${logged.winner === "player" ? "You win" : "Enemy wins"} by Nexus damage.`;
  }

  return logged;
}

function assignDamage(state: GameState, ownerId: PlayerId, unitId: string, amount: number): GameState {
  const nextState = cloneState(state);
  const unit = findUnit(nextState, ownerId, unitId);

  if (unit) {
    unit.damage += amount;
  }

  return nextState;
}

function spendAttackMana(state: GameState, playerId: PlayerId, attackerCount: number): GameState {
  const nextState = cloneState(state);
  nextState.players[playerId].mana -= attackerCount * ATTACK_MANA_COST;
  return nextState;
}

function resolvePair(state: GameState, attackerOwner: PlayerId, pair: CombatPair): GameState {
  const defenderOwner = opponentOf(attackerOwner);
  const attacker = findUnit(state, attackerOwner, pair.attackerId);

  if (!attacker || attacker.damage >= attacker.health || attacker.stunned) {
    return state;
  }

  if (!pair.blockerId) {
    const damaged = damageNexus(state, defenderOwner, attacker.attack);
    return damaged.phase === "gameOver" ? damaged : applyStrikeEffect(damaged, attackerOwner, attacker);
  }

  const blocker = findUnit(state, defenderOwner, pair.blockerId);
  if (!blocker || blocker.damage >= blocker.health) {
    const damaged = damageNexus(state, defenderOwner, attacker.attack);
    return damaged.phase === "gameOver" ? damaged : applyStrikeEffect(damaged, attackerOwner, attacker);
  }

  let nextState = state;

  // Quick attackers hit first. If that damage destroys the blocker, the blocker never strikes back.
  if (attacker.keywords.includes("Quick")) {
    nextState = assignDamage(nextState, defenderOwner, blocker.instanceId, attacker.attack);
    nextState = applyStrikeEffect(nextState, attackerOwner, attacker);

    const blockerAfterQuick = findUnit(nextState, defenderOwner, blocker.instanceId);
    if (blockerAfterQuick && blockerAfterQuick.damage < blockerAfterQuick.health) {
      nextState = assignDamage(nextState, attackerOwner, attacker.instanceId, blocker.attack);
      nextState = applyStrikeEffect(nextState, defenderOwner, blocker);
    }

    return nextState;
  }

  nextState = assignDamage(nextState, defenderOwner, blocker.instanceId, attacker.attack);
  nextState = assignDamage(nextState, attackerOwner, attacker.instanceId, blocker.attack);
  nextState = applyStrikeEffect(nextState, attackerOwner, attacker);
  nextState = applyStrikeEffect(nextState, defenderOwner, blocker);

  return nextState;
}

export function chooseAiBlocks(state: GameState, attackerIds: string[]): CombatPair[] {
  const availableBlockers = [...state.players.enemy.board].filter((unit) => !unit.stunned);
  const pairs: CombatPair[] = attackerIds.map((attackerId) => ({ attackerId }));
  const sortedPairs = pairs.sort((a, b) => {
    const attackerA = findUnit(state, "player", a.attackerId)?.attack ?? 0;
    const attackerB = findUnit(state, "player", b.attackerId)?.attack ?? 0;
    return attackerB - attackerA;
  });

  for (const pair of sortedPairs) {
    if (availableBlockers.length === 0) break;

    availableBlockers.sort((a, b) => {
      const guardScore = Number(b.keywords.includes("Guard")) - Number(a.keywords.includes("Guard"));
      return guardScore || a.attack - b.attack || b.health - b.damage - (a.health - a.damage);
    });

    const [blocker] = availableBlockers.splice(0, 1);
    pair.blockerId = blocker.instanceId;
  }

  return pairs;
}

export function resolveCombat(state: GameState, attackerOwner: PlayerId, pairs: CombatPair[]): GameState {
  let nextState = pushLog(state, "Combat resolves.");

  for (const pair of pairs) {
    if (nextState.phase === "gameOver") {
      return nextState;
    }

    nextState = resolvePair(nextState, attackerOwner, pair);
    nextState = removeDeadUnits(nextState);
  }

  nextState.attackUsed = true;
  nextState.activeAttack = [];
  return nextState;
}

export function resolvePlayerAttack(state: GameState, attackerIds: string[]): GameState {
  if (state.phase !== "playerAttack") {
    return state;
  }

  if (state.attackToken !== "player" || state.attackUsed || attackerIds.length === 0) {
    return pushLog(state, state.attackToken === "player" ? "Choose at least one attacker." : "You do not have the attack token.");
  }

  const legalAttackers = attackerIds.filter((unitId) => {
    const unit = findUnit(state, "player", unitId);
    return unit && !unit.stunned;
  });

  if (legalAttackers.length === 0) {
    return pushLog(state, "No ready attackers.");
  }

  const attackCost = legalAttackers.length * ATTACK_MANA_COST;
  if (state.players.player.mana < attackCost) {
    return pushLog(state, `Not enough mana to attack. ${legalAttackers.length} attacker(s) cost ${attackCost} mana.`);
  }

  const paidState = spendAttackMana(state, "player", legalAttackers.length);
  const pairs = chooseAiBlocks(paidState, legalAttackers);
  const blockedCount = pairs.filter((pair) => pair.blockerId).length;
  const withLog = pushLog(
    paidState,
    `You spend ${attackCost} mana and attack with ${legalAttackers.length}. Enemy blocks ${blockedCount}.`,
  );
  const resolved = resolveCombat(withLog, "player", pairs);

  return resolved.phase === "gameOver" ? resolved : { ...resolved, phase: "enemyDraw" };
}

export function declareEnemyAttack(state: GameState): GameState {
  if (state.phase !== "enemyAttack") {
    return state;
  }

  if (state.attackToken !== "enemy" || state.attackUsed) {
    return startNextRound(state);
  }

  const affordableAttackerCount = Math.floor(state.players.enemy.mana / ATTACK_MANA_COST);
  const attackers = state.players.enemy.board
    .filter((unit) => !unit.stunned)
    .sort((a, b) => b.attack - a.attack || b.health - b.damage - (a.health - a.damage))
    .slice(0, affordableAttackerCount)
    .map((unit) => unit.instanceId);

  if (affordableAttackerCount === 0) {
    return startNextRound(pushLog(state, "Enemy has no mana left to attack."));
  }

  if (attackers.length === 0) {
    return startNextRound(pushLog(state, "Enemy has no attackers."));
  }

  const attackCost = attackers.length * ATTACK_MANA_COST;
  const paidState = spendAttackMana(state, "enemy", attackers.length);

  return pushLog(
    {
      ...paidState,
      phase: "playerBlock",
      activeAttack: attackers.map((attackerId) => ({ attackerId })),
    },
    `Enemy spends ${attackCost} mana and attacks with ${attackers.length}.`,
  );
}

export function resolveEnemyAttackBlocks(state: GameState, blockerAssignments: Record<string, string>): GameState {
  if (state.phase !== "playerBlock") {
    return state;
  }

  const usedBlockers = new Set<string>();
  const pairs = state.activeAttack.map((pair) => {
    const blockerId = blockerAssignments[pair.attackerId];
    const blocker = blockerId ? findUnit(state, "player", blockerId) : undefined;

    if (!blocker || blocker.stunned || usedBlockers.has(blockerId)) {
      return pair;
    }

    usedBlockers.add(blockerId);
    return { ...pair, blockerId };
  });

  const blockedCount = pairs.filter((pair) => pair.blockerId).length;
  const resolved = resolveCombat(pushLog(state, `You block ${blockedCount} attacker${blockedCount === 1 ? "" : "s"}.`), "enemy", pairs);

  return resolved.phase === "gameOver" ? resolved : startNextRound(resolved);
}
