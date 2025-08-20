// Arena allocator for zero-copy AST nodes

#![allow(dead_code)]

use std::sync::RwLock;
use std::marker::PhantomData;

/// Type-safe node ID for arena-allocated nodes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct NodeId {
    pub index: u32,
}

impl NodeId {
    #[inline]
    pub fn index(self) -> usize {
        self.index as usize
    }
}

/// Arena allocator for AST nodes
/// This allows us to allocate nodes without individual heap allocations
/// and access them by index without lifetime parameters
pub struct Arena<T> {
    nodes: RwLock<Vec<T>>,
    _phantom: PhantomData<T>,
}

impl<T> Arena<T> {
    pub fn new() -> Self {
        Self {
            nodes: RwLock::new(Vec::with_capacity(1024)),
            _phantom: PhantomData,
        }
    }

    /// Allocate a new node and return its ID
    #[inline]
    pub fn alloc(&self, node: T) -> NodeId {
        let mut nodes = self.nodes.write().unwrap();
        let index = nodes.len() as u32;
        nodes.push(node);
        NodeId { index }
    }

    /// Get a reference to a node by ID
    #[inline]
    pub fn get(&self, id: NodeId) -> Option<&T> {
        // SAFETY: We only ever append to the Vec, never remove or modify existing elements
        // Once allocated, nodes are immutable except through mutable arena access
        // This is safe as long as no one is writing while we're reading
        unsafe {
            let nodes = self.nodes.read().unwrap();
            let ptr = nodes.as_ptr();
            let len = nodes.len();
            std::mem::forget(nodes);  // Don't drop the guard yet
            
            if id.index() < len {
                Some(&*ptr.add(id.index()))
            } else {
                None
            }
        }
    }

    /// Get a mutable reference to a node by ID
    #[inline]
    pub fn get_mut(&mut self, id: NodeId) -> Option<&mut T> {
        // Safe because we have &mut self
        self.nodes.get_mut().unwrap().get_mut(id.index())
    }

    /// Get the number of allocated nodes
    pub fn len(&self) -> usize {
        self.nodes.read().unwrap().len()
    }

    /// Check if the arena is empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Reserve capacity for at least `additional` more nodes
    pub fn reserve(&self, additional: usize) {
        self.nodes.write().unwrap().reserve(additional);
    }
}

/// Multi-type arena that can store different types of nodes
#[allow(dead_code)]
pub struct TypedArena {
    statements: Arena<StatementNode>,
    expressions: Arena<ExpressionNode>,
    types: Arena<TypeNode>,
}

impl TypedArena {
    pub fn new() -> Self {
        Self {
            statements: Arena::new(),
            expressions: Arena::new(),
            types: Arena::new(),
        }
    }
}

// Node type markers for type safety
pub struct StatementNode;
pub struct ExpressionNode;
pub struct TypeNode;