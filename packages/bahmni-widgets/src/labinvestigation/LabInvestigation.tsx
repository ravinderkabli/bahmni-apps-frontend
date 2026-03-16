import { CodeSnippetSkeleton } from '@bahmni/design-system';
import {
  shouldEnableEncounterFilter,
  useTranslation,
  getCategoryUuidFromOrderTypes,
  getFormattedError,
  getLabInvestigationsBundle,
  getDiagnosticReports,
  useSubscribeConsultationSaved,
} from '@bahmni/services';
import { Pagination } from '@carbon/react';
import { useQuery } from '@tanstack/react-query';
import type { DiagnosticReport } from 'fhir/r4';
import React, { useMemo, useEffect, useState } from 'react';

import { usePatientUUID } from '../hooks/usePatientUUID';
import { useNotification } from '../notification';
import { WidgetProps } from '../registry/model';
import {
  extractDiagnosticReportsFromBundle,
  updateInvestigationsWithReportInfo,
} from '../utils/Investigations';
import LabInvestigationItem from './LabInvestigationItem';
import { FormattedLabInvestigations } from './models';
import styles from './styles/LabInvestigation.module.scss';
import {
  filterLabInvestigationEntries,
  formatLabInvestigations,
} from './utils';

const LAB_PAGE_SIZE = 10;

const fetchLabInvestigations = async (
  patientUUID: string,
  category: string,
  t: (key: string) => string,
  encounterUuids?: string[],
  numberOfVisits?: number,
): Promise<FormattedLabInvestigations[]> => {
  const bundle = await getLabInvestigationsBundle(
    patientUUID,
    category,
    encounterUuids,
    numberOfVisits,
  );
  const filteredEntries = filterLabInvestigationEntries(bundle);
  return formatLabInvestigations(filteredEntries, t);
};

const LabInvestigation: React.FC<WidgetProps> = ({
  config,
  encounterUuids,
  episodeOfCareUuids,
}) => {
  const { t } = useTranslation();
  const patientUUID = usePatientUUID();
  const { addNotification } = useNotification();
  const categoryName = config?.orderType as string;
  const numberOfVisits = config?.numberOfVisits as number;
  const [currentPage, setCurrentPage] = useState(1);

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
    data: labTestsData,
    isLoading: isLoadingLabInvestigations,
    isError: isLabInvestigationsError,
    error: labInvestigationsError,
    refetch: refetchLabInvestigations,
  } = useQuery<FormattedLabInvestigations[]>({
    queryKey: [
      'labInvestigations',
      categoryUuid,
      patientUUID,
      encounterUuids,
      numberOfVisits,
    ],
    enabled: !!patientUUID && !!categoryUuid && !emptyEncounterFilter,
    queryFn: () =>
      fetchLabInvestigations(
        patientUUID!,
        categoryUuid!,
        t,
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
        refetchLabInvestigations();
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
    if (isLabInvestigationsError) {
      const { message } = getFormattedError(labInvestigationsError);
      addNotification({
        title: t('ERROR_DEFAULT_TITLE'),
        message,
        type: 'error',
      });
    }
  }, [
    isOrderTypesError,
    orderTypesError,
    isLabInvestigationsError,
    labInvestigationsError,
    addNotification,
    t,
  ]);

  const labTests: FormattedLabInvestigations[] = useMemo(
    () => labTestsData ?? [],
    [labTestsData],
  );
  const isLoading = isLoadingOrderTypes || isLoadingLabInvestigations;
  const hasError = isOrderTypesError || isLabInvestigationsError;

  // Flat list sorted by orderedDate descending, Urgent tests first for same date
  const sortedLabTests = useMemo<FormattedLabInvestigations[]>(() => {
    return [...labTests].sort((a, b) => {
      const dateDiff =
        new Date(b.orderedDate).getTime() - new Date(a.orderedDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      if (a.priority === 'Urgent' && b.priority !== 'Urgent') return -1;
      if (a.priority !== 'Urgent' && b.priority === 'Urgent') return 1;
      return 0;
    });
  }, [labTests]);

  const testIds = useMemo(
    () => sortedLabTests.map((test) => test.id),
    [sortedLabTests],
  );

  const { data: diagnosticReportsBundle } = useQuery({
    queryKey: ['diagnosticReports', patientUUID, testIds],
    queryFn: () => getDiagnosticReports(patientUUID!, testIds),
    enabled: !!patientUUID && testIds.length > 0,
  });

  const diagnosticReports = useMemo<DiagnosticReport[]>(() => {
    if (!diagnosticReportsBundle) return [];
    return extractDiagnosticReportsFromBundle(diagnosticReportsBundle);
  }, [diagnosticReportsBundle]);

  const updatedLabTests = useMemo(() => {
    return updateInvestigationsWithReportInfo(
      sortedLabTests,
      diagnosticReports,
    ) as FormattedLabInvestigations[];
  }, [sortedLabTests, diagnosticReports]);

  if (hasError) {
    return (
      <div className={styles.labInvestigationTableBodyError}>
        {t('LAB_TEST_ERROR_LOADING')}
      </div>
    );
  }

  if (isLoading) {
    return (
      <CodeSnippetSkeleton
        type="multi"
        className={styles.labSkeleton}
        testId="lab-skeleton"
      />
    );
  }

  if (!isLoading && (labTests.length === 0 || emptyEncounterFilter)) {
    return (
      <div className={styles.labInvestigationTableBodyError}>
        {t('LAB_TEST_UNAVAILABLE')}
      </div>
    );
  }

  const totalTests = updatedLabTests.length;
  const paginatedTests = updatedLabTests.slice(
    (currentPage - 1) * LAB_PAGE_SIZE,
    currentPage * LAB_PAGE_SIZE,
  );

  return (
    <div>
      {paginatedTests.map((test) => (
        <LabInvestigationItem
          key={`${test.orderedDate}-${test.testName}-${test.id || test.testName}`}
          test={test}
          isOpen
          hasProcessedReport={!!test.reportId}
          reportId={test.reportId}
        />
      ))}
      {totalTests > LAB_PAGE_SIZE && (
        <Pagination
          page={currentPage}
          pageSize={LAB_PAGE_SIZE}
          pageSizes={[LAB_PAGE_SIZE]}
          totalItems={totalTests}
          onChange={({ page }: { page: number }) => setCurrentPage(page)}
          data-testid="lab-pagination"
        />
      )}
    </div>
  );
};

export default LabInvestigation;
