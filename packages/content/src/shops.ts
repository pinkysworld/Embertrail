/** Town shop inventories and services for Embertrail MVP */

export interface ShopStockItem {
  itemId: string;
  /** Available stock; -1 = unlimited */
  qty: number;
  /** Override list price in copper; defaults to ITEMS[itemId].valueCopper */
  priceCopper?: number;
}

export interface ShopService {
  id: string;
  nameKey: string;
  priceCopper: number;
  kind: "heal" | "upgrade";
}

export interface ShopDef {
  id: string;
  nameKey: string;
  kind: "goods" | "service" | "upgrade";
  stock?: ShopStockItem[];
  services?: ShopService[];
}

export const SHOPS: Record<string, ShopDef[]> = {
  rimeport: [
    {
      id: "smith",
      nameKey: "shop.rimeport.smith",
      kind: "goods",
      stock: [
        { itemId: "longsword", qty: 2 },
        { itemId: "shortsword", qty: 3 },
        { itemId: "battle_axe", qty: 1 },
        { itemId: "warhammer", qty: 1 },
        { itemId: "boots", qty: 5 },
        { itemId: "wooden_shield", qty: 3 },
        { itemId: "leather_armor", qty: 2 },
      ],
    },
    {
      id: "general",
      nameKey: "shop.rimeport.general",
      kind: "goods",
      stock: [
        { itemId: "ration", qty: 50 },
        { itemId: "rations_pack", qty: 5 },
        { itemId: "potion_heal", qty: 8 },
        { itemId: "potion_focus", qty: 4 },
        { itemId: "herb_woundwort", qty: 10 },
        { itemId: "herb_frostleaf", qty: 6 },
      ],
    },
    {
      id: "temple",
      nameKey: "shop.rimeport.temple",
      kind: "service",
      services: [
        {
          id: "heal_wounds",
          nameKey: "shop.service.heal",
          priceCopper: 50,
          kind: "heal",
        },
      ],
    },
  ],

  oakspire: [
    {
      id: "bowyer",
      nameKey: "shop.oakspire.bowyer",
      kind: "goods",
      stock: [
        { itemId: "shortbow", qty: 3 },
        { itemId: "arrows", qty: 100 },
        { itemId: "throwing_knives", qty: 5 },
        { itemId: "boots", qty: 3 },
      ],
    },
    {
      id: "herbs",
      nameKey: "shop.oakspire.herbs",
      kind: "goods",
      stock: [
        { itemId: "herb_woundwort", qty: 15 },
        { itemId: "herb_frostleaf", qty: 12 },
        { itemId: "herb_emberroot", qty: 8 },
        { itemId: "herb_pouch", qty: 3 },
        { itemId: "potion_heal", qty: 6 },
      ],
    },
  ],

  mirehold: [
    {
      id: "black_market",
      nameKey: "shop.mirehold.black_market",
      kind: "goods",
      stock: [
        { itemId: "potion_heal", qty: 10, priceCopper: 100 },
        { itemId: "potion_focus", qty: 8, priceCopper: 110 },
        { itemId: "lockpicks", qty: 5 },
        { itemId: "throwing_knives", qty: 4, priceCopper: 150 },
      ],
    },
  ],

  irondeep: [
    {
      id: "forge",
      nameKey: "shop.irondeep.forge",
      kind: "upgrade",
      stock: [
        { itemId: "battle_axe", qty: 2 },
        { itemId: "warhammer", qty: 2 },
        { itemId: "longsword", qty: 1 },
        { itemId: "wooden_shield", qty: 2 },
      ],
      services: [
        {
          id: "upgrade_weapon",
          nameKey: "shop.service.upgrade_weapon",
          priceCopper: 200,
          kind: "upgrade",
        },
      ],
    },
  ],
};

export function getShop(townId: string, shopId: string): ShopDef | undefined {
  return SHOPS[townId]?.find((s) => s.id === shopId);
}
