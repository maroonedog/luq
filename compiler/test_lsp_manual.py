#!/usr/bin/env python3
"""
Manual LSP test to debug completion issues
"""

import json
import subprocess
import sys

def send_request(process, request):
    """Send a request to the LSP server"""
    content = json.dumps(request)
    message = f"Content-Length: {len(content)}\r\n\r\n{content}"
    process.stdin.write(message.encode('utf-8'))
    process.stdin.flush()
    print(f"Sent: {request['method']}")

def read_response(process):
    """Read a response from the LSP server"""
    # Read headers
    headers = {}
    while True:
        line = process.stdout.readline().decode('utf-8').strip()
        if not line:
            break
        if ':' in line:
            key, value = line.split(':', 1)
            headers[key.strip()] = value.strip()
    
    # Read content
    if 'Content-Length' in headers:
        content_length = int(headers['Content-Length'])
        content = process.stdout.read(content_length).decode('utf-8')
        return json.loads(content)
    return None

def main():
    lsp_path = "/mnt/c/projects/luq/compiler/luq-lsp.exe"
    
    print(f"Starting LSP server: {lsp_path}\n")
    process = subprocess.Popen(
        [lsp_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=False
    )
    
    try:
        # Initialize
        print("=== Initialize ===")
        send_request(process, {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "processId": None,
                "rootUri": "file:///test",
                "capabilities": {}
            }
        })
        
        response = read_response(process)
        print(f"Response: {json.dumps(response, indent=2)}\n")
        
        # Send initialized
        send_request(process, {
            "jsonrpc": "2.0",
            "method": "initialized",
            "params": {}
        })
        
        # Open document with @ at different positions
        print("=== Open Document ===")
        text = """@validator
interface User {
  @required
  name: string
  @
  email: string
}"""
        
        send_request(process, {
            "jsonrpc": "2.0",
            "method": "textDocument/didOpen",
            "params": {
                "textDocument": {
                    "uri": "file:///test/test.luq",
                    "languageId": "luq",
                    "version": 1,
                    "text": text
                }
            }
        })
        
        # Read any log messages
        import time
        time.sleep(0.5)
        
        # Test completion at different positions
        positions = [
            (4, 3, "After @ on line 4"),  # After @ on line 4
            (0, 1, "After @ in @validator"),  # After @ in @validator
            (2, 3, "After @ in @required"),  # After @ in @required
        ]
        
        for line, char, desc in positions:
            print(f"\n=== Completion Test: {desc} (line {line}, char {char}) ===")
            print(f"Text at position: '{text.split(chr(10))[line][:char+1]}'")
            
            send_request(process, {
                "jsonrpc": "2.0",
                "id": 2 + line,
                "method": "textDocument/completion",
                "params": {
                    "textDocument": {"uri": "file:///test/test.luq"},
                    "position": {"line": line, "character": char}
                }
            })
            
            response = read_response(process)
            if response and 'result' in response:
                result = response['result']
                if result is None:
                    print("Result: None")
                elif isinstance(result, list):
                    print(f"Result: {len(result)} items")
                    for item in result[:3]:
                        print(f"  - {item.get('label', 'Unknown')}")
                elif isinstance(result, dict):
                    items = result.get('items', [])
                    print(f"Result: {len(items)} items")
                    for item in items[:3]:
                        print(f"  - {item.get('label', 'Unknown')}")
            elif response and 'error' in response:
                print(f"Error: {response['error']}")
            else:
                print("No response or timeout")
        
        # Shutdown
        print("\n=== Shutdown ===")
        send_request(process, {
            "jsonrpc": "2.0",
            "id": 99,
            "method": "shutdown",
            "params": None
        })
        
        response = read_response(process)
        print(f"Shutdown response: {response}")
        
    finally:
        process.terminate()
        process.wait()

if __name__ == "__main__":
    main()