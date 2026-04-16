import { Button, Tag, TextArea, TextInput, Modal } from '@bahmni/design-system';
import { useTranslation } from '@bahmni/services';
import { useActivePractitioner, usePatientUUID } from '@bahmni/widgets';
import {
  Accordion,
  AccordionItem,
  InlineLoading,
  InlineNotification,
  ProgressBar,
  Select,
  SelectItem,
  TabList,
  Tab,
  TabPanel,
  TabPanels,
  Tabs,
} from '@carbon/react';
import { ChevronDown } from '@carbon/icons-react';
import React, { useEffect, useRef, useState } from 'react';
import {
  type DataGap,
  type InsightsResponse,
  type InsightsStreamEvent,
  type KeyIndicator,
  type Recommendation,
  askInsightsQuestion,
  fetchDoctorConfig,
  streamInsights,
  submitFeedback,
} from '../../services/clinicalInsightsService';
import styles from './styles/ClinicalInsights.module.scss';

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  fhir: 'Fetching patient data from FHIR…',
  guidelines: 'Loading clinical guidelines…',
  llm: 'Generating AI insights…',
  guardrails: 'Applying safety checks…',
};

const STAGE_ORDER = ['fhir', 'guidelines', 'llm', 'guardrails'];

const FALLBACK_LLM_MSGS = [
  'Analysing relevant guideline sections…',
  'Cross-referencing current medications for interactions…',
  'Checking care gaps against clinical targets…',
  'Evaluating contraindications and allergy flags…',
  'Reviewing monitoring and follow-up requirements…',
  'Checking drug–drug interactions across full medication list…',
  'Synthesising evidence-based recommendations…',
  'Applying clinical safety rules…',
  'Verifying clinical safety thresholds…',
  'Formatting structured clinical output…',
];

const OVERRIDE_REASONS = [
  {
    value: 'clinical_judgment',
    label: 'Clinical judgment — patient-specific factors',
  },
  {
    value: 'contraindication_not_in_record',
    label: 'Contraindication not in record',
  },
  { value: 'patient_preference', label: 'Patient preference' },
  { value: 'resource_unavailable', label: 'Resource unavailable' },
  { value: 'already_addressed', label: 'Already addressed' },
  { value: 'other', label: 'Other' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type FeedbackRecord =
  | { type: 'positive' }
  | { type: 'override'; reason: string; reasonLabel: string };

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const NO_DATA_PHRASES = [
  'not recorded',
  'no data',
  'unknown',
  'not available',
  'not confirmed',
];

function getKiColorKey(indicator: KeyIndicator): 'Green' | 'Yellow' | 'Red' {
  const valueLower = indicator.value.toLowerCase();
  if (NO_DATA_PHRASES.some((phrase) => valueLower.includes(phrase))) {
    return 'Red';
  }
  if (indicator.status === 'RED') return 'Yellow';
  if (indicator.status === 'YELLOW') return 'Yellow';
  return 'Green';
}

// ── Component ─────────────────────────────────────────────────────────────────

const ClinicalInsights: React.FC = () => {
  const { t } = useTranslation();
  const patientUUID = usePatientUUID();
  const { practitioner } = useActivePractitioner();

  const [specialties, setSpecialties] = useState<string[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(
    null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [progressPct, setProgressPct] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
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

  // Run metrics panel
  const [showMetrics, setShowMetrics] = useState(false);

  // Feedback state
  const [feedbackMap, setFeedbackMap] = useState<
    Record<string, FeedbackRecord>
  >({});
  const [overrideRecId, setOverrideRecId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideComment, setOverrideComment] = useState('');

  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Stage queue — ensures each pill is visible for at least MIN_STAGE_MS
  const MIN_STAGE_MS = 700;
  const stageQueueRef = useRef<string[]>([]);
  const isAdvancingRef = useRef(false);
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainRef = useRef<() => void>(() => {});

  drainRef.current = () => {
    const next = stageQueueRef.current.shift();
    if (!next) {
      isAdvancingRef.current = false;
      return;
    }
    setCurrentStage(next);
    stageTimerRef.current = setTimeout(() => drainRef.current(), MIN_STAGE_MS);
  };

  const enqueueStage = (stage: string) => {
    stageQueueRef.current.push(stage);
    if (!isAdvancingRef.current) {
      isAdvancingRef.current = true;
      drainRef.current();
    }
  };

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

  // Clean up SSE and stage timer on unmount
  useEffect(() => {
    return () => {
      esRef.current?.close();
      if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    };
  }, []);

  const checkScrollMore = () => {
    const el = bodyRef.current;
    if (!el) return;
    setHasMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  };

  // Re-check whenever content changes
  useEffect(() => {
    checkScrollMore();
  }, [isGenerating, insights, error]);

  const canGenerate = !!patientUUID && !!practitioner?.uuid;
  const doctorUuid = practitioner?.uuid ?? 'default-practitioner';

  useEffect(() => {
    if (!practitioner?.uuid) return;
    fetchDoctorConfig(practitioner.uuid).then((cfg) => {
      if (cfg?.mapped_specialties?.length) {
        setSpecialties(cfg.mapped_specialties);
        setSelectedSpecialty((prev) => prev ?? cfg.mapped_specialties[0]);
      }
    });
  }, [practitioner?.uuid]);

  const handleGenerateInsights = () => {
    if (!canGenerate || isGenerating) return;
    esRef.current?.close();

    // Reset stage queue for fresh run
    if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    stageQueueRef.current = [];
    isAdvancingRef.current = false;

    setIsGenerating(true);
    setError(null);
    setInsights(null);
    setShowAsk(false);
    setChatHistory([]);
    setProgressPct(0);
    setProgressMsg(STAGE_LABELS['fhir']);
    enqueueStage('fhir');
    setFeedbackMap({});
    setOverrideRecId(null);
    setOverrideReason('');
    setOverrideComment('');

    let localLlmSections: string[] = [];

    esRef.current = streamInsights(
      patientUUID!,
      doctorUuid,
      'dashboard-session',
      selectedSpecialty,
      (event: InsightsStreamEvent) => {
        if (event.event === 'status' && event.stage) {
          enqueueStage(event.stage);
          setProgressMsg(STAGE_LABELS[event.stage] ?? event.message ?? '');
        }
        if (event.event === 'llm_context' && event.sections) {
          localLlmSections = event.sections;
        }
        if (event.event === 'llm_progress' && event.elapsed_s !== undefined) {
          const elapsed = event.elapsed_s;
          const pct = Math.min(
            93,
            Math.round((1 - Math.exp(-elapsed / 35)) * 100),
          );
          const msgs =
            localLlmSections.length > 0 ? localLlmSections : FALLBACK_LLM_MSGS;
          const msg = msgs[Math.floor(elapsed / 5) % msgs.length];
          setProgressPct(pct);
          setProgressMsg(msg);
        }
        if (event.event === 'result' && event.data) {
          if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
          stageQueueRef.current = [];
          isAdvancingRef.current = false;
          setInsights(event.data);
          setIsGenerating(false);
          setCurrentStage('');
          setProgressPct(0);
        }
        if (event.event === 'error') {
          if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
          stageQueueRef.current = [];
          isAdvancingRef.current = false;
          setError(event.message ?? t('CLINICAL_INSIGHTS_ERROR_GENERIC'));
          setIsGenerating(false);
          setCurrentStage('');
          setProgressPct(0);
        }
        if (event.event === 'done') {
          setIsGenerating(false);
          setCurrentStage('');
          setProgressPct(0);
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

  const handleAccept = (rec: Recommendation) => {
    if (!insights) return;
    setFeedbackMap((prev) => ({ ...prev, [rec.id]: { type: 'positive' } }));
    submitFeedback(
      insights.request_id,
      rec.id,
      doctorUuid,
      patientUUID ?? '',
      'positive',
    );
  };

  const handleOverrideOpen = (recId: string) => {
    setOverrideRecId(recId);
    setOverrideReason('');
    setOverrideComment('');
  };

  const handleOverrideCancel = () => {
    setOverrideRecId(null);
    setOverrideReason('');
    setOverrideComment('');
  };

  const handleOverrideSave = (rec: Recommendation) => {
    if (!insights || !overrideReason) return;
    const reasonEntry = OVERRIDE_REASONS.find(
      (r) => r.value === overrideReason,
    );
    const reasonLabel = reasonEntry?.label ?? overrideReason;
    setFeedbackMap((prev) => ({
      ...prev,
      [rec.id]: { type: 'override', reason: overrideReason, reasonLabel },
    }));
    setOverrideRecId(null);
    setOverrideReason('');
    setOverrideComment('');
    submitFeedback(
      insights.request_id,
      rec.id,
      doctorUuid,
      patientUUID ?? '',
      'override',
      overrideReason,
      overrideComment || undefined,
    );
  };

  // ── Derived values ──────────────────────────────────────────────────────────

  const hasInsights = !!insights;
  const showEmptyState = !isGenerating && !hasInsights && !error;

  const highPriorityCount = insights
    ? insights.recommendations.filter((r) => r.priority === 'HIGH').length
    : 0;

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderKiCard = (indicator: KeyIndicator, idx: number) => {
    const colorKey = getKiColorKey(indicator);
    const cardClass = styles[`ki${colorKey}`];
    const dotClass = styles[`kiDot${colorKey}`];
    const valueClass = styles[`kiValue${colorKey}`];

    return (
      <div key={idx} className={`${styles.kiCard} ${cardClass}`}>
        <div className={styles.kiName}>
          <span className={`${styles.kiDot} ${dotClass}`} />
          {indicator.name}
        </div>
        <div className={`${styles.kiValue} ${valueClass}`}>
          {indicator.value}
        </div>
        {indicator.trend_detail && (
          <div className={styles.kiTrend}>{indicator.trend_detail}</div>
        )}
        <div className={styles.kiTarget}>
          {t('CLINICAL_INSIGHTS_TARGET')}: {indicator.target}
        </div>
      </div>
    );
  };

  const renderRecommendationItem = (rec: Recommendation) => {
    const feedback = feedbackMap[rec.id];
    const isOverriding = overrideRecId === rec.id;

    const priorityBadgeClass =
      rec.priority === 'HIGH'
        ? styles.recPriorityHigh
        : rec.priority === 'MEDIUM'
          ? styles.recPriorityMedium
          : styles.recPriorityLow;

    const titleContent = (
      <div className={styles.recTitleRow}>
        <span className={`${styles.recPriorityBadge} ${priorityBadgeClass}`}>
          {rec.priority}
        </span>
        <Tag type="blue" size="sm">
          {rec.category}
        </Tag>
        <span className={styles.recHeadlineText}>{rec.headline}</span>
      </div>
    );

    return (
      <AccordionItem key={rec.id} title={titleContent}>
        <div className={styles.recBody}>
          <p className={styles.recReasoning}>{rec.reasoning}</p>

          {rec.contraindication_check && (
            <p className={styles.recContraindication}>
              {t('CLINICAL_INSIGHTS_CONTRAINDICATION_PREFIX', {
                defaultValue: 'Contraindication:',
              })}{' '}
              {rec.contraindication_check}
            </p>
          )}

          {rec.safety_warning && (
            <p className={styles.recSafetyWarning}>
              {t('CLINICAL_INSIGHTS_SAFETY_PREFIX', {
                defaultValue: 'Safety:',
              })}{' '}
              {rec.safety_warning}
            </p>
          )}

          <p className={styles.recMetaLine}>
            {rec.guideline_reference} &middot;{' '}
            {t('CLINICAL_INSIGHTS_CONFIDENCE')}:{' '}
            {Math.round(rec.confidence * 100)}% &middot; {rec.evidence_level}
          </p>

          {/* Feedback row */}
          {!feedback && !isOverriding && (
            <div className={styles.feedbackRow}>
              <Button
                kind="ghost"
                size="sm"
                onClick={() => handleAccept(rec)}
              >
                {t('CLINICAL_INSIGHTS_ACCEPT')}
              </Button>
              <Button
                kind="ghost"
                size="sm"
                onClick={() => handleOverrideOpen(rec.id)}
              >
                {t('CLINICAL_INSIGHTS_OVERRIDE')}
              </Button>
            </div>
          )}

          {feedback?.type === 'positive' && (
            <div className={styles.feedbackRow}>
              <span className={styles.feedbackAccepted}>
                {t('CLINICAL_INSIGHTS_ACCEPTED')}
              </span>
            </div>
          )}

          {feedback?.type === 'override' && (
            <div className={styles.feedbackRow}>
              <span className={styles.feedbackOverrideRecorded}>
                {t('CLINICAL_INSIGHTS_OVERRIDE_RECORDED')} &middot;{' '}
                {feedback.reasonLabel}
              </span>
            </div>
          )}

          {isOverriding && (
            <div className={styles.overrideForm}>
              <Select
                id={`override-reason-${rec.id}`}
                labelText={t('CLINICAL_INSIGHTS_OVERRIDE_REASON_LABEL')}
                value={overrideReason}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setOverrideReason(e.target.value)
                }
              >
                <SelectItem value="" text="" />
                {OVERRIDE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value} text={r.label} />
                ))}
              </Select>
              <TextInput
                id={`override-comment-${rec.id}`}
                labelText={t('CLINICAL_INSIGHTS_OVERRIDE_NOTES')}
                value={overrideComment}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setOverrideComment(e.target.value)
                }
              />
              <div className={styles.overrideActions}>
                <Button
                  kind="primary"
                  size="sm"
                  disabled={!overrideReason}
                  onClick={() => handleOverrideSave(rec)}
                >
                  {t('CLINICAL_INSIGHTS_SAVE_OVERRIDE')}
                </Button>
                <Button
                  kind="secondary"
                  size="sm"
                  onClick={handleOverrideCancel}
                >
                  {t('CLINICAL_INSIGHTS_API_KEY_CANCEL')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </AccordionItem>
    );
  };

  const renderDataGapItem = (gap: DataGap) => (
    <AccordionItem
      key={gap.missing_element}
      title={`${gap.missing_element} — ${gap.recommended_frequency}`}
    >
      <div className={styles.gapBody}>
        <p className={styles.gapSuggestion}>{gap.suggestion}</p>
        {gap.last_recorded && (
          <p className={styles.gapLastRecorded}>
            {t('CLINICAL_INSIGHTS_LAST_RECORDED')}: {gap.last_recorded}
          </p>
        )}
      </div>
    </AccordionItem>
  );

  // ── JSX ─────────────────────────────────────────────────────────────────────

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
            {selectedSpecialty && !isGenerating && !hasInsights && (
              <span className={styles.selectedSpecialtyLabel}>
                {selectedSpecialty.replace(/_/g, ' ').replace('.', ' › ')}
              </span>
            )}
          </div>
          <Button
            size="sm"
            kind="primary"
            onClick={handleGenerateInsights}
            disabled={
              !canGenerate ||
              isGenerating ||
              (specialties.length > 1 && !selectedSpecialty)
            }
          >
            {t('CLINICAL_INSIGHTS_GENERATE_BUTTON')}
          </Button>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div
          className={styles.body}
          ref={bodyRef}
          onScroll={checkScrollMore}
        >
          {/* Empty state — specialty selector */}
          {showEmptyState && (
            <div className={styles.emptyState}>
              {specialties.length > 1 ? (
                <>
                  <p className={styles.emptyStateText}>
                    {t('CLINICAL_INSIGHTS_SELECT_SPECIALTY')}
                  </p>
                  <div className={styles.specialtyCards}>
                    {specialties.map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        className={`${styles.specialtyCard} ${selectedSpecialty === sp ? styles.specialtyCardSelected : ''}`}
                        onClick={() => setSelectedSpecialty(sp)}
                      >
                        <span className={styles.specialtyCardCheck}>
                          {selectedSpecialty === sp ? '●' : '○'}
                        </span>
                        <span className={styles.specialtyCardName}>
                          {sp.replace(/_/g, ' ').replace('.', ' › ')}
                        </span>
                      </button>
                    ))}
                  </div>
                  <Button
                    kind="primary"
                    onClick={handleGenerateInsights}
                    disabled={!canGenerate || (specialties.length > 1 && !selectedSpecialty)}
                  >
                    {t('CLINICAL_INSIGHTS_GENERATE_FOR')}{' '}
                    {selectedSpecialty?.replace(/_/g, ' ').replace('.', ' › ')}
                  </Button>
                </>
              ) : (
                <>
                  <span className={styles.emptyStateIcon}>&#x1F9E0;</span>
                  <p className={styles.emptyStateText}>
                    {t('CLINICAL_INSIGHTS_EMPTY_STATE')}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Loading / streaming progress */}
          {isGenerating && (
            <div className={styles.progressSection}>
              <div className={styles.stageSteps}>
                {STAGE_ORDER.map((stage, idx) => {
                  const stageIdx = STAGE_ORDER.indexOf(currentStage);
                  const isDone = stageIdx > idx;
                  const isActive = stageIdx === idx;
                  return (
                    <React.Fragment key={stage}>
                      <span
                        className={`${styles.stagePill} ${isDone ? styles.stageDone : isActive ? styles.stageActive : styles.stagePending}`}
                      >
                        {isDone ? '✓ ' : isActive ? '→ ' : ''}
                        {STAGE_LABELS[stage].replace('…', '')}
                      </span>
                      {idx < STAGE_ORDER.length - 1 && (
                        <span className={styles.stageConnector} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              {currentStage === 'llm' && (
                <>
                  <div className={styles.progressBarTrack}>
                    <ProgressBar
                      value={progressPct}
                      max={100}
                      hideLabel
                      label=""
                    />
                  </div>
                  <p className={styles.progressMsg}>{progressMsg}</p>
                </>
              )}
              {currentStage !== 'llm' && progressMsg && (
                <p className={styles.progressMsg}>{progressMsg}</p>
              )}
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
              {/* Run metrics bar */}
              {insights.llm_stats && (
                <>
                  <button
                    type="button"
                    className={styles.metricsBar}
                    onClick={() => setShowMetrics((prev) => !prev)}
                  >
                    {insights.llm_stats.latency_ms}ms &middot;{' '}
                    {(
                      insights.llm_stats.input_tokens +
                      insights.llm_stats.output_tokens
                    ).toLocaleString()}{' '}
                    tokens
                    <span className={styles.metricsBarToggle}>
                      {showMetrics ? '▲' : '▼'}
                    </span>
                  </button>
                  {showMetrics && (
                    <div className={styles.metricsPanel}>
                      <div className={styles.metricBox}>
                        <span className={styles.metricValue}>
                          {insights.llm_stats.latency_ms}ms
                        </span>
                        <span className={styles.metricLabel}>Latency</span>
                      </div>
                      <div className={styles.metricBox}>
                        <span className={styles.metricValue}>
                          {insights.llm_stats.input_tokens.toLocaleString()}
                        </span>
                        <span className={styles.metricLabel}>
                          Input tokens
                        </span>
                      </div>
                      <div className={styles.metricBox}>
                        <span className={styles.metricValue}>
                          {insights.llm_stats.output_tokens.toLocaleString()}
                        </span>
                        <span className={styles.metricLabel}>
                          Output tokens
                        </span>
                      </div>
                      <div className={styles.metricBox}>
                        <span className={styles.metricValue}>
                          {insights.llm_stats.model}
                        </span>
                        <span className={styles.metricLabel}>Model</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Status Summary */}
              <div className={styles.summaryBlock}>
                <p className={styles.overallAssessment}>
                  {insights.status_summary.overall_assessment}
                </p>
                <div className={styles.kiGrid}>
                  {insights.status_summary.key_indicators.map((ind, idx) =>
                    renderKiCard(ind, idx),
                  )}
                </div>
              </div>

              {/* Tabs: Recommendations + Data Gaps */}
              <div className={styles.tabsContainer}>
                <Tabs>
                  <TabList aria-label="Clinical insights tabs">
                    <Tab>
                      <span className={styles.tabBadge}>
                        {t('CLINICAL_INSIGHTS_RECOMMENDATIONS')} (
                        {insights.recommendations.length})
                        {highPriorityCount > 0 && (
                          <span className={styles.highPriorityCount}>
                            {' '}
                            — {highPriorityCount}{' '}
                            {t('CLINICAL_INSIGHTS_HIGH_PRIORITY')}
                          </span>
                        )}
                      </span>
                    </Tab>
                    <Tab>
                      {t('CLINICAL_INSIGHTS_DATA_GAPS')} (
                      {insights.data_gaps.length})
                    </Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel>
                      {insights.recommendations.length > 0 ? (
                        <Accordion>
                          {insights.recommendations.map(
                            renderRecommendationItem,
                          )}
                        </Accordion>
                      ) : (
                        <p className={styles.noDataGaps}>
                          {t('CLINICAL_INSIGHTS_NO_DATA_GAPS')}
                        </p>
                      )}
                    </TabPanel>
                    <TabPanel>
                      {insights.data_gaps.length > 0 ? (
                        <Accordion>
                          {insights.data_gaps.map(renderDataGapItem)}
                        </Accordion>
                      ) : (
                        <p className={styles.noDataGaps}>
                          {t('CLINICAL_INSIGHTS_NO_DATA_GAPS')}
                        </p>
                      )}
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </div>

              {/* Footer */}
              <div className={styles.footer}>
                <p className={styles.disclaimer}>
                  {insights.metadata.disclaimer}
                </p>
                <p className={styles.footerMeta}>
                  {insights.metadata.model_used} &middot;{' '}
                  {insights.metadata.guidelines_version}
                </p>
                {insights.guidelines_used && insights.guidelines_used.length > 0 && (
                  <p className={styles.footerGuidelines}>
                    {t('CLINICAL_INSIGHTS_GUIDELINES')}:{' '}
                    {insights.guidelines_used.join(', ')}
                  </p>
                )}
              </div>

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
        {hasMoreBelow && (
          <button
            type="button"
            className={styles.scrollMoreBtn}
            onClick={() => {
              if (bodyRef.current) {
                bodyRef.current.scrollBy({ top: 120, behavior: 'smooth' });
              }
            }}
            aria-label="Scroll for more"
          >
            <ChevronDown size={16} className={styles.scrollMoreChevron} />
            <span className={styles.scrollMoreLabel}>more</span>
          </button>
        )}
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
