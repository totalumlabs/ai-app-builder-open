import { redirect } from "next/navigation";

// Catch-all for every path that doesn't match a real route — old locale links
// like /en or /es, the former /dashboard path, or any mistyped URL. Instead of
// showing a 404, send the user home (`/`, the dashboard). Real routes such as
// `/project/[projectId]` and the `/api/*` handlers are more specific, so they
// are matched before this fallback.
export default function CatchAll() {
  redirect("/");
}
