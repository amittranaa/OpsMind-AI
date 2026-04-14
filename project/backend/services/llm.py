from groq import Groq
import json
import os

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


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
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[
                {"role": "system", "content": "Return ONLY JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )

        text = response.choices[0].message.content

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
