import { InboxCustomerPanel } from '../../pages/InboxCustomerPanel';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof InboxCustomerPanel>;

export function DirectCustomerCrmPanel(props: Props) {
  return <InboxCustomerPanel {...props} />;
}
