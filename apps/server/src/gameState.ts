import type { CharacterSheet, CombatState, PartyState, HubPlayer } from "@embertrail/shared";
import { saveCharacter } from "./db.js";

/** In-memory live session state */
export const liveCharacters = new Map<string, CharacterSheet>();
export const parties = new Map<string, PartyState>();
export const combats = new Map<string, CombatState>();
export const hubPlayers = new Map<string, Map<string, HubPlayer>>(); // townId -> players

export function setLive(sheet: CharacterSheet): void {
  liveCharacters.set(sheet.id, sheet);
  saveCharacter(sheet);
}

export function getLive(id: string): CharacterSheet | undefined {
  return liveCharacters.get(id);
}

export function patchLive(id: string, patch: Partial<CharacterSheet>): CharacterSheet | undefined {
  const cur = liveCharacters.get(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch };
  if (patch.inventory) next.inventory = patch.inventory;
  if (patch.questFlags) next.questFlags = { ...cur.questFlags, ...patch.questFlags };
  if (patch.journal) next.journal = patch.journal;
  if (patch.position) next.position = { ...cur.position, ...patch.position };
  if (patch.equipped) next.equipped = { ...cur.equipped, ...patch.equipped };
  liveCharacters.set(id, next);
  saveCharacter(next);
  return next;
}
