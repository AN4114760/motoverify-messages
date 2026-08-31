// 直接沿用 motoverify-prototype.html 的 ICONS,轉成 JSX
const s = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconMessages = ({ size = 21 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.9" {...s}>
    <path d="M4 6h16v10H9l-4 3.5V16H4Z" />
  </svg>
);

export const IconBack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="2.1" {...s}>
    <path d="M15 5 8 12l7 7" />
  </svg>
);

export const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M3 11.5 21 4l-7.5 18-3-7.5Z" />
  </svg>
);

export const IconAdd = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="2.2" {...s}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconLogout = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.9" {...s}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M4 12h12M11 8l4 4-4 4" />
  </svg>
);

export const IconBike = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" strokeWidth="1.6" {...s}>
    <circle cx="6" cy="17" r="3" />
    <circle cx="18" cy="17" r="3" />
    <path d="M6 17 9 9h3l2 4h4" />
    <path d="M9 9 8 6h4l1 3" />
  </svg>
);

export const IconMarket = ({ size = 21 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.9" {...s}>
    <circle cx="6.5" cy="17" r="2.2" />
    <circle cx="17.5" cy="17" r="2.2" />
    <path d="M4 17h.6L8 9h6l3 5" />
    <path d="M8 9 6.6 6H4" />
    <path d="M11.2 9 13 12.5h4.5" />
  </svg>
);
