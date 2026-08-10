import { redirect } from "next/navigation";

import { currentUser, landingFor } from "./lib/session";

/**
 * The profile is the entry point for an organization, not a dashboard.
 *
 * Nothing else in the product works without it: the feed is empty, matching has
 * nothing to judge against, and every verdict would be UNCERTAIN. Sending a new
 * organization anywhere else would show them an empty screen and let them
 * conclude the product has nothing for them.
 *
 * The operator account is the exception, and it used to be sent to /profil like
 * everyone else — which redirected it back to the login form, because it has no
 * organization on purpose.
 */
export default async function Home() {
  const user = await currentUser();
  redirect(user ? landingFor(user) : "/vhid");
}
