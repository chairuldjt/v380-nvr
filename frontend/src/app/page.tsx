import { redirect } from "next/navigation";

export default function Home() {
  // Redirect the root path to the main dashboard (live view)
  // The layout/middleware will handle checking for auth and redirecting to /login if needed
  redirect("/live");
}
