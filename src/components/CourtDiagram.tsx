export function CourtDiagram() {
  const courts = [
    { n: 1, x: 36, y: 78 },
    { n: 2, x: 196, y: 78 },
    { n: 3, x: 356, y: 78 },
    { n: 4, x: 516, y: 78 },
    { n: 5, x: 36, y: 188 },
    { n: 6, x: 196, y: 188 },
    { n: 7, x: 356, y: 188 },
    { n: 8, x: 516, y: 188 },
  ];

  return (
    <figure className="relative">
      <svg
        viewBox="0 0 700 340"
        role="img"
        aria-label="Illustrated layout of eight outdoor tennis courts in two rows of four"
        className="w-full h-auto rounded-2xl shadow-[0_18px_50px_rgba(20,16,12,0.18)]"
      >
        <rect width="700" height="340" rx="18" fill="#163528" />
        <rect x="16" y="16" width="668" height="268" rx="12" fill="#1E4634" />
        <rect x="16" y="16" width="668" height="268" rx="12" fill="none" stroke="#D7C7A1" strokeWidth="3" />

        {courts.map((c) => (
          <g key={c.n}>
            <rect x={c.x} y={c.y} width="148" height="78" rx="2" fill="#2F7A4A" stroke="#F6F1E6" strokeWidth="2" />
            <line x1={c.x + 74} y1={c.y + 2} x2={c.x + 74} y2={c.y + 76} stroke="#F6F1E6" strokeWidth="1.4" />
            <rect x={c.x + 38} y={c.y + 16} width="72" height="46" fill="none" stroke="#F6F1E6" strokeWidth="1.1" />
            <line x1={c.x + 38} y1={c.y + 39} x2={c.x + 110} y2={c.y + 39} stroke="#F6F1E6" strokeWidth="1.1" />
            <circle cx={c.x + 12} cy={c.y + 12} r="9" fill="#12100E" />
            <text
              x={c.x + 12}
              y={c.y + 15.5}
              textAnchor="middle"
              fill="#FFD520"
              fontSize="11"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontWeight="700"
            >
              {c.n}
            </text>
          </g>
        ))}

        {[28, 672].map((x) =>
          [48, 250].map((y) => (
            <g key={`${x}-${y}`}>
              <rect x={x - 3} y={y} width="6" height="22" fill="#C8B48A" />
              <circle cx={x} cy={y} r="5" fill="#FFD520" />
            </g>
          ))
        )}

        <text x="28" y="318" fill="#F6F1E6" fontSize="13" fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="1.5">
          EPPLEY · 8 LIGHTED COURTS · NORTH CAMPUS
        </text>
      </svg>
      <figcaption className="mt-2 text-xs text-ink/60 leading-snug">
        Original diagram of the eight-court layout. No freely licensed photograph of these courts was available.
      </figcaption>
    </figure>
  );
}
