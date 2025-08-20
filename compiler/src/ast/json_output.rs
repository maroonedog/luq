// JSON output for AST

use super::*;
use serde_json::Value;
use serde_json::json;

/// Trait for converting AST to JSON
pub trait ToJson {
    fn to_json(&self, context: &AstContext) -> Value;
}

impl ToJson for (Program, AstContext) {
    fn to_json(&self, _context: &AstContext) -> Value {
        self.0.to_json(&self.1)
    }
}

impl ToJson for Program {
    fn to_json(&self, context: &AstContext) -> Value {
        let mut declarations = Vec::new();
        
        // Iterate through declarations
        for i in 0..self.declarations.len() {
            let node_id = NodeId { 
                index: self.declarations.start.index + i as u32 
            };
            
            if let Some(node) = context.get_ast(node_id) {
                declarations.push(node.to_json(context));
            }
        }
        
        json!({
            "type": "Program",
            "declarations": declarations
        })
    }
}

impl ToJson for AstNode {
    fn to_json(&self, context: &AstContext) -> Value {
        match self {
            AstNode::TypeDecl { name, body, decorators: _, span, .. } => {
                let type_name = context.get_str(*name);
                let body_json = if let Some(type_node) = context.get_type(*body) {
                    type_node.to_json(context)
                } else {
                    json!(null)
                };
                
                json!({
                    "type": "TypeDecl",
                    "name": type_name,
                    "body": body_json,
                    "span": {
                        "start": span.start,
                        "end": span.end
                    }
                })
            }
            AstNode::FunctionDecl { name, params, return_type, body: _, decorators: _, span, .. } => {
                let func_name = context.get_str(*name);
                
                let mut param_list = Vec::new();
                for i in 0..params.len() {
                    let param_id = NodeId { 
                        index: params.start.index + i as u32 
                    };
                    if let Some(param) = context.get_param(param_id) {
                        param_list.push(param.to_json(context));
                    }
                }
                
                let return_type_json = if let Some(ret_id) = return_type {
                    if let Some(type_node) = context.get_type(*ret_id) {
                        type_node.to_json(context)
                    } else {
                        json!(null)
                    }
                } else {
                    json!(null)
                };
                
                json!({
                    "type": "FunctionDecl",
                    "name": func_name,
                    "params": param_list,
                    "returnType": return_type_json,
                    "span": {
                        "start": span.start,
                        "end": span.end
                    }
                })
            }
            AstNode::TypeAlias { name, body, .. } => {
                let alias_name = context.get_str(*name);
                let body_json = if let Some(type_node) = context.get_type(*body) {
                    type_node.to_json(context)
                } else {
                    json!(null)
                };
                
                json!({
                    "type": "TypeAlias",
                    "name": alias_name,
                    "body": body_json
                })
            }
            AstNode::Import { source, .. } => {
                let source_str = context.get_str(*source);
                json!({
                    "type": "Import",
                    "source": source_str
                })
            }
            AstNode::Export { .. } => {
                json!({
                    "type": "Export"
                })
            }
            _ => json!({ "type": "Unknown" })
        }
    }
}

impl ToJson for TypeNode {
    fn to_json(&self, context: &AstContext) -> Value {
        match self {
            TypeNode::String { .. } => json!({ "type": "string" }),
            TypeNode::Number { .. } => json!({ "type": "number" }),
            TypeNode::Boolean { .. } => json!({ "type": "boolean" }),
            TypeNode::Ref { target, .. } => {
                let ref_name = context.get_str(*target);
                json!({
                    "type": "reference",
                    "name": ref_name
                })
            }
            TypeNode::Array { elem, .. } => {
                let elem_type = if let Some(type_node) = context.get_type(*elem) {
                    type_node.to_json(context)
                } else {
                    json!(null)
                };
                json!({
                    "type": "array",
                    "element": elem_type
                })
            }
            TypeNode::Object { fields, .. } => {
                let mut field_list = Vec::new();
                for i in 0..fields.len() {
                    let field_id = NodeId { 
                        index: fields.start.index + i as u32 
                    };
                    if let Some(field) = context.get_field(field_id) {
                        field_list.push(field.to_json(context));
                    }
                }
                json!({
                    "type": "object",
                    "fields": field_list
                })
            }
            TypeNode::Union { variants, .. } => {
                let mut variant_list = Vec::new();
                for i in 0..variants.len() {
                    let variant_id = NodeId { 
                        index: variants.start.index + i as u32 
                    };
                    if let Some(type_node) = context.get_type(variant_id) {
                        variant_list.push(type_node.to_json(context));
                    }
                }
                json!({
                    "type": "union",
                    "variants": variant_list
                })
            }
            _ => json!({ "type": "unknown" })
        }
    }
}

impl ToJson for Field {
    fn to_json(&self, context: &AstContext) -> Value {
        let field_name = context.get_str(self.name);
        let type_json = if let Some(type_node) = context.get_type(self.type_node) {
            type_node.to_json(context)
        } else {
            json!(null)
        };
        
        json!({
            "name": field_name,
            "type": type_json,
            "optional": self.optional,
            "readonly": self.readonly
        })
    }
}

impl ToJson for Param {
    fn to_json(&self, context: &AstContext) -> Value {
        let param_name = context.get_str(self.name);
        let type_json = if let Some(type_id) = self.type_node {
            if let Some(type_node) = context.get_type(type_id) {
                type_node.to_json(context)
            } else {
                json!(null)
            }
        } else {
            json!(null)
        };
        
        json!({
            "name": param_name,
            "type": type_json,
            "optional": self.optional
        })
    }
}