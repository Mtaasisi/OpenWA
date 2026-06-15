import type { ReactNode } from 'react';
import type { ChannelsGridFilter } from './channel-grid-utils';

export type ChannelsGridExtrasRender = (filter: ChannelsGridFilter) => ReactNode;

export type ChannelsGridExtraCounts = Partial<
  Record<'all' | 'active' | 'inactive' | 'connecting', number>
>;
