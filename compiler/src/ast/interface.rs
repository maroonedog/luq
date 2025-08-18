use serde::{Serialize, Deserialize};
use super::decorator::Decorator;
use super::types::{TypeAnnotation, TypeParam};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterfaceDecl {
    pub decorators: Vec<Decorator>,
    pub name: String,
    pub type_params: Option<Vec<TypeParam>>,
    pub extends: Vec<String>,
    pub members: Vec<InterfaceMember>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterfaceMember {
    pub decorators: Vec<Decorator>,
    pub key: String,
    pub optional: bool,
    pub readonly: bool,
    pub type_annotation: TypeAnnotation,
}