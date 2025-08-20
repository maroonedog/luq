use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

pub struct CycleDetector {
    // 隣接リスト表現のグラフ
    graph: HashMap<PathBuf, HashSet<PathBuf>>,
}

impl CycleDetector {
    pub fn new() -> Self {
        Self {
            graph: HashMap::new(),
        }
    }
    
    /// DependencyGraphから構築
    pub fn from_graph(dep_graph: &super::graph::DependencyGraph) -> Self {
        let mut detector = Self::new();
        
        // 各モジュールの依存関係をグラフに追加
        for path in dep_graph.get_all_modules() {
            if let Some(node) = dep_graph.get_node(path) {
                // Extract dependencies from imports
                for import in &node.imports {
                    if let Some(resolved) = &import.resolved_path {
                        detector.add_edge(path.clone(), resolved.clone());
                    }
                }
            }
        }
        
        detector
    }
    
    /// エッジを追加
    pub fn add_edge(&mut self, from: PathBuf, to: PathBuf) {
        self.graph
            .entry(from)
            .or_insert_with(HashSet::new)
            .insert(to);
    }
    
    /// Tarjanのアルゴリズムを使って強連結成分（SCC）を検出
    pub fn detect_cycles(&self) -> Vec<Vec<PathBuf>> {
        let mut index_counter = 0;
        let mut stack = Vec::new();
        let mut indices = HashMap::new();
        let mut lowlinks = HashMap::new();
        let mut on_stack = HashSet::new();
        let mut sccs = Vec::new();
        
        // 全ノードに対してTarjanのアルゴリズムを実行
        for node in self.graph.keys() {
            if !indices.contains_key(node) {
                self.strongconnect(
                    node.clone(),
                    &mut index_counter,
                    &mut stack,
                    &mut indices,
                    &mut lowlinks,
                    &mut on_stack,
                    &mut sccs,
                );
            }
        }
        
        // サイズが2以上のSCCのみを循環依存として返す
        sccs.into_iter()
            .filter(|scc| scc.len() >= 2)
            .collect()
    }
    
    fn strongconnect(
        &self,
        v: PathBuf,
        index_counter: &mut usize,
        stack: &mut Vec<PathBuf>,
        indices: &mut HashMap<PathBuf, usize>,
        lowlinks: &mut HashMap<PathBuf, usize>,
        on_stack: &mut HashSet<PathBuf>,
        sccs: &mut Vec<Vec<PathBuf>>,
    ) {
        // ノードvにインデックスを割り当て、スタックに追加
        indices.insert(v.clone(), *index_counter);
        lowlinks.insert(v.clone(), *index_counter);
        *index_counter += 1;
        stack.push(v.clone());
        on_stack.insert(v.clone());
        
        // vの後続ノードを探索
        if let Some(neighbors) = self.graph.get(&v) {
            for w in neighbors {
                if !indices.contains_key(w) {
                    // wがまだ訪問されていない場合、再帰的に探索
                    self.strongconnect(
                        w.clone(),
                        index_counter,
                        stack,
                        indices,
                        lowlinks,
                        on_stack,
                        sccs,
                    );
                    
                    // lowlinkを更新
                    let v_lowlink = *lowlinks.get(&v).unwrap();
                    let w_lowlink = *lowlinks.get(w).unwrap();
                    lowlinks.insert(v.clone(), v_lowlink.min(w_lowlink));
                } else if on_stack.contains(w) {
                    // wがスタック上にある場合、lowlinkを更新
                    let v_lowlink = *lowlinks.get(&v).unwrap();
                    let w_index = *indices.get(w).unwrap();
                    lowlinks.insert(v.clone(), v_lowlink.min(w_index));
                }
            }
        }
        
        // vがSCCのルートの場合
        if lowlinks.get(&v) == indices.get(&v) {
            let mut scc = Vec::new();
            
            // スタックからSCCのノードを取り出す
            loop {
                let w = stack.pop().unwrap();
                on_stack.remove(&w);
                scc.push(w.clone());
                
                if w == v {
                    break;
                }
            }
            
            sccs.push(scc);
        }
    }
    
    /// 特定のパスが循環依存に含まれているかチェック
    pub fn is_in_cycle(&self, path: &PathBuf) -> bool {
        let cycles = self.detect_cycles();
        cycles.iter().any(|cycle| cycle.contains(path))
    }
    
    /// 循環依存のパスを人間が読みやすい形式で返す
    pub fn format_cycles(&self) -> Vec<String> {
        let cycles = self.detect_cycles();
        
        cycles.into_iter().map(|mut cycle| {
            // 循環を分かりやすくするため、最初の要素を最後にも追加
            if !cycle.is_empty() {
                cycle.push(cycle[0].clone());
            }
            
            cycle.iter()
                .map(|p| p.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("?")
                    .to_string())
                .collect::<Vec<_>>()
                .join(" -> ")
        }).collect()
    }
}