import { useQuery } from '@tanstack/react-query';
import { quoteApi } from '../services/api';

export function useQuotePermissions() {
  const { data } = useQuery({
    queryKey: ['quotes', 'permissions'],
    queryFn: () => quoteApi.getPermissions(),
    staleTime: 60_000,
  });

  const perms = data?.permissions ?? [];
  const has = (p: string) => perms.includes(p);

  return {
    canView: has('view_quotes') || has('create_chat_quote') || has('send_chat_quote'),
    canCreate: has('create_chat_quote'),
    canSend: has('send_chat_quote'),
    canConvert: has('convert_quote_to_sale'),
    canApproveDiscount: has('approve_quote_discount'),
  };
}
