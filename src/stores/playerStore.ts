import { defineStore } from "pinia";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";

interface PlayerState {
  players: HockeyPlayer[];
}

export const usePlayerStore = defineStore("player", {
  state: (): PlayerState => ({
    players: [],
  }),
  actions: {
    setPlayers(players: HockeyPlayer[]) {
      this.players = players;
    },
  },
});
