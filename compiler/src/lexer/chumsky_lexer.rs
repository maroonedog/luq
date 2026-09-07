use chumsky::prelude::*;
use super::token::{Token, TokenKind, Span};

pub fn tokenize(src: &str) -> Result<Vec<Token>, Vec<Simple<char>>> {
    let lexer = lexer();
    match lexer.parse(src) {
        Ok(mut tokens) => {
            // Fill in the text field for each token
            for token in &mut tokens {
                if token.span.start < src.len() && token.span.end <= src.len() {
                    token.text = src[token.span.start..token.span.end].to_string();
                }
            }
            Ok(tokens)
        }
        Err(e) => Err(e)
    }
}

fn lexer() -> impl Parser<char, Vec<Token>, Error = Simple<char>> {
    let whitespace = filter(|c: &char| c.is_whitespace() && *c != '\n' && *c != '\r')
        .repeated()
        .at_least(1)
        .ignored();

    let newline = just('\n').or(just('\r').then_ignore(just('\n'))).ignored();

    // Doc comment (///)
    let doc_comment = just("///")
        .then(filter(|c| *c != '\n' && *c != '\r').repeated())
        .map(|(_, chars)| {
            let text: String = chars.into_iter().collect();
            TokenKind::DocComment(text)
        });

    // Single line comment (//)
    let single_line_comment = just("//")
        .then(none_of("\n\r").repeated())
        .map(|(_, chars)| {
            let text: String = chars.into_iter().collect();
            TokenKind::SingleLineComment(text)
        });

    // Multi-line comment (/* */)
    let multi_line_comment = just("/*")
        .then(take_until(just("*/")))
        .map(|(_, (chars, _))| {
            let text: String = chars.into_iter().collect();
            TokenKind::MultiLineComment(text)
        });

    // Comments
    let comment = doc_comment.or(single_line_comment).or(multi_line_comment);

    // String literals
    let escape = just('\\').ignore_then(
        just('\\')
            .or(just('/'))
            .or(just('"'))
            .or(just('\''))
            .or(just('n').to('\n'))
            .or(just('r').to('\r'))
            .or(just('t').to('\t'))
            .or(just('b').to('\u{0008}'))
            .or(just('f').to('\u{000C}'))
            .or(just('v').to('\u{000B}'))
            .or(just('0').to('\0'))
    );

    let string_double = just('"')
        .ignore_then(
            escape
                .or(filter(|c| *c != '"' && *c != '\\'))
                .repeated()
        )
        .then_ignore(just('"'))
        .map(|chars| TokenKind::StringLiteral(chars.into_iter().collect()));

    let string_single = just('\'')
        .ignore_then(
            escape
                .or(filter(|c| *c != '\'' && *c != '\\'))
                .repeated()
        )
        .then_ignore(just('\''))
        .map(|chars| TokenKind::StringLiteral(chars.into_iter().collect()));

    let string_literal = string_double.or(string_single);

    // Number literals
    let digits = text::digits(10);
    
    let number = just('-')
        .or_not()
        .then(digits.clone())
        .then(just('.').then(digits.clone()).or_not())
        .then(
            just('e')
                .or(just('E'))
                .then(just('+').or(just('-')).or_not())
                .then(digits)
                .or_not()
        )
        .map(|(((sign, int_part), frac_part), exp_part)| {
            let mut num_str = String::new();
            if sign.is_some() {
                num_str.push('-');
            }
            num_str.push_str(&int_part);
            if let Some((_, frac)) = frac_part {
                num_str.push('.');
                num_str.push_str(&frac);
            }
            if let Some(((e, sign), exp)) = exp_part {
                num_str.push(e);
                if let Some(s) = sign {
                    num_str.push(s);
                }
                num_str.push_str(&exp);
            }
            TokenKind::NumberLiteral(num_str.parse().unwrap_or(0.0))
        });

    // Regex literals - commented out for now due to type inference issues
    // Will be handled in a more sophisticated parser later
    // let regex_literal = just::<_, _, Simple<char>>('/')
    //     .ignore_then(
    //         filter(|c| *c != '/' && *c != '\n' && *c != '\r')
    //             .repeated()
    //             .at_least(1)
    //     )
    //     .then_ignore(just('/'))
    //     .then(filter(|c: &char| c.is_alphabetic()).repeated())
    //     .map(|(pattern, flags)| {
    //         let pattern_str: String = pattern.into_iter().collect();
    //         let flags_str: String = flags.into_iter().collect();
    //         let full = if flags_str.is_empty() {
    //             pattern_str
    //         } else {
    //             format!("{}/{}", pattern_str, flags_str)
    //         };
    //         TokenKind::RegexLiteral(full)
    //     });

    // Identifiers and keywords
    let ident = text::ident()
        .map(|s: String| match s.as_str() {
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
            "true" => TokenKind::True,
            "false" => TokenKind::False,
            "null" => TokenKind::Null,
            "undefined" => TokenKind::Undefined,
            "new" => TokenKind::New,
            "class" => TokenKind::Class,
            "static" => TokenKind::Static,
            "async" => TokenKind::Async,
            "await" => TokenKind::Await,
            "Promise" => TokenKind::Promise,
            "string" => TokenKind::StringType,
            "number" => TokenKind::NumberType,
            "boolean" => TokenKind::BooleanType,
            "void" => TokenKind::VoidType,
            "any" => TokenKind::AnyType,
            "unknown" => TokenKind::UnknownType,
            "never" => TokenKind::NeverType,
            _ => TokenKind::Identifier(s),
        });

    // Three character operators
    let op3 = choice((
        just("===").to(TokenKind::EqualsEqualsEquals),
        just("!==").to(TokenKind::BangEqualsEquals),
        just("...").to(TokenKind::Ellipsis),
    ));
    
    // Two character operators
    let op2 = choice((
        just("=>").to(TokenKind::Arrow),
        just("==").to(TokenKind::EqualsEquals),
        just("!=").to(TokenKind::BangEquals),
        just("<=").to(TokenKind::LessThanEquals),
        just(">=").to(TokenKind::GreaterThanEquals),
        just("&&").to(TokenKind::AndAnd),
        just("||").to(TokenKind::OrOr),
        just("++").to(TokenKind::PlusPlus),
        just("--").to(TokenKind::MinusMinus),
        just("+=").to(TokenKind::PlusEquals),
        just("-=").to(TokenKind::MinusEquals),
        just("*=").to(TokenKind::StarEquals),
        just("/=").to(TokenKind::SlashEquals),
    ));
    
    // Simple regex literal - match pattern between forward slashes
    let regex_literal = just('/')
        .then(filter(|c| *c != '/' && *c != '\n').repeated())
        .then(just('/'))
        .then(filter(|c: &char| c.is_alphabetic()).repeated())
        .map(|(((_, pattern), _), flags)| {
            let pattern_str: String = pattern.into_iter().collect();
            let flags_str: String = flags.into_iter().collect();
            let full = if flags_str.is_empty() {
                pattern_str
            } else {
                format!("{}/{}", pattern_str, flags_str)
            };
            TokenKind::RegexLiteral(full)
        });

    // Single character operators
    let op1 = choice((
        just("@").to(TokenKind::At),
        just("{").to(TokenKind::LeftBrace),
        just("}").to(TokenKind::RightBrace),
        just("[").to(TokenKind::LeftBracket),
        just("]").to(TokenKind::RightBracket),
        just("(").to(TokenKind::LeftParen),
        just(")").to(TokenKind::RightParen),
        just(";").to(TokenKind::Semicolon),
        just(",").to(TokenKind::Comma),
        just(":").to(TokenKind::Colon),
        just(".").to(TokenKind::Dot),
        just("?").to(TokenKind::Question),
        just("|").to(TokenKind::Pipe),
        just("&").to(TokenKind::Ampersand),
        just("=").to(TokenKind::Equals),
        just("<").to(TokenKind::LessThan),
        just(">").to(TokenKind::GreaterThan),
        just("-").to(TokenKind::Minus),
        just("+").to(TokenKind::Plus),
        just("*").to(TokenKind::Star),
        just("/").to(TokenKind::Slash),
        just("^").to(TokenKind::Caret),
        just("!").to(TokenKind::Exclamation),
        just("%").to(TokenKind::Percent),
        just("~").to(TokenKind::Tilde),
    ));
    
    // Combine operators - check longer ones first
    let op = op3.or(op2).or(op1);

    // Combine all token parsers
    let token = choice((
        comment.boxed(),
        string_literal.boxed(),
        regex_literal.boxed(),
        number.boxed(),
        ident.boxed(),
        op.boxed(),
    ))
    .map_with_span(|kind, span: std::ops::Range<usize>| Token {
        kind,
        text: String::new(), // Will be filled in post-processing
        span: Span::new(span.start, span.end),
    });

    // Main lexer
    token
        .padded_by(whitespace.or(newline).repeated())
        .repeated()
        .then_ignore(end())
        .map(|mut tokens| {
            // Add EOF token
            tokens.push(Token {
                kind: TokenKind::Eof,
                text: String::new(),
                span: Span::new(0, 0),
            });
            tokens
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_tokens() {
        let input = "interface User { name: string; }";
        let result = tokenize(input);
        assert!(result.is_ok());
        let tokens = result.unwrap();
        assert!(tokens.len() > 0);
        assert_eq!(tokens[0].kind, TokenKind::Interface);
    }

    #[test]
    fn test_decorators() {
        let input = "@validator @required";
        let result = tokenize(input);
        assert!(result.is_ok());
        let tokens = result.unwrap();
        assert_eq!(tokens[0].kind, TokenKind::At);
        assert!(matches!(tokens[1].kind, TokenKind::Identifier(_)));
    }

    #[test]
    fn test_string_literals() {
        let input = r#""hello" 'world' "with\"escape""#;
        let result = tokenize(input);
        assert!(result.is_ok());
        let tokens = result.unwrap();
        assert!(matches!(tokens[0].kind, TokenKind::StringLiteral(_)));
        assert!(matches!(tokens[1].kind, TokenKind::StringLiteral(_)));
        assert!(matches!(tokens[2].kind, TokenKind::StringLiteral(_)));
    }

    #[test]
    fn test_numbers() {
        let input = "42 3.14 -10 1e10 2.5e-3";
        let result = tokenize(input);
        assert!(result.is_ok());
        let tokens = result.unwrap();
        for token in &tokens[..5] {
            assert!(matches!(token.kind, TokenKind::NumberLiteral(_)));
        }
    }

    #[test]
    fn test_comments() {
        let input = "// single line\n/// doc comment\n/* multi\nline */";
        let result = tokenize(input);
        assert!(result.is_ok());
        let tokens = result.unwrap();
        assert!(matches!(tokens[0].kind, TokenKind::SingleLineComment(_)));
        assert!(matches!(tokens[1].kind, TokenKind::DocComment(_)));
        assert!(matches!(tokens[2].kind, TokenKind::MultiLineComment(_)));
    }

    #[test]
    fn test_operators() {
        let input = "=== !== => && || ++ -- += -= *= /=";
        let result = tokenize(input);
        assert!(result.is_ok());
        let tokens = result.unwrap();
        assert_eq!(tokens[0].kind, TokenKind::EqualsEqualsEquals);
        assert_eq!(tokens[1].kind, TokenKind::BangEqualsEquals);
        assert_eq!(tokens[2].kind, TokenKind::Arrow);
        assert_eq!(tokens[3].kind, TokenKind::AndAnd);
        assert_eq!(tokens[4].kind, TokenKind::OrOr);
    }

    #[test]
    fn test_keywords() {
        let input = "interface type extends function export import from async await Promise";
        let result = tokenize(input);
        assert!(result.is_ok());
        let tokens = result.unwrap();
        assert_eq!(tokens[0].kind, TokenKind::Interface);
        assert_eq!(tokens[1].kind, TokenKind::Type);
        assert_eq!(tokens[2].kind, TokenKind::Extends);
        assert_eq!(tokens[3].kind, TokenKind::Function);
    }

    #[test]
    fn test_complex_expression() {
        let input = r#"
            export interface User extends BaseUser {
                @required @min(3)
                name: string;
                age?: number;
                emails: string[];
            }
        "#;
        let result = tokenize(input);
        assert!(result.is_ok());
        let tokens = result.unwrap();
        
        // Check that we have the expected sequence of tokens
        let token_kinds: Vec<_> = tokens.iter()
            .filter(|t| !matches!(t.kind, TokenKind::Eof))
            .map(|t| &t.kind)
            .collect();
        
        // Should start with: export interface User extends BaseUser {
        assert_eq!(token_kinds[0], &TokenKind::Export);
        assert_eq!(token_kinds[1], &TokenKind::Interface);
        assert!(matches!(token_kinds[2], TokenKind::Identifier(_)));
        assert_eq!(token_kinds[3], &TokenKind::Extends);
    }
}