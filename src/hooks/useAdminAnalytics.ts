import { useQuery } from '@tanstack/react-query';
import { fetchAdminAnalytics } from '../lib/api';

export function useAdminAnalytics() {
  return useQuery({
    queryKey: ['admin-analytics'],
    queryFn: fetchAdminAnalytics,
  });
}
