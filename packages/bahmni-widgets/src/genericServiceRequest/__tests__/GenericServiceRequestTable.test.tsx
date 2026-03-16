import {
  useTranslation,
  getFormattedError,
  getCategoryUuidFromOrderTypes,
  getServiceRequests,
  useSubscribeConsultationSaved,
  shouldEnableEncounterFilter,
} from '@bahmni/services';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { Bundle, ServiceRequest } from 'fhir/r4';
import { axe, toHaveNoViolations } from 'jest-axe';

import { usePatientUUID } from '../../hooks/usePatientUUID';
import { useNotification } from '../../notification';
import GenericServiceRequestTable from '../GenericServiceRequestTable';
import { ServiceRequestViewModel } from '../models';
import {
  filterServiceRequestReplacementEntries,
  getServiceRequestPriority,
  mapServiceRequest,
} from '../utils';

expect.extend(toHaveNoViolations);

jest.mock('@bahmni/services', () => ({
  ...jest.requireActual('@bahmni/services'),
  useTranslation: jest.fn(),
  getFormattedError: jest.fn(),
  getCategoryUuidFromOrderTypes: jest.fn(),
  getServiceRequests: jest.fn(),
  useSubscribeConsultationSaved: jest.fn(),
  shouldEnableEncounterFilter: jest.fn(),
}));

jest.mock('../utils', () => ({
  filterServiceRequestReplacementEntries: jest.fn(),
  getServiceRequestPriority: jest.fn(),
  mapServiceRequest: jest.fn(),
}));

jest.mock('../../hooks/usePatientUUID', () => ({
  usePatientUUID: jest.fn(),
}));

jest.mock('../../notification', () => ({
  useNotification: jest.fn(),
}));

const mockUseTranslation = jest.mocked(useTranslation);
const mockGetFormattedError = jest.mocked(getFormattedError);
const mockGetCategoryUuidFromOrderTypes = jest.mocked(
  getCategoryUuidFromOrderTypes,
);
const mockGetServiceRequests = jest.mocked(getServiceRequests);
const mockFilterServiceRequestReplacementEntries = jest.mocked(
  filterServiceRequestReplacementEntries,
);
const mockGetServiceRequestPriority = jest.mocked(getServiceRequestPriority);
const mockMapServiceRequest = jest.mocked(mapServiceRequest);
const mockUsePatientUUID = jest.mocked(usePatientUUID);
const mockUseNotification = jest.mocked(useNotification);
const mockUseSubscribeConsultationSaved = jest.mocked(
  useSubscribeConsultationSaved,
);
const mockShouldEnableEncounterFilter = jest.mocked(
  shouldEnableEncounterFilter,
);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });

  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockServiceRequestBundle = {
  resourceType: 'Bundle',
  type: 'searchset',
  entry: [],
} as Bundle<ServiceRequest>;

const mockServiceRequests: ServiceRequestViewModel[] = [
  {
    id: 'service-1',
    testName: 'Blood Test',
    priority: 'stat',
    orderedBy: 'Dr. Smith',
    orderedDate: '2023-12-01T10:30:00.000Z',
    status: 'active',
  },
  {
    id: 'service-2',
    testName: 'Urine Test',
    priority: 'routine',
    orderedBy: 'Dr. Johnson',
    orderedDate: '2023-12-01T14:15:00.000Z',
    status: 'active',
  },
  {
    id: 'service-3',
    testName: 'Liver Function Test',
    priority: 'stat',
    orderedBy: 'Dr. Brown',
    orderedDate: '2023-11-30T09:00:00.000Z',
    status: 'active',
  },
];

describe('GenericServiceRequestTable', () => {
  const mockAddNotification = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTranslation.mockReturnValue({
      t: (key: string) => {
        const translations: Record<string, string> = {
          SERVICE_REQUEST_TEST_NAME: 'Test Name',
          SERVICE_REQUEST_ORDERED_BY: 'Ordered By',
          SERVICE_REQUEST_ORDERED_STATUS: 'Status',
          SERVICE_REQUEST_HEADING: 'Service Requests',
          NO_SERVICE_REQUESTS: 'No service requests recorded',
          SERVICE_REQUEST_PRIORITY_URGENT: 'Urgent',
          ERROR_DEFAULT_TITLE: 'Error',
          IN_PROGRESS_STATUS: 'In Progress',
          COMPLETED_STATUS: 'Completed',
          REVOKED_STATUS: 'Revoked',
          UNKNOWN_STATUS: 'Unknown',
        };
        return translations[key] || key;
      },
      i18n: {} as any,
      ready: true,
    } as any);

    mockUsePatientUUID.mockReturnValue('patient-123');
    mockUseNotification.mockReturnValue({
      addNotification: mockAddNotification,
      notifications: [],
      removeNotification: jest.fn(),
      clearAllNotifications: jest.fn(),
    });

    mockGetFormattedError.mockReturnValue({
      message: 'Network error',
      title: '',
    });
    mockFilterServiceRequestReplacementEntries.mockImplementation(
      (data) => data,
    );
    // getServiceRequestPriority returns 0 for 'stat', 1 for 'routine' by default
    mockGetServiceRequestPriority.mockImplementation((priority: string) => {
      const PRIORITY_ORDER = ['stat', 'routine'];
      const idx = PRIORITY_ORDER.indexOf(priority?.toLowerCase());
      return idx === -1 ? PRIORITY_ORDER.length : idx;
    });
    mockGetCategoryUuidFromOrderTypes.mockResolvedValue('lab-uuid');
    mockGetServiceRequests.mockResolvedValue(mockServiceRequestBundle);
    mockMapServiceRequest.mockReturnValue(mockServiceRequests);
    mockUseSubscribeConsultationSaved.mockImplementation(() => {});
    mockShouldEnableEncounterFilter.mockReturnValue(false);
  });

  describe('Loading state', () => {
    it('renders loading state while fetching order types', async () => {
      mockGetCategoryUuidFromOrderTypes.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      expect(
        screen.getByTestId('generic-service-request-table-skeleton'),
      ).toBeInTheDocument();
    });

    it('renders loading state while fetching service requests', async () => {
      mockGetServiceRequests.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('generic-service-request-table-skeleton'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    it('renders error state when order types fetch fails', async () => {
      mockGetCategoryUuidFromOrderTypes.mockRejectedValue(
        new Error('Order types error'),
      );

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith({
          title: 'Error',
          message: 'Network error',
          type: 'error',
        });
      });
    });

    it('renders error state when service requests fetch fails', async () => {
      mockGetServiceRequests.mockRejectedValue(
        new Error('Service requests error'),
      );

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith({
          title: 'Error',
          message: 'Network error',
          type: 'error',
        });
      });
    });

    it('displays error message in table when there is an error', async () => {
      mockGetCategoryUuidFromOrderTypes.mockRejectedValue(
        new Error('Network error'),
      );

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Empty state', () => {
    it('renders empty state when no service requests', async () => {
      mockMapServiceRequest.mockReturnValue([]);

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(
          screen.getByText('No service requests recorded'),
        ).toBeInTheDocument();
      });
    });

    it('renders error state when orderType not found in order types', async () => {
      mockGetCategoryUuidFromOrderTypes.mockRejectedValue(
        new Error('Order type not found'),
      );

      render(
        <GenericServiceRequestTable
          config={{ orderType: 'Unknown OrderType' }}
        />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('generic-service-request-table-error'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Data processing pipeline', () => {
    it('filters replacement entries before sorting', async () => {
      const filteredRequests = [mockServiceRequests[0], mockServiceRequests[2]];
      mockFilterServiceRequestReplacementEntries.mockReturnValue(
        filteredRequests,
      );

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(mockFilterServiceRequestReplacementEntries).toHaveBeenCalledWith(
          mockServiceRequests,
        );
      });
    });

    it('processes data through the transformation pipeline', async () => {
      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(mockMapServiceRequest).toHaveBeenCalledWith(
          mockServiceRequestBundle,
        );
        expect(mockFilterServiceRequestReplacementEntries).toHaveBeenCalledWith(
          mockServiceRequests,
        );
      });
    });
  });

  describe('Flat list rendering', () => {
    it('renders a single SortableDataTable with all service requests', async () => {
      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Blood Test')).toBeInTheDocument();
        expect(screen.getByText('Urine Test')).toBeInTheDocument();
        expect(screen.getByText('Liver Function Test')).toBeInTheDocument();
      });
    });

    it('does not render any accordion elements', async () => {
      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Blood Test')).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId('accordian-table-title'),
      ).not.toBeInTheDocument();
    });

    it('renders service requests in a single table sorted by date descending', async () => {
      // After sorting by orderedDate descending:
      // [1] Urine Test (14:15 on 2023-12-01) -> first
      // [0] Blood Test (10:30 on 2023-12-01) -> second
      // [2] Liver Function Test (2023-11-30) -> third
      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // rows[0] is the header row; data rows follow
        const rowTexts = rows.map((r) => r.textContent);
        const urineIdx = rowTexts.findIndex((t) => t?.includes('Urine Test'));
        const bloodIdx = rowTexts.findIndex((t) => t?.includes('Blood Test'));
        const liverIdx = rowTexts.findIndex((t) =>
          t?.includes('Liver Function Test'),
        );
        // Urine Test (latest orderedDate on 2023-12-01 at 14:15) should appear before Blood Test (10:30)
        expect(urineIdx).toBeGreaterThan(0);
        expect(bloodIdx).toBeGreaterThan(0);
        expect(liverIdx).toBeGreaterThan(0);
        expect(urineIdx).toBeLessThan(bloodIdx);
        expect(bloodIdx).toBeLessThan(liverIdx);
      });
    });
  });

  describe('Date-descending sort', () => {
    it('places newer orderedDate items before older ones across all dates', async () => {
      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const rowTexts = rows.map((r) => r.textContent);
        const liverIdx = rowTexts.findIndex((t) =>
          t?.includes('Liver Function Test'),
        );
        const bloodIdx = rowTexts.findIndex((t) => t?.includes('Blood Test'));
        // 2023-11-30 items must appear after 2023-12-01 items
        expect(liverIdx).toBeGreaterThan(bloodIdx);
      });
    });

    it('uses priority as tiebreaker when orderedDates are equal (stat before routine)', async () => {
      // Blood Test: stat, 2023-12-01T10:30 -> priority index 0
      // Urine Test: routine, 2023-12-01T14:15 -> priority index 1
      // Urine has a later orderedDate so it comes first regardless of priority
      // For true same-date-time tiebreaker test, use requests with identical orderedDate
      const sameTimeStat: ServiceRequestViewModel = {
        id: 'same-1',
        testName: 'Same Time Stat',
        priority: 'stat',
        orderedBy: 'Dr. A',
        orderedDate: '2023-12-01T10:00:00.000Z',
        status: 'active',
      };
      const sameTimeRoutine: ServiceRequestViewModel = {
        id: 'same-2',
        testName: 'Same Time Routine',
        priority: 'routine',
        orderedBy: 'Dr. B',
        orderedDate: '2023-12-01T10:00:00.000Z',
        status: 'active',
      };

      mockMapServiceRequest.mockReturnValue([sameTimeRoutine, sameTimeStat]);
      mockFilterServiceRequestReplacementEntries.mockImplementation(
        (data) => data,
      );

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const rowTexts = rows.map((r) => r.textContent);
        const statIdx = rowTexts.findIndex((t) =>
          t?.includes('Same Time Stat'),
        );
        const routineIdx = rowTexts.findIndex((t) =>
          t?.includes('Same Time Routine'),
        );
        // stat should come before routine when orderedDates are equal
        expect(statIdx).toBeLessThan(routineIdx);
      });
    });
  });

  describe('OrderType UUID resolution', () => {
    it('finds orderType UUID by case-insensitive name matching', async () => {
      render(
        <GenericServiceRequestTable config={{ orderType: 'lab order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(mockGetServiceRequests).toHaveBeenCalledWith(
          'lab-uuid',
          'patient-123',
          undefined,
        );
      });
    });

    it('handles orderType name with different casing', async () => {
      mockGetCategoryUuidFromOrderTypes.mockResolvedValue('radiology-uuid');

      render(
        <GenericServiceRequestTable
          config={{ orderType: 'RADIOLOGY ORDER' }}
        />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(mockGetServiceRequests).toHaveBeenCalledWith(
          'radiology-uuid',
          'patient-123',
          undefined,
        );
      });
    });
  });

  describe('renderCell function', () => {
    const testServiceRequest: ServiceRequestViewModel = {
      id: 'test-1',
      testName: 'Test Service Request',
      priority: 'stat',
      orderedBy: 'Dr. Test',
      orderedDate: '2023-12-01T10:30:00.000Z',
      status: 'active',
    };

    beforeEach(() => {
      mockMapServiceRequest.mockReturnValue([testServiceRequest]);
      mockFilterServiceRequestReplacementEntries.mockImplementation(
        (data) => data,
      );
    });

    it('renders testName cell with service request name', async () => {
      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Test Service Request')).toBeInTheDocument();
      });
    });

    it('renders testName cell with urgent tag for stat priority', async () => {
      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Urgent')).toBeInTheDocument();
      });
    });

    it('renders testName cell without tag for routine priority', async () => {
      const routineServiceRequest = {
        ...testServiceRequest,
        priority: 'routine',
      };

      mockMapServiceRequest.mockReturnValue([routineServiceRequest]);

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Test Service Request')).toBeInTheDocument();
        expect(screen.queryByText('Urgent')).not.toBeInTheDocument();
      });
    });

    it('renders testName cell without tag for empty priority', async () => {
      const emptyPriorityServiceRequest = {
        ...testServiceRequest,
        priority: '',
      };

      mockMapServiceRequest.mockReturnValue([emptyPriorityServiceRequest]);

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.queryByText('Urgent')).not.toBeInTheDocument();
      });
    });

    it('renders testName cell with note tooltip when note is provided', async () => {
      const serviceRequestWithNote = {
        ...testServiceRequest,
        note: 'This is a test note for the service request',
      };

      mockMapServiceRequest.mockReturnValue([serviceRequestWithNote]);

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Test Service Request')).toBeInTheDocument();
        const tooltipIcon = screen.getByLabelText(
          'This is a test note for the service request',
        );
        expect(tooltipIcon).toBeInTheDocument();
      });
    });

    it('renders testName cell without note tooltip when note is not provided', async () => {
      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Test Service Request')).toBeInTheDocument();
        // Verify no tooltip icon is present by checking there's no element with aria-label matching the note pattern
        const tooltipIcons = screen.queryAllByRole('button', {
          name: /show information/i,
        });
        expect(tooltipIcons).toHaveLength(0);
      });
    });

    it('renders orderedBy cell with practitioner name', async () => {
      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Dr. Test')).toBeInTheDocument();
      });
    });

    it('renders orderedBy cell with empty string when not provided', async () => {
      const noOrderedByServiceRequest = {
        ...testServiceRequest,
        orderedBy: '',
      };

      mockMapServiceRequest.mockReturnValue([noOrderedByServiceRequest]);

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.queryByText('Dr. Test')).not.toBeInTheDocument();
      });
    });

    it('renders status cell with "In Progress" tag for active status', async () => {
      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('In Progress')).toBeInTheDocument();
      });
    });

    it('renders status cell with "Completed" tag for completed status', async () => {
      const completedServiceRequest = {
        ...testServiceRequest,
        status: 'completed',
      };

      mockMapServiceRequest.mockReturnValue([completedServiceRequest]);

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });
    });

    it('renders status cell with "Revoked" tag for revoked status', async () => {
      const revokedServiceRequest = {
        ...testServiceRequest,
        status: 'revoked',
      };

      mockMapServiceRequest.mockReturnValue([revokedServiceRequest]);

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Revoked')).toBeInTheDocument();
      });
    });

    it('renders status cell with "UNKNOWN_STATUS" tag for unknown status', async () => {
      const unknownServiceRequest = {
        ...testServiceRequest,
        status: 'unknown',
      };

      mockMapServiceRequest.mockReturnValue([unknownServiceRequest]);

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Unknown')).toBeInTheDocument();
      });
    });
  });

  describe('Edge cases', () => {
    it('handles single service request', async () => {
      const singleRequest = [mockServiceRequests[0]];
      mockMapServiceRequest.mockReturnValue(singleRequest);

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Blood Test')).toBeInTheDocument();
      });
    });

    it('handles mixed priority values correctly', async () => {
      const mixedPriorityServiceRequests: ServiceRequestViewModel[] = [
        {
          id: 'service-1',
          testName: 'Stat Test',
          priority: 'stat',
          orderedBy: 'Dr. Stat',
          orderedDate: '2023-12-01T10:30:00.000Z',
          status: 'active',
        },
        {
          id: 'service-2',
          testName: 'Routine Test',
          priority: 'routine',
          orderedBy: 'Dr. Routine',
          orderedDate: '2023-12-01T10:30:00.000Z',
          status: 'active',
        },
        {
          id: 'service-3',
          testName: 'Empty Priority Test',
          priority: '',
          orderedBy: 'Dr. Empty',
          orderedDate: '2023-12-01T10:30:00.000Z',
          status: 'active',
        },
      ];

      mockMapServiceRequest.mockReturnValue(mixedPriorityServiceRequests);

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Stat Test')).toBeInTheDocument();
        expect(screen.getByText('Routine Test')).toBeInTheDocument();
        expect(screen.getByText('Empty Priority Test')).toBeInTheDocument();
        expect(screen.getAllByText('Urgent')).toHaveLength(1);
      });
    });

    it('handles missing config gracefully', async () => {
      render(<GenericServiceRequestTable config={{}} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(
          screen.getByText('No service requests recorded'),
        ).toBeInTheDocument();
      });
    });

    it('handles missing patient UUID', async () => {
      mockUsePatientUUID.mockReturnValue(null);

      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(
          screen.getByText('No service requests recorded'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Table headers', () => {
    it('displays correct table headers', async () => {
      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Test Name')).toBeInTheDocument();
        expect(screen.getByText('Ordered By')).toBeInTheDocument();
      });
    });
  });

  describe('emptyEncounterFilter logic', () => {
    beforeEach(() => {
      mockMapServiceRequest.mockReturnValue(mockServiceRequests);
    });

    it('shows data table when emptyEncounterFilter is false', async () => {
      mockShouldEnableEncounterFilter.mockReturnValue(false);

      render(
        <GenericServiceRequestTable
          config={{ orderType: 'Lab Order' }}
          episodeOfCareUuids={[]}
          encounterUuids={undefined}
        />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Blood Test')).toBeInTheDocument();
      });
    });

    it('shows empty state when emptyEncounterFilter is true', async () => {
      mockShouldEnableEncounterFilter.mockReturnValue(true);

      render(
        <GenericServiceRequestTable
          config={{ orderType: 'Lab Order' }}
          episodeOfCareUuids={['episode-1']}
          encounterUuids={[]}
        />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(
          screen.getByText('No service requests recorded'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('EncounterUuids functionality', () => {
    it('passes encounterUuids to service call', async () => {
      render(
        <GenericServiceRequestTable
          config={{ orderType: 'Lab Order' }}
          encounterUuids={['encounter-1', 'encounter-2']}
        />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(mockGetServiceRequests).toHaveBeenCalledWith(
          'lab-uuid',
          'patient-123',
          ['encounter-1', 'encounter-2'],
        );
      });
    });

    it('handles empty encounter arrays', async () => {
      render(
        <GenericServiceRequestTable
          config={{ orderType: 'Lab Order' }}
          encounterUuids={[]}
        />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(mockGetServiceRequests).toHaveBeenCalledWith(
          'lab-uuid',
          'patient-123',
          [],
        );
      });
    });

    it('works without encounter UUIDs', async () => {
      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(mockGetServiceRequests).toHaveBeenCalledWith(
          'lab-uuid',
          'patient-123',
          undefined,
        );
      });
    });
  });

  describe('consultation saved event subscription', () => {
    it('registers consultation saved event listener', async () => {
      render(
        <GenericServiceRequestTable
          config={{ orderType: 'Procedure Order' }}
        />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(mockUseSubscribeConsultationSaved).toHaveBeenCalled();
      });
    });

    describe('event-driven refetch behavior', () => {
      let eventCallback: (payload: any) => void;

      beforeEach(async () => {
        eventCallback = () => {};
        mockUseSubscribeConsultationSaved.mockImplementation((callback) => {
          eventCallback = callback;
        });

        render(
          <GenericServiceRequestTable
            config={{ orderType: 'Procedure Order' }}
          />,
          { wrapper: createWrapper() },
        );

        await screen.findByText('Blood Test');

        mockGetServiceRequests.mockClear();
      });

      it('refetches data when consultation saved event is triggered with matching category', async () => {
        eventCallback({
          patientUUID: 'patient-123',
          updatedResources: {
            conditions: false,
            allergies: false,
            medications: false,
            serviceRequests: { 'procedure order': true },
          },
        });

        await waitFor(() => {
          expect(mockGetServiceRequests).toHaveBeenCalled();
        });
      });

      it('does not refetch when event is for different patient', async () => {
        eventCallback({
          patientUUID: 'different-patient',
          updatedResources: {
            conditions: false,
            allergies: false,
            medications: false,
            serviceRequests: { 'procedure order': true },
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(mockGetServiceRequests).not.toHaveBeenCalled();
      });

      it('does not refetch when different category was updated', async () => {
        eventCallback({
          patientUUID: 'patient-123',
          updatedResources: {
            conditions: false,
            allergies: false,
            medications: false,
            serviceRequests: { 'lab order': true },
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(mockGetServiceRequests).not.toHaveBeenCalled();
      });

      it('does not refetch when serviceRequests is empty', async () => {
        eventCallback({
          patientUUID: 'patient-123',
          updatedResources: {
            conditions: true,
            allergies: false,
            medications: false,
            serviceRequests: {},
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(mockGetServiceRequests).not.toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations with data', async () => {
      const { container } = render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Blood Test')).toBeInTheDocument();
      });

      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no accessibility violations in empty state', async () => {
      mockMapServiceRequest.mockReturnValue([]);

      const { container } = render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(
          screen.getByText('No service requests recorded'),
        ).toBeInTheDocument();
      });

      expect(await axe(container)).toHaveNoViolations();
    });

    it('has proper ARIA labels', async () => {
      render(
        <GenericServiceRequestTable config={{ orderType: 'Lab Order' }} />,
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        const tables = screen.getAllByLabelText('Service Requests');
        expect(tables.length).toBeGreaterThan(0);
      });
    });
  });
});
