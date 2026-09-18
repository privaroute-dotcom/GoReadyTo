import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DbService } from '../db/db.service';
import { makePublicId } from '../common/public-id';
import { CaptureSessionsService } from '../capture-sessions/capture-sessions.service';

@Injectable()
export class EvidenceService {
  private readonly bucket = process.env.S3_BUCKET ?? 'goreadyto-evidence';
  private readonly baseS3Config = {
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
  };

  // Internal client used by the API to re-read stored originals.
  private readonly s3 = new S3Client({
    ...this.baseS3Config,
    endpoint: process.env.S3_ENDPOINT,
  });

  // Signing client uses the hostname the phone can actually reach.
  private readonly s3Signer = new S3Client({
    ...this.baseS3Config,
    endpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT,
  });

  constructor(
    private readonly db: DbService,
    private readonly sessions: CaptureSessionsService,
  ) {}

  async presign(input: {
    captureSessionId: string;
    mediaType: 'photo' | 'video' | '360';
    captureStep: number;
    mimeType: string;
    clientSha256: string;
    capturedAt: string;
    latitude: number;
    longitude: number;
    gpsAccuracyM: number;
  }) {
    const session = await this.sessions.getSession(input.captureSessionId);
    if (!['CAPTURING', 'READY'].includes(session.status)) {
      throw new ConflictException(`Session is not accepting evidence: ${session.status}`);
    }

    const locationCheck = await this.db.query(
      `SELECT ST_Distance(
         ST_SetSRID(ST_MakePoint($2,$3),4326)::geography,
         target_location
       )::float8 AS distance_m,
       max_distance_m::float8,
       max_accuracy_m::float8
       FROM capture_sessions WHERE id=$1`,
      [input.captureSessionId, input.longitude, input.latitude],
    );
    const check = locationCheck.rows[0] as any;
    if (check.distance_m > check.max_distance_m || input.gpsAccuracyM > check.max_accuracy_m) {
      throw new ConflictException('Evidence capture location does not meet session requirements');
    }

    const evidencePublicId = makePublicId('GR-EV');
    const extension = input.mimeType.includes('png') ? 'png' : input.mediaType === 'video' ? 'mp4' : 'jpg';
    const storageKey = `original/${input.captureSessionId}/${evidencePublicId}.${extension}`;

    const created = await this.db.query<{ id: string }>(
      `INSERT INTO media_evidence(
        public_id, capture_session_id, media_type, capture_step, storage_key,
        mime_type, client_sha256, captured_at, capture_location, gps_accuracy_m,
        source, integrity_status, privacy_status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        ST_SetSRID(ST_MakePoint($9,$10),4326)::geography,$11,
        'GOREADYTO_IN_APP_CAPTURE','PENDING','PENDING'
      ) RETURNING id`,
      [
        evidencePublicId,
        input.captureSessionId,
        input.mediaType,
        input.captureStep,
        storageKey,
        input.mimeType,
        input.clientSha256.toLowerCase(),
        input.capturedAt,
        input.longitude,
        input.latitude,
        input.gpsAccuracyM,
      ],
    );

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: input.mimeType,
      Metadata: {
        'goreadyto-evidence-id': created.rows[0].id,
        'client-sha256': input.clientSha256.toLowerCase(),
      },
    });

    const uploadUrl = await getSignedUrl(this.s3Signer, command, { expiresIn: 300 });
    return { evidenceId: created.rows[0].id, evidencePublicId, storageKey, uploadUrl, expiresInSeconds: 300 };
  }

  private async hashStoredObject(storageKey: string): Promise<{ sha256: string; byteSize: number }> {
    const response = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    if (!response.Body) throw new NotFoundException('Stored evidence object not found');

    const hash = createHash('sha256');
    let byteSize = 0;
    for await (const chunk of response.Body as any) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteSize += buffer.length;
      hash.update(buffer);
    }
    return { sha256: hash.digest('hex'), byteSize };
  }

  async complete(evidenceId: string) {
    const result = await this.db.query(
      `SELECT id, capture_session_id, storage_key, client_sha256, integrity_status
       FROM media_evidence WHERE id=$1`,
      [evidenceId],
    );
    if (!result.rowCount) throw new NotFoundException('Evidence not found');
    const evidence = result.rows[0] as any;

    const stored = await this.hashStoredObject(evidence.storage_key);
    const integrityStatus = stored.sha256 === evidence.client_sha256 ? 'MATCHED' : 'FAILED';

    await this.db.query(
      `UPDATE media_evidence
       SET server_sha256=$2, byte_size=$3, integrity_status=$4,
           server_received_at=now(), updated_at=now()
       WHERE id=$1`,
      [evidenceId, stored.sha256, stored.byteSize, integrityStatus],
    );

    await this.db.query(
      `INSERT INTO audit_events(entity_type, entity_id, event_type, payload)
       VALUES ('MEDIA_EVIDENCE',$1,'INTEGRITY_CHECKED',$2::jsonb)`,
      [evidenceId, JSON.stringify({ integrityStatus, algorithm: 'SHA-256' })],
    );

    return {
      evidenceId,
      integrityStatus,
      hashAlgorithm: 'SHA-256',
      serverSha256: stored.sha256,
      byteSize: stored.byteSize,
    };
  }
}
