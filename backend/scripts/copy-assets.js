// tsc does not copy non-TypeScript files. Ask Chart's versioned instruction file is read at runtime, so the
// build copies it next to the compiled output (dist/services/chart/ask/).
const fs = require('fs');
const path = require('path');

const files = ['services/chart/ask/chart-agent.md'];
for (const file of files) {
  const from = path.join(__dirname, '..', 'src', file);
  const to = path.join(__dirname, '..', 'dist', file);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
