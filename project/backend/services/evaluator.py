"""
Evaluates incident resolution quality.

Scores fixes based on:
- Whether the fix solved the root cause (success) or was temporary (fail)
- Tag extraction for categorization
- Reliability assessment
"""

import re
from typing import Dict, List, Any


def extract_tags(error: str, fix: str) -> List[str]:
    """Extract relevant tags from error and fix text"""
    text = (error + " " + fix).lower()
    
    tag_patterns = {
        "timeout": r"timeout|timed out|time-?out",
        "database": r"db|database|sql|postgres|mysql|mongodb",
        "redis": r"redis|cache",
        "network": r"network|connection|socket|dns|port",
        "memory": r"memory|ram|out.of.memory|oom",
        "cpu": r"cpu|processor|high.load",
        "disk": r"disk|storage|io|i/o",
        "kubernetes": r"kubernetes|k8s|pod|container|docker",
        "api": r"api|endpoint|request|response|http",
        "auth": r"auth|permission|forbidden|unauthorized",
        "logging": r"logging|log",
        "deployment": r"deploy|release|rollout",
    }
    
    tags = []
    for tag, pattern in tag_patterns.items():
        if re.search(pattern, text):
            tags.append(tag)
    
    return tags if tags else ["other"]


def assess_reliability(error: str, fix: str, outcome: str) -> str:
    """Assess if fix addresses root cause or is temporary"""
    text = (error + " " + fix).lower()
    
    # Indicators of root-cause fixes
    root_cause_phrases = [
        r"increased.*limit",
        r"added.*buffer",
        r"optimized.*query",
        r"refactored",
        r"patched",
        r"upgraded",
        r"scaled.*up",
        r"added.*retry",
        r"circuit.*breaker",
        r"load.*balance",
        r"failover",
    ]
    
    # Indicators of temporary/workaround fixes
    temporary_phrases = [
        r"restart",
        r"reboot",
        r"kill.*process",
        r"clear.*cache",
        r"flush",
        r"bounce",
    ]
    
    has_root_cause = any(re.search(p, text) for p in root_cause_phrases)
    has_temporary = any(re.search(p, text) for p in temporary_phrases)
    
    if outcome == "success":
        if has_root_cause:
            return "strong"
        elif has_temporary:
            return "temporary"
        else:
            return "effective"
    else:
        return "failed"


def evaluate_fix(error: str, fix: str, outcome: str) -> Dict[str, Any]:
    """
    You are a system that evaluates incident resolution quality.
    
    Determines:
    1. If fix solved root cause or was temporary
    2. Score (1.0 = strong, 0.7 = partial, 0.2 = failed)
    3. Tags for categorization
    """
    
    # Determine base score from outcome
    if outcome == "success":
        base_score = 1.0
    else:
        base_score = 0.2
    
    # Adjust score based on reliability assessment
    reliability = assess_reliability(error, fix, outcome)
    
    score_adjustments = {
        "strong": 0.0,        # 1.0 (no adjustment)
        "effective": -0.1,    # 0.9
        "temporary": -0.3,    # 0.7
        "failed": 0.0,        # 0.2 (no adjustment)
    }
    
    final_score = base_score + score_adjustments.get(reliability, 0.0)
    final_score = max(0.0, min(1.0, final_score))  # Clamp to [0.0, 1.0]
    
    tags = extract_tags(error, fix)
    
    return {
        "score": round(final_score, 2),
        "tags": tags,
        "reliability": reliability,
        "outcome": outcome,
    }
