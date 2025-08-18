use tokio::sync::Mutex;
use tokio::time::{sleep, Duration, Instant};
use std::sync::Arc;
use std::future::Future;

/// デバウンス処理を提供する構造体
/// 連続した呼び出しを一定時間待機してから最後の呼び出しのみを実行
pub struct Debouncer {
    delay: Duration,
    last_trigger: Arc<Mutex<Option<Instant>>>,
    pending_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl Debouncer {
    /// 新しいDebouncerを作成
    /// delay_ms: 待機時間（ミリ秒）
    pub fn new(delay_ms: u64) -> Self {
        Self {
            delay: Duration::from_millis(delay_ms),
            last_trigger: Arc::new(Mutex::new(None)),
            pending_task: Arc::new(Mutex::new(None)),
        }
    }
    
    /// 関数をデバウンス実行
    /// 連続して呼ばれた場合、最後の呼び出しから指定時間後に実行される
    pub async fn debounce<F, Fut>(&self, f: F)
    where
        F: FnOnce() -> Fut + Send + 'static,
        Fut: Future<Output = ()> + Send,
    {
        let now = Instant::now();
        
        // 既存のタスクをキャンセル
        let mut pending = self.pending_task.lock().await;
        if let Some(handle) = pending.take() {
            handle.abort();
        }
        
        // 新しいタスクをスケジュール
        let delay = self.delay;
        let task = tokio::spawn(async move {
            sleep(delay).await;
            f().await;
        });
        
        *pending = Some(task);
        *self.last_trigger.lock().await = Some(now);
    }
    
    /// 即座に実行（デバウンスをキャンセル）
    pub async fn execute_now<F, Fut>(&self, f: F)
    where
        F: FnOnce() -> Fut + Send + 'static,
        Fut: Future<Output = ()> + Send,
    {
        // 既存のタスクをキャンセル
        let mut pending = self.pending_task.lock().await;
        if let Some(handle) = pending.take() {
            handle.abort();
        }
        
        // 即座に実行
        f().await;
    }
    
    /// ペンディング中のタスクがあるかチェック
    pub async fn has_pending(&self) -> bool {
        let pending = self.pending_task.lock().await;
        pending.is_some()
    }
    
    /// ペンディング中のタスクをキャンセル
    pub async fn cancel(&self) {
        let mut pending = self.pending_task.lock().await;
        if let Some(handle) = pending.take() {
            handle.abort();
        }
    }
}

/// ファイルごとのデバウンサーを管理
pub struct FileDebouncerManager {
    debouncers: Arc<Mutex<HashMap<PathBuf, Arc<Debouncer>>>>,
    default_delay: u64,
}

use std::path::PathBuf;
use std::collections::HashMap;

impl FileDebouncerManager {
    pub fn new(default_delay_ms: u64) -> Self {
        Self {
            debouncers: Arc::new(Mutex::new(HashMap::new())),
            default_delay: default_delay_ms,
        }
    }
    
    /// ファイル固有のデバウンサーを取得または作成
    pub async fn get_or_create(&self, path: PathBuf) -> Arc<Debouncer> {
        let mut debouncers = self.debouncers.lock().await;
        
        debouncers.entry(path)
            .or_insert_with(|| Arc::new(Debouncer::new(self.default_delay)))
            .clone()
    }
    
    /// ファイルの変更をデバウンス処理
    pub async fn debounce_file_change<F, Fut>(&self, path: PathBuf, f: F)
    where
        F: FnOnce() -> Fut + Send + 'static,
        Fut: Future<Output = ()> + Send,
    {
        let debouncer = self.get_or_create(path).await;
        debouncer.debounce(f).await;
    }
    
    /// ファイル保存時は即座に実行
    pub async fn on_file_save<F, Fut>(&self, path: PathBuf, f: F)
    where
        F: FnOnce() -> Fut + Send + 'static,
        Fut: Future<Output = ()> + Send,
    {
        let debouncer = self.get_or_create(path).await;
        debouncer.execute_now(f).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    
    #[tokio::test]
    async fn test_debouncer() {
        let debouncer = Debouncer::new(100);
        let counter = Arc::new(AtomicUsize::new(0));
        
        // 連続して3回呼び出し
        for i in 0..3 {
            let counter_clone = Arc::clone(&counter);
            debouncer.debounce(move || async move {
                counter_clone.fetch_add(1, Ordering::SeqCst);
            }).await;
            
            if i < 2 {
                sleep(Duration::from_millis(50)).await;
            }
        }
        
        // デバウンス時間待機
        sleep(Duration::from_millis(150)).await;
        
        // 最後の呼び出しのみが実行されるため、カウンターは1
        assert_eq!(counter.load(Ordering::SeqCst), 1);
    }
    
    #[tokio::test]
    async fn test_execute_now() {
        let debouncer = Debouncer::new(100);
        let counter = Arc::new(AtomicUsize::new(0));
        
        let counter_clone = Arc::clone(&counter);
        debouncer.execute_now(move || async move {
            counter_clone.fetch_add(1, Ordering::SeqCst);
        }).await;
        
        // 即座に実行されるため、カウンターは1
        assert_eq!(counter.load(Ordering::SeqCst), 1);
    }
}