export interface NpcDef {
  id: string;
  nameKey: string;
  greetingKey: string;
  topics: string[];
  replies: Record<string, string>;
  x: number;
  z: number;
  kind: "priest" | "envoy" | "merchant" | "innkeep" | "smith" | "guard";
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
        topics: ["foxbrand", "farewell"],
        replies: {
          foxbrand: "dlg.smith.foxbrand",
        },
        x: 10,
        z: 7,
        kind: "smith",
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
      { id: "bowyer", labelKey: "skill.bows", x: 8, z: 2, w: 5, d: 4, h: 3.5, texture: "timber" },
      { id: "gate", labelKey: "ui.travel", x: 0, z: 12, w: 8, d: 2, h: 4, texture: "bark", interact: "travel" },
    ],
    npcs: [
      {
        id: "npc_leaf_elder",
        nameKey: "npc.envoy.name",
        greetingKey: "npc.envoy.greeting",
        topics: ["pactcinder", "war", "farewell"],
        replies: {
          pactcinder: "dlg.envoy.pactcinder",
          war: "dlg.envoy.war",
        },
        x: 0,
        z: -6,
        kind: "envoy",
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
      { id: "black_market", labelKey: "npc.merchant.name", x: -6, z: 2, w: 5, d: 4, h: 3, texture: "stone", interact: "npc_mirehold_buyer" },
      { id: "cellar_door", labelKey: "place.cult_cellars", x: 8, z: 4, w: 3, d: 3, h: 2, texture: "cult", interact: "dungeon_cult" },
      { id: "gate", labelKey: "ui.travel", x: 0, z: 12, w: 8, d: 2, h: 4, texture: "stone", interact: "travel" },
    ],
    npcs: [
      {
        id: "npc_mirehold_buyer",
        nameKey: "npc.merchant.name",
        greetingKey: "npc.merchant.greeting",
        topics: ["pactcinder", "farewell"],
        replies: { pactcinder: "dlg.merchant.pactcinder" },
        x: -6,
        z: 3,
        kind: "merchant",
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
        nameKey: "npc.smith.name",
        greetingKey: "npc.smith.greeting",
        topics: ["pactcinder", "farewell"],
        replies: { pactcinder: "dlg.envoy.pactcinder" },
        x: 0,
        z: -6,
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
