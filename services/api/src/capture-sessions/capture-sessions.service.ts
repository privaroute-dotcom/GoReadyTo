import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DbService } from '../db/db.service';
import { makePublicId } from '../common/public-id';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class CaptureSessionsService {
  constructor(
    private readonly db: DbService,
    private readonly tasks: TasksService,
  ) {}

  async create(input: { taskId: string; devicePublicId: string; platform: string }) {
    const task = await this.tasks.getTask(input.taskId);
    const devUser = await this.db.query<{ id: string }>(
      `SELECT id FROM users WHERE public_id = 'GR-USER-DEV' LIMIT 1`,
    );

    const device = await this.db.query<{ id: string }>(
      `INSERT INTO devices(user_id, public_id, platform)
       VALUES ($1,$2,$3)
       ON CONFLICT (public_id) DO UPDATE SET platform = EXCLUDED.platform, updated_at = now()
       RETURNING id`,
      [devUser.rows[0]?.id ?? null, input.devicePublicId, input.platform],
    );

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const nonce = randomBytes(24).toString('hex');

    const result = await this.db.query(
      `INSERT INTO capture_sessions(
        public_id, task_id, user_id, device_id, nonce, target_location,
        max_distance_m, max_accuracy_m, verification_policy_version,
        task_snapshot, server_expires_at, status
       ) VALUES (
        $1,$2,$3,$4,$5,
        ST_SetSRID(ST_MakePoint($6,$7),4326)::geography,
        $8,$9,$10,$11::jsonb,$12,'READY'
       ) RETURNING id, public_id, server_started_at, server_expires_at, status`,
      [
        makePublicId('GR-CS'),
        input.taskId,
        devUser.rows[0]?.id ?? null,
        device.rows[0].id,
        nonce,
        task.target.longitude,
        task.target.latitude,
        task.maxDistanceM,
        task.maxAccuracyM,
        task.policyVersion,
        JSON.stringify(task),
        expiresAt.toISOString(),
      ],
    );

    const row = result.rows[0] as any;
    return {
      id: row.id,
      publicId: row.public_id,
      nonce,
      serverStartedAt: row.server_started_at,
      serverExpiresAt: row.server_expires_at,
      status: row.status,
      task,
    };
  }

  async getSession(id: string) {
    const result = await this.db.query(
      `SELECT *,
        ST_Y(target_location::geometry) AS target_latitude,
        ST_X(target_location::geometry) AS target_longitude
       FROM capture_sessions WHERE id=$1`,
      [id],
    );
    if (!result.rowCount) throw new NotFoundException('Capture session not found');
    return result.rows[0] as any;
  }

  async addLocationSample(
    sessionId: string,
    input: {
      latitude: number;
      longitude: number;
      accuracyM: number;
      altitudeM?: number | null;
      headingDeg?: number | null;
      speedMps?: number | null;
      deviceTimestamp: string;
    },
  ) {
    const session = await this.getSession(sessionId);
    if (new Date(session.server_expires_at).getTime() < Date.now()) {
      await this.db.query(`UPDATE capture_sessions SET status='EXPIRED', updated_at=now() WHERE id=$1`, [sessionId]);
      throw new ConflictException('Capture session expired');
    }

    const result = await this.db.query(
      `WITH inserted AS (
         INSERT INTO location_samples(
           capture_session_id, location, accuracy_m, altitude_m, heading_deg, speed_mps, device_timestamp
         ) VALUES (
           $1, ST_SetSRID(ST_MakePoint($2,$3),4326)::geography, $4,$5,$6,$7,$8
         ) RETURNING id
       )
       SELECT
         ST_Distance(
           ST_SetSRID(ST_MakePoint($2,$3),4326)::geography,
           cs.target_location
         )::float8 AS distance_m,
         cs.max_distance_m::float8 AS max_distance_m,
         cs.max_accuracy_m::float8 AS max_accuracy_m
       FROM capture_sessions cs
       WHERE cs.id=$1`,
      [
        sessionId,
        input.longitude,
        input.latitude,
        input.accuracyM,
        input.altitudeM ?? null,
        input.headingDeg ?? null,
        input.speedMps ?? null,
        input.deviceTimestamp,
      ],
    );

    const row = result.rows[0] as any;
    const withinDistance = row.distance_m <= row.max_distance_m;
    const accuracyGood = input.accuracyM <= row.max_accuracy_m;
    const canCapture = withinDistance && accuracyGood;

    if (canCapture && session.status === 'READY') {
      await this.db.query(`UPDATE capture_sessions SET status='CAPTURING', updated_at=now() WHERE id=$1`, [sessionId]);
    }

    return {
      distanceM: Math.round(row.distance_m * 10) / 10,
      accuracyM: input.accuracyM,
      withinDistance,
      accuracyGood,
      canCapture,
    };
  }
}
