import { NextResponse } from "next/server";
import { storeMemory } from "../../../../lib/memory";

export async function POST(request) {
  try {
    const data = await request.json();
    const teamId = request.headers.get("x-team-id") || process.env.DEFAULT_TEAM_ID || "opsmind-default";
    const userId = request.headers.get("x-user-id") || process.env.DEFAULT_USER_ID || "ops-user";
    const outcome = (data.outcome || "").toLowerCase();
    const score = outcome === "success" ? 1.0 : 0.2;

    const response = await storeMemory({
      ...data,
      score,
      team_id: teamId,
      user_id: userId,
      ts: Date.now(),
    });

    const body = await response.json();
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: `Memory store failed: ${error.message}` },
      { status: 500 }
    );
  }
}
