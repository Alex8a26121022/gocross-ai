import { createCatalogueService } from '../catalogue.mjs';
const result = await createCatalogueService().refresh();
console.log(JSON.stringify({ status: result.status, count: result.products?.length || 0, source: result.source?.url, savedTo: '.runtime/catalogue.json', failures: result.failures || [], error: result.error }, null, 2));
if (!result.products?.length) process.exitCode = 1;
