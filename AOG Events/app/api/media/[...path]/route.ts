import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
// Read from disk on every request. The whole point of this route is to serve
// files that did not exist when the app was built.
export const dynamic = "force-dynamic";

// Next only serves files that were in public/ at build time, so a banner
// uploaded through the admin 404s until the next deploy — which is exactly
// what happened to the gala banner. Uploads are served through this handler
// instead, which reads from disk per request and so shows them immediately.
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");
const PROD_MEDIA_URL = "https://events.agfiji.org/api/media";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  // Resolve first, then confirm the result is still inside the upload root —
  // this is what stops "../../.env" from being served.
  const target = path.resolve(UPLOAD_ROOT, ...segments);
  if (target !== UPLOAD_ROOT && !target.startsWith(UPLOAD_ROOT + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(target).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) return new NextResponse("Not found", { status: 404 });

    const file = await readFile(target);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        // Upload filenames carry a timestamp and 8 random bytes, so a given
        // URL always refers to the same bytes and can be cached hard.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    // Uploads exist only on the server, so a local checkout is missing most
    // banners. In dev, fall back to the live copy so pages look like prod.
    if (process.env.NODE_ENV === "development") {
      return NextResponse.redirect(`${PROD_MEDIA_URL}/${segments.map(encodeURIComponent).join("/")}`);
    }
    return new NextResponse("Not found", { status: 404 });
  }
}
