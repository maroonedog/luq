use serde_json::{json, Value};
use super::{Program, Statement, InterfaceDecl, InterfaceMember, Decorator, DecoratorArg};
use super::types::{TypeAnnotation, TypeParam};
use super::program::{TypeAlias, ImportDecl, ExportDecl, ImportSpecifier};
use super::function::{FunctionDecl, FunctionParam, FunctionBody};

pub trait ToJson {
    fn to_json(&self) -> Value;
}

impl ToJson for Program {
    fn to_json(&self) -> Value {
        json!({
            "statements": self.statements.iter().map(|s| s.to_json()).collect::<Vec<_>>()
        })
    }
}

impl ToJson for Statement {
    fn to_json(&self) -> Value {
        match self {
            Statement::Interface(i) => json!({
                "type": "Interface",
                "data": i.to_json()
            }),
            Statement::Function(f) => json!({
                "type": "Function",
                "data": f.to_json()
            }),
            Statement::TypeAlias(t) => json!({
                "type": "TypeAlias",
                "data": t.to_json()
            }),
            Statement::Import(i) => json!({
                "type": "Import",
                "data": i.to_json()
            }),
            Statement::Export(e) => json!({
                "type": "Export",
                "data": e.to_json()
            }),
        }
    }
}

impl ToJson for InterfaceDecl {
    fn to_json(&self) -> Value {
        json!({
            "decorators": self.decorators.iter().map(|d| d.to_json()).collect::<Vec<_>>(),
            "name": self.name,
            "type_params": self.type_params.as_ref().map(|tp| tp.iter().map(|t| t.to_json()).collect::<Vec<_>>()),
            "extends": self.extends,
            "members": self.members.iter().map(|m| m.to_json()).collect::<Vec<_>>()
        })
    }
}

impl ToJson for InterfaceMember {
    fn to_json(&self) -> Value {
        json!({
            "decorators": self.decorators.iter().map(|d| d.to_json()).collect::<Vec<_>>(),
            "key": self.key,
            "optional": self.optional,
            "readonly": self.readonly,
            "type_annotation": self.type_annotation.to_json()
        })
    }
}

impl ToJson for Decorator {
    fn to_json(&self) -> Value {
        json!({
            "name": self.name,
            "args": self.args.iter().map(|a| a.to_json()).collect::<Vec<_>>()
        })
    }
}

impl ToJson for DecoratorArg {
    fn to_json(&self) -> Value {
        match self {
            DecoratorArg::String(s) => json!({ "type": "String", "value": s }),
            DecoratorArg::Number(n) => json!({ "type": "Number", "value": n }),
            DecoratorArg::Boolean(b) => json!({ "type": "Boolean", "value": b }),
            DecoratorArg::Regex(r) => json!({ "type": "Regex", "value": r }),
            DecoratorArg::Identifier(i) => json!({ "type": "Identifier", "value": i }),
            DecoratorArg::Array(arr) => json!({ 
                "type": "Array", 
                "value": arr.iter().map(|a| a.to_json()).collect::<Vec<_>>() 
            }),
            DecoratorArg::Object(obj) => json!({ 
                "type": "Object", 
                "value": obj.iter().map(|(k, v)| json!({ "key": k, "value": v.to_json() })).collect::<Vec<_>>() 
            }),
        }
    }
}

impl ToJson for TypeAnnotation {
    fn to_json(&self) -> Value {
        match self {
            TypeAnnotation::String => json!({ "kind": "String" }),
            TypeAnnotation::Number => json!({ "kind": "Number" }),
            TypeAnnotation::Boolean => json!({ "kind": "Boolean" }),
            TypeAnnotation::Void => json!({ "kind": "Void" }),
            TypeAnnotation::Undefined => json!({ "kind": "Undefined" }),
            TypeAnnotation::Null => json!({ "kind": "Null" }),
            TypeAnnotation::Array(t) => json!({ 
                "kind": "Array", 
                "elementType": t.to_json() 
            }),
            TypeAnnotation::Tuple(types) => json!({ 
                "kind": "Tuple", 
                "types": types.iter().map(|t| t.to_json()).collect::<Vec<_>>() 
            }),
            TypeAnnotation::Union(types) => json!({ 
                "kind": "Union", 
                "types": types.iter().map(|t| t.to_json()).collect::<Vec<_>>() 
            }),
            TypeAnnotation::Intersection(types) => json!({ 
                "kind": "Intersection", 
                "types": types.iter().map(|t| t.to_json()).collect::<Vec<_>>() 
            }),
            TypeAnnotation::StringLiteral(s) => json!({ 
                "kind": "StringLiteral", 
                "value": s 
            }),
            TypeAnnotation::NumberLiteral(n) => json!({ 
                "kind": "NumberLiteral", 
                "value": n 
            }),
            TypeAnnotation::BooleanLiteral(b) => json!({ 
                "kind": "BooleanLiteral", 
                "value": b 
            }),
            TypeAnnotation::Reference { name, type_args } => json!({ 
                "kind": "Reference", 
                "name": name,
                "type_args": type_args.as_ref().map(|args| args.iter().map(|t| t.to_json()).collect::<Vec<_>>())
            }),
            TypeAnnotation::Object(members) => json!({ 
                "kind": "Object",
                "members": members.iter().map(|m| json!({
                    "decorators": m.decorators.iter().map(|d| d.to_json()).collect::<Vec<_>>(),
                    "key": m.key,
                    "optional": m.optional,
                    "readonly": m.readonly,
                    "type_annotation": m.type_annotation.to_json()
                })).collect::<Vec<_>>()
            }),
            TypeAnnotation::Optional(t) => json!({ 
                "kind": "Optional", 
                "type": t.to_json()
            }),
            TypeAnnotation::Readonly(t) => json!({ 
                "kind": "Readonly", 
                "type": t.to_json()
            }),
        }
    }
}

impl ToJson for TypeParam {
    fn to_json(&self) -> Value {
        json!({
            "name": self.name,
            "constraint": self.constraint.as_ref().map(|c| c.to_json()),
            "default": self.default.as_ref().map(|d| d.to_json())
        })
    }
}

impl ToJson for TypeAlias {
    fn to_json(&self) -> Value {
        json!({
            "name": self.name,
            "type_params": self.type_params.as_ref().map(|tp| tp.iter().map(|t| t.to_json()).collect::<Vec<_>>()),
            "type_annotation": self.type_annotation.to_json()
        })
    }
}

impl ToJson for ImportDecl {
    fn to_json(&self) -> Value {
        json!({
            "specifiers": self.specifiers.iter().map(|s| s.to_json()).collect::<Vec<_>>(),
            "source": self.source
        })
    }
}

impl ToJson for ImportSpecifier {
    fn to_json(&self) -> Value {
        match self {
            ImportSpecifier::Named { name, alias } => json!({
                "kind": "Named",
                "name": name,
                "alias": alias
            }),
            ImportSpecifier::Default(name) => json!({
                "kind": "Default",
                "name": name
            }),
            ImportSpecifier::Namespace(name) => json!({
                "kind": "Namespace",
                "name": name
            }),
        }
    }
}

impl ToJson for ExportDecl {
    fn to_json(&self) -> Value {
        json!({
            "statement": self.statement.as_ref().map(|s| s.to_json()),
            "specifiers": self.specifiers.as_ref().map(|specs| specs.iter().map(|s| s.to_json()).collect::<Vec<_>>()),
            "source": self.source,
            "is_default": self.is_default
        })
    }
}

impl ToJson for super::program::ExportSpecifier {
    fn to_json(&self) -> Value {
        match self {
            super::program::ExportSpecifier::Named { name, alias } => json!({
                "kind": "Named",
                "name": name,
                "alias": alias
            }),
            super::program::ExportSpecifier::Default(name) => json!({
                "kind": "Default",
                "name": name
            }),
            super::program::ExportSpecifier::Namespace(name) => json!({
                "kind": "Namespace",
                "name": name
            }),
        }
    }
}

impl ToJson for FunctionDecl {
    fn to_json(&self) -> Value {
        json!({
            "decorators": self.decorators.iter().map(|d| d.to_json()).collect::<Vec<_>>(),
            "name": self.name,
            "params": self.params.iter().map(|p| p.to_json()).collect::<Vec<_>>(),
            "return_type": self.return_type.as_ref().map(|t| t.to_json()),
            "body": self.body.as_ref().map(|b| b.to_json())
        })
    }
}

impl ToJson for FunctionParam {
    fn to_json(&self) -> Value {
        json!({
            "name": self.name,
            "type_annotation": self.type_annotation.as_ref().map(|t| t.to_json()),
            "optional": self.optional,
            "default_value": None::<Value> // TODO: Implement when Expression ToJson is added
        })
    }
}

impl ToJson for FunctionBody {
    fn to_json(&self) -> Value {
        json!({
            "statements": self.statements.iter().map(|s| s.to_json()).collect::<Vec<_>>()
        })
    }
}

impl ToJson for super::function::FunctionStatement {
    fn to_json(&self) -> Value {
        match self {
            super::function::FunctionStatement::Return(expr) => json!({
                "type": "Return",
                "value": expr.as_ref().map(|e| e.to_json())
            }),
            super::function::FunctionStatement::Expression(expr) => json!({
                "type": "Expression",
                "expression": expr.to_json()
            }),
            super::function::FunctionStatement::If { condition, then_branch, else_branch } => json!({
                "type": "If",
                "condition": condition.to_json(),
                "then_branch": then_branch.iter().map(|s| s.to_json()).collect::<Vec<_>>(),
                "else_branch": else_branch.as_ref().map(|eb| eb.iter().map(|s| s.to_json()).collect::<Vec<_>>())
            }),
        }
    }
}

impl ToJson for super::function::Expression {
    fn to_json(&self) -> Value {
        match self {
            super::function::Expression::Literal(lit) => json!({
                "type": "Literal",
                "value": lit.to_json()
            }),
            super::function::Expression::Identifier(name) => json!({
                "type": "Identifier",
                "name": name
            }),
            super::function::Expression::Binary { left, operator, right } => json!({
                "type": "Binary",
                "left": left.to_json(),
                "operator": operator.to_json(),
                "right": right.to_json()
            }),
            super::function::Expression::Call { callee, arguments } => json!({
                "type": "Call",
                "callee": callee.to_json(),
                "arguments": arguments.iter().map(|a| a.to_json()).collect::<Vec<_>>()
            }),
            super::function::Expression::DynamicImport { source } => json!({
                "type": "DynamicImport",
                "source": source
            }),
            super::function::Expression::MemberAccess { object, property } => json!({
                "type": "MemberAccess",
                "object": object.to_json(),
                "property": property
            }),
            super::function::Expression::Unary { operator, operand } => json!({
                "type": "Unary",
                "operator": operator.to_json(),
                "operand": operand.to_json()
            }),
        }
    }
}

impl ToJson for super::function::Literal {
    fn to_json(&self) -> Value {
        match self {
            super::function::Literal::String(s) => json!({ "type": "String", "value": s }),
            super::function::Literal::Number(n) => json!({ "type": "Number", "value": n }),
            super::function::Literal::Boolean(b) => json!({ "type": "Boolean", "value": b }),
            super::function::Literal::Null => json!({ "type": "Null" }),
            super::function::Literal::Undefined => json!({ "type": "Undefined" }),
            super::function::Literal::Regex(r) => json!({ "type": "Regex", "value": r }),
        }
    }
}

impl ToJson for super::function::BinaryOperator {
    fn to_json(&self) -> Value {
        match self {
            super::function::BinaryOperator::Add => json!("Add"),
            super::function::BinaryOperator::Subtract => json!("Subtract"),
            super::function::BinaryOperator::Multiply => json!("Multiply"),
            super::function::BinaryOperator::Divide => json!("Divide"),
            super::function::BinaryOperator::Equal => json!("Equal"),
            super::function::BinaryOperator::NotEqual => json!("NotEqual"),
            super::function::BinaryOperator::LessThan => json!("LessThan"),
            super::function::BinaryOperator::LessThanOrEqual => json!("LessThanOrEqual"),
            super::function::BinaryOperator::GreaterThan => json!("GreaterThan"),
            super::function::BinaryOperator::GreaterThanOrEqual => json!("GreaterThanOrEqual"),
            super::function::BinaryOperator::And => json!("And"),
            super::function::BinaryOperator::Or => json!("Or"),
        }
    }
}

impl ToJson for super::function::UnaryOperator {
    fn to_json(&self) -> Value {
        match self {
            super::function::UnaryOperator::Not => json!("Not"),
            super::function::UnaryOperator::Minus => json!("Minus"),
            super::function::UnaryOperator::Plus => json!("Plus"),
        }
    }
}