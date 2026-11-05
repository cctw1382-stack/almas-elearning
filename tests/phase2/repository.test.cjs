// Run the same repository contract against the migrated application's source.
process.env.ALMAS_REPOSITORY_SOURCE = require('node:path').resolve(__dirname, '../../apps/web/src/mock-repository.js');
require('../repository.test.cjs');
