import { getDb } from "./db";
import type {
  Account,
  AccountSettings,
  Channel,
  Movie,
  Series,
  StreamFormat,
} from "./types";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Row shapes returned by SQLite ─────────────────────────────

interface AccountRow {
  id: string;
  name: string;
  server_url: string;
  username: string;
  password: string;
}

function rowToAccount(r: AccountRow): Account {
  return {
    id: r.id,
    name: r.name,
    serverUrl: r.server_url,
    username: r.username,
    password: r.password,
  };
}

// ─── Account CRUD ───────────────────────────────────────────────

export async function getAccounts(): Promise<Account[]> {
  const db = await getDb();
  const rows = await db.select<AccountRow[]>(
    "SELECT * FROM accounts ORDER BY name",
  );
  return rows.map(rowToAccount);
}

export async function getAccount(id: string): Promise<Account | undefined> {
  const db = await getDb();
  const rows = await db.select<AccountRow[]>(
    "SELECT * FROM accounts WHERE id = $1",
    [id],
  );
  return rows.length ? rowToAccount(rows[0]) : undefined;
}

export async function saveAccount(account: Account): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO accounts (id, name, server_url, username, password)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(id) DO UPDATE SET
       name=$2, server_url=$3, username=$4, password=$5`,
    [
      account.id,
      account.name,
      account.serverUrl,
      account.username,
      account.password,
    ],
  );
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM accounts WHERE id = $1", [id]);
  await db.execute("DELETE FROM channel_cache WHERE account_id = $1", [id]);
  await db.execute("DELETE FROM vod_cache WHERE account_id = $1", [id]);
  await db.execute("DELETE FROM series_cache WHERE account_id = $1", [id]);
}

// ─── Channel cache ─────────────────────────────────────────────

export async function getCachedChannels(
  accountId: string,
): Promise<{ channels: Channel[]; fetchedAt: string } | null> {
  const db = await getDb();
  const rows = await db.select<{ fetched_at: string; channels_json: string }[]>(
    "SELECT fetched_at, channels_json FROM channel_cache WHERE account_id = $1",
    [accountId],
  );
  if (!rows.length) return null;

  const age = Date.now() - new Date(rows[0].fetched_at).getTime();
  if (age > CACHE_TTL_MS) return null;

  return {
    channels: JSON.parse(rows[0].channels_json) as Channel[],
    fetchedAt: rows[0].fetched_at,
  };
}

export async function setCachedChannels(
  accountId: string,
  channels: Channel[],
): Promise<string> {
  const db = await getDb();
  const fetchedAt = new Date().toISOString();
  await db.execute(
    `INSERT INTO channel_cache (account_id, fetched_at, channels_json)
     VALUES ($1, $2, $3)
     ON CONFLICT(account_id) DO UPDATE SET fetched_at=$2, channels_json=$3`,
    [accountId, fetchedAt, JSON.stringify(channels)],
  );
  return fetchedAt;
}

// ─── VOD (movies) cache ────────────────────────────────────────

export async function getCachedMovies(
  accountId: string,
): Promise<{ movies: Movie[]; fetchedAt: string } | null> {
  const db = await getDb();
  const rows = await db.select<{ fetched_at: string; movies_json: string }[]>(
    "SELECT fetched_at, movies_json FROM vod_cache WHERE account_id = $1",
    [accountId],
  );
  if (!rows.length) return null;
  const age = Date.now() - new Date(rows[0].fetched_at).getTime();
  if (age > CACHE_TTL_MS) return null;
  return {
    movies: JSON.parse(rows[0].movies_json) as Movie[],
    fetchedAt: rows[0].fetched_at,
  };
}

export async function setCachedMovies(
  accountId: string,
  movies: Movie[],
): Promise<string> {
  const db = await getDb();
  const fetchedAt = new Date().toISOString();
  await db.execute(
    `INSERT INTO vod_cache (account_id, fetched_at, movies_json)
     VALUES ($1, $2, $3)
     ON CONFLICT(account_id) DO UPDATE SET fetched_at=$2, movies_json=$3`,
    [accountId, fetchedAt, JSON.stringify(movies)],
  );
  return fetchedAt;
}

// ─── Series cache ──────────────────────────────────────────────

export async function getCachedSeries(
  accountId: string,
): Promise<{ series: Series[]; fetchedAt: string } | null> {
  const db = await getDb();
  const rows = await db.select<{ fetched_at: string; series_json: string }[]>(
    "SELECT fetched_at, series_json FROM series_cache WHERE account_id = $1",
    [accountId],
  );
  if (!rows.length) return null;
  const age = Date.now() - new Date(rows[0].fetched_at).getTime();
  if (age > CACHE_TTL_MS) return null;
  return {
    series: JSON.parse(rows[0].series_json) as Series[],
    fetchedAt: rows[0].fetched_at,
  };
}

export async function setCachedSeries(
  accountId: string,
  series: Series[],
): Promise<string> {
  const db = await getDb();
  const fetchedAt = new Date().toISOString();
  await db.execute(
    `INSERT INTO series_cache (account_id, fetched_at, series_json)
     VALUES ($1, $2, $3)
     ON CONFLICT(account_id) DO UPDATE SET fetched_at=$2, series_json=$3`,
    [accountId, fetchedAt, JSON.stringify(series)],
  );
  return fetchedAt;
}

// ─── Account settings ──────────────────────────────────────────

interface SettingsRow {
  stream_format: string;
}

export async function getAccountSettings(
  accountId: string,
): Promise<AccountSettings> {
  const db = await getDb();
  const rows = await db.select<SettingsRow[]>(
    "SELECT stream_format FROM account_settings WHERE account_id = $1",
    [accountId],
  );
  return {
    streamFormat: (rows.length ? rows[0].stream_format : "ts") as StreamFormat,
  };
}

export async function saveAccountSettings(
  accountId: string,
  settings: AccountSettings,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO account_settings (account_id, stream_format)
     VALUES ($1, $2)
     ON CONFLICT(account_id) DO UPDATE SET stream_format=$2`,
    [accountId, settings.streamFormat],
  );
  // Invalidate channel cache because stream URLs embed the format
  await db.execute("DELETE FROM channel_cache WHERE account_id = $1", [
    accountId,
  ]);
}
