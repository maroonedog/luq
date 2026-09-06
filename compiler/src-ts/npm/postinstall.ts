import { existsSync, mkdirSync, copyFileSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PackageMapping {
  [key: string]: string;
}

const packageMap: PackageMapping = {
  'darwin-x64': '@maroonedog/luq-compiler-darwin-x64',
  'darwin-arm64': '@maroonedog/luq-compiler-darwin-arm64',
  'linux-x64': '@maroonedog/luq-compiler-linux-x64',
  'linux-arm64': '@maroonedog/luq-compiler-linux-arm64',
  'win32-x64': '@maroonedog/luq-compiler-win32-x64',
};

function getPlatformPackage(): string | undefined {
  const platform = process.platform;
  const arch = process.arch;
  return packageMap[`${platform}-${arch}`];
}

function copyBinary(packageName: string): void {
  const binaryPackagePath = join(__dirname, '..', '..', 'node_modules', packageName);
  
  if (!existsSync(binaryPackagePath)) {
    console.warn(`Binary package ${packageName} not found`);
    return;
  }
  
  const isWindows = process.platform === 'win32';
  const binaryName = isWindows ? 'luqc.exe' : 'luqc';
  const sourceBinary = join(binaryPackagePath, 'bin', binaryName);
  
  if (!existsSync(sourceBinary)) {
    console.warn(`Binary not found in package: ${sourceBinary}`);
    return;
  }
  
  const platformDir = isWindows ? 'windows' : process.platform;
  const targetDir = join(__dirname, '..', '..', 'binaries', `${platformDir}-${process.arch}`);
  const targetBinary = join(targetDir, binaryName);
  
  // Create target directory
  mkdirSync(targetDir, { recursive: true });
  
  // Copy binary
  copyFileSync(sourceBinary, targetBinary);
  
  // Make it executable on Unix-like systems
  if (!isWindows) {
    chmodSync(targetBinary, 0o755);
  }
  
  console.log(`Binary installed successfully: ${targetBinary}`);
}

async function main(): Promise<void> {
  const packageName = getPlatformPackage();
  
  if (!packageName) {
    console.warn(`Warning: No prebuilt binary available for ${process.platform}-${process.arch}`);
    console.warn('You may need to build from source using: cargo build --release');
    process.exit(0);
  }
  
  console.log(`Installing platform-specific binary: ${packageName}`);
  
  try {
    copyBinary(packageName);
  } catch (error) {
    console.warn('Failed to set up platform binary:', error instanceof Error ? error.message : error);
    console.warn('You may need to build from source');
  }
}

main().catch((error) => {
  console.error('Postinstall failed:', error);
  process.exit(1);
});