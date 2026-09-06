#!/usr/bin/env python3
"""Test LSP functionality with the new chumsky+logos parser"""

import json
import subprocess
import time
import sys
import os

def send_request(proc, request):
    """Send a JSON-RPC request to the LSP server"""
    content = json.dumps(request)
    message = f"Content-Length: {len(content)}\r\n\r\n{content}"
    proc.stdin.write(message.encode())
    proc.stdin.flush()

def read_response(proc):
    """Read a JSON-RPC response from the LSP server"""
    # Read headers
    headers = {}
    while True:
        line = proc.stdout.readline().decode().strip()
        if not line:
            break
        if ':' in line:
            key, value = line.split(':', 1)
            headers[key.strip()] = value.strip()
    
    # Read content
    if 'Content-Length' in headers:
        content_length = int(headers['Content-Length'])
        content = proc.stdout.read(content_length).decode()
        return json.loads(content)
    return None

def test_lsp():
    """Test the LSP server"""
    print("Starting LSP server...")
    
    # Start the LSP server
    proc = subprocess.Popen(
        ['cargo', 'run', '--bin', 'luq-lsp'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd='/mnt/c/projects/luq/compiler'
    )
    
    time.sleep(2)  # Wait for server to start
    
    try:
        # Initialize
        print("Sending initialize request...")
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "processId": os.getpid(),
                "capabilities": {
                    "textDocument": {
                        "hover": {"contentFormat": ["plaintext", "markdown"]},
                        "completion": {"completionItem": {"snippetSupport": True}},
                        "publishDiagnostics": {"relatedInformation": True}
                    }
                },
                "rootUri": "file:///mnt/c/projects/luq/compiler",
                "workspaceFolders": [{
                    "uri": "file:///mnt/c/projects/luq/compiler",
                    "name": "compiler"
                }]
            }
        }
        send_request(proc, init_request)
        response = read_response(proc)
        print(f"Initialize response: {json.dumps(response, indent=2)}")
        
        # Send initialized notification
        initialized = {
            "jsonrpc": "2.0",
            "method": "initialized",
            "params": {}
        }
        send_request(proc, initialized)
        
        # Open a document
        print("\nOpening test document...")
        test_file = "/mnt/c/projects/luq/compiler/test-lsp-functionality.luq"
        with open(test_file, 'r') as f:
            content = f.read()
        
        did_open = {
            "jsonrpc": "2.0",
            "method": "textDocument/didOpen",
            "params": {
                "textDocument": {
                    "uri": f"file://{test_file}",
                    "languageId": "luq",
                    "version": 1,
                    "text": content
                }
            }
        }
        send_request(proc, did_open)
        
        # Wait for diagnostics
        print("\nWaiting for diagnostics...")
        time.sleep(1)
        
        # Test hover
        print("\nTesting hover on 'validateUser' function...")
        hover_request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "textDocument/hover",
            "params": {
                "textDocument": {
                    "uri": f"file://{test_file}"
                },
                "position": {
                    "line": 4,  # Line with 'function validateUser'
                    "character": 10
                }
            }
        }
        send_request(proc, hover_request)
        hover_response = read_response(proc)
        if hover_response:
            print(f"Hover response: {json.dumps(hover_response, indent=2)}")
        
        # Test completion
        print("\nTesting completion...")
        completion_request = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "textDocument/completion",
            "params": {
                "textDocument": {
                    "uri": f"file://{test_file}"
                },
                "position": {
                    "line": 6,  # Inside function body
                    "character": 8
                }
            }
        }
        send_request(proc, completion_request)
        completion_response = read_response(proc)
        if completion_response:
            print(f"Completion response: {json.dumps(completion_response, indent=2)}")
        
        # Shutdown
        print("\nShutting down...")
        shutdown_request = {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "shutdown",
            "params": None
        }
        send_request(proc, shutdown_request)
        
        # Exit
        exit_notification = {
            "jsonrpc": "2.0",
            "method": "exit",
            "params": None
        }
        send_request(proc, exit_notification)
        
        print("\nTest completed successfully!")
        
    except Exception as e:
        print(f"Error during test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    # First check if the binary builds
    print("Building LSP binary...")
    result = subprocess.run(
        ['cargo', 'build', '--bin', 'luq-lsp'],
        cwd='/mnt/c/projects/luq/compiler',
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print("Failed to build LSP binary")
        print("STDERR:", result.stderr[-2000:])  # Last 2000 chars of error
        sys.exit(1)
    
    print("LSP binary built successfully!")
    test_lsp()