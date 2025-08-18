use serde::{Serialize, Deserialize};
use super::decorator::Decorator;
use super::types::TypeAnnotation;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionDecl {
    pub decorators: Vec<Decorator>,
    pub name: String,
    pub params: Vec<FunctionParam>,
    pub return_type: Option<TypeAnnotation>,
    pub body: Option<FunctionBody>,  // None for declaration only
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionParam {
    pub name: String,
    pub type_annotation: Option<TypeAnnotation>,
    pub optional: bool,
    pub default_value: Option<Expression>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionBody {
    pub statements: Vec<FunctionStatement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FunctionStatement {
    Return(Option<Expression>),
    Expression(Expression),
    If {
        condition: Expression,
        then_branch: Vec<FunctionStatement>,
        else_branch: Option<Vec<FunctionStatement>>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Expression {
    Literal(Literal),
    Identifier(String),
    Binary {
        left: Box<Expression>,
        operator: BinaryOperator,
        right: Box<Expression>,
    },
    Call {
        callee: Box<Expression>,
        arguments: Vec<Expression>,
    },
    DynamicImport {
        source: String,
    },
    MemberAccess {
        object: Box<Expression>,
        property: String,
    },
    Unary {
        operator: UnaryOperator,
        operand: Box<Expression>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Literal {
    String(String),
    Number(f64),
    Boolean(bool),
    Null,
    Undefined,
    Regex(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BinaryOperator {
    Add,
    Subtract,
    Multiply,
    Divide,
    Equal,
    NotEqual,
    LessThan,
    LessThanOrEqual,
    GreaterThan,
    GreaterThanOrEqual,
    And,
    Or,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UnaryOperator {
    Not,    // !
    Minus,  // -
    Plus,   // +
}