pub mod decorator;
mod interface;
mod program;
mod types;
mod validation;
mod json_output;
mod function;

pub use decorator::{Decorator, DecoratorArg};
pub use interface::{InterfaceDecl, InterfaceMember};
pub use program::{Program, Statement, ImportDecl, ExportDecl, ImportSpecifier, ExportSpecifier};
pub use types::{TypeAnnotation, TypeParam, ObjectTypeMember};
pub use validation::AstValidator;
pub use json_output::ToJson;
pub use function::{FunctionDecl, FunctionParam, FunctionBody, FunctionStatement, Expression, Literal, BinaryOperator, UnaryOperator};