use tower_lsp::jsonrpc::Result;
use tower_lsp::lsp_types::*;
use tower_lsp::{Client, LanguageServer, LspService, Server};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::ast::Program;
use crate::lexer::Lexer;
use crate::parser::Parser;

pub struct LuqLanguageServer {
    client: Client,
    ast_cache: Arc<RwLock<HashMap<Url, Program>>>,
    document_map: Arc<RwLock<HashMap<Url, String>>>,
}

impl LuqLanguageServer {
    pub fn new(client: Client) -> Self {
        Self {
            client,
            ast_cache: Arc::new(RwLock::new(HashMap::new())),
            document_map: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    async fn update_document(&self, uri: Url, text: String) {
        // Store document text
        self.document_map.write().await.insert(uri.clone(), text.clone());
        
        // Parse and cache AST
        match self.parse_document(&text).await {
            Ok(ast) => {
                self.ast_cache.write().await.insert(uri.clone(), ast);
                self.publish_diagnostics(uri, vec![]).await;
            }
            Err(e) => {
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

    async fn parse_document(&self, text: &str) -> anyhow::Result<Program> {
        let mut lexer = Lexer::new(text);
        let tokens = lexer.tokenize().await?;
        let mut parser = Parser::new(tokens);
        parser.parse().await
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
        self.update_document(
            params.text_document.uri,
            params.text_document.text,
        ).await;
    }

    async fn did_change(&self, params: DidChangeTextDocumentParams) {
        // For now, we're using full document sync
        if let Some(change) = params.content_changes.into_iter().next() {
            self.update_document(
                params.text_document.uri,
                change.text,
            ).await;
        }
    }

    async fn completion(&self, params: CompletionParams) -> Result<Option<CompletionResponse>> {
        let completions = super::completions::get_completions(&params).await;
        Ok(Some(CompletionResponse::Array(completions)))
    }

    async fn hover(&self, params: HoverParams) -> Result<Option<Hover>> {
        super::hover::get_hover(&params, &self.ast_cache).await
    }
}

pub async fn run_server() {
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();

    let (service, socket) = LspService::new(|client| {
        LuqLanguageServer::new(client)
    });

    Server::new(stdin, stdout, socket).serve(service).await;
}