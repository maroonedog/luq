use nom::{
    branch::alt,
    bytes::complete::{tag, take_while},
    character::complete::{char, alpha1, digit1, multispace0},
    combinator::{recognize, opt},
    sequence::tuple,
    error::{VerboseError, ParseError},
};
use crate::ast;
use super::{Parser, ParseResult};

impl Parser {
    pub(crate) fn parse_identifier_str<'a>(&self, input: &'a str) -> ParseResult<'a, String> {
        let (input, first) = alt((alpha1, tag("_")))(input)?;
        let (input, rest) = take_while(|c: char| c.is_alphanumeric() || c == '_')(input)?;
        Ok((input, format!("{}{}", first, rest)))
    }

    pub(crate) fn parse_string_literal<'a>(&self, input: &'a str) -> ParseResult<'a, String> {
        // Try double-quoted string
        if let Ok((input, _)) = char::<_, VerboseError<&str>>('"')(input) {
            let mut result = String::new();
            let mut chars = input.chars();
            let mut consumed = 0;
            
            loop {
                match chars.next() {
                    Some('\\') => {
                        consumed += 1;
                        if let Some(ch) = chars.next() {
                            consumed += 1;
                            result.push(match ch {
                                'n' => '\n',
                                't' => '\t',
                                'r' => '\r',
                                '\\' => '\\',
                                '"' => '"',
                                _ => ch,
                            });
                        }
                    }
                    Some('"') => {
                        consumed += 1;
                        return Ok((&input[consumed..], result));
                    }
                    Some(ch) => {
                        result.push(ch);
                        consumed += 1;
                    }
                    None => break,
                }
            }
        }
        
        // Try single-quoted string
        if let Ok((input, _)) = char::<_, VerboseError<&str>>('\'')(input) {
            let mut result = String::new();
            let mut chars = input.chars();
            let mut consumed = 0;
            
            loop {
                match chars.next() {
                    Some('\\') => {
                        consumed += 1;
                        if let Some(ch) = chars.next() {
                            consumed += 1;
                            result.push(match ch {
                                'n' => '\n',
                                't' => '\t',
                                'r' => '\r',
                                '\\' => '\\',
                                '\'' => '\'',
                                _ => ch,
                            });
                        }
                    }
                    Some('\'') => {
                        consumed += 1;
                        return Ok((&input[consumed..], result));
                    }
                    Some(ch) => {
                        result.push(ch);
                        consumed += 1;
                    }
                    None => break,
                }
            }
        }
        
        Err(nom::Err::Error(VerboseError::from_error_kind(
            input,
            nom::error::ErrorKind::Char,
        )))
    }

    pub(crate) fn parse_number_literal<'a>(&self, input: &'a str) -> ParseResult<'a, f64> {
        let (input, num_str) = recognize(tuple((
            opt(char('-')),
            digit1,
            opt(tuple((char('.'), digit1))),
        )))(input)?;
        
        match num_str.parse::<f64>() {
            Ok(n) => Ok((input, n)),
            Err(_) => Err(nom::Err::Error(VerboseError::from_error_kind(
                input,
                nom::error::ErrorKind::Float,
            ))),
        }
    }

    pub(crate) fn parse_jsdoc_comment<'a>(&mut self, input: &'a str) -> ParseResult<'a, Option<ast::StringId>> {
        // Try JSDoc comment (/** ... */)
        if let Ok((input, _)) = tag::<_, _, VerboseError<&str>>("/**")(input) {
            // Find the end of the comment
            if let Some(end_pos) = input.find("*/") {
                let comment_content = &input[..end_pos];
                let cleaned_comment = comment_content
                    .lines()
                    .map(|line| line.trim_start().trim_start_matches('*').trim())
                    .filter(|line| !line.is_empty())
                    .collect::<Vec<_>>()
                    .join(" ");
                
                if !cleaned_comment.is_empty() {
                    let string_id = self.context.intern(&cleaned_comment);
                    return Ok((&input[end_pos + 2..], Some(string_id)));
                }
                return Ok((&input[end_pos + 2..], None));
            }
        }
        Ok((input, None))
    }

    pub(crate) fn parse_comment<'a>(&self, input: &'a str) -> ParseResult<'a, ()> {
        // Try line comment first
        if let Ok((input, _)) = tag::<_, _, VerboseError<&str>>("//")(input) {
            let (input, _) = take_while(|c| c != '\n')(input)?;
            return Ok((input, ()));
        }
        
        // Try block comment
        if let Ok((input, _)) = tag::<_, _, VerboseError<&str>>("/*")(input) {
            let mut depth = 1;
            let mut chars = input.chars();
            let mut consumed = 0;
            
            while depth > 0 {
                match (chars.next(), chars.next()) {
                    (Some('*'), Some('/')) => {
                        depth -= 1;
                        consumed += 2;
                    }
                    (Some('/'), Some('*')) => {
                        depth += 1;
                        consumed += 2;
                    }
                    (Some(_), Some(_)) => {
                        consumed += 2;
                    }
                    (Some(_), None) => {
                        consumed += 1;
                        break;
                    }
                    _ => break,
                }
            }
            
            if depth == 0 {
                return Ok((&input[consumed..], ()));
            }
        }
        
        Err(nom::Err::Error(VerboseError::from_error_kind(
            input,
            nom::error::ErrorKind::Tag,
        )))
    }

    pub(crate) fn parse_field_separator<'a>(&self, input: &'a str) -> ParseResult<'a, ()> {
        let (input, _) = multispace0(input)?;
        let (input, _) = opt(alt((char(','), char(';'))))(input)?;
        let (input, _) = multispace0(input)?;
        Ok((input, ()))
    }
}