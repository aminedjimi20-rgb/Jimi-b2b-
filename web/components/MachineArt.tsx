const PALETTES = [
  ["#0e6bd6", "#0a3d78"],
  ["#00b3a4", "#00716a"],
  ["#e08b1c", "#8a5410"],
  ["#5b6b7a", "#2c3742"],
];

/**
 * Illustration technique de type "plan" représentant une presse à injection.
 * Utilisée comme visuel de remplacement pour les fiches machines de démonstration
 * (aucune photo réelle n'est disponible pour ces données de démo).
 */
export function MachineArt({ seed = 0, className }: { seed?: number; className?: string }) {
  const [accent, accentDark] = PALETTES[seed % PALETTES.length];
  const uid = `machine-art-${seed}`;

  return (
    <svg
      viewBox="0 0 400 260"
      className={className}
      role="img"
      aria-label="Illustration technique de machine d'injection"
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0d1620" />
          <stop offset="100%" stopColor="#182531" />
        </linearGradient>
        <pattern id={`${uid}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#ffffff" strokeOpacity="0.05" />
        </pattern>
      </defs>
      <rect width="400" height="260" fill={`url(#${uid}-bg)`} />
      <rect width="400" height="260" fill={`url(#${uid}-grid)`} />

      {/* Base / bâti */}
      <rect x="30" y="190" width="340" height="16" rx="2" fill={accentDark} />
      <rect x="30" y="176" width="340" height="10" fill="#101a23" />

      {/* Unité de fermeture (colonnes + plateaux) */}
      <rect x="55" y="70" width="10" height="120" fill="#3a4753" />
      <rect x="55" y="70" width="10" height="120" fill="#3a4753" transform="translate(90,0)" />
      <rect x="55" y="70" width="10" height="120" fill="#3a4753" transform="translate(0,0)" />
      <rect x="150" y="70" width="10" height="120" fill="#3a4753" />
      <rect x="60" y="60" width="20" height="140" fill="none" />
      {/* colonnes (4) */}
      {[62, 62 + 32, 62 + 64, 62 + 96].map((x, i) => (
        <rect key={i} x={x} y="72" width="6" height="116" fill="#4a5866" />
      ))}
      {/* plateau fixe */}
      <rect x="55" y="66" width="115" height="18" rx="2" fill={accent} />
      {/* plateau mobile */}
      <rect x="95" y="150" width="75" height="18" rx="2" fill="#5b6b7a" />

      {/* Unité d'injection */}
      <rect x="185" y="120" width="150" height="26" rx="4" fill={accent} />
      <rect x="325" y="112" width="34" height="42" rx="6" fill={accentDark} />
      <circle cx="342" cy="133" r="9" fill="#0d1620" stroke={accent} strokeWidth="2" />

      {/* Trémie */}
      <path d="M255 92 L275 92 L268 118 L262 118 Z" fill="#6b7a88" />
      <rect x="253" y="84" width="24" height="10" rx="2" fill="#6b7a88" />

      {/* Armoire électrique */}
      <rect x="20" y="100" width="26" height="86" rx="2" fill="#22303c" stroke={accent} strokeWidth="1.5" />
      <circle cx="33" cy="118" r="3" fill={accent} />
      <rect x="25" y="130" width="16" height="4" fill={accent} opacity="0.7" />
      <rect x="25" y="140" width="16" height="4" fill={accent} opacity="0.5" />
      <rect x="25" y="150" width="10" height="4" fill={accent} opacity="0.3" />

      {/* HMI panel */}
      <rect x="185" y="86" width="34" height="24" rx="2" fill="#0d1620" stroke={accent} strokeWidth="1.5" />
      <rect x="189" y="90" width="26" height="16" rx="1" fill={accent} opacity="0.35" />

      <text
        x="200"
        y="240"
        textAnchor="middle"
        fontSize="11"
        letterSpacing="2"
        fill="#8695a3"
        fontFamily="ui-monospace, monospace"
      >
        SCHÉMA ILLUSTRATIF — DONNÉES DE DÉMONSTRATION
      </text>
    </svg>
  );
}
