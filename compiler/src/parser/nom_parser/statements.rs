use nom::{
    bytes::complete::tag,
    character::complete::{char, multispace0, multispace1},
    combinator::opt,
    multi::many0,
};
use crate::ast::{self, nodes::*, SourceSpan};
use super::{Parser, ParseResult};

impl Parser {
    pub(crate) fn parse_block<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = char('{')(input)?;
        let (input, _) = multispace0(input)?;
        let (input, statements) = self.parse_statements(input)?;
        let (input, _) = multispace0(input)?;
        let (input, _) = char('}')(input)?;

        let stmt_ids = self.create_node_list(statements);
        let block = StmtNode::Block {
            statements: stmt_ids,
            span: SourceSpan::new(0, 0),
        };

        Ok((input, self.context.alloc_stmt(block)))
    }

    fn parse_statements<'a>(&mut self, input: &'a str) -> ParseResult<'a, Vec<ast::NodeId>> {
        let mut input = input;
        let mut statements = Vec::new();
        
        loop {
            let (new_input, _) = multispace0(input)?;
            input = new_input;
            
            if input.is_empty() || input.starts_with('}') {
                break;
            }
            
            if let Ok((new_input, stmt)) = self.parse_statement(input) {
                statements.push(stmt);
                input = new_input;
            } else {
                break;
            }
        }
        
        Ok((input, statements))
    }

    fn parse_statement<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = multispace0(input)?;
        
        // Try return statement first
        if let Ok((input, stmt)) = self.parse_return_statement(input) {
            let (input, _) = opt(char(';'))(input)?;
            let (input, _) = multispace0(input)?;
            return Ok((input, self.context.alloc_stmt(stmt)));
        }
        
        // Otherwise try expression statement
        let (input, stmt) = self.parse_expression_statement(input)?;
        let (input, _) = opt(char(';'))(input)?;
        let (input, _) = multispace0(input)?;
        
        Ok((input, self.context.alloc_stmt(stmt)))
    }

    fn parse_return_statement<'a>(&mut self, input: &'a str) -> ParseResult<'a, StmtNode> {
        let (input, _) = tag("return")(input)?;
        let (input, _) = multispace1(input)?;
        let (input, value) = self.parse_expression(input)?;
        
        Ok((input, StmtNode::Return {
            value: Some(value),
            span: SourceSpan::new(0, 0),
        }))
    }

    fn parse_expression_statement<'a>(&mut self, input: &'a str) -> ParseResult<'a, StmtNode> {
        let (input, expr) = self.parse_expression(input)?;
        
        Ok((input, StmtNode::Expression {
            expr,
            span: SourceSpan::new(0, 0),
        }))
    }
}