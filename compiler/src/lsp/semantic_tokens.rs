// Semantic highlighting implementation for Luq language

use tower_lsp::lsp_types::{
    SemanticToken, SemanticTokenType, SemanticTokenModifier,
    SemanticTokensParams, SemanticTokensResult, SemanticTokens,
    SemanticTokensLegend, Url,
};
use crate::ast::{*, nodes::*};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;

// Define custom token types for Luq
pub const TOKEN_TYPES: &[SemanticTokenType] = &[
    SemanticTokenType::NAMESPACE,
    SemanticTokenType::TYPE,
    SemanticTokenType::CLASS,       // for interfaces
    SemanticTokenType::ENUM,
    SemanticTokenType::INTERFACE,
    SemanticTokenType::STRUCT,
    SemanticTokenType::TYPE_PARAMETER,
    SemanticTokenType::PARAMETER,
    SemanticTokenType::VARIABLE,
    SemanticTokenType::PROPERTY,
    SemanticTokenType::ENUM_MEMBER,
    SemanticTokenType::FUNCTION,
    SemanticTokenType::METHOD,
    SemanticTokenType::MACRO,       // for decorators
    SemanticTokenType::KEYWORD,
    SemanticTokenType::MODIFIER,
    SemanticTokenType::COMMENT,
    SemanticTokenType::STRING,
    SemanticTokenType::NUMBER,
    SemanticTokenType::REGEXP,
    SemanticTokenType::OPERATOR,
    SemanticTokenType::DECORATOR,   // for @validator etc
];

// Define token modifiers
pub const TOKEN_MODIFIERS: &[SemanticTokenModifier] = &[
    SemanticTokenModifier::DECLARATION,
    SemanticTokenModifier::DEFINITION,
    SemanticTokenModifier::READONLY,
    SemanticTokenModifier::STATIC,
    SemanticTokenModifier::DEPRECATED,
    SemanticTokenModifier::ABSTRACT,
    SemanticTokenModifier::ASYNC,
    SemanticTokenModifier::MODIFICATION,
    SemanticTokenModifier::DOCUMENTATION,
    SemanticTokenModifier::DEFAULT_LIBRARY,
];

pub fn get_legend() -> SemanticTokensLegend {
    SemanticTokensLegend {
        token_types: TOKEN_TYPES.to_vec(),
        token_modifiers: TOKEN_MODIFIERS.to_vec(),
    }
}

struct TokenCollector {
    tokens: Vec<SemanticToken>,
    prev_line: u32,
    prev_char: u32,
    context: Arc<AstContext>,
    source: String,
}

impl TokenCollector {
    fn new(context: Arc<AstContext>, source: String) -> Self {
        Self {
            tokens: Vec::new(),
            prev_line: 0,
            prev_char: 0,
            context,
            source,
        }
    }

    fn add_token(
        &mut self,
        span: SourceSpan,
        token_type: u32,
        token_modifiers: u32,
    ) {
        let (line, char) = self.span_to_position(span);
        let length = (span.end - span.start) as u32;
        
        // Semantic tokens use relative positions
        let delta_line = line - self.prev_line;
        let delta_start = if delta_line == 0 {
            char - self.prev_char
        } else {
            char
        };

        self.tokens.push(SemanticToken {
            delta_line,
            delta_start,
            length,
            token_type,
            token_modifiers_bitset: token_modifiers,
        });

        self.prev_line = line;
        self.prev_char = char;
    }

    fn span_to_position(&self, span: SourceSpan) -> (u32, u32) {
        // Convert byte offset to line/column
        let mut line = 0u32;
        let mut col = 0u32;
        let mut offset = 0u32;

        for ch in self.source.chars() {
            if offset >= span.start {
                break;
            }
            if ch == '\n' {
                line += 1;
                col = 0;
            } else {
                col += 1;
            }
            offset += ch.len_utf8() as u32;
        }

        (line, col)
    }

    fn collect_program(&mut self, program: &Program) {
        // Iterate through declarations
        for i in 0..program.declarations.len() {
            let node_id = NodeId { 
                index: program.declarations.start.index + i as u32 
            };
            
            // Clone the node to avoid borrow issues
            let node = self.context.get_ast(node_id).cloned();
            if let Some(node) = node {
                self.collect_ast_node(&node);
            }
        }
    }

    fn collect_ast_node(&mut self, node: &AstNode) {
        match node {
            AstNode::TypeDecl { name, body, decorators, span: _, .. } => {
                // Add interface/type name
                if let Some(name_str) = self.get_string_span(*name) {
                    self.add_token(
                        name_str,
                        get_token_type_index(SemanticTokenType::INTERFACE),
                        get_modifier_bitset(&[SemanticTokenModifier::DECLARATION]),
                    );
                }
                
                // Process decorators
                self.collect_decorators(decorators);
                
                // Process body
                let type_node = self.context.get_type(*body).cloned();
                if let Some(type_node) = type_node {
                    self.collect_type_node(&type_node);
                }
            }
            
            AstNode::FunctionDecl { name, params, return_type, body: _, decorators, span: _, .. } => {
                // Add function name
                if let Some(name_str) = self.get_string_span(*name) {
                    self.add_token(
                        name_str,
                        get_token_type_index(SemanticTokenType::FUNCTION),
                        get_modifier_bitset(&[SemanticTokenModifier::DECLARATION]),
                    );
                }
                
                // Process decorators
                self.collect_decorators(decorators);
                
                // Process parameters
                for i in 0..params.len() {
                    let param_id = NodeId { 
                        index: params.start.index + i as u32 
                    };
                    let param = self.context.get_param(param_id).cloned();
                    if let Some(param) = param {
                        self.collect_param(&param);
                    }
                }
                
                // Process return type
                if let Some(ret_type) = return_type {
                    let type_node = self.context.get_type(*ret_type).cloned();
                    if let Some(type_node) = type_node {
                        self.collect_type_node(&type_node);
                    }
                }
            }
            
            AstNode::TypeAlias { name, body, .. } => {
                // Add type alias name
                if let Some(name_str) = self.get_string_span(*name) {
                    self.add_token(
                        name_str,
                        get_token_type_index(SemanticTokenType::TYPE),
                        get_modifier_bitset(&[SemanticTokenModifier::DECLARATION]),
                    );
                }
                
                // Process body type
                let type_node = self.context.get_type(*body).cloned();
                if let Some(type_node) = type_node {
                    self.collect_type_node(&type_node);
                }
            }
            
            _ => {}
        }
    }

    fn collect_type_node(&mut self, node: &TypeNode) {
        match node {
            TypeNode::Object { fields, .. } => {
                // Process object fields
                for i in 0..fields.len() {
                    let field_id = NodeId { 
                        index: fields.start.index + i as u32 
                    };
                    let field = self.context.get_field(field_id).cloned();
                    if let Some(field) = field {
                        self.collect_field(&field);
                    }
                }
            }
            
            TypeNode::Ref { target, .. } => {
                // Add type reference
                if let Some(target_span) = self.get_string_span(*target) {
                    self.add_token(
                        target_span,
                        get_token_type_index(SemanticTokenType::TYPE),
                        0,
                    );
                }
            }
            
            TypeNode::Union { variants, .. } => {
                // Process union variants
                for i in 0..variants.len() {
                    let variant_id = NodeId { 
                        index: variants.start.index + i as u32 
                    };
                    let variant = self.context.get_type(variant_id).cloned();
                    if let Some(variant) = variant {
                        self.collect_type_node(&variant);
                    }
                }
            }
            
            TypeNode::Array { elem, .. } => {
                let elem_type = self.context.get_type(*elem).cloned();
                if let Some(elem_type) = elem_type {
                    self.collect_type_node(&elem_type);
                }
            }
            
            TypeNode::Optional { inner, .. } => {
                let inner_type = self.context.get_type(*inner).cloned();
                if let Some(inner_type) = inner_type {
                    self.collect_type_node(&inner_type);
                }
            }
            
            _ => {}
        }
    }

    fn collect_field(&mut self, field: &Field) {
        // Add field name
        if let Some(name_span) = self.get_string_span(field.name) {
            let mut modifiers = vec![];
            
            if field.readonly {
                modifiers.push(SemanticTokenModifier::READONLY);
            }
            
            self.add_token(
                name_span,
                get_token_type_index(SemanticTokenType::PROPERTY),
                get_modifier_bitset(&modifiers),
            );
        }
        
        // Process field type
        let type_node = self.context.get_type(field.type_node).cloned();
        if let Some(type_node) = type_node {
            self.collect_type_node(&type_node);
        }
        
        // Process decorators
        self.collect_decorators(&field.decorators);
    }

    fn collect_param(&mut self, param: &Param) {
        // Add parameter name
        if let Some(name_span) = self.get_string_span(param.name) {
            self.add_token(
                name_span,
                get_token_type_index(SemanticTokenType::PARAMETER),
                0,
            );
        }
        
        // Process parameter type
        if let Some(type_id) = param.type_node {
            let type_node = self.context.get_type(type_id).cloned();
            if let Some(type_node) = type_node {
                self.collect_type_node(&type_node);
            }
        }
    }

    fn collect_decorators(&mut self, _decorators: &NodeList) {
        // Since decorators aren't properly parsed as nodes yet,
        // we need to find them in the source text.
        // This will be improved once decorator nodes are properly parsed.
        
        // For now, scan the entire source for @ symbols
        let mut pos = 0;
        while let Some(at_pos) = self.source[pos..].find('@') {
            let abs_pos = pos + at_pos;
            
            // Check if this @ is at the beginning of a line or after whitespace
            let is_decorator = if abs_pos == 0 {
                true
            } else {
                let prev_char = self.source.chars().nth(abs_pos - 1);
                prev_char.map_or(false, |c| c.is_whitespace())
            };
            
            if is_decorator {
                // Add @ symbol
                self.add_token(
                    SourceSpan::new(abs_pos, abs_pos + 1),
                    get_token_type_index(SemanticTokenType::DECORATOR),
                    0,
                );
                
                // Find decorator name
                let after_at = &self.source[abs_pos + 1..];
                let name_end = after_at.chars()
                    .position(|c| !c.is_alphanumeric() && c != '_')
                    .unwrap_or(after_at.len());
                
                if name_end > 0 {
                    self.add_token(
                        SourceSpan::new(abs_pos + 1, abs_pos + 1 + name_end),
                        get_token_type_index(SemanticTokenType::DECORATOR),
                        0,
                    );
                }
            }
            
            pos = abs_pos + 1;
        }
    }

    fn get_string_span(&self, string_id: StringId) -> Option<SourceSpan> {
        // Find the span of this string in the source
        let string = self.context.get_str(string_id);
        
        // Simple search - in production would use proper source mapping
        if let Some(pos) = self.source.find(string) {
            Some(SourceSpan::new(pos, pos + string.len()))
        } else {
            None
        }
    }
}

fn get_token_type_index(token_type: SemanticTokenType) -> u32 {
    TOKEN_TYPES
        .iter()
        .position(|t| *t == token_type)
        .unwrap_or(0) as u32
}

fn get_modifier_bitset(modifiers: &[SemanticTokenModifier]) -> u32 {
    let mut bitset = 0u32;
    for modifier in modifiers {
        if let Some(index) = TOKEN_MODIFIERS.iter().position(|m| *m == *modifier) {
            bitset |= 1 << index;
        }
    }
    bitset
}

pub async fn provide_semantic_tokens(
    params: SemanticTokensParams,
    ast_cache: &Arc<RwLock<HashMap<Url, Program>>>,
    context_cache: &Arc<RwLock<HashMap<Url, Arc<AstContext>>>>,
) -> tower_lsp::jsonrpc::Result<Option<SemanticTokensResult>> {
    let uri = params.text_document.uri;
    
    // Get AST and context from cache
    let ast_cache = ast_cache.read().await;
    let context_cache = context_cache.read().await;
    
    if let (Some(program), Some(context)) = (ast_cache.get(&uri), context_cache.get(&uri)) {
        // Create token collector
        let source = context.source.to_string();
        let mut collector = TokenCollector::new(context.clone(), source);
        
        // Collect tokens from AST
        collector.collect_program(program);
        
        // Return semantic tokens
        let tokens = SemanticTokens {
            result_id: None,
            data: collector.tokens,
        };
        
        Ok(Some(SemanticTokensResult::Tokens(tokens)))
    } else {
        Ok(None)
    }
}