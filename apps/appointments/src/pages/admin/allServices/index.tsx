import { ActionDataTable, BaseLayout, Header } from '@bahmni/design-system';
import {
  BAHMNI_HOME_PATH,
  getAllAppointmentServices,
  useTranslation,
} from '@bahmni/services';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo } from 'react';
import { useAppointmentsConfig } from '../../../providers/appointmentsConfig';
import { KNOWN_FIELDS } from './constants';
import { AppointmentServiceViewModel } from './model';
import styles from './styles/index.module.scss';
import {
  createAppointmentServiceViewModels,
  createServiceHeaders,
  extractServiceAttributeNames,
} from './utils';

const AllServicesPage: React.FC = () => {
  const { t } = useTranslation();
  const { appointmentsConfig } = useAppointmentsConfig();
  const serviceTableFields = appointmentsConfig?.serviceTableFields ?? [
    ...KNOWN_FIELDS,
  ];

  const attributeNames = useMemo(
    () => extractServiceAttributeNames(serviceTableFields),
    [serviceTableFields],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['allAppointmentServices'],
    queryFn: getAllAppointmentServices,
  });

  const headers = useMemo(
    () => createServiceHeaders(serviceTableFields, t),
    [serviceTableFields],
  );

  const rows: AppointmentServiceViewModel[] = useMemo(
    () => createAppointmentServiceViewModels(data ?? [], attributeNames),
    [data, attributeNames],
  );

  const renderCell = (
    row: AppointmentServiceViewModel,
    cellId: string,
  ): React.ReactNode => {
    if (cellId === 'actions') return null;
    if (KNOWN_FIELDS.includes(cellId))
      return row[cellId as keyof AppointmentServiceViewModel] ?? '-';
    return row.attributes[cellId] ?? '-';
  };

  const breadcrumbs = [
    { id: 'home', label: t('BREADCRUMB_HOME'), href: BAHMNI_HOME_PATH },
    { id: 'admin', label: t('BREADCRUMB_ADMIN'), isCurrentPage: true },
  ];

  return (
    <BaseLayout
      header={<Header breadcrumbItems={breadcrumbs} />}
      main={
        <div className={styles.tableContainer}>
          <ActionDataTable
            id="all-services"
            title={t('ADMIN_ALL_SERVICES_TITLE')}
            headers={headers}
            rows={rows}
            ariaLabel="all-services-table"
            loading={isLoading}
            errorStateMessage={
              isError ? t('ADMIN_ALL_SERVICES_ERROR_MESSAGE') : null
            }
            emptyStateMessage={t('ADMIN_ALL_SERVICES_EMPTY_MESSAGE')}
            renderCell={renderCell}
            className={styles.table}
          />
        </div>
      }
    />
  );
};

export default AllServicesPage;
