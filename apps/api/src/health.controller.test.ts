import { describe, expect, it } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('בדיקות בריאות השרת', () => {
  it('זמינות התהליך אינה תלויה בזמינות בסיס הנתונים', () => {
    const controller = new HealthController({ isReady: async () => false });
    expect(controller.live()).toEqual({
      status: 'ok',
      service: 'api',
      stage: 'foundation',
    });
  });

  it('אינו מצהיר על מוכנות כשהתלות אינה מוכנה', async () => {
    const controller = new HealthController({ isReady: async () => false });
    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('מחזיר מוכנות לאחר בדיקת התלות', async () => {
    const controller = new HealthController({ isReady: async () => true });
    expect(await controller.ready()).toEqual({
      status: 'ready',
      checks: { database: 'ok' },
    });
  });
});
