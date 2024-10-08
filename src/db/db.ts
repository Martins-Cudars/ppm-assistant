import { HockeyPlayer } from "@/types/Player";

interface PlayerDbEntry extends HockeyPlayer {
  updatedAt: Date;
}

class PlayerDatabase {
  private static instance: PlayerDatabase;
  private dbName = "playerDB";
  private dbVersion = 1;

  private constructor() {
    this.initDatabase();
  }

  public static getInstance(): PlayerDatabase {
    if (!PlayerDatabase.instance) {
      PlayerDatabase.instance = new PlayerDatabase();
    }
    return PlayerDatabase.instance;
  }

  private initDatabase(): void {
    const request = indexedDB.open(this.dbName, this.dbVersion);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("players")) {
        db.createObjectStore("players", { keyPath: "name" });
      }
    };

    request.onerror = (event) => {
      console.error("Database error:", (event.target as IDBRequest).error);
    };
  }

  public addPlayer(player: {
    name: string;
    age: number;
    updatedAt: Date;
  }): void {
    const request = indexedDB.open(this.dbName, this.dbVersion);
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(["players"], "readwrite");
      const store = transaction.objectStore("players");
      store.put(player);
    };
  }

  public getPlayer(name: string, callback: (player: any) => void): void {
    const request = indexedDB.open(this.dbName, this.dbVersion);
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(["players"], "readonly");
      const store = transaction.objectStore("players");
      const getRequest = store.get(name);

      getRequest.onsuccess = () => {
        callback(getRequest.result);
      };
    };
  }
}

// Export a singleton instance
const db = PlayerDatabase.getInstance();
export default db;
