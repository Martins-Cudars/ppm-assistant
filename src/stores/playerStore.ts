import { defineStore } from "pinia";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import {
  getAllPlayersFromAllCaches,
  clearAllCaches,
  getCacheStats,
} from "@/storage/playerCache";
import { collectPlayerData } from "@/services/dataCollector";
import { getUserSettings } from "@/storage/userSettings";
import { clearSkillHistory } from "@/storage/skillHistoryDb";

interface PlayerState {
  players: HockeyPlayer[];
  tableHeaders: string[];
  cachedPlayers: HockeyPlayer[];
  currentSeasonDay: number;
  teamId: string;
  lang: string;
  sport: string;
  playerPage: string;
}

export const usePlayerStore = defineStore("player", {
  state: (): PlayerState => ({
    players: [],
    tableHeaders: [],
    cachedPlayers: [],
    currentSeasonDay: 1,
    teamId: "unknown",
    lang: "en",
    sport: "hockey",
    playerPage: "player.html",
  }),
  getters: {
    getCachedPlayerCount: (state) => state.cachedPlayers.length,
    getPlayerById: (state) => (id: string) =>
      state.cachedPlayers.find((p) => p.id === id),
    getFreshPlayers: (state) => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      return state.cachedPlayers.filter((p) => p.updatedAt >= oneDayAgo);
    },
    getStalePlayers: (state) => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return state.cachedPlayers.filter(
        (p) => p.updatedAt < oneDayAgo && p.updatedAt >= sevenDaysAgo
      );
    },
    getVeryStale: (state) => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return state.cachedPlayers.filter((p) => p.updatedAt < sevenDaysAgo);
    },
  },
  actions: {
    setPlayers(players: HockeyPlayer[]) {
      this.players = players;
    },
    setTableHeaders(headers: string[]) {
      this.tableHeaders = headers;
    },
    async loadFromCache() {
      try {
        // Use getAllPlayersFromAllCaches which works in extension pages without DOM
        const { players, currentSeasonDay, teamId } = await getAllPlayersFromAllCaches();
        this.cachedPlayers = players;
        this.currentSeasonDay = currentSeasonDay;
        this.teamId = teamId;

        const settings = await getUserSettings();
        this.lang = settings.lang;
        this.sport = settings.sport;
        this.playerPage = settings.playerPage;

        console.log(
          `[PlayerStore] Loaded ${this.cachedPlayers.length} players from cache (Team: ${teamId}, Season Day: ${currentSeasonDay}, Lang: ${settings.lang})`
        );
      } catch (error) {
        console.error("[PlayerStore] Failed to load from cache:", error);
        this.cachedPlayers = [];
      }
    },
    /**
     * Wipes every stored player: the chrome.storage.local snapshot caches and
     * the skill-history time series behind the background worker. The two used
     * to be cleared separately, which left history unreachable - nothing else
     * deletes it - while the UI claimed everything was gone.
     *
     * Returns the number of history records removed, or null if the history
     * clear failed - "0" and "it did not happen" mean opposite things here, and
     * a caller that blanks its display on either will claim an empty store while
     * the data is still on disk.
     *
     * Destructive and unrecoverable: confirm with the user first.
     */
    async clearAllStoredData(): Promise<number | null> {
      const [, clearedHistory] = await Promise.all([
        clearAllCaches(),
        clearSkillHistory(),
      ]);
      this.cachedPlayers = [];

      if (clearedHistory === null) {
        console.error("[PlayerStore] Caches cleared, but the history clear failed");
      } else {
        console.log(
          `[PlayerStore] All caches cleared, ${clearedHistory} history records removed`
        );
      }

      return clearedHistory;
    },
    async mergeAndSavePlayer(
      player: HockeyPlayer,
      source: "PlayerProfile" | "PlayersList" | "PlayerContracts"
    ) {
      try {
        await collectPlayerData(player, source);
        // Reload cache to update state
        await this.loadFromCache();
      } catch (error) {
        console.error(
          `[PlayerStore] Failed to merge and save player ${player.id}:`,
          error
        );
      }
    },
    async getCacheStatistics() {
      return await getCacheStats();
    },
  },
});
