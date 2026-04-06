import { describe, expect, it } from "vitest";

import {
  LEGACY_PRIVATE_BUCKET,
  buildCompanyPrivateStorageTarget,
  getCompanyPrivateBucket
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
});
