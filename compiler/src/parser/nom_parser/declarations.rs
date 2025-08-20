use nom::{
    bytes::complete::{tag, take_while},
    character::complete::{char, multispace0, multispace1},
    combinator::opt,
    multi::many0,
    sequence::preceded,
    error::{VerboseError, ParseError},
};
use crate::ast::{self, nodes::*, SourceSpan};
use super::{Parser, ParseResult};

impl Parser {
    pub(crate) fn parse_declaration<'a>(&mut self, input: &'a str) -> ParseResult<'a, Option<ast::NodeId>> {
        let (mut input, _) = multispace0(input)?;
        
        // Parse JSDoc comment if present
        let mut doc_comment = None;
        if let Ok((new_input, jsdoc)) = self.parse_jsdoc_comment(input) {
            doc_comment = jsdoc;
            input = new_input;
            let (new_input, _) = multispace0(input)?;
            input = new_input;
        }
        
        // Skip regular comments
        loop {
            if let Ok((new_input, _)) = self.parse_comment(input) {
                input = new_input;
                let (new_input, _) = multispace0(input)?;
                input = new_input;
            } else {
                break;
            }
        }
        
        // Skip semicolons
        while input.starts_with(';') {
            let (new_input, _) = char(';')(input)?;
            let (new_input, _) = multispace0(new_input)?;
            input = new_input;
        }
        
        // If we've consumed everything, return None
        if input.is_empty() {
            return Ok((input, None));
        }

        // Try to parse decorators manually to avoid many0 issues
        let mut decorator_ids = Vec::new();
        loop {
            if let Ok((new_input, decorator)) = self.parse_decorator(input) {
                decorator_ids.push(decorator);
                input = new_input;
            } else {
                break;
            }
        }

        // Parse the actual declaration - try each in sequence
        if let Ok((input, node)) = self.parse_export(input, decorator_ids.clone(), doc_comment) {
            let node_id = self.context.ast_nodes.alloc(node);
            return Ok((input, Some(node_id)));
        }
        
        if let Ok((input, node)) = self.parse_import(input) {
            let node_id = self.context.ast_nodes.alloc(node);
            return Ok((input, Some(node_id)));
        }
        
        if let Ok((input, node)) = self.parse_interface(input, decorator_ids.clone(), doc_comment) {
            let node_id = self.context.ast_nodes.alloc(node);
            return Ok((input, Some(node_id)));
        }
        
        if let Ok((input, node)) = self.parse_function(input, decorator_ids.clone(), doc_comment) {
            let node_id = self.context.ast_nodes.alloc(node);
            return Ok((input, Some(node_id)));
        }
        
        if let Ok((input, node)) = self.parse_type_alias(input, decorator_ids.clone(), doc_comment) {
            let node_id = self.context.ast_nodes.alloc(node);
            return Ok((input, Some(node_id)));
        }
        
        // If nothing matches, return None
        Ok((input, None))
    }

    fn parse_decorator<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = multispace0(input)?;
        let (input, _) = char('@')(input)?;
        let (input, name) = self.parse_identifier_str(input)?;
        let (input, _args) = opt(|i| self.parse_decorator_args(i))(input)?;
        let (input, _) = multispace0(input)?;

        // For now, just mark @validator decorators
        let node_id = if name == "validator" {
            ast::NodeId { index: u32::MAX }
        } else {
            ast::NodeId { index: 0 }
        };

        Ok((input, node_id))
    }

    fn parse_decorator_args<'a>(&self, input: &'a str) -> ParseResult<'a, ()> {
        let (input, _) = char('(')(input)?;
        let (input, _) = take_while(|c| c != ')')(input)?;
        let (input, _) = char(')')(input)?;
        Ok((input, ()))
    }

    fn parse_export<'a>(&mut self, input: &'a str, decorator_ids: Vec<ast::NodeId>, doc_comment: Option<ast::StringId>) -> ParseResult<'a, AstNode> {
        let (input, _) = tag("export")(input)?;
        let (input, _) = multispace1(input)?;

        // Check for export { ... }
        if let Ok((input, _)) = char::<_, VerboseError<&str>>('{')(input) {
            let (input, _exports) = self.parse_export_list(input)?;
            let (input, _) = char('}')(input)?;
            return Ok((input, AstNode::Export {
                statement: None,
                specifiers: NodeList::empty(),
                source: None,
                is_default: false,
                span: SourceSpan::new(0, 0),
            }));
        }

        // Export declaration - try each in sequence
        let (input, statement) = if let Ok(result) = self.parse_interface(input, decorator_ids.clone(), doc_comment) {
            result
        } else if let Ok(result) = self.parse_function(input, decorator_ids.clone(), doc_comment) {
            result
        } else if let Ok(result) = self.parse_type_alias(input, decorator_ids.clone(), doc_comment) {
            result
        } else {
            return Err(nom::Err::Error(VerboseError::from_error_kind(
                input,
                nom::error::ErrorKind::Alt,
            )));
        };

        let statement_id = self.context.ast_nodes.alloc(statement);
        
        Ok((input, AstNode::Export {
            statement: Some(statement_id),
            specifiers: NodeList::empty(),
            source: None,
            is_default: false,
            span: SourceSpan::new(0, 0),
        }))
    }

    fn parse_export_list<'a>(&self, input: &'a str) -> ParseResult<'a, Vec<String>> {
        // Simplified: just consume until }
        let (input, _) = take_while(|c| c != '}')(input)?;
        Ok((input, Vec::new()))
    }

    fn parse_import<'a>(&mut self, input: &'a str) -> ParseResult<'a, AstNode> {
        let (input, _) = tag("import")(input)?;
        let (input, _) = multispace1(input)?;
        let (input, _) = self.parse_import_specifiers(input)?;
        let (input, _) = multispace1(input)?;
        let (input, _) = tag("from")(input)?;
        let (input, _) = multispace1(input)?;
        let (input, source) = self.parse_string_literal(input)?;

        let source_id = self.context.intern(&source);

        Ok((input, AstNode::Import {
            specifiers: NodeList::empty(),
            source: source_id,
            span: SourceSpan::new(0, 0),
        }))
    }

    fn parse_import_specifiers<'a>(&self, input: &'a str) -> ParseResult<'a, ()> {
        // Handle { Name } from "./file" pattern
        if input.starts_with('{') {
            let (input, _) = char('{')(input)?;
            let (input, _) = multispace0(input)?;
            // Consume everything until }
            let (input, _) = take_while(|c| c != '}')(input)?;
            let (input, _) = char('}')(input)?;
            Ok((input, ()))
        } else {
            // Default import or * as name
            let (input, _) = take_while(|c: char| !c.is_whitespace())(input)?;
            Ok((input, ()))
        }
    }

    fn parse_interface<'a>(&mut self, input: &'a str, decorator_ids: Vec<ast::NodeId>, doc_comment: Option<ast::StringId>) -> ParseResult<'a, AstNode> {
        let start_input = input;
        let (input, _) = tag("interface")(input)?;
        let (input, _) = multispace1(input)?;
        let (input, name) = self.parse_identifier_str(input)?;
        let (input, _) = multispace0(input)?;
        let (input, _) = char('{')(input)?;
        let (input, fields) = self.parse_interface_body(input)?;
        let (input, _) = char('}')(input)?;
        let end_input = input;

        let name_id = self.context.intern(&name);
        let decorators = self.create_node_list(decorator_ids);
        
        let field_ids: Vec<ast::NodeId> = fields.into_iter()
            .map(|field| self.context.alloc_field(field))
            .collect();
        let fields_list = self.create_node_list(field_ids);

        let span = self.get_span(start_input, end_input);
        let type_node = TypeNode::Object {
            fields: fields_list,
            span,
        };
        let body_id = self.context.alloc_type(type_node);

        Ok((input, AstNode::TypeDecl {
            name: name_id,
            body: body_id,
            decorators,
            span,
            doc_comment,
        }))
    }

    fn parse_interface_body<'a>(&mut self, input: &'a str) -> ParseResult<'a, Vec<Field>> {
        let (mut input, _) = multispace0(input)?;
        let mut fields = Vec::new();
        
        loop {
            // Skip comments and whitespace
            let (new_input, _) = multispace0(input)?;
            input = new_input;
            
            // Try to skip comments
            while let Ok((new_input, _)) = self.parse_comment(input) {
                let (new_input, _) = multispace0(new_input)?;
                input = new_input;
            }
            
            // Check if we've reached the end of the interface
            if input.starts_with('}') {
                break;
            }
            
            // Try to parse a field
            if let Ok((new_input, field)) = self.parse_field(input) {
                fields.push(field);
                input = new_input;
                
                // Check for separator
                if let Ok((new_input, _)) = self.parse_field_separator(input) {
                    input = new_input;
                } else {
                    // Continue parsing even without separator
                }
            } else {
                break;
            }
        }
        
        Ok((input, fields))
    }

    fn parse_field<'a>(&mut self, input: &'a str) -> ParseResult<'a, Field> {
        let (input, _) = multispace0(input)?;
        
        // Parse decorators for field, but handle incomplete @ gracefully
        let mut decorators = Vec::new();
        let mut input = input;
        
        // Skip any standalone @ characters (incomplete decorators)
        while input.trim_start().starts_with('@') && !input.trim_start().chars().nth(1).map_or(false, |c| c.is_alphabetic()) {
            // Skip the @ and any following whitespace until newline
            let skip_input = input.trim_start();
            let (new_input, _) = char('@')(skip_input)?;
            // Skip until newline or next non-whitespace
            let skip_chars: String = new_input.chars()
                .take_while(|&c| c.is_whitespace() && c != '\n' && c != '\r')
                .collect();
            input = &new_input[skip_chars.len()..];
            let (new_input, _) = multispace0(input)?;
            input = new_input;
        }
        
        // Now try to parse real decorators
        while let Ok((new_input, decorator)) = self.parse_decorator(input) {
            decorators.push(decorator);
            input = new_input;
        }
        
        let (input, name) = self.parse_identifier_str(input)?;
        let (input, optional) = opt(char('?'))(input)?;
        let (input, _) = multispace0(input)?;
        let (input, _) = char(':')(input)?;
        let (input, _) = multispace0(input)?;
        let (input, type_node) = self.parse_type(input)?;

        let name_id = self.context.intern(&name);
        let decorators_list = self.create_node_list(decorators);

        Ok((input, Field {
            name: name_id,
            type_node,
            optional: optional.is_some(),
            readonly: false,
            decorators: decorators_list,
            span: SourceSpan::new(0, 0),
        }))
    }

    fn parse_function<'a>(&mut self, input: &'a str, decorator_ids: Vec<ast::NodeId>, doc_comment: Option<ast::StringId>) -> ParseResult<'a, AstNode> {
        let start_input = input;
        let (input, _) = tag("function")(input)?;
        let (input, _) = multispace1(input)?;
        let (input, name) = self.parse_identifier_str(input)?;
        let (input, _) = multispace0(input)?;
        let (input, _) = char('(')(input)?;
        let (input, params) = self.parse_params(input)?;
        let (input, _) = char(')')(input)?;
        let (input, _) = multispace0(input)?;
        let (input, return_type) = opt(|i| self.parse_return_type(i))(input)?;
        let (input, _) = multispace0(input)?;
        let (input, body) = opt(|i| self.parse_block(i))(input)?;
        let end_input = input;

        let name_id = self.context.intern(&name);
        let decorators = self.create_node_list(decorator_ids);
        let params_list = self.create_node_list(params);
        let span = self.get_span(start_input, end_input);

        Ok((input, AstNode::FunctionDecl {
            name: name_id,
            params: params_list,
            return_type,
            body,
            decorators,
            span,
            doc_comment,
        }))
    }

    fn parse_params<'a>(&mut self, input: &'a str) -> ParseResult<'a, Vec<ast::NodeId>> {
        let (mut input, _) = multispace0(input)?;
        let mut param_ids = Vec::new();
        
        while !input.starts_with(')') {
            if let Ok((new_input, param)) = self.parse_param(input) {
                let param_id = self.context.alloc_param(param);
                param_ids.push(param_id);
                input = new_input;
                
                let (new_input, _) = multispace0(input)?;
                input = new_input;
                
                if input.starts_with(',') {
                    let (new_input, _) = char(',')(input)?;
                    let (new_input, _) = multispace0(new_input)?;
                    input = new_input;
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        
        Ok((input, param_ids))
    }

    fn parse_param<'a>(&mut self, input: &'a str) -> ParseResult<'a, Param> {
        let (input, name) = self.parse_identifier_str(input)?;
        let (input, optional) = opt(char('?'))(input)?;
        let (input, _) = multispace0(input)?;
        let (input, type_node) = opt(preceded(
            |i| {
                let (i, _) = char::<_, VerboseError<&str>>(':')(i)?;
                let (i, _) = multispace0(i)?;
                Ok((i, ()))
            },
            |i| self.parse_type(i),
        ))(input)?;

        let name_id = self.context.intern(&name);

        Ok((input, Param {
            name: name_id,
            type_node,
            optional: optional.is_some(),
            default_value: None,
            span: SourceSpan::new(0, 0),
        }))
    }

    fn parse_return_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = char(':')(input)?;
        let (input, _) = multispace0(input)?;
        self.parse_type(input)
    }

    fn parse_type_alias<'a>(&mut self, input: &'a str, _decorator_ids: Vec<ast::NodeId>, doc_comment: Option<ast::StringId>) -> ParseResult<'a, AstNode> {
        let start_input = input;
        let (input, _) = tag("type")(input)?;
        let (input, _) = multispace1(input)?;
        let (input, name) = self.parse_identifier_str(input)?;
        let (input, _) = multispace0(input)?;
        let (input, _) = char('=')(input)?;
        let (input, _) = multispace0(input)?;
        let (input, body) = self.parse_type(input)?;
        let end_input = input;

        let name_id = self.context.intern(&name);
        let span = self.get_span(start_input, end_input);

        Ok((input, AstNode::TypeAlias {
            name: name_id,
            type_params: NodeList::empty(),
            body,
            span,
            doc_comment,
        }))
    }
}