export type PlayerId = "player" | "enemy";

export type Faction = "Toyfire" | "Plushguard" | "Shadowbox" | "Gearforce";

export type CardRarity = "Common" | "Rare" | "Epic";

export type CardType = "Unit" | "Spell";

export type Keyword = "Quick" | "Guard" | "Strike" | "Last Breath";

export type EffectId =
  | "deal_enemy_nexus_1"
  | "deal_enemy_nexus_2"
  | "deal_enemy_nexus_3"
  | "deal_weakest_enemy_1"
  | "deal_weakest_enemy_2"
  | "deal_strongest_enemy_2"
  | "heal_ally_nexus_2"
  | "heal_ally_nexus_3"
  | "buff_weakest_ally_0_2"
  | "buff_all_allies_1_0"
  | "buff_random_ally_1_1"
  | "drain_enemy_nexus_1"
  | "drain_enemy_nexus_2"
  | "draw_1"
  | "draw_2"
  | "stun_strongest_enemy"
  | "last_breath_deal_1"
  | "last_breath_draw_1"
  | "strike_draw_1"
  | "strike_heal_nexus_1"
  | "strike_deal_nexus_1";

export interface BaseCard {
  id: string;
  name: string;
  faction: Faction;
  type: CardType;
  cost: number;
  rarity: CardRarity;
  description: string;
  effect?: EffectId;
}

export interface UnitCard extends BaseCard {
  type: "Unit";
  attack: number;
  health: number;
  keywords?: Keyword[];
}

export interface SpellCard extends BaseCard {
  type: "Spell";
}

export type Card = UnitCard | SpellCard;

export interface UnitInstance {
  instanceId: string;
  cardId: string;
  owner: PlayerId;
  name: string;
  faction: Faction;
  rarity: CardRarity;
  description: string;
  attack: number;
  health: number;
  damage: number;
  keywords: Keyword[];
  effect?: EffectId;
  stunned: boolean;
}

export interface PlayerState {
  id: PlayerId;
  nexus: number;
  deck: string[];
  hand: string[];
  graveyard: string[];
  board: UnitInstance[];
  mana: number;
  maxMana: number;
}

export type GamePhase =
  | "playerDraw"
  | "playerSetup"
  | "playerAttack"
  | "enemyDraw"
  | "enemySetup"
  | "enemyAttack"
  | "playerBlock"
  | "gameOver";

export interface CombatPair {
  attackerId: string;
  blockerId?: string;
}

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  round: number;
  attackToken: PlayerId;
  phase: GamePhase;
  attackUsed: boolean;
  activeAttack: CombatPair[];
  winner?: PlayerId;
  gameOverReason?: string;
  log: string[];
  nextInstanceNumber: number;
  lastDestroyedName?: string;
  destructionEventId: number;
  lastPlayedName?: string;
  lastPlayedInstanceId?: string;
  playEventId: number;
  selectedDeckName: string;
}

export interface StarterDeck {
  id: string;
  name: string;
  factionFocus: string;
  description: string;
  cards: string[];
}
