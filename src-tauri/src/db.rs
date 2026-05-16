use rusqlite::Connection;
use std::fs;
use tauri::Manager;

pub fn init(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("nexus.db");
    let conn = Connection::open(&db_path)?;

    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS games (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            name           TEXT NOT NULL,
            exe_path       TEXT NOT NULL,
            genre          TEXT NOT NULL DEFAULT 'Geral',
            cover_path     TEXT,
            description    TEXT,
            added_at       TEXT NOT NULL DEFAULT (datetime('now')),
            is_favorite    INTEGER NOT NULL DEFAULT 0,
            last_played_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id          INTEGER NOT NULL,
            started_at       TEXT NOT NULL,
            ended_at         TEXT,
            duration_seconds INTEGER,
            FOREIGN KEY (game_id) REFERENCES games(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scan_paths (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            path            TEXT NOT NULL,
            last_scanned_at TEXT
        );
    ")?;

    let _ = conn.execute(
        "ALTER TABLE games ADD COLUMN description TEXT",
        [],
    );

    let _ = conn.execute(
        "ALTER TABLE games ADD COLUMN is_installed INTEGER NOT NULL DEFAULT 1",
        [],
    );

    // Corrige o bug de tempo de jogo:
    // Se o launcher foi fechado enquanto um jogo estava rodando, a sessão ficou aberta.
    // Setamos duration_seconds = 0 para não contabilizar 50 horas na próxima vez que abrir.
    let _ = conn.execute(
        "UPDATE sessions
         SET ended_at = started_at,
             duration_seconds = 0
         WHERE ended_at IS NULL",
        [],
    );

    println!("Banco inicializado em: {:?}", db_path);
    Ok(())
}