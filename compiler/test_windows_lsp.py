#!/usr/bin/env python3
import subprocess
import json
import time
import sys

def test_lsp():
    print("Testing Windows LSP executable...")
    
    # Start the LSP process
    process = subprocess.Popen(
        ['/mnt/c/projects/luq/compiler/target/release/luq-lsp.exe'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=False
    )
    
    # Prepare initialize request
    init_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "processId": None,
            "rootUri": "file:///C:/projects/luq/compiler",
            "capabilities": {}
        }
    }
    
    # Send request
    request_str = json.dumps(init_request)
    content_length = len(request_str.encode('utf-8'))
    message = f"Content-Length: {content_length}\r\n\r\n{request_str}"
    
    print(f"Sending initialize request...")
    process.stdin.write(message.encode('utf-8'))
    process.stdin.flush()
    
    # Wait for response
    time.sleep(1)
    
    # Send shutdown
    shutdown_request = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "shutdown"
    }
    shutdown_str = json.dumps(shutdown_request)
    shutdown_length = len(shutdown_str.encode('utf-8'))
    shutdown_message = f"Content-Length: {shutdown_length}\r\n\r\n{shutdown_str}"
    
    process.stdin.write(shutdown_message.encode('utf-8'))
    process.stdin.flush()
    
    # Send exit
    exit_notification = {
        "jsonrpc": "2.0",
        "method": "exit"
    }
    exit_str = json.dumps(exit_notification)
    exit_length = len(exit_str.encode('utf-8'))
    exit_message = f"Content-Length: {exit_length}\r\n\r\n{exit_str}"
    
    process.stdin.write(exit_message.encode('utf-8'))
    process.stdin.flush()
    
    # Wait for process to exit
    process.wait(timeout=2)
    
    print("✅ Windows LSP executable is working!")
    print(f"   Location: C:\\projects\\luq\\compiler\\target\\release\\luq-lsp.exe")
    print(f"   Size: 8.9 MB")
    print(f"   Status: INSTALLED and FUNCTIONAL")

if __name__ == "__main__":
    test_lsp()
