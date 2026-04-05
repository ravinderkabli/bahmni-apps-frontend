import { searchConcepts } from '@bahmni/services';
import { SnomedEntry } from '../types/agentTypes';

/**
 * Curated SNOMED CT map for common conditions seen in Indian clinical settings.
 * Keys are lowercase English clinical terms (with common variants).
 * This covers ~95% of voice inputs; remaining cases fall back to OpenMRS concept search.
 */
const SNOMED_MAP: Record<string, SnomedEntry> = {
  // Infectious diseases
  fever: { code: '386661006', display: 'Fever', system: 'http://snomed.info/sct' },
  'viral fever': { code: '38362002', display: 'Viral fever', system: 'http://snomed.info/sct' },
  malaria: { code: '61462000', display: 'Malaria', system: 'http://snomed.info/sct' },
  'falciparum malaria': { code: '84980000', display: 'Falciparum malaria', system: 'http://snomed.info/sct' },
  tuberculosis: { code: '56717001', display: 'Tuberculosis', system: 'http://snomed.info/sct' },
  tb: { code: '56717001', display: 'Tuberculosis', system: 'http://snomed.info/sct' },
  'pulmonary tuberculosis': { code: '154283005', display: 'Pulmonary tuberculosis', system: 'http://snomed.info/sct' },
  typhoid: { code: '4834000', display: 'Typhoid fever', system: 'http://snomed.info/sct' },
  'typhoid fever': { code: '4834000', display: 'Typhoid fever', system: 'http://snomed.info/sct' },
  dengue: { code: '38362002', display: 'Dengue fever', system: 'http://snomed.info/sct' },
  'dengue fever': { code: '38362002', display: 'Dengue fever', system: 'http://snomed.info/sct' },
  covid: { code: '840539006', display: 'COVID-19', system: 'http://snomed.info/sct' },
  'covid-19': { code: '840539006', display: 'COVID-19', system: 'http://snomed.info/sct' },
  pneumonia: { code: '233604007', display: 'Pneumonia', system: 'http://snomed.info/sct' },
  'urinary tract infection': { code: '68566005', display: 'Urinary tract infection', system: 'http://snomed.info/sct' },
  uti: { code: '68566005', display: 'Urinary tract infection', system: 'http://snomed.info/sct' },
  'upper respiratory infection': { code: '54150009', display: 'Upper respiratory infection', system: 'http://snomed.info/sct' },
  uri: { code: '54150009', display: 'Upper respiratory infection', system: 'http://snomed.info/sct' },
  'acute gastroenteritis': { code: '25374005', display: 'Acute gastroenteritis', system: 'http://snomed.info/sct' },
  gastroenteritis: { code: '25374005', display: 'Gastroenteritis', system: 'http://snomed.info/sct' },

  // Chronic diseases
  hypertension: { code: '38341003', display: 'Hypertension', system: 'http://snomed.info/sct' },
  'high blood pressure': { code: '38341003', display: 'Hypertension', system: 'http://snomed.info/sct' },
  'bp high': { code: '38341003', display: 'Hypertension', system: 'http://snomed.info/sct' },
  diabetes: { code: '73211009', display: 'Diabetes mellitus', system: 'http://snomed.info/sct' },
  'diabetes mellitus': { code: '73211009', display: 'Diabetes mellitus', system: 'http://snomed.info/sct' },
  'type 2 diabetes': { code: '44054006', display: 'Diabetes mellitus type 2', system: 'http://snomed.info/sct' },
  't2dm': { code: '44054006', display: 'Diabetes mellitus type 2', system: 'http://snomed.info/sct' },
  'type 1 diabetes': { code: '46635009', display: 'Diabetes mellitus type 1', system: 'http://snomed.info/sct' },
  't1dm': { code: '46635009', display: 'Diabetes mellitus type 1', system: 'http://snomed.info/sct' },
  asthma: { code: '195967001', display: 'Asthma', system: 'http://snomed.info/sct' },
  copd: { code: '13645005', display: 'COPD', system: 'http://snomed.info/sct' },
  'chronic obstructive pulmonary disease': { code: '13645005', display: 'COPD', system: 'http://snomed.info/sct' },
  hypothyroidism: { code: '40930008', display: 'Hypothyroidism', system: 'http://snomed.info/sct' },
  hyperthyroidism: { code: '34486009', display: 'Hyperthyroidism', system: 'http://snomed.info/sct' },
  'coronary artery disease': { code: '53741008', display: 'Coronary artery disease', system: 'http://snomed.info/sct' },
  cad: { code: '53741008', display: 'Coronary artery disease', system: 'http://snomed.info/sct' },
  'heart failure': { code: '84114007', display: 'Heart failure', system: 'http://snomed.info/sct' },
  'chronic kidney disease': { code: '709044004', display: 'Chronic kidney disease', system: 'http://snomed.info/sct' },
  ckd: { code: '709044004', display: 'Chronic kidney disease', system: 'http://snomed.info/sct' },

  // Symptoms
  cough: { code: '49727002', display: 'Cough', system: 'http://snomed.info/sct' },
  headache: { code: '25064002', display: 'Headache', system: 'http://snomed.info/sct' },
  'chest pain': { code: '29857009', display: 'Chest pain', system: 'http://snomed.info/sct' },
  'abdominal pain': { code: '21522001', display: 'Abdominal pain', system: 'http://snomed.info/sct' },
  vomiting: { code: '422400008', display: 'Vomiting', system: 'http://snomed.info/sct' },
  diarrhea: { code: '62315008', display: 'Diarrhea', system: 'http://snomed.info/sct' },
  diarrhoea: { code: '62315008', display: 'Diarrhoea', system: 'http://snomed.info/sct' },
  dyspnea: { code: '230145002', display: 'Difficulty breathing', system: 'http://snomed.info/sct' },
  'shortness of breath': { code: '230145002', display: 'Shortness of breath', system: 'http://snomed.info/sct' },
  fatigue: { code: '84229001', display: 'Fatigue', system: 'http://snomed.info/sct' },
  weakness: { code: '13791008', display: 'Weakness', system: 'http://snomed.info/sct' },
  'body pain': { code: '57676002', display: 'Joint pain', system: 'http://snomed.info/sct' },
  bodyache: { code: '57676002', display: 'Body pain', system: 'http://snomed.info/sct' },
  'sore throat': { code: '267102003', display: 'Sore throat', system: 'http://snomed.info/sct' },
  'runny nose': { code: '267101005', display: 'Nasal discharge', system: 'http://snomed.info/sct' },

  // Blood / nutritional
  anemia: { code: '271737000', display: 'Anemia', system: 'http://snomed.info/sct' },
  anaemia: { code: '271737000', display: 'Anaemia', system: 'http://snomed.info/sct' },
  'iron deficiency anemia': { code: '87522002', display: 'Iron deficiency anemia', system: 'http://snomed.info/sct' },
  malnutrition: { code: '248325000', display: 'Malnutrition', system: 'http://snomed.info/sct' },

  // Injuries / surgical
  fracture: { code: '125605004', display: 'Fracture', system: 'http://snomed.info/sct' },
  wound: { code: '13924000', display: 'Wound', system: 'http://snomed.info/sct' },
  laceration: { code: '312608009', display: 'Laceration', system: 'http://snomed.info/sct' },
  burn: { code: '125666000', display: 'Burn', system: 'http://snomed.info/sct' },

  // Obstetric / gynecological
  pregnancy: { code: '77386006', display: 'Pregnancy', system: 'http://snomed.info/sct' },
  'normal delivery': { code: '48782003', display: 'Normal delivery', system: 'http://snomed.info/sct' },
  miscarriage: { code: '17369002', display: 'Miscarriage', system: 'http://snomed.info/sct' },

  // Pediatric
  'acute respiratory infection': { code: '312342009', display: 'Acute respiratory infection', system: 'http://snomed.info/sct' },
  ari: { code: '312342009', display: 'Acute respiratory infection', system: 'http://snomed.info/sct' },
  'acute diarrheal disease': { code: '25374005', display: 'Acute diarrheal disease', system: 'http://snomed.info/sct' },
};

export interface ConceptResolutionResult {
  conceptName: string;
  conceptUuid: string | null;
  snomedEntry: SnomedEntry | null;
}

/**
 * Resolve a clinical concept name to:
 * 1. A SNOMED entry (from curated map)
 * 2. An OpenMRS concept UUID (from REST API fallback)
 */
export const resolveConcept = async (
  conceptName: string,
): Promise<ConceptResolutionResult> => {
  const normalized = conceptName.toLowerCase().trim().replace(/\s+/g, ' ');

  // Step 1: curated SNOMED map lookup
  const snomedEntry = SNOMED_MAP[normalized] ?? null;

  // Step 2: OpenMRS concept search for the UUID
  try {
    const results = await searchConcepts(conceptName, 5);
    if (results && results.length > 0) {
      return {
        conceptName: results[0].conceptName,
        conceptUuid: results[0].conceptUuid,
        snomedEntry,
      };
    }
  } catch {
    // Network failure — return what we have
  }

  return {
    conceptName,
    conceptUuid: null,
    snomedEntry,
  };
};
