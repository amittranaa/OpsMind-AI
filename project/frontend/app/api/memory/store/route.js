import { NextResponse } from "next/server";
import { storeMemory, TEAM_ID } from "../../../../lib/memory";

export async function POST(request) {
  try {
    const data = await request.json();
    const teamId = TEAM_ID;
    const userId = request.headers.get("x-user-id") || process.env.DEFAULT_USER_ID || "ops-user";
    const outcome = (data.outcome || "").toLowerCase();

    if (!["worked", "resolved", "success"].includes(outcome)) {
      return NextResponse.json(
        { status: "not_stored", reason: "Memory only stores after Worked/Resolved feedback", team_id: teamId },
        { status: 200 }
      );
    }

    const response = await storeMemory({
      ...data,
      input: data.input || data.error,
      rootCause: data.rootCause || data.root_cause,
      team_id: teamId,
      user_id: userId,
      ts: Date.now(),
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `Memory store failed: ${error.message}` },
      { status: 500 }
    );
  }
}
