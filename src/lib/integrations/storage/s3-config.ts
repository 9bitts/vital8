export function isS3Configured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim() &&
      process.env.AWS_S3_BUCKET?.trim(),
  );
}

export function getS3Bucket(): string {
  return process.env.AWS_S3_BUCKET?.trim() ?? "";
}

export function getS3Region(): string {
  return process.env.AWS_REGION?.trim() || "sa-east-1";
}

export function buildS3Key(
  organizationId: string,
  patientId: string,
  fileName: string,
): string {
  const ext = (fileName.split(".").pop() || "bin")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const id = crypto.randomUUID().replace(/-/g, "");
  const safeOrg = organizationId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safePatient = patientId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${safeOrg}/${safePatient}/${id}.${ext}`;
}
