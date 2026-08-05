'use strict';

const path = require('path');
const { buildProductionContentBundle, productionContentReport } = require('../src/content/production-bundle.cjs');

const bundle = buildProductionContentBundle({ projectRoot: path.resolve(__dirname, '..') });
const report = productionContentReport(bundle);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
