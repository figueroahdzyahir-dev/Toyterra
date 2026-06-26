import { cardById } from "../data/cards";
import type { GameState, PlayerId } from "./types";
import { applyEffect, createUnitInstance, getCardName, isUsefulSpell } from "./effects";
import { cloneState, drawCards, pushLog } from "./gameState";

function canActForPhase(state: GameState, playerId: PlayerId): boolean {
  if (state.phase === "gameOver") return false;
  if (playerId === "player") return state.phase === "playerSetup";
  return state.phase === "enemySetup";
}

export function playCard(state: GameState, playerId: PlayerId, handIndex: number): GameState {
  if (!canActForPhase(state, playerId)) {
    return state;
  }

  const cardId = state.players[playerId].hand[handIndex];
  const card = cardById.get(cardId);

  if (!card) {
    return pushLog(state, "That card could not be found.");
  }

  if (card.cost > state.players[playerId].mana) {
    return pushLog(state, `Not enough mana for ${card.name}.`);
  }

  if (card.type === "Unit" && state.players[playerId].board.length >= 6) {
    return pushLog(state, "Board is full.");
  }

  if (card.type === "Spell" && !isUsefulSpell(card.effect, state, playerId)) {
    return pushLog(state, `${card.name} has no useful target.`);
  }

  let nextState = cloneState(state);
  const player = nextState.players[playerId];
  player.mana -= card.cost;
  player.hand = player.hand.filter((_, index) => index !== handIndex);

  if (card.type === "Unit") {
    const unit = createUnitInstance(card.id, playerId, nextState.nextInstanceNumber);
    player.board = [...player.board, unit];
    nextState.nextInstanceNumber += 1;
    nextState.lastPlayedName = card.name;
    nextState.lastPlayedInstanceId = unit.instanceId;
    nextState.playEventId += 1;
    nextState = pushLog(nextState, `${playerId === "player" ? "You play" : "Enemy plays"} ${card.name}.`);
    return applyEffect(nextState, card.effect, playerId, card.name);
  }

  nextState.lastPlayedName = card.name;
  nextState.lastPlayedInstanceId = undefined;
  nextState.playEventId += 1;
  nextState = pushLog(nextState, `${playerId === "player" ? "You cast" : "Enemy casts"} ${card.name}.`);
  return applyEffect(nextState, card.effect, playerId, card.name);
}

export function endPlayerTurn(state: GameState): GameState {
  if (state.phase === "playerSetup") {
    return pushLog({ ...state, phase: "playerAttack" }, "Your attack phase begins.");
  }

  if (state.phase === "playerAttack") {
    return pushLog({ ...state, phase: "enemyDraw" }, "You pass the turn.");
  }

  return state;
}

export function advanceDrawPhase(state: GameState): GameState {
  if (state.phase === "playerDraw") {
    const drawn = drawCards(pushLog(state, "Your draw phase."), "player", 1);
    return drawn.phase === "gameOver" ? drawn : pushLog({ ...drawn, phase: "playerSetup" }, "Your setup phase begins.");
  }

  if (state.phase === "enemyDraw") {
    const drawn = drawCards(pushLog(state, "Enemy draw phase."), "enemy", 1);
    return drawn.phase === "gameOver" ? drawn : pushLog({ ...drawn, phase: "enemySetup" }, "Enemy setup phase begins.");
  }

  return state;
}

export function getPlayableHandIndexes(state: GameState, playerId: PlayerId): number[] {
  return state.players[playerId].hand
    .map((cardId, index) => ({ card: cardById.get(cardId), index }))
    .filter(({ card }) => Boolean(card))
    .filter(({ card }) => card!.cost <= state.players[playerId].mana)
    .filter(({ card }) => card!.type !== "Spell" || isUsefulSpell(card!.effect, state, playerId))
    .map(({ index }) => index);
}

export function getHandCardName(state: GameState, playerId: PlayerId, handIndex: number): string {
  return getCardName(state.players[playerId].hand[handIndex]);
}
