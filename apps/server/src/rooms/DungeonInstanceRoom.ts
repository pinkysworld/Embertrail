/**
 * Party dungeon instance: shared FP exploration + shared combat.
 * Leader creates room with partyId; members join with same options.
 */
import { Room, type Client } from "@colyseus/core";
import { randomUUID } from "node:crypto";
import type { CharacterSheet, CombatState, ChatMessage } from "@embertrail/shared";
import { DUNGEONS } from "@embertrail/content";
import {
  startCombat,
  combatantFromCharacter,
  makeEnemy,
  applyCombatAction,
  enemyAiAction,
  applyLevelUp,
} from "@embertrail/rules";
import { getLive, patchLive, parties, setLive, combats } from "../gameState.js";

interface JoinOpts {
  character: CharacterSheet;
  dungeonId: string;
  partyId?: string;
  roomId?: string;
}

interface MemberPos {
  id: string;
  name: string;
  archetype: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export class DungeonInstanceRoom extends Room {
  dungeonId = "mine_ash";
  roomId = "mine_entry";
  partyId: string | null = null;
  members = new Map<string, MemberPos>(); // charId -> pos
  charBySession = new Map<string, string>();
  combatId: string | null = null;
  flags: Record<string, boolean> = {};

  onCreate(options: { dungeonId?: string; partyId?: string; roomId?: string }): void {
    this.dungeonId = options.dungeonId || "mine_ash";
    this.partyId = options.partyId || null;
    const dungeon = DUNGEONS[this.dungeonId];
    this.roomId = options.roomId || dungeon?.rooms[0]?.id || "mine_entry";
    this.setMetadata({ dungeonId: this.dungeonId, partyId: this.partyId });
    this.maxClients = 6;

    this.onMessage("move", (client, msg: { x: number; y: number; z: number; yaw: number }) => {
      const charId = this.charBySession.get(client.sessionId);
      if (!charId || this.combatId) return;
      const m = this.members.get(charId);
      if (!m) return;
      m.x = msg.x;
      m.y = msg.y;
      m.z = msg.z;
      m.yaw = msg.yaw;
      patchLive(charId, {
        position: {
          dungeonId: this.dungeonId,
          x: msg.x,
          y: msg.y,
          z: msg.z,
          yaw: msg.yaw,
        },
      });
      this.broadcast("player_moved", { id: charId, x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw }, { except: client });
    });

    this.onMessage("chat", (client, msg: { text: string }) => {
      const charId = this.charBySession.get(client.sessionId);
      if (!charId) return;
      const sheet = getLive(charId);
      if (!sheet) return;
      const message: ChatMessage = {
        channel: "party",
        from: sheet.name,
        text: String(msg.text ?? "").slice(0, 200),
        at: Date.now(),
      };
      this.broadcast("chat", { message });
    });

    this.onMessage("change_room", (client, msg: { roomId: string }) => {
      const dungeon = DUNGEONS[this.dungeonId];
      if (!dungeon?.rooms.find((r) => r.id === msg.roomId)) return;
      this.roomId = msg.roomId;
      for (const m of this.members.values()) {
        m.x = 0;
        m.z = 6;
      }
      this.broadcast("dungeon_state", {
        dungeonId: this.dungeonId,
        roomId: this.roomId,
        flags: this.flags,
        members: [...this.members.values()],
      });
    });

    this.onMessage("start_combat", (client, msg: { enemyType?: string; count?: number }) => {
      const charId = this.charBySession.get(client.sessionId);
      if (!charId || this.combatId) return;
      // Only party leader or any member if no party
      if (this.partyId) {
        const party = parties.get(this.partyId);
        if (party && party.leaderId !== charId) {
          // allow any member to pull if leader not present
          const leaderHere = [...this.members.keys()].includes(party.leaderId);
          if (leaderHere && party.leaderId !== charId) {
            client.send("error", { message: "only_leader_starts_combat" });
            return;
          }
        }
      }
      this.beginSharedCombat(String(msg.enemyType || "wolf"), Number(msg.count ?? 2));
    });

    this.onMessage("combat_action", (client, msg: { action: any }) => {
      const charId = this.charBySession.get(client.sessionId);
      if (!charId || !this.combatId) return;
      const state = combats.get(this.combatId);
      if (!state) return;
      if (state.activeId !== charId) {
        client.send("error", { message: "not_your_turn" });
        return;
      }
      const sheet = getLive(charId);
      if (!sheet) return;
      const seed = Date.now() ^ charId.length * 97;
      let result = applyCombatAction(state, charId, msg.action, seed, {
        [charId]: sheet.equipped.mainHand,
      });
      let st = result.state;

      // Run AI for enemies until a party member's turn or end
      let guard = 0;
      while (!result.ended && guard++ < 24) {
        const active = st.combatants.find((c) => c.id === st.activeId);
        if (!active) break;
        if (active.side === "party") {
          // if active is a human player present, stop
          if (this.members.has(active.id) || active.characterId && this.members.has(active.characterId)) {
            break;
          }
          // NPC companion AI: simple attack
          const foe = st.combatants.find((c) => c.side === "enemy" && c.life > 0);
          const aiAct = foe
            ? { kind: "attack" as const, targetId: foe.id }
            : { kind: "wait" as const };
          result = applyCombatAction(st, active.id, aiAct, seed + guard * 13, {});
          st = result.state;
          continue;
        }
        const ai = enemyAiAction(st, active.id, seed + guard * 31);
        result = applyCombatAction(st, active.id, ai, seed + guard * 17);
        st = result.state;
      }

      combats.set(st.id, st);
      this.broadcast("combat_update", { state: st });

      if (result.ended) {
        this.resolveCombatEnd(result.ended, st, result.loot, result.exp);
      }
    });

    this.onMessage("set_flag", (client, msg: { flag: string; value?: boolean }) => {
      if (!msg.flag) return;
      this.flags[msg.flag] = msg.value !== false;
      this.broadcast("dungeon_state", {
        dungeonId: this.dungeonId,
        roomId: this.roomId,
        flags: this.flags,
        members: [...this.members.values()],
      });
    });

    this.onMessage("leave_dungeon", (client) => {
      client.leave();
    });
  }

  private beginSharedCombat(enemyType: string, count: number): void {
    const party: ReturnType<typeof combatantFromCharacter>[] = [];
    let slot = 0;
    for (const [charId] of this.members) {
      const sheet = getLive(charId);
      if (!sheet || sheet.life <= 0) continue;
      const c = combatantFromCharacter(sheet, 1 + (slot % 3), 2 + Math.floor(slot / 3));
      party.push(c);
      slot++;
    }
    if (!party.length) return;
    const n = Math.min(5, Math.max(1, count));
    const enemies = Array.from({ length: n }, (_, i) =>
      makeEnemy(`e_${i}`, enemyType, `${enemyType} ${i + 1}`, 6 + (i % 3), 2 + i, 1)
    );
    const state = startCombat({
      id: randomUUID(),
      party,
      enemies,
      width: 10,
      height: 8,
    });
    this.combatId = state.id;
    combats.set(state.id, state);
    this.broadcast("combat_start", { state });
  }

  private resolveCombatEnd(
    ended: "victory" | "defeat" | "fled",
    state: CombatState,
    loot: { itemId: string; qty: number }[] | undefined,
    exp: number | undefined
  ): void {
    const partyMembers = state.combatants.filter((c) => c.side === "party");
    const partySize = Math.max(1, partyMembers.filter((c) => this.members.has(c.id)).length);
    const totalExp = Math.floor((exp ?? 0) / partySize);

    for (const [charId] of this.members) {
      const sheet = getLive(charId);
      if (!sheet) continue;
      const me = state.combatants.find((c) => c.id === charId);
      let next = { ...sheet, inventory: sheet.inventory.map((i) => ({ ...i })) };
      if (me) {
        next.life = Math.max(1, me.life);
        next.focus = me.focus;
      }
      if (ended === "victory") {
        next.exp += totalExp;
        next = applyLevelUp(next);
        for (const item of loot ?? []) {
          const existing = next.inventory.find((i) => i.itemId === item.itemId);
          if (existing) existing.qty += item.qty;
          else next.inventory.push({ ...item });
        }
      } else if (ended === "defeat") {
        next.life = Math.max(1, Math.floor(next.lifeMax * 0.3));
      }
      setLive(next);
      // notify each client of their sheet
      for (const c of this.clients) {
        if (this.charBySession.get(c.sessionId) === charId) {
          c.send("character_update", { character: next });
          c.send("combat_end", {
            result: ended,
            loot: ended === "victory" ? loot : [],
            exp: ended === "victory" ? totalExp : 0,
          });
        }
      }
    }

    if (this.combatId) combats.delete(this.combatId);
    this.combatId = null;
    this.broadcast("combat_end_shared", { result: ended });
  }

  onJoin(client: Client, options: JoinOpts): void {
    const sheet = options.character;
    if (!sheet?.id) {
      client.leave(4000);
      return;
    }
    if (options.dungeonId && options.dungeonId !== this.dungeonId) {
      client.leave(4001);
      return;
    }
    if (this.partyId && options.partyId && options.partyId !== this.partyId) {
      client.leave(4002);
      return;
    }
    // If party is set, only party members may join
    if (this.partyId) {
      const party = parties.get(this.partyId);
      if (party && !party.memberIds.includes(sheet.id)) {
        client.leave(4003);
        return;
      }
    }

    setLive(sheet);
    this.charBySession.set(client.sessionId, sheet.id);
    const pos: MemberPos = {
      id: sheet.id,
      name: sheet.name,
      archetype: sheet.archetype,
      x: sheet.position.x || 0,
      y: 1.6,
      z: sheet.position.z || 8,
      yaw: sheet.position.yaw || Math.PI,
    };
    this.members.set(sheet.id, pos);

    client.send("welcome", { character: getLive(sheet.id), serverTime: Date.now() });
    client.send("dungeon_state", {
      dungeonId: this.dungeonId,
      roomId: this.roomId,
      flags: this.flags,
      members: [...this.members.values()],
    });
    if (this.combatId) {
      const st = combats.get(this.combatId);
      if (st) client.send("combat_start", { state: st });
    }
    this.broadcast("player_joined", { player: pos }, { except: client });
  }

  onLeave(client: Client): void {
    const charId = this.charBySession.get(client.sessionId);
    this.charBySession.delete(client.sessionId);
    if (charId) {
      this.members.delete(charId);
      this.broadcast("player_left", { id: charId });
    }
    if (this.clients.length === 0 && this.combatId) {
      combats.delete(this.combatId);
      this.combatId = null;
    }
  }
}
