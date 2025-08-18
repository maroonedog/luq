use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Decorator {
    pub name: String,
    pub args: Vec<DecoratorArg>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DecoratorArg {
    Boolean(bool),
    Number(f64),
    String(String),
    Array(Vec<DecoratorArg>),
    Object(Vec<(String, DecoratorArg)>),
    Regex(String),
    Identifier(String),
}