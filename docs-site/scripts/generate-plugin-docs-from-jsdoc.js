import { readFile, writeFile, readdir } from "fs/promises";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = join(__dirname, "../../src/core/plugin");
const PLUGIN_INDEX = join(PLUGIN_DIR, "index.ts");
const OUTPUT_TS_FILE = join(__dirname, "../src/data/plugins.ts");
const OUTPUT_JSON_FILE = join(__dirname, "../src/data/plugins.json");

// Parse JSDoc block to extract tags
function parseJSDocBlock(jsdocBlock) {
  const result = {
    isLuqPlugin: false,
    name: "",
    category: "core",
    description: "",
    allowedTypes: [],
    examples: [],
    params: [],
    returns: "",
    customError: "",
    since: "",
  };

  // Check if this is a luq-plugin
  if (!jsdocBlock.includes("@luq-plugin")) {
    return result;
  }
  result.isLuqPlugin = true;

  // Extract simple tags
  const nameMatch = jsdocBlock.match(/@name\s+(\S+)/);
  if (nameMatch) result.name = nameMatch[1];

  const categoryMatch = jsdocBlock.match(/@category\s+(\S+)/);
  if (categoryMatch) result.category = categoryMatch[1];

  const descriptionMatch = jsdocBlock.match(/@description\s+(.+?)(?=\n\s*\*\s*@|\n\s*\*\/)/s);
  if (descriptionMatch) result.description = descriptionMatch[1].trim();

  const allowedTypesMatch = jsdocBlock.match(/@allowedTypes\s+(\[.+?\])/);
  if (allowedTypesMatch) {
    try {
      result.allowedTypes = JSON.parse(allowedTypesMatch[1]);
    } catch (e) {
      console.warn(`Failed to parse allowedTypes: ${allowedTypesMatch[1]}`);
    }
  }

  const returnsMatch = jsdocBlock.match(/@returns\s+(.+?)(?=\n\s*\*\s*@|\n\s*\*\/)/s);
  if (returnsMatch) result.returns = returnsMatch[1].trim();

  const sinceMatch = jsdocBlock.match(/@since\s+(\S+)/);
  if (sinceMatch) result.since = sinceMatch[1];

  // Extract examples (can be multiple)
  const exampleRegex = /@example\s*\n\s*\*\s*```typescript([\s\S]*?)```/g;
  let exampleMatch;
  while ((exampleMatch = exampleRegex.exec(jsdocBlock)) !== null) {
    const code = exampleMatch[1]
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, ""))
      .join("\n")
      .trim();
    
    // Try to extract title from the first comment line
    const titleMatch = code.match(/^\/\/\s*(.+)/);
    const title = titleMatch ? titleMatch[1] : `${result.name} Example`;
    
    result.examples.push({ title, code });
  }

  // Extract params
  const paramsMatch = jsdocBlock.match(/@params\s*([\s\S]*?)(?=\n\s*\*\s*@|\n\s*\*\/)/);
  if (paramsMatch) {
    const paramsText = paramsMatch[1];
    const paramRegex = /-\s*(\w+)(\?)?:\s*(.+?)\s*-\s*(.+)/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(paramsText)) !== null) {
      result.params.push({
        name: paramMatch[1],
        type: paramMatch[3],
        optional: !!paramMatch[2],
        description: paramMatch[4],
      });
    }
  }

  // Extract custom error example
  const customErrorMatch = jsdocBlock.match(/@customError\s*\n\s*\*\s*```typescript([\s\S]*?)```/);
  if (customErrorMatch) {
    result.customError = customErrorMatch[1]
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, ""))
      .join("\n")
      .trim();
  }

  return result;
}

// Parse TypeScript file to extract JSDoc comments
async function parsePluginFile(filePath) {
  const content = await readFile(filePath, "utf8");
  const plugins = [];

  // Find all JSDoc blocks followed by export const (handle both regular plugins and BuilderExtensionPlugin)
  // This regex matches:
  // 1. JSDoc block with @luq-plugin
  // 2. Optionally more JSDoc blocks or other content
  // 3. export const xxxPlugin with any type annotation
  const jsdocRegex = /\/\*\*([\s\S]*?@luq-plugin[\s\S]*?)\*\/[\s\S]*?export\s+const\s+(\w+Plugin)(?:\s*[:=])/g;
  let match;

  while ((match = jsdocRegex.exec(content)) !== null) {
    const jsdocBlock = match[1];
    const exportName = match[2];
    const parsed = parseJSDocBlock("/**" + jsdocBlock + "*/");

    if (parsed.isLuqPlugin) {
      // If name wasn't specified in JSDoc, derive it from export name
      if (!parsed.name && exportName.endsWith("Plugin")) {
        parsed.name = exportName.replace("Plugin", "");
      }

      // Extract methodName from plugin definition
      const pluginDefStart = content.indexOf(exportName, match.index);
      const pluginDefEnd = content.indexOf("});", pluginDefStart);
      const pluginDef = content.substring(pluginDefStart, pluginDefEnd);
      
      const methodNameMatch = pluginDef.match(/methodName:\s*["']([^"']+)["']/);
      const methodName = methodNameMatch ? methodNameMatch[1] : parsed.name;

      plugins.push({
        functionName: parsed.name,
        exportName: exportName,
        methodName: methodName,
        ...parsed,
      });
    }
  }

  return plugins;
}

// Get plugin metadata from JSDoc comments
async function getPluginsFromSource() {
  const plugins = [];
  
  // Read all .ts files in the plugin directory (excluding test files and utility files)
  const files = await readdir(PLUGIN_DIR);
  const pluginFiles = files.filter(file => 
    file.endsWith('.ts') && 
    !file.startsWith('__') && 
    !file.includes('test') &&
    !file.includes('util') &&
    !file.includes('shared') &&
    !file.includes('types') &&
    file !== 'index.ts'
  );

  console.log(`Found ${pluginFiles.length} plugin files`);

  // Parse each plugin file
  for (const file of pluginFiles) {
    const filePath = join(PLUGIN_DIR, file);
    try {
      const filePlugins = await parsePluginFile(filePath);
      plugins.push(...filePlugins);
    } catch (e) {
      console.warn(`Failed to parse ${file}: ${e.message}`);
    }
  }

  console.log(`Parsed ${plugins.length} plugins with JSDoc comments`);

  return plugins;
}

// Map category to display name (keep original category names)
function getCategoryDisplayName(category) {
  // For the new documentation system, we keep the original category names
  // instead of mapping them to different display names
  return category;
}

// Generate display name from function name or use methodName if available
function getDisplayName(plugin) {
  // If methodName is available, use it
  if (plugin.methodName) {
    return plugin.methodName;
  }
  
  // Otherwise, derive from functionName
  const functionName = plugin.functionName;
  const category = plugin.category;
  
  // For string/number/boolean/array categories, remove the prefix
  if (["string", "number", "boolean", "array"].includes(category)) {
    const prefix = category.charAt(0).toUpperCase() + category.slice(1);
    if (functionName.startsWith(category)) {
      return functionName.substring(category.length).charAt(0).toLowerCase() + 
             functionName.substring(category.length + 1);
    }
  }
  return functionName;
}

// Extract a complete usage example from code
function extractUsageExample(plugin) {
  if (!plugin.examples || plugin.examples.length === 0) {
    // Generate a default usage based on plugin type
    const methodName = getDisplayName(plugin);
    if (plugin.category === 'conditional' || plugin.category === 'advanced') {
      return `.v("field", b => b.string.${methodName}(...))`;
    }
    return `builder.v("field", b => b.string.${methodName}())`;
  }
  
  const code = plugin.examples[0].code;
  const lines = code.split('\n');
  
  // Look for usage patterns in order of preference
  const patterns = [
    /\.v\([^)]*\)/,              // .v("field", ...)
    /\.field\([^)]*\)/,          // .v("field", ...)
    /builder\.v\([^)]*\)/,       // builder.v("field", ...)
    /builder\.field\([^)]*\)/,   // builder.v("field", ...)
  ];
  
  // First, try to find a simple one-line usage
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comment lines
    if (trimmed.startsWith('//')) continue;
    
    // Check for .v( or .v( patterns
    if (trimmed.includes('.v(') || trimmed.includes('.v(')) {
      // For multi-line statements, try to capture the complete statement
      if (trimmed.includes('=>') && trimmed.includes(plugin.methodName || plugin.name)) {
        // Extract starting from .v( or .v( to the end of the line
        const match = trimmed.match(/\.(v|field)\([^)]*\)\s*$/);
        if (match) {
          return trimmed;
        }
        
        // If it's a partial statement, try to complete it
        const startMatch = trimmed.match(/\.(v|field)\("[\w.[\]*]+",\s*(?:\()?b\s*=>/);
        if (startMatch) {
          // Look for the plugin method in this or following lines
          let statement = trimmed;
          const startIdx = lines.indexOf(line);
          
          // Collect lines until we find the closing parenthesis
          for (let j = startIdx; j < Math.min(startIdx + 5, lines.length); j++) {
            const nextLine = lines[j].trim();
            if (j > startIdx) {
              statement += ' ' + nextLine;
            }
            
            // Check if we have a complete statement
            if (statement.includes(plugin.methodName || plugin.name)) {
              // Clean up the statement
              statement = statement.replace(/\s+/g, ' ').trim();
              
              // Extract just the .v() or .v() part
              const simpleMatch = statement.match(/\.(v|field)\([^)]+\)[^)]*\)/);
              if (simpleMatch) {
                return simpleMatch[0];
              }
            }
          }
        }
      }
    }
    
    // Check for builder.v( or builder.v( patterns
    if (trimmed.includes('builder.v(') || trimmed.includes('builder.v(')) {
      if (trimmed.includes(plugin.methodName || plugin.name)) {
        return trimmed.replace(/^\s*/, '');
      }
    }
  }
  
  // Fallback: generate based on plugin metadata
  const methodName = getDisplayName(plugin);
  const category = plugin.category;
  
  // Generate appropriate usage based on category
  if (category === 'transform') {
    return `.v("field", b => b.string.${methodName}(value => transformedValue))`;
  } else if (category === 'conditional') {
    return `.v("field", b => b.string.${methodName}(condition))`;
  } else if (category === 'preprocessor') {
    return `builder.v("field", b => b.string.${methodName}(defaultValue))`;
  } else if (plugin.params && plugin.params.length > 0) {
    const paramHints = plugin.params.map(p => {
      if (p.type.includes('number')) return '10';
      if (p.type.includes('string')) return '"value"';
      if (p.type.includes('boolean')) return 'true';
      if (p.type.includes('function')) return '(v) => v';
      return '...';
    }).join(', ');
    return `builder.v("field", b => b.string.${methodName}(${paramHints}))`;
  }
  
  return `builder.v("field", b => b.string.${methodName}())`;
}

// Get default types from category
function getTypesFromCategory(category) {
  const typeMap = {
    standard: ["string", "number", "boolean", "array", "object", "date", "union", "tuple"],
    conditional: ["string", "number", "boolean", "array", "object", "date", "union", "tuple"],
    transform: ["string", "number", "boolean", "array", "object", "date"],
    fieldReference: ["string", "number", "boolean", "array", "object", "date"],
    arrayElement: ["array"],
    array: ["array"],
    string: ["string"],
    number: ["number"],
    boolean: ["boolean"],
    object: ["object"],
    date: ["date"],
    context: ["string", "number", "boolean", "array", "object", "date", "union", "tuple"],
    preprocessor: ["string", "number", "boolean", "array", "object", "date"],
    composable: ["string", "number", "boolean", "array", "object", "date", "union", "tuple"],
    "composable-conditional": ["string", "number", "boolean", "array", "object", "date", "union", "tuple"],
    "composable-directly": ["string", "number", "boolean", "array", "object", "date", "union", "tuple"],
    "builder-extension": ["string", "number", "boolean", "array", "object", "date", "union", "tuple"],
    advanced: ["string", "number", "boolean", "array", "object", "date", "union", "tuple"],
  };
  return typeMap[category] || ["any"];
}

// Generate TypeScript file content
function generateTypeScriptContent(plugins) {
  const pluginCategories = {};
  const seen = new Set();

  plugins.forEach(plugin => {
    const categoryDisplay = getCategoryDisplayName(plugin.category);
    if (!seen.has(categoryDisplay)) {
      pluginCategories[plugin.category] = categoryDisplay;
      seen.add(categoryDisplay);
    }
  });

  const pluginData = plugins.map(plugin => ({
    functionName: plugin.functionName,
    displayName: getDisplayName(plugin),
    category: getCategoryDisplayName(plugin.category),
    description: plugin.description,
    usage: extractUsageExample(plugin),
    supportedTypes: plugin.allowedTypes.length > 0 ? 
      plugin.allowedTypes : 
      getTypesFromCategory(plugin.category),
    parameters: plugin.params,
    examples: plugin.examples,
    returns: plugin.returns,
  }));

  return `// This file is auto-generated by generate-plugin-docs-from-jsdoc.js
// Do not edit manually!

export interface PluginInfo {
  functionName: string;
  displayName: string;
  category: string;
  description: string;
  usage: string;
  supportedTypes?: string[];
  parameters?: Array<{
    name: string;
    type: string;
    description: string;
    optional?: boolean;
  }>;
  examples: Array<{
    title: string;
    code: string;
  }>;
  returns?: string;
}

export const pluginCategories = ${JSON.stringify(pluginCategories, null, 2)} as const;

export const plugins: PluginInfo[] = ${JSON.stringify(pluginData, null, 2)};
`;
}

// Generate JSON data for builder generator
function generateJSONData(plugins) {
  const pluginCategories = {};
  const seen = new Set();

  plugins.forEach(plugin => {
    const categoryDisplay = getCategoryDisplayName(plugin.category);
    if (!seen.has(categoryDisplay)) {
      pluginCategories[plugin.category] = categoryDisplay;
      seen.add(categoryDisplay);
    }
  });

  return {
    plugins: plugins.map((plugin) => ({
      name: plugin.exportName || `${plugin.functionName}Plugin`,
      methodName: getDisplayName(plugin),
      displayName: getDisplayName(plugin),
      description: plugin.description,
      category: getCategoryDisplayName(plugin.category),
      usage: extractUsageExample(plugin),
      parameters: plugin.params,
      examples: plugin.examples,
      returns: plugin.returns,
      supportedTypes: plugin.allowedTypes.length > 0 ? 
        plugin.allowedTypes : 
        getTypesFromCategory(plugin.category),
    })),
    categories: pluginCategories,
    metadata: {
      totalPlugins: plugins.length,
      categoriesCount: Object.keys(pluginCategories).length,
      generatedAt: new Date().toISOString(),
      version: "1.0.0",
    },
  };
}

async function main() {
  try {
    console.log("🔄 Parsing JSDoc comments from plugin source files...");

    // Get plugins from source files
    const plugins = await getPluginsFromSource();
    console.log(`📦 Found ${plugins.length} plugins with JSDoc comments`);

    // Generate TypeScript content
    const tsContent = generateTypeScriptContent(plugins);
    await writeFile(OUTPUT_TS_FILE, tsContent, "utf8");
    console.log(`✅ Generated TypeScript file: ${OUTPUT_TS_FILE}`);

    // Generate JSON data
    const jsonData = generateJSONData(plugins);
    await writeFile(
      OUTPUT_JSON_FILE,
      JSON.stringify(jsonData, null, 2),
      "utf8"
    );
    console.log(`✅ Generated JSON file: ${OUTPUT_JSON_FILE}`);

    // Show category breakdown
    const categoryBreakdown = {};
    plugins.forEach((plugin) => {
      const category = plugin.category;
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
    });

    console.log("\n📊 Category breakdown:");
    Object.entries(categoryBreakdown).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} plugins`);
    });

    console.log("\n📝 Plugins with examples:");
    plugins.forEach(plugin => {
      if (plugin.examples.length > 0) {
        console.log(`   ${plugin.functionName}: ${plugin.examples.length} example(s)`);
      }
    });
  } catch (error) {
    console.error("❌ Error generating plugin documentation:", error);
    process.exit(1);
  }
}

main();