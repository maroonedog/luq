use tower_lsp::jsonrpc::Result;
use tower_lsp::lsp_types::*;
use tower_lsp::{Client, LanguageServer, LspService, Server};

use luq_compiler::lexer::tokenize;
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
        self.client
            .log_message(MessageType::INFO, "LSP: Initialize called")
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
                        " ".to_string(),
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
            .log_message(MessageType::INFO, "Luq LSP server initialized!")
            .await;
    }

    async fn shutdown(&self) -> Result<()> {
        self.client
            .log_message(MessageType::INFO, "LSP: Shutdown called")
            .await;
        Ok(())
    }

    async fn did_open(&self, params: DidOpenTextDocumentParams) {
        let uri = params.text_document.uri.clone();
        let text = params.text_document.text.clone();
        
        self.client
            .log_message(MessageType::INFO, format!("LSP: Document opened: {}", uri))
            .await;
        
        self.documents.lock().unwrap().insert(uri.clone(), text.clone());
        self.send_diagnostics(uri, text).await;
    }

    async fn did_change(&self, params: DidChangeTextDocumentParams) {
        let uri = params.text_document.uri.clone();
        if let Some(change) = params.content_changes.first() {
            let text = change.text.clone();
            
            self.client
                .log_message(MessageType::INFO, format!("LSP: Document changed: {}", uri))
                .await;
            
            self.documents.lock().unwrap().insert(uri.clone(), text.clone());
            self.send_diagnostics(uri, text).await;
        }
    }

    async fn did_close(&self, params: DidCloseTextDocumentParams) {
        self.client
            .log_message(MessageType::INFO, format!("LSP: Document closed: {}", params.text_document.uri))
            .await;
            
        self.documents.lock().unwrap().remove(&params.text_document.uri);
    }

    async fn completion(&self, params: CompletionParams) -> Result<Option<CompletionResponse>> {
        let uri = params.text_document_position.text_document.uri.clone();
        let position = params.text_document_position.position;
        
        // ログ出力
        self.client
            .log_message(
                MessageType::INFO, 
                format!("LSP: Completion requested at {}:{}:{}", uri, position.line, position.character)
            )
            .await;
        
        // ドキュメント取得
        let text_opt = {
            let documents = self.documents.lock().unwrap();
            documents.get(&uri).cloned()
        }; // documents is dropped here
        
        let text = match text_opt {
            Some(text) => text,
            None => {
                self.client
                    .log_message(MessageType::WARNING, format!("LSP: Document not found: {}", uri))
                    .await;
                return Ok(None);
            }
        };
        
        // 行を取得
        let lines: Vec<&str> = text.lines().collect();
        if position.line as usize >= lines.len() {
            self.client
                .log_message(MessageType::WARNING, format!("LSP: Line {} out of range", position.line))
                .await;
            return Ok(None);
        }
        
        let line = lines[position.line as usize];
        let char_pos = position.character as usize;
        
        // カーソル前の文字列を取得（範囲チェック付き）
        let before_cursor = if char_pos <= line.len() {
            &line[..char_pos]
        } else {
            line
        };
        
        self.client
            .log_message(
                MessageType::INFO, 
                format!("LSP: Before cursor: '{}'", before_cursor)
            )
            .await;
        
        let mut completions = vec![];
        
        // デコレータ補完（@の後、または@で始まる単語の途中）
        if before_cursor.ends_with("@") || 
           before_cursor.trim_end().ends_with("@") ||
           (before_cursor.len() > 0 && {
               let trimmed = before_cursor.trim_start();
               trimmed.starts_with("@") && !trimmed.contains(' ')
           }) {
            self.client
                .log_message(MessageType::INFO, "LSP: Adding decorator completions")
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
                    label: "min".to_string(),
                    kind: Some(CompletionItemKind::FUNCTION),
                    detail: Some("Set minimum value: @min(value)".to_string()),
                    insert_text: Some("min($1)".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
                CompletionItem {
                    label: "max".to_string(),
                    kind: Some(CompletionItemKind::FUNCTION),
                    detail: Some("Set maximum value: @max(value)".to_string()),
                    insert_text: Some("max($1)".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
                CompletionItem {
                    label: "pattern".to_string(),
                    kind: Some(CompletionItemKind::FUNCTION),
                    detail: Some("Set regex pattern: @pattern(/regex/)".to_string()),
                    insert_text: Some("pattern(/$1/)".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
                CompletionItem {
                    label: "email".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Validate as email address".to_string()),
                    insert_text: Some("email".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "array".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Mark as array type".to_string()),
                    insert_text: Some("array".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "minLength".to_string(),
                    kind: Some(CompletionItemKind::FUNCTION),
                    detail: Some("Set minimum length: @minLength(value)".to_string()),
                    insert_text: Some("minLength($1)".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
                CompletionItem {
                    label: "maxLength".to_string(),
                    kind: Some(CompletionItemKind::FUNCTION),
                    detail: Some("Set maximum length: @maxLength(value)".to_string()),
                    insert_text: Some("maxLength($1)".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
                CompletionItem {
                    label: "validateUser".to_string(),
                    kind: Some(CompletionItemKind::FUNCTION),
                    detail: Some("Custom validator function".to_string()),
                    insert_text: Some("validateUser()".to_string()),
                    ..Default::default()
                },
            ]);
        }
        
        // 型補完（: の後）
        if before_cursor.ends_with(":") || before_cursor.ends_with(": ") {
            self.client
                .log_message(MessageType::INFO, "LSP: Adding type completions")
                .await;
                
            completions.extend(vec![
                CompletionItem {
                    label: "string".to_string(),
                    kind: Some(CompletionItemKind::TYPE_PARAMETER),
                    detail: Some("String primitive type".to_string()),
                    insert_text: Some(" string".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "number".to_string(),
                    kind: Some(CompletionItemKind::TYPE_PARAMETER),
                    detail: Some("Number primitive type".to_string()),
                    insert_text: Some(" number".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "boolean".to_string(),
                    kind: Some(CompletionItemKind::TYPE_PARAMETER),
                    detail: Some("Boolean primitive type".to_string()),
                    insert_text: Some(" boolean".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "void".to_string(),
                    kind: Some(CompletionItemKind::TYPE_PARAMETER),
                    detail: Some("Void type (no return value)".to_string()),
                    insert_text: Some(" void".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "any".to_string(),
                    kind: Some(CompletionItemKind::TYPE_PARAMETER),
                    detail: Some("Any type (disable type checking)".to_string()),
                    insert_text: Some(" any".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "unknown".to_string(),
                    kind: Some(CompletionItemKind::TYPE_PARAMETER),
                    detail: Some("Unknown type (safer than any)".to_string()),
                    insert_text: Some(" unknown".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "never".to_string(),
                    kind: Some(CompletionItemKind::TYPE_PARAMETER),
                    detail: Some("Never type (unreachable)".to_string()),
                    insert_text: Some(" never".to_string()),
                    ..Default::default()
                },
            ]);
        }
        
        // キーワード補完（行頭または空白の後）
        let trimmed = before_cursor.trim_start();
        if trimmed.is_empty() || before_cursor.ends_with(" ") || before_cursor.ends_with("\n") {
            self.client
                .log_message(MessageType::INFO, "LSP: Adding keyword completions")
                .await;
                
            completions.extend(vec![
                CompletionItem {
                    label: "interface".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Define an interface".to_string()),
                    insert_text: Some("interface $1 {\n    $2\n}".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
                CompletionItem {
                    label: "export".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Export a declaration".to_string()),
                    insert_text: Some("export ".to_string()),
                    ..Default::default()
                },
                CompletionItem {
                    label: "import".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Import from another module".to_string()),
                    insert_text: Some("import { $1 } from \"$2\";".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
                CompletionItem {
                    label: "function".to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Define a function".to_string()),
                    insert_text: Some("function $1($2): $3 {\n    $4\n}".to_string()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                },
            ]);
        }
        
        self.client
            .log_message(
                MessageType::INFO, 
                format!("LSP: Returning {} completions", completions.len())
            )
            .await;
        
        if completions.is_empty() {
            Ok(None)
        } else {
            Ok(Some(CompletionResponse::Array(completions)))
        }
    }

    async fn hover(&self, params: HoverParams) -> Result<Option<Hover>> {
        let uri = params.text_document_position_params.text_document.uri;
        let position = params.text_document_position_params.position;
        
        self.client
            .log_message(
                MessageType::INFO,
                format!("LSP: Hover requested at {}:{}:{}", uri, position.line, position.character)
            )
            .await;
        
        let text = {
            let documents = self.documents.lock().unwrap();
            match documents.get(&uri) {
                Some(text) => text.clone(),
                None => return Ok(None),
            }
        }; // documents is dropped here
        
        let lines: Vec<&str> = text.lines().collect();
        if position.line as usize >= lines.len() {
            return Ok(None);
        }
        
        let line = lines[position.line as usize];
        
        // Simple word detection at cursor position
        let char_pos = position.character as usize;
        if char_pos > line.len() {
            return Ok(None);
        }
        
        // Find word boundaries
        let mut start = char_pos;
        let mut end = char_pos;
        let chars: Vec<char> = line.chars().collect();
        
        // Find start of word
        while start > 0 && (chars[start - 1].is_alphanumeric() || chars[start - 1] == '@') {
            start -= 1;
        }
        
        // Find end of word
        while end < chars.len() && (chars[end].is_alphanumeric() || chars[end] == '@') {
            end += 1;
        }
        
        let word: String = chars[start..end].iter().collect();
        
        let hover_text = match word.as_str() {
            "interface" => Some("**interface**\n\nDefines a type interface in Luq.\n\nExample:\n```luq\ninterface User {\n    name: string;\n    age: number;\n}\n```"),
            "export" => Some("**export**\n\nExports a declaration for external use.\n\nExample:\n```luq\nexport interface User { ... }\n```"),
            "import" => Some("**import**\n\nImports declarations from another module.\n\nExample:\n```luq\nimport { User } from './user.luq';\n```"),
            "@required" | "required" => Some("**@required**\n\nMarks a field as required. The field must be present and non-null."),
            "@optional" | "optional" => Some("**@optional**\n\nMarks a field as optional. The field may be omitted or null."),
            "@validator" | "validator" => Some("**@validator**\n\nMarks an interface or function as a validator."),
            "@min" | "min" => Some("**@min(value)**\n\nSets the minimum value for a number field.\n\nExample:\n```luq\n@min(0)\nage: number;\n```"),
            "@max" | "max" => Some("**@max(value)**\n\nSets the maximum value for a number field.\n\nExample:\n```luq\n@max(120)\nage: number;\n```"),
            "string" => Some("**string**\n\nString primitive type.\n\nRepresents textual data."),
            "number" => Some("**number**\n\nNumber primitive type.\n\nRepresents both integers and floating-point numbers."),
            "boolean" => Some("**boolean**\n\nBoolean primitive type.\n\nRepresents true or false."),
            _ => None,
        };
        
        if let Some(text) = hover_text {
            Ok(Some(Hover {
                contents: HoverContents::Markup(MarkupContent {
                    kind: MarkupKind::Markdown,
                    value: text.to_string(),
                }),
                range: Some(Range {
                    start: Position {
                        line: position.line,
                        character: start as u32,
                    },
                    end: Position {
                        line: position.line,
                        character: end as u32,
                    },
                }),
            }))
        } else {
            Ok(None)
        }
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
                // Successfully tokenized - could add semantic validation here
                self.client
                    .log_message(MessageType::INFO, format!("LSP: Document tokenized successfully: {}", uri))
                    .await;
            }
            Err(errors) => {
                self.client
                    .log_message(MessageType::WARNING, format!("LSP: {} tokenization errors in {}", errors.len(), uri))
                    .await;
                    
                for error in errors {
                    // Calculate line number from byte position
                    let line = text[..error.span().start.min(text.len())]
                        .chars()
                        .filter(|&c| c == '\n')
                        .count() as u32;
                    
                    // Find the start of the line to calculate column
                    let line_start = text[..error.span().start.min(text.len())]
                        .rfind('\n')
                        .map(|p| p + 1)
                        .unwrap_or(0);
                    let column = (error.span().start - line_start) as u32;
                    
                    diagnostics.push(Diagnostic {
                        range: Range {
                            start: Position { line, character: column },
                            end: Position { 
                                line, 
                                character: column + ((error.span().end - error.span().start) as u32).max(1)
                            },
                        },
                        severity: Some(DiagnosticSeverity::ERROR),
                        code: Some(NumberOrString::String("syntax".to_string())),
                        source: Some("luq".to_string()),
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
    // Enable logging to stderr for debugging
    env_logger::init();
    
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();

    let (service, socket) = LspService::new(|client| Backend::new(client));
    Server::new(stdin, stdout, socket).serve(service).await;
}