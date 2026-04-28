import { redirect } from "next/navigation";

// /events duplicates the homepage — redirect there
export default function EventsPage() {
  redirect("/");
}
