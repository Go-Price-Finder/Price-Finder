import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/siteOrigin";

/**
 * Synthetic auth probe — walks signup confirmation and password reset end
 * to end as a user would, daily, so a silent breakage in either flow
 * surfaces through the dead-man's switch instead of through a stranded
 * stranger (findings doc §9m: the localhost-redirect defect produced no
 * symptom in any system we watched, because every success signal measured
 * the system's bookkeeping, not the user's outcome).
 *
 * What it asserts, in order:
 *   1. No leftover probe users exist (a leftover means a previous run's
 *      cleanup failed — that is itself a failure, and the leftovers are
 *      removed so the next run starts clean).
 *   2. Signup: a generated confirmation link, fetched like a click,
 *      confirms the user server-side (email_confirmed_at NULL -> set) and
 *      303s to THIS site's /auth/callback — and, per the lesson that a row
 *      changing is exactly the green signal that hid the real defect, the
 *      redirect target is then followed to a real page: final response 200
 *      on this site's own host. A localhost or dead target fails here.
 *   3. Reset: a recovery token actually changes the password — the new
 *      password signs in, the old one is rejected — and the page a
 *      resetting user lands on (/auth/reset-password) serves 200.
 *   4. Cleanup, verified by COUNT on both tables (auth.users via
 *      listUsers, public.users via select) against the baseline taken
 *      before the probe user was created.
 *
 * Instrumentation note: links come from admin.generateLink and the
 * recovery token is consumed via verifyOtp — the same verify endpoint and
 * token mechanics as the emailed links, minus the email transport (which
 * the 2026-08-17 measurements showed can mangle one-time tokens; see
 * findings §9n). Email DELIVERY is therefore deliberately out of this
 * probe's scope — it asserts the flows' mechanics and the user-facing
 * pages, not SMTP.
 */

export type AuthProbeResult = {
  steps: string[];
  errors: string[];
};

const PROBE_EMAIL_PATTERN = /^auth-probe\+\d+@gopricefinder\.com$/;

export async function runAuthProbe(): Promise<AuthProbeResult> {
  const result: AuthProbeResult = { steps: [], errors: [] };
  const ok = (s: string) => result.steps.push(s);
  const fail = (s: string) => result.errors.push(s);

  const origin = siteOrigin();
  if (!origin) {
    fail("no site origin derivable — cannot assert redirect targets");
    return result;
  }

  const admin = createAdminClient();
  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonUrl || !anonKey) {
    fail("Supabase anon env vars missing");
    return result;
  }

  // -- 1. Leftovers + baseline ---------------------------------------------
  const { data: baselineList, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    fail(`listUsers failed: ${listErr.message}`);
    return result;
  }
  const leftovers = baselineList.users.filter((u) =>
    PROBE_EMAIL_PATTERN.test(u.email ?? "")
  );
  for (const leftover of leftovers) {
    fail(`leftover probe user from a previous run: ${leftover.email} — prior cleanup failed`);
    await admin.auth.admin.deleteUser(leftover.id);
  }
  const baselineAuthCount = baselineList.users.length - leftovers.length;
  const { count: baselinePublicCount, error: pubErr } = await admin
    .from("users")
    .select("id", { count: "exact", head: true });
  if (pubErr) {
    fail(`public.users baseline count failed: ${pubErr.message}`);
    return result;
  }
  ok(`baseline: ${baselineAuthCount} auth users, ${baselinePublicCount} public.users rows`);

  const email = `auth-probe+${Date.now()}@gopricefinder.com`;
  const password = "Aa1!" + randomBytes(18).toString("base64url");
  let userId: string | null = null;

  try {
    // -- 2. Signup confirmation, as a user experiences it --------------------
    const { data: gen, error: genErr } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        redirectTo: `${origin}/auth/callback`,
        data: { display_name: "auth-probe" },
      },
    });
    if (genErr || !gen) {
      fail(`generateLink(signup) failed: ${genErr?.message}`);
      return result;
    }
    userId = gen.user.id;

    const { data: before } = await admin.auth.admin.getUserById(userId);
    if (before?.user?.email_confirmed_at) {
      fail("email_confirmed_at was already set before the click — probe cannot measure confirmation");
    } else {
      ok("created unconfirmed probe user");
    }

    const click = await fetch(gen.properties.action_link, { redirect: "manual" });
    const location = click.headers.get("location") ?? "";
    if (click.status !== 303 && click.status !== 302) {
      fail(`confirmation click returned ${click.status}, expected a redirect`);
    } else if (!location.startsWith(`${origin}/auth/callback`)) {
      fail(`confirmation redirect points at ${location.split(/[?#]/)[0]} — not ${origin}/auth/callback`);
    } else {
      ok("confirmation click redirects to this site's /auth/callback");
    }

    const { data: after } = await admin.auth.admin.getUserById(userId);
    if (!after?.user?.email_confirmed_at) {
      fail("email_confirmed_at NOT set after the click — confirmation broken");
    } else {
      ok("email_confirmed_at set by the click (server-side confirm verified)");
    }

    // The user-experience assertion: whatever the link redirects to must
    // resolve to a real page on this site — not localhost, not a dead host.
    if (location) {
      const landing = await fetch(location.split("#")[0], { redirect: "follow" });
      const landingHost = new URL(landing.url).host;
      if (!landing.ok) {
        fail(`redirect target did not resolve to a real page: HTTP ${landing.status} at ${landingHost}`);
      } else if (landingHost !== new URL(origin).host) {
        fail(`redirect chain left this site: landed on ${landingHost}`);
      } else {
        ok(`redirect target resolves to a real page on ${landingHost} (HTTP ${landing.status})`);
      }
    }

    // -- 3. Password reset, mechanics + the page users land on ---------------
    const { data: rec, error: recErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (recErr || !rec) {
      fail(`generateLink(recovery) failed: ${recErr?.message}`);
    } else {
      const consumer = createClient(anonUrl, anonKey);
      const { data: otp, error: otpErr } = await consumer.auth.verifyOtp({
        type: "recovery",
        token_hash: rec.properties.hashed_token,
      });
      if (otpErr || !otp.session) {
        fail(`recovery token did not yield a session: ${otpErr?.message}`);
      } else {
        const newPassword = "Aa1!" + randomBytes(18).toString("base64url");
        const { error: updErr } = await consumer.auth.updateUser({ password: newPassword });
        if (updErr) {
          fail(`updateUser(password) failed: ${updErr.message}`);
        } else {
          const fresh = createClient(anonUrl, anonKey);
          const { error: newErr } = await fresh.auth.signInWithPassword({
            email,
            password: newPassword,
          });
          if (newErr) fail(`new password does not sign in: ${newErr.message}`);
          else ok("recovery token changed the password; new password signs in");

          const stale = createClient(anonUrl, anonKey);
          const { error: oldErr } = await stale.auth.signInWithPassword({ email, password });
          if (!oldErr) fail("OLD password still signs in after reset — password change did not take");
          else ok("old password rejected after reset");
        }
      }
    }

    const resetPage = await fetch(`${origin}/auth/reset-password`, { redirect: "follow" });
    if (!resetPage.ok) {
      fail(`/auth/reset-password did not serve a real page: HTTP ${resetPage.status}`);
    } else {
      ok(`/auth/reset-password serves (HTTP ${resetPage.status})`);
    }
  } finally {
    // -- 4. Cleanup, verified by count on BOTH tables -------------------------
    if (userId) {
      const { error: delErr } = await admin.auth.admin.deleteUser(userId);
      if (delErr) fail(`cleanup deleteUser failed: ${delErr.message}`);
    }
    const { data: finalList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const finalAuthCount = finalList?.users.length ?? -1;
    const probeResidue = finalList?.users.filter((u) =>
      PROBE_EMAIL_PATTERN.test(u.email ?? "")
    ).length;
    const { count: finalPublicCount } = await admin
      .from("users")
      .select("id", { count: "exact", head: true });
    if (finalAuthCount !== baselineAuthCount || probeResidue !== 0) {
      fail(
        `auth.users cleanup not verified: baseline ${baselineAuthCount}, final ${finalAuthCount}, probe residue ${probeResidue}`
      );
    } else if (finalPublicCount !== baselinePublicCount) {
      fail(
        `public.users cleanup not verified: baseline ${baselinePublicCount}, final ${finalPublicCount}`
      );
    } else {
      ok(`cleanup verified by count: auth ${finalAuthCount}, public ${finalPublicCount} — both at baseline`);
    }
  }

  return result;
}
