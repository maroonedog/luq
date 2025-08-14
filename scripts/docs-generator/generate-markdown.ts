import { PluginAnnotation } from "./parse-annotations";

/**
 * Generate markdown documentation from plugin annotations
 */
export function generateMarkdown(
  annotations: Map<string, PluginAnnotation>
): string {
  const sections: string[] = [];

  // Header
  sections.push("# Luq Plugin Reference\n");
  sections.push("This document is auto-generated. Do not edit manually.\n");

  // Table of contents
  sections.push("## Table of Contents\n");

  // Group by category
  const byCategory = groupByCategory(annotations);

  for (const [category, plugins] of byCategory) {
    sections.push(`### ${getCategoryDisplayName(category)}\n`);
    for (const plugin of plugins) {
      sections.push(`- [${plugin.name}](#${plugin.name})`);
    }
    sections.push("");
  }

  // Plugin details
  sections.push("## Plugin Details\n");

  for (const [category, plugins] of byCategory) {
    sections.push(`### ${getCategoryDisplayName(category)}\n`);

    for (const plugin of plugins) {
      sections.push(generatePluginSection(plugin));
    }
  }

  return sections.join("\n");
}

function groupByCategory(
  annotations: Map<string, PluginAnnotation>
): Map<string, PluginAnnotation[]> {
  const grouped = new Map<string, PluginAnnotation[]>();

  for (const annotation of annotations.values()) {
    if (!grouped.has(annotation.category)) {
      grouped.set(annotation.category, []);
    }
    grouped.get(annotation.category)!.push(annotation);
  }

  // Sort plugins within each category
  for (const plugins of grouped.values()) {
    plugins.sort((a, b) => a.name.localeCompare(b.name));
  }

  return grouped;
}

function getCategoryDisplayName(category: string): string {
  const names: Record<string, string> = {
    standard: "Standard Validation",
    conditional: "Conditional Validation",
    transform: "Transform Plugins",
    composable: "Composable Plugins",
  };
  return names[category] || category;
}

function generatePluginSection(plugin: PluginAnnotation): string {
  const sections: string[] = [];

  // Plugin name as header
  sections.push(`#### ${plugin.name}\n`);

  // Deprecated warning
  if (plugin.deprecated) {
    sections.push(`> ⚠️ **Deprecated**: ${plugin.deprecated}\n`);
  }

  // Description
  sections.push(`**Description**: ${plugin.description}\n`);

  // Since version
  if (plugin.since) {
    sections.push(`**Since**: ${plugin.since}\n`);
  }

  // Allowed types
  sections.push("**Allowed Types**:");
  sections.push(plugin.allowedTypes.map((type) => `- \`${type}\``).join("\n"));
  sections.push("");

  // Usage example
  sections.push("**Usage Example**:");
  sections.push("```typescript");
  sections.push(plugin.example);
  sections.push("```\n");

  // Parameters
  if (plugin.params) {
    sections.push("**Parameters**:");
    sections.push(formatParams(plugin.params));
    sections.push("");
  }

  // Return value
  sections.push(`**Returns**: ${plugin.returns}\n`);

  // Custom error example
  if (plugin.customError) {
    sections.push("**Custom Error Message**:");
    sections.push("```typescript");
    sections.push(plugin.customError);
    sections.push("```\n");
  }

  sections.push("---\n");

  return sections.join("\n");
}

function formatParams(params: string): string {
  // Parse parameter list and format it nicely
  const lines = params
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines
    .map((line) => {
      if (line.startsWith("-")) {
        return line;
      }
      return `- ${line}`;
    })
    .join("\n");
}

/**
 * Generate a summary table of all plugins
 */
export function generateSummaryTable(
  annotations: Map<string, PluginAnnotation>
): string {
  const sections: string[] = [];

  sections.push("## Plugin Summary\n");
  sections.push("| Plugin Name | Category | Description | Allowed Types |");
  sections.push("|-------------|----------|-------------|---------------|");

  const sorted = Array.from(annotations.values()).sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  for (const plugin of sorted) {
    const types =
      plugin.allowedTypes.length > 3
        ? `${plugin.allowedTypes.slice(0, 3).join(", ")}, ...`
        : plugin.allowedTypes.join(", ");

    sections.push(
      `| ${plugin.name} | ${plugin.category} | ${plugin.description} | ${types} |`
    );
  }

  sections.push("");
  return sections.join("\n");
}
