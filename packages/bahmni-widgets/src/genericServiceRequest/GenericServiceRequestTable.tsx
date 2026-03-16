import { SortableDataTable, TooltipIcon, Tag } from '@bahmni/design-system';
import {
  getFormattedError,
  getCategoryUuidFromOrderTypes,
  getServiceRequests,
  shouldEnableEncounterFilter,
  useTranslation,
  useSubscribeConsultationSaved,
} from '@bahmni/services';
import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo } from 'react';

import { usePatientUUID } from '../hooks/usePatientUUID';
import { useNotification } from '../notification';
import { WidgetProps } from '../registry/model';
import {
  ServiceRequestViewModel,
  ServiceRequestStatus,
  STATUS_TRANSLATION_MAP,
} from './models';
import styles from './styles/GenericServiceRequestTable.module.scss';
import {
  filterServiceRequestReplacementEntries,
  getServiceRequestPriority,
  mapServiceRequest,
} from './utils';

export const genericServiceRequestQueryKeys = (
  categoryUuid: string,
  patientUUID: string,
  encounterUuids?: string[],
) =>
  ['genericServiceRequest', categoryUuid, patientUUID, encounterUuids] as const;

const fetchServiceRequests = async (
  categoryUuid: string,
  patientUUID: string,
  encounterUuids?: string[],
): Promise<ServiceRequestViewModel[]> => {
  const response = await getServiceRequests(
    categoryUuid,
    patientUUID,
    encounterUuids,
  );
  return mapServiceRequest(response);
};

/**
 * Component to display patient service requests in a flat sorted table.
 * Items are sorted by orderedDate descending (newest first), with priority
 * (stat before routine) as a tiebreaker for items with the same orderedDate.
 */
const GenericServiceRequestTable: React.FC<WidgetProps> = ({
  config,
  episodeOfCareUuids,
  encounterUuids,
  visitUuids,
}) => {
  const { t } = useTranslation();
  const patientUUID = usePatientUUID();
  const { addNotification } = useNotification();
  const categoryName = (config?.orderType as string) || '';

  const emptyEncounterFilter = shouldEnableEncounterFilter(
    episodeOfCareUuids,
    encounterUuids,
  );

  const {
    data: categoryUuid,
    isLoading: isLoadingOrderTypes,
    isError: isOrderTypesError,
    error: orderTypesError,
  } = useQuery({
    queryKey: ['categoryUuid', categoryName],
    queryFn: () => getCategoryUuidFromOrderTypes(categoryName),
    enabled: !!categoryName,
  });

  const {
    data,
    isLoading: isLoadingServiceRequests,
    isError: isServiceRequestsError,
    error: serviceRequestsError,
    refetch,
  } = useQuery({
    queryKey: genericServiceRequestQueryKeys(
      categoryUuid,
      patientUUID!,
      encounterUuids,
    ),
    enabled: !!patientUUID && !!categoryUuid,
    queryFn: () =>
      fetchServiceRequests(categoryUuid, patientUUID!, encounterUuids),
  });

  useSubscribeConsultationSaved(
    (payload) => {
      if (
        payload.patientUUID === patientUUID &&
        categoryName &&
        payload.updatedResources.serviceRequests?.[categoryName.toLowerCase()]
      ) {
        refetch();
      }
    },
    [patientUUID, categoryName],
  );

  useEffect(() => {
    if (isOrderTypesError) {
      const { message } = getFormattedError(orderTypesError);
      addNotification({
        title: t('ERROR_DEFAULT_TITLE'),
        message,
        type: 'error',
      });
    }
    if (isServiceRequestsError) {
      const { message } = getFormattedError(serviceRequestsError);
      addNotification({
        title: t('ERROR_DEFAULT_TITLE'),
        message,
        type: 'error',
      });
    }
  }, [
    isOrderTypesError,
    orderTypesError,
    isServiceRequestsError,
    serviceRequestsError,
    addNotification,
    t,
  ]);

  const serviceRequests = data ?? [];
  const isLoading = isLoadingOrderTypes || isLoadingServiceRequests;
  const isError = isOrderTypesError || isServiceRequestsError;
  const error = orderTypesError ?? serviceRequestsError;

  const headers = useMemo(
    () => [
      { key: 'testName', header: t('SERVICE_REQUEST_TEST_NAME') },
      { key: 'orderedBy', header: t('SERVICE_REQUEST_ORDERED_BY') },
      { key: 'status', header: t('SERVICE_REQUEST_ORDERED_STATUS') },
    ],
    [t],
  );

  const sortable = useMemo(
    () => [
      { key: 'testName', sortable: true },
      { key: 'orderedBy', sortable: true },
      { key: 'status', sortable: true },
    ],
    [],
  );

  const processedServiceRequests = useMemo(() => {
    const filtered = filterServiceRequestReplacementEntries(serviceRequests);
    return [...filtered].sort((a, b) => {
      const dateDiff =
        new Date(b.orderedDate).getTime() - new Date(a.orderedDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (
        getServiceRequestPriority(a.priority) -
        getServiceRequestPriority(b.priority)
      );
    });
  }, [serviceRequests]);

  const renderCell = useCallback(
    (request: ServiceRequestViewModel, cellId: string) => {
      switch (cellId) {
        case 'testName':
          return (
            <>
              <p className={styles.requestName}>
                <span>{request.testName}</span>
                {request.note && (
                  <TooltipIcon
                    iconName="fa-file-lines"
                    content={request.note}
                    ariaLabel={request.note}
                  />
                )}
              </p>
              {request.priority === 'stat' && (
                <Tag type="red">{t('SERVICE_REQUEST_PRIORITY_URGENT')}</Tag>
              )}
            </>
          );
        case 'orderedBy':
          return request.orderedBy;
        case 'status':
          return (
            <Tag type="outline">
              {t(
                STATUS_TRANSLATION_MAP[request.status as ServiceRequestStatus],
              )}
            </Tag>
          );

        default:
          return null;
      }
    },
    [t],
  );

  return (
    <div data-testid="generic-service-request-table">
      <SortableDataTable
        headers={headers}
        ariaLabel={t('SERVICE_REQUEST_HEADING')}
        rows={emptyEncounterFilter ? [] : processedServiceRequests}
        loading={isLoading}
        errorStateMessage={isError ? error?.message : undefined}
        emptyStateMessage={t('NO_SERVICE_REQUESTS')}
        renderCell={renderCell}
        sortable={sortable}
        className={styles.serviceRequestTableBody}
        dataTestId="generic-service-request-table"
        pageSize={10}
      />
    </div>
  );
};

export default GenericServiceRequestTable;
