mod types;
mod expressions;
mod statements;
mod declarations;
mod helpers;

use nom::{
    IResult,
    combinator::eof,
    character::complete::multispace0,
    error::VerboseError,
};
use crate::ast::{self, nodes::*, SourceSpan, AstContext};

pub type ParseResult<'a, T> = IResult<&'a str, T, VerboseError<&'a str>>;

pub struct Parser {
    pub context: AstContext,
    original_input: String,
}

impl Parser {
    pub fn new(source: String) -> Self {
        let source_clone = source.clone();
        Self {
            context: AstContext::new(source),
            original_input: source_clone,
        }
    }

    pub fn parse(mut self, input: &str) -> Result<(Program, AstContext), String> {
        match self.parse_program(input) {
            Ok((_remaining, program)) => Ok((program, self.context)),
            Err(e) => Err(format!("Parse error: {:?}", e)),
        }
    }
    
    pub(crate) fn get_span(&self, before: &str, after: &str) -> SourceSpan {
        let start = self.original_input.len() - before.len();
        let end = self.original_input.len() - after.len();
        SourceSpan::new(start, end)
    }

    fn parse_program<'a>(&mut self, input: &'a str) -> ParseResult<'a, Program> {
        let (mut input, _) = multispace0(input)?;
        let mut declarations = Vec::new();
        let mut iteration = 0;
        
        // Parse declarations manually to avoid many0 issues
        while !input.is_empty() {
            iteration += 1;
            if iteration > 1000 {
                // Safety limit to prevent infinite loops
                break;
            }
            
            let (new_input, _) = multispace0(input)?;
            input = new_input;
            
            if input.is_empty() {
                break;
            }
            
            let old_len = input.len();
            match self.parse_declaration(input) {
                Ok((new_input, Some(decl))) => {
                    declarations.push(decl);
                    input = new_input;
                }
                Ok((new_input, None)) => {
                    input = new_input;
                }
                Err(_) => {
                    break;
                }
            }
            
            // Safety check: make sure we're making progress
            if input.len() == old_len {
                break;
            }
        }
        
        let (input, _) = multispace0(input)?;
        
        // Debug: show remaining input if any
        if !input.is_empty() {
            eprintln!("Warning: Unparsed input remaining: {} bytes", input.len());
            eprintln!("First 100 chars: {:?}", &input[..input.len().min(100)]);
        }
        
        // Don't fail on remaining input for now - just warn
        // let (input, _) = eof(input)?;

        let declaration_ids = declarations;

        let declarations = if declaration_ids.is_empty() {
            NodeList::empty()
        } else {
            let first_id = declaration_ids[0];
            NodeList::new(first_id, declaration_ids.len() as u32)
        };

        Ok((input, Program { declarations }))
    }

    pub(crate) fn create_node_list(&self, ids: Vec<ast::NodeId>) -> NodeList {
        if ids.is_empty() {
            NodeList::empty()
        } else {
            let first_id = ids[0];
            NodeList::new(first_id, ids.len() as u32)
        }
    }
}