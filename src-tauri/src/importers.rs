use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportedStoreGame {
    pub name: String,
    pub exe_path: String,
    pub store: String,
    pub cover_url: Option<String>,
    pub install_url: Option<String>,
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
                                    install_url: None, // Steam usa steam://install/{appid} montado no Rust
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

/// Varre o diretório padrão da Epic Games e extrai metadados dos manifests .item
pub fn scan_epic_games() -> Vec<ImportedStoreGame> {
    let mut games = Vec::new();
    let manifests_path = Path::new("C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests");

    if !manifests_path.exists() {
        return games;
    }

    if let Ok(entries) = fs::read_dir(manifests_path) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "item") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                        let name = match json["DisplayName"].as_str() {
                            Some(n) if !n.is_empty() && n != "Epic Games Launcher" => n.to_string(),
                            _ => continue,
                        };

                        let app_name = match json["AppName"].as_str() {
                            Some(a) if !a.is_empty() => a.to_string(),
                            _ => continue,
                        };

                        let catalog_namespace = json["CatalogNamespace"].as_str().unwrap_or("").to_string();
                        let catalog_item_id = json["CatalogItemId"].as_str().unwrap_or("").to_string();

                        // Monta URL de instalação com todos os identificadores necessários
                        let install_url = if !catalog_namespace.is_empty() && !catalog_item_id.is_empty() {
                            Some(format!(
                                "com.epicgames.launcher://apps/{}%3A{}%3A{}?action=install",
                                catalog_namespace, catalog_item_id, app_name
                            ))
                        } else {
                            None
                        };

                        // Extrai a capa vertical "DieselGameBoxTall" do array KeyImages
                        let cover_url = json["KeyImages"]
                            .as_array()
                            .and_then(|images| {
                                // Prefer DieselGameBoxTall (vertical cover), fallback para qualquer imagem
                                images.iter()
                                    .find(|img| img["type"].as_str() == Some("DieselGameBoxTall"))
                                    .or_else(|| images.iter().find(|img| img["type"].as_str() == Some("DieselGameBox")))
                                    .or_else(|| images.first())
                                    .and_then(|img| img["url"].as_str())
                                    .map(|s| s.to_string())
                            });

                        games.push(ImportedStoreGame {
                            name,
                            exe_path: format!("com.epicgames.launcher://apps/{}?action=launch&silent=true", app_name),
                            store: "Epic".to_string(),
                            cover_url,
                            install_url,
                        });
                    }
                }
            }
        }
    }
    games
}
