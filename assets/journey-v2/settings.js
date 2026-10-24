const SETTINGS_PATH = 'assets/journey-v2/settings.json';

function describeValue(value) {
  if (value === undefined) return '<missing>';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export class JourneySettingsError extends Error {
  constructor(configuredValue, projectCount) {
    const range = `0..${projectCount}`;
    super(`Invalid orbitCount in ${SETTINGS_PATH}: configured value ${describeValue(configuredValue)}; expected a safe integer in the range ${range}.`);
    this.name = 'JourneySettingsError';
    this.path = SETTINGS_PATH;
    this.configuredValue = configuredValue;
    this.min = 0;
    this.max = projectCount;
    this.range = range;
  }
}

export function validateJourneySettings(input, projectCount) {
  if (!Number.isSafeInteger(projectCount) || projectCount < 0) {
    throw new TypeError('projectCount must be a non-negative safe integer.');
  }

  const isObject = input !== null && typeof input === 'object' && !Array.isArray(input);
  const configuredValue = isObject ? input.orbitCount : undefined;
  if (!Number.isSafeInteger(configuredValue) || configuredValue < 0 || configuredValue > projectCount) {
    throw new JourneySettingsError(configuredValue, projectCount);
  }

  return {orbitCount:configuredValue};
}
