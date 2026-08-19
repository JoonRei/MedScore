import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Account creation is not available from this page." }, { status: 405 });
}
