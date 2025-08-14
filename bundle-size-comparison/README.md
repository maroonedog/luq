# Bundle Size and Performance Comparison

Comprehensive benchmark comparing Luq (formerly FormTailor) with popular validation libraries.

## Libraries Compared

- **Luq** - TypeScript-first, plugin-based validation library
- **Luq JsonSchema** - Luq with JSON Schema support (individual plugins)
- **Luq JsonSchema Full** - Luq with all JSON Schema plugins bundled
- **Zod** - TypeScript-first schema declaration and validation
- **Zod JsonSchema Equivalent** - Zod schemas matching JSON Schema rules
- **Yup** - JavaScript schema builder for value parsing and validation
- **Valibot** - Modular and type-safe schema library
- **Joi** - Object schema validation
- **AJV** - JSON Schema validator
- **AJV Standalone** - Pre-compiled AJV validators

## Usage

```bash
# Install dependencies
npm install

# Run unified benchmark
npm run unified

# Run individual library benchmarks
npm run build
npm run compare
```
