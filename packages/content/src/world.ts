export interface NpcDef {
  id: string;
  nameKey: string;
  greetingKey: string;
  topics: string[];
  replies: Record<string, string>;
  x: number;
  z: number;
  kind:
    | "priest"
    | "envoy"
    | "merchant"
    | "innkeep"
    | "smith"
    | "guard"
    | "bowyer"
    | "fisher"
    | "scout"
    | "refugee"
    | "beggar"
    | "miner"
    | "herbalist";
}

export interface BuildingDef {
  id: string;
  labelKey: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  texture: string;
  interact?: string;
}

export interface TownDef {
  id: string;
  nameKey: string;
  buildings: BuildingDef[];
  npcs: NpcDef[];
  spawn: { x: number; y: number; z: number; yaw: number };
  ground: string;
}

export const TOWNS: Record<string, TownDef> = {
  rimeport: {
    id: "rimeport",
    nameKey: "place.rimeport",
    spawn: { x: 0, y: 1.6, z: 10, yaw: 0 },
    ground: "cobble",
    buildings: [
      { id: "temple", labelKey: "topic.temple", x: -8, z: -6, w: 8, d: 8, h: 6, texture: "stone", interact: "npc_priestess" },
      { id: "tavern", labelKey: "npc.innkeep.name", x: 8, z: -4, w: 7, d: 6, h: 4, texture: "timber", interact: "npc_innkeep" },
      {
        id: "quest_board",
        labelKey: "place.quest_board",
        x: 5.5,
        z: -2,
        w: 2,
        d: 1.2,
        h: 2.4,
        texture: "timber",
        interact: "quest_board",
      },
      { id: "smithy", labelKey: "npc.smith.name", x: 10, z: 6, w: 5, d: 5, h: 3.5, texture: "stone", interact: "npc_smith" },
      { id: "gate", labelKey: "ui.travel", x: 0, z: 16, w: 10, d: 2, h: 5, texture: "stone", interact: "travel" },
      { id: "market", labelKey: "npc.merchant.name", x: -10, z: 4, w: 6, d: 4, h: 3, texture: "timber", interact: "npc_merchant" },
      { id: "envoy_camp", labelKey: "npc.envoy.name", x: 4, z: 12, w: 3, d: 3, h: 2.5, texture: "bark", interact: "npc_envoy" },
    ],
    npcs: [
      {
        id: "npc_priestess",
        nameKey: "npc.priestess.name",
        greetingKey: "npc.priestess.greeting",
        topics: ["pactcinder", "war", "temple", "farewell"],
        replies: {
          pactcinder: "dlg.priestess.pactcinder",
          war: "dlg.priestess.war",
          temple: "dlg.priestess.temple",
        },
        x: -8,
        z: -4,
        kind: "priest",
      },
      {
        id: "npc_envoy",
        nameKey: "npc.envoy.name",
        greetingKey: "npc.envoy.greeting",
        topics: ["pactcinder", "mine", "war", "farewell"],
        replies: {
          pactcinder: "dlg.envoy.pactcinder",
          mine: "dlg.envoy.mine",
          war: "dlg.envoy.war",
        },
        x: 4,
        z: 11,
        kind: "envoy",
      },
      {
        id: "npc_merchant",
        nameKey: "npc.merchant.name",
        greetingKey: "npc.merchant.greeting",
        topics: ["pactcinder", "mirehold", "farewell"],
        replies: {
          pactcinder: "dlg.merchant.pactcinder",
          mirehold: "dlg.merchant.mirehold",
        },
        x: -10,
        z: 5,
        kind: "merchant",
      },
      {
        id: "npc_innkeep",
        nameKey: "npc.innkeep.name",
        greetingKey: "npc.innkeep.greeting",
        topics: ["rumors", "mine", "farewell"],
        replies: {
          rumors: "dlg.innkeep.rumors",
          mine: "dlg.innkeep.mine",
        },
        x: 8,
        z: -2,
        kind: "innkeep",
      },
      {
        id: "npc_smith",
        nameKey: "npc.smith.name",
        greetingKey: "npc.smith.greeting",
        topics: ["foxbrand", "rumors", "farewell"],
        replies: {
          foxbrand: "dlg.smith.foxbrand",
          rumors: "dlg.smith.rumors",
        },
        x: 10,
        z: 7,
        kind: "smith",
      },
      {
        id: "npc_guard_gate",
        nameKey: "npc.guard_gate.name",
        greetingKey: "npc.guard_gate.greeting",
        topics: ["war", "roads", "farewell"],
        replies: {
          war: "dlg.guard_gate.war",
          roads: "dlg.guard_gate.roads",
        },
        x: -3,
        z: 15,
        kind: "guard",
      },
      {
        id: "npc_guard_square",
        nameKey: "npc.guard_square.name",
        greetingKey: "npc.guard_square.greeting",
        topics: ["rumors", "roads", "farewell"],
        replies: {
          rumors: "dlg.guard_square.rumors",
          roads: "dlg.guard_square.roads",
        },
        x: 2,
        z: 3,
        kind: "guard",
      },
      {
        id: "npc_fisher",
        nameKey: "npc.fisher.name",
        greetingKey: "npc.fisher.greeting",
        topics: ["harbor", "rumors", "farewell"],
        replies: {
          harbor: "dlg.fisher.harbor",
          rumors: "dlg.fisher.rumors",
        },
        x: -5,
        z: 18,
        kind: "fisher",
      },
      {
        id: "npc_refugee",
        nameKey: "npc.refugee.name",
        greetingKey: "npc.refugee.greeting",
        topics: ["war", "mirehold", "farewell"],
        replies: {
          war: "dlg.refugee.war",
          mirehold: "dlg.refugee.mirehold",
        },
        x: -12,
        z: -2,
        kind: "refugee",
      },
      {
        id: "npc_beggar",
        nameKey: "npc.beggar.name",
        greetingKey: "npc.beggar.greeting",
        topics: ["rumors", "pactcinder", "farewell"],
        replies: {
          rumors: "dlg.beggar.rumors",
          pactcinder: "dlg.beggar.pactcinder",
        },
        x: 6,
        z: 8,
        kind: "beggar",
      },
    ],
  },
  oakspire: {
    id: "oakspire",
    nameKey: "place.oakspire",
    spawn: { x: 0, y: 1.6, z: 6, yaw: 0 },
    ground: "grass",
    buildings: [
      { id: "grove_hall", labelKey: "place.oakspire", x: 0, z: -8, w: 10, d: 8, h: 7, texture: "bark", interact: "npc_leaf_elder" },
      { id: "bowyer", labelKey: "npc.bowyer.name", x: 8, z: 2, w: 5, d: 4, h: 3.5, texture: "timber", interact: "npc_bowyer" },
      { id: "herb_hut", labelKey: "npc.herbalist.name", x: -8, z: 2, w: 4, d: 4, h: 3, texture: "bark", interact: "npc_herbalist" },
      { id: "gate", labelKey: "ui.travel", x: 0, z: 12, w: 8, d: 2, h: 4, texture: "bark", interact: "travel" },
    ],
    npcs: [
      {
        id: "npc_leaf_elder",
        nameKey: "npc.leaf_elder.name",
        greetingKey: "npc.leaf_elder.greeting",
        topics: ["pactcinder", "war", "herbs", "farewell"],
        replies: {
          pactcinder: "dlg.leaf_elder.pactcinder",
          war: "dlg.leaf_elder.war",
          herbs: "dlg.leaf_elder.herbs",
        },
        x: 0,
        z: -6,
        kind: "envoy",
      },
      {
        id: "npc_bowyer",
        nameKey: "npc.bowyer.name",
        greetingKey: "npc.bowyer.greeting",
        topics: ["roads", "war", "farewell"],
        replies: {
          roads: "dlg.bowyer.roads",
          war: "dlg.bowyer.war",
        },
        x: 8,
        z: 3,
        kind: "bowyer",
      },
      {
        id: "npc_herbalist",
        nameKey: "npc.herbalist.name",
        greetingKey: "npc.herbalist.greeting",
        topics: ["herbs", "rumors", "farewell"],
        replies: {
          herbs: "dlg.herbalist.herbs",
          rumors: "dlg.herbalist.rumors",
        },
        x: -8,
        z: 3,
        kind: "herbalist",
      },
      {
        id: "npc_oak_scout",
        nameKey: "npc.oak_scout.name",
        greetingKey: "npc.oak_scout.greeting",
        topics: ["roads", "war", "farewell"],
        replies: {
          roads: "dlg.oak_scout.roads",
          war: "dlg.oak_scout.war",
        },
        x: 3,
        z: 10,
        kind: "scout",
      },
      {
        id: "npc_oak_guard",
        nameKey: "npc.oak_guard.name",
        greetingKey: "npc.oak_guard.greeting",
        topics: ["temple", "farewell"],
        replies: { temple: "dlg.oak_guard.grove" },
        x: -3,
        z: 11,
        kind: "guard",
      },
    ],
  },
  mirehold: {
    id: "mirehold",
    nameKey: "place.mirehold",
    spawn: { x: 0, y: 1.6, z: 6, yaw: 0 },
    ground: "mud",
    buildings: [
      { id: "barricade", labelKey: "place.mirehold", x: 0, z: -6, w: 12, d: 3, h: 4, texture: "timber" },
      { id: "black_market", labelKey: "npc.mirehold_buyer.name", x: -6, z: 2, w: 5, d: 4, h: 3, texture: "stone", interact: "npc_mirehold_buyer" },
      { id: "cellar_door", labelKey: "place.cult_cellars", x: 8, z: 4, w: 3, d: 3, h: 2, texture: "cult", interact: "dungeon_cult" },
      { id: "gate", labelKey: "ui.travel", x: 0, z: 12, w: 8, d: 2, h: 4, texture: "stone", interact: "travel" },
    ],
    npcs: [
      {
        id: "npc_mirehold_buyer",
        nameKey: "npc.mirehold_buyer.name",
        greetingKey: "npc.mirehold_buyer.greeting",
        topics: ["pactcinder", "war", "farewell"],
        replies: {
          pactcinder: "dlg.mirehold_buyer.pactcinder",
          war: "dlg.mirehold_buyer.war",
        },
        x: -6,
        z: 3,
        kind: "merchant",
      },
      {
        id: "npc_mire_captain",
        nameKey: "npc.mire_captain.name",
        greetingKey: "npc.mire_captain.greeting",
        topics: ["war", "roads", "farewell"],
        replies: {
          war: "dlg.mire_captain.war",
          roads: "dlg.mire_captain.roads",
        },
        x: 2,
        z: -4,
        kind: "guard",
      },
      {
        id: "npc_mire_refugee",
        nameKey: "npc.mire_refugee.name",
        greetingKey: "npc.mire_refugee.greeting",
        topics: ["war", "rumors", "farewell"],
        replies: {
          war: "dlg.mire_refugee.war",
          rumors: "dlg.mire_refugee.rumors",
        },
        x: -4,
        z: 8,
        kind: "refugee",
      },
      {
        id: "npc_mire_scout",
        nameKey: "npc.mire_scout.name",
        greetingKey: "npc.mire_scout.greeting",
        topics: ["cult", "roads", "farewell"],
        replies: {
          cult: "dlg.mire_scout.cult",
          roads: "dlg.mire_scout.roads",
        },
        x: 7,
        z: 5,
        kind: "scout",
      },
    ],
  },
  irondeep: {
    id: "irondeep",
    nameKey: "place.irondeep",
    spawn: { x: 0, y: 1.6, z: 6, yaw: 0 },
    ground: "flagstone",
    buildings: [
      { id: "forge_hall", labelKey: "place.irondeep", x: 0, z: -8, w: 12, d: 8, h: 5, texture: "dwarf_stone", interact: "npc_deep_envoy" },
      { id: "crypt_door", labelKey: "place.ice_crypt", x: 10, z: 2, w: 4, d: 4, h: 3, texture: "ice", interact: "dungeon_crypt" },
      { id: "gate", labelKey: "ui.travel", x: 0, z: 12, w: 8, d: 2, h: 4, texture: "dwarf_stone", interact: "travel" },
    ],
    npcs: [
      {
        id: "npc_deep_envoy",
        nameKey: "npc.deep_envoy.name",
        greetingKey: "npc.deep_envoy.greeting",
        topics: ["pactcinder", "war", "farewell"],
        replies: {
          pactcinder: "dlg.deep_envoy.pactcinder",
          war: "dlg.deep_envoy.war",
        },
        x: 0,
        z: -6,
        kind: "smith",
      },
      {
        id: "npc_deep_miner",
        nameKey: "npc.deep_miner.name",
        greetingKey: "npc.deep_miner.greeting",
        topics: ["mine", "rumors", "farewell"],
        replies: {
          mine: "dlg.deep_miner.mine",
          rumors: "dlg.deep_miner.rumors",
        },
        x: -6,
        z: 2,
        kind: "miner",
      },
      {
        id: "npc_deep_guard",
        nameKey: "npc.deep_guard.name",
        greetingKey: "npc.deep_guard.greeting",
        topics: ["roads", "farewell"],
        replies: { roads: "dlg.deep_guard.roads" },
        x: 2,
        z: 11,
        kind: "guard",
      },
      {
        id: "npc_deep_smith",
        nameKey: "npc.deep_smith.name",
        greetingKey: "npc.deep_smith.greeting",
        topics: ["foxbrand", "rumors", "farewell"],
        replies: {
          foxbrand: "dlg.deep_smith.foxbrand",
          rumors: "dlg.deep_smith.rumors",
        },
        x: 5,
        z: -4,
        kind: "smith",
      },
    ],
  },
};

export interface DungeonRoomDef {
  id: string;
  nameKey: string;
  introKey: string;
  width: number;
  depth: number;
  wallTexture: string;
  floorTexture: string;
  encounters: Array<{ type: string; count: number; x: number; z: number }>;
  features: Array<{
    id: string;
    kind: "door" | "chest" | "greed" | "boss" | "exit" | "puzzle";
    x: number;
    z: number;
    data?: Record<string, string | number | boolean>;
  }>;
}

export interface DungeonDef {
  id: string;
  nameKey: string;
  rooms: DungeonRoomDef[];
  entryTown?: string;
}

export const DUNGEONS: Record<string, DungeonDef> = {
  mine_ash: {
    id: "mine_ash",
    nameKey: "place.mine_ash",
    entryTown: "rimeport",
    rooms: [
      {
        id: "mine_entry",
        nameKey: "place.mine_ash",
        introKey: "dungeon.mine.intro",
        width: 24,
        depth: 30,
        wallTexture: "dwarf_stone",
        floorTexture: "gravel",
        encounters: [{ type: "cave_beast", count: 2, x: 4, z: -8 }],
        features: [
          { id: "to_deep", kind: "door", x: 0, z: -14, data: { to: "mine_deep" } },
          { id: "exit", kind: "exit", x: 0, z: 12 },
        ],
      },
      {
        id: "mine_deep",
        nameKey: "place.mine_ash",
        introKey: "dungeon.mine.greed",
        width: 20,
        depth: 24,
        wallTexture: "dwarf_stone",
        floorTexture: "ember_ash",
        encounters: [{ type: "orc_raider", count: 2, x: -3, z: -4 }],
        features: [
          { id: "greed_pile", kind: "greed", x: 0, z: -8 },
          { id: "to_boss", kind: "door", x: 0, z: -11, data: { to: "mine_boss" } },
          { id: "back", kind: "door", x: 0, z: 10, data: { to: "mine_entry" } },
        ],
      },
      {
        id: "mine_boss",
        nameKey: "place.mine_ash",
        introKey: "dungeon.mine.boss",
        width: 16,
        depth: 16,
        wallTexture: "cult",
        floorTexture: "lava_ash",
        encounters: [{ type: "ash_guardian", count: 1, x: 0, z: -4 }],
        features: [
          { id: "pactcinder_chest", kind: "boss", x: 0, z: -6, data: { loot: "pactcinder" } },
          { id: "back", kind: "door", x: 0, z: 6, data: { to: "mine_deep" } },
        ],
      },
    ],
  },
  cult_cellars: {
    id: "cult_cellars",
    nameKey: "place.cult_cellars",
    entryTown: "mirehold",
    rooms: [
      {
        id: "cellar_1",
        nameKey: "place.cult_cellars",
        introKey: "dungeon.cellars.intro",
        width: 22,
        depth: 22,
        wallTexture: "cult",
        floorTexture: "lava_ash",
        encounters: [
          { type: "cultist", count: 2, x: 3, z: -5 },
          { type: "undead", count: 1, x: -4, z: -6 },
        ],
        features: [
          { id: "ice_puzzle", kind: "puzzle", x: 0, z: -8, data: { need: "melt_ice" } },
          { id: "to_rite", kind: "door", x: 0, z: -10, data: { to: "cellar_rite" } },
          { id: "exit", kind: "exit", x: 0, z: 9 },
        ],
      },
      {
        id: "cellar_rite",
        nameKey: "place.cult_cellars",
        introKey: "dungeon.cellars.rite",
        width: 18,
        depth: 18,
        wallTexture: "cult",
        floorTexture: "ember_ash",
        encounters: [
          { type: "cultist", count: 2, x: -3, z: -4 },
          { type: "undead", count: 2, x: 4, z: -5 },
        ],
        features: [
          { id: "sigil", kind: "chest", x: 0, z: -7, data: { loot: "cult_sigil" } },
          { id: "rite_cache", kind: "chest", x: 5, z: 2, data: { loot: "herb_emberroot" } },
          { id: "back", kind: "door", x: 0, z: 7, data: { to: "cellar_1" } },
        ],
      },
    ],
  },
  ice_crypt: {
    id: "ice_crypt",
    nameKey: "place.ice_crypt",
    entryTown: "irondeep",
    rooms: [
      {
        id: "crypt_hall",
        nameKey: "place.ice_crypt",
        introKey: "dungeon.crypt.intro",
        width: 26,
        depth: 26,
        wallTexture: "ice",
        floorTexture: "snow",
        encounters: [
          { type: "frost_wight", count: 1, x: 0, z: -8 },
          { type: "cultist", count: 2, x: 4, z: -3 },
        ],
        features: [
          { id: "to_barrow", kind: "door", x: 0, z: -12, data: { to: "crypt_barrow" } },
          { id: "frost_cache", kind: "chest", x: -6, z: 2, data: { loot: "herb_frostleaf" } },
          { id: "exit", kind: "exit", x: 0, z: 10 },
        ],
      },
      {
        id: "crypt_barrow",
        nameKey: "place.ice_crypt",
        introKey: "dungeon.crypt.barrow",
        width: 18,
        depth: 20,
        wallTexture: "ice",
        floorTexture: "snow",
        encounters: [
          { type: "frost_wight", count: 1, x: 0, z: -6 },
          { type: "undead", count: 2, x: -4, z: -3 },
        ],
        features: [
          { id: "finale", kind: "boss", x: 0, z: -8, data: { loot: "foxbrand_axe" } },
          { id: "back", kind: "door", x: 0, z: 8, data: { to: "crypt_hall" } },
        ],
      },
    ],
  },
};
