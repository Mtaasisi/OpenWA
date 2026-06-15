export interface LayoutOutletContext {
  interaktSidebarClosed: boolean;
  reopenInteraktSidebar: () => void;
  /** Global mockup header + 64px icon sidebar shell */
  interaktV2Shell?: boolean;
  /** Stitch Digital Reconstruction shell — fixed 80px sidebar + app header */
  stitchV1Shell?: boolean;
}
