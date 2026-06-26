# Toyterra

Toyterra is a complete local browser card battler built with React, TypeScript,
and Vite. It has no backend and keeps all game state in memory.

## Run

```bash
npm install
npm run dev
```

Open the local URL Vite prints in the terminal.

## Build Check

```bash
npm run build
```

## Project Shape

- `src/data/cards.ts`: all card definitions.
- `src/data/starterDecks.ts`: starter deck lists.
- `src/game/types.ts`: shared game and card types.
- `src/game/deckValidation.ts`: 20-card and max-2-copy deck checks.
- `src/game/gameState.ts`: game setup, drawing, rounds, and shared state helpers.
- `src/game/gameActions.ts`: playing cards and ending the player action.
- `src/game/combat.ts`: attacks, blocking, Quick timing, Strike, and deaths.
- `src/game/effects.ts`: spell, play, Strike, and Last Breath effects.
- `src/game/ai.ts`: simple opponent logic.
- `src/components/`: React UI components.
- `src/styles/global.css`: the visual style and responsive layout.

## Adding Cards

Add new cards in `src/data/cards.ts`. Every card needs:

- `id`
- `name`
- `faction`
- `type`
- `cost`
- `rarity`
- `description`

Units also need `attack` and `health`. Use `keywords` and `effect` only when
the card needs extra behavior.

If a card needs a new behavior, add a new `EffectId` in `src/game/types.ts`,
then implement it in `src/game/effects.ts`.

## Adding Decks

Add a new starter deck in `src/data/starterDecks.ts`. Decks must contain exactly
20 card ids and no more than 2 copies of any card. The deck select screen runs
the validator automatically.
