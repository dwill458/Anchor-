$qaEvidence = $PSScriptRoot
Set-Location 'E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile'
# Worker recycling bounds runner memory without skipping suites or changing assertions/timeouts.
& node node_modules\jest\bin\jest.js --maxWorkers=2 --workerIdleMemoryLimit=512MB --forceExit --silent --json "--outputFile=$qaEvidence\jest-candidate.json" --reporters=default "--reporters=$qaEvidence\jest-progress.cjs" *> "$qaEvidence\jest-candidate.log"
$qaExit = $LASTEXITCODE
Set-Content "$qaEvidence\jest-candidate.exit.txt" $qaExit
exit $qaExit
