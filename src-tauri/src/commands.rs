use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use crate::igdb::GameMetadata;

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: i64,
    pub name: String,
    pub exe_path: String,
    pub genre: String,
    pub cover_path: Option<String>,
    pub description: Option<String>,
    pub added_at: String,
    pub is_favorite: bool,
    pub last_played_at: Option<String>,
}

fn get_conn(app: &tauri::AppHandle) -> Result<Connection, String> {
    let app_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;
    let db_path = app_dir.join("nexus.db");
    Connection::open(db_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_game(
    app: tauri::AppHandle,
    name: String,
    exe_path: String,
    genre: String,
) -> Result<String, String> {
    let conn = get_conn(&app)?;
    conn.execute(
        "INSERT INTO games (name, exe_path, genre) VALUES (?1, ?2, ?3)",
        (&name, &exe_path, &genre),
    ).map_err(|e| e.to_string())?;
    Ok(format!("Jogo '{}' adicionado com sucesso!", name))
}

#[tauri::command]
pub fn list_games(app: tauri::AppHandle) -> Result<Vec<Game>, String> {
    let conn = get_conn(&app)?;
    let mut stmt = conn.prepare(
        "SELECT id, name, exe_path, genre, cover_path, description, added_at, is_favorite, last_played_at FROM games ORDER BY name ASC"
    ).map_err(|e| e.to_string())?;

    let games = stmt.query_map([], |row| {
        Ok(Game {
            id: row.get(0)?,
            name: row.get(1)?,
            exe_path: row.get(2)?,
            genre: row.get(3)?,
            cover_path: row.get(4)?,
            description: row.get(5)?,
            added_at: row.get(6)?,
            is_favorite: row.get::<_, i32>(7)? == 1,
            last_played_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|g| g.ok())
    .collect();

    Ok(games)
}

#[tauri::command]
pub fn launch_game(
    app: tauri::AppHandle,
    game_id: i64,
) -> Result<u32, String> {
    let conn = get_conn(&app)?;

    let exe_path: String = conn.query_row(
        "SELECT exe_path FROM games WHERE id = ?1",
        [game_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let child = std::process::Command::new(&exe_path)
        .spawn()
        .map_err(|e| format!("Falha ao iniciar '{}': {}", exe_path, e))?;

    let pid = child.id();

    conn.execute(
        "INSERT INTO sessions (game_id, started_at) VALUES (?1, datetime('now'))",
        [game_id],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE games SET last_played_at = datetime('now') WHERE id = ?1",
        [game_id],
    ).map_err(|e| e.to_string())?;

    std::mem::forget(child);

    Ok(pid)
}

#[tauri::command]
pub fn is_process_running(pid: u32) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/NH"])
            .output();

        match output {
            Ok(o) => {
                let stdout = String::from_utf8_lossy(&o.stdout);
                stdout.contains(&pid.to_string())
            }
            Err(_) => false,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[tauri::command]
pub fn close_session(
    app: tauri::AppHandle,
    game_id: i64,
) -> Result<(), String> {
    let conn = get_conn(&app)?;

    conn.execute(
        "UPDATE sessions
         SET ended_at = datetime('now'),
             duration_seconds = CAST(
               strftime('%s', 'now') - strftime('%s', started_at)
             AS INTEGER)
         WHERE game_id = ?1
           AND ended_at IS NULL",
        [game_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ScannedGame {
    pub name: String,
    pub exe_path: String,
}

#[tauri::command]
pub fn scan_folder(path: String) -> Result<Vec<ScannedGame>, String> {
    let mut found: Vec<ScannedGame> = Vec::new();
    scan_recursive(&std::path::Path::new(&path), &mut found, 0);
    Ok(found)
}

fn scan_recursive(dir: &std::path::Path, found: &mut Vec<ScannedGame>, depth: u32) {
    if depth > 3 { return; }

    let ignore = vec![
        "python", "python3", "pythonw", "java", "javaw", "node", "ruby",
        "perl", "php", "lua", "mono", "dotnet", "zsync", "zsyncmake",
        "redist", "redistributable", "directx", "vcredist", "dotnetfx",
        "setup", "install", "uninstall", "uninst", "unins",
        "installer", "autorun", "bootstrap", "prerequisite",
        "_commonredist", "dx", "physx", "dxsetup", "dxwebsetup",
        "oalinst", "vc_redist", "windowsdesktop", "netfx",
        "update", "updater", "patcher", "patch", "launcher_updater",
        "crash", "crashpad", "crashreport", "crashhandler",
        "report", "bugreport", "helper", "support",
        "benchmark", "tool", "tools", "utility",
        "easyanticheat", "battleye", "be_service", "anticheat",
        "steam_api", "steamworks",
        "upc", "uplay", "galaxyclient", "gog",
        "epicgameslauncher", "bethesdanetlauncher",
        "cefsharp", "crashpad_handler", "dxdiag",
        "activation", "register", "elevate",
        "7za", "7z", "winrar", "unzip", "arc",
        "ffmpeg", "imagemagick", "convert",
    ];

    let ignore_dirs = vec![
        "redist", "redistributable", "_commonredist", "directx",
        "support", "tools", "tool", "helper", "helpers",
        "dotnet", "vcredist", "prerequisites", "prerequisite",
        "__pycache__", "node_modules", ".git",
    ];

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();

        if path.is_dir() {
            let dir_name = path.file_name()
                .unwrap_or_default()
                .to_str()
                .unwrap_or("")
                .to_lowercase();
            let should_ignore_dir = ignore_dirs.iter().any(|i| dir_name.contains(i));
            if !should_ignore_dir {
                scan_recursive(&path, found, depth + 1);
            }
        } else if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext.to_str().unwrap_or("").to_lowercase() == "exe" {
                    let exe_name = path.file_stem()
                        .unwrap_or_default()
                        .to_str()
                        .unwrap_or("")
                        .to_lowercase();

                    let should_ignore = ignore.iter().any(|i| exe_name.contains(i));
                    if should_ignore { continue; }

                    // ignora arquivos menores que 1MB (provavelmente helpers)
                    let size = std::fs::metadata(&path)
                        .map(|m| m.len())
                        .unwrap_or(0);

                    let name = path.file_stem()
                        .unwrap_or_default()
                        .to_str()
                        .unwrap_or("")
                        .to_string();

                    found.push(ScannedGame {
                        name: name.clone(),
                        exe_path: path.to_str().unwrap_or("").to_string(),
                    });
                }
            }
        }
    }
}

#[tauri::command]
pub fn import_games(
    app: tauri::AppHandle,
    games: Vec<ScannedGame>,
) -> Result<usize, String> {
    let conn = get_conn(&app)?;
    let mut count = 0;

    for game in &games {
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) FROM games WHERE exe_path = ?1",
            [&game.exe_path],
            |row| row.get::<_, i32>(0),
        ).unwrap_or(0) > 0;

        if !exists {
            conn.execute(
                "INSERT INTO games (name, exe_path, genre) VALUES (?1, ?2, 'Geral')",
                (&game.name, &game.exe_path),
            ).map_err(|e| e.to_string())?;
            count += 1;
        }
    }

    Ok(count)
}

#[tauri::command]
pub fn toggle_favorite(app: tauri::AppHandle, game_id: i64) -> Result<bool, String> {
    let conn = get_conn(&app)?;
    
    let current: i32 = conn.query_row(
        "SELECT is_favorite FROM games WHERE id = ?1",
        [game_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let new_value = if current == 0 { 1 } else { 0 };

    conn.execute(
        "UPDATE games SET is_favorite = ?1 WHERE id = ?2",
        [new_value, game_id as i32],
    ).map_err(|e| e.to_string())?;

    Ok(new_value == 1)
}

#[tauri::command]
pub fn delete_game(app: tauri::AppHandle, game_id: i64) -> Result<(), String> {
    let conn = get_conn(&app)?;
    conn.execute(
        "DELETE FROM sessions WHERE game_id = ?1",
        [game_id],
    ).map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM games WHERE id = ?1",
        [game_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_game_playtime(app: tauri::AppHandle, game_id: i64) -> Result<i64, String> {
    let conn = get_conn(&app)?;
    let total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_seconds), 0) FROM sessions WHERE game_id = ?1",
        [game_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    Ok(total)
}

#[tauri::command]
pub fn update_game(
    app: tauri::AppHandle,
    game_id: i64,
    name: String,
    exe_path: String,
    genre: String,
) -> Result<(), String> {
    let conn = get_conn(&app)?;
    conn.execute(
        "UPDATE games SET name = ?1, exe_path = ?2, genre = ?3 WHERE id = ?4",
        (&name, &exe_path, &genre, &game_id),
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DailySession {
    pub day: String,
    pub total_seconds: i64,
    pub session_count: i64,
}

#[tauri::command]
pub fn get_game_sessions(
    app: tauri::AppHandle,
    game_id: i64,
) -> Result<Vec<DailySession>, String> {
    let conn = get_conn(&app)?;
    let mut stmt = conn.prepare(
        "SELECT
            date(started_at, 'localtime') as day,
            COALESCE(SUM(duration_seconds), 0) as total_seconds,
            COUNT(*) as session_count
         FROM sessions
         WHERE game_id = ?1
           AND duration_seconds IS NOT NULL
         GROUP BY date(started_at, 'localtime')
         ORDER BY day DESC
         LIMIT 30"
    ).map_err(|e| e.to_string())?;

    let sessions = stmt.query_map([game_id], |row| {
        Ok(DailySession {
            day: row.get(0)?,
            total_seconds: row.get(1)?,
            session_count: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|s| s.ok())
    .collect();

    Ok(sessions)
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GlobalStats {
    pub total_games: i64,
    pub total_sessions: i64,
    pub total_seconds: i64,
    pub most_played_name: Option<String>,
    pub most_played_seconds: i64,
    pub avg_session_seconds: i64,
}

#[tauri::command]
pub fn get_global_stats(app: tauri::AppHandle) -> Result<GlobalStats, String> {
    let conn = get_conn(&app)?;

    let total_games: i64 = conn.query_row(
        "SELECT COUNT(*) FROM games", [], |r| r.get(0)
    ).unwrap_or(0);

    let total_sessions: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sessions WHERE duration_seconds IS NOT NULL", [], |r| r.get(0)
    ).unwrap_or(0);

    let total_seconds: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_seconds), 0) FROM sessions WHERE duration_seconds IS NOT NULL", [], |r| r.get(0)
    ).unwrap_or(0);

    let avg_session_seconds: i64 = if total_sessions > 0 {
        total_seconds / total_sessions
    } else { 0 };

    let most_played: Option<(String, i64)> = conn.query_row(
        "SELECT g.name, COALESCE(SUM(s.duration_seconds), 0) as total
         FROM games g
         LEFT JOIN sessions s ON s.game_id = g.id
         GROUP BY g.id
         ORDER BY total DESC
         LIMIT 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?))
    ).ok();

    Ok(GlobalStats {
        total_games,
        total_sessions,
        total_seconds,
        most_played_name: most_played.as_ref().map(|(n, _)| n.clone()),
        most_played_seconds: most_played.as_ref().map(|(_, s)| *s).unwrap_or(0),
        avg_session_seconds,
    })
}

#[tauri::command]
pub fn get_setting(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let conn = get_conn(&app)?;
    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        [&key],
        |row| row.get(0),
    ).ok();
    Ok(result)
}

#[tauri::command]
pub fn set_setting(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let conn = get_conn(&app)?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        (&key, &value),
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_window_mode(app: tauri::AppHandle, mode: String) -> Result<(), String> {
    let window = app.get_webview_window("main")
        .ok_or("Janela não encontrada")?;

    match mode.as_str() {
        "console" => {
            window.set_decorations(false).map_err(|e| e.to_string())?;
            window.set_resizable(false).map_err(|e| e.to_string())?;
            window.set_fullscreen(true).map_err(|e| e.to_string())?;
        }
        "desktop_fullscreen" => {
            window.set_decorations(false).map_err(|e| e.to_string())?;
            window.set_resizable(false).map_err(|e| e.to_string())?;
            window.set_fullscreen(true).map_err(|e| e.to_string())?;
        }
        "desktop" => {
            window.set_fullscreen(false).map_err(|e| e.to_string())?;
            window.set_decorations(true).map_err(|e| e.to_string())?;
            window.set_resizable(true).map_err(|e| e.to_string())?;
            window.maximize().map_err(|e| e.to_string())?;
        }
        _ => {}
    }

    Ok(())
}

#[tauri::command]
pub fn shutdown_system() -> Result<(), String> {
    std::process::Command::new("shutdown")
        .args(["/s", "/t", "0"])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn restart_system() -> Result<(), String> {
    std::process::Command::new("shutdown")
        .args(["/r", "/t", "0"])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn exit_to_windows(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub async fn search_igdb(name: String) -> Result<Option<GameMetadata>, String> {
    crate::igdb::search_game(&name).await
}

#[tauri::command]
pub async fn fetch_igdb_cover(
    app: tauri::AppHandle,
    game_id: i64,
    game_name: String,
) -> Result<Option<String>, String> {
    let metadata = crate::igdb::search_game(&game_name).await?;

    let Some(meta) = metadata else {
        return Ok(None);
    };

    let conn = get_conn(&app)?;

    if let Some(summary) = &meta.summary {
        conn.execute(
            "UPDATE games SET description = ?1 WHERE id = ?2",
            (summary, &game_id),
        ).map_err(|e| e.to_string())?;
    }

    if let Some(genre) = &meta.genre {
        conn.execute(
            "UPDATE games SET genre = ?1 WHERE id = ?2",
            (genre, &game_id),
        ).map_err(|e| e.to_string())?;
    }

    let Some(cover_url) = meta.cover_url else {
        return Ok(None);
    };

    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let covers_dir = app_dir.join("covers");
    std::fs::create_dir_all(&covers_dir).map_err(|e| e.to_string())?;

    let cover_path = covers_dir.join(format!("{}.jpg", game_id));
    let response = reqwest::get(&cover_url).await.map_err(|e| e.to_string())?;
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&cover_path, &bytes).map_err(|e| e.to_string())?;

    let path_str = cover_path.to_str().unwrap_or("").to_string();
    conn.execute(
        "UPDATE games SET cover_path = ?1 WHERE id = ?2",
        (&path_str, &game_id),
    ).map_err(|e| e.to_string())?;

    Ok(Some(path_str))
}

#[tauri::command]
pub async fn search_igdb_preview(name: String) -> Result<Option<crate::igdb::GameMetadata>, String> {
    crate::igdb::search_game(&name).await
}