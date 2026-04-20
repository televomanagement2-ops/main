import { useQuery } from '@tanstack/react-query';
import { fetchShippingMethods } from '../lib/api';

export function useShippingMethods() {
  return useQuery({
    queryKey: ['shipping-methods'],
    queryFn: fetchShippingMethods,
    staleTime: 10 * 60 * 1000,
  });
}
