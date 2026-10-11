import { ForecastingService } from './forecasting.service';
import { PrismaService } from '../prisma/prisma.service';

describe('forecast scheduler ownership', () => {
  const original = process.env.ENABLE_BACKGROUND_JOBS;
  afterEach(() => {
    if (original === undefined) delete process.env.ENABLE_BACKGROUND_JOBS;
    else process.env.ENABLE_BACKGROUND_JOBS = original;
    jest.restoreAllMocks();
  });

  it('does not schedule forecast work in API replicas', () => {
    process.env.ENABLE_BACKGROUND_JOBS = 'false';
    const service = new ForecastingService({} as PrismaService);
    const check = jest.spyOn(service, 'checkSchedule').mockResolvedValue();
    const interval = jest.spyOn(global, 'setInterval');
    const timeout = jest.spyOn(global, 'setTimeout');
    service.onModuleInit();
    expect(check).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
    service.onModuleDestroy();
  });

  it('starts automatic forecasting on the designated worker', () => {
    process.env.ENABLE_BACKGROUND_JOBS = 'true';
    const service = new ForecastingService({} as PrismaService);
    const check = jest.spyOn(service, 'checkSchedule').mockResolvedValue();
    service.onModuleInit();
    expect(check).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
  });
});
