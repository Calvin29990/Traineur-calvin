import React from 'react';

export function gaugeColor(score) {
  const s = Number(score) || 0;
  if (s >= 85) return '#2ecc71';
  if (s >= 70) return '#a3d94a';
  if (s >= 50) return '#f1c40f';
  if (s >= 30) return '#ff9f43';
  return '#eb5757';
}

export function Gauge({ gauge, size = 76, showWeight = true }) {
  const score = Math.max(0, Math.min(100, Math.round(gauge?.score ?? 0)));
  const r = 25;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = gaugeColor(score);

  return (
    <div
      className="gauge"
      style={{ width: size }}
      title={`${gauge?.code} — ${gauge?.label} · ${score}%${showWeight && gauge?.weight ? ` · poids ${gauge.weight}%` : ''}\n${gauge?.detail || ''}`}
    >
      <div className="gauge-ring" style={{ width: size, height: size }}>
        <svg viewBox="0 0 64 64" width={size} height={size} aria-label={`${gauge?.code} ${score}%`}>
          <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(120,165,188,0.18)" strokeWidth="5.5" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            transform="rotate(-90 32 32)"
            style={{ filter: `drop-shadow(0 0 3px ${color}66)`, transition: 'stroke-dasharray .45s ease' }}
          />
          <text x="32" y="32" textAnchor="middle" dominantBaseline="central" className="gauge-num" style={{ fill: color }}>
            {score}
            <tspan fontSize="7" dx="1">%</tspan>
          </text>
        </svg>
      </div>
      <div className="gauge-code" style={{ color }}>{gauge?.code}</div>
      <div className="gauge-label">{gauge?.label}</div>
      {showWeight && gauge?.weight != null && <div className="gauge-weight">{gauge.weight}% du score</div>}
    </div>
  );
}

export function GaugeGrid({ gauges = [], size = 72, showWeight = true }) {
  return (
    <div className="gauge-grid">
      {gauges.map((g) => (
        <Gauge key={g.code} gauge={g} size={size} showWeight={showWeight} />
      ))}
    </div>
  );
}

export function ScoreRing({ score = 0, size = 132, label = 'SCORE GLOBAL', sub = null }) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = (s / 100) * c;
  const color = gaugeColor(s);
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 128 128" width={size} height={size}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(120,165,188,0.16)" strokeWidth="8" />
        <circle
          cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`} transform="rotate(-90 64 64)"
          style={{ filter: `drop-shadow(0 0 5px ${color}66)`, transition: 'stroke-dasharray .5s ease' }}
        />
        <text x="64" y="60" textAnchor="middle" dominantBaseline="central" className="ring-num" style={{ fill: color }}>
          {s}<tspan fontSize="16" dx="2">%</tspan>
        </text>
        <text x="64" y="88" textAnchor="middle" className="ring-label">{label}</text>
      </svg>
      {sub && <div className="ring-sub">{sub}</div>}
    </div>
  );
}
