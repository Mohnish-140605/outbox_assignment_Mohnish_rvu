import { Client } from '@elastic/elasticsearch';
import { backendConfig } from './config/runtime';

// Single shared Elasticsearch client.
// Connection URL comes from the validated runtime config.
// No credentials needed for local dev (security disabled in docker-compose).
const esClient = new Client({
  node: backendConfig.elasticsearchUrl,
});

export default esClient;
