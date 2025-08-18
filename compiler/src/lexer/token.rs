use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub struct Token {
    pub kind: TokenKind,
    pub text: String,
    pub span: Span,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Span {
    pub start: usize,
    pub end: usize,
    pub line: usize,
    pub column: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TokenKind {
    // Decorators
    At,                      // @
    
    // Keywords
    Interface,
    Type,
    Extends,
    Implements,
    Readonly,
    Export,
    Import,
    From,
    Function,
    Default,
    As,
    Return,
    If,
    Else,
    For,
    While,
    Const,
    Let,
    Var,
    
    // Identifiers and Literals
    Identifier(String),
    StringLiteral(String),
    NumberLiteral(f64),
    BooleanLiteral(bool),
    RegexLiteral(String),
    
    // Types
    StringType,              // string
    NumberType,              // number
    BooleanType,             // boolean
    VoidType,                // void
    NullType,                // null
    UndefinedType,           // undefined
    AnyType,                 // any
    UnknownType,             // unknown
    NeverType,               // never
    
    // Symbols
    LeftBrace,               // {
    RightBrace,              // }
    LeftBracket,             // [
    RightBracket,            // ]
    LeftParen,               // (
    RightParen,              // )
    
    // Punctuation
    Semicolon,               // ;
    Comma,                   // ,
    Colon,                   // :
    Dot,                     // .
    Question,                // ?
    
    // Operators
    Pipe,                    // |
    Ampersand,               // &
    Equals,                  // =
    Arrow,                   // =>
    LessThan,                // <
    GreaterThan,             // >
    Minus,                   // -
    Plus,                    // +
    Multiply,                // *
    Slash,                   // /
    Exclamation,             // !
    
    // Special
    Newline,
    Whitespace,
    Comment(String),
    Eof,
}

impl fmt::Display for TokenKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TokenKind::At => write!(f, "@"),
            TokenKind::Interface => write!(f, "interface"),
            TokenKind::Type => write!(f, "type"),
            TokenKind::Function => write!(f, "function"),
            TokenKind::Export => write!(f, "export"),
            TokenKind::Import => write!(f, "import"),
            TokenKind::From => write!(f, "from"),
            TokenKind::Default => write!(f, "default"),
            TokenKind::As => write!(f, "as"),
            TokenKind::Identifier(s) => write!(f, "{}", s),
            TokenKind::StringLiteral(s) => write!(f, "\"{}\"", s),
            TokenKind::NumberLiteral(n) => write!(f, "{}", n),
            _ => write!(f, "{:?}", self),
        }
    }
}