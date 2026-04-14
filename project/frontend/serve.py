#!/usr/bin/env python3
"""
Simple HTTP server for serving the Next.js .next directory
Run: python3 serve.py
Then visit: http://localhost:3000
"""

import http.server
import socketserver
import os
from pathlib import Path

PORT = 3000
HANDLER = http.server.SimpleHTTPRequestHandler

# Change to .next directory
next_dir = Path(__file__).parent / ".next" / "standalone"
if not next_dir.exists():
    print(f"Error: {next_dir} does not exist")
    print("Please run: npm run build")
    exit(1)

os.chdir(next_dir)

try:
    with socketserver.TCPServer(("", PORT), HANDLER) as httpd:
        print(f"🚀 Server running at http://localhost:{PORT}")
        print(f"📁 Serving from: {next_dir}")
        print(f"Press Ctrl+C to stop")
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\n✓ Server stopped")
