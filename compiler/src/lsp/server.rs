use tower_lsp::jsonrpc::Result;
use tower_lsp::lsp_types::*;
use tower_lsp::{Client, LanguageServer, LspService, Server};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::ast::{Program, AstContext};
use crate::ast::validation::AstValidator;
use crate::config::CompilerConfig;
use crate::lexer::Lexer;
use crate::parser::Parser;
use crate::dependency::{DependencyGraph, ImportResolver};
use super::debouncer::FileDebouncerManager;
use super::diagnostics::analyze_program;
use super::import_validation::{validate_imports, check_unused_exports};
use super::semantic_tokens;
use std::path::PathBuf;
use crate::lsp_log;

pub struct LuqLanguageServer {
    client: Client,
    ast_cache: Arc<RwLock<HashMap<Url, Program>>>,
    context_cache: Arc<RwLock<HashMap<Url, Arc<AstContext>>>>,
    document_map: Arc<RwLock<HashMap<Url, String>>>,
    debouncer_manager: Arc<FileDebouncerManager>,
    dependency_graph: Arc<RwLock<DependencyGraph>>,
    import_resolver: Arc<ImportResolver>,
    validator: Arc<AstValidator>,
    config: Arc<CompilerConfig>,
}

impl Clone for LuqLanguageServer {
    fn clone(&self) -> Self {
        Self {
            client: self.client.clone(),
            ast_cache: self.ast_cache.clone(),
            context_cache: self.context_cache.clone(),
            document_map: self.document_map.clone(),
            debouncer_manager: self.debouncer_manager.clone(),
            dependency_graph: self.dependency_graph.clone(),
            import_resolver: self.import_resolver.clone(),
            validator: self.validator.clone(),
            config: self.config.clone(),
        }
    }
}

impl LuqLanguageServer {
    pub fn new(client: Client) -> Self {
        let config = CompilerConfig::default();
        
        // Configure global thread pool based on config
        if config.thread_count.is_some() {
            config.configure_global_thread_pool();
        }
        
        // Use current directory as project root
        let project_root = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("/"));
        
        Self {
            client,
            ast_cache: Arc::new(RwLock::new(HashMap::new())),
            context_cache: Arc::new(RwLock::new(HashMap::new())),
            document_map: Arc::new(RwLock::new(HashMap::new())),
            debouncer_manager: Arc::new(FileDebouncerManager::new(500)), // 500ms debounce
            dependency_graph: Arc::new(RwLock::new(DependencyGraph::new())),
            import_resolver: Arc::new(ImportResolver::new(project_root)),
            validator: Arc::new(AstValidator::new()),
            config: Arc::new(config),
        }
    }

    async fn update_document(&self, uri: Url, text: String) {
        lsp_log!("=== update_document: {:?}", uri);
        // Store document text
        self.document_map.write().await.insert(uri.clone(), text.clone());
        
        // Parse and cache AST
        match self.parse_document(&text).await {
            Ok((ast, context)) => {
                lsp_log!("  Parsed successfully");
                // Validate AST
                let mut all_diagnostics = Vec::new();
                
                // Run AST validation
                if let Some(errors) = self.validator.validate(&ast, &context).ok().filter(|e| !e.is_empty()) {
                    for error in errors {
                        all_diagnostics.push(Diagnostic {
                            range: Range {
                                start: Position { line: 0, character: 0 },
                                end: Position { line: 0, character: 0 },
                            },
                            severity: Some(DiagnosticSeverity::ERROR),
                            message: format!("Validation error: {}", error),
                            ..Default::default()
                        });
                    }
                }
                
                // Analyze program for additional diagnostics
                let analysis_diagnostics = analyze_program(&ast);
                all_diagnostics.extend(analysis_diagnostics);
                
                // Update dependency graph with context
                if let Some(path) = uri.to_file_path().ok() {
                    lsp_log!("  Updating dependency graph for: {:?}", path);
                    let mut graph = self.dependency_graph.write().await;
                    if let Err(e) = graph.add_or_update_module_with_context(path.clone(), &ast, &context) {
                        all_diagnostics.push(Diagnostic {
                            range: Range {
                                start: Position { line: 0, character: 0 },
                                end: Position { line: 0, character: 0 },
                            },
                            severity: Some(DiagnosticSeverity::WARNING),
                            message: format!("Failed to update dependency graph: {}", e),
                            ..Default::default()
                        });
                    }
                    
                    // Resolve imports for this module
                    lsp_log!("  Resolving imports");
                    let _ = graph.resolve_imports(&path, &self.import_resolver);
                    drop(graph); // Explicitly drop the write lock
                    
                    // Validate imports
                    lsp_log!("  Validating imports");
                    let import_diagnostics = validate_imports(&path, &ast, &self.dependency_graph, &self.import_resolver).await;
                    all_diagnostics.extend(import_diagnostics);
                    
                    // Check unused exports
                    lsp_log!("  Checking unused exports");
                    let unused_export_diagnostics = check_unused_exports(&path, &ast, &self.dependency_graph).await;
                    all_diagnostics.extend(unused_export_diagnostics);
                }
                
                // Cache both AST and context
                lsp_log!("  Caching AST and context");
                self.ast_cache.write().await.insert(uri.clone(), ast);
                self.context_cache.write().await.insert(uri.clone(), Arc::new(context));
                
                // Publish all diagnostics
                lsp_log!("  Publishing {} diagnostics", all_diagnostics.len());
                self.publish_diagnostics(uri, all_diagnostics).await;
                lsp_log!("  update_document completed");
            }
            Err(e) => {
                lsp_log!("  Parse error: {}", e);
                // Send parse error as diagnostic
                let diagnostic = Diagnostic {
                    range: Range {
                        start: Position { line: 0, character: 0 },
                        end: Position { line: 0, character: 0 },
                    },
                    severity: Some(DiagnosticSeverity::ERROR),
                    message: format!("Parse error: {}", e),
                    ..Default::default()
                };
                self.publish_diagnostics(uri, vec![diagnostic]).await;
            }
        }
    }

    async fn parse_document(&self, text: &str) -> anyhow::Result<(Program, AstContext)> {
        lsp_log!("  Starting parse_document");
        
        // Use nom parser directly
        lsp_log!("  Using nom parser");
        let parser = Parser::new(text.to_string());
        lsp_log!("  Starting parser.parse()");
        
        match parser.parse(text) {
            Ok((program, context)) => {
                lsp_log!("  Parser completed successfully");
                Ok((program, context))
            }
            Err(e) => {
                lsp_log!("  Parse error: {}", e);
                Err(anyhow::anyhow!("Parse error: {}", e))
            }
        }
    }

    async fn publish_diagnostics(&self, uri: Url, diagnostics: Vec<Diagnostic>) {
        self.client
            .publish_diagnostics(uri, diagnostics, None)
            .await;
    }
}

#[tower_lsp::async_trait]
impl LanguageServer for LuqLanguageServer {
    async fn initialize(&self, _: InitializeParams) -> Result<InitializeResult> {
        Ok(InitializeResult {
            capabilities: ServerCapabilities {
                text_document_sync: Some(TextDocumentSyncCapability::Kind(
                    TextDocumentSyncKind::FULL,
                )),
                completion_provider: Some(CompletionOptions {
                    trigger_characters: Some(vec!["@".to_string(), ".".to_string()]),
                    ..Default::default()
                }),
                hover_provider: Some(HoverProviderCapability::Simple(true)),
                definition_provider: Some(OneOf::Left(true)),
                semantic_tokens_provider: Some(
                    SemanticTokensServerCapabilities::SemanticTokensOptions(
                        SemanticTokensOptions {
                            legend: semantic_tokens::get_legend(),
                            full: Some(SemanticTokensFullOptions::Bool(true)),
                            range: None,
                            ..Default::default()
                        }
                    )
                ),
                ..Default::default()
            },
            ..Default::default()
        })
    }

    async fn initialized(&self, _: InitializedParams) {
        self.client
            .log_message(MessageType::INFO, "Luq Language Server initialized")
            .await;
    }

    async fn shutdown(&self) -> Result<()> {
        Ok(())
    }

    async fn did_open(&self, params: DidOpenTextDocumentParams) {
        lsp_log!("=== did_open: {:?}", params.text_document.uri);
        // Immediately update on file open (no debounce needed)
        self.update_document(
            params.text_document.uri,
            params.text_document.text,
        ).await;
    }
    
    async fn did_save(&self, params: DidSaveTextDocumentParams) {
        // On save, execute validation immediately
        let uri = params.text_document.uri;
        
        // Simply re-validate the document without debouncing on save
        if let Some(text) = self.document_map.read().await.get(&uri) {
            self.update_document(uri, text.clone()).await;
        }
    }

    async fn did_change(&self, params: DidChangeTextDocumentParams) {
        // For now, we're using full document sync without debouncing
        // TODO: Implement proper debouncing once async closure issues are resolved
        if let Some(change) = params.content_changes.into_iter().next() {
            self.update_document(
                params.text_document.uri,
                change.text,
            ).await;
        }
    }

    async fn completion(&self, params: CompletionParams) -> Result<Option<CompletionResponse>> {
        lsp_log!("=== LSP completion request received ===");
        lsp_log!("  URI: {:?}", params.text_document_position.text_document.uri);
        lsp_log!("  Position: {:?}", params.text_document_position.position);
        lsp_log!("  Trigger: {:?}", params.context.as_ref().and_then(|c| c.trigger_character.as_ref()));
        
        let completions = super::completions::get_completions(
            &params,
            &self.ast_cache,
            &self.context_cache,
            &self.dependency_graph,
            &self.document_map,
        ).await;
        
        lsp_log!("  Returning {} completions", completions.len());
        Ok(Some(CompletionResponse::Array(completions)))
    }

    async fn hover(&self, params: HoverParams) -> Result<Option<Hover>> {
        super::hover::get_hover(&params, &self.ast_cache, &self.context_cache, &self.document_map).await
    }

    async fn semantic_tokens_full(
        &self,
        params: SemanticTokensParams,
    ) -> Result<Option<SemanticTokensResult>> {
        semantic_tokens::provide_semantic_tokens(
            params,
            &self.ast_cache,
            &self.context_cache,
        ).await
    }

    async fn goto_definition(
        &self,
        params: GotoDefinitionParams,
    ) -> Result<Option<GotoDefinitionResponse>> {
        // TODO: Implement proper goto definition logic
        // For now, return None to indicate no definition found
        Ok(None)
    }
}

pub async fn run_server() {
    // Initialize logger
    crate::lsp::logger::init_logger();
    
    lsp_log!("=== LSP Server starting ===");
    lsp_log!("Current directory: {:?}", std::env::current_dir());
    
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();

    let (service, socket) = LspService::new(|client| {
        lsp_log!("Creating LuqLanguageServer instance");
        LuqLanguageServer::new(client)
    });

    lsp_log!("Starting LSP server main loop");
    Server::new(stdin, stdout, socket).serve(service).await;
}