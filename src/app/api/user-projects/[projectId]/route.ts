import { auth } from "@/lib/auth";
import { totalumSdk } from "@/lib/totalum";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// DELETE: Remove user-project association
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { projectId } = await params;

    console.log("[UserProjects] Deleting association:", userId, projectId);

    // Find the record
    const result = await totalumSdk.crud.query("user_project", {
      _filter: { user_id: userId, project_id: projectId },
      _limit: 1,
    });
    const records = result.data || [];
    if (Array.isArray(records) && records.length > 0) {
      const record = records[0] as { _id: string };
      await totalumSdk.crud.deleteRecordById("user_project", record._id);
    }

    return NextResponse.json({ ok: true, data: { success: true } });
  } catch (error) {
    console.error("[UserProjects] DELETE error:", error);
    return NextResponse.json({ ok: false, error: "Failed to delete association" }, { status: 500 });
  }
}
