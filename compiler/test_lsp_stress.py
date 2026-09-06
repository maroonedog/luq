#!/usr/bin/env python3
"""
LSP Server Stress Test
Tests if the LSP server can handle rapid, concurrent completion requests
"""

import json
import subprocess
import time
import threading
import queue
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

class LSPClient:
    def __init__(self, server_path):
        self.server_path = server_path
        self.process = None
        self.request_id = 0
        self.response_queue = queue.Queue()
        self.lock = threading.Lock()
        
    def start(self):
        """Start the LSP server process"""
        self.process = subprocess.Popen(
            [self.server_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=False  # Use binary mode
        )
        
        # Start response reader thread
        self.reader_thread = threading.Thread(target=self._read_responses, daemon=True)
        self.reader_thread.start()
        
    def stop(self):
        """Stop the LSP server"""
        if self.process:
            self.process.terminate()
            self.process.wait()
            
    def _read_responses(self):
        """Read responses from the server"""
        while self.process and self.process.poll() is None:
            try:
                # Read headers
                headers = {}
                while True:
                    line = self.process.stdout.readline()
                    if not line:
                        return
                    line = line.decode('utf-8').strip()
                    if not line:
                        break
                    if ':' in line:
                        key, value = line.split(':', 1)
                        headers[key.strip()] = value.strip()
                
                # Read content
                if 'Content-Length' in headers:
                    content_length = int(headers['Content-Length'])
                    content = self.process.stdout.read(content_length).decode('utf-8')
                    response = json.loads(content)
                    self.response_queue.put(response)
            except Exception as e:
                print(f"Error reading response: {e}")
                break
                
    def send_request(self, method, params=None):
        """Send a request to the LSP server"""
        with self.lock:
            self.request_id += 1
            request_id = self.request_id
            
        request = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params or {}
        }
        
        content = json.dumps(request)
        message = f"Content-Length: {len(content)}\r\n\r\n{content}"
        
        try:
            self.process.stdin.write(message.encode('utf-8'))
            self.process.stdin.flush()
            return request_id
        except Exception as e:
            print(f"Error sending request: {e}")
            return None
            
    def get_response(self, timeout=5):
        """Get a response from the queue"""
        try:
            return self.response_queue.get(timeout=timeout)
        except queue.Empty:
            return None

def test_concurrent_completions(lsp_path):
    """Test concurrent completion requests"""
    print("=== Testing Concurrent Completion Requests ===")
    
    client = LSPClient(lsp_path)
    client.start()
    
    # Initialize the server
    print("Initializing LSP server...")
    init_params = {
        "processId": None,
        "rootUri": "file:///test",
        "capabilities": {}
    }
    
    request_id = client.send_request("initialize", init_params)
    response = client.get_response()
    if response:
        print(f"Initialize response: {response.get('result', {}).get('capabilities', {}).get('completionProvider')}")
    
    # Send initialized notification
    client.send_request("initialized", {})
    
    # Open a test document
    print("\nOpening test document...")
    did_open_params = {
        "textDocument": {
            "uri": "file:///test/test.luq",
            "languageId": "luq",
            "version": 1,
            "text": "@validator\ninterface User {\n  @required\n  name: string\n  @\n}"
        }
    }
    client.send_request("textDocument/didOpen", did_open_params)
    time.sleep(0.5)  # Give server time to process
    
    # Test 1: Sequential rapid requests
    print("\n--- Test 1: Sequential Rapid Requests ---")
    start_time = time.time()
    request_times = []
    response_times = []
    
    for i in range(10):
        completion_params = {
            "textDocument": {"uri": "file:///test/test.luq"},
            "position": {"line": 4, "character": 3}  # After @
        }
        
        req_start = time.time()
        request_id = client.send_request("textDocument/completion", completion_params)
        request_times.append(time.time() - req_start)
        
        response = client.get_response(timeout=1)
        if response:
            response_times.append(time.time() - req_start)
            if 'error' in response:
                print(f"  Request {i}: ERROR - {response['error']}")
            else:
                result = response.get('result')
                if result is None:
                    print(f"  Request {i}: No result in {response_times[-1]:.3f}s")
                elif isinstance(result, list):
                    print(f"  Request {i}: {len(result)} completions in {response_times[-1]:.3f}s")
                elif isinstance(result, dict):
                    items = result.get('items', [])
                    print(f"  Request {i}: {len(items)} completions in {response_times[-1]:.3f}s")
                else:
                    print(f"  Request {i}: Unexpected result type in {response_times[-1]:.3f}s")
        else:
            print(f"  Request {i}: TIMEOUT")
            response_times.append(-1)
    
    print(f"Sequential test completed in {time.time() - start_time:.3f}s")
    valid_responses = [t for t in response_times if t > 0]
    if valid_responses:
        print(f"Average response time: {sum(valid_responses) / len(valid_responses):.3f}s")
    else:
        print("No valid responses received!")
    
    # Test 2: Concurrent requests using threads
    print("\n--- Test 2: Concurrent Requests (Multi-threaded) ---")
    
    def send_completion_request(client, request_num):
        """Send a single completion request"""
        completion_params = {
            "textDocument": {"uri": "file:///test/test.luq"},
            "position": {"line": 4, "character": 3}  # After @
        }
        
        start = time.time()
        request_id = client.send_request("textDocument/completion", completion_params)
        
        # Wait for response
        response = client.get_response(timeout=5)
        elapsed = time.time() - start
        
        if response:
            if 'error' in response:
                return f"Request {request_num}: ERROR - {response['error']} ({elapsed:.3f}s)"
            else:
                result = response.get('result')
                if result is None:
                    return f"Request {request_num}: No result ({elapsed:.3f}s)"
                elif isinstance(result, list):
                    return f"Request {request_num}: {len(result)} completions ({elapsed:.3f}s)"
                elif isinstance(result, dict):
                    items = result.get('items', [])
                    return f"Request {request_num}: {len(items)} completions ({elapsed:.3f}s)"
                else:
                    return f"Request {request_num}: Unexpected result ({elapsed:.3f}s)"
        else:
            return f"Request {request_num}: TIMEOUT after {elapsed:.3f}s"
    
    start_time = time.time()
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = []
        for i in range(10):
            future = executor.submit(send_completion_request, client, i)
            futures.append(future)
            time.sleep(0.01)  # Small delay between submissions
        
        # Collect results
        for future in as_completed(futures):
            result = future.result()
            print(f"  {result}")
    
    print(f"Concurrent test completed in {time.time() - start_time:.3f}s")
    
    # Test 3: Rapid fire with immediate cancellation (simulating VSCode behavior)
    print("\n--- Test 3: Rapid Fire with Cancellation ---")
    
    print("Sending 5 requests in rapid succession (simulating fast typing)...")
    request_ids = []
    for i in range(5):
        completion_params = {
            "textDocument": {"uri": "file:///test/test.luq"},
            "position": {"line": 4, "character": 3}  # After @
        }
        request_id = client.send_request("textDocument/completion", completion_params)
        request_ids.append(request_id)
        time.sleep(0.05)  # 50ms between requests (fast typing)
    
    # Try to collect all responses
    print("Collecting responses...")
    responses_received = 0
    timeout_count = 0
    
    for i in range(5):
        response = client.get_response(timeout=1)
        if response:
            responses_received += 1
            if 'error' in response:
                print(f"  Response {i}: ERROR - {response.get('error', {}).get('message', 'Unknown')}")
            else:
                result = response.get('result')
                if result is None:
                    print(f"  Response {i}: No result")
                elif isinstance(result, list):
                    print(f"  Response {i}: {len(result)} completions")
                elif isinstance(result, dict):
                    items = result.get('items', [])
                    print(f"  Response {i}: {len(items)} completions")
                else:
                    print(f"  Response {i}: Unexpected result")
        else:
            timeout_count += 1
            print(f"  Response {i}: TIMEOUT")
    
    print(f"Received {responses_received}/5 responses, {timeout_count} timeouts")
    
    # Clean up
    print("\nShutting down LSP server...")
    client.send_request("shutdown")
    time.sleep(0.5)
    client.stop()
    
    print("\n=== Test Complete ===")

def test_lsp_mutex_deadlock(lsp_path):
    """Test for potential mutex deadlock in LSP server"""
    print("\n=== Testing for Mutex Deadlock ===")
    
    client = LSPClient(lsp_path)
    client.start()
    
    # Initialize
    init_params = {
        "processId": None,
        "rootUri": "file:///test",
        "capabilities": {}
    }
    client.send_request("initialize", init_params)
    client.get_response()
    client.send_request("initialized", {})
    
    # Open document
    did_open_params = {
        "textDocument": {
            "uri": "file:///test/deadlock.luq",
            "languageId": "luq",
            "version": 1,
            "text": "@"
        }
    }
    client.send_request("textDocument/didOpen", did_open_params)
    time.sleep(0.2)
    
    print("Sending interleaved didChange and completion requests...")
    
    # Send interleaved requests that might cause deadlock
    for i in range(5):
        # Send completion request
        completion_params = {
            "textDocument": {"uri": "file:///test/deadlock.luq"},
            "position": {"line": 0, "character": 1}
        }
        client.send_request("textDocument/completion", completion_params)
        
        # Immediately send didChange
        did_change_params = {
            "textDocument": {
                "uri": "file:///test/deadlock.luq",
                "version": i + 2
            },
            "contentChanges": [{
                "text": f"@validat"
            }]
        }
        client.send_request("textDocument/didChange", did_change_params)
    
    # Try to collect responses
    print("Collecting responses (checking for deadlock)...")
    responses = []
    for i in range(10):  # We sent 10 requests total
        response = client.get_response(timeout=2)
        if response:
            method = response.get('method', 'response')
            if 'result' in response:
                responses.append(f"Got response {i}")
            elif 'method' in response:
                responses.append(f"Got notification: {method}")
        else:
            responses.append(f"TIMEOUT on response {i}")
    
    # Print results
    for r in responses:
        print(f"  {r}")
    
    # Final test: Can we still get a response?
    print("\nFinal check - server still responsive?")
    client.send_request("textDocument/completion", completion_params)
    final_response = client.get_response(timeout=2)
    if final_response:
        print("  ✓ Server is still responsive")
    else:
        print("  ✗ Server appears to be deadlocked!")
    
    client.stop()
    print("=== Deadlock Test Complete ===")

if __name__ == "__main__":
    # Path to LSP server
    lsp_path = "/mnt/c/projects/luq/compiler/luq-lsp.exe"
    
    if len(sys.argv) > 1:
        lsp_path = sys.argv[1]
    
    print(f"Testing LSP server at: {lsp_path}\n")
    
    # Run tests
    test_concurrent_completions(lsp_path)
    test_lsp_mutex_deadlock(lsp_path)