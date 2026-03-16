import {
  useTranslation,
  getCategoryUuidFromOrderTypes,
  getLabInvestigationsBundle,
  getDiagnosticReports,
  getDiagnosticReportBundle,
  useSubscribeConsultationSaved,
} from '@bahmni/services';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { Bundle, ServiceRequest, DiagnosticReport } from 'fhir/r4';

import { usePatientUUID } from '../../hooks/usePatientUUID';
import { useNotification } from '../../notification';
import LabInvestigation from '../LabInvestigation';
import {
  FormattedLabInvestigations,
  LabInvestigationPriority,
} from '../models';

jest.mock('@bahmni/services', () => ({
  ...jest.requireActual('@bahmni/services'),
  useTranslation: jest.fn(),
  getCategoryUuidFromOrderTypes: jest.fn(),
  getLabInvestigationsBundle: jest.fn(),
  getDiagnosticReports: jest.fn(),
  getDiagnosticReportBundle: jest.fn(),
  useSubscribeConsultationSaved: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
}));

jest.mock('../../notification', () => ({
  useNotification: jest.fn(),
}));

jest.mock('../../hooks/usePatientUUID', () => ({
  usePatientUUID: jest.fn(),
}));

jest.mock('../LabInvestigationItem', () => ({
  __esModule: true,
  default: ({ test }: { test: FormattedLabInvestigations }) => (
    <div data-testid="lab-investigation-item">
      <span data-testid="test-name">{test.testName}</span>
      <span data-testid="test-priority">{test.priority}</span>
    </div>
  ),
}));

const mockUseTranslation = jest.mocked(useTranslation);
const mockGetCategoryUuidFromOrderTypes = jest.mocked(
  getCategoryUuidFromOrderTypes,
);
const mockGetLabInvestigationsBundle = jest.mocked(getLabInvestigationsBundle);
const mockGetDiagnosticReports = jest.mocked(getDiagnosticReports);
const mockGetDiagnosticReportBundle = jest.mocked(getDiagnosticReportBundle);
const mockUseNotification = jest.mocked(useNotification);
const mockUsePatientUUID = jest.mocked(usePatientUUID);
const mockUseSubscribeConsultationSaved = jest.mocked(
  useSubscribeConsultationSaved,
);

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });

const renderLabInvestigations = (
  config: Record<string, unknown> = { orderType: 'Lab Order' },
  encounterUuids?: string[],
  episodeOfCareUuids?: string[],
) => {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <LabInvestigation
        config={config}
        encounterUuids={encounterUuids}
        episodeOfCareUuids={episodeOfCareUuids}
      />
    </QueryClientProvider>
  );
};

const createMockBundle = (
  resources: ServiceRequest[],
): Bundle<ServiceRequest> => ({
  resourceType: 'Bundle',
  type: 'searchset',
  entry: resources.map((resource) => ({
    resource,
  })),
});

const mockServiceRequests: ServiceRequest[] = [
  {
    resourceType: 'ServiceRequest',
    id: 'test-1',
    status: 'active',
    intent: 'order',
    subject: { reference: 'Patient/patient-123' },
    code: { text: 'Complete Blood Count' },
    priority: 'routine',
    requester: { display: 'Dr. Smith' },
    occurrencePeriod: { start: '2025-05-08T12:44:24+00:00' },
    extension: [
      {
        url: 'http://fhir.bahmni.org/ext/lab-order-concept-type',
        valueString: 'Panel',
      },
    ],
  },
  {
    resourceType: 'ServiceRequest',
    id: 'test-2',
    status: 'active',
    intent: 'order',
    subject: { reference: 'Patient/patient-123' },
    code: { text: 'Lipid Panel' },
    priority: 'stat',
    requester: { display: 'Dr. Johnson' },
    occurrencePeriod: { start: '2025-04-09T13:21:22+00:00' },
    extension: [
      {
        url: 'http://fhir.bahmni.org/ext/lab-order-concept-type',
        valueString: 'Panel',
      },
    ],
  },
  {
    resourceType: 'ServiceRequest',
    id: 'test-3',
    status: 'active',
    intent: 'order',
    subject: { reference: 'Patient/patient-123' },
    code: { text: 'Liver Function' },
    priority: 'routine',
    requester: { display: 'Dr. Williams' },
    occurrencePeriod: { start: '2025-04-09T13:21:22+00:00' },
  },
];

const translations: Record<string, string> = {
  LAB_TEST_ERROR_LOADING: 'Error loading lab tests',
  LAB_TEST_LOADING: 'Loading lab tests...',
  LAB_TEST_UNAVAILABLE: 'No lab investigations recorded',
  ERROR_DEFAULT_TITLE: 'Error',
};

const setupDefaultMocks = (
  bundle: Bundle<ServiceRequest> = createMockBundle(mockServiceRequests),
) => {
  mockUseTranslation.mockReturnValue({
    t: (key: string) => translations[key] || key,
  } as any);
  mockUsePatientUUID.mockReturnValue('patient-123');
  mockUseNotification.mockReturnValue({
    addNotification: jest.fn(),
    notifications: [],
    removeNotification: jest.fn(),
    clearAllNotifications: jest.fn(),
  });
  mockGetCategoryUuidFromOrderTypes.mockResolvedValue('lab-order-type-uuid');
  mockGetLabInvestigationsBundle.mockResolvedValue(bundle);
  mockGetDiagnosticReports.mockResolvedValue({
    resourceType: 'Bundle',
    type: 'searchset',
    entry: [],
  });
  mockGetDiagnosticReportBundle.mockResolvedValue({
    resourceType: 'Bundle',
    type: 'searchset',
    entry: [],
  });
  mockUseSubscribeConsultationSaved.mockImplementation(() => {});
};

describe('LabInvestigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('renders loading state with message', async () => {
    mockGetLabInvestigationsBundle.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(renderLabInvestigations());

    expect(screen.getByTestId('lab-skeleton')).toBeInTheDocument();
  });

  it('renders all lab tests as a flat list', async () => {
    render(renderLabInvestigations());

    await waitFor(() => {
      expect(screen.getByText('Complete Blood Count')).toBeInTheDocument();
    });

    const labItems = screen.getAllByTestId('lab-investigation-item');
    expect(labItems).toHaveLength(3);
  });

  it('renders empty state message when no lab tests', async () => {
    setupDefaultMocks(createMockBundle([]));
    render(renderLabInvestigations());

    await waitFor(() => {
      expect(
        screen.getByText('No lab investigations recorded'),
      ).toBeInTheDocument();
    });
  });

  it('renders error message when hasError is true', async () => {
    setupDefaultMocks(createMockBundle([]));
    mockGetLabInvestigationsBundle.mockRejectedValue(
      new Error('Failed to fetch'),
    );
    render(renderLabInvestigations());

    await waitFor(() => {
      expect(screen.getByText('Error loading lab tests')).toBeInTheDocument();
    });
  });

  it('renders tests sorted by date descending with urgent tests first for same date', async () => {
    render(renderLabInvestigations());
    await waitFor(() => {
      expect(screen.getAllByTestId('test-name')).toHaveLength(3);
    });

    const testNames = screen.getAllByTestId('test-name');
    const testPriorities = screen.getAllByTestId('test-priority');

    // test-1 (May 8, newest) comes first
    expect(testNames[0]).toHaveTextContent('Complete Blood Count');
    expect(testPriorities[0]).toHaveTextContent(
      LabInvestigationPriority.routine,
    );

    // test-2 (April 9, stat=Urgent) comes before test-3 (same date, routine)
    expect(testNames[1]).toHaveTextContent('Lipid Panel');
    expect(testPriorities[1]).toHaveTextContent(LabInvestigationPriority.stat);
    expect(testNames[2]).toHaveTextContent('Liver Function');
    expect(testPriorities[2]).toHaveTextContent(
      LabInvestigationPriority.routine,
    );
  });

  describe('emptyEncounterFilter condition', () => {
    it('should not fetch lab investigations when emptyEncounterFilter is true (episodeOfCareUuids has values and encounterUuids is empty)', async () => {
      render(
        renderLabInvestigations({ orderType: 'Lab Order' }, [], ['episode-1']),
      );

      await waitFor(() => {
        expect(
          screen.getByText('No lab investigations recorded'),
        ).toBeInTheDocument();
      });
      expect(mockGetLabInvestigationsBundle).not.toHaveBeenCalled();
    });

    it('should fetch lab investigations when emptyEncounterFilter is false (episodeOfCareUuids is empty)', async () => {
      render(
        renderLabInvestigations(
          { orderType: 'Lab Order' },
          ['encounter-1'],
          [],
        ),
      );
      await waitForData();
      expect(mockGetLabInvestigationsBundle).toHaveBeenCalled();
    });

    it('should fetch lab investigations when emptyEncounterFilter is false (both have values)', async () => {
      render(
        renderLabInvestigations(
          { orderType: 'Lab Order' },
          ['encounter-1'],
          ['episode-1'],
        ),
      );
      await waitForData();
      expect(mockGetLabInvestigationsBundle).toHaveBeenCalled();
    });

    it('should fetch lab investigations when emptyEncounterFilter is false (no episode provided)', async () => {
      render(renderLabInvestigations({ orderType: 'Lab Order' }));
      await waitForData();
      expect(mockGetLabInvestigationsBundle).toHaveBeenCalled();
    });
  });

  const createMockDiagnosticReports = (
    id: string = 'report-1',
    code: string = 'Complete Blood Count',
    basedOnId: string = 'test-1',
  ): Bundle<DiagnosticReport> => ({
    resourceType: 'Bundle',
    type: 'searchset',
    entry: [
      {
        resource: {
          resourceType: 'DiagnosticReport',
          id,
          status: 'final',
          code: { text: code },
          basedOn: [{ reference: `ServiceRequest/${basedOnId}` }],
        } as DiagnosticReport,
      },
    ],
  });

  const waitForData = async () => {
    await waitFor(() => {
      expect(screen.getByText('Complete Blood Count')).toBeInTheDocument();
    });
  };

  describe('Diagnostic reports fetching', () => {
    it('should fetch diagnostic reports for all investigations in a single query', async () => {
      mockGetDiagnosticReports.mockResolvedValue(createMockDiagnosticReports());
      render(renderLabInvestigations());
      await waitForData();

      await waitFor(() => {
        expect(mockGetDiagnosticReports).toHaveBeenCalledWith('patient-123', [
          'test-1',
          'test-2',
          'test-3',
        ]);
      });
    });

    it('should pass reportId to child component for processed reports', async () => {
      mockGetDiagnosticReports.mockResolvedValue(createMockDiagnosticReports());
      render(renderLabInvestigations());
      await waitForData();

      await waitFor(() => {
        expect(mockGetDiagnosticReports).toHaveBeenCalledWith('patient-123', [
          'test-1',
          'test-2',
          'test-3',
        ]);
      });
    });
  });

  describe('consultation saved event subscription', () => {
    it('registers consultation saved event listener', async () => {
      render(renderLabInvestigations());
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
        render(renderLabInvestigations({ orderType: 'Lab Order' }));
        await waitForData();
        mockGetLabInvestigationsBundle.mockClear();
      });

      it('refetches data when consultation saved event is triggered with matching category', async () => {
        eventCallback({
          patientUUID: 'patient-123',
          updatedResources: {
            conditions: false,
            allergies: false,
            medications: false,
            serviceRequests: { 'lab order': true },
          },
        });

        await waitFor(() => {
          expect(mockGetLabInvestigationsBundle).toHaveBeenCalled();
        });
      });

      it('does not refetch when event is for different patient', async () => {
        eventCallback({
          patientUUID: 'different-patient',
          updatedResources: {
            conditions: false,
            allergies: false,
            medications: false,
            serviceRequests: { 'lab order': true },
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(mockGetLabInvestigationsBundle).not.toHaveBeenCalled();
      });

      it('does not refetch when different category was updated', async () => {
        eventCallback({
          patientUUID: 'patient-123',
          updatedResources: {
            conditions: false,
            allergies: false,
            medications: false,
            serviceRequests: { 'radiology order': true },
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(mockGetLabInvestigationsBundle).not.toHaveBeenCalled();
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
        expect(mockGetLabInvestigationsBundle).not.toHaveBeenCalled();
      });
    });
  });
});
