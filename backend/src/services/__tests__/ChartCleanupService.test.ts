const mockPrisma = {
  $transaction: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

import { purgeExpiredChartData } from '../ChartCleanupService';

describe('ChartCleanupService', () => {
  it('detaches reflections before deleting expired courses and purges stale proposals', async () => {
    const tx = {
      course: {
        findMany: jest.fn().mockResolvedValue([{ id: 'course-old' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      waypoint: {
        findMany: jest.fn().mockResolvedValue([{ id: 'waypoint-old' }]),
      },
      reflection: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      aIPlanProposal: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

    await expect(purgeExpiredChartData(new Date('2026-08-02T00:00:00.000Z'))).resolves.toEqual({
      coursesDeleted: 1,
      reflectionsDetached: 2,
      proposalsDeleted: 3,
    });
    expect(tx.reflection.updateMany).toHaveBeenCalledWith({
      where: {
        OR: [{ courseId: { in: ['course-old'] } }, { waypointId: { in: ['waypoint-old'] } }],
      },
      data: { courseId: null, waypointId: null },
    });
    expect(tx.course.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['course-old'] } } });
  });
});
