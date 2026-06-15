import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import * as tar from 'tar-stream';
import { createGunzip } from 'zlib';
import { Readable, PassThrough } from 'stream';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { createLogger } from '../services/logger.service';

interface S3Config {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucket?: string;
}

@Injectable()
export class StorageService {
  private readonly logger = createLogger('StorageService');
  private readonly storageType: string;
  private readonly localPath: string;
  private s3Client: S3Client | null = null;
  private s3Bucket = 'openwa';
  private s3Region = 'us-east-1';
  private s3Endpoint: string | undefined;
  private s3AccessKeyId: string | undefined;
  private s3SecretAccessKey: string | undefined;
  private s3Available = false;

  constructor(private readonly configService: ConfigService) {
    this.storageType = this.configService.get<string>('storage.type') || 'local';
    this.localPath = this.configService.get<string>('storage.localPath') || './data/media';

    // Initialize S3 client if storage type is s3
    if (this.storageType === 's3') {
      const s3Config = this.configService.get<S3Config>('storage.s3') || {};
      const endpoint = process.env.S3_ENDPOINT || s3Config.endpoint;
      const accessKeyId = process.env.S3_ACCESS_KEY || s3Config.accessKeyId;
      const secretAccessKey = process.env.S3_SECRET_KEY || s3Config.secretAccessKey;
      const region = process.env.S3_REGION || s3Config.region || 'us-east-1';

      if (endpoint && accessKeyId && secretAccessKey) {
        this.s3Endpoint = endpoint;
        this.s3AccessKeyId = accessKeyId;
        this.s3SecretAccessKey = secretAccessKey;
        this.s3Region = region;
        this.s3Client = new S3Client({
          endpoint,
          region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
          forcePathStyle: true, // Required for MinIO
        });
        this.s3Bucket = process.env.S3_BUCKET || s3Config.bucket || 'openwa';
        void this.initializeS3Bucket();
      }
    }

    // Ensure local directory exists
    if (!fs.existsSync(this.localPath)) {
      fs.mkdirSync(this.localPath, { recursive: true });
    }
  }

  private async initializeS3Bucket(): Promise<void> {
    if (!this.s3Client) return;

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.s3Bucket }));
      this.s3Available = true;
      this.logger.log(`S3 bucket '${this.s3Bucket}' is available`);
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name === 'NotFound' || err.name === 'NoSuchBucket') {
        // Create bucket
        try {
          await this.s3Client.send(new CreateBucketCommand({ Bucket: this.s3Bucket }));
          this.s3Available = true;
          this.logger.log(`Created S3 bucket '${this.s3Bucket}'`);
        } catch (createError) {
          this.logger.error('Failed to create S3 bucket', String(createError));
        }
      } else {
        this.logger.error('S3 bucket check failed', String(error));
      }
    }
  }

  // ============================================================================
  // Current Storage Operations
  // ============================================================================

  getCurrentStorageType(): string {
    return this.storageType;
  }

  isS3Available(): boolean {
    return this.s3Available;
  }

  hasS3Credentials(): boolean {
    return this.s3Client !== null;
  }

  getDefaultS3Bucket(): string {
    return this.s3Bucket;
  }

  private resolveBackupClient(regionOverride?: string | null): S3Client {
    if (!this.s3Client || !this.s3AccessKeyId || !this.s3SecretAccessKey) {
      throw new Error('S3 storage is not configured');
    }
    const region = regionOverride?.trim() || this.s3Region;
    if (region === this.s3Region) {
      return this.s3Client;
    }
    return new S3Client({
      endpoint: this.s3Endpoint,
      region,
      credentials: {
        accessKeyId: this.s3AccessKeyId,
        secretAccessKey: this.s3SecretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  private resolveBackupBucket(bucketOverride?: string | null): string {
    const bucket = bucketOverride?.trim();
    return bucket || this.s3Bucket;
  }

  async mirrorBackupArchive(
    filename: string,
    data: Buffer,
    options?: { bucket?: string | null; region?: string | null },
  ): Promise<void> {
    if (!this.hasS3Credentials()) {
      throw new Error('S3 storage is not configured');
    }
    const client = this.resolveBackupClient(options?.region);
    const bucket = this.resolveBackupBucket(options?.bucket);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `backups/${filename}`,
        Body: data,
      }),
    );
  }

  async getBackupArchive(
    filename: string,
    options?: { bucket?: string | null; region?: string | null },
  ): Promise<Buffer> {
    const localPath = path.join(process.cwd(), 'data', 'backups', filename);
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }
    if (!this.hasS3Credentials()) {
      throw new Error(`Backup file not found: ${filename}`);
    }

    const region = options?.region?.trim() || null;
    const buckets = [
      options?.bucket?.trim(),
      this.s3Bucket,
    ].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);

    let lastError: unknown;
    for (const bucket of buckets) {
      try {
        const client = this.resolveBackupClient(region);
        const response = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: `backups/${filename}`,
          }),
        );
        if (!response.Body) throw new Error('Empty backup response body');
        const chunks: Buffer[] = [];
        const stream = response.Body as Readable;
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk as ArrayBuffer));
        }
        return Buffer.concat(chunks);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Backup file not found: ${filename}`);
  }

  async listFiles(): Promise<string[]> {
    if (this.storageType === 's3' && this.s3Client && this.s3Available) {
      return this.listS3Files();
    }
    return this.listLocalFiles();
  }

  async getFile(filePath: string): Promise<Buffer> {
    if (this.storageType === 's3' && this.s3Client && this.s3Available) {
      return this.getS3File(filePath);
    }
    return this.getLocalFile(filePath);
  }

  async putFile(filePath: string, data: Buffer): Promise<void> {
    if (this.storageType === 's3' && this.s3Client && this.s3Available) {
      return this.putS3File(filePath, data);
    }
    return this.putLocalFile(filePath, data);
  }

  async deleteFile(filePath: string): Promise<void> {
    if (this.storageType === 's3' && this.s3Client && this.s3Available) {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.s3Bucket,
          Key: `media/${filePath}`,
        }),
      );
      return;
    }
    const fullPath = path.join(this.localPath, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  /** Delete all stored files under a path prefix (e.g. inbox/{sessionId}). */
  async deleteFilesWithPrefix(prefix: string): Promise<number> {
    const normalized = prefix.replace(/^\/+|\/+$/g, '');
    const files = (await this.listFiles()).filter(
      file => file === normalized || file.startsWith(`${normalized}/`),
    );
    for (const file of files) {
      await this.deleteFile(file);
    }
    if (this.storageType !== 's3' || !this.s3Client || !this.s3Available) {
      const dirPath = path.join(this.localPath, normalized);
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    }
    return files.length;
  }


  async getFileCount(): Promise<{ count: number; sizeBytes: number }> {
    const files = await this.listFiles();
    let sizeBytes = 0;

    if (this.storageType === 's3' && this.s3Client && this.s3Available) {
      // S3 size would require additional API calls, estimate
      sizeBytes = files.length * 100000; // Estimate 100KB per file
    } else {
      for (const file of files) {
        try {
          const fullPath = path.join(this.localPath, file);
          const stats = fs.statSync(fullPath);
          sizeBytes += stats.size;
        } catch (error) {
          this.logger.debug(`Failed to stat file: ${file}`, { error: String(error) });
        }
      }
    }

    return { count: files.length, sizeBytes };
  }

  // ============================================================================
  // Export - Create tar.gz stream from current storage
  // ============================================================================

  async createExportStream(): Promise<PassThrough> {
    const files = await this.listFiles();
    const output = new PassThrough();

    const archive = archiver.default('tar', {
      gzip: true,
      gzipOptions: { level: 6 },
    });

    archive.pipe(output);

    // Add files to archive
    for (const file of files) {
      try {
        const data = await this.getFile(file);
        archive.append(data, { name: file });
      } catch (error) {
        this.logger.warn(`Failed to export file: ${file}`, { error: String(error) });
      }
    }

    void archive.finalize();
    return output;
  }

  // ============================================================================
  // Import - Extract tar.gz stream to current storage
  // ============================================================================

  async importFromStream(inputStream: Readable): Promise<number> {
    let importedCount = 0;

    const extract = tar.extract();
    const gunzip = createGunzip();

    return new Promise<number>((resolve, reject) => {
      extract.on('entry', (header, stream, next) => {
        const chunks: Buffer[] = [];

        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
          const data = Buffer.concat(chunks);
          this.putFile(header.name, data)
            .then(() => {
              importedCount++;
              this.logger.debug(`Imported file: ${header.name}`);
              next();
            })
            .catch((error: unknown) => {
              this.logger.error(`Failed to import file: ${header.name}`, String(error));
              next();
            });
        });
        stream.resume();
      });

      extract.on('finish', () => {
        this.logger.log(`Import completed: ${importedCount} files`);
        resolve(importedCount);
      });

      extract.on('error', (err: Error) => {
        this.logger.error('Import failed', String(err));
        reject(err);
      });

      inputStream.pipe(gunzip).pipe(extract);
    });
  }

  // ============================================================================
  // Local Storage Operations
  // ============================================================================

  private listLocalFiles(dir = ''): string[] {
    const fullPath = path.join(this.localPath, dir);
    const files: string[] = [];

    if (!fs.existsSync(fullPath)) {
      return files;
    }

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = dir ? path.join(dir, entry.name) : entry.name;

      if (entry.isDirectory()) {
        files.push(...this.listLocalFiles(relativePath));
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }

    return files;
  }

  private getLocalFile(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.localPath, filePath);
    return Promise.resolve(fs.readFileSync(fullPath));
  }

  private putLocalFile(filePath: string, data: Buffer): Promise<void> {
    const fullPath = path.join(this.localPath, filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, data);
    return Promise.resolve();
  }

  // ============================================================================
  // S3 Storage Operations
  // ============================================================================

  private async listS3Files(): Promise<string[]> {
    if (!this.s3Client) return [];

    const files: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.s3Bucket,
          Prefix: 'media/',
          ContinuationToken: continuationToken,
        }),
      );

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            // Remove 'media/' prefix
            files.push(obj.Key.replace(/^media\//, ''));
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return files;
  }

  private async getS3File(filePath: string): Promise<Buffer> {
    if (!this.s3Client) throw new Error('S3 client not initialized');

    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: `media/${filePath}`,
      }),
    );

    if (!response.Body) throw new Error('Empty response body');

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    const stream = response.Body as Readable;

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as ArrayBuffer));
    }

    return Buffer.concat(chunks);
  }

  private async putS3File(filePath: string, data: Buffer): Promise<void> {
    if (!this.s3Client) throw new Error('S3 client not initialized');

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: `media/${filePath}`,
        Body: data,
      }),
    );
  }
}
