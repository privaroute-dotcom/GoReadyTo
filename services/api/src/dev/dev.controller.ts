import { Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { bootstrapTaskSchema } from '@goreadyto/validation';
import { DbService } from '../db/db.service';
import { makePublicId } from '../common/public-id';
import { parseBody } from '../common/parse';

@Controller('v1/dev')
export class DevController {
  constructor(private readonly db: DbService) {}

  @Post('bootstrap-task')
  async bootstrap(@Body() body: unknown) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }

    const input = parseBody(bootstrapTaskSchema, body);

    return this.db.transaction(async (client) => {
      const place = await client.query<{ id: string; public_id: string }>(
        `INSERT INTO places(public_id, name, category, location)
         VALUES ($1, 'GoReadyTo Test Place', 'test', ST_SetSRID(ST_MakePoint($2,$3),4326)::geography)
         RETURNING id, public_id`,
        [makePublicId('GR-PLACE'), input.longitude, input.latitude],
      );

      const feature = await client.query<{ id: string; public_id: string }>(
        `INSERT INTO features(public_id, place_id, feature_type, name, location)
         VALUES ($1, $2, 'vehicle_entrance', 'Vehicle Entrance', ST_SetSRID(ST_MakePoint($3,$4),4326)::geography)
         RETURNING id, public_id`,
        [makePublicId('GR-FTR'), place.rows[0].id, input.longitude, input.latitude],
      );

      const task = await client.query<{ id: string; public_id: string }>(
        `INSERT INTO verification_tasks(
          public_id, feature_id, question_type, question_text,
          required_photo_count, required_video_count,
          max_distance_m, max_accuracy_m, freshness_policy_days,
          priority, policy_version, status
        ) VALUES ($1,$2,'vehicle_access',
          'Can a standard passenger vehicle currently access this entrance?',
          1,0,15,15,30,100,'1.0','OPEN')
        RETURNING id, public_id`,
        [makePublicId('GR-TASK'), feature.rows[0].id],
      );

      return {
        taskId: task.rows[0].id,
        taskPublicId: task.rows[0].public_id,
        placePublicId: place.rows[0].public_id,
        featurePublicId: feature.rows[0].public_id,
      };
    });
  }
}
