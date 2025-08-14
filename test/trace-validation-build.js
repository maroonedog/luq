// Trace validation build process
const luq = require("../dist/index.js");
const { Builder, requiredPlugin, arrayMinLengthPlugin } = luq;

console.log("=== Tracing Validation Build Process ===\n");

// Create builder
const builder = Builder().use(requiredPlugin).use(arrayMinLengthPlugin);

const fieldBuilder = builder.for();

console.log("1. Building field with detailed tracing...");

// Remove the monkey patch line - we'll trace directly

// Get field builder
const validator = fieldBuilder
  .field("tags", (b) => {
    console.log("2. Inside field definition function");

    // Get the array builder
    const arrayBuilder = b.array;
    console.log("   arrayBuilder type:", typeof arrayBuilder);
    console.log(
      "   arrayBuilder._validators length:",
      arrayBuilder._validators?.length || "undefined"
    );

    // Call required
    const requiredBuilder = arrayBuilder.required();
    console.log("   After .required():");
    console.log(
      "   - _validators length:",
      requiredBuilder._validators?.length || "undefined"
    );
    console.log("   - _validators content:", requiredBuilder._validators);

    // Call minLength
    const minLengthBuilder = requiredBuilder.minLength(1);
    console.log("   After .minLength(1):");
    console.log(
      "   - _validators length:",
      minLengthBuilder._validators?.length || "undefined"
    );
    console.log("   - _validators content:", minLengthBuilder._validators);

    // Check the final build result
    const built = minLengthBuilder.build();
    console.log("   Built result:");
    console.log("   - _validators:", built._validators);
    console.log("   - _transforms:", built._transforms);

    // Test each validator individually
    if (built._validators && built._validators.length > 0) {
      console.log("\n   Testing individual validators:");
      built._validators.forEach((validator, index) => {
        console.log(`   Validator ${index}:`, validator.name);
        console.log(`   - check function:`, typeof validator.check);

        if (validator.check) {
          try {
            const testEmpty = validator.check([], {});
            const testNonEmpty = validator.check(["item"], {});
            console.log(`   - check([]) =`, testEmpty);
            console.log(`   - check(['item']) =`, testNonEmpty);
          } catch (e) {
            console.log(`   - check function error:`, e.message);
          }
        }
      });
    }

    return minLengthBuilder;
  })
  .build();

console.log("\n3. Final validation test:");
let result = validator.validate({ tags: [] });
console.log("Empty array result:", result.isValid());

result = validator.validate({ tags: ["item"] });
console.log("Non-empty array result:", result.isValid());
