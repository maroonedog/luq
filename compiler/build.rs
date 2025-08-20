// build.rs - Build script for platform-specific configuration

fn main() {
    // Detect the target platform
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_else(|_| "unknown".to_string());
    
    // Set platform-specific configurations
    match target_os.as_str() {
        "windows" => {
            println!("cargo:rustc-link-lib=dylib=ws2_32");
            println!("cargo:rustc-cfg=windows_build");
        }
        "linux" => {
            println!("cargo:rustc-cfg=linux_build");
        }
        "macos" => {
            println!("cargo:rustc-cfg=macos_build");
        }
        _ => {}
    }
    
    // Avoid proc-macro issues by disabling certain features in cross-platform builds
    if std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default() == "msvc" {
        println!("cargo:rustc-cfg=disable_proc_macros");
    }
}