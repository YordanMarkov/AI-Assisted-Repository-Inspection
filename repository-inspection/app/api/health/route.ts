export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    status: "ok",
    service: "repository-inspection",
    checkedAt: new Date().toISOString(),
  });
}
