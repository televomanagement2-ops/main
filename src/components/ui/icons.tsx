/**
 * ICON SYSTEM — one family, one optical size, one stroke weight.
 *
 * Every icon in the product comes from here: 24×24 box, 1.5px round-capped
 * stroke, drawn on the same optical grid so glyphs sit consistently next to
 * 13–15px type. Icons never carry meaning alone — they always accompany a
 * label or an aria-label.
 */

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function svgProps({ size = 18, strokeWidth = 1.5 }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };
}

/* ── Navigation & chrome ─────────────────────────────────────────────── */
export const IconSearch = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20.5 20.5 16.7 16.7" />
  </svg>
);
export const IconUser = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <circle cx="12" cy="8.5" r="3.75" />
    <path d="M4.75 20a7.25 7.25 0 0 1 14.5 0" />
  </svg>
);
export const IconBag = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M5.2 7.5h13.6l-1 12.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z" />
    <path d="M9 10V6.8a3 3 0 0 1 6 0V10" />
  </svg>
);
export const IconMenu = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M3.5 7.5h17M3.5 16.5h17" />
  </svg>
);
export const IconClose = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconArrowRight = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </svg>
);
export const IconArrowLeft = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M19.5 12h-15M10.5 6l-6 6 6 6" />
  </svg>
);
export const IconArrowUpRight = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M7 17 17 7M8.5 7H17v8.5" />
  </svg>
);
export const IconChevronRight = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </svg>
);
export const IconChevronLeft = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </svg>
);
export const IconChevronDown = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M5.5 9.5 12 16l6.5-6.5" />
  </svg>
);

/* ── Actions ─────────────────────────────────────────────────────────── */
export const IconPlus = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconMinus = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M5 12h14" />
  </svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);
export const IconTrash = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
    <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
  </svg>
);
export const IconEdit = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M4.5 19.5h4L19 9a2.1 2.1 0 0 0-3-3L4.5 17.5z" />
  </svg>
);
export const IconFilter = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M4 7h16M7 12h10M10 17h4" />
  </svg>
);
export const IconExternal = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M14 4.5h5.5V10" />
    <path d="M19.5 4.5 11 13" />
    <path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" />
  </svg>
);
export const IconRefresh = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5" />
    <path d="M20 4v4.5h-4.5" />
    <path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5" />
    <path d="M4 20v-4.5h4.5" />
  </svg>
);
export const IconLogout = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M9.5 20H6a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 6 4h3.5" />
    <path d="M15 8.5 18.5 12 15 15.5M18.5 12h-9" />
  </svg>
);

/* ── Commerce & operations ───────────────────────────────────────────── */
export const IconTruck = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M2.5 6.5h11v10h-11z" />
    <path d="M13.5 10h4l4 3.6v2.9h-8z" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17.5" cy="18" r="1.8" />
  </svg>
);
export const IconReturn = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M3.5 8.5h12a4.5 4.5 0 0 1 0 9H10" />
    <path d="M7 4.5 3.5 8.5 7 12.5" />
  </svg>
);
export const IconLock = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <rect x="4.5" y="10.5" width="15" height="9.5" rx="1.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </svg>
);
export const IconSupport = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" />
    <path d="M4.5 13.5h2A1.5 1.5 0 0 1 8 15v2.5A1.5 1.5 0 0 1 6.5 19h-.7a1.5 1.5 0 0 1-1.3-1.5z" />
    <path d="M19.5 13.5h-2A1.5 1.5 0 0 0 16 15v2.5a1.5 1.5 0 0 0 1.5 1.5h.7a1.5 1.5 0 0 0 1.3-1.5z" />
  </svg>
);
export const IconPackage = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M12 3.5 20 8v8l-8 4.5L4 16V8z" />
    <path d="M4 8l8 4.5L20 8M12 12.5V20.5" />
  </svg>
);
export const IconStar = ({ size = 16, className, filled }: IconProps & { filled?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinejoin="round"
    aria-hidden
    focusable={false}
    className={className}
  >
    <path d="m12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9z" />
  </svg>
);

/* ── Admin navigation ────────────────────────────────────────────────── */
export const IconHome = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
    <path d="M9.5 20.5v-6h5v6" />
  </svg>
);
export const IconGrid = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <rect x="4" y="4" width="7" height="7" rx="1" />
    <rect x="13" y="4" width="7" height="7" rx="1" />
    <rect x="4" y="13" width="7" height="7" rx="1" />
    <rect x="13" y="13" width="7" height="7" rx="1" />
  </svg>
);
export const IconChart = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M4 19.5h16" />
    <path d="M6.5 16V11M11 16V6.5M15.5 16v-6M20 16V8" />
  </svg>
);
export const IconReceipt = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M6 3.5h12v17l-2.5-1.6-2.5 1.6-2.5-1.6L8 20.5 6 19z" />
    <path d="M9.5 8.5h5M9.5 12.5h5" />
  </svg>
);
export const IconWallet = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <rect x="3.5" y="6" width="17" height="13" rx="2" />
    <path d="M3.5 10h17" />
    <circle cx="16.5" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);
export const IconSettings = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
  </svg>
);
export const IconHelp = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.6A2.5 2.5 0 0 1 14.5 10c0 1.7-2.5 2-2.5 3.5" />
    <path d="M12 17h.01" />
  </svg>
);
export const IconInfo = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5M12 7.5h.01" />
  </svg>
);
export const IconAlert = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M12 4.5 21 19.5H3z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
);
export const IconSun = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.4 5.6 17 7M7 17l-1.4 1.4M18.4 18.4 17 17M7 7 5.6 5.6" />
  </svg>
);
export const IconMoon = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5" />
  </svg>
);
export const IconImage = (p: IconProps) => (
  <svg {...svgProps(p)} className={p.className}>
    <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
    <path d="m5 16 4.5-4.5 3.5 3.5 2.5-2.5L19 16" />
    <circle cx="9" cy="9.5" r="1.2" />
  </svg>
);
