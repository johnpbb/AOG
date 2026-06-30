import { NextResponse } from "next/server";
import { confirmWindcavePayment } from "@/lib/windcave-confirm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const regId = searchParams.get("regId");
  const sessionId = searchParams.get("sessionId") || undefined;
  const result = searchParams.get("result"); // 'declined' | 'cancelled' when set by callback

  if (!regId) {
    return NextResponse.json({ status: "failed", message: "Missing registration id" }, { status: 400 });
  }

  if (result === "cancelled") {
    return NextResponse.json({ status: "failed", message: "Payment was cancelled" });
  }

  try {
    const outcome = await confirmWindcavePayment(regId, sessionId);
    const ok = outcome.status === "success";
    return NextResponse.json(
      { status: ok ? "success" : "failed", message: outcome.message },
      { status: outcome.status === "not_found" ? 404 : 200 },
    );
  } catch (error: any) {
    console.error("Windcave Verification Error:", error);
    return NextResponse.json({ status: "failed", message: error.message }, { status: 500 });
  }
}
