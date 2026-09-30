import { Client } from '@elastic/elasticsearch';

// Single shared Elasticsearch client.
// Connection URL comes from ELASTICSEARCH_URL environment variable.
// No credentials needed for local dev (security disabled in docker-compose).
const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
});

export default esClient;
