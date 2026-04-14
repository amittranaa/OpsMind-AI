from groq import Groq
import json
import os

client = Groq()
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")


def build_prompt(error, memories):
    examples = "\n".join([m["content"] for m in memories])

    return f"""
You are a senior DevOps engineer.

Past successful fixes:
{examples}

Current issue:
{error}

Tasks:
- Find root cause
- Suggest fix
- Give confidence score

Return ONLY valid JSON:
{{
  "root_cause": "...",
  "fix": "...",
  "steps": "...",
  "confidence": 0.0
}}
"""


def call_llm(prompt):
    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "Return ONLY JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_completion_tokens=8192,
            top_p=1,
            reasoning_effort="medium",
            stream=True,
            stop=None,
        )

        # Collect streaming chunks into a single response body for JSON parsing.
        text_parts = []
        for chunk in completion:
            delta = chunk.choices[0].delta.content or ""
            text_parts.append(delta)
        text = "".join(text_parts)

        try:
            return json.loads(text)
        except Exception:
            return {"error": "Invalid JSON", "raw": text}

    except Exception as e:
        return {"error": f"LLM Error: {str(e)}"}


def parse_response(text):
    try:
        if isinstance(text, dict):
            return text

        lines = text.split("\n")

        result = {
            "root_cause": "",
            "fix": "",
            "steps": "",
            "confidence": 0
        }

        for line in lines:
            if "Root Cause:" in line:
                result["root_cause"] = line.split(":")[1].strip()
            elif "Fix:" in line:
                result["fix"] = line.split(":")[1].strip()
            elif "Steps:" in line:
                result["steps"] = line.split(":")[1].strip()
            elif "Confidence:" in line:
                result["confidence"] = float(line.split(":")[1].strip())

        return result

    except:
        return {"error": "Parsing failed", "raw": text}


def safe_llm_call(prompt, retries=2):
    for _ in range(retries):
        result = call_llm(prompt)
        if not (isinstance(result, dict) and "error" in result):
            return result
    return {"error": "LLM failed after retries"}
