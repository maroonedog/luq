use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub struct Token {
    pub kind: TokenKind,
    pub text: String,
    pub span: Span,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

impl Span {
    pub fn new(start: usize, end: usize) -> Self {
        Self { start, end }
    }
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
    True,
    False,
    Null,
    Undefined,
    New,
    Class,
    Static,
    Async,
    Await,
    Promise,
    
    // Identifiers and Literals
    Identifier(String),
    StringLiteral(String),
    NumberLiteral(f64),
    RegexLiteral(String),
    
    // Types
    StringType,              // string
    NumberType,              // number
    BooleanType,             // boolean
    VoidType,                // void
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
    Ellipsis,                // ...
    
    // Operators
    Pipe,                    // |
    Ampersand,               // &
    Equals,                  // =
    Arrow,                   // =>
    LessThan,                // <
    GreaterThan,             // >
    Minus,                   // -
    Plus,                    // +
    Star,                    // *
    Slash,                   // /
    Caret,                   // ^
    Exclamation,             // !
    Percent,                 // %
    Tilde,                   // ~
    
    // Compound operators
    OrOr,                    // ||
    AndAnd,                  // &&
    EqualsEquals,            // ==
    BangEquals,              // !=
    LessThanEquals,          // <=
    GreaterThanEquals,       // >=
    EqualsEqualsEquals,      // ===
    BangEqualsEquals,        // !==
    PlusEquals,              // +=
    MinusEquals,             // -=
    StarEquals,              // *=
    SlashEquals,             // /=
    PlusPlus,                // ++
    MinusMinus,              // --
    
    // Comments
    SingleLineComment(String),  // //
    DocComment(String),         // ///
    MultiLineComment(String),   // /* */
    
    // Special
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
            TokenKind::Extends => write!(f, "extends"),
            TokenKind::Implements => write!(f, "implements"),
            TokenKind::Readonly => write!(f, "readonly"),
            TokenKind::Return => write!(f, "return"),
            TokenKind::If => write!(f, "if"),
            TokenKind::Else => write!(f, "else"),
            TokenKind::For => write!(f, "for"),
            TokenKind::While => write!(f, "while"),
            TokenKind::Const => write!(f, "const"),
            TokenKind::Let => write!(f, "let"),
            TokenKind::Var => write!(f, "var"),
            TokenKind::True => write!(f, "true"),
            TokenKind::False => write!(f, "false"),
            TokenKind::Null => write!(f, "null"),
            TokenKind::Undefined => write!(f, "undefined"),
            TokenKind::New => write!(f, "new"),
            TokenKind::Class => write!(f, "class"),
            TokenKind::Static => write!(f, "static"),
            TokenKind::Async => write!(f, "async"),
            TokenKind::Await => write!(f, "await"),
            TokenKind::Promise => write!(f, "Promise"),
            TokenKind::Identifier(s) => write!(f, "{}", s),
            TokenKind::StringLiteral(s) => write!(f, "\"{}\"", s),
            TokenKind::NumberLiteral(n) => write!(f, "{}", n),
            TokenKind::RegexLiteral(s) => write!(f, "/{}/", s),
            TokenKind::StringType => write!(f, "string"),
            TokenKind::NumberType => write!(f, "number"),
            TokenKind::BooleanType => write!(f, "boolean"),
            TokenKind::VoidType => write!(f, "void"),
            TokenKind::AnyType => write!(f, "any"),
            TokenKind::UnknownType => write!(f, "unknown"),
            TokenKind::NeverType => write!(f, "never"),
            TokenKind::LeftBrace => write!(f, "{{"),
            TokenKind::RightBrace => write!(f, "}}"),
            TokenKind::LeftBracket => write!(f, "["),
            TokenKind::RightBracket => write!(f, "]"),
            TokenKind::LeftParen => write!(f, "("),
            TokenKind::RightParen => write!(f, ")"),
            TokenKind::Semicolon => write!(f, ";"),
            TokenKind::Comma => write!(f, ","),
            TokenKind::Colon => write!(f, ":"),
            TokenKind::Dot => write!(f, "."),
            TokenKind::Question => write!(f, "?"),
            TokenKind::Ellipsis => write!(f, "..."),
            TokenKind::Pipe => write!(f, "|"),
            TokenKind::Ampersand => write!(f, "&"),
            TokenKind::Equals => write!(f, "="),
            TokenKind::Arrow => write!(f, "=>"),
            TokenKind::LessThan => write!(f, "<"),
            TokenKind::GreaterThan => write!(f, ">"),
            TokenKind::Minus => write!(f, "-"),
            TokenKind::Plus => write!(f, "+"),
            TokenKind::Star => write!(f, "*"),
            TokenKind::Slash => write!(f, "/"),
            TokenKind::Caret => write!(f, "^"),
            TokenKind::Exclamation => write!(f, "!"),
            TokenKind::Percent => write!(f, "%"),
            TokenKind::Tilde => write!(f, "~"),
            TokenKind::OrOr => write!(f, "||"),
            TokenKind::AndAnd => write!(f, "&&"),
            TokenKind::EqualsEquals => write!(f, "=="),
            TokenKind::BangEquals => write!(f, "!="),
            TokenKind::LessThanEquals => write!(f, "<="),
            TokenKind::GreaterThanEquals => write!(f, ">="),
            TokenKind::EqualsEqualsEquals => write!(f, "==="),
            TokenKind::BangEqualsEquals => write!(f, "!=="),
            TokenKind::PlusEquals => write!(f, "+="),
            TokenKind::MinusEquals => write!(f, "-="),
            TokenKind::StarEquals => write!(f, "*="),
            TokenKind::SlashEquals => write!(f, "/="),
            TokenKind::PlusPlus => write!(f, "++"),
            TokenKind::MinusMinus => write!(f, "--"),
            TokenKind::SingleLineComment(s) => write!(f, "//{}", s),
            TokenKind::DocComment(s) => write!(f, "///{}", s),
            TokenKind::MultiLineComment(s) => write!(f, "/*{}*/", s),
            TokenKind::Eof => write!(f, "EOF"),
        }
    }
}