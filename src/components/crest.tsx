export function Crest({ className = "h-16 w-16", gold = "#C4A35A" }: { className?: string; gold?: string }) {
  return (
    <svg viewBox="0 0 120 132" className={className} aria-hidden="true">
      <path
        d="M60 4 L108 22 V62 C108 96 86 118 60 128 C34 118 12 96 12 62 V22 Z"
        fill="#0B1F33"
        stroke={gold}
        strokeWidth="3"
      />
      <path
        d="M60 12 L100 26 V62 C100 90 82 108 60 118 C38 108 20 90 20 62 V26 Z"
        fill="none"
        stroke={gold}
        strokeWidth="1"
        opacity="0.55"
      />
      <circle cx="60" cy="36" r="7" fill="#F4EFE4" stroke={gold} strokeWidth="1.4" />
      <circle cx="58.5" cy="34.5" r="1.4" fill="#0B1F33" />
      <path d="M36 78 L60 44 L84 78" fill="none" stroke={gold} strokeWidth="2.2" />
      <path d="M42 52 L78 84" stroke={gold} strokeWidth="2.4" />
      <path d="M78 52 L42 84" stroke={gold} strokeWidth="2.4" />
      <path d="M42 52 l-8 -2 2 8" fill={gold} />
      <path d="M78 52 l8 -2 -2 8" fill={gold} />
      <path d="M28 92 C36 80, 44 80, 48 92" fill="none" stroke="#2f6b4f" strokeWidth="2" />
      <path d="M92 92 C84 80, 76 80, 72 92" fill="none" stroke="#2f6b4f" strokeWidth="2" />
      <text
        x="60"
        y="104"
        textAnchor="middle"
        fill={gold}
        fontFamily="Georgia, serif"
        fontSize="8"
        letterSpacing="2.2"
      >
        YOUNG GUNZ
      </text>
      <text
        x="60"
        y="115"
        textAnchor="middle"
        fill="#F4EFE4"
        fontFamily="Georgia, serif"
        fontSize="6"
        letterSpacing="1.6"
      >
        ORLANDO 2026
      </text>
    </svg>
  );
}
