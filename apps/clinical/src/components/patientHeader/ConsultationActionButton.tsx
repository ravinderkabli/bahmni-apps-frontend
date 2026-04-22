import { Button } from '@bahmni/design-system';
import { useTranslation } from '@bahmni/services';
import {
  useActivePractitioner,
  useHasPrivilege,
  CONSULTATION_PAD_PRIVILEGES,
} from '@bahmni/widgets';
import React, { useState } from 'react';
import ClinicalInsights from '../clinicalInsights/ClinicalInsights';
import { useEncounterSession } from '../../hooks/useEncounterSession';
import styles from './styles/PatientHeader.module.scss';

interface ConsultationActionButtonProps {
  isActionAreaVisible: boolean;
  setIsActionAreaVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * ConsultationActionButton component that shows "New Consultation" or "Edit Consultation"
 * based on encounter session state
 *
 * @param {ConsultationActionButtonProps} props - Component props
 * @returns {React.ReactElement} The ConsultationActionButton component
 */
const ConsultationActionButton: React.FC<ConsultationActionButtonProps> = ({
  isActionAreaVisible,
  setIsActionAreaVisible,
}) => {
  const { t } = useTranslation();
  const { practitioner } = useActivePractitioner();
  const { editActiveEncounter, isLoading } = useEncounterSession({
    practitioner,
  });
  const canAddEncounter = useHasPrivilege(
    CONSULTATION_PAD_PRIVILEGES.ENCOUNTER,
  );
  const [showInsightsModal, setShowInsightsModal] = useState(false);

  if (!canAddEncounter) {
    return null;
  }
  return (
    <div className={styles.buttonGroup}>
      <Button
        kind="secondary"
        size="md"
        onClick={() => setShowInsightsModal(true)}
        data-testid="generate-insights-button"
        className={styles.generateInsightsButton}
      >
        {t('CLINICAL_INSIGHTS_GENERATE_BUTTON')}
      </Button>
      <Button
        className={styles.newConsultationButton}
        size="md"
        disabled={isActionAreaVisible || isLoading}
        onClick={() => setIsActionAreaVisible(!isActionAreaVisible)}
        data-testid="consultation-action-button"
      >
        {isActionAreaVisible
          ? t('CONSULTATION_ACTION_IN_PROGRESS')
          : editActiveEncounter
            ? t('CONSULTATION_ACTION_EDIT')
            : t('CONSULTATION_ACTION_NEW')}
      </Button>
      {showInsightsModal && (
        <ClinicalInsights inModal onClose={() => setShowInsightsModal(false)} />
      )}
    </div>
  );
};

export default ConsultationActionButton;
