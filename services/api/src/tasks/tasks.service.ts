import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class TasksService {
  constructor(private readonly db: DbService) {}

  async getTask(id: string) {
    const result = await this.db.query(
      `SELECT
        t.id,
        t.public_id,
        t.question_type,
        t.question_text,
        t.required_photo_count,
        t.required_video_count,
        t.max_distance_m::float8,
        t.max_accuracy_m::float8,
        t.freshness_policy_days,
        t.policy_version,
        f.id AS feature_id,
        f.public_id AS feature_public_id,
        f.name AS feature_name,
        f.feature_type,
        p.id AS place_id,
        p.public_id AS place_public_id,
        p.name AS place_name,
        ST_Y(COALESCE(f.location, p.location)::geometry) AS latitude,
        ST_X(COALESCE(f.location, p.location)::geometry) AS longitude
      FROM verification_tasks t
      JOIN features f ON f.id = t.feature_id
      JOIN places p ON p.id = f.place_id
      WHERE t.id = $1 AND t.status = 'OPEN'`,
      [id],
    );

    if (!result.rowCount) throw new NotFoundException('Verification task not found');
    const r = result.rows[0] as any;

    return {
      id: r.id,
      publicId: r.public_id,
      placeId: r.place_id,
      placePublicId: r.place_public_id,
      placeName: r.place_name,
      featureId: r.feature_id,
      featurePublicId: r.feature_public_id,
      featureName: r.feature_name,
      featureType: r.feature_type,
      questionType: r.question_type,
      questionText: r.question_text,
      target: { latitude: r.latitude, longitude: r.longitude },
      requiredPhotoCount: r.required_photo_count,
      requiredVideoCount: r.required_video_count,
      maxDistanceM: r.max_distance_m,
      maxAccuracyM: r.max_accuracy_m,
      freshnessPolicyDays: r.freshness_policy_days,
      policyVersion: r.policy_version,
    };
  }
}
