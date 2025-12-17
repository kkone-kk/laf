import { Test, TestingModule } from '@nestjs/testing';
import { ProcessManagerService } from './process-manager.service';

describe('ProcessManagerService', () => {
  let service: ProcessManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProcessManagerService],
    }).compile();

    service = module.get<ProcessManagerService>(ProcessManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
