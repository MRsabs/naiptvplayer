import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!_db) {
    const dbPath = await invoke<string>("get_db_path");
    _db = await Database.load(dbPath);
  }
  return _db;
}
