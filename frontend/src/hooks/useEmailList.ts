import { useState, useEffect, useCallback } from 'react';
import type { EmailJob } from '../types/email';

interface FetcherResponse {
  jobs: EmailJob[];
  limit?: number;
  offset?: number;
}

interface UseEmailListResult {
  jobs: EmailJob[];
  limit: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useEmailList(fetcher: () => Promise<FetcherResponse>): UseEmailListResult {
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [limit, setLimit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await fetcher();
      setJobs(data.jobs);
      setLimit(data.limit || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetcher]);

  const reload = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData(true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchData]);

  return { jobs, limit, loading, refreshing, error, reload };
}
