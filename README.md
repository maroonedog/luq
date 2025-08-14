<div align="center">
  <img src="./public/img/library_image.png" alt="Luq Logo" width="300" />
  
  # Luq - Universal Model & API Definition Platform

**Alpha Release**: Single source of truth for API, types, validation, and business logic across all languages

</div>

### The Vision: Define Once, Generate Everywhere

**Luq is not just another validation library.** It's evolving into a unified platform where you define your API contracts, data models, validation rules, and business logic once—then generate type-safe implementations for any language.

> **Note**: The roadmap and features described here represent our current vision and are subject to change. Nothing beyond the currently released TypeScript library (Phase 1) should be considered final. We'll adapt based on community feedback and technical discoveries.

### Who needs Luq?

**Today (TypeScript Library)**:
- Teams with existing TypeScript types who need validation
- Applications requiring CSP-safe dynamic validation
- Projects needing custom business rules as plugins

**Tomorrow (.luq Format & Multi-language - 2026)**:
- **Microservices** with different languages needing consistent validation
- **API Gateways** requiring validation at multiple layers
- **Mobile/Web/Backend** sharing the same business rules
- **Enterprise systems** needing unified validation across platforms

### Overview

**Current Release (Phase 1)**: A TypeScript validation library that serves as the foundation for something bigger:
- **Type-first**: Learn from your existing code patterns
- **Plugin Architecture**: Capture business logic as reusable components
- **Production-ready**: CSP-compliant, tree-shakeable (19-23KB gzipped)
- **JSON Schema compatible**: Bridge to existing standards

**The Journey Ahead**:
1. **Phase 1** (Now): TypeScript library with plugin system
2. **Phase 2**: `.luq` language - TypeScript-like validation DSL with IDE support
3. **Phase 3**: AOT compilation for optimal performance
4. **Phase 4**: Generate validators for Go, Python, Java, Rust, and more

## The Problem We're Solving

```javascript
// Current reality: Everything is duplicated across languages

// Frontend API client (TypeScript)
interface Order { /* manually typed */ }
async function createOrder(order: Order) { /* manually coded */ }
function validateOrder(order: Order) { /* validation duplicated */ }

// Backend controller (Java)
@RestController
public class OrderController { /* manually coded */ }
public class Order { /* manually typed */ }
public ValidationResult validateOrder() { /* validation duplicated */ }

// Mobile app (Swift)
struct Order { /* manually typed */ }
func createOrder() { /* manually coded */ }
func validateOrder() { /* validation duplicated */ }

// API Documentation
openapi: 3.0.0  # manually maintained, often out of sync
```

**The Luq Solution (Future - Single Source of Truth):**
```typescript
// Define everything once in order.luq
@endpoint("/api/orders")
interface OrderAPI {
  @post("/")
  create(body: Order): OrderResponse;
}

interface Order {
  @min(0) @businessRule("calculateFromItems")
  total: number;
  
  @minLength(1)
  items: Product[];
}
```

Generate everything:
```bash
luq generate order.luq --target=all

✓ Generated code for each language
✓ Type-safe API clients
✓ Models with validation
✓ API documentation
```

## Quick Start (Phase 1 - Available Now)

```bash
npm install @maroonedog/luq
```

```typescript
import { Builder } from "@maroonedog/luq";
import { requiredPlugin, stringMinPlugin, numberMinPlugin, stringEmailPlugin } from "@maroonedog/luq/plugins";

type User = {
  name: string;
  age: number;
  email: string;
};

const validateUser = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(numberMinPlugin)
  .use(stringEmailPlugin)
  .for<User>()
  .v("name", (b) => b.string.required().min(3))
  .v("age", (b) => b.number.required().min(18))
  .v("email", (b) => b.string.required().email())
  .build();

// This TypeScript code is learning your patterns
// Soon, it will help generate validators for other languages
```

## Why Luq is Practical

### Why Not Use Existing Solutions?

**Similar tools exist, but none provide a complete solution:**

| Tool | What It Does | What's Missing |
|------|-------------|----------------|
| **TypeSpec** (Microsoft) | API-first contracts | Business logic, runtime validation, custom rules |
| **Smithy** (AWS) | AWS service models | General-purpose use, frontend/mobile generation |
| **JSON Schema** | Structure validation | API definitions, business logic, code generation |
| **Protobuf/gRPC** | RPC & serialization | REST APIs, complex validation, business rules |
| **OpenAPI** | API documentation | Implementation code, business logic, validation |
| **tRPC/GraphQL** | Type-safe APIs | Multi-language support, validation rules |

**Luq's Unified Approach (Progressive Abstraction Architecture):**

| Level | What You Get | Status |
|-------|-------------|--------|
| **Level 1** | TypeScript validation library | ✅ Available Now |
| **Level 2** | .luq format (models + validation) | 🚧 Q1-Q3 2026 |
| **Level 3** | Full platform (API + models + validation) | 🔮 Vision |

**Key Differentiators:**
- **Progressive adoption**: Start with validation, evolve to full platform
- **Single source of truth**: API, types, validation, and business logic together
- **TypeScript-like syntax**: Familiar to millions of developers
- **Generate everything**: Controllers, models, validators, docs, SDKs

### Luq's Practical Approach

| Challenge | Other Libraries | Luq Solution |
|-----------|----------------|--------------|
| **CSP Restrictions** | AJV fails at runtime | ✅ No eval/Function usage |
| **Dynamic Schemas** | AJV Standalone can't adapt | ✅ Full runtime flexibility |
| **Existing Types** | Rewrite as schemas | ✅ Use types as-is |
| **Custom Rules** | Copy-paste code | ✅ Type-safe plugins |
| **Bundle Size** | All-or-nothing | ✅ Import only what you need |

## Why Invest in Luq Today?

### Immediate Benefits (Phase 1 - Now)
| Feature | Value |
|---------|-------|
| **Type-First** | Use existing TypeScript types |
| **Plugin Architecture** | Capture business logic once |
| **Production-Ready** | CSP-safe, tree-shakeable |
| **JSON Schema Support** | 100% Draft-07 compliance |

### Future Benefits (Phase 2-4)
| Feature | Value |
|---------|-------|
| **Universal Validation** | One source of truth for all platforms |
| **Business Logic Preservation** | Never duplicate complex rules |
| **Language Agnostic** | Generate for any target language |
| **Performance Optimized** | AOT compilation when needed |

### The Strategic Advantage

**Start using Luq today to**:
1. Solve immediate TypeScript validation needs
2. Gradually capture your business rules as plugins
3. Prepare for automatic multi-language generation
4. Future-proof your validation strategy

## Motivation

### The Real Problem: Death by a Thousand Cuts

Every application needs input validation. It's not optional—it's fundamental. Yet despite decades of software evolution, validation remains surprisingly painful:

**The daily frustrations that sparked Luq:**

```typescript
// Frontend (TypeScript)
function validateOrder(order: Order) {
  // Write validation logic once...
}

// BFF (Node.js)
function validateOrder(order) {
  // Write it again, slightly different...
}

// Backend (Java/Python/Go)
public ValidationResult validateOrder(Order order) {
  // Write it yet again, hope it matches...
}

// Three implementations. Three chances for bugs. Zero consistency.
```

**The "solutions" that aren't:**

1. **JSON/YAML validation configs**: Trading code for configuration hell
   ```yaml
   # Expressing complex business logic in YAML? No thanks.
   rules:
     - field: discount
       when:
         customer.tier: 
           not_in: [gold, platinum]
       max: 0
   ```

2. **Runtime schema validators**: Losing type safety for "flexibility"
   ```javascript
   // Types and validation drift apart over time
   const schema = { /* 500 lines of schema */ }
   type User = any; // "We'll fix the types later"
   ```

3. **Code generation from specs**: One-way streets with no return
   ```bash
   # Generate once, customize, now you can never regenerate
   openapi-generator generate -i spec.yaml
   # Months later: spec and code are completely out of sync
   ```

### Why Luq Exists

I searched for a solution that would let me:
- Write validation logic in a code-like manner (not JSON/YAML)
- Share the exact same rules across TypeScript, Java, Python, etc.
- Keep my existing TypeScript types as the source of truth
- Gradually evolve from simple validation to a complete platform

No existing OSS project met these needs. They all forced compromises:
- Use our schema format (forget your existing types)
- Use our configuration language (goodbye type safety)
- Use our specific stack (vendor lock-in)
- Generate once and maintain forever (technical debt from day one)

**So I built Luq with a simple philosophy:**
1. **Phase 1**: Solve today's validation pain in TypeScript
2. **Phase 2**: Define once in .luq, generate for every language
3. **Phase 3**: Expand to complete API/model/business logic platform

This isn't about building another validation library. It's about ending the cycle of rewriting the same validation logic in every layer of every application.

### Migration Considerations

Teams evaluating validation solutions often face practical constraints:

| Constraint | Challenge | Luq's Approach |
|------------|-----------|----------------|
| **Organizational** | Established standards and architecture | Works with existing TypeScript types |
| **Time** | Limited resources for refactoring | Incremental adoption possible |
| **Risk** | Production stability requirements | Non-breaking additive changes |

**Optional Progressive Path:**

1. Start with Builder pattern using existing types
2. Convert to declarative `.luq` format when beneficial
3. Generate optimized validators via AOT compilation
4. Future: Cross-language code generation

### Validation Scope Comparison

| Tool Category | Focus | Capabilities |
|---------------|-------|-------------|
| **API Specs** (OpenAPI, GraphQL) | Structure & Types | Basic constraints |
| **Schema Validators** | Type Safety | Type + simple rules |
| **Luq (.luq format)** | Complete Validation | Type + constraints + relationships + business logic |

Luq's planned `.luq` format aims to capture:
- Field-level constraints (min, max, patterns)
- Cross-field relationships
- Contextual validation rules
- Domain-specific business logic

### Choosing Between Approaches

| Factor | Schema-First | Type-First |
|--------|--------------|------------|
| **Best For** | New projects | Existing codebases |
| **Type Source** | Generated from schema | Already defined |
| **Migration Effort** | Rewrite types as schemas | Add validation to existing types |
| **Type Safety** | Schema drives types | Types drive validation |

Both approaches are valid. The choice depends on your project's context and constraints.

### Technical Design Decisions

**Architecture Choices:**

| Decision | Trade-off | Rationale |
|----------|-----------|-----------|
| **Plugin System** | Performance vs Extensibility | Prioritizes customization and tree-shaking |
| **Type-First** | Learning curve vs Migration ease | Reduces friction for existing projects |
| **Zero Dependencies** | Features vs Bundle size | Ensures predictable bundle size |

**Performance Considerations:**
- Optimized for common validation patterns (required fields, length checks, ranges)
- Plugin system adds ~15-20% overhead vs monolithic code
- AOT compilation planned to eliminate runtime overhead

**Note:** Different projects have different needs. Luq is one option among many excellent validation libraries in the ecosystem.

## Performance & Bundle Size

### Bundle Size Comparison (gzipped, measured 2025-08-14)

| Library | Simple Schema | Complex Schema | Notes |
|---------|---------------|----------------|-------|
| **AJV Standalone** | 1.03 KB | 4.63 KB | Pre-compiled validation |
| **Valibot** | 1.31 KB | 2.49 KB | Modular design |
| **Yup** | 12.80 KB | 13.40 KB | Simple API |
| **Luq** | 19.10 KB | 22.47 KB | Tree-shakable plugins |
| **Luq (JsonSchema)** | 26.06 KB | 29.07 KB | JSON Schema with individual plugins |
| **Luq (JsonSchema Full)** | 31.75 KB | 32.32 KB | All JSON Schema features |
| **AJV** | 37.78 KB | 38.33 KB | Full JSON Schema |
| **Joi** | 44.44 KB | 45.00 KB | Server-focused |
| **Zod** | 47.45 KB | 48.12 KB | Feature-rich |

### Performance Benchmarks (ops/sec)

> **Context**: Raw speed isn't everything. AJV achieves top performance using `new Function()` which fails in CSP-restricted environments. AJV Standalone requires build-time compilation, preventing dynamic schemas. Luq provides the best balance for real-world production use.

#### Simple Schema
| Library | Operations/sec | Relative | CSP Safe | Dynamic |
|---------|---------------|----------|----------|---------|
| **AJV Standalone** | 3,307,131 | 267.6x | ✅ | ❌ |
| **AJV** | 2,480,209 | 200.6x | ❌ | ✅ |
| **Luq (JsonSchema)** | 1,684,363 | 136.2x | ✅ | ✅ |
| **Luq (JsonSchema Full)** | 1,586,665 | 128.3x | ✅ | ✅ |
| **Luq** | 1,235,123 | 100.0x | ✅ | ✅ |
| **Valibot** | 902,700 | 73.0x | ✅ | ✅ |
| **Zod** | 486,275 | 39.3x | ✅ | ✅ |
| **Joi** | 175,362 | 14.2x | ✅ | ✅ |
| **Yup** | 130,129 | 10.5x | ✅ | ✅ |

#### Complex Schema
| Library | Operations/sec | Relative | CSP Safe | Dynamic |
|---------|---------------|----------|----------|---------|
| **AJV Standalone** | 239,848 | 5.51x | ✅ | ❌ |
| **AJV** | 232,378 | 5.34x | ❌ | ✅ |
| **Valibot** | 171,352 | 3.94x | ✅ | ✅ |
| **Zod** | 61,488 | 1.41x | ✅ | ✅ |
| **Luq** | 43,524 | 1.00x | ✅ | ✅ |
| **Luq (JsonSchema Full)** | 31,462 | 0.72x | ✅ | ✅ |
| **Luq (JsonSchema)** | 29,257 | 0.67x | ✅ | ✅ |
| **Joi** | 23,552 | 0.54x | ✅ | ✅ |
| **Yup** | 5,841 | 0.13x | ✅ | ✅ |

*Test Environment: AMD Ryzen 7 5825U, 5.8GB RAM, Node.js v22.12.0*

### The Practical Choice

**For production environments where you need:**
- ✅ Dynamic validation rules (from API/CMS)
- ✅ CSP compliance (no eval/Function)
- ✅ Type safety with existing TypeScript types
- ✅ Reasonable performance (faster than Yup/Joi)

**Luq is the most practical choice.**

**Note**: Performance numbers may vary with strict key validation. AJV's speed advantage comes at the cost of CSP compatibility.

## JSON Schema Support

Luq provides 100% JSON Schema Draft-07 support through a modular plugin system. You can import all necessary plugins at once or cherry-pick specific features.

### Quick Setup

```typescript
import { Builder } from "@maroonedog/luq";
import { jsonSchemaFullFeaturePlugin } from "@maroonedog/luq/plugins/jsonSchemaFullFeature";

// Single plugin import for full JSON Schema support
const validator = Builder()
  .use(jsonSchemaFullFeaturePlugin)
  .fromJsonSchema({
    type: "object",
    properties: {
      email: { type: "string", format: "email" },
      age: { type: "number", minimum: 18 },
    },
    required: ["email"],
  })
  .build();
```

### JSON Schema Support Summary

Luq provides **100% JSON Schema Draft-07 compliance** through modular plugins:

| Category | Coverage | Examples |
|----------|----------|----------|
| **Core Types** | ✅ Complete | string, number, boolean, null, array, object |
| **String Formats** | ✅ 15+ formats | email, url, uuid, date-time, ipv4/ipv6 |
| **Constraints** | ✅ All standard | min/max, pattern, unique, required |
| **Schema Composition** | ✅ Full support | allOf, anyOf, oneOf, not |
| **Advanced Features** | ✅ Complete | $ref, conditional validation, dependencies |

📖 **[View complete JSON Schema mapping →](https://luq.dev/json-schema)**

### Using Individual Plugins

If you prefer to import only the plugins you need:

```typescript
import { Builder } from "@maroonedog/luq";
import { jsonSchemaPlugin } from "@maroonedog/luq/plugins/jsonSchema";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";
import { stringEmailPlugin } from "@maroonedog/luq/plugins/stringEmail";
import { numberMinPlugin } from "@maroonedog/luq/plugins/numberMin";

const validator = Builder()
  .use(jsonSchemaPlugin)
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(stringEmailPlugin)
  .use(numberMinPlugin)
  .fromJsonSchema(schema)
  .build();
```

## The Journey to Universal Platform (Progressive Abstraction Architecture)

| Phase | Timeline | What We're Building | Impact |
|-------|----------|-------------------|---------|
| **Level 1** | ✅ Now | TypeScript validation library | **Foundation**: Type-first validation with plugin architecture |
| **Level 2** | Q1-Q3 2026 | .luq format & infrastructure | **Transformation**: Single source for models & validation |
| **v1.0** | Q4 2026 | Java support + production ready | **Expansion**: First multi-language release |
| **Level 3** | Beyond 2026 | Unified platform | **Vision**: API + models + validation + business logic |

### Roadmap Highlights

**Q4 2025**: Frontend framework integration (React hooks, etc.)
**Q1-Q3 2026**: .luq format specification, VSCode extension, Language Server
**Q4 2026**: **v1.0 Release with Java support & production toolchain**
**2027+**: Python, Go, C#, Rust + expanded platform features

### Current Capabilities (Phase 1)

```typescript
// Use existing TypeScript types
type User = {
  name: string;
  email: string;
  age: number;
};

// Add validation incrementally
const validator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(stringEmailPlugin)
  .use(numberMinPlugin)
  .for<User>()
  .v("name", (b) => b.string.required().min(3))
  .v("email", (b) => b.string.required().email())
  .v("age", (b) => b.number.required().min(18))
  .build();
```

### The .luq Format: Unified Model Definition Language (Phase 2)

**⚠️ CRITICAL DISTINCTION**: `.luq` is **NOT TypeScript**. It's a **TypeScript-like** language with its own syntax, compiler, and toolchain.

**What .luq actually is:**
- **Independent Language**: A domain-specific language (DSL) for API/model/validation definition
- **TypeScript-like Syntax**: Familiar syntax to reduce learning curve, but NOT TypeScript
- **Custom Compiler**: Our own parser, type checker, and code generator
- **No TypeScript Runtime**: Cannot import TypeScript modules or use TypeScript features directly
- **Purpose-Built**: Designed specifically for cross-language validation and API generation

**Why TypeScript-like (not TypeScript):**
```typescript
// ❌ This is NOT valid .luq (TypeScript features won't work)
interface Order {
  items: Array<Product>;  // ❌ TypeScript generics
  total: number | null;   // ❌ TypeScript union types
  created: Date;          // ❌ TypeScript Date type
}

// ✅ This is valid .luq (TypeScript-like but different)
interface Order {
  @array(Product)
  items: Product[];       // .luq array syntax
  
  @nullable
  total: number;          // .luq nullable decorator
  
  @datetime
  created: string;        // .luq uses string with format decorators
}
```

**What we're building:**
- **Custom VSCode extension**: NOT a TypeScript extension, but a completely new language support
- **Independent Language Server**: Our own LSP implementation, not TypeScript's
- **Dedicated Compiler**: .luq → multi-language code generation pipeline
- **Separate Type System**: Similar to TypeScript but with validation-specific semantics

**Key Language Features:**
- **Built-in adapters**: Standard database, cache, queue abstractions (primary approach)
- **Escape hatch imports**: Direct import of existing code when needed (language-specific)
- **Type checking**: Our own type system optimized for validation and code generation
- **Decorators**: First-class citizens in .luq (not experimental like TypeScript)
- **Validator functions**: Built into the language semantics
- **Cross-language semantics**: Designed to map cleanly to Java, Python, Go, etc.

**Primary Approach: Built-in Adapters (90% of use cases)**
```typescript
// order.luq - Use generated, standardized adapters

// Database adapter - generated for each target language
@database("postgresql")
adapter db {
  orders: Order[];
  customers: Customer[];
}

// Cache adapter
@cache("redis")
adapter cache {
  ttl: 3600;
}

// Use standardized interfaces in validation
@crossField
async function validateCustomerCredit(this: Order): Promise<ValidationResult> {
  // db.select() is generated in every target language
  const customer = await db.select(Customer)
    .where("id", this.customer.id)
    .first();
  
  const orderTotal = await db.select(Order)
    .where("customerId", customer.id)
    .sum("total");
  
  if (orderTotal + this.total > customer.creditLimit) {
    return error("Exceeds credit limit");
  }
  return ok();
}

// Generated standardized code for each language
// Each language uses its idiomatic patterns
// Users can choose their preferred framework
```

**Escape Hatch: Direct Imports (10% special cases)**
```typescript
// Only when you need existing business logic that can't be standardized

// Import existing Java service (escape hatch)
@importJava("../legacy/ComplexBusinessLogic.java")
import ComplexBusinessLogic;  

@validator
async function validateComplexRule(this: Order): Promise<ValidationResult> {
  // Use existing complex logic that can't be easily migrated
  return await ComplexBusinessLogic.validateWithLegacyRules(this);
}
```

**Why create a TypeScript-like language instead of using TypeScript?**
- **Familiar syntax**: Reduces learning curve for millions of developers
- **Purpose-built semantics**: Validation and API features as first-class citizens
- **Cross-language mapping**: Designed to generate clean code in Java, Python, Go, etc.
- **No JavaScript baggage**: Free from JS/TS runtime limitations and quirks
- **Validation-optimized**: Type system designed specifically for validation use cases

```typescript
// order.luq - Complete API & model definition in one place

// Standard adapters (recommended approach)
@database("postgresql")
adapter db {
  orders: Order[];
  customers: Customer[];
  products: Product[];
}

@cache("redis")
adapter cache {
  ttl: 3600;
}

// Import only for special cases (escape hatch)
import { calculateTotalFromItems } from "./business-logic";  // Legacy TypeScript
@importJava("../legacy/TaxCalculator.java")  // Legacy Java that can't be migrated
import TaxCalculator;

// API endpoint definition
@endpoint("/api/orders")
@authenticated
interface OrderAPI {
  @post("/")
  @rateLimit(100)
  create(body: CreateOrderRequest): OrderResponse;
  
  @get("/:id")
  @cache(300)
  getById(id: string): Order;
}

// Data model with validation
interface Order {
  @uuid()
  id: string;
  
  @required() @min(0) 
  @computed(calculateTotalFromItems)  // Use imported function
  total: number;
  
  @minLength(1) @maxLength(100)
  items: OrderItem[];
  
  @required()
  customer: {
    @required()
    id: string;
    
    @oneOf(["active", "suspended", "closed"])
    @validate(isActiveCustomer)  // Type-safe function reference
    status: string;
  };
}

// Cross-field validation - 'this' parameter for model context
@crossField
function validateDiscountEligibility(this: Order): ValidationResult {
  if (this.discount > 0 && !["gold", "platinum"].includes(this.customer.tier)) {
    return error("Discount requires gold or platinum tier");
  }
  return ok();
}

// Field-level validation with parameters
interface Product {
  @min(0) @max(1000000)  // Simple decorators with arguments
  price: number;
  
  @validate(validatePriceRange, 100, 50000)  // Function with additional params
  premiumPrice: number;
}

// Validator function that accepts additional parameters
function validatePriceRange(value: number, min: number, max: number): ValidationResult {
  if (value < min || value > max) {
    return error(`Price must be between ${min} and ${max}`);
  }
  return ok();
}

// Cross-field with async and this context
@crossField
async function validateInventory(this: Order): Promise<ValidationResult> {
  const available = await checkInventory(this.items);
  return available ? ok() : error("Insufficient inventory");
}

// Recommended: Use standard adapter
@crossField
async function validateCustomerCredit(this: Order): Promise<ValidationResult> {
  // Standard query interface - same in all generated languages
  const customer = await db.select(Customer)
    .where("id", this.customer.id)
    .include("orders")  // Eager loading
    .first();
  
  const totalOrders = customer.orders.reduce((sum, o) => sum + o.total, 0);
  return totalOrders + this.total <= customer.creditLimit 
    ? ok() 
    : error("Exceeds credit limit");
}

// Escape hatch: When you must use existing service
@crossField
async function validateTax(this: Order): Promise<ValidationResult> {
  // Use legacy Java service that can't be standardized
  const tax = await TaxCalculator.calculateComplexTax(this);
  return tax > 0 ? ok() : error("Invalid tax calculation");
}
```

**Decorator Signature Patterns:**
```typescript
// Pattern 1: Simple decorators with direct values
@min(0) @max(100)  // Built-in decorators
price: number;

// Pattern 2: Field validator with value as first parameter
@validate(isValidSKU)  // (value: string) => ValidationResult
sku: string;

// Pattern 3: Field validator with additional parameters
@validate(matchesPattern, /^SKU-\d{6}$/)  // (value: string, pattern: RegExp) => ValidationResult
productCode: string;

// Pattern 4: Cross-field validator with 'this' context
@crossField
function validateRelatedFields(this: Order): ValidationResult {
  // Access entire model via 'this'
  if (this.endDate <= this.startDate) {
    return error("End date must be after start date");
  }
  return ok();
}

// Pattern 5: Computed field with 'this' context
@computed
function calculateTotal(this: Order): number {
  return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
```

**What the .luq toolchain generates**:
- **Backend code**: Controllers, models, validators
- **Client SDKs**: Type-safe API clients
- **Documentation**: API specs in standard formats
- **Adapters**: Database and service integrations
- **Business logic**: Consistent across all platforms

## Real-World Example: Dynamic Validation

```typescript
// Common scenario: Load validation rules from API or CMS
async function loadValidationRules() {
  const rules = await fetch('/api/validation-rules').then(r => r.json());
  
  // ❌ AJV: Fails in production with CSP
  // const ajv = new Ajv();
  // const validate = ajv.compile(rules); // Uses new Function() internally
  
  // ❌ AJV Standalone: Can't handle dynamic schemas
  // Pre-compiled at build time, can't adapt to API response
  
  // ✅ Luq: Works everywhere, adapts at runtime
  const validator = Builder()
    .use(jsonSchemaFullFeaturePlugin)
    .fromJsonSchema(rules)
    .build();
  
  return validator;
}

// Multi-tenant SaaS with per-customer rules
async function getCustomerValidator(customerId: string) {
  const config = await getCustomerConfig(customerId);
  
  // Luq can safely build validators at runtime
  return Builder()
    .use(requiredPlugin)
    .use(customBusinessPlugin)
    .for<Order>()
    .v("total", b => b.number.min(config.minOrderValue))
    .v("items", b => b.array.maxLength(config.maxItems))
    .build();
}
```

## Technical Specifications

### Architecture Features

| Feature | Description | Impact |
|---------|-------------|--------|
| **AOT Compilation** | Pre-compile validators at build time | Eliminates runtime overhead |
| **Plugin System** | Modular validation rules | Tree-shaking support |
| **Zero Dependencies** | No external runtime dependencies | Predictable bundle size |
| **Type Safety** | Full TypeScript type inference | Compile-time error detection |

### Use Case Recommendations

| Scenario | Recommended Configuration | Rationale |
|----------|---------------------------|-----------|
| **CSP-restricted environments** | **Luq** | No eval/Function, full features |
| **Dynamic schema loading** | **Luq** | Safe runtime validation |
| **Existing TypeScript types** | **Luq** | No schema rewriting needed |
| **Custom business rules** | **Luq** | Type-safe plugin architecture |
| **JSON Schema migration** | Luq JsonSchema | Full compatibility, safe runtime |
| **Minimal bundle critical** | Valibot | 1-2KB solution |
| **Pre-compiled validation** | AJV Standalone | If schemas never change |

### Benchmark Methodology

- Test data: Simple (3 fields) and Complex (nested objects, arrays) schemas
- Iterations: 1,000,000 operations per benchmark
- Environment: AMD Ryzen 7 5825U, 5.8GB RAM, Node.js v22.12.0
- Details: See `bundle-size-comparison` directory

## Your Migration Path to Universal Platform

### Today - Level 1 (Available Now)
```typescript
// Start with validation using your existing TypeScript types
import { Builder } from "@maroonedog/luq";
const validator = Builder().for<Order>()
  .v("total", b => b.number.min(0))
  .build();
```

### 2026 Q1-Q3 - Level 2 (.luq Format)
```typescript
// Unified model & validation definitions
// order.luq
interface Order {
  @min(0) @businessRule("calculateTotal")
  total: number;
}
```

### 2026 Q4 - v1.0 (Java Support)
```bash
# Generate for TypeScript & Java
luq generate order.luq --lang=typescript --out=frontend/
luq generate order.luq --lang=java --out=backend/

# Generated code integrates with your existing stack
# No framework lock-in - use what you prefer
```

### Future - Level 3 (Unified Platform)
```typescript
// Complete API & model definition
// api.luq
@endpoint("/api/orders")
interface OrderAPI {
  @post("/") create(body: Order): OrderResponse;
  @get("/:id") getById(id: string): Order;
}
```

```bash
# Generate everything
luq generate api.luq --target=all

✓ Backend code generation
✓ Client SDK generation  
✓ API documentation
✓ Complete type safety across all targets
```

**Progressive Abstraction Architecture: Start simple, evolve to comprehensive.**

## Learn More

For detailed documentation, advanced examples, and roadmap:

**📖 [Documentation](https://luq.dev)** - Complete guides and API reference  
**🚀 [Roadmap](https://luq.dev/roadmap)** - Development timeline and future plans  
**🧩 [Plugins](https://luq.dev/plugins)** - Browse available plugins  
**💡 [Examples](https://luq.dev/guides)** - Real-world usage patterns

## License

MIT
