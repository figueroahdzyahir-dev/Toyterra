import { cardById } from "../data/cards";
import type { UnitInstance } from "../game/types";

interface CardViewProps {
  cardId?: string;
  unit?: UnitInstance;
  compact?: boolean;
  hidden?: boolean;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
  onClick?: () => void;
}

export function CardView({ cardId, unit, compact, hidden, selected, disabled, label, className, onClick }: CardViewProps) {
  const card = cardId ? cardById.get(cardId) : undefined;
  const faction = unit?.faction ?? card?.faction ?? "Toyfire";
  const type = unit ? "Unit" : card?.type;
  const keywords = unit?.keywords ?? (card && card.type === "Unit" ? card.keywords ?? [] : []);

  return (
    <button
      className={[
        "card",
        `card--${faction.toLowerCase()}`,
        compact ? "card--compact" : "",
        selected ? "is-selected" : "",
        disabled ? "is-disabled" : "",
        className ?? "",
      ].join(" ")}
      type="button"
      onClick={onClick}
      disabled={disabled || hidden}
      aria-pressed={selected}
    >
      {hidden ? (
        <div className="card__back">Toyterra</div>
      ) : (
        <>
          <div className="card__top">
            <span className="card__cost">{card?.cost ?? ""}</span>
            <span className="card__faction">{faction}</span>
          </div>
          <strong className="card__name">{unit?.name ?? card?.name}</strong>
          <span className="card__type">{type}</span>
          {!compact && <p className="card__description">{unit?.description ?? card?.description}</p>}
          {keywords.length > 0 && <span className="card__keywords">{keywords.join(" / ")}</span>}
          {(unit || card?.type === "Unit") && (
            <div className="card__stats">
              <span>{unit?.attack ?? (card?.type === "Unit" ? card.attack : 0)}</span>
              <span>
                {unit ? unit.health - unit.damage : card?.type === "Unit" ? card.health : 0}
                {unit?.damage ? `/${unit.health}` : ""}
              </span>
            </div>
          )}
          {unit?.stunned && <span className="card__status">Stunned</span>}
          {label && <span className="card__label">{label}</span>}
        </>
      )}
    </button>
  );
}
