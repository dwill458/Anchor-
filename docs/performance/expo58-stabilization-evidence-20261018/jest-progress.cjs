const fs = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname, 'jest-candidate-progress.jsonl');
const append = entry => fs.appendFileSync(output, JSON.stringify({ utc: new Date().toISOString(), ...entry }) + '\n');
module.exports = class StabilizationProgress {
  onRunStart(results) { fs.writeFileSync(output, ''); append({ event: 'run-start', suites: results.numTotalTestSuites }); }
  onTestStart(test) { append({ event: 'suite-start', file: test.path }); }
  onTestResult(test, result) { append({ event: 'suite-result', file: test.path,
    passed: result.numPassingTests, failed: result.numFailingTests, pending: result.numPendingTests,
    loadFailure: Boolean(result.testExecError), start: result.perfStats.start, end: result.perfStats.end }); }
  onRunComplete(_contexts, results) { append({ event: 'run-complete', totalSuites: results.numTotalTestSuites,
    passedSuites: results.numPassedTestSuites, failedSuites: results.numFailedTestSuites,
    passedTests: results.numPassedTests, failedTests: results.numFailedTests, pendingTests: results.numPendingTests }); }
};
