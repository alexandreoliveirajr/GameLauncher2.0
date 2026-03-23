use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Serialize, Deserialize, Debug)]
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