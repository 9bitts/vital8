import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class MockS3Client {
    send = sendMock;
  }
  class MockPutObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class MockGetObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class MockDeleteObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    S3Client: MockS3Client,
    PutObjectCommand: MockPutObjectCommand,
    GetObjectCommand: MockGetObjectCommand,
    DeleteObjectCommand: MockDeleteObjectCommand,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://signed.example/url"),
}));

import { S3StorageAdapter } from "./s3.adapter";

describe("S3StorageAdapter", () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.AWS_ACCESS_KEY_ID = "AKIATEST";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    process.env.AWS_S3_BUCKET = "vital8-files";
    process.env.AWS_REGION = "sa-east-1";
  });

  it("uploads file and returns storage key", async () => {
    sendMock.mockResolvedValue({});
    const adapter = new S3StorageAdapter();
    const data = Buffer.from("hello");

    const result = await adapter.upload(
      "org1",
      "patient1",
      "doc.pdf",
      "application/pdf",
      data,
    );

    expect(result.fileName).toBe("doc.pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(result.fileSize).toBe(5);
    expect(result.storageKey).toContain("org1/patient1/");
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("downloads file buffer", async () => {
    sendMock.mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });
    const adapter = new S3StorageAdapter();
    const buf = await adapter.download("org1/patient1/file.pdf");
    expect(buf).toEqual(Buffer.from([1, 2, 3]));
  });

  it("returns signed url", async () => {
    const adapter = new S3StorageAdapter();
    const url = await adapter.getSignedUrl!("key", 300);
    expect(url).toBe("https://signed.example/url");
  });
});
