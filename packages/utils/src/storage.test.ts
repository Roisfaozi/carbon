import { describe, expect, it } from "vitest";

import {
  buildCompanyPrivateStorageTarget,
  createPrivateSignedUrlWithFallbackDetailed,
  downloadPrivateObjectWithFallback,
  downloadPrivateObjectWithFallbackDetailed,
  getCompanyPrivateBucket,
  getPrivateReadCandidateBuckets,
  hasCompanyPrivateObjectPathPrefix,
  isAllowedPrivateBucketForCompany,
  LEGACY_PRIVATE_BUCKET,
  listPrivateObjectsWithFallback,
  listPrivateObjectsWithFallbackDetailed
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

  it("captures download attempt metadata and bucket errors", async () => {
    const result = await downloadPrivateObjectWithFallbackDetailed({
      companyId: "cmp_123",
      objectPath: "cmp_123/job/job_987/work-instruction.pdf",
      requestedBucket: "cmp_123",
      downloadObject: async (physicalBucket) => {
        if (physicalBucket === "private") {
          return { data: "legacy-file", error: null };
        }

        return { data: null, error: { message: "Not found" } };
      }
    });

    expect(result).toEqual({
      attemptedBuckets: ["cmp_123", "private"],
      data: "legacy-file",
      errors: [{ physicalBucket: "cmp_123", error: { message: "Not found" } }],
      fallbackUsed: true,
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

  it("captures list attempt metadata and bucket errors", async () => {
    const result = await listPrivateObjectsWithFallbackDetailed({
      companyId: "cmp_123",
      objectPathPrefix: "cmp_123/job/job_987",
      requestedBucket: "cmp_123",
      listObjects: async (physicalBucket) => {
        if (physicalBucket === "cmp_123") {
          return {
            data: null,
            error: { message: "Temporary storage error" }
          };
        }

        return {
          data: [{ name: "legacy-file.pdf" }],
          error: null
        };
      },
      getItemKey: (item) => item.name
    });

    expect(result).toEqual({
      attemptedBuckets: ["cmp_123", "private"],
      data: [{ name: "legacy-file.pdf" }],
      errors: [
        {
          physicalBucket: "cmp_123",
          error: { message: "Temporary storage error" }
        }
      ],
      fallbackUsed: true
    });
  });

  it("creates a signed url from the company bucket before falling back", async () => {
    const result = await createPrivateSignedUrlWithFallbackDetailed({
      companyId: "cmp_123",
      objectPath: "cmp_123/job/job_987/work-instruction.pdf",
      requestedBucket: "cmp_123",
      expiresIn: 3600,
      createSignedUrl: async (physicalBucket) => {
        if (physicalBucket === "cmp_123") {
          return {
            signedUrl: "https://example.com/company-file",
            error: null
          };
        }

        return {
          signedUrl: null,
          error: { message: "Should not be reached" }
        };
      }
    });

    expect(result).toEqual({
      attemptedBuckets: ["cmp_123"],
      errors: [],
      fallbackUsed: false,
      physicalBucket: "cmp_123",
      signedUrl: "https://example.com/company-file"
    });
  });

  it("falls back to the legacy private bucket when signed url creation fails in the company bucket", async () => {
    const result = await createPrivateSignedUrlWithFallbackDetailed({
      companyId: "cmp_123",
      objectPath: "cmp_123/job/job_987/work-instruction.pdf",
      requestedBucket: "cmp_123",
      expiresIn: 3600,
      createSignedUrl: async (physicalBucket) => {
        if (physicalBucket === "private") {
          return {
            signedUrl: "https://example.com/legacy-file",
            error: null
          };
        }

        return {
          signedUrl: null,
          error: { message: "Not found" }
        };
      }
    });

    expect(result).toEqual({
      attemptedBuckets: ["cmp_123", "private"],
      errors: [{ physicalBucket: "cmp_123", error: { message: "Not found" } }],
      fallbackUsed: true,
      physicalBucket: "private",
      signedUrl: "https://example.com/legacy-file"
    });
  });

  it("returns null signedUrl when signed url creation fails in all buckets", async () => {
    const result = await createPrivateSignedUrlWithFallbackDetailed({
      companyId: "cmp_123",
      objectPath: "cmp_123/job/job_987/work-instruction.pdf",
      requestedBucket: "cmp_123",
      expiresIn: 3600,
      createSignedUrl: async (physicalBucket) => ({
        signedUrl: null,
        error: { message: `Failed in ${physicalBucket}` }
      })
    });

    expect(result).toEqual({
      attemptedBuckets: ["cmp_123", "private"],
      errors: [
        {
          physicalBucket: "cmp_123",
          error: { message: "Failed in cmp_123" }
        },
        {
          physicalBucket: "private",
          error: { message: "Failed in private" }
        }
      ],
      fallbackUsed: false,
      signedUrl: null
    });
  });
});
