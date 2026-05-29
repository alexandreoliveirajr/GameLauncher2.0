fn main() {
    let key = std::env::var("STEAM_API_KEY")
        .ok()
        .or_else(|| std::fs::read_to_string("steam_key.txt").ok())
        .unwrap_or_default();

    let key = key.trim();
    println!("cargo:rustc-env=STEAM_API_KEY={key}");
    println!("cargo:rerun-if-env-changed=STEAM_API_KEY");
    println!("cargo:rerun-if-changed=steam_key.txt");

    tauri_build::build()
}
