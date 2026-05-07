use serde::{Deserialize, Serialize};
use super::game_commands::get_conn;

#[derive(Serialize, Deserialize, Debug)]
pub struct ScannedGame {
    pub name: String,
    pub exe_path: String,
}

#[tauri::command]
pub fn scan_folder(app: tauri::AppHandle, path: String) -> Result<Vec<ScannedGame>, String> {
    let conn = get_conn(&app)?;
    
    let mut stmt = conn.prepare("SELECT exe_path FROM games").map_err(|e| e.to_string())?;
    let existing_paths: Vec<String> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|p| p.ok())
        .collect();

    let mut found: Vec<ScannedGame> = Vec::new();
    scan_recursive(&std::path::Path::new(&path), &mut found, 0, &existing_paths);
    Ok(found)
}

fn scan_recursive(dir: &std::path::Path, found: &mut Vec<ScannedGame>, depth: u32, existing_paths: &[String]) {
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
        "crash", "crashpad", "crashreport", "crashhandler", "reporter",
        "report", "bugreport", "helper", "support", "subprocess", "worker", "service",
        "benchmark", "tool", "tools", "utility", "config", "setting",
        "easyanticheat", "battleye", "be_service", "anticheat",
        "steam_api", "steamworks",
        "upc", "uplay", "galaxyclient", "gog",
        "epicgameslauncher", "bethesdanetlauncher",
        "cefsharp", "crashpad_handler", "dxdiag",
        "activation", "register", "elevate",
        "7za", "7z", "winrar", "unzip", "arc",
        "ffmpeg", "imagemagick", "convert",
        "x86", "win32", "32bit", "x32", "server", "dedicated"
    ];

    let ignore_dirs = vec![
        "redist", "redistributable", "_commonredist", "directx",
        "support", "tools", "tool", "helper", "helpers",
        "dotnet", "vcredist", "prerequisites", "prerequisite",
        "__pycache__", "node_modules", ".git", "win32", "x86", "32bit"
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
                scan_recursive(&path, found, depth + 1, existing_paths);
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

                    let name = path.file_stem()
                        .unwrap_or_default()
                        .to_str()
                        .unwrap_or("")
                        .to_string();

                    let exe_path_str = path.to_str().unwrap_or("").to_string();
                    
                    // Ignora se o jogo já estiver cadastrado no banco de dados
                    if existing_paths.contains(&exe_path_str) {
                        continue;
                    }

                    found.push(ScannedGame {
                        name,
                        exe_path: exe_path_str,
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
