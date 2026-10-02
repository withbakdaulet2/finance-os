import { redirect } from "next/navigation";

import { createClient } from "./server";

// Server Functions are public POST endpoints: check the session inside each one,
// do not rely on proxy.ts or on the page that rendered the form.
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}
