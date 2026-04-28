import { redirect } from "next/navigation";

/**
 * Legacy /app/login route. Login now lives as a modal on the marketing
 * home page so unauthenticated visitors hit one consistent door. This
 * route just forwards to that flow so any bookmark/old link still works.
 */
export default function AppLoginRedirect() {
  redirect("/?login=1&next=/app");
}
