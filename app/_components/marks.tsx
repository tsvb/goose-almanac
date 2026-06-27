// Line-art marks for the Almanac. Clean, single-weight strokes (Lucide-style geometry).
type IconProps = { className?: string; strokeWidth?: number };

function Svg({ className, strokeWidth = 1.5, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** The signature mark: a goose feather (also the almanac's quill). */
export function Feather({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <path d="M16 8 2 22" />
      <path d="M17.5 15H9" />
    </Svg>
  );
}

export function Sun({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </Svg>
  );
}

export function Moon({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Svg>
  );
}

export function Search({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

export function ArrowLeft({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Svg>
  );
}

export function ArrowRight({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </Svg>
  );
}

/** Jam-chart marker. */
export function Flame({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  );
}

export function MapPin({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

export function Calendar({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </Svg>
  );
}

export function Menu({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  );
}

export function X({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function Disc({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  );
}
