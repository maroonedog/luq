// Clear AST node definitions with tree structure

#![allow(dead_code)]

use super::{NodeId, StringId, SourceSpan};
use smallvec::SmallVec;

/// Root program - collection of top-level declarations
#[derive(Debug, Clone, Copy)]
pub struct Program {
    pub declarations: NodeList,  // List of AstNode IDs
}

/// Main AST node - top level declarations
#[derive(Debug, Clone, Copy)]
pub enum AstNode {
    // Type declaration: interface X { ... }
    TypeDecl { 
        name: StringId, 
        body: NodeId,  // Points to TypeNode
        decorators: NodeList,
        span: SourceSpan,
        doc_comment: Option<StringId>  // JSDoc comment
    },
    
    // Function declaration: function f() { ... }
    FunctionDecl { 
        name: StringId,
        params: NodeList,
        return_type: Option<NodeId>,  // Points to TypeNode
        body: Option<NodeId>,  // Points to BlockNode
        decorators: NodeList,
        span: SourceSpan,
        doc_comment: Option<StringId>  // JSDoc comment
    },
    
    // Type alias: type X = ...
    TypeAlias { 
        name: StringId,
        type_params: NodeList,
        body: NodeId,  // Points to TypeNode
        span: SourceSpan,
        doc_comment: Option<StringId>  // JSDoc comment
    },
    
    // Import: import { x } from "..."
    Import { 
        specifiers: NodeList,
        source: StringId,
        span: SourceSpan
    },
    
    // Export: export ...
    Export { 
        statement: Option<NodeId>,
        specifiers: NodeList,
        source: Option<StringId>,
        is_default: bool,
        span: SourceSpan
    },
    
    // Type node wrapper
    Type(TypeNode),
    
    // Expression node wrapper
    Expr(ExprNode),
    
    // Statement node wrapper
    Stmt(StmtNode),
}

/// Type system nodes
#[derive(Debug, Clone, Copy)]
pub enum TypeNode {
    // Primitive types
    String { 
        constraints: ConstraintList,
        span: SourceSpan 
    },
    Number { 
        constraints: ConstraintList,
        span: SourceSpan 
    },
    Boolean { 
        span: SourceSpan 
    },
    
    // Complex types
    Array { 
        elem: NodeId,  // Points to another TypeNode
        constraints: ConstraintList,
        span: SourceSpan 
    },
    
    Union { 
        variants: NodeList,  // List of TypeNode IDs
        span: SourceSpan 
    },
    
    Intersection {
        types: NodeList,  // List of TypeNode IDs
        span: SourceSpan
    },
    
    Object { 
        fields: NodeList,  // List of Field nodes
        span: SourceSpan 
    },
    
    // Reference to another type
    Ref { 
        target: StringId,
        type_args: NodeList,  // Generic type arguments
        span: SourceSpan 
    },
    
    // Optional type: T?
    Optional { 
        inner: NodeId,  // Points to another TypeNode
        span: SourceSpan 
    },
    
    // Function type: (a: T, b: U) => R
    Function {
        params: NodeList,
        return_type: NodeId,
        span: SourceSpan
    },
    
    // Tuple type: [T, U, V]
    Tuple {
        types: NodeList,
        span: SourceSpan
    },
    
    // Literal type: "foo" | 123 | true
    Literal {
        value: LiteralValue,
        span: SourceSpan
    },
}

/// Expression nodes
#[derive(Debug, Clone, Copy)]
pub enum ExprNode {
    // Literals
    Literal {
        value: LiteralValue,
        span: SourceSpan
    },
    
    // Identifier reference
    Identifier {
        name: StringId,
        span: SourceSpan
    },
    
    // Binary operation: a + b
    Binary {
        left: NodeId,
        op: BinaryOp,
        right: NodeId,
        span: SourceSpan
    },
    
    // Unary operation: !x, -x
    Unary {
        op: UnaryOp,
        operand: NodeId,
        span: SourceSpan
    },
    
    // Function call: f(a, b)
    Call {
        callee: NodeId,
        args: NodeList,
        span: SourceSpan
    },
    
    // Member access: a.b
    Member {
        object: NodeId,
        property: StringId,
        computed: bool,  // true for a[b], false for a.b
        span: SourceSpan
    },
    
    // Array literal: [1, 2, 3]
    Array {
        elements: NodeList,
        span: SourceSpan
    },
    
    // Object literal: { a: 1, b: 2 }
    Object {
        properties: NodeList,
        span: SourceSpan
    },
    
    // Conditional: a ? b : c
    Conditional {
        test: NodeId,
        consequent: NodeId,
        alternate: NodeId,
        span: SourceSpan
    },
}

/// Statement nodes
#[derive(Debug, Clone, Copy)]
pub enum StmtNode {
    // Return statement
    Return {
        value: Option<NodeId>,
        span: SourceSpan
    },
    
    // If statement
    If {
        test: NodeId,
        consequent: NodeId,  // Points to BlockNode
        alternate: Option<NodeId>,  // Points to BlockNode or another If
        span: SourceSpan
    },
    
    // Expression statement
    Expression {
        expr: NodeId,
        span: SourceSpan
    },
    
    // Block statement
    Block {
        statements: NodeList,
        span: SourceSpan
    },
}

/// Field in an object type or interface
#[derive(Debug, Clone, Copy)]
pub struct Field {
    pub name: StringId,
    pub type_node: NodeId,  // Points to TypeNode
    pub optional: bool,
    pub readonly: bool,
    pub decorators: NodeList,
    pub span: SourceSpan,
}

/// Function parameter
#[derive(Debug, Clone, Copy)]
pub struct Param {
    pub name: StringId,
    pub type_node: Option<NodeId>,  // Points to TypeNode
    pub optional: bool,
    pub default_value: Option<NodeId>,  // Points to ExprNode
    pub span: SourceSpan,
}

/// Import/Export specifier
#[derive(Debug, Clone, Copy)]
pub struct ImportSpecifier {
    pub imported: StringId,
    pub local: Option<StringId>,
    pub span: SourceSpan,
}

/// Constraint on a type
#[derive(Debug, Clone)]
pub struct Constraint {
    pub kind: ConstraintKind,
    pub args: SmallVec<[ConstraintArg; 2]>,
    pub span: SourceSpan,
}

/// Constraint argument - can be number, string, or reference
#[derive(Debug, Clone, Copy)]
pub enum ConstraintArg {
    Number(f64),
    String(StringId),
    Boolean(bool),
    Reference(NodeId),
}

/// Kinds of constraints
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConstraintKind {
    // String constraints
    MinLength,
    MaxLength,
    Pattern,
    Format,
    
    // Number constraints
    Min,
    Max,
    MultipleOf,
    
    // Array constraints
    MinItems,
    MaxItems,
    UniqueItems,
    
    // General constraints
    Const,
    Enum,
    Required,
    Optional,
}

/// Literal values
#[derive(Debug, Clone, Copy)]
pub enum LiteralValue {
    String(StringId),
    Number(f64),
    Boolean(bool),
    Regex(StringId),  // Regular expression pattern
    Null,
    Undefined,
}

/// Binary operators
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinaryOp {
    // Arithmetic
    Add, Sub, Mul, Div, Mod,
    // Comparison
    Eq, Ne, Lt, Le, Gt, Ge,
    // Logical
    And, Or,
    // Bitwise
    BitAnd, BitOr, BitXor,
}

/// Unary operators
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnaryOp {
    Not, Neg, Plus, BitNot,
}

/// List of nodes (replaces Vec for zero-copy)
#[derive(Debug, Clone, Copy)]
pub struct NodeList {
    pub start: NodeId,
    pub count: u32,
}

impl NodeList {
    pub fn empty() -> Self {
        Self {
            start: NodeId { index: 0 },
            count: 0,
        }
    }

    pub fn single(id: NodeId) -> Self {
        Self {
            start: id,
            count: 1,
        }
    }

    pub fn new(start: NodeId, count: u32) -> Self {
        Self { start, count }
    }
    
    pub fn is_empty(&self) -> bool {
        self.count == 0
    }
    
    pub fn len(&self) -> usize {
        self.count as usize
    }
}

/// List of constraints (uses inline storage for common cases)
#[derive(Debug, Clone, Copy)]
pub struct ConstraintList {
    pub start: NodeId,  // Points to first Constraint node
    pub count: u16,
}

impl ConstraintList {
    pub fn empty() -> Self {
        Self {
            start: NodeId { index: 0 },
            count: 0,
        }
    }
    
    pub fn new(start: NodeId, count: u16) -> Self {
        Self { start, count }
    }
}