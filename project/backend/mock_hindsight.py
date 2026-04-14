# Simple in-memory mock for Hindsight API to validate the system locally

from services.embedding import get_embedding

# In-memory storage
memory_store = []
next_id = 1


def handle_store(payload):
    """Mock /memories POST endpoint"""
    global next_id
    memory = {
        "id": next_id,
        "content": payload.get("content", ""),
        "metadata": payload.get("metadata", {}),
    }
    memory_store.append(memory)
    
    # Return the metadata so evaluator fields are visible
    result = memory["metadata"].copy()
    result["id"] = next_id
    result["status"] = "stored"
    next_id += 1
    return result


def handle_search(query):
    """Mock /memories/search GET endpoint with keyword matching"""
    results = []
    query_words = set(query.lower().split())
    
    # Score each memory by keyword overlap with query
    scored = []
    for memory in memory_store:
        memory_words = set(memory["content"].lower().split())
        overlap = len(query_words & memory_words)
        if overlap > 0:
            scored.append((overlap, memory))
    
    # Return sorted by overlap (highest first)
    scored.sort(key=lambda x: x[0], reverse=True)
    results = [m for _, m in scored]
    return results


# For testing: add example incidents manually
def seed_examples():
    """Pre-populate with example incidents"""
    examples = [
        {
            "content": "redis timeout | increased timeout to 5s and restarted container | success",
            "metadata": {
                "error": "redis timeout",
                "fix": "increased timeout to 5s and restarted container",
                "outcome": "success",
                "score": 0.95,
                "tags": ["backend", "timeout", "redis"],
                "embedding": get_embedding("redis timeout"),
            },
        },
        {
            "content": "db connection refused | restarted db service | fail",
            "metadata": {
                "error": "db connection refused",
                "fix": "restarted db service",
                "outcome": "fail",
                "score": 0.2,
                "tags": ["backend", "database"],
                "embedding": get_embedding("db connection refused"),
            },
        },
    ]
    for ex in examples:
        handle_store(ex)
