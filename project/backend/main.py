from fastapi import FastAPI
from services.memory import store_incident, search_incidents, is_duplicate
from services.retrieval import get_top_memories
from services.llm import build_prompt, call_llm, parse_response, safe_llm_call
from services.evaluator import evaluate_fix

app = FastAPI()


@app.post("/generate")
def generate(data: dict):
    error = data["error"]

    memories = search_incidents(error)

    if not memories:
        return {
            "root_cause": "Unknown",
            "fix": "Check logs and restart service",
            "confidence": 0.3
        }

    top_memories = get_top_memories(error, memories)

    prompt = build_prompt(error, top_memories)
    raw_output = safe_llm_call(prompt)
    parsed = parse_response(raw_output)

    return {
        "result": parsed,
        "used_memories": top_memories
    }


@app.post("/feedback")
def feedback(data: dict):
    error = data.get("error", "")
    fix = data.get("fix", "")
    outcome = data.get("outcome", "unknown")

    memories = search_incidents(error)
    if is_duplicate(error, memories):
        return {"status": "duplicate", "message": "Incident already stored"}
    
    # Evaluate fix quality automatically
    evaluation = evaluate_fix(error, fix, outcome)
    
    # Update data with auto-computed score and tags
    data["score"] = evaluation["score"]
    data["tags"] = evaluation["tags"]
    data["reliability"] = evaluation["reliability"]

    return store_incident(data)
