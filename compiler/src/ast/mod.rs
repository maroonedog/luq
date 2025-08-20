// Zero-copy AST implementation using Arena allocation and string interning

use std::sync::Arc;

pub mod arena;
pub mod nodes;    // Zero-copy AST definitions
pub mod string_pool;
pub mod validation;
pub mod json_output;

pub use arena::{Arena, NodeId};

// Export node structures from nodes.rs
pub use nodes::{
    Program, AstNode, TypeNode, Field, Param, ImportSpecifier
};
#[allow(unused_imports)]
pub use nodes::{
    ExprNode, StmtNode, Constraint, ConstraintArg, ConstraintKind, ConstraintList, NodeList,
    BinaryOp, UnaryOp, LiteralValue
};
pub use string_pool::{StringPool, StringId, SourceSpan};
pub use json_output::ToJson;

/// Zero-copy AST context that owns all allocations
pub struct AstContext {
    /// Arena for AST nodes
    pub ast_nodes: Arena<nodes::AstNode>,
    /// Arena for type nodes
    pub type_nodes: Arena<nodes::TypeNode>,
    /// Arena for expression nodes
    pub expr_nodes: Arena<nodes::ExprNode>,
    /// Arena for statement nodes
    pub stmt_nodes: Arena<nodes::StmtNode>,
    /// Arena for field definitions
    pub fields: Arena<nodes::Field>,
    /// Arena for parameters
    pub params: Arena<nodes::Param>,
    /// Arena for constraints
    pub constraints: Arena<nodes::Constraint>,
    /// String pool for interned strings
    pub string_pool: StringPool,
    /// Source code (kept alive for string slices)
    pub source: Arc<String>,
}

impl AstContext {
    pub fn new(source: String) -> Self {
        Self {
            ast_nodes: Arena::new(),
            type_nodes: Arena::new(),
            expr_nodes: Arena::new(),
            stmt_nodes: Arena::new(),
            fields: Arena::new(),
            params: Arena::new(),
            constraints: Arena::new(),
            string_pool: StringPool::new(),
            source: Arc::new(source),
        }
    }

    /// Get a string slice from the pool
    pub fn get_str(&self, id: StringId) -> &str {
        self.string_pool.get(id)
    }

    /// Intern a string and return its ID
    pub fn intern(&mut self, s: &str) -> StringId {
        self.string_pool.intern(s)
    }

    /// Allocate a new AST node
    pub fn alloc_ast(&self, node: nodes::AstNode) -> NodeId {
        self.ast_nodes.alloc(node)
    }
    
    /// Allocate a new type node
    pub fn alloc_type(&self, node: nodes::TypeNode) -> NodeId {
        self.type_nodes.alloc(node)
    }
    
    /// Allocate a new expression node
    pub fn alloc_expr(&self, node: nodes::ExprNode) -> NodeId {
        self.expr_nodes.alloc(node)
    }
    
    /// Allocate a new statement node
    pub fn alloc_stmt(&self, node: nodes::StmtNode) -> NodeId {
        self.stmt_nodes.alloc(node)
    }
    
    /// Allocate a new field
    pub fn alloc_field(&self, field: nodes::Field) -> NodeId {
        self.fields.alloc(field)
    }
    
    /// Allocate a new parameter
    pub fn alloc_param(&self, param: nodes::Param) -> NodeId {
        self.params.alloc(param)
    }
    
    /// Allocate a new constraint
    pub fn alloc_constraint(&self, constraint: nodes::Constraint) -> NodeId {
        self.constraints.alloc(constraint)
    }

    /// Get an AST node by ID
    pub fn get_ast(&self, id: NodeId) -> Option<&nodes::AstNode> {
        self.ast_nodes.get(id)
    }
    
    /// Get a type node by ID
    pub fn get_type(&self, id: NodeId) -> Option<&nodes::TypeNode> {
        self.type_nodes.get(id)
    }
    
    /// Get an expression node by ID
    pub fn get_expr(&self, id: NodeId) -> Option<&nodes::ExprNode> {
        self.expr_nodes.get(id)
    }
    
    /// Get a statement node by ID
    pub fn get_stmt(&self, id: NodeId) -> Option<&nodes::StmtNode> {
        self.stmt_nodes.get(id)
    }
    
    /// Get a field by ID
    pub fn get_field(&self, id: NodeId) -> Option<&nodes::Field> {
        self.fields.get(id)
    }
    
    /// Get a parameter by ID
    pub fn get_param(&self, id: NodeId) -> Option<&nodes::Param> {
        self.params.get(id)
    }
    
    /// Get a constraint by ID
    pub fn get_constraint(&self, id: NodeId) -> Option<&nodes::Constraint> {
        self.constraints.get(id)
    }

}