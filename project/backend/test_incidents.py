"""
Validation script showing how the system stores incidents and learns from them.
Run this to test the /generate and /feedback endpoints.
"""

import json
import requests
import sys
sys.path.insert(0, '/Users/amitrana/Ai Groth Agent <hackmanthon_project>/project/backend')

from mock_hindsight import seed_examples

BASE_URL = "http://127.0.0.1:8000"

# Seed the mock memory with example incidents
print("=" * 60)
print("Loading example incidents into mock memory...")
print("=" * 60)
seed_examples()
print("✓ Added 2 example incidents\n")

# Example incidents to store
incidents = [
    {
        "error": "Redis timeout",
        "fix": "Increased timeout to 5s and restarted container",
        "outcome": "success",
    },
    {
        "error": "DB connection refused",
        "fix": "Restarted DB service",
        "outcome": "fail",
    },
]

print("=" * 60)
print("STEP 1: Store new incidents as feedback")
print("=" * 60)

for incident in incidents:
    print(f"\nStoring: {incident['error']}")
    response = requests.post(f"{BASE_URL}/feedback", json=incident)
    data = response.json()
    print(f"Response: {data}")
    if 'score' in data:
        print(f"  → Auto-scored: {data.get('score', 'N/A')}")
    if 'tags' in data:
        print(f"  → Extracted tags: {data.get('tags', [])}")

print("\n" + "=" * 60)
print("STEP 2: Generate fix for a new similar error")
print("=" * 60)

new_error = {
    "error": "Redis connection timeout on order service",
}

print(f"\nGenerating fix for: {new_error['error']}")
response = requests.post(f"{BASE_URL}/generate", json=new_error)
result = response.json()

print(f"\nSolution:")
print(json.dumps(result["solution"], indent=2))
print(f"\nUsed memories: {len(result.get('used_memories', []))} high-confidence")

print("\n" + "=" * 60)
print("STEP 3: Mark the solution as successful feedback")
print("=" * 60)

feedback = {
    "error": new_error["error"],
    "fix": result["solution"].get("fix", ""),
    "outcome": "success",
}

print(f"\nSending feedback: {feedback['outcome']}")
response = requests.post(f"{BASE_URL}/feedback", json=feedback)
data = response.json()
print(f"Response: {data}")
if 'score' in data:
    print(f"  → Quality score: {data.get('score', 'N/A')}")
if 'reliability' in data:
    print(f"  → Reliability: {data.get('reliability', 'N/A')}")
if 'tags' in data:
    print(f"  → Tags: {data.get('tags', [])}")

print("\n✅ Validation complete! System has learned from these incidents.")
