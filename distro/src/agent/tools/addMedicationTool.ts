import {
  fetchMedicationOrdersMetadata,
  searchMedications,
} from '@bahmni/services';
import { ConceptClass } from '@bahmni/services';
import { Frequency } from '@bahmni/services';
import { useMedicationStore } from '@bahmni/clinical-app/stores/medicationsStore';
import { getMedicationsFromBundle } from '@bahmni/clinical-app/services/medicationService';
import { AddMedicationInput, ToolResult } from '../types/agentTypes';

/**
 * Case-insensitive match of a user-supplied string against a list of ConceptClass objects.
 * Also handles common abbreviations: BD→twice daily, TDS→three times a day, OD→once daily
 */
const FREQUENCY_ALIASES: Record<string, string> = {
  od: 'once daily',
  bd: 'twice daily',
  tds: 'three times a day',
  tid: 'three times a day',
  qid: 'four times a day',
  sos: 'as needed',
  prn: 'as needed',
  stat: 'immediately',
  'subah sham': 'twice daily',
  'subah': 'once daily',
  'teen baar': 'three times a day',
  'do baar': 'twice daily',
};

const resolveByName = <T extends ConceptClass>(
  list: T[],
  query: string,
): T | null => {
  const normalized = (FREQUENCY_ALIASES[query.toLowerCase()] ?? query).toLowerCase();
  return (
    list.find((item) => item.name.toLowerCase() === normalized) ??
    list.find((item) => item.name.toLowerCase().includes(normalized)) ??
    null
  );
};

export const addMedication = async (
  input: AddMedicationInput,
): Promise<ToolResult> => {
  try {
    // 1. Search for the drug
    const bundle = await searchMedications(input.drugName, 5);
    const medications = getMedicationsFromBundle(bundle);

    if (medications.length === 0) {
      return {
        success: false,
        error: `No medication found matching "${input.drugName}". Please try a different drug name.`,
      };
    }

    const medication = medications[0];
    const displayName =
      medication.code?.coding?.[0]?.display ?? input.drugName;

    // 2. Fetch metadata (frequencies, routes, doseUnits)
    const metadata = await fetchMedicationOrdersMetadata();

    // 3. Resolve frequency
    const frequency = resolveByName(
      metadata.frequencies as Frequency[],
      input.frequency,
    ) as Frequency | null;

    // 4. Resolve route
    const route = resolveByName(metadata.routes, input.route) as ConceptClass | null;

    // 5. Resolve dosage unit
    const dosageUnit = resolveByName(metadata.doseUnits, input.dosageUnit) as ConceptClass | null;

    // 6. Add medication to store
    const store = useMedicationStore.getState();
    store.addMedication(medication, displayName);

    const medicationId = medication.id!;

    store.updateDosage(medicationId, input.dosage);

    if (dosageUnit) {
      store.updateDosageUnit(medicationId, { name: dosageUnit.name, uuid: dosageUnit.uuid });
    }

    if (frequency) {
      store.updateFrequency(medicationId, frequency);
    }

    if (route) {
      store.updateRoute(medicationId, { name: route.name, uuid: route.uuid });
    }

    if (input.durationDays) {
      store.updateDuration(medicationId, input.durationDays);
      // Map duration unit concept to DurationUnitOption — default to "days"
      const daysUnit = metadata.durationUnits.find((u) =>
        u.name.toLowerCase().includes('day'),
      );
      if (daysUnit) {
        store.updateDurationUnit(medicationId, {
          code: 'd',
          display: daysUnit.name,
          daysMultiplier: 1,
        });
      }
    }

    if (input.isStat) {
      store.updateisSTAT(medicationId, true);
    }

    return {
      success: true,
      data: {
        medicationId,
        display: displayName,
        dosage: input.dosage,
        dosageUnit: dosageUnit?.name ?? input.dosageUnit,
        frequency: frequency?.name ?? input.frequency,
        route: route?.name ?? input.route,
        durationDays: input.durationDays,
        isStat: input.isStat ?? false,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add medication',
    };
  }
};
