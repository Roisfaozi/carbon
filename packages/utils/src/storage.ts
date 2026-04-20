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

type ListPrivateObjectResult<TItem> = {
  data: TItem[] | null;
  error: unknown | null;
};

export type PrivateBucketAttemptError = {
  physicalBucket: string;
  error: unknown;
};

export type DownloadPrivateObjectWithFallbackResult<TData> = {
  attemptedBuckets: string[];
  data: TData | null;
  errors: PrivateBucketAttemptError[];
  fallbackUsed: boolean;
  physicalBucket?: string;
};

export type ListPrivateObjectsWithFallbackResult<TItem> = {
  attemptedBuckets: string[];
  data: TItem[];
  errors: PrivateBucketAttemptError[];
  fallbackUsed: boolean;
};

type CreateSignedUrlResult = {
  error: unknown | null;
  signedUrl: string | null;
};

export type CreatePrivateSignedUrlWithFallbackResult = {
  attemptedBuckets: string[];
  errors: PrivateBucketAttemptError[];
  fallbackUsed: boolean;
  physicalBucket?: string;
  signedUrl: string | null;
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
  const result = await downloadPrivateObjectWithFallbackDetailed({
    companyId,
    objectPath,
    requestedBucket,
    downloadObject
  });

  if (!result.data || !result.physicalBucket) {
    return null;
  }

  return {
    data: result.data,
    physicalBucket: result.physicalBucket
  };
};

export const downloadPrivateObjectWithFallbackDetailed = async <TData>({
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
}): Promise<DownloadPrivateObjectWithFallbackResult<TData>> => {
  const attemptedBuckets: string[] = [];
  const errors: PrivateBucketAttemptError[] = [];
  const candidateBuckets = getPrivateReadCandidateBuckets(
    companyId,
    requestedBucket
  );

  for (const physicalBucket of candidateBuckets) {
    attemptedBuckets.push(physicalBucket);
    const result = await downloadObject(physicalBucket, objectPath);

    if (!result.error && result.data) {
      return {
        attemptedBuckets,
        data: result.data,
        errors,
        fallbackUsed: physicalBucket !== candidateBuckets[0],
        physicalBucket
      };
    }

    if (result.error) {
      errors.push({
        physicalBucket,
        error: result.error
      });
    }
  }

  return {
    attemptedBuckets,
    data: null,
    errors,
    fallbackUsed: false
  };
};

export const listPrivateObjectsWithFallback = async <TItem>({
  companyId,
  objectPathPrefix,
  requestedBucket,
  listObjects,
  getItemKey
}: {
  companyId: string;
  objectPathPrefix: string;
  requestedBucket?: string;
  listObjects: (
    physicalBucket: string,
    objectPathPrefix: string
  ) => Promise<ListPrivateObjectResult<TItem>>;
  getItemKey: (item: TItem) => string;
}) => {
  const result = await listPrivateObjectsWithFallbackDetailed({
    companyId,
    objectPathPrefix,
    requestedBucket,
    listObjects,
    getItemKey
  });

  return result.data;
};

export const listPrivateObjectsWithFallbackDetailed = async <TItem>({
  companyId,
  objectPathPrefix,
  requestedBucket,
  listObjects,
  getItemKey
}: {
  companyId: string;
  objectPathPrefix: string;
  requestedBucket?: string;
  listObjects: (
    physicalBucket: string,
    objectPathPrefix: string
  ) => Promise<ListPrivateObjectResult<TItem>>;
  getItemKey: (item: TItem) => string;
}): Promise<ListPrivateObjectsWithFallbackResult<TItem>> => {
  const items = new Map<string, TItem>();
  const attemptedBuckets: string[] = [];
  const errors: PrivateBucketAttemptError[] = [];
  let fallbackUsed = false;
  const candidateBuckets = getPrivateReadCandidateBuckets(
    companyId,
    requestedBucket
  );

  for (const physicalBucket of candidateBuckets) {
    attemptedBuckets.push(physicalBucket);
    const result = await listObjects(physicalBucket, objectPathPrefix);

    if (result.error) {
      errors.push({
        physicalBucket,
        error: result.error
      });
      continue;
    }

    if (!result.data) {
      continue;
    }

    const itemCountBefore = items.size;

    for (const item of result.data) {
      const itemKey = getItemKey(item);

      if (!items.has(itemKey)) {
        items.set(itemKey, item);
      }
    }

    if (
      physicalBucket !== candidateBuckets[0] &&
      items.size > itemCountBefore
    ) {
      fallbackUsed = true;
    }
  }

  return {
    attemptedBuckets,
    data: [...items.values()],
    errors,
    fallbackUsed
  };
};

export const createPrivateSignedUrlWithFallback = async ({
  companyId,
  objectPath,
  requestedBucket,
  expiresIn,
  createSignedUrl
}: {
  companyId: string;
  objectPath: string;
  requestedBucket?: string;
  expiresIn: number;
  createSignedUrl: (
    physicalBucket: string,
    objectPath: string,
    expiresIn: number
  ) => Promise<CreateSignedUrlResult>;
}) => {
  const result = await createPrivateSignedUrlWithFallbackDetailed({
    companyId,
    objectPath,
    requestedBucket,
    expiresIn,
    createSignedUrl
  });

  if (!result.signedUrl || !result.physicalBucket) {
    return null;
  }

  return {
    physicalBucket: result.physicalBucket,
    signedUrl: result.signedUrl
  };
};

export const createPrivateSignedUrlWithFallbackDetailed = async ({
  companyId,
  objectPath,
  requestedBucket,
  expiresIn,
  createSignedUrl
}: {
  companyId: string;
  objectPath: string;
  requestedBucket?: string;
  expiresIn: number;
  createSignedUrl: (
    physicalBucket: string,
    objectPath: string,
    expiresIn: number
  ) => Promise<CreateSignedUrlResult>;
}): Promise<CreatePrivateSignedUrlWithFallbackResult> => {
  const attemptedBuckets: string[] = [];
  const errors: PrivateBucketAttemptError[] = [];
  const candidateBuckets = getPrivateReadCandidateBuckets(
    companyId,
    requestedBucket
  );

  for (const physicalBucket of candidateBuckets) {
    attemptedBuckets.push(physicalBucket);
    const result = await createSignedUrl(physicalBucket, objectPath, expiresIn);

    if (!result.error && result.signedUrl) {
      return {
        attemptedBuckets,
        errors,
        fallbackUsed: physicalBucket !== candidateBuckets[0],
        physicalBucket,
        signedUrl: result.signedUrl
      };
    }

    if (result.error) {
      errors.push({
        physicalBucket,
        error: result.error
      });
    }
  }

  return {
    attemptedBuckets,
    errors,
    fallbackUsed: false,
    signedUrl: null
  };
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
