import { redirect } from "next/navigation";

/**
 * The profile is the entry point, not a dashboard.
 *
 * Nothing else in the product works without it: the feed is empty, matching has
 * nothing to judge against, and every verdict would be UNCERTAIN. Sending a new
 * organization anywhere else would show them an empty screen and let them
 * conclude the product has nothing for them.
 */
export default function Home() {
  redirect("/profil");
}
