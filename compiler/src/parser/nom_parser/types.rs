use nom::{
    branch::alt,
    bytes::complete::tag,
    character::complete::{char, multispace0},
    combinator::value,
    multi::separated_list1,
    sequence::tuple,
};
use crate::ast::{self, nodes::*, SourceSpan};
use super::{Parser, ParseResult};

impl Parser {
    pub(crate) fn parse_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        // Try union type first
        if let Ok(result) = self.parse_union_type(input) {
            return Ok(result);
        }
        
        // Otherwise parse primary type with possible array suffix
        self.parse_type_with_suffix(input)
    }

    fn parse_union_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, first) = self.parse_type_with_suffix(input)?;
        let (input, _) = multispace0(input)?;
        let (input, _) = char('|')(input)?;
        let (input, _) = multispace0(input)?;
        let (input, rest) = separated_list1(
            tuple((multispace0, char('|'), multispace0)),
            |i| self.parse_type_with_suffix(i),
        )(input)?;

        let mut variants = vec![first];
        variants.extend(rest);
        
        let type_node = TypeNode::Union {
            variants: self.create_node_list(variants),
            span: SourceSpan::new(0, 0),
        };
        
        Ok((input, self.context.alloc_type(type_node)))
    }

    fn parse_type_with_suffix<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        // Parse the base type
        let (input, base_type) = self.parse_primary_type(input)?;
        
        // Check for array suffix
        if input.starts_with('[') {
            let (input, _) = char('[')(input)?;
            let (input, _) = char(']')(input)?;
            
            let type_node = TypeNode::Array {
                elem: base_type,
                constraints: ConstraintList::empty(),
                span: SourceSpan::new(0, 0),
            };
            Ok((input, self.context.alloc_type(type_node)))
        } else {
            Ok((input, base_type))
        }
    }
    
    fn parse_primary_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        // Try each type parser in sequence (removed array_type)
        if let Ok(result) = self.parse_string_type(input) {
            return Ok(result);
        }
        if let Ok(result) = self.parse_number_type(input) {
            return Ok(result);
        }
        if let Ok(result) = self.parse_boolean_type(input) {
            return Ok(result);
        }
        if let Ok(result) = self.parse_void_type(input) {
            return Ok(result);
        }
        if let Ok(result) = self.parse_any_type(input) {
            return Ok(result);
        }
        if let Ok(result) = self.parse_literal_type(input) {
            return Ok(result);
        }
        // Identifier type as fallback
        self.parse_identifier_type(input)
    }

    fn parse_string_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = tag("string")(input)?;
        let type_node = TypeNode::String {
            constraints: ConstraintList::empty(),
            span: SourceSpan::new(0, 0),
        };
        Ok((input, self.context.alloc_type(type_node)))
    }

    fn parse_number_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = tag("number")(input)?;
        let type_node = TypeNode::Number {
            constraints: ConstraintList::empty(),
            span: SourceSpan::new(0, 0),
        };
        Ok((input, self.context.alloc_type(type_node)))
    }

    fn parse_boolean_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = tag("boolean")(input)?;
        let type_node = TypeNode::Boolean {
            span: SourceSpan::new(0, 0),
        };
        Ok((input, self.context.alloc_type(type_node)))
    }
    
    fn parse_void_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = tag("void")(input)?;
        // Use Ref to 'void' for now
        let void_id = self.context.intern("void");
        let type_node = TypeNode::Ref {
            target: void_id,
            type_args: NodeList::empty(),
            span: SourceSpan::new(0, 0),
        };
        Ok((input, self.context.alloc_type(type_node)))
    }
    
    fn parse_any_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, _) = tag("any")(input)?;
        // Use Ref to 'any' for now
        let any_id = self.context.intern("any");
        let type_node = TypeNode::Ref {
            target: any_id,
            type_args: NodeList::empty(),
            span: SourceSpan::new(0, 0),
        };
        Ok((input, self.context.alloc_type(type_node)))
    }

    // This function is no longer used - array types are handled by parse_type_with_suffix
    #[allow(dead_code)]
    fn parse_array_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, elem_type) = self.parse_primary_type(input)?;
        let (input, _) = char('[')(input)?;
        let (input, _) = char(']')(input)?;
        
        let type_node = TypeNode::Array {
            elem: elem_type,
            constraints: ConstraintList::empty(),
            span: SourceSpan::new(0, 0),
        };
        Ok((input, self.context.alloc_type(type_node)))
    }

    fn parse_identifier_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let start_input = input;
        let (input, name) = self.parse_identifier_str(input)?;
        let end_input = input;
        
        let name_id = self.context.intern(&name);
        let span = self.get_span(start_input, end_input);
        let type_node = TypeNode::Ref {
            target: name_id,
            type_args: NodeList::empty(),
            span,
        };
        Ok((input, self.context.alloc_type(type_node)))
    }

    fn parse_literal_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        if let Ok(result) = self.parse_string_literal_type(input) {
            return Ok(result);
        }
        if let Ok(result) = self.parse_number_literal_type(input) {
            return Ok(result);
        }
        self.parse_boolean_literal_type(input)
    }

    fn parse_string_literal_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, value) = self.parse_string_literal(input)?;
        let value_id = self.context.intern(&value);
        let type_node = TypeNode::Literal {
            value: LiteralValue::String(value_id),
            span: SourceSpan::new(0, 0),
        };
        Ok((input, self.context.alloc_type(type_node)))
    }

    fn parse_number_literal_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, value) = self.parse_number_literal(input)?;
        let type_node = TypeNode::Literal {
            value: LiteralValue::Number(value),
            span: SourceSpan::new(0, 0),
        };
        Ok((input, self.context.alloc_type(type_node)))
    }

    fn parse_boolean_literal_type<'a>(&mut self, input: &'a str) -> ParseResult<'a, ast::NodeId> {
        let (input, value) = alt((
            value(true, tag("true")),
            value(false, tag("false")),
        ))(input)?;
        let type_node = TypeNode::Literal {
            value: LiteralValue::Boolean(value),
            span: SourceSpan::new(0, 0),
        };
        Ok((input, self.context.alloc_type(type_node)))
    }
}