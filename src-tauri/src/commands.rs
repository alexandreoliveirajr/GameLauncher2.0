use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: i64,
    pub name: String,
    pub exe_path: String,
    pub genre: String,
    pub cover_path: Option<String>,
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
        "SELECT id, name, exe_path, genre, cover_path, added_at, is_favorite, last_played_at FROM games ORDER BY name ASC"
    ).map_err(|e| e.to_string())?;

    let games = stmt.query_map([], |row| {
        Ok(Game {
            id: row.get(0)?,
            name: row.get(1)?,
            exe_path: row.get(2)?,
            genre: row.get(3)?,
            cover_path: row.get(4)?,
            added_at: row.get(5)?,
            is_favorite: row.get::<_, i32>(6)? == 1,
            last_played_at: row.get(7)?,
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
               (julianday('now') - julianday(started_at)) * 86400
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
        "redist", "redistributable", "directx", "vcredist", "dotnet",
        "setup", "install", "uninstall", "crash", "report", "update",
        "launcher", "helper", "support", "prerequisites", "benchmark",
        "_commonredist", "dx", "physx",
    ];

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();

        if path.is_dir() {
            scan_recursive(&path, found, depth + 1);
        } else if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext.to_str().unwrap_or("").to_lowercase() == "exe" {
                    let exe_name = path.file_stem()
                        .unwrap_or_default()
                        .to_str()
                        .unwrap_or("")
                        .to_lowercase();

                    let should_ignore = ignore.iter().any(|i| exe_name.contains(i));
                    if !should_ignore {
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
    conn.execute("DELETE FROM games WHERE id = ?1", [game_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM sessions WHERE game_id = ?1", [game_id])
        .map_err(|e| e.to_string())?;
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
            date(started_at) as day,
            COALESCE(SUM(duration_seconds), 0) as total_seconds,
            COUNT(*) as session_count
         FROM sessions
         WHERE game_id = ?1
           AND duration_seconds IS NOT NULL
         GROUP BY date(started_at)
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