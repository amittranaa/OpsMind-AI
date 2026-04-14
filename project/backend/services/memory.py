import os

import requests

from services.embedding import get_embedding

BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io")
API_KEY = os.getenv("HINDSIGHT_API_KEY")

# Try to use mock if Hindsight is unavailable
try:
    import mock_hindsight
except ImportError:
    mock_hindsight = None

USE_MOCK = not API_KEY and mock_hindsight is not None


def store_incident(data):
    embedding = get_embedding(data["error"])

    if USE_MOCK:
        payload = {
            "content": f"{data['error']} | {data['fix']} | {data['outcome']}",
            "metadata": {
                **data,
                "embedding": embedding,
            }
        }
        return mock_hindsight.handle_store(payload)
    else:
        payload = {
            "content": f"{data['error']} | {data['fix']} | {data['outcome']}",
            "metadata": {
                **data,
                "embedding": embedding,
            }
        }
        response = requests.post(
            f"{BASE_URL}/memories",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        return response.json()


def search_incidents(query):
    if USE_MOCK:
        return mock_hindsight.handle_search(query)
    else:
        response = requests.get(
            f"{BASE_URL}/memories/search",
            headers={"Authorization": f"Bearer {API_KEY}"},
            params={"q": query}
        )
        return response.json()


def is_duplicate(new_error, memories):
    for m in memories:
        if new_error.lower() in m["content"].lower():
            return True
    return False
