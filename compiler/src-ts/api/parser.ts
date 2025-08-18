/**
 * Luq Compiler Parser API
 *
 * Provides type-safe access to the Rust parser from Node.js
 */

import { execSync, spawnSync, spawn } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import type {
  Program,
  Statement,
  InterfaceStatement,
  Decorator,
  DecoratorArg,
  InterfaceMember,
  TypeAnnotation,
} from "../types/ast.js";

export interface ParseOptions {
  /**
   * Path to the luqc binary
   * If not provided, will try to find it in PATH or use local build
   */
  binaryPath?: string;

  /**
   * Whether to include location information in the AST
   */
  includeLocations?: boolean;

  /**
   * Whether to validate the AST after parsing
   */
  validate?: boolean;

  /**
   * Timeout for the parse operation in milliseconds
   */
  timeout?: number;
  
  /**
   * Number of threads to use for parallel processing
   * If not specified, uses all available CPU cores
   */
  threads?: number;
  
  /**
   * Enable parallel processing for batch operations
   */
  parallel?: boolean;
  
  /**
   * Enable performance metrics collection
   */
  metrics?: boolean;
}

export interface ParseResult {
  ast: Program;
  errors: ParseError[];
  warnings: ParseWarning[];
}

export interface ParseError {
  message: string;
  line?: number;
  column?: number;
  file?: string;
}

export interface ParseWarning {
  message: string;
  line?: number;
  column?: number;
  file?: string;
}

/**
 * Main parser class for Luq files
 */
export class LuqParser {
  private binaryPath: string;
  private options: ParseOptions;

  constructor(options: ParseOptions = {}) {
    this.options = options;
    this.binaryPath = this.resolveBinaryPath(options.binaryPath);
  }

  /**
   * Parse a Luq source string synchronously
   */
  public parse(source: string): ParseResult {
    try {
      const result = this.executeParse(source, "parse");
      const ast = JSON.parse(result) as Program;

      if (this.options.validate) {
        this.validateAST(ast);
      }

      return {
        ast,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      return this.handleParseError(error);
    }
  }

  /**
   * Parse a Luq file synchronously
   */
  public parseFile(filePath: string): ParseResult {
    const source = fs.readFileSync(filePath, "utf-8");
    const result = this.parse(source);

    // Add file information to errors/warnings
    result.errors.forEach((e) => (e.file = filePath));
    result.warnings.forEach((w) => (w.file = filePath));

    return result;
  }

  /**
   * Parse multiple Luq files synchronously
   */
  public parseFiles(filePaths: string[]): Map<string, ParseResult> {
    const results = new Map<string, ParseResult>();

    for (const filePath of filePaths) {
      results.set(filePath, this.parseFile(filePath));
    }

    return results;
  }

  /**
   * Parse a Luq source string asynchronously
   */
  public async parseAsync(source: string): Promise<ParseResult> {
    try {
      const result = await this.executeParseAsync(source, "parse");
      const ast = JSON.parse(result) as Program;

      if (this.options.validate) {
        this.validateAST(ast);
      }

      return {
        ast,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      return this.handleParseError(error);
    }
  }

  /**
   * Parse a Luq file asynchronously
   */
  public async parseFileAsync(filePath: string): Promise<ParseResult> {
    const source = await fs.promises.readFile(filePath, "utf-8");
    const result = await this.parseAsync(source);

    // Add file information to errors/warnings
    result.errors.forEach((e) => (e.file = filePath));
    result.warnings.forEach((w) => (w.file = filePath));

    return result;
  }

  /**
   * Parse multiple Luq files asynchronously in parallel
   */
  public async parseFilesAsync(
    filePaths: string[]
  ): Promise<Map<string, ParseResult>> {
    const promises = filePaths.map(async (filePath) => {
      const result = await this.parseFileAsync(filePath);
      return [filePath, result] as [string, ParseResult];
    });

    const results = await Promise.all(promises);
    return new Map(results);
  }

  /**
   * Execute the Rust parser binary
   */
  private executeParse(source: string, command: string): string {
    // Write source to a temporary file
    const tmpFile = `/tmp/luq_parse_${Date.now()}.luq`;
    fs.writeFileSync(tmpFile, source);

    try {
      const args = [];
      
      // Add thread configuration before command
      if (this.options.threads) {
        args.push('--threads', this.options.threads.toString());
      }
      
      if (this.options.parallel === false) {
        args.push('--no-parallel');
      }
      
      if (this.options.metrics) {
        args.push('--metrics');
      }
      
      // Add command and file
      args.push(command, tmpFile);

      const result = spawnSync(this.binaryPath, args, {
        encoding: "utf-8",
        timeout: this.options.timeout || 30000,
      });

      if (result.error) {
        throw new Error(`Failed to execute parser: ${result.error.message}`);
      }

      if (result.status !== 0) {
        const stderr = result.stderr || "Unknown error";
        throw new Error(
          `Parser failed with status ${result.status}: ${stderr}`
        );
      }

      return result.stdout;
    } finally {
      // Clean up temp file
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    }
  }

  /**
   * Resolve the path to the luqc binary
   */
  private resolveBinaryPath(providedPath?: string): string {
    if (providedPath && fs.existsSync(providedPath)) {
      return providedPath;
    }

    // Try to find in PATH
    try {
      const which = process.platform === "win32" ? "where" : "which";
      const result = execSync(`${which} luqc`, { encoding: "utf-8" }).trim();
      if (result && fs.existsSync(result)) {
        return result;
      }
    } catch {
      // Not in PATH, continue
    }

    // Try local build - look for the binary relative to cwd
    const cwd = process.cwd();
    const localPaths = [
      path.join(cwd, "target/release/luqc"),
      path.join(cwd, "target/debug/luqc"),
      path.join(cwd, "../target/release/luqc"),
      path.join(cwd, "../target/debug/luqc"),
    ];

    for (const localPath of localPaths) {
      if (fs.existsSync(localPath)) {
        return localPath;
      }
    }

    throw new Error(
      "Could not find luqc binary. Please build the Rust compiler or provide the binary path."
    );
  }

  /**
   * Validate the parsed AST
   */
  private validateAST(ast: Program): void {
    // Basic validation - can be extended
    if (!ast.statements) {
      throw new Error("Invalid AST: missing statements");
    }
  }

  /**
   * Execute the Rust parser binary asynchronously
   */
  private async executeParseAsync(
    source: string,
    command: string
  ): Promise<string> {
    // Write source to a temporary file
    const tmpFile = `/tmp/luq_parse_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.luq`;
    await fs.promises.writeFile(tmpFile, source, "utf8");

    try {
      return new Promise((resolve, reject) => {
        const args = [];
        
        // Add thread configuration before command
        if (this.options.threads) {
          args.push('--threads', this.options.threads.toString());
        }
        
        if (this.options.parallel === false) {
          args.push('--no-parallel');
        }
        
        if (this.options.metrics) {
          args.push('--metrics');
        }
        
        // Add command and file
        args.push(command, tmpFile);
        
        let stdout = "";
        let stderr = "";

        const child = spawn(this.binaryPath, args, {
          timeout: this.options.timeout || 30000,
        });

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("error", (error) => {
          reject(new Error(`Failed to execute parser: ${error.message}`));
        });

        child.on("close", (code) => {
          if (code === 0) {
            resolve(stdout);
          } else {
            reject(new Error(`Parser failed with status ${code}: ${stderr}`));
          }
        });
      });
    } finally {
      // Clean up temp file
      try {
        await fs.promises.unlink(tmpFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Handle parse errors
   */
  private handleParseError(error: any): ParseResult {
    const errorMessage = error.message || "Unknown parse error";

    // Try to extract line/column from error message
    const match = errorMessage.match(/line (\d+), column (\d+)/);
    const line = match ? parseInt(match[1]) : undefined;
    const column = match ? parseInt(match[2]) : undefined;

    return {
      ast: { statements: [] },
      errors: [
        {
          message: errorMessage,
          line,
          column,
        },
      ],
      warnings: [],
    };
  }
}
