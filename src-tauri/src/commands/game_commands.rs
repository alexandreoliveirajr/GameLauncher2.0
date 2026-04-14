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
    pub description: Option<String>,
    pub added_at: String,
    pub is_favorite: bool,
    pub last_played_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DailySession {
    pub day: String,
    pub total_seconds: i64,
    pub session_count: i64,
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

pub fn get_conn(app: &tauri::AppHandle) -> Result<Connection, String> {
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
