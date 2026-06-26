import { cardById } from "../data/cards";

export interface DeckValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateDeck(cardIds: string[]): DeckValidationResult {
  const errors: string[] = [];
  const counts = new Map<string, number>();

  if (cardIds.length !== 20) {
    errors.push(`Deck must contain exactly 20 cards. Found ${cardIds.length}.`);
  }

  for (const cardId of cardIds) {
    if (!cardById.has(cardId)) {
      errors.push(`Unknown card id: ${cardId}.`);
      continue;
    }

    const nextCount = (counts.get(cardId) ?? 0) + 1;
    counts.set(cardId, nextCount);

    if (nextCount > 2) {
      errors.push(`Deck has more than 2 copies of ${cardId}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
