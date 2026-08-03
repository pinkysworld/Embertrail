/** Shared types and network protocol for Embertrail */

export type Locale = "en" | "de";

export type AttributeId =
  | "cou"
  | "cle"
  | "int"
  | "cha"
  | "dex"
  | "agi"
  | "con"
  | "str";

export type NegativeTraitId =
  | "superstition"
  | "acrophobia"
  | "claustrophobia"
  | "avarice"
  | "necrophobia"
  | "curiosity"
  | "violentTemper";

export type ArchetypeId =
  | "steelguard"
  | "seafarer"
  | "stonekin"
  | "shadowhand"
  | "trickster"
  | "hexweaver"
  | "wildcaller"
  | "magister"
  | "pathfinder"
  | "leafborn"
  | "grovekin"
  | "frostborn";

export type SkillCategory =
  | "combat"
  | "body"
  | "social"
  | "lore"
  | "craft"
  | "nature"
  | "perception";

export type MagicSchool =
  | "elemental"
  | "healing"
  | "illusion"
  | "mind"
  | "nature"
  | "battle";

export type WeatherId = "clear" | "clouds" | "rain" | "snow" | "fog" | "blizzard";

export type GameMode = "explore" | "travel" | "combat" | "dialogue" | "camp" | "character";

export interface Attributes {
  cou: number;
  cle: number;
  int: number;
  cha: number;
  dex: number;
  agi: number;
  con: number;
  str: number;
}

export interface NegativeTraits {
  superstition: number;
  acrophobia: number;
  claustrophobia: number;
  avarice: number;
  necrophobia: number;
  curiosity: number;
  violentTemper: number;
}

export interface SkillDef {
  id: string;
  category: SkillCategory;
  attribute: AttributeId;
  nameKey: string;
}

export interface ItemStack {
  itemId: string;
  qty: number;
  durability?: number;
  quality?: number;
}

export interface EquippedSlots {
  mainHand?: string;
  offHand?: string;
  armor?: string;
  head?: string;
  boots?: string;
  amulet?: string;
  ring1?: string;
  ring2?: string;
  belt?: string;
}

export interface CharacterSheet {
  id: string;
  accountId: string;
  name: string;
  gender: "m" | "f";
  archetype: ArchetypeId;
  level: number;
  exp: number;
  expToNext: number;
  attributes: Attributes;
  negatives: NegativeTraits;
  skills: Record<string, number>;
  spells: Record<string, number>;
  schoolFocus?: MagicSchool;
  life: number;
  lifeMax: number;
  focus: number;
  focusMax: number;
  atBase: number;
  paBase: number;
  inventory: ItemStack[];
  equipped: EquippedSlots;
  gold: number;
  silver: number;
  copper: number;
  rations: number;
  diseases: string[];
  portraitId: string;
  position: {
    townId?: string;
    dungeonId?: string;
    /** Current dungeon room id (solo continue) */
    roomId?: string;
    /** Last town before dungeon/overland (exit restore) */
    lastTownId?: string;
    /** Current map node on the overland graph (town, road, crossroads) */
    mapNodeId?: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
  };
  /** Campaign day counter (Schicksalsklinge-style calendar) */
  travelDay?: number;
  questFlags: Record<string, number | boolean | string>;
  journal: JournalEntry[];
  knownMapNodes: string[];
}

export interface JournalEntry {
  id: string;
  questId?: string;
  titleKey: string;
  bodyKey: string;
  timestamp: number;
  clue?: boolean;
}

export interface PartyState {
  id: string;
  leaderId: string;
  memberIds: string[];
}

export interface ChatMessage {
  channel: "local" | "party" | "global";
  from: string;
  text: string;
  at: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Network messages */
export type ClientMessage =
  | { type: "auth"; token: string }
  | { type: "join_hub"; townId: string }
  | { type: "move"; x: number; y: number; z: number; yaw: number }
  | { type: "chat"; channel: ChatMessage["channel"]; text: string }
  | { type: "interact"; targetId: string }
  | { type: "dialogue_topic"; npcId: string; topic: string }
  | { type: "party_invite"; targetId: string }
  | { type: "party_accept"; partyId: string }
  | { type: "party_leave" }
  | { type: "start_travel"; from: string; to: string }
  | { type: "camp_action"; action: string; payload?: Record<string, unknown> }
  | { type: "enter_dungeon"; dungeonId: string }
  | { type: "combat_action"; action: CombatAction }
  | { type: "skill_check"; skillId: string; dc: number; context?: string };

export type CombatAction =
  | { kind: "move"; x: number; y: number }
  | { kind: "attack"; targetId: string }
  | { kind: "cast"; spellId: string; targetId?: string; x?: number; y?: number }
  | { kind: "item"; itemId: string; targetId?: string }
  | { kind: "defend" }
  | { kind: "flee" }
  | { kind: "wait" };

export type ServerMessage =
  | { type: "welcome"; character: CharacterSheet; serverTime: number }
  | { type: "error"; message: string }
  | { type: "hub_state"; townId: string; players: HubPlayer[]; timeOfDay: number; weather: WeatherId }
  | { type: "player_moved"; id: string; x: number; y: number; z: number; yaw: number }
  | { type: "player_joined"; player: HubPlayer }
  | { type: "player_left"; id: string }
  | { type: "chat"; message: ChatMessage }
  | { type: "dialogue"; npcId: string; textKey: string; topics: string[] }
  | { type: "party_update"; party: PartyState | null }
  | { type: "travel_update"; state: TravelState }
  | { type: "combat_start"; state: CombatState }
  | { type: "combat_update"; state: CombatState }
  | { type: "combat_end"; result: "victory" | "defeat" | "fled"; loot: ItemStack[]; exp: number }
  | { type: "character_update"; character: Partial<CharacterSheet> }
  | { type: "notification"; kind: "info" | "warn" | "loot" | "skill" | "quest"; textKey: string; args?: Record<string, string | number> }
  | { type: "dungeon_state"; dungeonId: string; roomId: string; flags: Record<string, boolean> };

export interface HubPlayer {
  id: string;
  name: string;
  archetype: ArchetypeId;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface TravelState {
  from: string;
  to: string;
  progress: number;
  day: number;
  weather: WeatherId;
  partyFatigue: number;
  event?: TravelEvent;
  camping: boolean;
}

export interface TravelEvent {
  id: string;
  kind: "combat" | "skill" | "story" | "weather" | "discovery";
  textKey: string;
  choices?: { id: string; labelKey: string; skillId?: string }[];
}

export interface Combatant {
  id: string;
  name: string;
  side: "party" | "enemy";
  x: number;
  y: number;
  life: number;
  lifeMax: number;
  focus: number;
  focusMax: number;
  at: number;
  pa: number;
  initiative: number;
  portraitId?: string;
  enemyType?: string;
  status: string[];
  isPlayer?: boolean;
  characterId?: string;
}

export interface CombatState {
  id: string;
  width: number;
  height: number;
  blocked: Array<{ x: number; y: number }>;
  combatants: Combatant[];
  turnOrder: string[];
  activeId: string;
  round: number;
  log: string[];
}

export const PORTS = {
  client: 5173,
  server: 2567,
  api: 3000,
} as const;

export const MAX_PARTY = 6;
export const HUB_SOFT_CAP = 50;
