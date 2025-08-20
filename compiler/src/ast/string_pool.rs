// String interning pool for zero-copy string handling

#![allow(dead_code)]

use std::collections::HashMap;
use std::fmt;

/// Type-safe string ID
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct StringId(u32);

impl StringId {
    pub const EMPTY: StringId = StringId(0);
    
    #[inline]
    pub fn index(self) -> usize {
        self.0 as usize
    }
}

impl fmt::Display for StringId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "StringId({})", self.0)
    }
}

/// String pool for interning strings
/// This eliminates string duplication and allows O(1) string comparison
pub struct StringPool {
    strings: Vec<String>,
    lookup: HashMap<String, StringId>,
}

impl StringPool {
    pub fn new() -> Self {
        let mut pool = Self {
            strings: Vec::with_capacity(256),
            lookup: HashMap::with_capacity(256),
        };
        // Reserve index 0 for empty string
        pool.intern("");
        pool
    }

    /// Intern a string and return its ID
    /// If the string already exists, returns existing ID
    pub fn intern(&mut self, s: &str) -> StringId {
        if let Some(&id) = self.lookup.get(s) {
            return id;
        }
        
        let id = StringId(self.strings.len() as u32);
        self.strings.push(s.to_string());
        self.lookup.insert(s.to_string(), id);
        id
    }

    /// Get a string by ID
    #[inline]
    pub fn get(&self, id: StringId) -> &str {
        &self.strings[id.index()]
    }

    /// Check if a string exists in the pool
    pub fn contains(&self, s: &str) -> bool {
        self.lookup.contains_key(s)
    }

    /// Get the ID of a string if it exists
    pub fn get_id(&self, s: &str) -> Option<StringId> {
        self.lookup.get(s).copied()
    }

    /// Get the number of interned strings
    pub fn len(&self) -> usize {
        self.strings.len()
    }
}

/// Alternative: Use source code spans instead of interning
/// This is even more memory efficient for identifiers that appear in source
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SourceSpan {
    pub start: u32,
    pub end: u32,
}

impl SourceSpan {
    pub fn new(start: usize, end: usize) -> Self {
        Self {
            start: start as u32,
            end: end as u32,
        }
    }

    /// Get the string slice from source code
    pub fn slice<'a>(&self, source: &'a str) -> &'a str {
        &source[self.start as usize..self.end as usize]
    }

    pub fn len(&self) -> usize {
        (self.end - self.start) as usize
    }
}