import { Button, Tag, TextArea, TextInput, Modal } from '@bahmni/design-system';
import { useTranslation } from '@bahmni/services';
import { useActivePractitioner, usePatientUUID } from '@bahmni/widgets';
import { InlineLoading, InlineNotification } from '@carbon/react';
import React, { useEffect, useRef, useState } from 'react';
import {
  type InsightsResponse,
  type InsightsStreamEvent,
  type KeyIndicator,
  type Recommendation,
  askInsightsQuestion,
  streamInsights,
} from '../../services/clinicalInsightsService';
import styles from './styles/ClinicalInsights.module.scss';

const INDICATOR_STATUS_CLASS: Record<string, string> = {
  GREEN: styles.statusGreen,
  YELLOW: styles.statusYellow,
  RED: styles.statusRed,
};

const PRIORITY_CLASS: Record<string, string> = {
  HIGH: styles.priorityHigh,
  MEDIUM: styles.priorityMedium,
  LOW: styles.priorityLow,
};

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const ClinicalInsights: React.FC = () => {
  const { t } = useTranslation();
  const patientUUID = usePatientUUID();
  const { practitioner } = useActivePractitioner();

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showAsk, setShowAsk] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  // API key — auto-loaded from ai-config.json, fallback to modal
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-load API key from config file or sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('clinical-insights-api-key');
    if (stored) {
      setApiKey(stored);
      return;
    }
    fetch('/ai-config')
      .then((res) => res.json())
      .then((data: { anthropicApiKey?: string | null }) => {
        if (
          data.anthropicApiKey &&
          data.anthropicApiKey !== 'PASTE_YOUR_KEY_HERE'
        ) {
          setApiKey(data.anthropicApiKey);
          sessionStorage.setItem(
            'clinical-insights-api-key',
            data.anthropicApiKey,
          );
        }
      })
      .catch(() => {
        // Config file not available — will prompt via modal
      });
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // Clean up SSE on unmount
  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const canGenerate = !!patientUUID;
  const doctorUuid = practitioner?.uuid ?? 'default-practitioner';

  const handleGenerateInsights = () => {
    if (!canGenerate || isGenerating) return;
    esRef.current?.close();

    setIsGenerating(true);
    setError(null);
    setInsights(null);
    setShowAsk(false);
    setChatHistory([]);
    setStatusMessage(t('CLINICAL_INSIGHTS_FETCHING'));

    esRef.current = streamInsights(
      patientUUID!,
      doctorUuid,
      'dashboard-session',
      (event: InsightsStreamEvent) => {
        if (event.event === 'status' && event.message) {
          setStatusMessage(event.message);
        }
        if (event.event === 'result' && event.data) {
          setInsights(event.data);
          setIsGenerating(false);
          setStatusMessage('');
        }
        if (event.event === 'error') {
          setError(event.message ?? t('CLINICAL_INSIGHTS_ERROR_GENERIC'));
          setIsGenerating(false);
          setStatusMessage('');
        }
        if (event.event === 'done') {
          setIsGenerating(false);
          setStatusMessage('');
        }
      },
    );
  };

  const handleSubmitQuestion = async (q: string) => {
    if (!insights || !q.trim()) return;
    if (!apiKey) {
      setPendingQuestion(q);
      setShowApiKeyModal(true);
      return;
    }
    await sendQuestion(q, apiKey);
  };

  const sendQuestion = async (q: string, key: string) => {
    if (!insights) return;
    setChatHistory((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: q },
    ]);
    setQuestion('');
    setIsAsking(true);
    setAskError(null);
    try {
      const answer = await askInsightsQuestion(q, insights, key);
      setChatHistory((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: answer },
      ]);
    } catch {
      setAskError(t('CLINICAL_INSIGHTS_ASK_ERROR'));
    } finally {
      setIsAsking(false);
    }
  };

  const handleApiKeyConfirm = async () => {
    if (!apiKeyInput.trim()) return;
    const key = apiKeyInput.trim();
    setApiKey(key);
    sessionStorage.setItem('clinical-insights-api-key', key);
    setShowApiKeyModal(false);
    const q = pendingQuestion;
    setApiKeyInput('');
    setPendingQuestion(null);
    if (q) await sendQuestion(q, key);
  };

  const renderKeyIndicator = (indicator: KeyIndicator, idx: number) => (
    <div
      key={idx}
      className={`${styles.indicator} ${INDICATOR_STATUS_CLASS[indicator.status] ?? ''}`}
    >
      <span className={styles.indicatorName}>{indicator.name}</span>
      <span className={styles.indicatorValue}>{indicator.value}</span>
      <span className={styles.indicatorTarget}>
        {t('CLINICAL_INSIGHTS_TARGET')}: {indicator.target}
      </span>
    </div>
  );

  const renderRecommendation = (rec: Recommendation) => (
    <div
      key={rec.id}
      className={`${styles.recommendationCard} ${PRIORITY_CLASS[rec.priority] ?? ''}`}
    >
      <div className={styles.recHeader}>
        <span className={styles.recHeadline}>{rec.headline}</span>
        <div className={styles.recMeta}>
          <Tag type="blue" size="sm">
            {rec.category}
          </Tag>
          <Tag
            type={
              rec.priority === 'HIGH'
                ? 'red'
                : rec.priority === 'MEDIUM'
                  ? 'warm-gray'
                  : 'green'
            }
            size="sm"
          >
            {rec.priority}
          </Tag>
        </div>
      </div>
      <p className={styles.recReasoning}>{rec.reasoning}</p>
      <p className={styles.recGuideline}>{rec.guideline_reference}</p>
    </div>
  );

  const hasInsights = !!insights;
  const showEmptyState = !isGenerating && !hasInsights && !error;

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        {/* ── Header bar ─────────────────────────────────────────── */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <p className={styles.title}>{t('CLINICAL_INSIGHTS_TITLE')}</p>
            <span className={styles.aiBadge}>
              {t('CLINICAL_INSIGHTS_AI_BADGE')}
            </span>
          </div>
          <Button
            size="sm"
            kind="primary"
            onClick={handleGenerateInsights}
            disabled={!canGenerate || isGenerating}
          >
            {t('CLINICAL_INSIGHTS_GENERATE_BUTTON')}
          </Button>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className={styles.body}>
          {/* Empty state */}
          {showEmptyState && (
            <div className={styles.emptyState}>
              <span className={styles.emptyStateIcon}>&#x1F9E0;</span>
              <p className={styles.emptyStateText}>
                {t('CLINICAL_INSIGHTS_EMPTY_STATE')}
              </p>
            </div>
          )}

          {/* Loading / streaming progress */}
          {isGenerating && (
            <div className={styles.progressSection}>
              <InlineLoading
                description={statusMessage || t('CLINICAL_INSIGHTS_GENERATING')}
                status="active"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className={styles.errorNotification}>
              <InlineNotification
                kind="error"
                title={t('CLINICAL_INSIGHTS_ERROR_TITLE')}
                subtitle={error}
                hideCloseButton
              />
            </div>
          )}

          {/* ── Results ────────────────────────────────────────── */}
          {hasInsights && (
            <>
              {/* Status Summary */}
              <div className={styles.summaryBlock}>
                <p className={styles.overallAssessment}>
                  {insights.status_summary.overall_assessment}
                </p>
                <div className={styles.indicatorsGrid}>
                  {insights.status_summary.key_indicators.map((ind, idx) =>
                    renderKeyIndicator(ind, idx),
                  )}
                </div>
              </div>

              {/* Recommendations */}
              {insights.recommendations.length > 0 && (
                <>
                  <p className={styles.sectionLabel}>
                    {t('CLINICAL_INSIGHTS_RECOMMENDATIONS')}
                  </p>
                  <div className={styles.recommendationList}>
                    {insights.recommendations.map(renderRecommendation)}
                  </div>
                </>
              )}

              {/* Data Gaps */}
              {insights.data_gaps.length > 0 && (
                <>
                  <p className={styles.sectionLabel}>
                    {t('CLINICAL_INSIGHTS_DATA_GAPS')}
                  </p>
                  <div className={styles.dataGapList}>
                    {insights.data_gaps.map((gap) => (
                      <div
                        key={gap.missing_element}
                        className={styles.dataGapCard}
                      >
                        <p className={styles.gapElement}>
                          {gap.missing_element}
                        </p>
                        <p className={styles.gapSuggestion}>{gap.suggestion}</p>
                        <p className={styles.gapFrequency}>
                          {t('CLINICAL_INSIGHTS_FREQUENCY')}:{' '}
                          {gap.recommended_frequency}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Disclaimer */}
              <p className={styles.disclaimer}>
                {insights.metadata.disclaimer}
              </p>

              {/* ── Ask Questions ───────────────────────────────── */}
              <Button
                kind="ghost"
                size="sm"
                onClick={() => setShowAsk((prev) => !prev)}
              >
                {showAsk
                  ? t('CLINICAL_INSIGHTS_HIDE_QUESTIONS')
                  : t('CLINICAL_INSIGHTS_ASK_QUESTIONS')}
              </Button>

              {showAsk && (
                <div className={styles.askQuestionsSection}>
                  <p className={styles.askQuestionsTitle}>
                    {t('CLINICAL_INSIGHTS_QUESTIONS_TITLE')}
                  </p>

                  {chatHistory.length > 0 && (
                    <div className={styles.chatHistory}>
                      {chatHistory.map((msg) => (
                        <div
                          key={msg.id}
                          className={
                            msg.role === 'user'
                              ? styles.chatMessageUser
                              : styles.chatMessageAssistant
                          }
                        >
                          {msg.content}
                        </div>
                      ))}
                      {isAsking && (
                        <InlineLoading
                          description={t('CLINICAL_INSIGHTS_THINKING')}
                          status="active"
                        />
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  {askError && (
                    <InlineNotification
                      kind="error"
                      title={t('CLINICAL_INSIGHTS_ASK_ERROR_TITLE')}
                      subtitle={askError}
                      hideCloseButton
                    />
                  )}

                  <div className={styles.chatInputRow}>
                    <div className={styles.chatInput}>
                      <TextArea
                        id="clinical-insights-question"
                        labelText=""
                        placeholder={t(
                          'CLINICAL_INSIGHTS_QUESTION_PLACEHOLDER',
                        )}
                        value={question}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setQuestion(e.target.value)
                        }
                        onKeyDown={(
                          e: React.KeyboardEvent<HTMLTextAreaElement>,
                        ) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmitQuestion(question);
                          }
                        }}
                        rows={2}
                        disabled={isAsking}
                      />
                    </div>
                    <Button
                      size="sm"
                      kind="primary"
                      onClick={() => handleSubmitQuestion(question)}
                      disabled={isAsking || !question.trim()}
                    >
                      {t('CLINICAL_INSIGHTS_SEND')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* API Key modal */}
      <Modal
        open={showApiKeyModal}
        modalHeading={t('CLINICAL_INSIGHTS_API_KEY_TITLE')}
        primaryButtonText={t('CLINICAL_INSIGHTS_API_KEY_CONFIRM')}
        secondaryButtonText={t('CLINICAL_INSIGHTS_API_KEY_CANCEL')}
        onRequestSubmit={handleApiKeyConfirm}
        onRequestClose={() => {
          setShowApiKeyModal(false);
          setApiKeyInput('');
          setPendingQuestion(null);
        }}
        primaryButtonDisabled={!apiKeyInput.trim()}
      >
        <TextInput
          id="clinical-insights-api-key-input"
          labelText={t('CLINICAL_INSIGHTS_API_KEY_LABEL')}
          placeholder={t('CLINICAL_INSIGHTS_API_KEY_PLACEHOLDER')}
          type="password"
          value={apiKeyInput}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setApiKeyInput(e.target.value)
          }
        />
      </Modal>
    </div>
  );
};

export default ClinicalInsights;
