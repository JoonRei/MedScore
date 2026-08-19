import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json({ error: "Account creation is not available from this page." }, { status: 405 });
}
