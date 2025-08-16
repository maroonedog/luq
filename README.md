<div align="center">
  <img src="./public/img/library_image.png" alt="Luq Logo" width="300" />
  
  # Luq - Universal Model & API Definition Platform

[![npm version](https://img.shields.io/npm/v/@maroonedog/luq.svg)](https://www.npmjs.com/package/@maroonedog/luq)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Documentation](https://img.shields.io/badge/docs-luq.dev-purple)](https://luq.dev)

**TypeScript validation today → Universal platform tomorrow**

</div>

## Quick Start

```bash
npm install @maroonedog/luq@alpha
```

```typescript
import { Builder } from "@maroonedog/luq";
import { requiredPlugin, stringMinPlugin, numberMinPlugin, stringEmailPlugin } from "@maroonedog/luq/plugins";

// Use your existing TypeScript types
type User = {
  name: string;
  age: number;
  email: string;
};

// Add validation without changing your types
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

const result = validateUser({ name: "John", age: 25, email: "john@example.com" });
if (!result.valid) {
  console.log(result.issues); // Type-safe error details
}
```

## Why Luq?

### Today's Problem
You write the same validation logic three times:
- Frontend (TypeScript)
- Backend (Java/Python/Go)
- Mobile (Swift/Kotlin)

Each implementation drifts apart. Bugs multiply. Business rules become inconsistent.

### Luq's Solution
1. **Today**: Type-safe TypeScript validation that works with your existing types
2. **Tomorrow**: Define once in `.luq`, generate validators for every language
3. **Future**: Complete API & model platform

### Key Features
✅ **Works with existing TypeScript types** - No schema rewriting  
✅ **CSP-safe** - No eval/Function, works everywhere (unlike AJV)  
✅ **Dynamic validation** - Load rules from API/CMS at runtime  
✅ **Tree-shakeable plugins** - Only pay for what you use (19-23KB gzipped)  
✅ **100% JSON Schema compatible** - Easy migration path  
✅ **Business logic as plugins** - Reusable, type-safe validation rules

## JSON Schema Support

```typescript
import { jsonSchemaFullFeaturePlugin } from "@maroonedog/luq/plugins/jsonSchemaFullFeature";

// Full JSON Schema Draft-07 support with one plugin
const validator = Builder()
  .use(jsonSchemaFullFeaturePlugin)
  .fromJsonSchema({
    type: "object",
    properties: {
      email: { type: "string", format: "email" },
      age: { type: "number", minimum: 18 }
    },
    required: ["email"]
  })
  .build();
```

📖 **[View complete JSON Schema mapping →](https://luq.dev/json-schema)**

## Dynamic Validation (Production Ready)

```typescript
// Load validation rules from API/CMS at runtime
async function loadValidator() {
  const schema = await fetch('/api/validation-rules').then(r => r.json());
  
  // ✅ Works in CSP-restricted environments (unlike AJV)
  // ✅ Adapts to dynamic schemas at runtime
  return Builder()
    .use(jsonSchemaFullFeaturePlugin)
    .fromJsonSchema(schema)
    .build();
}
```

## Custom Business Logic

```typescript
import { plugin } from "@maroonedog/luq/core/builder/plugins/plugin-creator";

// Create reusable, type-safe business rules
const productCodePlugin = plugin({
  name: "productCode",
  methodName: "productCode",
  allowedTypes: ["string"],
  category: "custom",
  impl: (options?: { messageFactory?: (ctx: any) => string }) => ({
    check: (value: any) => {
      if (typeof value !== "string") return true;
      return value.startsWith("PROD-") && value.length === 10;
    },
    code: "productCode",
    getErrorMessage: (value: any, path: string) => 
      options?.messageFactory?.({ path, value }) || 
      `Invalid product code format (must be PROD-XXXXX)`,
    params: [options]
  })
});

// Use across your application
const validator = Builder()
  .use(productCodePlugin)
  .for<Product>()
  .v("code", b => b.string.productCode())
  .build();
```

## Roadmap

| Phase | Timeline | Status | What |
|-------|----------|--------|------|
| **Level 1** | Now | ✅ Released | TypeScript validation library |
| **Level 2** | Q1-Q3 2026 | 🚧 Development | `.luq` format - TypeScript-like DSL |
| **v1.0** | Q4 2026 | 📅 Planned | Java support + production tooling |
| **Level 3** | 2027+ | 🔮 Vision | Complete API/model platform |

### Future Vision: .luq Format (2026)

```typescript
// order.luq - Define once, generate everywhere
interface Order {
  @min(0) @computed(calculateTotal)
  total: number;
  
  @minLength(1)
  items: Product[];
  
  @crossField
  validateDiscount(this: Order): ValidationResult {
    if (this.discount > 0 && this.customer.tier !== "gold") {
      return error("Discount requires gold tier");
    }
    return ok();
  }
}
```

Generate for any language:
```bash
luq generate order.luq --lang=java --out=backend/
luq generate order.luq --lang=typescript --out=frontend/
```

> **Note**: `.luq` is a TypeScript-like DSL, not TypeScript. Custom toolchain with VSCode extension coming in 2026.

## Performance

**Bundle size**: 19-23KB gzipped (tree-shakeable)  
**Speed**: 1.2M ops/sec (simple), 43K ops/sec (complex)  
**CSP-safe**: Works in all environments (no eval/Function)  
**Dynamic**: Can load validation rules at runtime

📊 **[View detailed benchmarks →](https://luq.dev/benchmarks)**

## Documentation

📖 **[Complete Documentation](https://luq.dev)** - Guides, API reference, examples  
🚀 **[Getting Started](https://luq.dev/docs/getting-started)** - Step-by-step tutorial  
🧩 **[Plugin Catalog](https://luq.dev/plugins)** - Browse 40+ built-in plugins  
💡 **[Examples](https://luq.dev/examples)** - Real-world usage patterns  
🗺️ **[Roadmap](https://luq.dev/roadmap)** - Detailed timeline and vision

## Installation Options

```bash
# Core library only
npm install @maroonedog/luq@alpha

# With specific plugins
npm install @maroonedog/luq@alpha
# Then import only what you need:
# import { requiredPlugin } from "@maroonedog/luq/plugins/required"
# import { stringEmailPlugin } from "@maroonedog/luq/plugins/stringEmail"
```

## License

MIT

---

<sub>Built with ❤️ for developers tired of writing validation three times</sub>