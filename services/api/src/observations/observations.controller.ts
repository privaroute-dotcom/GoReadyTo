import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { submitObservationSchema } from '@goreadyto/validation';
import { parseBody } from '../common/parse';
import { ObservationsService } from './observations.service';

@Controller('v1/observations')
export class ObservationsController {
  constructor(private readonly observations: ObservationsService) {}

  @Post()
  submit(@Body() body: unknown) {
    return this.observations.submit(parseBody(submitObservationSchema, body));
  }

  @Get(':observationId')
  get(@Param('observationId') observationId: string) {
    return this.observations.get(observationId);
  }
}
