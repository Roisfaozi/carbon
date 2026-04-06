export const LEGACY_PRIVATE_BUCKET = "private";

export type PrivateStorageTarget = {
  physicalBucket: string;
  logicalFolder: string;
  objectPath: string;
};

type BuildCompanyPrivateStorageTargetInput = {
  companyId: string;
  logicalFolder: string;
  fileName: string;
  entityId?: string | null;
};

const normalizeStorageSegment = (value: string) =>
  value
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");

export const getCompanyPrivateBucket = (companyId: string) => {
  return normalizeStorageSegment(companyId);
};

export const buildCompanyPrivateStorageTarget = ({
  companyId,
  logicalFolder,
  fileName,
  entityId
}: BuildCompanyPrivateStorageTargetInput): PrivateStorageTarget => {
  const physicalBucket = getCompanyPrivateBucket(companyId);
  const normalizedLogicalFolder = normalizeStorageSegment(logicalFolder);
  const normalizedEntityId = entityId
    ? normalizeStorageSegment(entityId)
    : undefined;
  const normalizedFileName = normalizeStorageSegment(fileName);

  const objectPath = [
    physicalBucket,
    normalizedLogicalFolder,
    normalizedEntityId,
    normalizedFileName
  ]
    .filter(Boolean)
    .join("/");

  return {
    physicalBucket,
    logicalFolder: normalizedLogicalFolder,
    objectPath
  };
};
