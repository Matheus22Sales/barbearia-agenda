import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    password?: unknown;
  } | null;

  const password = typeof body?.password === "string" ? body.password : "";
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "admin123";

  if (password !== expectedPassword) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
