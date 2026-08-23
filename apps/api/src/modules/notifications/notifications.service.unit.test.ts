import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationsService } from './notifications.service';
import { notificationsRepository } from './notifications.repository';
import { AppError } from '../../infrastructure/errors';

vi.mock('./notifications.repository');

describe('NotificationsService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('markAsRead', () => {
    it('rejects if notification belongs to another user', async () => {
      vi.mocked(notificationsRepository.findById).mockResolvedValue({
        id: 'n1', userId: 'userA', type: 'MENTION', sourceType: 'COMMENT', sourceId: 'c1', message: 'Hi', read: false, createdAt: new Date()
      });

      await expect(notificationsService.markAsRead('userB', 'n1'))
        .rejects.toThrowError(new AppError('Notification not found', 404, 'NOT_FOUND'));
    });
  });
});
