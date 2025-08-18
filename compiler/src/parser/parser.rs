use crate::ast::{
    Decorator, InterfaceDecl, InterfaceMember, Program, Statement, TypeAnnotation,
    ImportDecl, ImportSpecifier, ExportDecl, ExportSpecifier, FunctionDecl, FunctionParam, FunctionBody,
    FunctionStatement, Expression, Literal, BinaryOperator, UnaryOperator
};
use crate::lexer::{Token, TokenKind};
use anyhow::{bail, Result};

pub struct Parser {
    tokens: Vec<Token>,
    current: usize,
}

impl Parser {
    pub fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, current: 0 }
    }

    fn skip_whitespace_and_comments(&mut self) {
        while matches!(
            self.peek_kind(),
            Some(TokenKind::Comment(_)) | Some(TokenKind::Whitespace) | Some(TokenKind::Newline)
        ) {
            self.advance();
        }
    }

    pub async fn parse(&mut self) -> Result<Program> {
        let mut statements = Vec::new();

        while !self.is_at_end() {
            // Yield control periodically for large files
            if statements.len() % 10 == 0 {
                tokio::task::yield_now().await;
            }
            
            if let Some(stmt) = self.parse_statement().await? {
                statements.push(stmt);
            }
        }

        Ok(Program { statements })
    }

    async fn parse_statement(&mut self) -> Result<Option<Statement>> {
        // Skip comments and whitespace
        while matches!(
            self.peek_kind(),
            Some(TokenKind::Comment(_)) | Some(TokenKind::Whitespace) | Some(TokenKind::Newline)
        ) {
            self.advance();
        }

        if self.is_at_end() {
            return Ok(None);
        }

        // Check for decorators
        let decorators = self.parse_decorators()?;

        match self.peek_kind() {
            Some(TokenKind::Interface) => {
                let interface = self.parse_interface(decorators)?;
                Ok(Some(Statement::Interface(interface)))
            }
            Some(TokenKind::Export) => {
                if !decorators.is_empty() {
                    bail!("Decorators cannot be applied to export statements");
                }
                let export = self.parse_export()?;
                Ok(Some(Statement::Export(export)))
            }
            Some(TokenKind::Import) => {
                if !decorators.is_empty() {
                    bail!("Decorators cannot be applied to import statements");
                }
                let import = self.parse_import()?;
                Ok(Some(Statement::Import(import)))
            }
            Some(TokenKind::Function) => {
                let function = self.parse_function(decorators)?;
                Ok(Some(Statement::Function(function)))
            }
            Some(TokenKind::Type) => {
                // TODO: Implement type alias parsing
                bail!("Type aliases not yet implemented")
            }
            _ => {
                if !decorators.is_empty() {
                    bail!("Decorators can only be applied to interfaces, functions, and type aliases");
                }
                Ok(None)
            }
        }
    }

    fn parse_interface(&mut self, decorators: Vec<Decorator>) -> Result<InterfaceDecl> {
        self.expect(TokenKind::Interface)?;
        
        let name = self.parse_identifier()?;
        self.skip_whitespace_and_comments();
        
        // TODO: Parse type parameters
        let type_params = None;
        
        // Parse extends clause
        let mut extends = Vec::new();
        if self.check(&TokenKind::Extends) {
            self.advance();
            self.skip_whitespace_and_comments();
            
            // Parse comma-separated list of extended interfaces
            loop {
                let extended_interface = self.parse_identifier()?;
                extends.push(extended_interface);
                self.skip_whitespace_and_comments();
                
                if !self.check(&TokenKind::Comma) {
                    break;
                }
                self.advance();
                self.skip_whitespace_and_comments();
            }
        }
        
        self.expect(TokenKind::LeftBrace)?;
        
        let mut members = Vec::new();
        
        while !self.check(&TokenKind::RightBrace) && !self.is_at_end() {
            // Skip comments, newlines and semicolons
            while matches!(
                self.peek_kind(),
                Some(TokenKind::Comment(_)) | Some(TokenKind::Whitespace) | Some(TokenKind::Newline) | Some(TokenKind::Semicolon)
            ) {
                self.advance();
            }
            
            if self.check(&TokenKind::RightBrace) {
                break;
            }
            
            let member = self.parse_interface_member()?;
            members.push(member);
        }
        
        self.expect(TokenKind::RightBrace)?;
        
        Ok(InterfaceDecl {
            decorators,
            name,
            type_params,
            extends,
            members,
        })
    }

    fn parse_interface_member(&mut self) -> Result<InterfaceMember> {
        // Skip comments before decorators
        self.skip_whitespace_and_comments();
        
        let decorators = self.parse_decorators()?;
        
        let readonly = if self.check(&TokenKind::Readonly) {
            self.advance();
            true
        } else {
            false
        };
        
        let key = self.parse_identifier()?;
        
        let optional = if self.check(&TokenKind::Question) {
            self.advance();
            true
        } else {
            false
        };
        
        self.expect(TokenKind::Colon)?;
        
        let type_annotation = self.parse_type_annotation()?;
        
        // Skip optional semicolon or newline
        if matches!(
            self.peek_kind(),
            Some(TokenKind::Semicolon) | Some(TokenKind::Newline)
        ) {
            self.advance();
        }
        
        Ok(InterfaceMember {
            decorators,
            key,
            optional,
            readonly,
            type_annotation,
        })
    }

    fn parse_decorators(&mut self) -> Result<Vec<Decorator>> {
        let mut decorators = Vec::new();
        
        while self.check(&TokenKind::At) {
            self.advance(); // consume @
            
            let name = self.parse_identifier()?;
            
            let args = if self.check(&TokenKind::LeftParen) {
                self.parse_decorator_args()?
            } else {
                Vec::new()
            };
            
            decorators.push(Decorator { name, args });
            
            // Skip comments and whitespace between decorators
            self.skip_whitespace_and_comments();
        }
        
        Ok(decorators)
    }

    fn parse_decorator_args(&mut self) -> Result<Vec<crate::ast::DecoratorArg>> {
        
        self.expect(TokenKind::LeftParen)?;
        
        let mut args = Vec::new();
        
        while !self.check(&TokenKind::RightParen) && !self.is_at_end() {
            // Skip whitespace and newlines
            while matches!(
                self.peek_kind(),
                Some(TokenKind::Whitespace) | Some(TokenKind::Newline)
            ) {
                self.advance();
            }
            
            if self.check(&TokenKind::RightParen) {
                break;
            }
            
            let arg = self.parse_decorator_arg()?;
            args.push(arg);
            
            // Skip whitespace
            while matches!(self.peek_kind(), Some(TokenKind::Whitespace)) {
                self.advance();
            }
            
            // Check for comma
            if self.check(&TokenKind::Comma) {
                self.advance();
            } else if !self.check(&TokenKind::RightParen) {
                bail!("Expected comma or closing parenthesis in decorator arguments");
            }
        }
        
        self.expect(TokenKind::RightParen)?;
        
        Ok(args)
    }
    
    fn parse_decorator_arg(&mut self) -> Result<crate::ast::DecoratorArg> {
        use crate::ast::DecoratorArg;
        
        match self.peek_kind() {
            Some(TokenKind::StringLiteral(s)) => {
                let s = s.clone();
                self.advance();
                Ok(DecoratorArg::String(s))
            }
            Some(TokenKind::NumberLiteral(n)) => {
                let n = *n;
                self.advance();
                Ok(DecoratorArg::Number(n))
            }
            Some(TokenKind::BooleanLiteral(b)) => {
                let b = *b;
                self.advance();
                Ok(DecoratorArg::Boolean(b))
            }
            Some(TokenKind::RegexLiteral(r)) => {
                let r = r.clone();
                self.advance();
                Ok(DecoratorArg::Regex(r))
            }
            Some(TokenKind::Identifier(id)) => {
                let id = id.clone();
                self.advance();
                Ok(DecoratorArg::Identifier(id))
            }
            Some(TokenKind::LeftBracket) => {
                self.advance();
                let mut elements = Vec::new();
                
                while !self.check(&TokenKind::RightBracket) && !self.is_at_end() {
                    // Skip whitespace
                    while matches!(self.peek_kind(), Some(TokenKind::Whitespace) | Some(TokenKind::Newline)) {
                        self.advance();
                    }
                    
                    if self.check(&TokenKind::RightBracket) {
                        break;
                    }
                    
                    elements.push(self.parse_decorator_arg()?);
                    
                    // Skip whitespace
                    while matches!(self.peek_kind(), Some(TokenKind::Whitespace)) {
                        self.advance();
                    }
                    
                    if self.check(&TokenKind::Comma) {
                        self.advance();
                    }
                }
                
                self.expect(TokenKind::RightBracket)?;
                Ok(DecoratorArg::Array(elements))
            }
            Some(TokenKind::LeftBrace) => {
                self.advance();
                let mut fields = Vec::new();
                
                while !self.check(&TokenKind::RightBrace) && !self.is_at_end() {
                    // Skip whitespace
                    while matches!(self.peek_kind(), Some(TokenKind::Whitespace) | Some(TokenKind::Newline)) {
                        self.advance();
                    }
                    
                    if self.check(&TokenKind::RightBrace) {
                        break;
                    }
                    
                    // Parse key
                    let key = match self.peek_kind() {
                        Some(TokenKind::Identifier(k)) => k.clone(),
                        Some(TokenKind::StringLiteral(k)) => k.clone(),
                        _ => bail!("Expected object key"),
                    };
                    self.advance();
                    
                    // Skip whitespace
                    while matches!(self.peek_kind(), Some(TokenKind::Whitespace)) {
                        self.advance();
                    }
                    
                    self.expect(TokenKind::Colon)?;
                    
                    // Skip whitespace
                    while matches!(self.peek_kind(), Some(TokenKind::Whitespace)) {
                        self.advance();
                    }
                    
                    let value = self.parse_decorator_arg()?;
                    fields.push((key, value));
                    
                    // Skip whitespace
                    while matches!(self.peek_kind(), Some(TokenKind::Whitespace)) {
                        self.advance();
                    }
                    
                    if self.check(&TokenKind::Comma) {
                        self.advance();
                    }
                }
                
                self.expect(TokenKind::RightBrace)?;
                Ok(DecoratorArg::Object(fields))
            }
            _ => bail!("Unexpected token in decorator argument: {:?}", self.peek_kind()),
        }
    }

    fn parse_type_annotation(&mut self) -> Result<TypeAnnotation> {
        let mut base_type = self.parse_primary_type()?;
        
        // Check for union type (|)
        if self.check(&TokenKind::Pipe) {
            let mut union_types = vec![base_type];
            
            while self.check(&TokenKind::Pipe) {
                self.advance(); // consume |
                
                // Skip whitespace
                while matches!(self.peek_kind(), Some(TokenKind::Whitespace)) {
                    self.advance();
                }
                
                union_types.push(self.parse_primary_type()?);
            }
            
            base_type = TypeAnnotation::Union(union_types);
        }
        
        // Check for array syntax
        if self.check(&TokenKind::LeftBracket) {
            self.advance();
            self.expect(TokenKind::RightBracket)?;
            Ok(TypeAnnotation::Array(Box::new(base_type)))
        } else {
            Ok(base_type)
        }
    }

    fn parse_primary_type(&mut self) -> Result<TypeAnnotation> {
        match self.peek_kind() {
            Some(TokenKind::StringType) => {
                self.advance();
                Ok(TypeAnnotation::String)
            }
            Some(TokenKind::NumberType) => {
                self.advance();
                Ok(TypeAnnotation::Number)
            }
            Some(TokenKind::BooleanType) => {
                self.advance();
                Ok(TypeAnnotation::Boolean)
            }
            Some(TokenKind::NullType) => {
                self.advance();
                Ok(TypeAnnotation::Null)
            }
            Some(TokenKind::UndefinedType) => {
                self.advance();
                Ok(TypeAnnotation::Undefined)
            }
            Some(TokenKind::VoidType) => {
                self.advance();
                Ok(TypeAnnotation::Void)
            }
            Some(TokenKind::StringLiteral(s)) => {
                let s = s.clone();
                self.advance();
                Ok(TypeAnnotation::StringLiteral(s))
            }
            Some(TokenKind::NumberLiteral(n)) => {
                let n = *n;
                self.advance();
                Ok(TypeAnnotation::NumberLiteral(n))
            }
            Some(TokenKind::BooleanLiteral(b)) => {
                let b = *b;
                self.advance();
                Ok(TypeAnnotation::BooleanLiteral(b))
            }
            Some(TokenKind::LeftBrace) => {
                // Parse inline object type
                self.parse_object_type()
            }
            Some(TokenKind::Identifier(name)) => {
                let name = name.clone();
                self.advance();
                Ok(TypeAnnotation::Reference {
                    name,
                    type_args: None,
                })
            }
            _ => bail!("Expected type annotation"),
        }
    }

    fn parse_object_type(&mut self) -> Result<TypeAnnotation> {
        use crate::ast::ObjectTypeMember;
        
        self.expect(TokenKind::LeftBrace)?;
        
        let mut members = Vec::new();
        
        while !self.check(&TokenKind::RightBrace) && !self.is_at_end() {
            // Skip whitespace, comments, and newlines
            self.skip_whitespace_and_comments();
            
            if self.check(&TokenKind::RightBrace) {
                break;
            }
            
            // Parse decorators for this member
            let decorators = self.parse_decorators()?;
            
            // Parse readonly modifier if present
            let readonly = if self.check(&TokenKind::Readonly) {
                self.advance();
                true
            } else {
                false
            };
            
            // Parse key
            let key = self.parse_identifier()?;
            
            // Parse optional modifier
            let optional = if self.check(&TokenKind::Question) {
                self.advance();
                true
            } else {
                false
            };
            
            // Expect colon
            self.expect(TokenKind::Colon)?;
            
            // Skip whitespace
            while matches!(self.peek_kind(), Some(TokenKind::Whitespace)) {
                self.advance();
            }
            
            // Parse type annotation
            let type_annotation = self.parse_type_annotation()?;
            
            members.push(ObjectTypeMember {
                decorators,
                key,
                optional,
                readonly,
                type_annotation,
            });
            
            // Skip whitespace and newlines
            self.skip_whitespace_and_comments();
            
            // Check for semicolon or comma
            if matches!(self.peek_kind(), Some(TokenKind::Semicolon) | Some(TokenKind::Comma)) {
                self.advance();
            }
            
            // Skip more whitespace and newlines
            self.skip_whitespace_and_comments();
        }
        
        self.expect(TokenKind::RightBrace)?;
        
        Ok(TypeAnnotation::Object(members))
    }

    fn parse_import(&mut self) -> Result<ImportDecl> {
        self.expect(TokenKind::Import)?;
        self.skip_whitespace_and_comments();
        
        let mut specifiers = Vec::new();
        
        // Check for namespace import, default import or named imports
        if self.check(&TokenKind::Multiply) {
            // Namespace import: import * as name from "..."
            self.advance(); // consume *
            self.skip_whitespace_and_comments();
            
            self.expect(TokenKind::As)?;
            self.skip_whitespace_and_comments();
            
            let name = self.parse_identifier()?;
            specifiers.push(ImportSpecifier::Namespace(name));
        } else if self.check(&TokenKind::LeftBrace) {
            // Named imports: import { a, b as c } from "..."
            self.advance(); // consume {
            self.skip_whitespace_and_comments();
            
            while !self.check(&TokenKind::RightBrace) && !self.is_at_end() {
                // Check for 'type' keyword (type-only import)
                let _is_type_only = if self.check(&TokenKind::Type) {
                    self.advance();
                    self.skip_whitespace_and_comments();
                    true
                } else {
                    false
                };
                
                let name = self.parse_identifier()?;
                self.skip_whitespace_and_comments();
                
                let alias = if self.check(&TokenKind::As) {
                    self.advance(); // consume 'as'
                    self.skip_whitespace_and_comments();
                    Some(self.parse_identifier()?)
                } else {
                    None
                };
                
                specifiers.push(ImportSpecifier::Named { name, alias });
                
                self.skip_whitespace_and_comments();
                if self.check(&TokenKind::Comma) {
                    self.advance();
                    self.skip_whitespace_and_comments();
                }
            }
            
            self.expect(TokenKind::RightBrace)?;
        } else if let Some(TokenKind::Identifier(_)) = self.peek_kind() {
            // Default import: import Foo from "..."
            let name = self.parse_identifier()?;
            specifiers.push(ImportSpecifier::Default(name));
        }
        
        self.skip_whitespace_and_comments();
        self.expect(TokenKind::From)?;
        self.skip_whitespace_and_comments();
        
        // Parse module path
        let source = if let Some(TokenKind::StringLiteral(path)) = self.peek_kind() {
            let path = path.clone();
            self.advance();
            path
        } else {
            bail!("Expected string literal for import source");
        };
        
        // Skip optional semicolon
        self.skip_whitespace_and_comments();
        if self.check(&TokenKind::Semicolon) {
            self.advance();
        }
        
        Ok(ImportDecl { specifiers, source })
    }
    
    fn parse_export(&mut self) -> Result<ExportDecl> {
        self.expect(TokenKind::Export)?;
        self.skip_whitespace_and_comments();
        
        // Check for default export
        let is_default = if self.check(&TokenKind::Default) {
            self.advance();
            self.skip_whitespace_and_comments();
            true
        } else {
            false
        };
        
        // Parse the exported statement or re-export
        if self.check(&TokenKind::LeftBrace) {
            // Re-export: export { a, b } from "..."
            self.advance(); // consume {
            self.skip_whitespace_and_comments();
            
            let mut specifiers = Vec::new();
            
            while !self.check(&TokenKind::RightBrace) && !self.is_at_end() {
                let name = self.parse_identifier()?;
                self.skip_whitespace_and_comments();
                
                let alias = if self.check(&TokenKind::As) {
                    self.advance(); // consume 'as'
                    self.skip_whitespace_and_comments();
                    Some(self.parse_identifier()?)
                } else {
                    None
                };
                
                specifiers.push(ExportSpecifier::Named { name, alias });
                
                self.skip_whitespace_and_comments();
                if self.check(&TokenKind::Comma) {
                    self.advance();
                    self.skip_whitespace_and_comments();
                }
            }
            
            self.expect(TokenKind::RightBrace)?;
            self.skip_whitespace_and_comments();
            
            // Check for 'from' clause (re-export)
            let source = if self.check(&TokenKind::From) {
                self.advance();
                self.skip_whitespace_and_comments();
                
                if let Some(TokenKind::StringLiteral(path)) = self.peek_kind() {
                    let path = path.clone();
                    self.advance();
                    Some(path)
                } else {
                    bail!("Expected string literal after 'from'");
                }
            } else {
                None
            };
            
            // Skip optional semicolon
            self.skip_whitespace_and_comments();
            if self.check(&TokenKind::Semicolon) {
                self.advance();
            }
            
            Ok(ExportDecl {
                statement: None,
                specifiers: Some(specifiers),
                source,
                is_default: false,
            })
        } else if self.check(&TokenKind::Interface) {
            let decorators = Vec::new();
            let interface = self.parse_interface(decorators)?;
            Ok(ExportDecl {
                statement: Some(Box::new(Statement::Interface(interface))),
                specifiers: None,
                source: None,
                is_default,
            })
        } else if self.check(&TokenKind::Function) {
            let decorators = Vec::new();
            let function = self.parse_function(decorators)?;
            Ok(ExportDecl {
                statement: Some(Box::new(Statement::Function(function))),
                specifiers: None,
                source: None,
                is_default,
            })
        } else if self.check(&TokenKind::Multiply) {
            // Namespace export: export * from "..."
            self.advance(); // consume *
            self.skip_whitespace_and_comments();
            
            let alias = if self.check(&TokenKind::As) {
                self.advance();
                self.skip_whitespace_and_comments();
                Some(self.parse_identifier()?)
            } else {
                None
            };
            
            self.skip_whitespace_and_comments();
            self.expect(TokenKind::From)?;
            self.skip_whitespace_and_comments();
            
            let source = if let Some(TokenKind::StringLiteral(path)) = self.peek_kind() {
                let path = path.clone();
                self.advance();
                path
            } else {
                bail!("Expected string literal after 'from'");
            };
            
            Ok(ExportDecl {
                statement: None,
                specifiers: Some(vec![ExportSpecifier::Namespace(alias.unwrap_or_else(|| "*".to_string()))]),
                source: Some(source),
                is_default: false,
            })
        } else {
            Ok(ExportDecl {
                statement: None,
                specifiers: None,
                source: None,
                is_default,
            })
        }
    }
    
    fn parse_function(&mut self, decorators: Vec<Decorator>) -> Result<FunctionDecl> {
        self.expect(TokenKind::Function)?;
        self.skip_whitespace_and_comments();
        
        let name = self.parse_identifier()?;
        self.skip_whitespace_and_comments();
        
        // Parse parameters
        self.expect(TokenKind::LeftParen)?;
        self.skip_whitespace_and_comments();
        
        let mut params = Vec::new();
        while !self.check(&TokenKind::RightParen) && !self.is_at_end() {
            let param_name = self.parse_identifier()?;
            self.skip_whitespace_and_comments();
            
            let optional = if self.check(&TokenKind::Question) {
                self.advance();
                self.skip_whitespace_and_comments();
                true
            } else {
                false
            };
            
            let type_annotation = if self.check(&TokenKind::Colon) {
                self.advance();
                self.skip_whitespace_and_comments();
                Some(self.parse_type_annotation()?)
            } else {
                None
            };
            
            params.push(FunctionParam {
                name: param_name,
                type_annotation,
                optional,
                default_value: None, // TODO: Parse default values
            });
            
            self.skip_whitespace_and_comments();
            if self.check(&TokenKind::Comma) {
                self.advance();
                self.skip_whitespace_and_comments();
            }
        }
        
        self.expect(TokenKind::RightParen)?;
        self.skip_whitespace_and_comments();
        
        // Parse return type
        let return_type = if self.check(&TokenKind::Colon) {
            self.advance();
            self.skip_whitespace_and_comments();
            Some(self.parse_type_annotation()?)
        } else {
            None
        };
        
        self.skip_whitespace_and_comments();
        
        // Parse function body
        let body = if self.check(&TokenKind::LeftBrace) {
            self.advance();
            self.skip_whitespace_and_comments();
            
            let mut statements = Vec::new();
            
            while !self.check(&TokenKind::RightBrace) && !self.is_at_end() {
                if let Some(stmt) = self.parse_function_statement()? {
                    statements.push(stmt);
                }
                self.skip_whitespace_and_comments();
            }
            
            self.expect(TokenKind::RightBrace)?;
            
            Some(FunctionBody { statements })
        } else {
            // Function declaration without body
            None
        };
        
        Ok(FunctionDecl {
            decorators,
            name,
            params,
            return_type,
            body,
        })
    }

    fn parse_function_statement(&mut self) -> Result<Option<FunctionStatement>> {
        match self.peek_kind() {
            Some(TokenKind::Return) => {
                self.advance(); // consume 'return'
                self.skip_whitespace_and_comments();
                
                // Check if there's a return value
                let value = if self.check(&TokenKind::Semicolon) || self.check(&TokenKind::RightBrace) {
                    None
                } else {
                    Some(self.parse_expression()?)
                };
                
                // Skip optional semicolon
                if self.check(&TokenKind::Semicolon) {
                    self.advance();
                }
                
                Ok(Some(FunctionStatement::Return(value)))
            }
            Some(TokenKind::If) => {
                self.advance(); // consume 'if'
                self.skip_whitespace_and_comments();
                
                self.expect(TokenKind::LeftParen)?;
                self.skip_whitespace_and_comments();
                
                let condition = self.parse_expression()?;
                
                self.skip_whitespace_and_comments();
                self.expect(TokenKind::RightParen)?;
                self.skip_whitespace_and_comments();
                
                self.expect(TokenKind::LeftBrace)?;
                self.skip_whitespace_and_comments();
                
                let mut then_branch = Vec::new();
                while !self.check(&TokenKind::RightBrace) && !self.is_at_end() {
                    if let Some(stmt) = self.parse_function_statement()? {
                        then_branch.push(stmt);
                    }
                    self.skip_whitespace_and_comments();
                }
                
                self.expect(TokenKind::RightBrace)?;
                self.skip_whitespace_and_comments();
                
                // Check for else clause
                let else_branch = if self.check(&TokenKind::Else) {
                    self.advance(); // consume 'else'
                    self.skip_whitespace_and_comments();
                    
                    self.expect(TokenKind::LeftBrace)?;
                    self.skip_whitespace_and_comments();
                    
                    let mut else_stmts = Vec::new();
                    while !self.check(&TokenKind::RightBrace) && !self.is_at_end() {
                        if let Some(stmt) = self.parse_function_statement()? {
                            else_stmts.push(stmt);
                        }
                        self.skip_whitespace_and_comments();
                    }
                    
                    self.expect(TokenKind::RightBrace)?;
                    Some(else_stmts)
                } else {
                    None
                };
                
                Ok(Some(FunctionStatement::If {
                    condition,
                    then_branch,
                    else_branch,
                }))
            }
            Some(TokenKind::Comment(_)) | Some(TokenKind::Whitespace) | Some(TokenKind::Newline) => {
                self.advance();
                Ok(None)
            }
            _ if !self.check(&TokenKind::RightBrace) => {
                // Parse as an expression statement
                let expr = self.parse_expression()?;
                
                // Skip optional semicolon
                if self.check(&TokenKind::Semicolon) {
                    self.advance();
                }
                
                Ok(Some(FunctionStatement::Expression(expr)))
            }
            _ => Ok(None)
        }
    }
    
    fn parse_expression(&mut self) -> Result<Expression> {
        self.parse_logical_or()
    }
    
    fn parse_logical_or(&mut self) -> Result<Expression> {
        let mut left = self.parse_logical_and()?;
        
        while self.check(&TokenKind::Pipe) {
            // Check for double pipe ||
            let pos = self.current;
            self.advance();
            if self.check(&TokenKind::Pipe) {
                self.advance();
                let right = self.parse_logical_and()?;
                left = Expression::Binary {
                    left: Box::new(left),
                    operator: BinaryOperator::Or,
                    right: Box::new(right),
                };
            } else {
                // Single pipe, restore position
                self.current = pos;
                break;
            }
        }
        
        Ok(left)
    }
    
    fn parse_logical_and(&mut self) -> Result<Expression> {
        let mut left = self.parse_equality()?;
        
        while self.check(&TokenKind::Ampersand) {
            // Check for double ampersand &&
            let pos = self.current;
            self.advance();
            if self.check(&TokenKind::Ampersand) {
                self.advance();
                let right = self.parse_equality()?;
                left = Expression::Binary {
                    left: Box::new(left),
                    operator: BinaryOperator::And,
                    right: Box::new(right),
                };
            } else {
                // Single ampersand, restore position
                self.current = pos;
                break;
            }
        }
        
        Ok(left)
    }
    
    fn parse_equality(&mut self) -> Result<Expression> {
        let mut left = self.parse_comparison()?;
        
        while self.check(&TokenKind::Equals) {
            // Check for double equals ==
            let pos = self.current;
            self.advance();
            if self.check(&TokenKind::Equals) {
                self.advance();
                let right = self.parse_comparison()?;
                left = Expression::Binary {
                    left: Box::new(left),
                    operator: BinaryOperator::Equal,
                    right: Box::new(right),
                };
            } else {
                // Single equals, restore position
                self.current = pos;
                break;
            }
        }
        
        Ok(left)
    }
    
    fn parse_comparison(&mut self) -> Result<Expression> {
        let mut left = self.parse_additive()?;
        
        loop {
            match self.peek_kind() {
                Some(TokenKind::LessThan) => {
                    self.advance();
                    let right = self.parse_additive()?;
                    left = Expression::Binary {
                        left: Box::new(left),
                        operator: BinaryOperator::LessThan,
                        right: Box::new(right),
                    };
                }
                Some(TokenKind::GreaterThan) => {
                    self.advance();
                    let right = self.parse_additive()?;
                    left = Expression::Binary {
                        left: Box::new(left),
                        operator: BinaryOperator::GreaterThan,
                        right: Box::new(right),
                    };
                }
                _ => break
            }
        }
        
        Ok(left)
    }
    
    fn parse_additive(&mut self) -> Result<Expression> {
        let mut left = self.parse_multiplicative()?;
        
        loop {
            match self.peek_kind() {
                Some(TokenKind::Plus) => {
                    self.advance();
                    let right = self.parse_multiplicative()?;
                    left = Expression::Binary {
                        left: Box::new(left),
                        operator: BinaryOperator::Add,
                        right: Box::new(right),
                    };
                }
                Some(TokenKind::Minus) => {
                    self.advance();
                    let right = self.parse_multiplicative()?;
                    left = Expression::Binary {
                        left: Box::new(left),
                        operator: BinaryOperator::Subtract,
                        right: Box::new(right),
                    };
                }
                _ => break
            }
        }
        
        Ok(left)
    }
    
    fn parse_multiplicative(&mut self) -> Result<Expression> {
        let mut left = self.parse_unary()?;
        
        loop {
            match self.peek_kind() {
                Some(TokenKind::Multiply) => {
                    self.advance();
                    let right = self.parse_unary()?;
                    left = Expression::Binary {
                        left: Box::new(left),
                        operator: BinaryOperator::Multiply,
                        right: Box::new(right),
                    };
                }
                Some(TokenKind::Slash) => {
                    self.advance();
                    let right = self.parse_unary()?;
                    left = Expression::Binary {
                        left: Box::new(left),
                        operator: BinaryOperator::Divide,
                        right: Box::new(right),
                    };
                }
                _ => break
            }
        }
        
        Ok(left)
    }
    
    fn parse_unary(&mut self) -> Result<Expression> {
        match self.peek_kind() {
            Some(TokenKind::Exclamation) => {
                self.advance();
                let operand = self.parse_unary()?;
                Ok(Expression::Unary {
                    operator: UnaryOperator::Not,
                    operand: Box::new(operand),
                })
            }
            Some(TokenKind::Minus) => {
                // Check if this might be a negative number
                let pos = self.current;
                self.advance();
                if let Some(TokenKind::NumberLiteral(_)) = self.peek_kind() {
                    // Let number parsing handle negative numbers
                    self.current = pos;
                    self.parse_postfix()
                } else {
                    let operand = self.parse_unary()?;
                    Ok(Expression::Unary {
                        operator: UnaryOperator::Minus,
                        operand: Box::new(operand),
                    })
                }
            }
            Some(TokenKind::Plus) => {
                self.advance();
                let operand = self.parse_unary()?;
                Ok(Expression::Unary {
                    operator: UnaryOperator::Plus,
                    operand: Box::new(operand),
                })
            }
            _ => self.parse_postfix(),
        }
    }
    
    fn parse_postfix(&mut self) -> Result<Expression> {
        let mut expr = self.parse_primary_expression()?;
        
        loop {
            match self.peek_kind() {
                Some(TokenKind::LeftParen) => {
                    // Function call
                    self.advance();
                    self.skip_whitespace_and_comments();
                    
                    let mut arguments = Vec::new();
                    while !self.check(&TokenKind::RightParen) && !self.is_at_end() {
                        arguments.push(self.parse_expression()?);
                        self.skip_whitespace_and_comments();
                        
                        if self.check(&TokenKind::Comma) {
                            self.advance();
                            self.skip_whitespace_and_comments();
                        }
                    }
                    
                    self.expect(TokenKind::RightParen)?;
                    
                    expr = Expression::Call {
                        callee: Box::new(expr),
                        arguments,
                    };
                }
                Some(TokenKind::Dot) => {
                    // Member access
                    self.advance();
                    self.skip_whitespace_and_comments();
                    
                    let property = self.parse_identifier()?;
                    
                    expr = Expression::MemberAccess {
                        object: Box::new(expr),
                        property,
                    };
                }
                _ => break
            }
        }
        
        Ok(expr)
    }
    
    fn parse_primary_expression(&mut self) -> Result<Expression> {
        self.skip_whitespace_and_comments();
        
        match self.peek_kind() {
            Some(TokenKind::Import) => {
                // Check if this is a dynamic import
                let pos = self.current;
                self.advance(); // consume 'import'
                
                if self.check(&TokenKind::LeftParen) {
                    // Dynamic import
                    self.advance(); // consume '('
                    self.skip_whitespace_and_comments();
                    
                    let source = if let Some(TokenKind::StringLiteral(path)) = self.peek_kind() {
                        let path = path.clone();
                        self.advance();
                        path
                    } else {
                        let span = self.current_span();
                        bail!("Expected string literal in dynamic import at line {}, column {}", span.line, span.column);
                    };
                    
                    self.skip_whitespace_and_comments();
                    self.expect(TokenKind::RightParen)?;
                    
                    Ok(Expression::DynamicImport { source })
                } else {
                    // Not a dynamic import, restore position
                    self.current = pos;
                    let span = self.current_span();
                    bail!("Unexpected 'import' keyword in expression at line {}, column {}", span.line, span.column)
                }
            }
            Some(TokenKind::Identifier(name)) => {
                let name = name.clone();
                self.advance();
                Ok(Expression::Identifier(name))
            }
            Some(TokenKind::StringLiteral(s)) => {
                let s = s.clone();
                self.advance();
                Ok(Expression::Literal(Literal::String(s)))
            }
            Some(TokenKind::NumberLiteral(n)) => {
                let n = *n;
                self.advance();
                Ok(Expression::Literal(Literal::Number(n)))
            }
            Some(TokenKind::BooleanLiteral(b)) => {
                let b = *b;
                self.advance();
                Ok(Expression::Literal(Literal::Boolean(b)))
            }
            Some(TokenKind::NullType) => {
                self.advance();
                Ok(Expression::Literal(Literal::Null))
            }
            Some(TokenKind::UndefinedType) => {
                self.advance();
                Ok(Expression::Literal(Literal::Undefined))
            }
            Some(TokenKind::RegexLiteral(r)) => {
                let r = r.clone();
                self.advance();
                Ok(Expression::Literal(Literal::Regex(r)))
            }
            Some(TokenKind::LeftParen) => {
                self.advance();
                self.skip_whitespace_and_comments();
                let expr = self.parse_expression()?;
                self.skip_whitespace_and_comments();
                self.expect(TokenKind::RightParen)?;
                Ok(expr)
            }
            _ => bail!("Unexpected token in expression: {:?}", self.peek_kind())
        }
    }

    fn parse_identifier(&mut self) -> Result<String> {
        match self.peek_kind() {
            Some(TokenKind::Identifier(name)) => {
                let name = name.clone();
                self.advance();
                Ok(name)
            }
            _ => {
                let span = self.current_span();
                bail!("Expected identifier at line {}, column {}", span.line, span.column)
            },
        }
    }

    fn expect(&mut self, kind: TokenKind) -> Result<()> {
        if self.check(&kind) {
            self.advance();
            Ok(())
        } else {
            let span = self.current_span();
            bail!(
                "Expected {:?}, found {:?} at line {}, column {}",
                kind,
                self.peek_kind(),
                span.line,
                span.column
            )
        }
    }
    
    fn current_span(&self) -> crate::lexer::Span {
        self.tokens
            .get(self.current)
            .map(|t| t.span)
            .unwrap_or(crate::lexer::Span {
                start: 0,
                end: 0,
                line: 1,
                column: 1,
            })
    }

    fn check(&self, kind: &TokenKind) -> bool {
        matches!(self.peek_kind(), Some(k) if std::mem::discriminant(k) == std::mem::discriminant(kind))
    }

    fn peek_kind(&self) -> Option<&TokenKind> {
        self.tokens.get(self.current).map(|t| &t.kind)
    }

    fn advance(&mut self) -> Option<&Token> {
        if !self.is_at_end() {
            self.current += 1;
            self.tokens.get(self.current - 1)
        } else {
            None
        }
    }

    fn is_at_end(&self) -> bool {
        matches!(self.peek_kind(), Some(TokenKind::Eof) | None)
    }
}