import { defineStore } from "pinia";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";

interface PlayerState {
  players: HockeyPlayer[];
  tableHeaders: string[];
}

export const usePlayerStore = defineStore("player", {
  state: (): PlayerState => ({
    players: [],
    tableHeaders: [],
  }),
  actions: {
    setPlayers(players: HockeyPlayer[]) {
      this.players = players;
    },
    setTableHeaders(headers: string[]) {
      this.tableHeaders = headers;
    },
  },
});
