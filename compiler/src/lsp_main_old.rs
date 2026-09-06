use tower_lsp::jsonrpc::Result;
use tower_lsp::lsp_types::*;
use tower_lsp::{Client, LanguageServer, LspService, Server};

use luq_compiler::lexer::{tokenize, TokenKind};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Debug)]
struct Backend {
    client: Client,
    documents: Arc<Mutex<HashMap<Url, String>>>,
}

#[tower_lsp::async_trait]
impl LanguageServer for Backend {
    async fn initialize(&self, _: InitializeParams) -> Result<InitializeResult> {
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
                    ..Default::default()
                }),
                hover_provider: Some(HoverProviderCapability::Simple(true)),
                diagnostic_provider: Some(DiagnosticServerCapabilities::Options(
                    DiagnosticOptions {
                        identifier: Some("luq".to_string()),
                        inter_file_dependencies: false,
                        workspace_diagnostics: false,
                        work_done_progress_options: WorkDoneProgressOptions {
                            work_done_progress: Some(false),
                        },
                    },
                )),
                ..Default::default()
            },
            ..Default::default()
        })
    }

    async fn initialized(&self, _: InitializedParams) {
        self.client
            .log_message(MessageType::INFO, "Luq LSP server initialized!")
            .await;
    }

    async fn shutdown(&self) -> Result<()> {
        Ok(())
    }

    async fn did_open(&self, params: DidOpenTextDocumentParams) {
        let uri = params.text_document.uri;
        let text = params.text_document.text;
        
        self.documents.lock().unwrap().insert(uri.clone(), text.clone());
        self.send_diagnostics(uri, text).await;
    }

    async fn did_change(&self, params: DidChangeTextDocumentParams) {
        let uri = params.text_document.uri;
        let text = params.content_changes[0].text.clone();
        
        self.documents.lock().unwrap().insert(uri.clone(), text.clone());
        self.send_diagnostics(uri, text).await;
    }

    async fn did_close(&self, params: DidCloseTextDocumentParams) {
        self.documents.lock().unwrap().remove(&params.text_document.uri);
    }

    async fn completion(&self, params: CompletionParams) -> Result<Option<CompletionResponse>> {
        let uri = params.text_document_position.text_document.uri;
        let position = params.text_document_position.position;
        
        let document = self.documents.lock().unwrap();
        let text = match document.get(&uri) {
            Some(text) => text.clone(),
            None => return Ok(None),
        };
        
        // Get the current line and cursor position
        let lines: Vec<&str> = text.lines().collect();
        if position.line as usize >= lines.len() {
            return Ok(None);
        }
        
        let line = lines[position.line as usize];
        let char_pos = position.character as usize;
        
        // Check what's before cursor
        let before_cursor = &line[..char_pos.min(line.len())];
        
        let mut completions = vec![];
        
        // Decorator completions
        if before_cursor.ends_with("@") || before_cursor.ends_with("@r") || before_cursor.ends_with("@req") {
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
                    label: "min".to_string(),
                    kind: Some(CompletionItemKind::FUNCTION),
                    detail: Some("Set minimum value".to_string()),
                    insert_text: Some("min($1)".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
                CompletionItem {
                    label: "max".to_string(),
                    kind: Some(CompletionItemKind::FUNCTION),
                    detail: Some("Set maximum value".to_string()),
                    insert_text: Some("max($1)".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
                CompletionItem {
                    label: "pattern".to_string(),
                    kind: Some(CompletionItemKind::FUNCTION),
                    detail: Some("Set regex pattern".to_string()),
                    insert_text: Some("pattern(/$1/)".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
                CompletionItem {
                    label: "email".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Validate as email".to_string()),
                    insert_text: Some("email".to_string()),
                    ..Default::default()
                },
            ]);
        }
        
        // Type completions after colon
        if before_cursor.ends_with(":") || before_cursor.ends_with(": ") {
            completions.extend(vec![
                CompletionItem {
                    label: "string".to_string(),
                    kind: Some(CompletionItemKind::TYPE_PARAMETER),
                    detail: Some("String type".to_string()),
                    insert_text: Some("string".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "number".to_string(),
                    kind: Some(CompletionItemKind::TYPE_PARAMETER),
                    detail: Some("Number type".to_string()),
                    insert_text: Some("number".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "boolean".to_string(),
                    kind: Some(CompletionItemKind::TYPE_PARAMETER),
                    detail: Some("Boolean type".to_string()),
                    insert_text: Some("boolean".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "void".to_string(),
                    kind: Some(CompletionItemKind::TYPE_PARAMETER),
                    detail: Some("Void type".to_string()),
                    insert_text: Some("void".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "any".to_string(),
                    kind: Some(CompletionItemKind::TYPE_PARAMETER),
                    detail: Some("Any type".to_string()),
                    insert_text: Some("any".to_string()),
                    ..Default::default()
                },
            ]);
        }
        
        // Keyword completions
        if before_cursor.is_empty() || before_cursor.ends_with(" ") || before_cursor.ends_with("\n") {
            completions.extend(vec![
                CompletionItem {
                    label: "interface".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Define an interface".to_string()),
                    insert_text: Some("interface $1 {\n  $2\n}".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
                CompletionItem {
                    label: "export".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Export declaration".to_string()),
                    insert_text: Some("export ".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "import".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Import declaration".to_string()),
                    insert_text: Some("import { $1 } from \"$2\";".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
                CompletionItem {
                    label: "function".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Define a function".to_string()),
                    insert_text: Some("function $1($2): $3 {\n  $4\n}".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
            ]);
        }
        
        if completions.is_empty() {
            Ok(None)
        } else {
            Ok(Some(CompletionResponse::Array(completions)))
        }
    }

    async fn hover(&self, params: HoverParams) -> Result<Option<Hover>> {
        let uri = params.text_document_position_params.text_document.uri;
        let position = params.text_document_position_params.position;
        
        let document = self.documents.lock().unwrap();
        let text = match document.get(&uri) {
            Some(text) => text.clone(),
            None => return Ok(None),
        };
        
        // Simple hover for keywords
        let lines: Vec<&str> = text.lines().collect();
        if position.line as usize >= lines.len() {
            return Ok(None);
        }
        
        let line = lines[position.line as usize];
        let words: Vec<&str> = line.split_whitespace().collect();
        
        for word in words {
            let hover_text = match word {
                "interface" => Some("Defines a type interface in Luq"),
                "export" => Some("Exports a declaration for external use"),
                "import" => Some("Imports declarations from another module"),
                "@required" => Some("Marks a field as required"),
                "@optional" => Some("Marks a field as optional"),
                "@validator" => Some("Marks an interface as a validator"),
                "string" => Some("String primitive type"),
                "number" => Some("Number primitive type"),
                "boolean" => Some("Boolean primitive type"),
                _ => None,
            };
            
            if let Some(text) = hover_text {
                return Ok(Some(Hover {
                    contents: HoverContents::Scalar(MarkedString::String(text.to_string())),
                    range: None,
                }));
            }
        }
        
        Ok(None)
    }
}

impl Backend {
    fn new(client: Client) -> Self {
        Backend {
            client,
            documents: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    async fn send_diagnostics(&self, uri: Url, text: String) {
        let mut diagnostics = vec![];
        
        // Tokenize and check for errors
        match tokenize(&text) {
            Ok(_tokens) => {
                // Could add semantic validation here
            }
            Err(errors) => {
                for error in errors {
                    let line = text[..error.span().start]
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
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();

    let (service, socket) = LspService::new(|client| Backend::new(client));
    Server::new(stdin, stdout, socket).serve(service).await;
}