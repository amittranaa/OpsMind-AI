import numpy as np

from services.embedding import get_embedding


def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


def rank_by_similarity(query, memories):
    query_emb = get_embedding(query)

    scored = []

    for m in memories:
        emb = m["metadata"].get("embedding")
        if not emb:
            continue

        sim = cosine_similarity(query_emb, emb)
        score = m["metadata"].get("score", 0)

        # hybrid score
        final_score = 0.7 * sim + 0.3 * score

        scored.append((final_score, m))

    scored.sort(reverse=True, key=lambda x: x[0])

    return [m for _, m in scored[:3]]


def get_top_memories(query, memories):
    return rank_by_similarity(query, memories)
