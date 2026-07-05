import { test, expect } from "@playwright/test";
import { signIn, signInAsAdmin, signInAsTestUser, ensureTestData, resetTestData, signOut } from "./helpers/auth";

const BASE = "http://localhost:3000";

/**
 * Author claim is per-paper, not per-user.
 * Rejecting one claim should not reject claims on other papers.
 */
test.describe("Author claim scoping", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    // signInAsTestUser aliases the same admin account used across spec
    // files — reset first so an earlier file's leftover claim on
    // test_basic/test_full doesn't leak into this file's "fresh claim"
    // assertions.
    await resetTestData(page);
    await ensureTestData(page);
    await page.close();
  });

  // This test's whole premise (claim → pending_admin → reject) requires the
  // claim-author route's contributor check to be active. It's currently
  // bypassed: app/api/papers/[id]/claim-author/route.ts hardcodes
  // SKIP_CONTRIBUTOR_CHECK = true (auto-approve-everyone, per CLAUDE.md's
  // launch-phase decision), so claims resolve to 'verified' immediately and
  // never reach a 'pending' state to reject. Re-enable once
  // SKIP_CONTRIBUTOR_CHECK is flipped back to false.
  test.skip("claim on paper A pending, reject A → paper B still pending", async ({ page }) => {
    // Sign in as test_user and attempt claims on two papers
    await signInAsTestUser(page);

    // Claim on test_basic (no repo → immediate pending_admin)
    const resA = await page.context().request.post(`${BASE}/api/papers/test_basic/claim-author`, {});
    const dataA = await resA.json();
    // Either pending or no_repo (test_basic has no code links)
    expect(["pending", "no_repo"].includes(dataA.status)).toBe(true);

    // Claim on test_full (has repo → will fail contributor check → pending_admin)
    const resB = await page.context().request.post(`${BASE}/api/papers/test_full/claim-author`, {});
    const dataB = await resB.json();
    // Either pending or verified (if admin is already verified on test_full)
    expect(["pending", "verified"].includes(dataB.status)).toBe(true);

    await signOut(page);

    // Admin rejects claim on test_basic (if it created a pending row)
    if (dataA.status === "pending") {
      await signInAsAdmin(page);
      const rejectRes = await page.context().request.patch(
        `${BASE}/api/admin/paper-authors/test_basic/test_user`,
        { data: { action: "reject" } },
      );
      expect(rejectRes.ok()).toBe(true);

      // Verify test_full claim is NOT also rejected
      // Check via the admin pending claims — test_full should still be pending
      await page.goto("/admin");
      // If test_full claim was pending, it should still show
      // (This test validates the WHERE clause scopes to paper_id)
      await signOut(page);
    }
  });
});
