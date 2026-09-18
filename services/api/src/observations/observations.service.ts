import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { makePublicId } from '../common/public-id';
import { CaptureSessionsService } from '../capture-sessions/capture-sessions.service';

@Injectable()
export class ObservationsService {
  constructor(
    private readonly db: DbService,
    private readonly sessions: CaptureSessionsService,
  ) {}

  async submit(input: { captureSessionId: string; answer: 'YES' | 'NO' | 'UNCERTAIN'; note?: string }) {
    const session = await this.sessions.getSession(input.captureSessionId);
    if (!['CAPTURING', 'READY', 'SUBMITTED'].includes(session.status)) {
      throw new ConflictException(`Session cannot be submitted: ${session.status}`);
    }

    const task = session.task_snapshot as any;
    const evidenceResult = await this.db.query(
      `SELECT media_type, integrity_status, count(*)::int AS count
       FROM media_evidence
       WHERE capture_session_id=$1
       GROUP BY media_type, integrity_status`,
      [input.captureSessionId],
    );

    const matchedPhotos = evidenceResult.rows
      .filter((r: any) => r.media_type === 'photo' && r.integrity_status === 'MATCHED')
      .reduce((sum: number, r: any) => sum + Number(r.count), 0);
    const matchedVideos = evidenceResult.rows
      .filter((r: any) => r.media_type === 'video' && r.integrity_status === 'MATCHED')
      .reduce((sum: number, r: any) => sum + Number(r.count), 0);

    const integrityFailures = evidenceResult.rows.some((r: any) => r.integrity_status === 'FAILED');
    const taskComplete =
      matchedPhotos >= Number(task.requiredPhotoCount ?? 1) &&
      matchedVideos >= Number(task.requiredVideoCount ?? 0);

    const locationResult = await this.db.query(
      `SELECT
         MIN(ST_Distance(ls.location, cs.target_location))::float8 AS min_distance_m,
         MIN(ls.accuracy_m)::float8 AS best_accuracy_m,
         cs.max_distance_m::float8,
         cs.max_accuracy_m::float8
       FROM capture_sessions cs
       LEFT JOIN location_samples ls ON ls.capture_session_id = cs.id
       WHERE cs.id=$1
       GROUP BY cs.id`,
      [input.captureSessionId],
    );
    const loc = locationResult.rows[0] as any;
    const locationPass =
      loc.min_distance_m != null && loc.best_accuracy_m != null &&
      loc.min_distance_m <= loc.max_distance_m && loc.best_accuracy_m <= loc.max_accuracy_m;

    const locationScore = locationPass ? 100 : 0;
    const timeScore = new Date(session.server_expires_at).getTime() >= Date.now() ? 100 : 0;
    const deviceScore = 60; // Conservative until App Attest / Play Integrity is implemented.
    const mediaIntegrityScore = integrityFailures ? 0 : taskComplete ? 100 : 50;
    const taskCompletionScore = taskComplete ? 100 : 0;
    const confidence = Math.round(
      locationScore * 0.3 +
      timeScore * 0.15 +
      deviceScore * 0.15 +
      mediaIntegrityScore * 0.25 +
      taskCompletionScore * 0.15,
    );

    let verificationStatus: 'VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED';
    let reviewReason: string | null = null;
    if (integrityFailures || !locationPass) {
      verificationStatus = 'REJECTED';
      reviewReason = integrityFailures ? 'Evidence integrity failed' : 'Location requirements not met';
    } else if (!taskComplete || input.answer === 'UNCERTAIN' || confidence < 80) {
      verificationStatus = 'NEEDS_REVIEW';
      reviewReason = !taskComplete ? 'Required evidence incomplete' : 'Manual review required';
    } else {
      verificationStatus = 'VERIFIED';
    }

    const valueBoolean = input.answer === 'YES' ? true : input.answer === 'NO' ? false : null;

    const output = await this.db.transaction(async (client) => {
      const previous = await client.query<{ id: string }>(
        `SELECT id FROM observations WHERE feature_id=$1 ORDER BY observed_at DESC LIMIT 1`,
        [task.featureId],
      );

      const observation = await client.query<{ id: string; public_id: string; observed_at: string }>(
        `INSERT INTO observations(
          public_id, feature_id, capture_session_id, question_type,
          value_boolean, value_text, value_json, observed_at, supersedes_observation_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,now(),$8)
        RETURNING id, public_id, observed_at`,
        [
          makePublicId('GR-OBS'),
          task.featureId,
          input.captureSessionId,
          task.questionType,
          valueBoolean,
          input.answer === 'UNCERTAIN' ? 'UNCERTAIN' : null,
          JSON.stringify({ answer: input.answer, note: input.note ?? null }),
          previous.rows[0]?.id ?? null,
        ],
      );

      const obs = observation.rows[0];
      await client.query(
        `INSERT INTO verifications(
          observation_id, location_score, time_score, device_score,
          media_integrity_score, task_completion_score, confidence_score,
          status, policy_version, verified_at, review_reason
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          obs.id, locationScore, timeScore, deviceScore, mediaIntegrityScore,
          taskCompletionScore, confidence, verificationStatus,
          task.policyVersion ?? '1.0', verificationStatus === 'VERIFIED' ? new Date().toISOString() : null,
          reviewReason,
        ],
      );

      const policyDays = Number(task.freshnessPolicyDays ?? 30);
      const freshFrom = new Date(obs.observed_at);
      const freshUntil = new Date(freshFrom.getTime() + policyDays * 86400000);
      const agingFrom = new Date(freshFrom.getTime() + Math.floor(policyDays * 0.75) * 86400000);
      await client.query(
        `INSERT INTO freshness_records(observation_id, fresh_from, fresh_until, aging_from, status, policy_days)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          obs.id,
          freshFrom.toISOString(),
          freshUntil.toISOString(),
          agingFrom.toISOString(),
          verificationStatus === 'VERIFIED' ? 'FRESH' : 'UNKNOWN',
          policyDays,
        ],
      );

      await client.query(`UPDATE capture_sessions SET status='COMPLETED', updated_at=now() WHERE id=$1`, [input.captureSessionId]);
      await client.query(
        `INSERT INTO audit_events(entity_type, entity_id, event_type, payload)
         VALUES ('OBSERVATION',$1,'OBSERVATION_CREATED',$2::jsonb)`,
        [obs.id, JSON.stringify({ verificationStatus, confidence })],
      );

      return { obs, freshUntil };
    });

    return {
      observation: {
        id: output.obs.id,
        publicId: output.obs.public_id,
        featureId: task.featureId,
        featureName: task.featureName,
        placeName: task.placeName,
        questionType: task.questionType,
        questionText: task.questionText,
        answer: input.answer,
        observedAt: output.obs.observed_at,
      },
      verification: {
        status: verificationStatus,
        confidence,
        scores: {
          location: locationScore,
          time: timeScore,
          device: deviceScore,
          mediaIntegrity: mediaIntegrityScore,
          taskCompletion: taskCompletionScore,
        },
        reviewReason,
        policyVersion: task.policyVersion ?? '1.0',
      },
      freshness: {
        status: verificationStatus === 'VERIFIED' ? 'FRESH' : 'UNKNOWN',
        freshUntil: output.freshUntil.toISOString(),
        policyDays: Number(task.freshnessPolicyDays ?? 30),
      },
    };
  }

  async get(id: string) {
    const result = await this.db.query(
      `SELECT
        o.id, o.public_id, o.question_type, o.value_boolean, o.value_text, o.value_json,
        o.observed_at, o.supersedes_observation_id,
        f.name AS feature_name, f.feature_type,
        p.name AS place_name,
        v.status AS verification_status, v.confidence_score::float8, v.policy_version,
        fr.status AS freshness_status, fr.fresh_until
       FROM observations o
       JOIN features f ON f.id=o.feature_id
       JOIN places p ON p.id=f.place_id
       JOIN verifications v ON v.observation_id=o.id
       JOIN freshness_records fr ON fr.observation_id=o.id
       WHERE o.id=$1`,
      [id],
    );
    if (!result.rowCount) throw new NotFoundException('Observation not found');
    return result.rows[0];
  }
}
