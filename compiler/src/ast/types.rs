use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeParam {
    pub name: String,
    pub constraint: Option<Box<TypeAnnotation>>,
    pub default: Option<Box<TypeAnnotation>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum TypeAnnotation {
    // Primitive types
    String,
    Number,
    Boolean,
    Void,
    Null,
    Undefined,
    
    // Complex types
    Array(Box<TypeAnnotation>),
    Tuple(Vec<TypeAnnotation>),
    Object(Vec<ObjectTypeMember>),
    
    // Type references
    Reference {
        name: String,
        type_args: Option<Vec<TypeAnnotation>>,
    },
    
    // Union and Intersection
    Union(Vec<TypeAnnotation>),
    Intersection(Vec<TypeAnnotation>),
    
    // Literal types
    StringLiteral(String),
    NumberLiteral(f64),
    BooleanLiteral(bool),
    
    // Special
    Optional(Box<TypeAnnotation>),
    Readonly(Box<TypeAnnotation>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectTypeMember {
    pub decorators: Vec<crate::ast::Decorator>,
    pub key: String,
    pub optional: bool,
    pub readonly: bool,
    pub type_annotation: TypeAnnotation,
}