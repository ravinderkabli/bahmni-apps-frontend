import { ServiceRequestViewModel } from '../models';
import {
  PRIORITY_ORDER,
  getServiceRequestPriority,
  sortServiceRequestsByPriority,
} from '../utils';

const createMockServiceRequest = (
  id: string,
  testName: string,
  priority: string,
  orderedDate: string,
): ServiceRequestViewModel => ({
  id,
  testName,
  priority,
  orderedDate,
  orderedBy: 'Dr Test',
  status: 'active',
});

describe('genericServiceRequest utilities', () => {
  describe('PRIORITY_ORDER', () => {
    it('should define correct priority order', () => {
      expect(PRIORITY_ORDER).toEqual(['stat', 'routine']);
    });
  });

  describe('getServiceRequestPriority', () => {
    it('should return correct priority index for known priorities', () => {
      expect(getServiceRequestPriority('stat')).toBe(0);
      expect(getServiceRequestPriority('routine')).toBe(1);
    });

    it('should return 999 for unknown priority', () => {
      expect(getServiceRequestPriority('unknown')).toBe(999);
      expect(getServiceRequestPriority('')).toBe(999);
    });

    it('should handle case insensitive matching', () => {
      expect(getServiceRequestPriority('STAT')).toBe(0);
      expect(getServiceRequestPriority('Routine')).toBe(1);
    });
  });

  describe('sortServiceRequestsByPriority', () => {
    it('should sort requests by priority (stat before routine)', () => {
      const requests = [
        createMockServiceRequest(
          '2',
          'Routine Procedure',
          'routine',
          '2023-12-01T09:00:00.000Z',
        ),
        createMockServiceRequest(
          '1',
          'Stat Procedure',
          'stat',
          '2023-12-01T08:00:00.000Z',
        ),
      ];

      const sorted = sortServiceRequestsByPriority(requests);

      expect(sorted[0].priority).toBe('stat');
      expect(sorted[1].priority).toBe('routine');
    });

    it('should sort same-priority requests by orderedDate descending (newest first)', () => {
      const requests = [
        createMockServiceRequest(
          '1',
          'Old Procedure',
          'routine',
          '2023-12-01T08:00:00.000Z',
        ),
        createMockServiceRequest(
          '2',
          'New Procedure',
          'routine',
          '2023-12-01T14:00:00.000Z',
        ),
        createMockServiceRequest(
          '3',
          'Mid Procedure',
          'routine',
          '2023-12-01T11:00:00.000Z',
        ),
      ];

      const sorted = sortServiceRequestsByPriority(requests);

      expect(sorted[0].id).toBe('2'); // newest
      expect(sorted[1].id).toBe('3'); // middle
      expect(sorted[2].id).toBe('1'); // oldest
    });

    it('should sort stat by date descending, then routine by date descending', () => {
      const requests = [
        createMockServiceRequest(
          '1',
          'Old Routine',
          'routine',
          '2023-12-01T08:00:00.000Z',
        ),
        createMockServiceRequest(
          '2',
          'Old Stat',
          'stat',
          '2023-12-01T08:00:00.000Z',
        ),
        createMockServiceRequest(
          '3',
          'New Routine',
          'routine',
          '2023-12-01T15:00:00.000Z',
        ),
        createMockServiceRequest(
          '4',
          'New Stat',
          'stat',
          '2023-12-01T15:00:00.000Z',
        ),
      ];

      const sorted = sortServiceRequestsByPriority(requests);

      expect(sorted[0].id).toBe('4'); // newest stat
      expect(sorted[1].id).toBe('2'); // older stat
      expect(sorted[2].id).toBe('3'); // newest routine
      expect(sorted[3].id).toBe('1'); // older routine
    });

    it('should handle empty array', () => {
      const sorted = sortServiceRequestsByPriority([]);
      expect(sorted).toEqual([]);
    });

    it('should not mutate original array', () => {
      const requests = [
        createMockServiceRequest(
          '2',
          'Routine',
          'routine',
          '2023-12-01T09:00:00.000Z',
        ),
        createMockServiceRequest(
          '1',
          'Stat',
          'stat',
          '2023-12-01T08:00:00.000Z',
        ),
      ];
      const originalOrder = [...requests];

      sortServiceRequestsByPriority(requests);

      expect(requests).toEqual(originalOrder);
    });
  });
});
