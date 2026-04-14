import { NextResponse } from "next/server";
import { searchMemories } from "../../../../lib/memory";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const teamId = request.headers.get("x-team-id") || process.env.DEFAULT_TEAM_ID || "opsmind-default";

    if (!query.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const results = await searchMemories(query, teamId);
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: `Memory search failed: ${error.message}` },
      { status: 500 }
    );
  }
}
