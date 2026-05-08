declare module '@aws-sdk/client-s3' {
  export class S3Client {
    constructor(config?: unknown);
    send(command: unknown): Promise<unknown>;
  }

  export class DeleteObjectCommand {
    constructor(input: unknown);
  }
}
