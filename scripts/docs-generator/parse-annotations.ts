import ts from "typescript";
import fs from "fs";
import path from "path";

export interface PluginAnnotation {
  name: string;
  category: "standard" | "conditional" | "transform" | "composable";
  description: string;
  allowedTypes: string[];
  example: string;
  params?: string;
  returns: string;
  customError?: string;
  since?: string;
  deprecated?: string;
}

/**
 * Parse @luq-plugin annotations from a TypeScript file
 */
export function parsePluginAnnotations(
  filePath: string
): PluginAnnotation | null {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  let pluginAnnotation: PluginAnnotation | null = null;

  function visit(node: ts.Node) {
    // Check all nodes for JSDoc comments
    const jsDocComment = getJSDocComment(node);
    if (jsDocComment && jsDocComment.includes("@luq-plugin")) {
      pluginAnnotation = parseAnnotationContent(jsDocComment);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return pluginAnnotation;
}

function getJSDocComment(node: ts.Node): string | null {
  const sourceFile = node.getSourceFile();
  const leadingCommentRanges = ts.getLeadingCommentRanges(
    sourceFile.getFullText(),
    node.getFullStart()
  );

  if (!leadingCommentRanges || leadingCommentRanges.length === 0) {
    return null;
  }

  // Check all comments, not just the last one
  for (const comment of leadingCommentRanges) {
    const commentText = sourceFile
      .getFullText()
      .slice(comment.pos, comment.end);
    // Check if it's a JSDoc comment
    if (commentText.startsWith("/**") && commentText.includes("@luq-plugin")) {
      return commentText;
    }
  }

  return null;
}

function parseAnnotationContent(comment: string): PluginAnnotation | null {
  const lines = comment
    .split("\n")
    .map((line) => line.trim().replace(/^\* ?/, ""));

  const annotation: Partial<PluginAnnotation> = {};
  let currentTag = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    if (
      line.startsWith("@") &&
      line.match(
        /^@(luq-plugin|name|category|description|allowedTypes|example|params|returns|customError|since|deprecated)/
      )
    ) {
      // Save previous tag content
      if (currentTag && currentTag !== "luq-plugin") {
        saveTagContent(
          annotation,
          currentTag,
          currentContent.join("\n").trim()
        );
      }

      // Start new tag
      const tagMatch = line.match(/^@(\w+(?:-\w+)?)(?:\s+(.*))?$/);
      if (tagMatch) {
        currentTag = tagMatch[1];
        currentContent = tagMatch[2] ? [tagMatch[2]] : [];
      }
    } else if (currentTag && currentTag !== "luq-plugin") {
      currentContent.push(line);
    }
  }

  // Save last tag
  if (currentTag && currentTag !== "luq-plugin") {
    saveTagContent(annotation, currentTag, currentContent.join("\n").trim());
  }

  // Validate required fields
  if (
    !annotation.name ||
    !annotation.category ||
    !annotation.description ||
    !annotation.allowedTypes ||
    !annotation.example ||
    !annotation.returns
  ) {
    // Missing required fields
    return null;
  }

  return annotation as PluginAnnotation;
}

function saveTagContent(
  annotation: Partial<PluginAnnotation>,
  tag: string,
  content: string
) {
  switch (tag) {
    case "name":
      annotation.name = content;
      break;
    case "category":
      annotation.category = content as PluginAnnotation["category"];
      break;
    case "description":
      annotation.description = content;
      break;
    case "allowedTypes":
      try {
        annotation.allowedTypes = JSON.parse(content);
      } catch {
        annotation.allowedTypes = [];
      }
      break;
    case "example":
      annotation.example = cleanCodeBlock(content);
      break;
    case "params":
      annotation.params = content;
      break;
    case "returns":
      annotation.returns = content;
      break;
    case "customError":
      annotation.customError = cleanCodeBlock(content);
      break;
    case "since":
      annotation.since = content;
      break;
    case "deprecated":
      annotation.deprecated = content;
      break;
  }
}

function cleanCodeBlock(content: string): string {
  // Remove leading/trailing code block markers if present
  return content
    .replace(/^```\w*\n/, "")
    .replace(/\n```$/, "")
    .trim();
}

/**
 * Parse all plugin files in a directory
 */
export function parseAllPlugins(
  pluginDir: string
): Map<string, PluginAnnotation> {
  const annotations = new Map<string, PluginAnnotation>();

  const files = fs.readdirSync(pluginDir);

  for (const file of files) {
    if (
      file.endsWith(".ts") &&
      !file.endsWith(".test.ts") &&
      !file.endsWith(".d.ts")
    ) {
      const filePath = path.join(pluginDir, file);
      const annotation = parsePluginAnnotations(filePath);
      if (annotation) {
        annotations.set(annotation.name, annotation);
      }
    }
  }

  return annotations;
}
