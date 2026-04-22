export interface Account {
  id: string;
  name: string;
  serverUrl: string;
  username: string;
  password: string;
}

export interface Channel {
  tvgId: string;
  name: string;
  logo: string;
  group: string;
  url: string;
}

// camelCase — serialized by Rust with rename_all = "camelCase"
export interface Movie {
  streamId: number;
  name: string;
  cover: string;
  group: string;
  rating: string;
  year: string;
  containerExtension: string;
  url: string;
}

export interface Series {
  seriesId: number;
  name: string;
  cover: string;
  group: string;
  rating: string;
  year: string;
  plot: string;
  genre: string;
  cast: string;
  director: string;
  episodeRunTime: string;
}

// snake_case — raw JSON returned by serde_json::Value in Rust
export interface Episode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  /** Injected by Rust */
  url: string;
  info: {
    duration_secs?: number;
    duration?: string;
    movie_image?: string;
    plot?: string;
    releasedate?: string;
    rating?: string;
  };
}

export interface SeriesInfoData {
  info: Record<string, unknown>;
  seasons?: Array<Record<string, unknown>> | null;
  episodes: Record<string, Episode[]>;
}

export type StreamFormat = "ts" | "m3u8";

export interface AccountSettings {
  streamFormat: StreamFormat;
}
