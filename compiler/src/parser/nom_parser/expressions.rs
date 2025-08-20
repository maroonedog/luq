use nom::{
    branch::alt,
    bytes::complete::{tag, take_while},
    character::complete::{char, multispace0},
    combinator::value,
    multi::{many0, separated_list0},
    sequence::tuple,
    error::{VerboseError, ParseError},
};
use crate::ast::{self, nodes::*, SourceSpan};
use super::{Parser, ParseResult};

impl Parser {
    pub(crate) fn parse_expression<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        self.parse_logical_or(input)
    }
    
    // Logical OR (||)
    fn parse_logical_or<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (mut input, mut first) = self.parse_logical_and(input)?;
        
        loop {
            let (new_input, _) = multispace0(input)?;
            if let Ok((new_input, _)) = tag::<_, _, VerboseError<&str>>("||")(new_input) {
                let (new_input, _) = multispace0(new_input)?;
                let (new_input, right) = self.parse_logical_and(new_input)?;
                first = self.context.alloc_expr(ExprNode::Binary {
                    left: first,
                    op: BinaryOp::Or,
                    right,
                    span: SourceSpan::new(0, 0),
                });
                input = new_input;
            } else {
                break;
            }
        }
        
        Ok((input, first))
    }
    
    // Logical AND (&&)
    fn parse_logical_and<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (mut input, mut first) = self.parse_equality(input)?;
        
        loop {
            let (new_input, _) = multispace0(input)?;
            if let Ok((new_input, _)) = tag::<_, _, VerboseError<&str>>("&&")(new_input) {
                let (new_input, _) = multispace0(new_input)?;
                let (new_input, right) = self.parse_equality(new_input)?;
                first = self.context.alloc_expr(ExprNode::Binary {
                    left: first,
                    op: BinaryOp::And,
                    right,
                    span: SourceSpan::new(0, 0),
                });
                input = new_input;
            } else {
                break;
            }
        }
        
        Ok((input, first))
    }
    
    // Equality (==, !=)
    fn parse_equality<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (mut input, mut first) = self.parse_relational(input)?;
        
        loop {
            let (new_input, _) = multispace0(input)?;
            let op = if let Ok((new_input, _)) = tag::<_, _, VerboseError<&str>>("==")(new_input) {
                Some((new_input, BinaryOp::Eq))
            } else if let Ok((new_input, _)) = tag::<_, _, VerboseError<&str>>("!=")(new_input) {
                Some((new_input, BinaryOp::Ne))
            } else {
                None
            };
            
            if let Some((new_input, op)) = op {
                let (new_input, _) = multispace0(new_input)?;
                let (new_input, right) = self.parse_relational(new_input)?;
                first = self.context.alloc_expr(ExprNode::Binary {
                    left: first,
                    op,
                    right,
                    span: SourceSpan::new(0, 0),
                });
                input = new_input;
            } else {
                break;
            }
        }
        
        Ok((input, first))
    }
    
    // Relational (<, >, <=, >=)
    fn parse_relational<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (mut input, mut first) = self.parse_additive(input)?;
        
        loop {
            let (new_input, _) = multispace0(input)?;
            let op = if let Ok((new_input, _)) = tag::<_, _, VerboseError<&str>>("<=")(new_input) {
                Some((new_input, BinaryOp::Le))
            } else if let Ok((new_input, _)) = tag::<_, _, VerboseError<&str>>(">=")(new_input) {
                Some((new_input, BinaryOp::Ge))
            } else if let Ok((new_input, _)) = tag::<_, _, VerboseError<&str>>("<")(new_input) {
                Some((new_input, BinaryOp::Lt))
            } else if let Ok((new_input, _)) = tag::<_, _, VerboseError<&str>>(">")(new_input) {
                Some((new_input, BinaryOp::Gt))
            } else {
                None
            };
            
            if let Some((new_input, op)) = op {
                let (new_input, _) = multispace0(new_input)?;
                let (new_input, right) = self.parse_additive(new_input)?;
                first = self.context.alloc_expr(ExprNode::Binary {
                    left: first,
                    op,
                    right,
                    span: SourceSpan::new(0, 0),
                });
                input = new_input;
            } else {
                break;
            }
        }
        
        Ok((input, first))
    }
    
    // Addition and subtraction
    fn parse_additive<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (mut input, mut first) = self.parse_multiplicative(input)?;
        
        loop {
            let (new_input, _) = multispace0(input)?;
            let op = if let Ok((new_input, _)) = tag::<_, _, VerboseError<&str>>("+")(new_input) {
                Some((new_input, BinaryOp::Add))
            } else if let Ok((new_input, _)) = tag::<_, _, VerboseError<&str>>("-")(new_input) {
                Some((new_input, BinaryOp::Sub))
            } else {
                None
            };
            
            if let Some((new_input, op)) = op {
                let (new_input, _) = multispace0(new_input)?;
                let (new_input, right) = self.parse_multiplicative(new_input)?;
                first = self.context.alloc_expr(ExprNode::Binary {
                    left: first,
                    op,
                    right,
                    span: SourceSpan::new(0, 0),
                });
                input = new_input;
            } else {
                break;
            }
        }
        
        Ok((input, first))
    }
    
    // Multiplication, division, modulo
    fn parse_multiplicative<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (mut input, mut first) = self.parse_unary(input)?;
        
        loop {
            let (new_input, _) = multispace0(input)?;
            let op = if let Ok((new_input, _)) = tag::<_, _, VerboseError<&str>>("*")(new_input) {
                Some((new_input, BinaryOp::Mul))
            } else if let Ok((new_input, _)) = tag::<_, _, VerboseError<&str>>("/")(new_input) {
                Some((new_input, BinaryOp::Div))
            } else if let Ok((new_input, _)) = tag::<_, _, VerboseError<&str>>("%")(new_input) {
                Some((new_input, BinaryOp::Mod))
            } else {
                None
            };
            
            if let Some((new_input, op)) = op {
                let (new_input, _) = multispace0(new_input)?;
                let (new_input, right) = self.parse_unary(new_input)?;
                first = self.context.alloc_expr(ExprNode::Binary {
                    left: first,
                    op,
                    right,
                    span: SourceSpan::new(0, 0),
                });
                input = new_input;
            } else {
                break;
            }
        }
        
        Ok((input, first))
    }
    
    // Unary operators (!, -, +)
    fn parse_unary<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        // Try parsing unary operator
        if let Ok((i, op)) = alt::<_, _, VerboseError<&str>, _>((
            value(UnaryOp::Not, tag("!")),
            value(UnaryOp::Neg, tag("-")),
            value(UnaryOp::Plus, tag("+")),
        ))(input) {
            let (i, _) = multispace0(i)?;
            let (i, operand) = self.parse_unary(i)?;
            return Ok((i, self.context.alloc_expr(ExprNode::Unary {
                op,
                operand,
                span: SourceSpan::new(0, 0),
            })));
        }
        
        self.parse_postfix(input)
    }
    
    // Postfix expressions (member access, function calls, array indexing)
    fn parse_postfix<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (mut input, mut expr) = self.parse_primary_expr(input)?;
        
        loop {
            if let Ok((new_input, new_expr)) = self.parse_member_access(input, expr) {
                input = new_input;
                expr = new_expr;
            } else if let Ok((new_input, new_expr)) = self.parse_call(input, expr) {
                input = new_input;
                expr = new_expr;
            } else if let Ok((new_input, new_expr)) = self.parse_index_access(input, expr) {
                input = new_input;
                expr = new_expr;
            } else {
                break;
            }
        }
        
        Ok((input, expr))
    }

    fn parse_member_access<'a>(&mut self, input: &'a str, object: ast::NodeId) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = char('.')(input)?;
        let (input, property) = self.parse_identifier_str(input)?;
        let property_id = self.context.intern(&property);
        
        Ok((input, self.context.alloc_expr(ExprNode::Member {
            object,
            property: property_id,
            computed: false,
            span: SourceSpan::new(0, 0),
        })))
    }

    fn parse_call<'a>(&mut self, input: &'a str, callee: ast::NodeId) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = char('(')(input)?;
        let (input, _) = multispace0(input)?;
        let (input, args) = separated_list0(
            tuple((multispace0, char(','), multispace0)),
            |i| self.parse_expression(i),
        )(input)?;
        let (input, _) = multispace0(input)?;
        let (input, _) = char(')')(input)?;
        
        let args_list = self.create_node_list(args);
        
        Ok((input, self.context.alloc_expr(ExprNode::Call {
            callee,
            args: args_list,
            span: SourceSpan::new(0, 0),
        })))
    }

    fn parse_index_access<'a>(&mut self, input: &'a str, object: ast::NodeId) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = char('[')(input)?;
        let (input, _) = multispace0(input)?;
        let (input, _index) = self.parse_expression(input)?;
        let (input, _) = multispace0(input)?;
        let (input, _) = char(']')(input)?;
        
        // For computed access, we use a placeholder
        let property_id = self.context.intern("<computed>");
        
        Ok((input, self.context.alloc_expr(ExprNode::Member {
            object,
            property: property_id,
            computed: true,
            span: SourceSpan::new(0, 0),
        })))
    }

    fn parse_primary_expr<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        // Try each parser in sequence
        if let Ok(result) = self.parse_literal_expr(input) {
            return Ok(result);
        }
        if let Ok(result) = self.parse_identifier_expr(input) {
            return Ok(result);
        }
        if let Ok(result) = self.parse_parenthesized_or_arrow(input) {
            return Ok(result);
        }
        if let Ok(result) = self.parse_array_literal(input) {
            return Ok(result);
        }
        self.parse_object_literal(input)
    }

    fn parse_literal_expr<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        if let Ok(result) = self.parse_string_literal_expr(input) {
            return Ok(result);
        }
        if let Ok(result) = self.parse_number_literal_expr(input) {
            return Ok(result);
        }
        if let Ok(result) = self.parse_boolean_literal_expr(input) {
            return Ok(result);
        }
        self.parse_regex_literal_expr(input)
    }

    fn parse_string_literal_expr<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, value) = self.parse_string_literal(input)?;
        let value_id = self.context.intern(&value);
        Ok((input, self.context.alloc_expr(ExprNode::Literal {
            value: LiteralValue::String(value_id),
            span: SourceSpan::new(0, 0),
        })))
    }

    fn parse_number_literal_expr<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, value) = self.parse_number_literal(input)?;
        Ok((input, self.context.alloc_expr(ExprNode::Literal {
            value: LiteralValue::Number(value),
            span: SourceSpan::new(0, 0),
        })))
    }

    fn parse_boolean_literal_expr<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, value) = alt((
            value(true, tag("true")),
            value(false, tag("false")),
        ))(input)?;
        Ok((input, self.context.alloc_expr(ExprNode::Literal {
            value: LiteralValue::Boolean(value),
            span: SourceSpan::new(0, 0),
        })))
    }

    fn parse_regex_literal_expr<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = char('/')(input)?;
        
        // Parse regex pattern with proper escaping
        let mut pattern = String::new();
        let mut chars = input.chars();
        let mut consumed = 0;
        
        loop {
            match chars.next() {
                Some('\\') => {
                    pattern.push('\\');
                    consumed += 1;
                    if let Some(ch) = chars.next() {
                        pattern.push(ch);
                        consumed += 1;
                    }
                }
                Some('/') => {
                    consumed += 1;
                    break;
                }
                Some(ch) => {
                    pattern.push(ch);
                    consumed += 1;
                }
                None => {
                    return Err(nom::Err::Error(VerboseError::from_error_kind(
                        input,
                        nom::error::ErrorKind::Char,
                    )));
                }
            }
        }
        
        let input = &input[consumed..];
        
        // Parse flags
        let (input, flags) = take_while(|c: char| c.is_alphabetic())(input)?;
        
        let full_pattern = format!("{}{}", pattern, flags);
        let pattern_id = self.context.intern(&full_pattern);
        
        Ok((input, self.context.alloc_expr(ExprNode::Literal {
            value: LiteralValue::Regex(pattern_id),
            span: SourceSpan::new(0, 0),
        })))
    }

    fn parse_identifier_expr<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, name) = self.parse_identifier_str(input)?;
        let name_id = self.context.intern(&name);
        Ok((input, self.context.alloc_expr(ExprNode::Identifier {
            name: name_id,
            span: SourceSpan::new(0, 0),
        })))
    }

    fn parse_parenthesized_or_arrow<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let start = input;
        let (input, _) = char('(')(start)?;
        let (input, _) = multispace0(input)?;
        
        // Check if this might be arrow function parameters
        // Try to parse as parameters first
        let mut params = Vec::new();
        let mut temp_input = input;
        
        // Try parsing as parameters
        let mut is_arrow_func = false;
        while !temp_input.starts_with(')') {
            if let Ok((new_input, param_name)) = self.parse_identifier_str(temp_input) {
                let (new_input, _) = multispace0(new_input)?;
                
                // Check for type annotation
                let (new_input, type_node) = if new_input.starts_with(':') {
                    let (new_input, _) = char(':')(new_input)?;
                    let (new_input, _) = multispace0(new_input)?;
                    let (new_input, ty) = self.parse_type(new_input)?;
                    (new_input, Some(ty))
                } else {
                    (new_input, None)
                };
                
                params.push((param_name, type_node));
                
                let (new_input, _) = multispace0(new_input)?;
                if new_input.starts_with(',') {
                    let (new_input, _) = char(',')(new_input)?;
                    let (new_input, _) = multispace0(new_input)?;
                    temp_input = new_input;
                } else {
                    temp_input = new_input;
                    break;
                }
            } else {
                // Not parameters, parse as expression
                break;
            }
        }
        
        // Check if we have ) followed by =>
        if temp_input.starts_with(')') {
            let (check_input, _) = char(')')(temp_input)?;
            let (check_input, _) = multispace0(check_input)?;
            if check_input.starts_with("=>") {
                is_arrow_func = true;
            }
        }
        
        if is_arrow_func && !params.is_empty() {
            // Parse as arrow function
            let (input, _) = char(')')(temp_input)?;
            let (input, _) = multispace0(input)?;
            let (input, _) = tag("=>")(input)?;
            let (input, _) = multispace0(input)?;
            
            // Parse the arrow function body (expression)
            let (input, body_expr) = self.parse_logical_or(input)?;
            
            // Create parameters
            let mut param_nodes = Vec::new();
            for (name, ty) in params {
                let name_id = self.context.intern(&name);
                let param = Param {
                    name: name_id,
                    type_node: ty,
                    optional: false,
                    default_value: None,
                    span: SourceSpan::new(0, 0),
                };
                param_nodes.push(self.context.alloc_param(param));
            }
            
            // Create a return statement with the expression
            let return_stmt = StmtNode::Return {
                value: Some(body_expr),
                span: SourceSpan::new(0, 0),
            };
            let stmt_id = self.context.alloc_stmt(return_stmt);
            
            // Create a block containing the return statement
            let block = StmtNode::Block {
                statements: self.create_node_list(vec![stmt_id]),
                span: SourceSpan::new(0, 0),
            };
            let body_id = self.context.alloc_stmt(block);
            
            // Create an anonymous function node
            let func_name = self.context.intern("<arrow>");
            let func_node = AstNode::FunctionDecl {
                name: func_name,
                params: self.create_node_list(param_nodes),
                return_type: None,
                body: Some(body_id),
                decorators: NodeList::empty(),
                span: SourceSpan::new(0, 0),
                doc_comment: None,
            };
            
            // Return as an expression (wrap the function)
            Ok((input, self.context.ast_nodes.alloc(func_node)))
        } else {
            // Parse as regular parenthesized expression
            let (input, _) = char('(')(start)?;
            let (input, _) = multispace0(input)?;
            let (input, expr) = self.parse_expression(input)?;
            let (input, _) = multispace0(input)?;
            let (input, _) = char(')')(input)?;
            Ok((input, expr))
        }
    }

    fn parse_array_literal<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = char('[')(input)?;
        let (input, _) = multispace0(input)?;
        let (input, elements) = separated_list0(
            tuple((multispace0, char(','), multispace0)),
            |i| self.parse_expression(i),
        )(input)?;
        let (input, _) = multispace0(input)?;
        let (input, _) = char(']')(input)?;
        
        let elements_list = self.create_node_list(elements);
        
        Ok((input, self.context.alloc_expr(ExprNode::Array {
            elements: elements_list,
            span: SourceSpan::new(0, 0),
        })))
    }

    fn parse_object_literal<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = char('{')(input)?;
        let (input, _) = multispace0(input)?;
        // Simplified object literal parsing
        let (input, _) = take_while(|c| c != '}')(input)?;
        let (input, _) = char('}')(input)?;
        
        Ok((input, self.context.alloc_expr(ExprNode::Object {
            properties: NodeList::empty(),
            span: SourceSpan::new(0, 0),
        })))
    }
    
    #[allow(dead_code)]
    fn parse_arrow_function<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        // Try to parse (params) => expr pattern
        let (input, _) = char('(')(input)?;
        let (mut input, _) = multispace0(input)?;
        
        // Parse parameter list
        let mut params = Vec::new();
        while !input.starts_with(')') {
            // Parse parameter name
            let (new_input, param_name) = self.parse_identifier_str(input)?;
            input = new_input;
            let (new_input, _) = multispace0(input)?;
            input = new_input;
            
            // Optional type annotation
            if input.starts_with(':') {
                let (new_input, _) = char(':')(input)?;
                let (new_input, _) = multispace0(new_input)?;
                let (new_input, _type) = self.parse_type(new_input)?;
                input = new_input;
            }
            
            let param = Param {
                name: self.context.intern(&param_name),
                type_node: None, // Simplified
                optional: false,
                default_value: None,
                span: SourceSpan::new(0, 0),
            };
            params.push(self.context.alloc_param(param));
            
            let (new_input, _) = multispace0(input)?;
            input = new_input;
            
            if input.starts_with(',') {
                let (new_input, _) = char(',')(input)?;
                let (new_input, _) = multispace0(new_input)?;
                input = new_input;
            } else {
                break;
            }
        }
        
        let (input, _) = char(')')(input)?;
        let (input, _) = multispace0(input)?;
        let (input, _) = tag("=>")(input)?;
        let (input, _) = multispace0(input)?;
        
        // Parse the arrow function body (expression)
        let (input, body_expr) = self.parse_expression(input)?;
        
        // Create a return statement with the expression
        let return_stmt = StmtNode::Return {
            value: Some(body_expr),
            span: SourceSpan::new(0, 0),
        };
        let stmt_id = self.context.alloc_stmt(return_stmt);
        
        // Create a block containing the return statement
        let block = StmtNode::Block {
            statements: self.create_node_list(vec![stmt_id]),
            span: SourceSpan::new(0, 0),
        };
        let body_id = self.context.alloc_stmt(block);
        
        // Create an anonymous function node
        let func_name = self.context.intern("<arrow>");
        let func_node = AstNode::FunctionDecl {
            name: func_name,
            params: self.create_node_list(params),
            return_type: None,
            body: Some(body_id),
            decorators: NodeList::empty(),
            span: SourceSpan::new(0, 0),
            doc_comment: None,
        };
        
        // Return as an expression (wrap the function)
        Ok((input, self.context.ast_nodes.alloc(func_node)))
    }
}