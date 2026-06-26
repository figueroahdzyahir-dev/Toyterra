import { cardById } from "../data/cards";
import { declareEnemyAttack } from "./combat";
import { advanceDrawPhase, getPlayableHandIndexes, playCard } from "./gameActions";
import { pushLog, startNextRound } from "./gameState";
import type { GameState } from "./types";

function sortAiChoices(state: GameState, indexes: number[]): number[] {
  return [...indexes].sort((a, b) => {
    const cardA = cardById.get(state.players.enemy.hand[a]);
    const cardB = cardById.get(state.players.enemy.hand[b]);

    if (!cardA || !cardB) return 0;

    // Damage and control spells are considered before units when they can remove blockers or finish the Nexus.
    const spellScoreA = cardA.type === "Spell" ? 1 : 0;
    const spellScoreB = cardB.type === "Spell" ? 1 : 0;
    return spellScoreB - spellScoreA || cardB.cost - cardA.cost;
  });
}

export function runEnemyTurn(state: GameState): GameState {
  if (state.winner) {
    return state;
  }

  if (state.phase === "enemyDraw") {
    return advanceDrawPhase(state);
  }

  if (state.phase === "enemyAttack") {
    if (state.attackToken === "enemy" && !state.attackUsed) {
      return declareEnemyAttack(state);
    }

    return startNextRound(pushLog(state, "Enemy passes the turn."));
  }

  if (state.phase !== "enemySetup") {
    return state;
  }

  let nextState = pushLog(state, "Enemy setup phase.");
  let playedCard = true;

  // The AI greedily spends mana from expensive to cheap. This is predictable, but solid for a starter opponent.
  while (playedCard && nextState.phase === "enemySetup") {
    playedCard = false;
    const playableIndexes = sortAiChoices(nextState, getPlayableHandIndexes(nextState, "enemy"));

    for (const handIndex of playableIndexes) {
      const card = cardById.get(nextState.players.enemy.hand[handIndex]);
      if (!card) continue;
      if (card.type === "Unit" && nextState.players.enemy.board.length >= 6) continue;

      nextState = playCard(nextState, "enemy", handIndex);
      playedCard = true;
      break;
    }
  }

  if (nextState.phase === "gameOver") {
    return nextState;
  }

  return pushLog({ ...nextState, phase: "enemyAttack" }, "Enemy attack phase begins.");
}
