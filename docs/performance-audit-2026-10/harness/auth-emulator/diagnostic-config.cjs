'use strict';

const EXPECTED_PROJECT_ID = 'demo-anchor-perf';
const EXPECTED_APPLICATION_ID = 'com.anchorintentions.perflab20261012';
const EXPECTED_API_URL = 'http://127.0.0.1:39999';
const EXPECTED_AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';

function validateDiagnosticConfig({ applicationId, apiUrl, authEmulatorUrl, firebaseProjectId }) {
  if (applicationId !== EXPECTED_APPLICATION_ID) {
    throw new Error('Diagnostic build application ID is not allowed.');
  }
  if (apiUrl !== EXPECTED_API_URL) {
    throw new Error('Diagnostic API must use the loopback fixture endpoint.');
  }
  if (authEmulatorUrl !== EXPECTED_AUTH_EMULATOR_URL) {
    throw new Error('Diagnostic Auth must use the loopback emulator endpoint.');
  }
  if (firebaseProjectId !== EXPECTED_PROJECT_ID) {
    throw new Error('Diagnostic Firebase app must use the fixed demo project.');
  }
  return true;
}

module.exports = {
  EXPECTED_PROJECT_ID,
  EXPECTED_APPLICATION_ID,
  EXPECTED_API_URL,
  EXPECTED_AUTH_EMULATOR_URL,
  validateDiagnosticConfig,
};
