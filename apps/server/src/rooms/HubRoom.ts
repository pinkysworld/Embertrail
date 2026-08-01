import { Room, type Client } from "@colyseus/core";
import type { CharacterSheet, ChatMessage, HubPlayer } from "@embertrail/shared";
import { MAX_PARTY, HUB_SOFT_CAP } from "@embertrail/shared";
import { getLive, patchLive, parties, setLive } from "../gameState.js";
import { TOWNS } from "@embertrail/content";
import { randomUUID } from "node:crypto";

interface HubOptions {
  townId: string;
}

export class HubRoom extends Room {
  townId = "rimeport";
  players = new Map<string, HubPlayer>();
  charBySession = new Map<string, string>();
  timeOfDay = 0.35; // 0-1
  weather: "clear" | "clouds" | "rain" | "snow" | "fog" | "blizzard" = "clear";

  onCreate(options: HubOptions): void {
    this.townId = options.townId || "rimeport";
    this.setMetadata({ townId: this.townId });
    this.maxClients = HUB_SOFT_CAP;

    this.onMessage("move", (client, msg: { x: number; y: number; z: number; yaw: number }) => {
      const charId = this.charBySession.get(client.sessionId);
      if (!charId) return;
      const p = this.players.get(charId);
      if (!p) return;
      p.x = msg.x;
      p.y = msg.y;
      p.z = msg.z;
      p.yaw = msg.yaw;
      patchLive(charId, { position: { townId: this.townId, x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw } });
      this.broadcast("player_moved", { id: charId, x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw }, { except: client });
    });

    this.onMessage("chat", (client, msg: { channel: ChatMessage["channel"]; text: string }) => {
      const charId = this.charBySession.get(client.sessionId);
      if (!charId) return;
      const sheet = getLive(charId);
      if (!sheet) return;
      const text = String(msg.text ?? "").slice(0, 200);
      if (!text.trim()) return;
      const message: ChatMessage = {
        channel: msg.channel ?? "local",
        from: sheet.name,
        text,
        at: Date.now(),
      };
      if (msg.channel === "party") {
        const party = [...parties.values()].find((p) => p.memberIds.includes(charId));
        if (!party) return;
        for (const c of this.clients) {
          const id = this.charBySession.get(c.sessionId);
          if (id && party.memberIds.includes(id)) c.send("chat", { message });
        }
      } else {
        this.broadcast("chat", { message });
      }
    });

    this.onMessage("party_invite", (client, msg: { targetId: string }) => {
      const charId = this.charBySession.get(client.sessionId);
      if (!charId) return;
      let party = [...parties.values()].find((p) => p.memberIds.includes(charId));
      if (!party) {
        party = { id: randomUUID(), leaderId: charId, memberIds: [charId] };
        parties.set(party.id, party);
      }
      if (party.leaderId !== charId) return;
      if (party.memberIds.length >= MAX_PARTY) return;
      if (!this.players.has(msg.targetId)) return;
      if (party.memberIds.includes(msg.targetId)) return;
      party.memberIds.push(msg.targetId);
      this.sendPartyUpdate(party);
    });

    this.onMessage("party_leave", (client) => {
      const charId = this.charBySession.get(client.sessionId);
      if (!charId) return;
      const party = [...parties.values()].find((p) => p.memberIds.includes(charId));
      if (!party) return;
      party.memberIds = party.memberIds.filter((id) => id !== charId);
      if (party.memberIds.length === 0) parties.delete(party.id);
      else if (party.leaderId === charId) party.leaderId = party.memberIds[0];
      client.send("party_update", { party: null });
      if (party.memberIds.length) this.sendPartyUpdate(party);
    });

    this.onMessage("interact", (client, msg: { targetId: string }) => {
      const town = TOWNS[this.townId];
      if (!town) return;
      const npc = town.npcs.find((n) => n.id === msg.targetId);
      if (npc) {
        client.send("dialogue", {
          npcId: npc.id,
          textKey: npc.greetingKey,
          topics: npc.topics,
        });
        return;
      }
      if (msg.targetId === "travel") {
        client.send("notification", { kind: "info", textKey: "ui.travel" });
      }
    });

    this.onMessage("dialogue_topic", (client, msg: { npcId: string; topic: string }) => {
      const town = TOWNS[this.townId];
      const npc = town?.npcs.find((n) => n.id === msg.npcId);
      if (!npc) return;
      if (msg.topic === "farewell") {
        client.send("dialogue", { npcId: npc.id, textKey: "topic.farewell", topics: [] });
        return;
      }
      const reply = npc.replies[msg.topic] ?? npc.greetingKey;
      client.send("dialogue", {
        npcId: npc.id,
        textKey: reply,
        topics: npc.topics,
      });
      // Quest hooks
      const charId = this.charBySession.get(client.sessionId);
      if (!charId) return;
      const sheet = getLive(charId);
      if (!sheet) return;
      if (msg.topic === "pactcinder" && !sheet.questFlags.pactcinder) {
        const journal = [
          ...sheet.journal,
          {
            id: "j_pactcinder",
            questId: "pactcinder",
            titleKey: "journal.pactcinder.title",
            bodyKey: "journal.pactcinder.body",
            timestamp: Date.now(),
            clue: true,
          },
        ];
        patchLive(charId, {
          questFlags: { ...sheet.questFlags, pactcinder: 1 },
          journal,
          knownMapNodes: [...new Set([...sheet.knownMapNodes, "mine_ash_entrance", "road_south"])],
        });
        client.send("notification", { kind: "quest", textKey: "notify.quest_update" });
        client.send("character_update", {
          character: getLive(charId),
        });
      }
      if (msg.topic === "rumors" && !sheet.questFlags.foxbrand) {
        const journal = [
          ...sheet.journal,
          {
            id: "j_foxbrand",
            questId: "foxbrand",
            titleKey: "journal.foxbrand.title",
            bodyKey: "journal.foxbrand.body",
            timestamp: Date.now(),
            clue: true,
          },
        ];
        patchLive(charId, { questFlags: { ...sheet.questFlags, foxbrand: 1 }, journal });
        client.send("notification", { kind: "quest", textKey: "notify.quest_update" });
        client.send("character_update", { character: getLive(charId) });
      }
    });

    this.clock.setInterval(() => {
      this.timeOfDay = (this.timeOfDay + 0.002) % 1;
    }, 1000);
  }

  onJoin(client: Client, options: { character: CharacterSheet }): void {
    const sheet = options.character;
    if (!sheet?.id) {
      client.leave(4000);
      return;
    }
    setLive(sheet);
    this.charBySession.set(client.sessionId, sheet.id);
    const player: HubPlayer = {
      id: sheet.id,
      name: sheet.name,
      archetype: sheet.archetype,
      x: sheet.position.x,
      y: sheet.position.y,
      z: sheet.position.z,
      yaw: sheet.position.yaw,
    };
    this.players.set(sheet.id, player);
    client.send("welcome", { character: sheet, serverTime: Date.now() });
    client.send("hub_state", {
      townId: this.townId,
      players: [...this.players.values()],
      timeOfDay: this.timeOfDay,
      weather: this.weather,
    });
    this.broadcast("player_joined", { player }, { except: client });
  }

  onLeave(client: Client): void {
    const charId = this.charBySession.get(client.sessionId);
    this.charBySession.delete(client.sessionId);
    if (charId) {
      this.players.delete(charId);
      this.broadcast("player_left", { id: charId });
    }
  }

  private sendPartyUpdate(party: import("@embertrail/shared").PartyState): void {
    for (const c of this.clients) {
      const id = this.charBySession.get(c.sessionId);
      if (id && party.memberIds.includes(id)) c.send("party_update", { party });
    }
  }
}
