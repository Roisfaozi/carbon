import { describe, expect, it } from "vitest";

import {
  LEGACY_PRIVATE_BUCKET,
  buildCompanyPrivateStorageTarget,
  downloadPrivateObjectWithFallback,
  getCompanyPrivateBucket,
  getPrivateReadCandidateBuckets,
  hasCompanyPrivateObjectPathPrefix,
  isAllowedPrivateBucketForCompany,
  listPrivateObjectsWithFallback
} from "./storage";

describe("storage helpers", () => {
  it("resolves the company private bucket from company id", () => {
    expect(getCompanyPrivateBucket("cmp_123")).toBe("cmp_123");
  });

  it("keeps the legacy shared private bucket constant explicit", () => {
    expect(LEGACY_PRIVATE_BUCKET).toBe("private");
  });

  it("builds a company private storage target with explicit naming", () => {
    expect(
      buildCompanyPrivateStorageTarget({
        companyId: "cmp_123",
        logicalFolder: "job",
        entityId: "job_987",
        fileName: "work-instruction.pdf"
      })
    ).toEqual({
      physicalBucket: "cmp_123",
      logicalFolder: "job",
      objectPath: "cmp_123/job/job_987/work-instruction.pdf"
    });
  });

  it("normalizes path separators in folder, id, and file name", () => {
    expect(
      buildCompanyPrivateStorageTarget({
        companyId: "cmp_123",
        logicalFolder: "/parts/",
        entityId: "item/001",
        fileName: "folder\\model.step"
      })
    ).toEqual({
      physicalBucket: "cmp_123",
      logicalFolder: "parts",
      objectPath: "cmp_123/parts/item-001/folder-model.step"
    });
  });

  it("omits the entity segment when it is not provided", () => {
    expect(
      buildCompanyPrivateStorageTarget({
        companyId: "cmp_123",
        logicalFolder: "models",
        fileName: "render.png"
      })
    ).toEqual({
      physicalBucket: "cmp_123",
      logicalFolder: "models",
      objectPath: "cmp_123/models/render.png"
    });
  });

  it("validates the expected company prefix in private object paths", () => {
    expect(
      hasCompanyPrivateObjectPathPrefix(
        "cmp_123",
        "cmp_123/job/job_987/work-instruction.pdf"
      )
    ).toBe(true);
    expect(
      hasCompanyPrivateObjectPathPrefix(
        "cmp_123",
        "other-company/job/job_987/work-instruction.pdf"
      )
    ).toBe(false);
  });

  it("allows only the company bucket and legacy private bucket", () => {
    expect(isAllowedPrivateBucketForCompany("cmp_123", "cmp_123")).toBe(true);
    expect(isAllowedPrivateBucketForCompany("private", "cmp_123")).toBe(true);
    expect(isAllowedPrivateBucketForCompany("public", "cmp_123")).toBe(false);
  });

  it("returns company-first fallback buckets for private reads", () => {
    expect(getPrivateReadCandidateBuckets("cmp_123")).toEqual([
      "cmp_123",
      "private"
    ]);
    expect(getPrivateReadCandidateBuckets("cmp_123", "cmp_123")).toEqual([
      "cmp_123",
      "private"
    ]);
    expect(getPrivateReadCandidateBuckets("cmp_123", "private")).toEqual([
      "private"
    ]);
    expect(getPrivateReadCandidateBuckets("cmp_123", "public")).toEqual([]);
  });

  it("falls back from the company bucket to the legacy private bucket", async () => {
    const bucketsTried: string[] = [];
    const result = await downloadPrivateObjectWithFallback({
      companyId: "cmp_123",
      objectPath: "cmp_123/job/job_987/work-instruction.pdf",
      requestedBucket: "cmp_123",
      downloadObject: async (physicalBucket) => {
        bucketsTried.push(physicalBucket);

        if (physicalBucket === "private") {
          return { data: "legacy-file", error: null };
        }

        return { data: null, error: { message: "Not found" } };
      }
    });

    expect(bucketsTried).toEqual(["cmp_123", "private"]);
    expect(result).toEqual({
      data: "legacy-file",
      physicalBucket: "private"
    });
  });

  it("lists company files first and falls back to legacy private files", async () => {
    const bucketsTried: string[] = [];

    const result = await listPrivateObjectsWithFallback({
      companyId: "cmp_123",
      objectPathPrefix: "cmp_123/job/job_987",
      requestedBucket: "cmp_123",
      listObjects: async (physicalBucket) => {
        bucketsTried.push(physicalBucket);

        if (physicalBucket === "cmp_123") {
          return {
            data: [{ name: "new-file.pdf" }, { name: "shared-file.pdf" }],
            error: null
          };
        }

        return {
          data: [{ name: "shared-file.pdf" }, { name: "legacy-file.pdf" }],
          error: null
        };
      },
      getItemKey: (item) => item.name
    });

    expect(bucketsTried).toEqual(["cmp_123", "private"]);
    expect(result).toEqual([
      { name: "new-file.pdf" },
      { name: "shared-file.pdf" },
      { name: "legacy-file.pdf" }
    ]);
  });
});
