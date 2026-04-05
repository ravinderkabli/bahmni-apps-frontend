import { AnthropicToolDefinition } from './agentTypes';

export const AGENT_TOOLS: AnthropicToolDefinition[] = [
  {
    name: 'register_patient',
    description:
      'Register a new patient in Bahmni EMR. Call this when the user wants to create a new patient record. Minimum required: first name, last name, gender. Always try to collect date of birth or estimated age before calling.',
    input_schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'Patient first name' },
        lastName: { type: 'string', description: 'Patient last name' },
        gender: {
          type: 'string',
          enum: ['M', 'F', 'O'],
          description: 'M=Male, F=Female, O=Other/Unknown',
        },
        dateOfBirth: {
          type: 'string',
          description: 'Date of birth in ISO format YYYY-MM-DD',
        },
        estimatedAgeYears: {
          type: 'number',
          description: 'Estimated age in years when exact DOB is not known',
        },
        phoneNumber: { type: 'string', description: 'Mobile phone number' },
        address: { type: 'string', description: 'Free-text address' },
      },
      required: ['firstName', 'lastName', 'gender'],
    },
  },
  {
    name: 'search_patient',
    description:
      'Search for an existing patient by name or patient ID. Returns up to 5 matches. Wait for user to confirm which patient before proceeding.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Patient name or identifier to search',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'start_encounter',
    description:
      'Navigate to the clinical consultation page for a specific patient and open the consultation pad. Use after the correct patient has been identified and confirmed by the user.',
    input_schema: {
      type: 'object',
      properties: {
        patientUuid: {
          type: 'string',
          description: 'UUID of the patient (obtained from search_patient)',
        },
        encounterTypeName: {
          type: 'string',
          description:
            'Encounter type name, e.g. "Consultation", "OPD". Defaults to Consultation if not specified.',
        },
      },
      required: ['patientUuid'],
    },
  },
  {
    name: 'add_diagnosis',
    description:
      'Add a clinical diagnosis to the current consultation. Call once per diagnosis. The system will resolve the clinical term to an OpenMRS concept automatically.',
    input_schema: {
      type: 'object',
      properties: {
        conceptName: {
          type: 'string',
          description:
            'Clinical name of the diagnosis in English (e.g. "Hypertension", "Type 2 Diabetes")',
        },
        certainty: {
          type: 'string',
          enum: ['confirmed', 'provisional'],
          description: 'Diagnostic certainty',
        },
      },
      required: ['conceptName', 'certainty'],
    },
  },
  {
    name: 'add_medication',
    description:
      'Add a medication order to the current consultation. Call once per medication.',
    input_schema: {
      type: 'object',
      properties: {
        drugName: {
          type: 'string',
          description: 'Drug name, e.g. "Paracetamol", "Metformin 500mg"',
        },
        dosage: { type: 'number', description: 'Dose amount (numeric)' },
        dosageUnit: {
          type: 'string',
          description: 'Dose unit, e.g. "mg", "ml", "tablet"',
        },
        frequency: {
          type: 'string',
          description:
            'Dosing frequency, e.g. "once daily", "twice daily", "three times a day", "TDS", "BD"',
        },
        route: {
          type: 'string',
          description: 'Administration route, e.g. "oral", "IV", "IM", "topical"',
        },
        durationDays: {
          type: 'number',
          description: 'Duration in days (omit for STAT orders)',
        },
        isStat: {
          type: 'boolean',
          description: 'True for immediate single-dose STAT order',
        },
      },
      required: ['drugName', 'dosage', 'dosageUnit', 'frequency', 'route'],
    },
  },
  {
    name: 'add_observation',
    description:
      'Record a clinical observation or vital sign for the current encounter (e.g. temperature, blood pressure, weight, blood glucose).',
    input_schema: {
      type: 'object',
      properties: {
        conceptName: {
          type: 'string',
          description:
            'Observation concept name, e.g. "Temperature", "Systolic blood pressure", "Weight", "Pulse"',
        },
        value: {
          type: ['string', 'number'],
          description: 'Observed value',
        },
        unit: {
          type: 'string',
          description:
            'Unit of measurement, e.g. "°C", "°F", "mmHg", "kg", "bpm"',
        },
      },
      required: ['conceptName', 'value'],
    },
  },
  {
    name: 'submit_consultation',
    description:
      'Submit and save the completed consultation. ONLY call this after the user has explicitly said they are done and confirmed. Do not call this without explicit confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          description: 'Must be true — safety gate, set true only when user confirms',
        },
      },
      required: ['confirm'],
    },
  },
];
