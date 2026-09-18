import { Body, Controller, Param, Post } from '@nestjs/common';
import { presignEvidenceSchema } from '@goreadyto/validation';
import { parseBody } from '../common/parse';
import { EvidenceService } from './evidence.service';

@Controller('v1/evidence')
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Post('presign')
  presign(@Body() body: unknown) {
    return this.evidence.presign(parseBody(presignEvidenceSchema, body));
  }

  @Post(':evidenceId/complete')
  complete(@Param('evidenceId') evidenceId: string) {
    return this.evidence.complete(evidenceId);
  }
}
