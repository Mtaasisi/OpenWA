import { useOutletContext } from 'react-router-dom';
import type { LayoutOutletContext } from '../lib/layout-outlet-context';

export function useLayoutShell(): LayoutOutletContext | undefined {
  return useOutletContext<LayoutOutletContext | undefined>();
}

export function useInteraktV2Shell(): boolean {
  return useLayoutShell()?.interaktV2Shell ?? false;
}

export function useStitchV1Shell(): boolean {
  return useLayoutShell()?.stitchV1Shell ?? false;
}
