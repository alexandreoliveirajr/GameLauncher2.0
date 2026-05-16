use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportedStoreGame {
    pub name: String,
    pub exe_path: String,
    pub store: String, // "Steam" ou "Epic"
    pub cover_url: Option<String>,
}

/// Varre o diretório padrão da Steam em busca de arquivos .acf
pub fn scan_steam_games() -> Vec<ImportedStoreGame> {
    let mut games = Vec::new();
    
    let base_path = Path::new("C:\\Program Files (x86)\\Steam");
    let mut library_paths = vec![base_path.join("steamapps")];
    
    // Tenta ler o libraryfolders.vdf para encontrar jogos em outros HDs
    let vdf_path = library_paths[0].join("libraryfolders.vdf");
    if vdf_path.exists() {
        if let Ok(content) = fs::read_to_string(&vdf_path) {
            for line in content.lines() {
                let line = line.trim();
                if line.starts_with("\"path\"") {
                    let parts: Vec<&str> = line.split('\"').collect();
                    if parts.len() >= 4 {
                        // VDF usa barras duplas (escapadas)
                        let path_str = parts[3].replace("\\\\", "\\");
                        let other_lib = PathBuf::from(path_str).join("steamapps");
                        if !library_paths.contains(&other_lib) {
                            library_paths.push(other_lib);
                        }
                    }
                }
            }
        }
    }

    for steamapps_path in library_paths {
        if !steamapps_path.exists() {
            continue;
        }

        if let Ok(entries) = fs::read_dir(&steamapps_path) {
            for entry in entries.filter_map(Result::ok) {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    if ext == "acf" {
                        if let Ok(content) = fs::read_to_string(&path) {
                            let mut appid = String::new();
                            let mut name = String::new();

                            for line in content.lines() {
                                let line = line.trim();
                                if line.starts_with("\"appid\"") {
                                    let parts: Vec<&str> = line.split('\"').collect();
                                    if parts.len() >= 4 { appid = parts[3].to_string(); }
                                } else if line.starts_with("\"name\"") {
                                    let parts: Vec<&str> = line.split('\"').collect();
                                    if parts.len() >= 4 { name = parts[3].to_string(); }
                                }
                            }

                            if !appid.is_empty() && !name.is_empty() {
                                games.push(ImportedStoreGame {
                                    name,
                                    exe_path: format!("steam://rungameid/{}", appid),
                                    store: "Steam".to_string(),
                                    cover_url: Some(format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{}/library_600x900_2x.jpg", appid)),
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    games
}

/// Varre o diretório padrão da Epic Games
pub fn scan_epic_games() -> Vec<ImportedStoreGame> {
    let mut games = Vec::new();
    let manifests_path = Path::new("C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests");

    if !manifests_path.exists() {
        return games;
    }

    if let Ok(entries) = fs::read_dir(manifests_path) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if let Some(ext) = path.extension() {
                if ext == "item" {
                    if let Ok(content) = fs::read_to_string(&path) {
                        // Parse JSON rústico sem overhead de desserialização completa
                        // (Epic salva como .item em formato JSON)
                        let mut name = String::new();
                        let mut app_name = String::new();

                        for line in content.lines() {
                            let line = line.trim();
                            if line.starts_with("\"DisplayName\":") {
                                let parts: Vec<&str> = line.split('\"').collect();
                                if parts.len() >= 4 { name = parts[3].to_string(); }
                            } else if line.starts_with("\"AppName\":") {
                                let parts: Vec<&str> = line.split('\"').collect();
                                if parts.len() >= 4 { app_name = parts[3].to_string(); }
                            }
                        }

                        if !name.is_empty() && !app_name.is_empty() && name != "Epic Games Launcher" {
                            games.push(ImportedStoreGame {
                                name,
                                // Protocolo da Epic Games
                                exe_path: format!("com.epicgames.launcher://apps/{}?action=launch&silent=true", app_name),
                                store: "Epic".to_string(),
                                cover_url: None,
                            });
                        }
                    }
                }
            }
        }
    }
    games
}
