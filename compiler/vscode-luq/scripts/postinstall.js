#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const { pipeline } = require('stream');
const { promisify } = require('util');
const zlib = require('zlib');
const tar = require('tar');

const streamPipeline = promisify(pipeline);

// Platform detection
function getPlatform() {
  const platform = process.platform;
  const arch = process.arch;
  
  if (platform === 'win32') {
    return arch === 'x64' ? 'win64' : 'win32';
  } else if (platform === 'darwin') {
    return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  } else if (platform === 'linux') {
    return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  }
  
  throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

// Get binary name for platform
function getBinaryName() {
  return process.platform === 'win32' ? 'luq-lsp.exe' : 'luq-lsp';
}

// Get the binary installation path
function getBinaryPath() {
  return path.join(__dirname, '..', 'bin', getBinaryName());
}

// Download binary from GitHub releases or other source
async function downloadBinary(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading LSP binary from ${url}...`);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        downloadBinary(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('Download complete');
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

// Try to build from source if download fails
async function buildFromSource() {
  console.log('Attempting to build from source...');
  
  const compilerDir = path.join(__dirname, '..', '..');
  const cargoPath = path.join(compilerDir, 'Cargo.toml');
  
  if (!fs.existsSync(cargoPath)) {
    throw new Error('Cannot find Cargo.toml for building from source');
  }
  
  try {
    // Check if Rust is installed
    execSync('cargo --version', { stdio: 'ignore' });
    
    console.log('Building LSP server with Cargo...');
    execSync('cargo build --release --bin luq-lsp', {
      cwd: compilerDir,
      stdio: 'inherit'
    });
    
    // Copy built binary to bin directory
    const targetBinary = path.join(
      compilerDir,
      'target',
      'release',
      getBinaryName()
    );
    
    if (fs.existsSync(targetBinary)) {
      const binDir = path.join(__dirname, '..', 'bin');
      if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
      }
      
      fs.copyFileSync(targetBinary, getBinaryPath());
      
      if (process.platform !== 'win32') {
        fs.chmodSync(getBinaryPath(), 0o755);
      }
      
      console.log('Build successful!');
      return true;
    }
  } catch (error) {
    console.error('Build from source failed:', error.message);
    return false;
  }
  
  return false;
}

// Main installation function
async function install() {
  const binDir = path.join(__dirname, '..', 'bin');
  const binaryPath = getBinaryPath();
  
  // Check if binary already exists
  if (fs.existsSync(binaryPath)) {
    console.log('LSP binary already installed at:', binaryPath);
    return;
  }
  
  // Create bin directory
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
  
  try {
    const platform = getPlatform();
    const version = require('../package.json').version;
    
    // TODO: Replace with actual release URL when binaries are published
    // For now, we'll try to build from source
    const releaseUrl = `https://github.com/maroonedog/luq/releases/download/v${version}/luq-lsp-${platform}.tar.gz`;
    
    // Try to download pre-built binary
    try {
      const tempFile = path.join(binDir, 'temp.tar.gz');
      await downloadBinary(releaseUrl, tempFile);
      
      // Extract the binary
      await tar.extract({
        file: tempFile,
        cwd: binDir
      });
      
      // Clean up temp file
      fs.unlinkSync(tempFile);
      
      // Make binary executable on Unix
      if (process.platform !== 'win32') {
        fs.chmodSync(binaryPath, 0o755);
      }
      
      console.log('LSP binary installed successfully at:', binaryPath);
    } catch (downloadError) {
      console.warn('Pre-built binary not available, attempting to build from source...');
      
      // Fall back to building from source
      const buildSuccess = await buildFromSource();
      
      if (!buildSuccess) {
        console.error(`
============================================
Failed to install Luq LSP binary.

Please build it manually:
1. Install Rust: https://rustup.rs/
2. Run: npm run build-lsp
3. Or run: cargo build --release --bin luq-lsp
============================================
        `);
      }
    }
  } catch (error) {
    console.error('Installation failed:', error);
    
    // Try to build from source as last resort
    await buildFromSource();
  }
}

// Run installation
if (require.main === module) {
  install().catch(console.error);
}

module.exports = { getBinaryPath, install };