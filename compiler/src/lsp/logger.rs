use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;

pub struct Logger {
    file: Mutex<Option<std::fs::File>>,
}

impl Logger {
    pub fn new() -> Self {
        // Try to create log file in temp directory
        let log_path = if cfg!(windows) {
            std::env::temp_dir().join("luq-lsp.log")
        } else {
            std::path::PathBuf::from("/tmp/luq-lsp.log")
        };
        
        eprintln!("LSP log file: {:?}", log_path);
        
        match OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            Ok(file) => {
                Logger {
                    file: Mutex::new(Some(file))
                }
            }
            Err(e) => {
                eprintln!("Failed to create log file: {}", e);
                Logger {
                    file: Mutex::new(None)
                }
            }
        }
    }
    
    pub fn log(&self, message: &str) {
        // Also print to stderr
        eprintln!("{}", message);
        
        // Write to log file
        if let Ok(mut guard) = self.file.lock() {
            if let Some(ref mut file) = *guard {
                let _ = writeln!(file, "{}", message);
                let _ = file.flush();
            }
        }
    }
}

// Global logger instance
static mut LOGGER: Option<Logger> = None;
static INIT: std::sync::Once = std::sync::Once::new();

pub fn init_logger() {
    unsafe {
        INIT.call_once(|| {
            LOGGER = Some(Logger::new());
        });
    }
}

pub fn log(message: &str) {
    unsafe {
        if let Some(ref logger) = LOGGER {
            logger.log(message);
        } else {
            eprintln!("{}", message);
        }
    }
}

#[macro_export]
macro_rules! lsp_log {
    ($($arg:tt)*) => {
        {
            let message = format!($($arg)*);
            $crate::lsp::logger::log(&message);
        }
    };
}