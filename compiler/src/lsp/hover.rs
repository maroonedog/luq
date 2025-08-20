use tower_lsp::lsp_types::*;
use tower_lsp::jsonrpc::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use crate::ast::{Program, AstContext, NodeId, nodes::*};

pub async fn get_hover(
    params: &HoverParams,
    ast_cache: &Arc<RwLock<HashMap<Url, Program>>>,
    context_cache: &Arc<RwLock<HashMap<Url, Arc<AstContext>>>>,
    document_map: &Arc<RwLock<HashMap<Url, String>>>,
) -> Result<Option<Hover>> {
    let uri = &params.text_document_position_params.text_document.uri;
    let position = params.text_document_position_params.position;
    
    // Get the document content
    let documents = document_map.read().await;
    let content = match documents.get(uri) {
        Some(content) => content.clone(),
        None => return Ok(None),
    };
    
    // Get the word at the cursor position
    let lines: Vec<&str> = content.lines().collect();
    if position.line as usize >= lines.len() {
        return Ok(None);
    }
    
    let line = lines[position.line as usize];
    
    // Convert UTF-16 position to character index
    // LSP uses UTF-16 code units, but Rust strings use UTF-8
    let mut char_index = 0;
    let mut utf16_index = 0;
    let mut byte_index = 0;
    
    for ch in line.chars() {
        if utf16_index >= position.character as usize {
            break;
        }
        char_index += 1;
        byte_index += ch.len_utf8();
        // Count UTF-16 code units (surrogate pairs count as 2)
        utf16_index += if ch.len_utf16() == 2 { 2 } else { 1 };
    }
    
    // Collect characters to work with indices properly
    let chars: Vec<char> = line.chars().collect();
    
    // Find word boundaries using character indices
    let mut start_char = char_index;
    let mut end_char = char_index;
    
    // Move start back to beginning of word
    while start_char > 0 && chars.get(start_char - 1).map_or(false, |&c| c.is_alphanumeric() || c == '_' || c == '@') {
        start_char -= 1;
    }
    
    // Move end forward to end of word
    while end_char < chars.len() && chars.get(end_char).map_or(false, |&c| c.is_alphanumeric() || c == '_') {
        end_char += 1;
    }
    
    if start_char >= end_char {
        return Ok(None);
    }
    
    // Convert character range to byte range for string slicing
    let mut start_byte = 0;
    let mut end_byte = 0;
    for (i, ch) in line.chars().enumerate() {
        if i == start_char {
            start_byte = end_byte;
        }
        end_byte += ch.len_utf8();
        if i == end_char - 1 {
            break;
        }
    }
    
    let word = &line[start_byte..end_byte];
    
    // Get the AST and context for the document
    let ast_cache = ast_cache.read().await;
    let context_cache = context_cache.read().await;
    
    // Try to find the declaration in the AST
    let mut doc_comment_text = None;
    if let (Some(program), Some(context)) = (ast_cache.get(uri), context_cache.get(uri)) {
        // Search for declarations with matching name
        for i in 0..program.declarations.len() {
            let node_id = NodeId { 
                index: program.declarations.start.index + i as u32 
            };
            
            if let Some(node) = context.get_ast(node_id) {
                match node {
                    AstNode::TypeDecl { name, doc_comment, .. } |
                    AstNode::FunctionDecl { name, doc_comment, .. } |
                    AstNode::TypeAlias { name, doc_comment, .. } => {
                        let decl_name = context.get_str(*name);
                        if decl_name == word {
                            if let Some(comment_id) = doc_comment {
                                doc_comment_text = Some(context.get_str(*comment_id).to_string());
                            }
                            break;
                        }
                    }
                    _ => {}
                }
            }
        }
    }
    
    // Known type descriptions
    let type_docs = HashMap::from([
        ("string", "**string**\n\nPrimitive string type"),
        ("number", "**number**\n\nPrimitive number type"),
        ("boolean", "**boolean**\n\nPrimitive boolean type (true/false)"),
        ("void", "**void**\n\nNo return value"),
        ("any", "**any**\n\nAny type (avoid using when possible)"),
        ("unknown", "**unknown**\n\nUnknown type - requires type narrowing"),
        ("never", "**never**\n\nType that never occurs"),
    ]);
    
    // Decorator descriptions
    let decorator_docs = HashMap::from([
        ("required", "**@required**\n\nEnsures the field is not null, undefined, or empty string"),
        ("optional", "**@optional**\n\nMarks the field as optional (can be undefined)"),
        ("min", "**@min(value)**\n\nSets minimum value for numbers or minimum length for strings/arrays"),
        ("max", "**@max(value)**\n\nSets maximum value for numbers or maximum length for strings/arrays"),
        ("email", "**@email**\n\nValidates that the string is a valid email address"),
        ("pattern", "**@pattern(regex)**\n\nValidates the string against a regular expression pattern"),
        ("nullable", "**@nullable**\n\nAllows the field to be null"),
        ("validator", "**@validator**\n\nMarks a function or interface as a validator for code generation"),
    ]);
    
    // Keyword descriptions
    let keyword_docs = HashMap::from([
        ("interface", "**interface**\n\nDefines a TypeScript-like interface for data validation"),
        ("function", "**function**\n\nDefines a validation function"),
        ("type", "**type**\n\nDefines a type alias"),
        ("export", "**export**\n\nExports a declaration for use in other modules"),
        ("import", "**import**\n\nImports declarations from other modules"),
        ("extends", "**extends**\n\nInterface inheritance"),
        ("implements", "**implements**\n\nInterface implementation"),
        ("readonly", "**readonly**\n\nMarks a field as read-only"),
    ]);
    
    // Check if it's a decorator (starts with @)
    let word_without_at = if word.starts_with('@') {
        &word[1..]
    } else {
        word
    };
    
    // Look up documentation based on the word
    let hover_text = if let Some(comment) = doc_comment_text {
        // Use the JSDoc comment if available
        format!("**{}**\n\n{}", word, comment)
    } else if word.starts_with('@') && decorator_docs.contains_key(word_without_at) {
        decorator_docs[word_without_at].to_string()
    } else if type_docs.contains_key(word) {
        type_docs[word].to_string()
    } else if keyword_docs.contains_key(word) {
        keyword_docs[word].to_string()
    } else if word == "interface" || word == "Interface" {
        "**interface**\n\nDefines a TypeScript-like interface for data validation".to_string()
    } else if word == "function" || word == "Function" {
        "**function**\n\nDefines a validation function".to_string()
    } else {
        // For unknown words, provide context-specific help
        format!("**{}**\n\nIdentifier in Luq validation file", word)
    };
    
    let hover_content = MarkupContent {
        kind: MarkupKind::Markdown,
        value: hover_text,
    };

    Ok(Some(Hover {
        contents: HoverContents::Markup(hover_content),
        range: None,
    }))
}