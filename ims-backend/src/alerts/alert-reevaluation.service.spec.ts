process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/ims_test_disabled?schema=public';
process.env.SESSION_TOKEN_SECRET ??= 'test-session-secret';
process.env.RESET_TOKEN_SECRET ??= 'test-reset-secret';
process.env.FRONTEND_ORIGIN ??= 'http://localhost:3000';
process.env.FRONTEND_APP_URL ??= 'http://localhost:3000';
process.env.SESSION_COOKIE_NAME ??= 'ims_session';

import { AlertReevaluationService } from './alert-reevaluation.service';

describe('AlertReevaluationService startup gating', () => {
  const originalEnableBackgroundJobs = process.env.ENABLE_BACKGROUND_JOBS;

  const alertsService = {
    reevaluateAllOperationalAlerts: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();

    if (originalEnableBackgroundJobs === undefined) {
      delete process.env.ENABLE_BACKGROUND_JOBS;
    } else {
      process.env.ENABLE_BACKGROUND_JOBS = originalEnableBackgroundJobs;
    }
  });

  function createService() {
    return new AlertReevaluationService(alertsService as never);
  }

  it('does not run or schedule reevaluation when background jobs are disabled', () => {
    process.env.ENABLE_BACKGROUND_JOBS = 'false';
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const service = createService();
    const reevaluateSpy = jest
      .spyOn(service, 'reevaluateNow')
      .mockResolvedValue(undefined);

    service.onModuleInit();

    expect(reevaluateSpy).not.toHaveBeenCalled();
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(alertsService.reevaluateAllOperationalAlerts).not.toHaveBeenCalled();
  });

  it('still allows explicit reevaluation when background jobs are disabled', async () => {
    process.env.ENABLE_BACKGROUND_JOBS = 'false';
    const service = createService();
    alertsService.reevaluateAllOperationalAlerts.mockResolvedValue(undefined);

    await service.reevaluateNow();

    expect(alertsService.reevaluateAllOperationalAlerts).toHaveBeenCalledTimes(
      1,
    );
  });

  it('runs immediately, schedules once, and clears the timer when enabled', () => {
    process.env.ENABLE_BACKGROUND_JOBS = 'true';
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const service = createService();
    const reevaluateSpy = jest
      .spyOn(service, 'reevaluateNow')
      .mockResolvedValue(undefined);

    service.onModuleInit();
    service.onModuleInit();

    expect(reevaluateSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});
