use super::token::{Span, Token, TokenKind};
use anyhow::{bail, Result};

pub struct Lexer {
    input: Vec<char>,
    current: usize,
    line: usize,
    column: usize,
}

impl Lexer {
    pub fn new(input: &str) -> Self {
        Self {
            input: input.chars().collect(),
            current: 0,
            line: 1,
            column: 1,
        }
    }

    pub async fn tokenize(&mut self) -> Result<Vec<Token>> {
        let mut tokens = Vec::new();

        while !self.is_at_end() {
            let start = self.current;
            let start_line = self.line;
            let start_column = self.column;

            // Make the tokenization async-friendly by yielding control periodically
            if tokens.len() % 100 == 0 {
                tokio::task::yield_now().await;
            }

            let token = self.next_token()?;

            // Include all tokens including comments, but skip whitespace and newlines
            if !matches!(token, TokenKind::Whitespace | TokenKind::Newline) {
                tokens.push(Token {
                    kind: token,
                    text: self.input[start..self.current].iter().collect(),
                    span: Span {
                        start,
                        end: self.current,
                        line: start_line,
                        column: start_column,
                    },
                });
            }
        }

        tokens.push(Token {
            kind: TokenKind::Eof,
            text: String::new(),
            span: Span {
                start: self.current,
                end: self.current,
                line: self.line,
                column: self.column,
            },
        });

        Ok(tokens)
    }

    fn next_token(&mut self) -> Result<TokenKind> {
        let ch = self.advance();

        match ch {
            '@' => Ok(TokenKind::At),
            '{' => Ok(TokenKind::LeftBrace),
            '}' => Ok(TokenKind::RightBrace),
            '[' => Ok(TokenKind::LeftBracket),
            ']' => Ok(TokenKind::RightBracket),
            '(' => Ok(TokenKind::LeftParen),
            ')' => Ok(TokenKind::RightParen),
            ';' => Ok(TokenKind::Semicolon),
            ',' => Ok(TokenKind::Comma),
            ':' => Ok(TokenKind::Colon),
            '.' => Ok(TokenKind::Dot),
            '?' => Ok(TokenKind::Question),
            '|' => Ok(TokenKind::Pipe),
            '&' => Ok(TokenKind::Ampersand),
            '*' => {
                // Check if this is a block comment start
                if self.peek() == Some('/') {
                    // This is end of block comment, but we shouldn't be here
                    Ok(TokenKind::Multiply)
                } else {
                    Ok(TokenKind::Multiply)
                }
            }
            '=' => {
                if self.peek() == Some('>') {
                    self.advance();
                    Ok(TokenKind::Arrow)
                } else {
                    Ok(TokenKind::Equals)
                }
            }
            '"' => self.read_string('"'),
            '\'' => self.read_string('\''),
            '<' => Ok(TokenKind::LessThan),
            '>' => Ok(TokenKind::GreaterThan),
            '-' => {
                // Check if this is a negative number
                if let Some(ch) = self.peek() {
                    if ch.is_numeric() {
                        self.read_number()
                    } else {
                        Ok(TokenKind::Minus)
                    }
                } else {
                    Ok(TokenKind::Minus)
                }
            }
            '/' => {
                if self.peek() == Some('/') {
                    self.read_line_comment()
                } else if self.peek() == Some('*') {
                    self.read_block_comment()
                } else if self.peek() == Some('=') || self.peek() == Some('\\') {
                    // Likely a regex
                    self.read_regex()
                } else {
                    // Division operator
                    Ok(TokenKind::Slash)
                }
            }
            '+' => Ok(TokenKind::Plus),
            '!' => Ok(TokenKind::Exclamation),
            '\n' => {
                self.line += 1;
                self.column = 1;
                Ok(TokenKind::Newline)
            }
            ' ' | '\t' | '\r' => {
                while let Some(ch) = self.peek() {
                    if ch == ' ' || ch == '\t' || ch == '\r' {
                        self.advance();
                    } else {
                        break;
                    }
                }
                Ok(TokenKind::Whitespace)
            }
            _ if ch.is_alphabetic() || ch == '_' => self.read_identifier_or_keyword(),
            _ if ch.is_numeric() => self.read_number(),
            _ => bail!("Unexpected character: {}", ch),
        }
    }

    fn read_identifier_or_keyword(&mut self) -> Result<TokenKind> {
        let start = self.current - 1;
        
        while let Some(ch) = self.peek() {
            if ch.is_alphanumeric() || ch == '_' {
                self.advance();
            } else {
                break;
            }
        }

        let text: String = self.input[start..self.current].iter().collect();

        Ok(match text.as_str() {
            "interface" => TokenKind::Interface,
            "type" => TokenKind::Type,
            "extends" => TokenKind::Extends,
            "implements" => TokenKind::Implements,
            "readonly" => TokenKind::Readonly,
            "export" => TokenKind::Export,
            "import" => TokenKind::Import,
            "from" => TokenKind::From,
            "function" => TokenKind::Function,
            "default" => TokenKind::Default,
            "as" => TokenKind::As,
            "return" => TokenKind::Return,
            "if" => TokenKind::If,
            "else" => TokenKind::Else,
            "for" => TokenKind::For,
            "while" => TokenKind::While,
            "const" => TokenKind::Const,
            "let" => TokenKind::Let,
            "var" => TokenKind::Var,
            "string" => TokenKind::StringType,
            "number" => TokenKind::NumberType,
            "boolean" => TokenKind::BooleanType,
            "void" => TokenKind::VoidType,
            "null" => TokenKind::NullType,
            "undefined" => TokenKind::UndefinedType,
            "any" => TokenKind::AnyType,
            "unknown" => TokenKind::UnknownType,
            "never" => TokenKind::NeverType,
            "true" => TokenKind::BooleanLiteral(true),
            "false" => TokenKind::BooleanLiteral(false),
            _ => TokenKind::Identifier(text),
        })
    }

    fn read_string(&mut self, quote_char: char) -> Result<TokenKind> {
        let mut value = String::new();

        while let Some(ch) = self.peek() {
            if ch == quote_char {
                self.advance();
                return Ok(TokenKind::StringLiteral(value));
            } else if ch == '\\' {
                self.advance();
                if let Some(escaped) = self.peek() {
                    self.advance();
                    value.push(match escaped {
                        'n' => '\n',
                        't' => '\t',
                        'r' => '\r',
                        '\\' => '\\',
                        '"' => '"',
                        '\'' => '\'',
                        _ => escaped,
                    });
                }
            } else {
                value.push(ch);
                self.advance();
            }
        }

        bail!("Unterminated string literal")
    }

    fn read_number(&mut self) -> Result<TokenKind> {
        let start = self.current - 1;

        while let Some(ch) = self.peek() {
            if ch.is_numeric() || ch == '.' {
                self.advance();
            } else {
                break;
            }
        }

        let text: String = self.input[start..self.current].iter().collect();
        let value = text.parse::<f64>()?;
        Ok(TokenKind::NumberLiteral(value))
    }

    fn read_regex(&mut self) -> Result<TokenKind> {
        let mut pattern = String::new();

        while let Some(ch) = self.peek() {
            if ch == '/' {
                self.advance();
                // Read flags
                while let Some(flag) = self.peek() {
                    if flag.is_alphabetic() {
                        pattern.push(flag);
                        self.advance();
                    } else {
                        break;
                    }
                }
                return Ok(TokenKind::RegexLiteral(pattern));
            } else if ch == '\\' {
                pattern.push(ch);
                self.advance();
                if let Some(escaped) = self.peek() {
                    pattern.push(escaped);
                    self.advance();
                }
            } else {
                pattern.push(ch);
                self.advance();
            }
        }

        bail!("Unterminated regex literal")
    }

    fn read_line_comment(&mut self) -> Result<TokenKind> {
        self.advance(); // consume second /
        let mut comment = String::new();

        while let Some(ch) = self.peek() {
            if ch == '\n' {
                break;
            }
            comment.push(ch);
            self.advance();
        }

        Ok(TokenKind::Comment(comment))
    }

    fn read_block_comment(&mut self) -> Result<TokenKind> {
        self.advance(); // consume *
        let mut comment = String::new();

        while let Some(ch) = self.peek() {
            if ch == '*' {
                self.advance();
                if self.peek() == Some('/') {
                    self.advance();
                    return Ok(TokenKind::Comment(comment));
                }
                comment.push('*');
            } else {
                if ch == '\n' {
                    self.line += 1;
                    self.column = 0;
                }
                comment.push(ch);
                self.advance();
            }
        }

        bail!("Unterminated block comment")
    }

    fn advance(&mut self) -> char {
        let ch = self.input[self.current];
        self.current += 1;
        self.column += 1;
        ch
    }

    fn peek(&self) -> Option<char> {
        if self.is_at_end() {
            None
        } else {
            Some(self.input[self.current])
        }
    }

    fn is_at_end(&self) -> bool {
        self.current >= self.input.len()
    }
}