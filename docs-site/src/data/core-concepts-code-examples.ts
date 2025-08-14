export const coreConceptsExamples = {
  pluginComposition: `// Plugins compose naturally in the builder
const validator = Builder()
  .use(requiredPlugin)      // Provides .required()
  .use(stringMinPlugin)     // Provides .min()
  .use(stringEmailPlugin)   // Provides .email()
  .use(transformPlugin)     // Provides .transform()
  .for<User>()
  .v('email', b => 
    b.string
      .required()
      .email()
      .transform(email => email.toLowerCase())
  )
  .build();`,

  deepNested: `type Organization = {
  company: {
    details: {
      name: string;
      contact: {
        email: string;
        phone: string;
      };
    };
  };
};

const validator = Builder()
  .use(requiredPlugin)
  .use(stringEmailPlugin)
  .for<Organization>()
  .v('company.details.name', b => b.string.required())
  .v('company.details.contact.email', b => b.string.required().email())
  .v('company.details.contact.phone', b => b.string.required())
  .build();`,

  todoList: `type TodoList = {
  name: string;
  items: Array<{
    id: string;
    title: string;
    completed: boolean;
  }>;
};

const validator = Builder()
  .use(requiredPlugin)
  .use(arrayMinLengthPlugin)
  .for<TodoList>()
  .v('name', b => b.string.required())
  .v('items', b => b.array.required().minLength(1))
  // Individual array items can be validated too
  .v('items.*.id', b => b.string.required())
  .v('items.*.title', b => b.string.required())
  .v('items.*.completed', b => b.boolean.required())
  .build();`,

  methodAvailability: `// ❌ This won't work - plugin not imported
const validator = Builder()
  .for<User>()
  .v('email', b => b.string.email()) // TypeScript error: email() doesn't exist
  .build();

// ✅ This works - plugin imported and registered
import { stringEmailPlugin } from '@maroonedog/luq/plugins/stringEmail';

const validator = Builder()
  .use(stringEmailPlugin) // Now email() method is available
  .for<User>()
  .v('email', b => b.string.email()) // TypeScript knows about this method
  .build();`,

  typeSafeTransforms: `type FormInput = {
  age: string; // Form input as string
};

type ProcessedData = {
  age: number; // Processed as number
};

const validator = Builder()
  .use(requiredPlugin)
  .use(transformPlugin)
  .for<FormInput>()
  .v('age', b => 
    b.string
      .required()
      .transform((ageStr: string): number => {
        const age = parseInt(ageStr, 10);
        if (isNaN(age)) throw new Error('Invalid age');
        return age;
      })
  )
  .build();

// TypeScript knows the result type includes the transformation
const result = validator.validate({ age: "25" });
if (result.isValid()) {
  const data: ProcessedData = result.value; // age is now number
}`,

  errorStructure: `const result = validator.validate(invalidData);

if (!result.isValid()) {
  const errors = result.getErrors();
  
  errors.forEach(error => {
    console.log({
      path: error.path,        // "user.email"
      message: error.message,  // "Invalid email format"
      code: error.code,        // "stringEmail"
      value: error.value       // The actual invalid value
    });
  });
  
  // Structured error access
  const fieldErrors = result.getFieldErrors();
  // { "user.email": ["Invalid email format"], "age": ["Must be at least 18"] }
}`,

  customErrorMessages: `const validator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(stringEmailPlugin)
  .for<User>()
  .v('email', b => 
    b.string
      .required({ 
        message: 'Email address is required' 
      })
      .email({ 
        message: 'Please enter a valid email address' 
      })
  )
  .v('name', b => 
    b.string
      .required({ 
        message: 'Name is required' 
      })
      .min(2, { 
        message: 'Name must be at least 2 characters' 
      })
  )
  .build();`,

  organizeByDomain: `// validators/user.ts
export const userValidator = Builder()
  .use(...commonPlugins)
  .for<User>()
  .v('email', b => b.string.required().email())
  .v('name', b => b.string.required().min(2))
  .build();

// validators/product.ts  
export const productValidator = Builder()
  .use(...commonPlugins)
  .for<Product>()
  .v('name', b => b.string.required().min(1))
  .v('price', b => b.number.required().min(0))
  .build();

// validators/index.ts
export { userValidator } from './user';
export { productValidator } from './product';`,

  reusablePluginSets: `// plugins/sets.ts
export const basicValidation = [
  requiredPlugin,
  optionalPlugin,
];

export const stringValidation = [
  ...basicValidation,
  stringMinPlugin,
  stringMaxPlugin,
  stringEmailPlugin,
  stringPatternPlugin,
];

export const numericValidation = [
  ...basicValidation,
  numberMinPlugin,
  numberMaxPlugin,
  numberRangePlugin,
];

// Usage
const userValidator = Builder()
  .use(...stringValidation)
  .use(...numericValidation)
  .for<User>()
  .v('email', b => b.string.required().email())
  .v('age', b => b.number.required().min(0).max(120))
  .build();`,

  customBusinessPlugins: `// plugins/business-rules.ts
import { plugin } from '@maroonedog/luq';

export const productCodePlugin = plugin({
  name: 'productCode',
  methodName: 'productCode',
  allowedTypes: ['string'] as const,
  category: 'business',
  impl: (options?) => ({
    check: (value: string) => {
      const isValid = /^PROD-[A-Z0-9]{6}$/.test(value);
      return isValid
        ? { success: true, value }
        : { 
            success: false, 
            message: options?.messageFactory?.({ path: '', value }) || 
                     'Product code must be in format PROD-XXXXXX' 
          };
    }
  })
});

export const businessEmailPlugin = plugin({
  name: 'businessEmail',
  methodName: 'businessEmail',
  allowedTypes: ['string'] as const,
  category: 'business',
  impl: (options?) => ({
    check: (value: string) => {
      const isValid = !value.includes('@gmail.com') && !value.includes('@yahoo.com');
      return isValid
        ? { success: true, value }
        : { 
            success: false, 
            message: options?.messageFactory?.({ path: '', value }) || 
                     'Business email required (no personal email providers)' 
          };
    }
  })
});

// Usage
const businessValidator = Builder()
  .use(requiredPlugin)
  .use(productCodePlugin)
  .use(businessEmailPlugin)
  .for<BusinessData>()
  .v('productCode', b => b.string.required().productCode())
  .v('email', b => b.string.required().businessEmail())
  .build();`,
};