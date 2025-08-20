use std::path::{Path, PathBuf};
use std::collections::HashMap;
use anyhow::{Result, bail};

pub struct ImportResolver {
    // プロジェクトルート
    #[allow(dead_code)]
    root: PathBuf,
    // node_modules パス
    #[allow(dead_code)]
    node_modules: Vec<PathBuf>,
    // パスエイリアス (tsconfig.jsonのpaths相当)
    #[allow(dead_code)]
    path_aliases: HashMap<String, Vec<String>>,
    // 解決キャッシュ
    #[allow(dead_code)]
    cache: HashMap<(PathBuf, String), PathBuf>,
}

impl ImportResolver {
    pub fn new(root: PathBuf) -> Self {
        let mut node_modules = Vec::new();
        
        // プロジェクトルートのnode_modules
        let root_nm = root.join("node_modules");
        if root_nm.exists() {
            node_modules.push(root_nm);
        }
        
        // 親ディレクトリのnode_modulesも探索
        let mut current = root.clone();
        while let Some(parent) = current.parent() {
            let nm = parent.join("node_modules");
            if nm.exists() {
                node_modules.push(nm);
            }
            current = parent.to_path_buf();
        }
        
        Self {
            root,
            node_modules,
            path_aliases: HashMap::new(),
            cache: HashMap::new(),
        }
    }
    
    /// パスエイリアスを設定
    pub fn add_alias(&mut self, alias: String, paths: Vec<String>) {
        self.path_aliases.insert(alias, paths);
    }
    
    /// インポートパスを解決
    pub fn resolve(&self, from: &Path, import_path: &str) -> Result<PathBuf> {
        // キャッシュチェック
        let cache_key = (from.to_path_buf(), import_path.to_string());
        if let Some(cached) = self.cache.get(&cache_key) {
            return Ok(cached.clone());
        }
        
        let resolved = if import_path.starts_with("./") || import_path.starts_with("../") {
            // 相対パスの解決
            self.resolve_relative(from, import_path)?
        } else if import_path.starts_with("@") || import_path.starts_with("~") {
            // エイリアスの解決
            self.resolve_alias(import_path)?
        } else {
            // node_modulesまたは絶対パスの解決
            self.resolve_absolute(import_path)?
        };
        
        Ok(resolved)
    }
    
    fn resolve_relative(&self, from: &Path, import_path: &str) -> Result<PathBuf> {
        let base_dir = from.parent()
            .ok_or_else(|| anyhow::anyhow!("Cannot get parent directory of {:?}", from))?;
        
        let path = base_dir.join(import_path);
        
        // 拡張子の補完を試みる
        if !path.exists() {
            for ext in &[".luq", ".ts", ".js", ".tsx", ".jsx"] {
                let with_ext = PathBuf::from(format!("{}{}", path.display(), ext));
                if with_ext.exists() {
                    return Ok(with_ext.canonicalize()?);
                }
            }
            
            // index ファイルを探す
            for index in &["index.luq", "index.ts", "index.js"] {
                let index_path = path.join(index);
                if index_path.exists() {
                    return Ok(index_path.canonicalize()?);
                }
            }
        }
        
        if path.exists() {
            Ok(path.canonicalize()?)
        } else {
            bail!("Cannot resolve relative import '{}' from {:?}", import_path, from)
        }
    }
    
    fn resolve_alias(&self, import_path: &str) -> Result<PathBuf> {
        // エイリアスのプレフィックスを検索
        for (alias, paths) in &self.path_aliases {
            if import_path.starts_with(alias) {
                let suffix = &import_path[alias.len()..];
                let suffix = suffix.trim_start_matches('/');
                
                for base_path in paths {
                    let full_path = PathBuf::from(base_path).join(suffix);
                    
                    // 拡張子補完
                    if !full_path.exists() {
                        for ext in &[".luq", ".ts", ".js"] {
                            let with_ext = PathBuf::from(format!("{}{}", full_path.display(), ext));
                            if with_ext.exists() {
                                return Ok(with_ext.canonicalize()?);
                            }
                        }
                        
                        // index ファイル
                        for index in &["index.luq", "index.ts", "index.js"] {
                            let index_path = full_path.join(index);
                            if index_path.exists() {
                                return Ok(index_path.canonicalize()?);
                            }
                        }
                    }
                    
                    if full_path.exists() {
                        return Ok(full_path.canonicalize()?);
                    }
                }
            }
        }
        
        bail!("Cannot resolve alias '{}'", import_path)
    }
    
    fn resolve_absolute(&self, import_path: &str) -> Result<PathBuf> {
        // 絶対パスの場合
        if import_path.starts_with("/") {
            let path = PathBuf::from(import_path);
            if path.exists() {
                return Ok(path.canonicalize()?);
            }
        }
        
        // node_modules から探す
        for nm_path in &self.node_modules {
            let module_path = nm_path.join(import_path);
            
            // 直接ファイルを探す
            if module_path.exists() {
                return Ok(module_path.canonicalize()?);
            }
            
            // 拡張子を補完
            for ext in &[".luq", ".ts", ".js", ".d.ts"] {
                let with_ext = PathBuf::from(format!("{}{}", module_path.display(), ext));
                if with_ext.exists() {
                    return Ok(with_ext.canonicalize()?);
                }
            }
            
            // package.json の main フィールドを確認
            let package_json = module_path.join("package.json");
            if package_json.exists() {
                if let Ok(content) = std::fs::read_to_string(&package_json) {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(main) = json.get("main").and_then(|v| v.as_str()) {
                            let main_path = module_path.join(main);
                            if main_path.exists() {
                                return Ok(main_path.canonicalize()?);
                            }
                        }
                        
                        // types フィールドも確認
                        if let Some(types) = json.get("types").and_then(|v| v.as_str()) {
                            let types_path = module_path.join(types);
                            if types_path.exists() {
                                return Ok(types_path.canonicalize()?);
                            }
                        }
                    }
                }
            }
            
            // index ファイルを探す
            for index in &["index.luq", "index.ts", "index.js", "index.d.ts"] {
                let index_path = module_path.join(index);
                if index_path.exists() {
                    return Ok(index_path.canonicalize()?);
                }
            }
        }
        
        bail!("Cannot resolve module '{}'", import_path)
    }
}