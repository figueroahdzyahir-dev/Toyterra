import { starterDecks } from "../data/starterDecks";
import type { GameState, PlayerId, PlayerState } from "./types";
import { validateDeck } from "./deckValidation";

const STARTING_NEXUS_HEALTH = 20;
const STARTING_HAND_SIZE = 4;

function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "player" ? "enemy" : "player";
}

export function shuffleDeck(cardIds: string[]): string[] {
  const shuffled = [...cardIds];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function createPlayer(id: PlayerId, deck: string[]): PlayerState {
  return {
    id,
    nexus: STARTING_NEXUS_HEALTH,
    deck,
    hand: [],
    graveyard: [],
    board: [],
    mana: 1,
    maxMana: 1,
  };
}

export function pushLog(state: GameState, message: string): GameState {
  return {
    ...state,
    log: [message, ...state.log].slice(0, 12),
  };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: {
      player: {
        ...state.players.player,
        deck: [...state.players.player.deck],
        hand: [...state.players.player.hand],
        graveyard: [...state.players.player.graveyard],
        board: state.players.player.board.map((unit) => ({ ...unit, keywords: [...unit.keywords] })),
      },
      enemy: {
        ...state.players.enemy,
        deck: [...state.players.enemy.deck],
        hand: [...state.players.enemy.hand],
        graveyard: [...state.players.enemy.graveyard],
        board: state.players.enemy.board.map((unit) => ({ ...unit, keywords: [...unit.keywords] })),
      },
    },
    activeAttack: state.activeAttack.map((pair) => ({ ...pair })),
    log: [...state.log],
  };
}

export function drawCards(state: GameState, playerId: PlayerId, count: number): GameState {
  let nextState = cloneState(state);
  const player = nextState.players[playerId];

  for (let drawn = 0; drawn < count; drawn += 1) {
    if (player.deck.length === 0) {
      nextState.winner = opponentOf(playerId);
      nextState.phase = "gameOver";
      nextState.gameOverReason = `${playerId === "player" ? "You" : "Enemy"} tried to draw from an empty deck.`;
      nextState = pushLog(nextState, nextState.gameOverReason);
      break;
    }

    const [cardId, ...remainingDeck] = player.deck;
    player.deck = remainingDeck;
    player.hand = [...player.hand, cardId];
  }

  return nextState;
}

export function createGame(playerDeckId: string): GameState {
  const playerDeck = starterDecks.find((deck) => deck.id === playerDeckId) ?? starterDecks[0];
  const enemyDeck = playerDeck.id === "toyfire-rush" ? starterDecks[1] : starterDecks[0];

  const playerValidation = validateDeck(playerDeck.cards);
  const enemyValidation = validateDeck(enemyDeck.cards);

  if (!playerValidation.valid || !enemyValidation.valid) {
    throw new Error([...playerValidation.errors, ...enemyValidation.errors].join("\n"));
  }

  let state: GameState = {
    players: {
      player: createPlayer("player", shuffleDeck(playerDeck.cards)),
      enemy: createPlayer("enemy", shuffleDeck(enemyDeck.cards)),
    },
    round: 1,
    attackToken: Math.random() > 0.5 ? "player" : "enemy",
    phase: "playerDraw",
    attackUsed: false,
    activeAttack: [],
    log: [],
    nextInstanceNumber: 1,
    destructionEventId: 0,
    playEventId: 0,
    selectedDeckName: playerDeck.name,
  };

  state = drawCards(state, "player", STARTING_HAND_SIZE);
  state = drawCards(state, "enemy", STARTING_HAND_SIZE);

  return pushLog(
    state,
      `Round 1 begins. ${state.attackToken === "player" ? "You have" : "Enemy has"} the attack token.`,
  );
}

export function startNextRound(state: GameState): GameState {
  let nextState = cloneState(state);
  const nextAttackToken = nextState.attackToken === "player" ? "enemy" : "player";

  nextState.round += 1;
  nextState.attackToken = nextAttackToken;
  nextState.phase = "playerDraw";
  nextState.attackUsed = false;
  nextState.activeAttack = [];

  for (const playerId of ["player", "enemy"] as const) {
    const player = nextState.players[playerId];
    player.maxMana = Math.min(10, player.maxMana + 1);
    player.mana = player.maxMana;
    player.board = player.board.map((unit) => ({ ...unit, stunned: false }));
  }

  nextState = pushLog(
    nextState,
    `Round ${nextState.round} begins. ${nextAttackToken === "player" ? "You have" : "Enemy has"} the attack token.`,
  );

  return nextState;
}
