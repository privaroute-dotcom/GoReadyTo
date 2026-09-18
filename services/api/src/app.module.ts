import { Module } from '@nestjs/common';
import { DbService } from './db/db.service';
import { HealthController } from './health/health.controller';
import { TasksController } from './tasks/tasks.controller';
import { TasksService } from './tasks/tasks.service';
import { DevController } from './dev/dev.controller';
import { CaptureSessionsController } from './capture-sessions/capture-sessions.controller';
import { CaptureSessionsService } from './capture-sessions/capture-sessions.service';
import { EvidenceController } from './evidence/evidence.controller';
import { EvidenceService } from './evidence/evidence.service';
import { ObservationsController } from './observations/observations.controller';
import { ObservationsService } from './observations/observations.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';

@Module({
  controllers: [
    HealthController,
    TasksController,
    DevController,
    CaptureSessionsController,
    EvidenceController,
    ObservationsController,
    AuthController,
  ],
  providers: [
    DbService,
    TasksService,
    CaptureSessionsService,
    EvidenceService,
    ObservationsService,
    AuthService,
  ],
})
export class AppModule {}
