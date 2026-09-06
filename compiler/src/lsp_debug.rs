use tower_lsp::jsonrpc::Result;
use tower_lsp::lsp_types::*;
use tower_lsp::{Client, LanguageServer, LspService, Server};

use luq_compiler::lexer::tokenize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

static REQUEST_COUNTER: AtomicUsize = AtomicUsize::new(0);

#[derive(Debug)]
struct Backend {
    client: Client,
    documents: Arc<Mutex<HashMap<Url, String>>>,
    pending_requests: Arc<Mutex<HashMap<usize, RequestInfo>>>,
}

#[derive(Debug, Clone)]
struct RequestInfo {
    id: usize,
    start_time: Instant,
    request_type: String,
    uri: String,
}

#[tower_lsp::async_trait]
impl LanguageServer for Backend {
    async fn initialize(&self, _: InitializeParams) -> Result<InitializeResult> {
        self.client
            .log_message(MessageType::INFO, "LSP DEBUG: Initialize called")
            .await;
            
        Ok(InitializeResult {
            capabilities: ServerCapabilities {
                text_document_sync: Some(TextDocumentSyncCapability::Kind(
                    TextDocumentSyncKind::FULL,
                )),
                completion_provider: Some(CompletionOptions {
                    resolve_provider: Some(false),
                    trigger_characters: Some(vec![
                        "@".to_string(),
                        ".".to_string(),
                        ":".to_string(),
                    ]),
                    all_commit_characters: None,
                    work_done_progress_options: Default::default(),
                    completion_item: None,
                }),
                hover_provider: Some(HoverProviderCapability::Simple(true)),
                ..Default::default()
            },
            ..Default::default()
        })
    }

    async fn initialized(&self, _: InitializedParams) {
        self.client
            .log_message(MessageType::INFO, "LSP DEBUG: Server initialized!")
            .await;
    }

    async fn shutdown(&self) -> Result<()> {
        self.client
            .log_message(MessageType::INFO, "LSP DEBUG: Shutdown called")
            .await;
        
        // Log any pending requests
        let pending_count = {
            let pending = self.pending_requests.lock().unwrap();
            if pending.is_empty() {
                0
            } else {
                pending.len()
            }
        }; // pending is dropped here
        
        if pending_count > 0 {
            let msg = format!("LSP DEBUG: Shutdown with {} pending requests", pending_count);
            self.client.log_message(MessageType::WARNING, msg).await;
        }
        
        Ok(())
    }

    async fn did_open(&self, params: DidOpenTextDocumentParams) {
        let uri = params.text_document.uri.clone();
        let text = params.text_document.text.clone();
        let doc_len = text.len();
        
        // Store document
        let doc_count = {
            let mut documents = self.documents.lock().unwrap();
            documents.insert(uri.clone(), text.clone());
            documents.len()
        }; // documents is dropped here
        
        self.client
            .log_message(
                MessageType::INFO, 
                format!("LSP DEBUG: Document opened: {} ({} bytes, {} total docs)", uri, doc_len, doc_count)
            )
            .await;
        
        self.send_diagnostics(uri, text).await;
    }

    async fn did_change(&self, params: DidChangeTextDocumentParams) {
        let uri = params.text_document.uri.clone();
        if let Some(change) = params.content_changes.first() {
            let text = change.text.clone();
            let doc_len = text.len();
            
            // Update document
            {
                let mut documents = self.documents.lock().unwrap();
                documents.insert(uri.clone(), text.clone());
            }
            
            self.client
                .log_message(
                    MessageType::INFO, 
                    format!("LSP DEBUG: Document changed: {} ({} bytes)", uri, doc_len)
                )
                .await;
            
            self.send_diagnostics(uri, text).await;
        }
    }

    async fn did_close(&self, params: DidCloseTextDocumentParams) {
        let uri = params.text_document.uri.clone();
        
        let remaining = {
            let mut documents = self.documents.lock().unwrap();
            documents.remove(&uri);
            documents.len()
        }; // documents is dropped here
        
        self.client
            .log_message(
                MessageType::INFO,
                format!("LSP DEBUG: Document closed: {} ({} remaining)", uri, remaining)
            )
            .await;
    }

    async fn completion(&self, params: CompletionParams) -> Result<Option<CompletionResponse>> {
        let request_id = REQUEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        let start_time = Instant::now();
        let uri = params.text_document_position.text_document.uri.clone();
        let position = params.text_document_position.position;
        
        // Register request
        let pending_count = {
            let mut pending = self.pending_requests.lock().unwrap();
            pending.insert(request_id, RequestInfo {
                id: request_id,
                start_time,
                request_type: "completion".to_string(),
                uri: uri.to_string(),
            });
            pending.len()
        }; // pending is dropped here
        
        self.client
            .log_message(
                MessageType::INFO, 
                format!("LSP DEBUG: Completion #{} START at {}:{}:{} ({} pending)",
                    request_id, uri, position.line, position.character, pending_count)
            )
            .await;
        
        // Get document with timing
        let doc_fetch_start = Instant::now();
        let (text_opt, doc_count) = {
            let documents = self.documents.lock().unwrap();
            (documents.get(&uri).cloned(), documents.len())
        }; // documents is dropped here
        
        self.client
            .log_message(
                MessageType::INFO,
                format!("LSP DEBUG: #{} Document fetch took {:?} ({} docs in cache)",
                    request_id, doc_fetch_start.elapsed(), doc_count)
            )
            .await;
        
        let text = match text_opt {
            Some(text) => text,
            None => {
                self.client
                    .log_message(
                        MessageType::WARNING, 
                        format!("LSP DEBUG: #{} Document not found: {}", request_id, uri)
                    )
                    .await;
                
                // Unregister request
                self.pending_requests.lock().unwrap().remove(&request_id);
                return Ok(None);
            }
        };
        
        // Parse position
        let lines: Vec<&str> = text.lines().collect();
        if position.line as usize >= lines.len() {
            self.client
                .log_message(
                    MessageType::WARNING,
                    format!("LSP DEBUG: #{} Line {} out of range (doc has {} lines)",
                        request_id, position.line, lines.len())
                )
                .await;
            
            self.pending_requests.lock().unwrap().remove(&request_id);
            return Ok(None);
        }
        
        let line = lines[position.line as usize];
        let char_pos = position.character as usize;
        let before_cursor = if char_pos <= line.len() {
            &line[..char_pos]
        } else {
            line
        };
        
        self.client
            .log_message(
                MessageType::INFO,
                format!("LSP DEBUG: #{} Before cursor: '{}'", request_id, before_cursor)
            )
            .await;
        
        // Generate completions
        let mut completions = vec![];
        
        // Log decorator check conditions
        let ends_with_at = before_cursor.ends_with("@");
        let trim_ends_with_at = before_cursor.trim_end().ends_with("@");
        let starts_with_at_no_space = before_cursor.len() > 0 && {
            let trimmed = before_cursor.trim_start();
            trimmed.starts_with("@") && !trimmed.contains(' ')
        };
        
        self.client
            .log_message(
                MessageType::INFO,
                format!("LSP DEBUG: #{} Decorator check - ends_with_@: {}, trim_ends_with_@: {}, starts_with_@_no_space: {}",
                    request_id, ends_with_at, trim_ends_with_at, starts_with_at_no_space)
            )
            .await;
        
        // Check for decorator trigger
        if ends_with_at || trim_ends_with_at || starts_with_at_no_space {
            self.client
                .log_message(MessageType::INFO, format!("LSP DEBUG: #{} Adding decorator completions", request_id))
                .await;
                
            completions.extend(vec![
                CompletionItem {
                    label: "required".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Mark field as required".to_string()),
                    insert_text: Some("required".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "optional".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Mark field as optional".to_string()),
                    insert_text: Some("optional".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "validator".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Mark interface as validator".to_string()),
                    insert_text: Some("validator".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "validateUser".to_string(),
                    kind: Some(CompletionItemKind::FUNCTION),
                    detail: Some("Custom validator function".to_string()),
                    insert_text: Some("validateUser()".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "pattern".to_string(),
                    kind: Some(CompletionItemKind::FUNCTION),
                    detail: Some("Set regex pattern: @pattern(/regex/)".to_string()),
                    insert_text: Some("pattern(/$1/)".to_string()),
                    ..Default::default()
                },
            ]);
        } else {
            // Log when NOT providing decorator completions
            self.client
                .log_message(
                    MessageType::INFO,
                    format!("LSP DEBUG: #{} NOT providing decorator completions (before_cursor: '{}')", 
                        request_id, before_cursor)
                )
                .await;
        }
        
        // Check if we should add keyword completions (for debugging the "all candidates" issue)
        let trimmed = before_cursor.trim_start();
        let should_add_keywords = trimmed.is_empty() || before_cursor.ends_with(" ") || before_cursor.ends_with("\n");
        
        self.client
            .log_message(
                MessageType::INFO,
                format!("LSP DEBUG: #{} Keyword check - trimmed.is_empty: {}, ends_with_space: {}, ends_with_newline: {}, should_add: {}",
                    request_id, trimmed.is_empty(), before_cursor.ends_with(" "), before_cursor.ends_with("\n"), should_add_keywords)
            )
            .await;
        
        // Only add one test keyword to see if this is the issue
        if should_add_keywords && !ends_with_at && !trim_ends_with_at && !starts_with_at_no_space {
            self.client
                .log_message(MessageType::INFO, format!("LSP DEBUG: #{} Adding keyword completions", request_id))
                .await;
            
            completions.push(CompletionItem {
                label: "interface".to_string(),
                kind: Some(CompletionItemKind::KEYWORD),
                detail: Some("Define an interface".to_string()),
                insert_text: Some("interface".to_string()),
                ..Default::default()
            });
        }
        
        // Finalize request
        let elapsed = start_time.elapsed();
        let remaining = {
            let mut pending = self.pending_requests.lock().unwrap();
            pending.remove(&request_id);
            pending.len()
        }; // pending is dropped here
        
        self.client
            .log_message(
                MessageType::INFO,
                format!("LSP DEBUG: Completion #{} COMPLETE in {:?} with {} items ({} pending)",
                    request_id, elapsed, completions.len(), remaining)
            )
            .await;
        
        // Check if response took too long
        if elapsed.as_millis() > 1000 {
            self.client
                .log_message(
                    MessageType::WARNING,
                    format!("LSP DEBUG: Completion #{} took {:?} (SLOW)", request_id, elapsed)
                )
                .await;
        }
        
        if completions.is_empty() {
            Ok(None)
        } else {
            Ok(Some(CompletionResponse::Array(completions)))
        }
    }

    async fn hover(&self, params: HoverParams) -> Result<Option<Hover>> {
        let request_id = REQUEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        let start_time = Instant::now();
        let uri = params.text_document_position_params.text_document.uri;
        let position = params.text_document_position_params.position;
        
        self.client
            .log_message(
                MessageType::INFO,
                format!("LSP DEBUG: Hover #{} at {}:{}:{}", 
                    request_id, uri, position.line, position.character)
            )
            .await;
        
        // Simple implementation for now
        Ok(None)
    }
}

impl Backend {
    fn new(client: Client) -> Self {
        Backend {
            client,
            documents: Arc::new(Mutex::new(HashMap::new())),
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    async fn send_diagnostics(&self, uri: Url, text: String) {
        let start_time = Instant::now();
        let mut diagnostics = vec![];
        
        match tokenize(&text) {
            Ok(_tokens) => {
                self.client
                    .log_message(
                        MessageType::INFO,
                        format!("LSP DEBUG: Tokenization OK for {} in {:?}", uri, start_time.elapsed())
                    )
                    .await;
            }
            Err(errors) => {
                self.client
                    .log_message(
                        MessageType::WARNING,
                        format!("LSP DEBUG: {} tokenization errors in {} ({:?})",
                            errors.len(), uri, start_time.elapsed())
                    )
                    .await;
                
                for error in errors {
                    let line = text[..error.span().start.min(text.len())]
                        .chars()
                        .filter(|&c| c == '\n')
                        .count() as u32;
                    
                    diagnostics.push(Diagnostic {
                        range: Range {
                            start: Position { line, character: 0 },
                            end: Position { line, character: 100 },
                        },
                        severity: Some(DiagnosticSeverity::ERROR),
                        message: format!("Syntax error: {:?}", error.reason()),
                        ..Default::default()
                    });
                }
            }
        }
        
        self.client.publish_diagnostics(uri, diagnostics, None).await;
    }
}

#[tokio::main]
async fn main() {
    // Enable detailed logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("debug")).init();
    
    eprintln!("LSP DEBUG: Starting server at {}", chrono::Utc::now());
    
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();

    let (service, socket) = LspService::new(|client| Backend::new(client));
    
    eprintln!("LSP DEBUG: Server initialized, waiting for connections...");
    
    Server::new(stdin, stdout, socket).serve(service).await;
    
    eprintln!("LSP DEBUG: Server terminated at {}", chrono::Utc::now());
}