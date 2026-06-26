import { useEffect, useMemo, useState } from "react";
import { cards } from "./data/cards";
import { starterDecks } from "./data/starterDecks";
import { validateDeck } from "./game/deckValidation";
import { createGame } from "./game/gameState";
import type { GameState } from "./game/types";
import { CardView } from "./components/CardView";
import { GameBoard } from "./components/GameBoard";

type Screen = "menu" | "deckSelect" | "collection" | "game" | "gameOver";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [gameState, setGameState] = useState<GameState | null>(null);

  const deckReports = useMemo(
    () => starterDecks.map((deck) => ({ deck, validation: validateDeck(deck.cards) })),
    [],
  );

  useEffect(() => {
    if (screen !== "game" || gameState?.phase !== "gameOver") return;

    const timer = window.setTimeout(() => setScreen("gameOver"), 450);
    return () => window.clearTimeout(timer);
  }, [gameState?.phase, screen]);

  function startGame(deckId: string) {
    const newGame = createGame(deckId);
    setGameState(newGame);
    setScreen("game");
  }

  function updateGame(updater: (state: GameState) => GameState) {
    setGameState((current) => {
      if (!current) return current;
      return updater(current);
    });
  }

  if (screen === "game" && gameState) {
    return <GameBoard state={gameState} setState={updateGame} />;
  }

  if (screen === "gameOver" && gameState) {
    return (
      <main className="menu-screen">
        <section className="hero-panel hero-panel--compact">
          <span className="eyebrow">Game Over</span>
          <h1>{gameState.winner === "player" ? "Victory" : "Defeat"}</h1>
          <p>{gameState.gameOverReason}</p>
          <div className="menu-actions">
            <button type="button" onClick={() => setScreen("deckSelect")}>
              Play Again
            </button>
            <button type="button" className="secondary" onClick={() => setScreen("menu")}>
              Main Menu
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "collection") {
    return (
      <main className="collection-screen">
        <header className="screen-header">
          <div>
            <span className="eyebrow">Card Collection</span>
            <h1>Toyterra Cards</h1>
          </div>
          <button type="button" className="secondary" onClick={() => setScreen("menu")}>
            Back
          </button>
        </header>
        <section className="collection-grid">
          {cards.map((card) => (
            <CardView key={card.id} cardId={card.id} />
          ))}
        </section>
      </main>
    );
  }

  if (screen === "deckSelect") {
    return (
      <main className="deck-screen">
        <header className="screen-header">
          <div>
            <span className="eyebrow">Deck Select</span>
            <h1>Choose a Starter</h1>
          </div>
          <button type="button" className="secondary" onClick={() => setScreen("menu")}>
            Back
          </button>
        </header>
        <section className="deck-grid">
          {deckReports.map(({ deck, validation }) => (
            <article className="deck-card" key={deck.id}>
              <span>{deck.factionFocus}</span>
              <h2>{deck.name}</h2>
              <p>{deck.description}</p>
              <div className={validation.valid ? "deck-status is-valid" : "deck-status is-invalid"}>
                {validation.valid ? "20 cards · max 2 copies" : validation.errors.join(" ")}
              </div>
              <button type="button" onClick={() => startGame(deck.id)} disabled={!validation.valid}>
                Select
              </button>
            </article>
          ))}
        </section>
      </main>
    );
  }

  return (
    <main className="menu-screen">
      <section className="hero-panel">
        <span className="eyebrow">Original Tactical Card Battler</span>
        <h1>Toyterra</h1>
        <p>Lead wind-up warriors, plush defenders, shadow tricks, and gear-built walls in a compact duel for the tabletop Nexus.</p>
        <div className="menu-actions">
          <button type="button" onClick={() => setScreen("deckSelect")}>
            Play
          </button>
          <button type="button" className="secondary" onClick={() => setScreen("collection")}>
            Collection
          </button>
        </div>
      </section>
      <section className="faction-strip" aria-label="Toyterra factions">
        {["Toyfire", "Plushguard", "Shadowbox", "Gearforce"].map((faction) => (
          <div key={faction}>
            <strong>{faction}</strong>
          </div>
        ))}
      </section>
    </main>
  );
}
