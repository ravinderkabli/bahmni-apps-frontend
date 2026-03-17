import { getAllAppointmentServices } from '@bahmni/services';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { mockAppointmentServices } from '../__mocks__/mocks';
import AllServicesPage from '../index';

jest.mock('@bahmni/services', () => ({
  ...jest.requireActual('@bahmni/services'),
  getAllAppointmentServices: jest.fn(),
}));

jest.mock('../../../../providers/appointmentsConfig', () => ({
  useAppointmentsConfig: jest.fn(() => ({
    appointmentsConfig: {
      serviceTableFields: [
        'name',
        'location',
        'speciality',
        'durationMins',
        'description',
      ],
    },
    isLoading: false,
    error: null,
  })),
}));

describe('AllServicesPage Integration', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should fetch and display all appointment services', async () => {
    (getAllAppointmentServices as jest.Mock).mockResolvedValue(
      mockAppointmentServices,
    );

    render(
      <QueryClientProvider client={queryClient}>
        <AllServicesPage />
      </QueryClientProvider>,
    );

    expect(
      screen.getByTestId('all-services-action-data-table-test-id'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('all-services-sortable-data-table-test-id-skeleton'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText('General Medicine OPD Consultation'),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('ENT OPD Consultation')).toBeInTheDocument();
    expect(screen.getByText('General Medicine')).toBeInTheDocument();
    expect(screen.getByText('ENT Ward')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(
      screen.getByText('Appointment for General Medicine Consultation'),
    ).toBeInTheDocument();
    expect(getAllAppointmentServices).toHaveBeenCalledTimes(1);
  });

  it('should show error state when fetching services fails', async () => {
    (getAllAppointmentServices as jest.Mock).mockRejectedValue(
      new Error('Network error'),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <AllServicesPage />
      </QueryClientProvider>,
    );

    expect(
      screen.getByTestId('all-services-action-data-table-test-id'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByTestId('all-services-sortable-data-table-test-id-error'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText('Failed to load services. Please try again.'),
    ).toBeInTheDocument();
    expect(getAllAppointmentServices).toHaveBeenCalledTimes(1);
  });
});
