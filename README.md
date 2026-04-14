# OpsMind AI

Professional AI DevOps incident intelligence dashboard powered by a multi-agent workflow and Hindsight memory.

## Problem

Developers repeatedly solve the same incidents without learning from past fixes.

## Solution

OpsMind AI learns from real incident outcomes:

- Planner classifies incident + extracts keywords
- Retriever pulls relevant Hindsight memory
- Executor generates a context-aware resolution
- Feedback stores outcome and closes the learning loop

## Tech Stack

- Vercel frontend + API routes
- Hindsight Cloud memory layer
- Groq LLM for generation and scoring

## Real Product Upgrades

- Team-isolated memory via team_id metadata and team-scoped retrieval filters
- Lightweight auth headers (x-team-id, x-user-id) on every generate/feedback/bootstrap call
- In-memory rate limiting on API routes to prevent burst abuse
- Robust fallback responses so incident workflows never hard-fail
- Bootstrap endpoint for guaranteed baseline memory on first deployment

## Multi-Agent Flow

User Input
-> Planner (classify + keywords)
-> Retriever (search memory)
-> Executor (generate fix)
-> Feedback (store in Hindsight)

## Key Feature

Feedback-driven learning loop with visible before/after improvement.

## How Hindsight Is Used

- Stores incidents
- Retrieves relevant memory
- Influences the next decision

## Production Deployment

Service URL: add here

## Operations Runbook

### Executive Summary

Developers repeatedly solve the same incidents without learning from past fixes.
We built OpsMind AI, a system that uses Hindsight memory to store incidents and improve future decisions.
Our system uses a multi-agent architecture to analyze issues, retrieve relevant memory, and generate better fixes.
The system improves incident response quality using past incidents.
This transforms debugging from reactive to intelligent and continuously improving.

### 3 Key Lines

- This is not a chatbot. It is a learning system.
- Memory directly improves decisions.
- We built a feedback-driven intelligence loop.

### Step-by-Step Validation

Step 1 (Bootstrap)

This system helps developers resolve incidents using past memory.

Input:

Redis timeout error

Output:

Generic fix

Step 2 (Feedback)

Click:

✅ Worked

Say:

We store this successful fix in Hindsight memory.

Step 3 (Learning Proof)

Input:

Redis connection delay

Output:

Improved fix using memory

Say:

Now the system retrieves similar past incidents and improves its decision.

Step 4 (Outcome)

This is not a chatbot. It’s a system that learns from outcomes and improves over time.

## Final Checklist

- Dashboard UI clean
- Before vs After visible
- Memory panel visible
- Insights working
- Multi-agent flow working
- Incident workflow smooth

## Production Validation Flow

1. Bootstrap memory:
   POST /api/bootstrap with x-team-id: opsmind-default and x-user-id: platform-bootstrap
2. Generate incident fix:
   POST /api/generate with same headers and error "Redis timeout on checkout service"
3. Confirm learning signal:
   Response includes memory_used > 0 and used_memories entries
4. Submit feedback:
   POST /api/feedback with same headers and outcome success

## Why This Wins

- Strong innovation through multi-agent architecture
- Clear Hindsight memory usage
- Real-world DevOps relevance
- Clean SaaS UX with obvious learning proof

## Risks

- Overcomplicated UI reduces operational clarity
- Broken workflow undercuts trust
- No visible improvement weakens the learning claim
