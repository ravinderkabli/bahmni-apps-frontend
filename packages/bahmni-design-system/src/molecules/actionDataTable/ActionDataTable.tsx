import {
  TableContainer,
  TableToolbar,
  TableToolbarContent,
} from '@carbon/react';
import classnames from 'classnames';
import { Button, type ButtonProps } from '../../atoms/button';
import {
  SortableDataTable,
  type SortableDataTableProps,
} from '../sortableDataTable/SortableDataTable';
import styles from './styles/ActionDataTable.module.scss';

export interface ActionDataTableProps<T> extends SortableDataTableProps<T> {
  id: string;
  title: string;
  description?: string;
  className?: string;
  actionButton?: {
    label: string;
    disabled?: boolean;
    onClick?: () => void;
    props?: Partial<ButtonProps>;
  };
}

export const ActionDataTable = <T extends { id: string }>({
  id,
  title,
  description,
  actionButton,
  className,
  ...sortableProps
}: ActionDataTableProps<T>) => {
  const showToolbar = !!actionButton;

  return (
    <TableContainer
      id={`${id}-action-data-table`}
      data-testid={`${id}-action-data-table-test-id`}
      aria-label={`${id}-action-data-table-aria-label`}
      title={title}
      description={description}
      className={classnames(className, styles.actionDataTableBody)}
    >
      {showToolbar && (
        <TableToolbar>
          <TableToolbarContent>
            <Button
              {...actionButton.props}
              id={`${id}-action-data-table-action-button`}
              data-testid={`${id}-action-data-table-action-button-test-id`}
              aria-label={`${id}-action-data-table-action-button-aria-label`}
              onClick={actionButton.onClick}
              disabled={actionButton.disabled}
            >
              {actionButton.label}
            </Button>
          </TableToolbarContent>
        </TableToolbar>
      )}
      <SortableDataTable
        {...sortableProps}
        dataTestId={`${id}-sortable-data-table-test-id`}
      />
    </TableContainer>
  );
};
