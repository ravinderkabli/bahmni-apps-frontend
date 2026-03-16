import {
  Link,
  Modal,
  SortableDataTable,
  Tag,
  TooltipIcon,
} from '@bahmni/design-system';
import {
  AUDIT_LOG_EVENT_DETAILS,
  AuditEventType,
  DATE_TIME_FORMAT,
  dispatchAuditEvent,
  formatDate,
  getCategoryUuidFromOrderTypes,
  getDiagnosticReports,
  getFormattedError,
  getPatientRadiologyInvestigationBundleWithImagingStudy,
  shouldEnableEncounterFilter,
  useSubscribeConsultationSaved,
  useTranslation,
} from '@bahmni/services';
import { useQuery } from '@tanstack/react-query';
import type { DiagnosticReport } from 'fhir/r4';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ServiceRequestStatus,
  STATUS_TRANSLATION_MAP,
} from '../genericServiceRequest/models';
import { usePatientUUID } from '../hooks/usePatientUUID';
import { useNotification } from '../notification';
import { RadiologyInvestigationReport } from '../radiologyInvestigationReport';
import { WidgetProps } from '../registry/model';
import {
  extractDiagnosticReportsFromBundle,
  updateInvestigationsWithReportInfo,
} from '../utils/Investigations';
import { RadiologyInvestigationViewModel } from './models';
import styles from './styles/RadiologyInvestigationTable.module.scss';
import {
  createRadiologyInvestigationViewModels,
  filterRadiologyInvestionsReplacementEntries,
  getAvailableImagingStudies,
  getRadiologyPriority,
} from './utils';

export const radiologyInvestigationQueryKeys = (patientUUID: string) =>
  ['radiologyInvestigation', patientUUID] as const;

const fetchRadiologyInvestigations = async (
  patientUUID: string,
  category: string,
  encounterUuids?: string[],
  numberOfVisits?: number,
): Promise<RadiologyInvestigationViewModel[]> => {
  const response = await getPatientRadiologyInvestigationBundleWithImagingStudy(
    patientUUID!,
    category,
    encounterUuids,
    numberOfVisits,
  );
  return createRadiologyInvestigationViewModels(response);
};

/**
 * Component to display patient radiology investigations in a flat sorted table.
 * Items are sorted by orderedDate descending (newest first), with priority
 * (stat before routine) as a tiebreaker for items with the same orderedDate.
 */
const RadiologyInvestigationTable: React.FC<WidgetProps> = ({
  config,
  encounterUuids,
  episodeOfCareUuids,
}) => {
  const patientUUID = usePatientUUID();
  const { t } = useTranslation();
  const { addNotification } = useNotification();
  const categoryName = config?.orderType as string;
  const numberOfVisits = config?.numberOfVisits as number;
  const pacsViewerUrl = config?.pacsViewerUrl as string;
  const [selectedInvestigation, setSelectedInvestigation] =
    useState<RadiologyInvestigationViewModel | null>(null);

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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: radiologyInvestigationQueryKeys(patientUUID!),
    enabled: !!patientUUID && !!categoryUuid && !emptyEncounterFilter,
    queryFn: () =>
      fetchRadiologyInvestigations(
        patientUUID!,
        categoryUuid!,
        encounterUuids,
        numberOfVisits,
      ),
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

  const headers = useMemo(
    () => [
      { key: 'testName', header: t('RADIOLOGY_INVESTIGATION_NAME') },
      { key: 'results', header: t('RADIOLOGY_RESULTS') },
      { key: 'orderedBy', header: t('RADIOLOGY_ORDERED_BY') },
      { key: 'status', header: t('SERVICE_REQUEST_ORDERED_STATUS') },
    ],
    [t],
  );

  const sortable = useMemo(
    () => [
      { key: 'testName', sortable: true },
      { key: 'results', sortable: true },
      { key: 'orderedBy', sortable: true },
      { key: 'status', sortable: true },
    ],
    [],
  );

  const loading = isLoading || isLoadingOrderTypes;
  const errorMessage =
    isError && error
      ? getFormattedError(error).message
      : isOrderTypesError && orderTypesError
        ? getFormattedError(orderTypesError).message
        : '';
  const hasError = isError || isOrderTypesError;

  useEffect(() => {
    if (hasError)
      addNotification({
        title: t('ERROR_DEFAULT_TITLE'),
        message: errorMessage,
        type: 'error',
      });
  }, [hasError, errorMessage, addNotification, t]);

  const processedInvestigations = useMemo(() => {
    const filtered = filterRadiologyInvestionsReplacementEntries(data ?? []);
    return [...filtered].sort((a, b) => {
      const dateDiff =
        new Date(b.orderedDate).getTime() - new Date(a.orderedDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (
        getRadiologyPriority(a.priority) - getRadiologyPriority(b.priority)
      );
    });
  }, [data]);

  const orderIds = useMemo(
    () => processedInvestigations.map((inv) => inv.id),
    [processedInvestigations],
  );

  const { data: diagnosticReportsBundle } = useQuery({
    queryKey: ['diagnosticReports', patientUUID, orderIds],
    queryFn: () => getDiagnosticReports(patientUUID!, orderIds),
    enabled: !!patientUUID && orderIds.length > 0,
  });

  const diagnosticReports = useMemo<DiagnosticReport[]>(() => {
    if (!diagnosticReportsBundle) return [];
    return extractDiagnosticReportsFromBundle(diagnosticReportsBundle);
  }, [diagnosticReportsBundle]);

  const updatedInvestigations = useMemo(() => {
    return updateInvestigationsWithReportInfo(
      processedInvestigations,
      diagnosticReports,
    ) as RadiologyInvestigationViewModel[];
  }, [processedInvestigations, diagnosticReports]);

  const handleRadiologyResultClick = () => {
    dispatchAuditEvent({
      eventType: AUDIT_LOG_EVENT_DETAILS.VIEWED_RADIOLOGY_RESULTS
        .eventType as AuditEventType,
      patientUuid: patientUUID!,
    });
  };

  const renderResultsCell = (
    investigation: RadiologyInvestigationViewModel,
  ) => {
    const availableStudies = getAvailableImagingStudies(
      investigation.imagingStudies,
    );
    const hasViewImagesLink = availableStudies.length > 0 && pacsViewerUrl;
    const hasViewReportLink = !!investigation.reportId;

    if (hasViewImagesLink || hasViewReportLink) {
      return (
        <div
          id={`${investigation.id}-results`}
          data-testid={`${investigation.id}-results-test-id`}
          className={styles.resultsCell}
        >
          {hasViewImagesLink &&
            availableStudies.map((study, index) => {
              const viewerUrl = pacsViewerUrl.replace(
                '{{StudyInstanceUIDs}}',
                study.StudyInstanceUIDs,
              );
              return (
                <Link
                  key={study.id}
                  href={viewerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  id={`${investigation.id}-result-link-${index}`}
                  testId={`${investigation.id}-result-link-${index}-test-id`}
                  onClick={() => handleRadiologyResultClick()}
                >
                  {t('RADIOLOGY_VIEW_IMAGES')}
                </Link>
              );
            })}
          {hasViewReportLink && (
            <Link
              id={`${investigation.id}-view-report-link`}
              testId={`${investigation.id}-view-report-link-test-id`}
              onClick={() => setSelectedInvestigation(investigation)}
            >
              {t('RADIOLOGY_VIEW_REPORT')}
            </Link>
          )}
        </div>
      );
    }

    return (
      <span
        id={`${investigation.id}-results`}
        data-testid={`${investigation.id}-results-test-id`}
      >
        --
      </span>
    );
  };

  const renderCell = (
    investigation: RadiologyInvestigationViewModel,
    cellId: string,
  ) => {
    switch (cellId) {
      case 'testName':
        return (
          <div
            id={`${investigation.id}-test-name`}
            data-testid={`${investigation.id}-test-name-test-id`}
          >
            <p className={styles.investigationName}>
              <span>{investigation.testName}</span>
              {investigation.note && (
                <TooltipIcon
                  iconName="fa-file-lines"
                  content={investigation.note}
                  ariaLabel={investigation.note}
                />
              )}
            </p>
            {investigation.priority === 'stat' && (
              <Tag
                id={`${investigation.id}-priority`}
                testId={`${investigation.id}-priority-test-id`}
                type="red"
              >
                {t('RADIOLOGY_PRIORITY_URGENT')}
              </Tag>
            )}
          </div>
        );
      case 'results':
        return renderResultsCell(investigation);
      case 'orderedBy':
        return (
          <span
            id={`${investigation.id}-ordered-by`}
            data-testid={`${investigation.id}-ordered-by-test-id`}
          >
            {investigation.orderedBy}
          </span>
        );
      case 'status':
        return (
          <span
            id={`${investigation.id}-status`}
            data-testid={`${investigation.id}-status-test-id`}
          >
            <Tag type="outline">
              {t(
                STATUS_TRANSLATION_MAP[
                  investigation.status as ServiceRequestStatus
                ],
              )}
            </Tag>
          </span>
        );
      default:
        return null;
    }
  };

  const reportedOn =
    selectedInvestigation?.reportedDate &&
    formatDate(selectedInvestigation.reportedDate, t, DATE_TIME_FORMAT)
      .formattedResult;

  return (
    <div
      id="radiology-investigations-table"
      data-testid="radiology-investigations-table-test-id"
      aria-label="radiology-investigations-table-aria-label"
    >
      <SortableDataTable
        headers={headers}
        ariaLabel={t('RADIOLOGY_INVESTIGATION_HEADING')}
        rows={emptyEncounterFilter ? [] : updatedInvestigations}
        loading={loading}
        errorStateMessage={hasError ? errorMessage : undefined}
        emptyStateMessage={t('NO_RADIOLOGY_INVESTIGATIONS')}
        renderCell={renderCell}
        sortable={sortable}
        className={styles.radiologyInvestigationTableBody}
        dataTestId="radiology-investigations-table"
        pageSize={10}
      />

      {selectedInvestigation && (
        <Modal
          open={!!selectedInvestigation}
          onRequestClose={() => setSelectedInvestigation(null)}
          passiveModal
          modalLabel={`Recorded On : ${reportedOn}  | Recorded By: ${selectedInvestigation.reportedBy}`}
          modalHeading={selectedInvestigation.testName}
          testId="diagnostic-report-modal"
          size="lg"
          id="modalIdForActionAreaLayout"
          portalId={'main-display-area'}
        >
          <Modal.Body>
            <RadiologyInvestigationReport
              reportId={selectedInvestigation.reportId!}
            />
          </Modal.Body>
        </Modal>
      )}
    </div>
  );
};

export default RadiologyInvestigationTable;
