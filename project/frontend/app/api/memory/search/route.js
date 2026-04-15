import { NextResponse } from "next/server";
import { searchMemories, TEAM_ID } from "../../../../lib/memory";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const teamId = TEAM_ID;

    if (!query.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const results = await searchMemories(query, teamId);
    return NextResponse.json({ memories: results, team_id: teamId });
  } catch (error) {
    return NextResponse.json(
      { error: `Memory search failed: ${error.message}` },
      { status: 500 }
    );
  }
}
