import { DataTableHeader } from '@carbon/react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActionDataTable } from '../ActionDataTable';

const mockHeaders: DataTableHeader[] = [
  { key: 'name', header: 'Name' },
  { key: 'status', header: 'Status' },
];

const mockRows = [
  { id: 'row-1', name: 'Paracetamol 500 mg', status: 'active' },
  { id: 'row-2', name: 'Oxygen', status: 'stopped' },
];

const baseProps = {
  id: 'test-table',
  title: 'Medication Orders',
  headers: mockHeaders,
  rows: mockRows,
  ariaLabel: 'Medication Orders Table',
};

describe('ActionDataTable', () => {
  it('renders the table title and data rows', () => {
    render(<ActionDataTable {...baseProps} />);

    expect(screen.getByText('Medication Orders')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol 500 mg')).toBeInTheDocument();
    expect(screen.getByText('Oxygen')).toBeInTheDocument();
  });

  it('renders the action button when actionButton prop is provided', () => {
    render(
      <ActionDataTable
        {...baseProps}
        actionButton={{
          label: 'Add Medication',
          onClick: jest.fn(),
        }}
      />,
    );

    expect(
      screen.getByTestId(
        `${baseProps.id}-action-data-table-action-button-test-id`,
      ),
    ).toBeInTheDocument();
  });

  it('does not render toolbar when actionButton is not provided', () => {
    render(<ActionDataTable {...baseProps} />);

    expect(
      screen.queryByTestId(
        `${baseProps.id}-action-data-table-action-button-test-id`,
      ),
    ).not.toBeInTheDocument();
  });

  it('calls actionButton.onClick when button is clicked', () => {
    const onClick = jest.fn();
    render(
      <ActionDataTable
        {...baseProps}
        actionButton={{
          label: 'Add',
          onClick,
        }}
      />,
    );

    fireEvent.click(
      screen.getByTestId(
        `${baseProps.id}-action-data-table-action-button-test-id`,
      ),
    );
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders description when provided', () => {
    render(
      <ActionDataTable {...baseProps} description="List of medications" />,
    );

    expect(screen.getByText('List of medications')).toBeInTheDocument();
  });

  it.each([
    [
      'loading skeleton',
      { loading: true },
      `${baseProps.id}-sortable-data-table-test-id-skeleton`,
    ],
    [
      'empty state',
      { rows: [] },
      `${baseProps.id}-sortable-data-table-test-id-empty`,
    ],
    [
      'error state',
      { errorStateMessage: 'Failed to load' },
      `${baseProps.id}-sortable-data-table-test-id-error`,
    ],
  ])(
    'passes through %s state to SortableDataTable',
    (_, extraProps, testId) => {
      render(<ActionDataTable {...baseProps} {...extraProps} />);

      expect(screen.getByTestId(testId)).toBeInTheDocument();
    },
  );

  it('passes through custom renderCell to SortableDataTable', () => {
    const renderCell = jest.fn(
      (row: (typeof mockRows)[number], cellId: string) =>
        `custom-${row[cellId as keyof typeof row]}`,
    );

    render(<ActionDataTable {...baseProps} renderCell={renderCell} />);

    expect(screen.getByText('custom-Paracetamol 500 mg')).toBeInTheDocument();
    expect(renderCell).toHaveBeenCalled();
  });
});
