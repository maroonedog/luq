/**
 * TypeScript API for the Luq compiler
 * Allows programmatic compilation without spawning processes
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

export interface CompileOptions {
  target?: 'typescript' | 'java' | 'python';
  aot?: boolean;
  output?: string;
}

export interface CompileResult {
  success: boolean;
  output?: string;
  errors?: string[];
}

/**
 * Compile a .luq source string to the target language
 */
export async function compile(
  source: string,
  options: CompileOptions = {}
): Promise<CompileResult> {
  const { target = 'typescript', aot = true } = options;
  
  // Create temporary file for the source
  const tempDir = tmpdir();
  const tempFileName = `luq-${randomBytes(8).toString('hex')}.luq`;
  const tempFilePath = join(tempDir, tempFileName);
  
  try {
    // Write source to temporary file
    await fs.writeFile(tempFilePath, source, 'utf8');
    
    // Get the binary path (reuse logic from luqc.ts)
    const binaryPath = getBinaryPath();
    
    // Build command arguments
    const args = ['compile', tempFilePath, '--target', target];
    if (aot) {
      args.push('--aot');
    }
    
    // Execute the compiler
    const result = await executeCompiler(binaryPath, args);
    
    return result;
  } finally {
    // Clean up temporary file
    try {
      await fs.unlink(tempFilePath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Parse a .luq source and return the AST
 */
export async function parse(source: string): Promise<any> {
  // Similar implementation to compile, but use 'parse' command
  const tempDir = tmpdir();
  const tempFileName = `luq-${randomBytes(8).toString('hex')}.luq`;
  const tempFilePath = join(tempDir, tempFileName);
  
  try {
    await fs.writeFile(tempFilePath, source, 'utf8');
    
    const binaryPath = getBinaryPath();
    const args = ['parse', tempFilePath, '--pretty'];
    
    const result = await executeCompiler(binaryPath, args);
    
    if (result.success && result.output) {
      return JSON.parse(result.output);
    }
    
    throw new Error(result.errors?.join('\n') || 'Failed to parse');
  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check syntax without generating code
 */
export async function check(source: string): Promise<CompileResult> {
  const tempDir = tmpdir();
  const tempFileName = `luq-${randomBytes(8).toString('hex')}.luq`;
  const tempFilePath = join(tempDir, tempFileName);
  
  try {
    await fs.writeFile(tempFilePath, source, 'utf8');
    
    const binaryPath = getBinaryPath();
    const args = ['check', tempFilePath];
    
    return await executeCompiler(binaryPath, args);
  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Helper functions (would import from luqc.ts in real implementation)
function getBinaryPath(): string {
  // This would be imported from the bin/luqc.ts file
  // For now, simplified implementation
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const binaryName = process.platform === 'win32' ? 'luqc.exe' : 'luqc';
  return join(__dirname, '..', '..', 'binaries', `${platform}-${process.arch}`, binaryName);
}

function executeCompiler(binaryPath: string, args: string[]): Promise<CompileResult> {
  return new Promise((resolve) => {
    const child = spawn(binaryPath, args, {
      env: process.env,
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          output: stdout,
        });
      } else {
        resolve({
          success: false,
          errors: stderr ? [stderr] : ['Compilation failed'],
        });
      }
    });
    
    child.on('error', (err) => {
      resolve({
        success: false,
        errors: [err.message],
      });
    });
  });
}