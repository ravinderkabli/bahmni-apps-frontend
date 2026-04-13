export interface KeyIndicator {
  name: string;
  value: string;
  target: string;
  status: 'GREEN' | 'YELLOW' | 'RED';
  trend: 'IMPROVING' | 'STABLE' | 'WORSENING' | null;
  trend_detail: string | null;
}

export interface Recommendation {
  id: string;
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  headline: string;
  reasoning: string;
  guideline_reference: string;
  evidence_level: string;
  contraindication_check?: string | null;
}

export interface DataGap {
  missing_element: string;
  last_recorded: string | null;
  recommended_frequency: string;
  suggestion: string;
}

export interface InsightsResponse {
  request_id: string;
  generated_at: string;
  specialty: string;
  status_summary: {
    overall_assessment: string;
    key_indicators: KeyIndicator[];
  };
  recommendations: Recommendation[];
  data_gaps: DataGap[];
  metadata: {
    model_used: string;
    guidelines_version: string;
    disclaimer: string;
  };
}

export interface InsightsStreamEvent {
  event:
    | 'status'
    | 'llm_context'
    | 'llm_progress'
    | 'result'
    | 'error'
    | 'done';
  message?: string;
  stage?: string;
  sections?: string[];
  elapsed_s?: number;
  data?: InsightsResponse;
  code?: number;
}

export const streamInsights = (
  patientUuid: string,
  doctorUuid: string,
  encounterUuid: string,
  onEvent: (event: InsightsStreamEvent) => void,
): EventSource => {
  const params = new URLSearchParams({
    patient_uuid: patientUuid,
    doctor_uuid: doctorUuid,
    encounter_uuid: encounterUuid,
  });
  const url = `/bahmni-ai/api/v1/insights/stream?${params.toString()}`;
  const es = new EventSource(url);

  es.onmessage = (e: MessageEvent<string>) => {
    if (e.data === '[DONE]') {
      onEvent({ event: 'done' });
      es.close();
      return;
    }
    try {
      const parsed = JSON.parse(e.data) as InsightsStreamEvent;
      onEvent(parsed);
    } catch {
      // ignore non-JSON frames
    }
  };

  es.onerror = () => {
    onEvent({ event: 'error', message: 'Connection error', code: 503 });
    es.close();
  };

  return es;
};

export const askInsightsQuestion = async (
  question: string,
  insights: InsightsResponse,
  apiKey: string,
): Promise<string> => {
  const indicatorLines = insights.status_summary.key_indicators
    .map((i) => `- ${i.name}: ${i.value} (target: ${i.target}, ${i.status})`)
    .join('\n');

  const recommendationLines = insights.recommendations
    .map((r) => `[${r.priority}] ${r.headline} — ${r.reasoning}`)
    .join('\n');

  const gapLines = insights.data_gaps
    .map((g) => `- ${g.missing_element}: ${g.suggestion}`)
    .join('\n');

  const systemPrompt = `You are a clinical decision support assistant. The clinician has generated the following AI insights for their patient.

Overall Assessment: ${insights.status_summary.overall_assessment}

Key Indicators:
${indicatorLines}

Recommendations:
${recommendationLines}

Data Gaps:
${gapLines}

Answer the clinician's follow-up questions based on this context. Be concise and clinically accurate. Remind the clinician that AI insights are advisory only and clinical judgment prevails.`;

  const response = await fetch('/anthropic-proxy/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ text?: string }>;
  };
  return data.content?.[0]?.text ?? '';
};
