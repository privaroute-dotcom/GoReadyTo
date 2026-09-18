import { Body, Controller, Param, Post } from '@nestjs/common';
import { createCaptureSessionSchema, locationSampleSchema } from '@goreadyto/validation';
import { parseBody } from '../common/parse';
import { CaptureSessionsService } from './capture-sessions.service';

@Controller('v1/capture-sessions')
export class CaptureSessionsController {
  constructor(private readonly sessions: CaptureSessionsService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.sessions.create(parseBody(createCaptureSessionSchema, body));
  }

  @Post(':sessionId/location-samples')
  addLocation(@Param('sessionId') sessionId: string, @Body() body: unknown) {
    return this.sessions.addLocationSample(sessionId, parseBody(locationSampleSchema, body));
  }
}
