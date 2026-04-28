import { redirect } from "next/navigation";

// Legacy /register route — redirect to the dedicated events listing page
export default function RegisterPage() {
  redirect("/events");
}
