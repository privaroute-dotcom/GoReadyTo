import { Controller, Get, Param } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('v1/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get(':taskId')
  getTask(@Param('taskId') taskId: string) {
    return this.tasks.getTask(taskId);
  }
}
