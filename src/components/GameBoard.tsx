import { useEffect, useMemo, useState } from "react";
import { cardById } from "../data/cards";
import { runEnemyTurn } from "../game/ai";
import { ATTACK_MANA_COST, resolveEnemyAttackBlocks, resolvePlayerAttack } from "../game/combat";
import { advanceDrawPhase, endPlayerTurn, playCard } from "../game/gameActions";
import type { GameState } from "../game/types";
import { CardView } from "./CardView";

interface GameBoardProps {
  state: GameState;
  setState: (updater: (state: GameState) => GameState) => void;
}

export function GameBoard({ state, setState }: GameBoardProps) {
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [selectedAttackers, setSelectedAttackers] = useState<string[]>([]);
  const [selectedEnemyAttacker, setSelectedEnemyAttacker] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<Record<string, string>>({});
  const [showPhaseBanner, setShowPhaseBanner] = useState(true);
  const latestLog = state.log[0] ?? "";

  useEffect(() => {
    if (state.phase !== "playerDraw") return;

    const timer = window.setTimeout(() => {
      setState((current) => advanceDrawPhase(current));
    }, 800);

    return () => window.clearTimeout(timer);
  }, [setState, state.phase, state.round]);

  useEffect(() => {
    if (!["enemyDraw", "enemySetup", "enemyAttack"].includes(state.phase)) return;

    const timer = window.setTimeout(() => {
      setState((current) => runEnemyTurn(current));
    }, 900);

    return () => window.clearTimeout(timer);
  }, [setState, state.phase, state.log]);

  useEffect(() => {
    setSelectedHandIndex(null);
    setSelectedAttackers([]);
    setSelectedEnemyAttacker(null);
    setBlockers({});
  }, [state.round, state.phase]);

  useEffect(() => {
    setShowPhaseBanner(true);
    const timer = window.setTimeout(() => setShowPhaseBanner(false), 1500);
    return () => window.clearTimeout(timer);
  }, [state.round, state.phase]);

  const selectedCard = selectedHandIndex === null ? undefined : cardById.get(state.players.player.hand[selectedHandIndex]);
  const turnStatus =
    state.phase === "playerBlock"
      ? "Block the Attack"
      : state.phase === "playerDraw"
        ? "Your Draw Phase"
        : state.phase === "playerSetup"
          ? "Your Setup Phase"
          : state.phase === "playerAttack"
            ? "Your Attack Phase"
            : state.phase === "enemyDraw"
              ? "AI Draw Phase"
              : state.phase === "enemySetup"
                ? "AI Setup Phase"
                : state.phase === "enemyAttack"
                  ? "AI Attack Phase"
                  : "Game Over";
  const turnHint =
    state.phase === "playerBlock"
      ? "Pick an enemy attacker, then click one of your units to block."
      : state.phase === "playerDraw"
        ? "Drawing a card automatically."
        : state.phase === "playerSetup"
          ? "Play units and spells now. Cards can only be played in Setup."
          : state.phase === "playerAttack"
            ? state.attackToken === "player"
              ? `Spend ${ATTACK_MANA_COST} mana per attacker, then Confirm.`
              : "You do not have the attack token. Pass to the AI."
            : state.phase === "enemyDraw"
              ? "The AI draws automatically."
              : state.phase === "enemySetup"
                ? "The AI may play cards now."
                : state.phase === "enemyAttack"
                  ? "The AI may attack if it has the attack token."
                  : "";
  const phaseClass =
    state.phase === "playerBlock"
      ? "is-blocking-phase"
      : state.phase.startsWith("enemy")
        ? "is-ai-phase"
        : "is-player-phase";
  const enemyNexusHit = latestLog.includes("enemy Nexus");
  const playerNexusHit = latestLog.includes("your Nexus");
  const selectedAttackCost = selectedAttackers.length * ATTACK_MANA_COST;
  const canAffordSelectedAttack = selectedAttackCost <= state.players.player.mana;
  const brokenUnitName = state.lastDestroyedName ?? "";
  const canPlaySelected =
    state.phase === "playerSetup" &&
    selectedHandIndex !== null &&
    selectedCard !== undefined &&
    selectedCard.cost <= state.players.player.mana;

  const canAttack =
    state.phase === "playerAttack" &&
    state.attackToken === "player" &&
    !state.attackUsed &&
    state.players.player.board.some((unit) => !unit.stunned);

  const activeEnemyAttackers = useMemo(
    () =>
      state.activeAttack
        .map((pair) => state.players.enemy.board.find((unit) => unit.instanceId === pair.attackerId))
        .filter(Boolean),
    [state.activeAttack, state.players.enemy.board],
  );

  function toggleAttacker(unitId: string) {
    if (!canAttack) return;
    setSelectedAttackers((current) =>
      current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId],
    );
  }

  function assignBlocker(unitId: string) {
    if (state.phase !== "playerBlock" || !selectedEnemyAttacker) return;

    setBlockers((current) => {
      const next = { ...current };

      for (const attackerId of Object.keys(next)) {
        if (next[attackerId] === unitId) {
          delete next[attackerId];
        }
      }

      next[selectedEnemyAttacker] = unitId;
      return next;
    });
  }

  return (
    <main className={`board-screen ${phaseClass}`}>
      <section className="top-bar">
        <div className={`nexus nexus--enemy ${enemyNexusHit ? "is-hit" : ""}`}>
          <span>Enemy Nexus</span>
          <strong>{state.players.enemy.nexus}</strong>
        </div>
        <div className="round-panel" aria-live="polite">
          <span>Round {state.round}</span>
          <strong>{turnStatus}</strong>
          <small>{turnHint}</small>
          <div className={`attack-token ${state.attackToken === "player" ? "is-yours" : "is-enemy"}`}>
            Attack token: {state.attackToken === "player" ? "Yours" : "AI"}
          </div>
        </div>
        <div className={`nexus ${playerNexusHit ? "is-hit" : ""}`}>
          <span>Your Nexus</span>
          <strong>{state.players.player.nexus}</strong>
        </div>
      </section>

      <section className="turn-ribbon" aria-live="polite">
        <strong>{turnStatus}</strong>
        <span>{turnHint}</span>
      </section>

      {showPhaseBanner && (
        <section className={`phase-banner ${phaseClass}`} key={`${state.round}-${state.phase}`} aria-live="polite">
          <span>Round {state.round}</span>
          <strong>{turnStatus}</strong>
          <p>{turnHint}</p>
        </section>
      )}

      {state.lastPlayedName && (
        <div className="play-burst" key={state.playEventId} aria-hidden="true">
          <span>{state.lastPlayedName}</span>
        </div>
      )}

      <section className="enemy-zone">
        <div className="zone-heading">
          <span>Enemy Hand</span>
          <strong>{state.players.enemy.hand.length}</strong>
        </div>
        <div className="hand hand--enemy">
          {state.players.enemy.hand.map((cardId, index) => (
            <CardView key={`${cardId}-${index}`} hidden compact />
          ))}
        </div>
      </section>

      <section className="battlefield">
        <div className="board-row board-row--enemy">
          {state.players.enemy.board.map((unit) => {
            const isAttacking = state.activeAttack.some((pair) => pair.attackerId === unit.instanceId);
            return (
              <CardView
                key={unit.instanceId}
                unit={unit}
                compact
                selected={selectedEnemyAttacker === unit.instanceId || isAttacking}
                label={isAttacking ? "Attacking" : undefined}
                className={[
                  isAttacking ? "is-attacking is-attacking--enemy" : "",
                  latestLog.includes(unit.name) && latestLog.includes("deals") ? "is-damaged" : "",
                  unit.instanceId === state.lastPlayedInstanceId ? "is-played" : "",
                ].join(" ")}
                onClick={() => state.phase === "playerBlock" && setSelectedEnemyAttacker(unit.instanceId)}
              />
            );
          })}
        </div>

        <div className="combat-lane">
          {brokenUnitName && (
            <div className="break-burst" key={state.destructionEventId} aria-hidden="true">
              <span>{brokenUnitName}</span>
            </div>
          )}
          {state.phase === "playerBlock"
            ? activeEnemyAttackers.map((attacker) => (
                <button
                  className={`lane-marker ${selectedEnemyAttacker === attacker!.instanceId ? "is-selected" : ""} ${
                    blockers[attacker!.instanceId] ? "is-blocked" : "is-open"
                  }`}
                  key={attacker!.instanceId}
                  type="button"
                  onClick={() => setSelectedEnemyAttacker(attacker!.instanceId)}
                >
                  <span>{attacker!.name}</span>
                  <span className="attack-arrow attack-arrow--enemy" aria-hidden="true" />
                  <strong>{blockers[attacker!.instanceId] ? "Blocked" : "Open"}</strong>
                </button>
              ))
            : selectedAttackers.map((unitId) => {
                const unit = state.players.player.board.find((candidate) => candidate.instanceId === unitId);
                return unit ? (
                  <div className="lane-marker" key={unitId}>
                    <span>{unit.name}</span>
                    <span className="attack-arrow attack-arrow--player" aria-hidden="true" />
                    <strong>{ATTACK_MANA_COST} mana</strong>
                  </div>
                ) : null;
              })}
        </div>

        <div className="board-row">
          {state.players.player.board.map((unit) => (
            <CardView
              key={unit.instanceId}
              unit={unit}
              compact
              selected={selectedAttackers.includes(unit.instanceId) || Object.values(blockers).includes(unit.instanceId)}
              disabled={unit.stunned}
              label={Object.values(blockers).includes(unit.instanceId) ? "Blocking" : undefined}
              className={[
                selectedAttackers.includes(unit.instanceId) ? "is-attacking is-attacking--player" : "",
                Object.values(blockers).includes(unit.instanceId) ? "is-blocking" : "",
                latestLog.includes(unit.name) && latestLog.includes("deals") ? "is-damaged" : "",
                unit.instanceId === state.lastPlayedInstanceId ? "is-played" : "",
              ].join(" ")}
              onClick={() => (state.phase === "playerBlock" ? assignBlocker(unit.instanceId) : toggleAttacker(unit.instanceId))}
            />
          ))}
        </div>
      </section>

      <section className="player-panel">
        <aside className="resources">
          <div>
            <span>Mana</span>
            <strong>
              {state.players.player.mana}/{state.players.player.maxMana}
            </strong>
          </div>
          <div>
            <span>Deck</span>
            <strong>{state.players.player.deck.length}</strong>
          </div>
          <div className="graveyard-zone">
            <span>Graveyard</span>
            <strong>{state.players.player.graveyard.length}</strong>
          </div>
          <div>
            <span>Enemy Deck</span>
            <strong>{state.players.enemy.deck.length}</strong>
          </div>
          <div className="graveyard-zone">
            <span>Enemy Graveyard</span>
            <strong>{state.players.enemy.graveyard.length}</strong>
          </div>
        </aside>

        <div className="hand">
          {state.players.player.hand.map((cardId, index) => {
            const card = cardById.get(cardId);
            return (
              <CardView
                key={`${cardId}-${index}`}
                cardId={cardId}
                selected={selectedHandIndex === index}
                disabled={state.phase !== "playerSetup" || Boolean(card && card.cost > state.players.player.mana)}
                onClick={() => setSelectedHandIndex(index)}
              />
            );
          })}
        </div>

        <div className="controls">
          <button type="button" onClick={() => setState((current) => playCard(current, "player", selectedHandIndex ?? -1))} disabled={!canPlaySelected}>
            Play
          </button>
          <button type="button" onClick={() => setSelectedAttackers(state.players.player.board.filter((unit) => !unit.stunned).map((unit) => unit.instanceId))} disabled={!canAttack}>
            Attack
          </button>
          <button
            type="button"
            onClick={() =>
              setState((current) =>
                current.phase === "playerBlock"
                  ? resolveEnemyAttackBlocks(current, blockers)
                  : resolvePlayerAttack(current, selectedAttackers),
              )
            }
            disabled={!((state.phase === "playerAttack" && selectedAttackers.length > 0) || state.phase === "playerBlock")}
          >
            Confirm
          </button>
          <button type="button" onClick={() => setState((current) => endPlayerTurn(current))} disabled={!["playerSetup", "playerAttack"].includes(state.phase)}>
            {state.phase === "playerSetup" ? "Go to Attack" : "Pass Turn"}
          </button>
          {state.phase === "playerAttack" && selectedAttackers.length > 0 && (
            <div className={`attack-cost ${canAffordSelectedAttack ? "is-affordable" : "is-too-expensive"}`}>
              Attack cost: {selectedAttackCost} mana
            </div>
          )}
        </div>
      </section>

      <aside className="log-panel" aria-live="polite">
        <strong>Action Log</strong>
        {state.log.map((entry, index) => (
          <p className={index === 0 ? "is-latest" : ""} key={`${entry}-${index}`}>
            {entry}
          </p>
        ))}
      </aside>
    </main>
  );
}
