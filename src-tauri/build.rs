fn main() {
  let key = std::env::var("STEAM_API_KEY")
    .ok()
    .or_else(|| std::fs::read_to_string("steam_key.txt").ok())
    .unwrap_or_default();

  std::fs::write("steam_key.txt", key.trim())
    .expect("failed to write src-tauri/steam_key.txt");

  println!("cargo:rerun-if-env-changed=STEAM_API_KEY");
  println!("cargo:rerun-if-changed=steam_key.txt");

  tauri_build::build()
}
