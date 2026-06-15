import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusChip } from './StatusChip';

describe('StatusChip', () => {
  it('renders success label', () => {
    render(<StatusChip id="ai" label="AI Safe" status="success" />);
    expect(screen.getByText('AI Safe')).toBeTruthy();
  });

  it('renders warning state class', () => {
    const { container } = render(<StatusChip id="wa" label="QR Needed" status="warning" />);
    expect(container.querySelector('.status-chip--warning')).toBeTruthy();
  });

  it('renders error state class', () => {
    const { container } = render(<StatusChip id="db" label="Database Offline" status="error" />);
    expect(container.querySelector('.status-chip--error')).toBeTruthy();
  });

  it('calls click handler when clickable', () => {
    const onClick = vi.fn();
    render(<StatusChip id="q" label="Queue" value="2" status="warning" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('status bar preferences', () => {
  it('defaults showStatusBar to true', async () => {
    const { DEFAULT_STATUS_BAR_PREFERENCES } = await import('../../types/appStatusTypes');
    expect(DEFAULT_STATUS_BAR_PREFERENCES.showStatusBar).toBe(true);
    expect(DEFAULT_STATUS_BAR_PREFERENCES.refreshInterval).toBe(30_000);
  });
});
