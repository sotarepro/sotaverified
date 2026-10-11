import { sliceTab, type TabData } from "@/lib/tab-data-shared";
import { signedInCookieHeader, SIGNED_IN_COOKIE } from "@/lib/signed-in-flag";
import { AREAS, areaFromSlug, areaSlug, assertKnownAreas } from "@/lib/areas";
import nextConfig from "../next.config";

function data(n: number): TabData {
  const papers: TabData["papers"] = {};
  const ids: string[] = [];
  for (let i = 1; i <= n; i++) {
    ids.push(`p${i}`);
    papers[`p${i}`] = {
      id: `p${i}`, title: `T${i}`, published: null, tasks: [], verification: "unverified",
      verification_score: 0, repro_count: 0, upvote_count: 0,
    };
  }
  return { papers, tabs: { recent: ids, hyped: [...ids].reverse(), active: [], unverified: ids, verified: [] } };
}

describe("sliceTab (client-side paging over static data)", () => {
  it("returns the requested page", () => {
    const r = sliceTab(data(25), "recent", 2, 10);
    expect(r.rows.map((x) => x.id)).toEqual(["p11", "p12", "p13", "p14", "p15", "p16", "p17", "p18", "p19", "p20"]);
    expect(r.total).toBe(25);
    expect(r.page).toBe(2);
  });
  it("last page is partial", () => {
    expect(sliceTab(data(25), "recent", 3, 10).rows).toHaveLength(5);
  });
  it("out-of-range page falls back to page 1 (no server call)", () => {
    for (const bad of [0, -3, 4, 9999]) {
      const r = sliceTab(data(25), "recent", bad, 10);
      expect(r.page).toBe(1);
      expect(r.rows[0].id).toBe("p1");
    }
  });
  it("empty tab yields no rows and page 1", () => {
    const r = sliceTab(data(25), "verified", 5, 10);
    expect(r).toEqual({ rows: [], total: 0, page: 1 });
  });
  it("respects tab ordering", () => {
    expect(sliceTab(data(5), "hyped", 1, 10).rows[0].id).toBe("p5");
  });
});

describe("sv_signed_in flag cookie", () => {
  it("is readable by JS (no HttpOnly) and long-lived when set", () => {
    const h = signedInCookieHeader(true, true);
    expect(h).toContain(`${SIGNED_IN_COOKIE}=1`);
    expect(h).not.toMatch(/httponly/i);
    expect(h).toContain("Secure");
    expect(h).toContain("SameSite=Lax");
    expect(h).toContain("Path=/");
  });
  it("clears with Max-Age=0", () => {
    const h = signedInCookieHeader(false, false);
    expect(h).toMatch(/Max-Age=0/);
    expect(h).not.toContain("Secure");
  });
});

describe("research areas", () => {
  it("slugs round-trip and are unique", () => {
    const slugs = AREAS.map(areaSlug);
    expect(new Set(slugs).size).toBe(AREAS.length);
    for (const a of AREAS) expect(areaFromSlug(areaSlug(a))).toBe(a);
    expect(areaFromSlug("nope")).toBeUndefined();
  });
  it("assertKnownAreas rejects unlisted DB areas", () => {
    expect(() => assertKnownAreas([...AREAS])).not.toThrow();
    expect(() => assertKnownAreas(["Brand New Area"])).toThrow(/Brand New Area/);
  });
});

describe("next.config", () => {
  it("rewrites /tasks?area=<known> to the static area page, for each of the 11 areas only", async () => {
    const rw = (await nextConfig.rewrites!()) as { beforeFiles: { source: string; has: { key: string; value: string }[]; destination: string }[] };
    expect(rw.beforeFiles).toHaveLength(AREAS.length);
    for (const r of rw.beforeFiles) {
      expect(r.source).toBe("/tasks");
      expect(r.has[0].key).toBe("area");
      expect(r.destination).toMatch(/^\/browse\/area\/[a-z0-9-]+$/);
    }
  });
  it("redirects only the exact vercel.app host, permanently", async () => {
    const rd = await nextConfig.redirects!();
    expect(rd).toHaveLength(1);
    expect(rd[0]).toMatchObject({
      source: "/:path*",
      has: [{ type: "host", value: "sotaverified-zeta.vercel.app" }],
      destination: "https://sotaverified.org/:path*",
      permanent: true,
    });
  });
});

import { scopeTag, tag, TAG_CATALOG } from "@/lib/cache";

describe("narrow revalidation tags", () => {
  it("scopes map to per-scope tags", () => {
    expect(scopeTag()).toBe("tabs:all");
    expect(scopeTag({ taskId: "rag" })).toBe("tabs:task:rag");
    expect(scopeTag({ area: "Language & Reasoning" })).toBe("tabs:area:language-reasoning");
    // task wins when both are given (a task scope is the narrower one)
    expect(scopeTag({ taskId: "rag", area: "Computer Vision" })).toBe("tabs:task:rag");
  });
  it("per-entity tags are distinct, and the catalog tag is separate (admin only)", () => {
    const all = [tag.tabsAll, tag.tabsTask("a"), tag.tabsTask("b"), tag.task("a"), tag.paper("a"), tag.profile("a"), tag.arxiv("a"),
      tag.leaderboard, tag.papersIndex, tag.sotaCorpus, tag.siteStats, tag.usersIndex];
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain(TAG_CATALOG);
  });
  it("write helpers are no-ops under jest (no DB lookups)", async () => {
    const { revalidatePaperHype, revalidatePaperChange, revalidateProfiles, revalidateSignIn } = await import("@/lib/revalidate");
    await expect(revalidatePaperHype("p", 3)).resolves.toBeUndefined();
    await expect(revalidatePaperChange("p")).resolves.toBeUndefined();
    await expect(revalidateProfiles(["u"], { reputation: true })).resolves.toBeUndefined();
    await expect(revalidateSignIn("1", "u", true)).resolves.toBeUndefined();
  });
});
