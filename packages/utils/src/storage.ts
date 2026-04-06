export const LEGACY_PRIVATE_BUCKET = "private";

export type PrivateStorageTarget = {
  physicalBucket: string;
  logicalFolder: string;
  objectPath: string;
};

type DownloadPrivateObjectResult<TData> = {
  data: TData | null;
  error: unknown | null;
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

export const hasCompanyPrivateObjectPathPrefix = (
  companyId: string,
  objectPath: string
) => {
  return objectPath.startsWith(`${getCompanyPrivateBucket(companyId)}/`);
};

export const getPrivateReadCandidateBuckets = (
  companyId: string,
  requestedBucket?: string
) => {
  const companyBucket = getCompanyPrivateBucket(companyId);
  const candidates =
    !requestedBucket || requestedBucket === companyBucket
      ? [companyBucket, LEGACY_PRIVATE_BUCKET]
      : requestedBucket === LEGACY_PRIVATE_BUCKET
        ? [LEGACY_PRIVATE_BUCKET]
        : [];

  return [...new Set(candidates)];
};

export const isAllowedPrivateBucketForCompany = (
  bucket: string,
  companyId: string
) => {
  return getPrivateReadCandidateBuckets(companyId, bucket).length > 0;
};

export const downloadPrivateObjectWithFallback = async <TData>({
  companyId,
  objectPath,
  requestedBucket,
  downloadObject
}: {
  companyId: string;
  objectPath: string;
  requestedBucket?: string;
  downloadObject: (
    physicalBucket: string,
    objectPath: string
  ) => Promise<DownloadPrivateObjectResult<TData>>;
}) => {
  for (const physicalBucket of getPrivateReadCandidateBuckets(
    companyId,
    requestedBucket
  )) {
    const result = await downloadObject(physicalBucket, objectPath);

    if (!result.error && result.data) {
      return {
        data: result.data,
        physicalBucket
      };
    }
  }

  return null;
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
