use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[cfg(windows)]
mod vlc;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

// ─── Data types ────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct Channel {
    tvg_id: String,
    name: String,
    logo: String,
    group: String,
    url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct Movie {
    stream_id: u64,
    name: String,
    cover: String,
    group: String,
    rating: String,
    year: String,
    container_extension: String,
    url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct Series {
    series_id: u64,
    name: String,
    cover: String,
    group: String,
    rating: String,
    year: String,
    plot: String,
    genre: String,
    cast: String,
    director: String,
    episode_run_time: String,
}

// ─── Tauri commands ────────────────────────────────────────────

#[tauri::command]
async fn get_channels(
    app: AppHandle,
    server_url: String,
    username: String,
    password: String,
    stream_format: String,
) -> Result<Vec<Channel>, String> {
    let server_url = server_url.trim_end_matches('/').to_string();
    let client = reqwest::Client::new();

    let _ = app.emit("progress", "Fetching live categories…");
    let cats: Vec<serde_json::Value> = client
        .get(format!(
            "{}/player_api.php?username={}&password={}&action=get_live_categories",
            server_url, username, password
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let cat_map: HashMap<String, String> = cats
        .iter()
        .filter_map(|c| {
            let id = c["category_id"].as_str()?.to_string();
            let name = c["category_name"].as_str()?.to_string();
            Some((id, name))
        })
        .collect();

    let _ = app.emit("progress", "Fetching live channels…");
    let streams: Vec<serde_json::Value> = client
        .get(format!(
            "{}/player_api.php?username={}&password={}&action=get_live_streams",
            server_url, username, password
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let channels: Vec<Channel> = streams
        .iter()
        .map(|s| {
            let stream_id = s["stream_id"].as_u64().unwrap_or(0);
            Channel {
                tvg_id: s["epg_channel_id"].as_str().unwrap_or("").to_string(),
                name: s["name"].as_str().unwrap_or("").to_string(),
                logo: s["stream_icon"].as_str().unwrap_or("").to_string(),
                group: s["category_id"]
                    .as_str()
                    .and_then(|id| cat_map.get(id))
                    .cloned()
                    .unwrap_or_else(|| "Uncategorized".to_string()),
                url: format!(
                    "{}/live/{}/{}/{}.{}",
                    server_url, username, password, stream_id, stream_format
                ),
            }
        })
        .collect();

    let _ = app.emit("progress", "Saving to cache…");
    Ok(channels)
}

#[tauri::command]
async fn get_movies(
    app: AppHandle,
    server_url: String,
    username: String,
    password: String,
) -> Result<Vec<Movie>, String> {
    let server_url = server_url.trim_end_matches('/').to_string();
    let client = reqwest::Client::new();

    let _ = app.emit("progress", "Fetching movie categories…");
    let cats: Vec<serde_json::Value> = client
        .get(format!(
            "{}/player_api.php?username={}&password={}&action=get_vod_categories",
            server_url, username, password
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let cat_map: HashMap<String, String> = cats
        .iter()
        .filter_map(|c| {
            let id = c["category_id"].as_str()?.to_string();
            let name = c["category_name"].as_str()?.to_string();
            Some((id, name))
        })
        .collect();

    let _ = app.emit("progress", "Fetching movies…");
    let streams: Vec<serde_json::Value> = client
        .get(format!(
            "{}/player_api.php?username={}&password={}&action=get_vod_streams",
            server_url, username, password
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let movies: Vec<Movie> = streams
        .iter()
        .map(|s| {
            let stream_id = s["stream_id"]
                .as_u64()
                .or_else(|| s["stream_id"].as_str().and_then(|v| v.parse().ok()))
                .unwrap_or(0);
            let ext = s["container_extension"]
                .as_str()
                .unwrap_or("mp4")
                .to_string();
            Movie {
                stream_id,
                name: s["name"].as_str().unwrap_or("").to_string(),
                cover: s["stream_icon"].as_str().unwrap_or("").to_string(),
                group: s["category_id"]
                    .as_str()
                    .and_then(|id| cat_map.get(id))
                    .cloned()
                    .unwrap_or_else(|| "Uncategorized".to_string()),
                rating: s["rating"]
                    .as_str()
                    .filter(|r| !r.is_empty())
                    .map(|r| r.to_string())
                    .or_else(|| s["rating"].as_f64().map(|f| format!("{:.1}", f)))
                    .unwrap_or_default(),
                year: s["year"]
                    .as_str()
                    .filter(|y| !y.is_empty())
                    .map(|y| y.chars().take(4).collect())
                    .or_else(|| s["year"].as_u64().map(|n| n.to_string()))
                    .unwrap_or_default(),
                container_extension: ext.clone(),
                url: format!(
                    "{}/movie/{}/{}/{}.{}",
                    server_url, username, password, stream_id, ext
                ),
            }
        })
        .collect();

    Ok(movies)
}

#[tauri::command]
async fn get_series(
    app: AppHandle,
    server_url: String,
    username: String,
    password: String,
) -> Result<Vec<Series>, String> {
    let server_url = server_url.trim_end_matches('/').to_string();
    let client = reqwest::Client::new();

    let _ = app.emit("progress", "Fetching series categories…");
    let cats: Vec<serde_json::Value> = client
        .get(format!(
            "{}/player_api.php?username={}&password={}&action=get_series_categories",
            server_url, username, password
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let cat_map: HashMap<String, String> = cats
        .iter()
        .filter_map(|c| {
            let id = c["category_id"].as_str()?.to_string();
            let name = c["category_name"].as_str()?.to_string();
            Some((id, name))
        })
        .collect();

    let _ = app.emit("progress", "Fetching series list…");
    let series_list: Vec<serde_json::Value> = client
        .get(format!(
            "{}/player_api.php?username={}&password={}&action=get_series",
            server_url, username, password
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let series: Vec<Series> = series_list
        .iter()
        .map(|s| Series {
            series_id: s["series_id"]
                .as_u64()
                .or_else(|| s["series_id"].as_str().and_then(|v| v.parse().ok()))
                .unwrap_or(0),
            name: s["name"].as_str().unwrap_or("").to_string(),
            cover: s["cover"].as_str().unwrap_or("").to_string(),
            group: s["category_id"]
                .as_str()
                .and_then(|id| cat_map.get(id))
                .cloned()
                .unwrap_or_else(|| "Uncategorized".to_string()),
            rating: s["rating"]
                .as_str()
                .filter(|r| !r.is_empty())
                .map(|r| r.to_string())
                .or_else(|| s["rating"].as_f64().map(|f| format!("{:.1}", f)))
                .unwrap_or_default(),
            year: s["year"]
                .as_str()
                .filter(|y| !y.is_empty())
                .map(|y| y.chars().take(4).collect())
                .or_else(|| {
                    s["release_date"]
                        .as_str()
                        .filter(|d| d.len() >= 4)
                        .map(|d| d[..4].to_string())
                })
                .unwrap_or_default(),
            plot: s["plot"].as_str().unwrap_or("").to_string(),
            genre: s["genre"].as_str().unwrap_or("").to_string(),
            cast: s["cast"].as_str().unwrap_or("").to_string(),
            director: s["director"].as_str().unwrap_or("").to_string(),
            episode_run_time: s["episode_run_time"].as_str().unwrap_or("").to_string(),
        })
        .collect();

    Ok(series)
}

#[tauri::command]
async fn get_vod_info(
    server_url: String,
    username: String,
    password: String,
    vod_id: u64,
) -> Result<serde_json::Value, String> {
    let server_url = server_url.trim_end_matches('/').to_string();
    let client = reqwest::Client::new();
    let value: serde_json::Value = client
        .get(format!(
            "{}/player_api.php?username={}&password={}&action=get_vod_info&vod_id={}",
            server_url, username, password, vod_id
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    Ok(value)
}

#[tauri::command]
async fn get_series_info(
    server_url: String,
    username: String,
    password: String,
    series_id: u64,
) -> Result<serde_json::Value, String> {
    let server_url = server_url.trim_end_matches('/').to_string();
    let client = reqwest::Client::new();
    let mut data: serde_json::Value = client
        .get(format!(
            "{}/player_api.php?username={}&password={}&action=get_series_info&series_id={}",
            server_url, username, password, series_id
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    // Inject stream URLs into each episode
    if let Some(episodes) = data.get_mut("episodes").and_then(|e| e.as_object_mut()) {
        for (_, season_eps) in episodes.iter_mut() {
            if let Some(eps) = season_eps.as_array_mut() {
                for ep in eps.iter_mut() {
                    let ep_id = ep
                        .get("id")
                        .and_then(|v| {
                            v.as_str()
                                .map(|s| s.to_string())
                                .or_else(|| v.as_u64().map(|n| n.to_string()))
                        })
                        .unwrap_or_default();
                    let ext = ep
                        .get("container_extension")
                        .and_then(|v| v.as_str())
                        .unwrap_or("mkv");
                    let url = format!(
                        "{}/series/{}/{}/{}.{}",
                        server_url, username, password, ep_id, ext
                    );
                    if let Some(obj) = ep.as_object_mut() {
                        obj.insert("url".to_string(), serde_json::json!(url));
                    }
                }
            }
        }
    }

    Ok(data)
}

#[tauri::command]
async fn get_account_status(
    server_url: String,
    username: String,
    password: String,
) -> Result<serde_json::Value, String> {
    let server_url = server_url.trim_end_matches('/').to_string();
    let client = reqwest::Client::new();
    let value: serde_json::Value = client
        .get(format!(
            "{}/player_api.php?username={}&password={}",
            server_url, username, password
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    Ok(value)
}

#[tauri::command]
fn play_in_app(app: AppHandle, url: String) -> Result<(), String> {
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let vlc_dir = ["vlc", "resources/vlc"]
        .iter()
        .map(|sub| resource_dir.join(sub))
        .find(|p| p.join("libvlc.dll").exists())
        .ok_or_else(|| "Embedded VLC not found in app resources".to_string())?;
    #[cfg(windows)]
    return vlc::spawn_player(&vlc_dir, &url);
    #[cfg(not(windows))]
    return Err("In-app player is only supported on Windows".to_string());
}

#[tauri::command]
fn play_vlc(app: AppHandle, url: String) -> Result<(), String> {
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;

    // Tauri may place the bundled directory at either "vlc/" or "resources/vlc/"
    // depending on the resources configuration — check both.
    let vlc_exe = ["vlc", "resources/vlc"]
        .iter()
        .map(|sub| resource_dir.join(sub).join("vlc.exe"))
        .find(|p| p.exists())
        .ok_or_else(|| "Embedded VLC not found in app resources.".to_string())?;

    let vlc_dir = vlc_exe
        .parent()
        .ok_or_else(|| "Cannot resolve VLC directory.".to_string())?;

    std::process::Command::new(&vlc_exe)
        .current_dir(vlc_dir)
        .arg("--no-video-title-show")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ─── DB path ───────────────────────────────────────────────────

/// Returns the absolute connection string for the SQLite DB,
/// placed next to the running executable.
fn db_connection_string() -> String {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    let path = exe_dir.join("streambox.db");
    // sqlx expects forward slashes even on Windows
    format!("sqlite:{}", path.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
fn get_db_path() -> String {
    db_connection_string()
}

// ─── Entry point ───────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_url = db_connection_string();

    let migrations = vec![
        Migration {
            version: 1,
            description: "create_accounts_and_channel_cache",
            sql: "
                CREATE TABLE IF NOT EXISTS accounts (
                    id          TEXT PRIMARY KEY,
                    name        TEXT NOT NULL,
                    server_url  TEXT NOT NULL,
                    username    TEXT NOT NULL,
                    password    TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS channel_cache (
                    account_id   TEXT PRIMARY KEY,
                    fetched_at   TEXT NOT NULL,
                    channels_json TEXT NOT NULL
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_vod_and_series_cache",
            sql: "
                CREATE TABLE IF NOT EXISTS vod_cache (
                    account_id   TEXT PRIMARY KEY,
                    fetched_at   TEXT NOT NULL,
                    movies_json  TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS series_cache (
                    account_id   TEXT PRIMARY KEY,
                    fetched_at   TEXT NOT NULL,
                    series_json  TEXT NOT NULL
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_account_settings",
            sql: "
                CREATE TABLE IF NOT EXISTS account_settings (
                    account_id    TEXT PRIMARY KEY,
                    stream_format TEXT NOT NULL DEFAULT 'ts'
                );
            ",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(&db_url, migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_channels,
            get_movies,
            get_series,
            get_vod_info,
            get_series_info,
            get_account_status,
            get_db_path,
            play_vlc,
            play_in_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
