import React from 'react';
import { cls, usd, usdSign, money, signCls, pct, compact } from '../lib/format.js';

function DrawerShell({ title, onClose, children, width }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" style={width ? { width } : undefined}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}

/* ------------------------------------------------------------ classement */
export function LeaderboardDrawer({ state, onClose }) {
  const lb = state?.leaderboard;
  if (!lb) return null;
  const topPct = Math.max(0.1, lb.topPct);
  const topBand = Math.max(1, Math.round(100 - topPct));
  const gap = lb.firstThreshold - lb.myPnl;
  const rows = lb.around?.length > 6 ? lb.around : lb.rows;

  return (
    <DrawerShell title="🏆 Classement" onClose={onClose}>
      <div className="result-hero" style={{ gap: 22 }}>
        <div>
          <div className="metric-label">Votre position</div>
          <div className="big-num" style={{ color: topBand <= 10 ? 'var(--green)' : 'var(--text)' }}>
            TOP {topBand}%
          </div>
          <div className="mono dim" style={{ fontSize: 10.5 }}>#{lb.rank} sur {lb.total} participants</div>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 9.5, color: 'var(--muted)', marginBottom: 4 }}>
            <span>0 %</span><span>Top 50 %</span><span>Top 10 %</span><span>Top 1 %</span>
          </div>
          <div style={{ position: 'relative', height: 10, borderRadius: 6, background: 'linear-gradient(90deg,#2b3346,#1d4a63,#1e88e5,#29b6f6)' }}>
            <div style={{
              position: 'absolute', left: `${Math.min(98, topPct)}%`, top: -3, width: 3, height: 16,
              background: '#ffb74d', boxShadow: '0 0 8px #ffb74d', borderRadius: 2, transform: 'translateX(-50%)',
            }} />
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}>
            Total P&amp;L : <b className={signCls(lb.myPnl)}>{usdSign(lb.myPnl)}</b>
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        <div className="stat">
          <div className="k">Seuil top 10 %</div>
          <div className="v">{usd(lb.firstThreshold)}</div>
        </div>
        <div className="stat">
          <div className="k">{gap > 0 ? 'Il vous manque' : 'Marge sur le top 10 %'}</div>
          <div className={cls('v', gap > 0 ? 'neg' : 'pos')}>{usd(Math.abs(gap))}</div>
        </div>
      </div>

      <div className="section-title">Autour de vous</div>
      {rows.map((r, i) => (
        <div key={`${r.name}-${i}`} className={cls('lb-row', r.me && 'me')}>
          <div className="rk">{r.rank ?? i + 1}</div>
          <div style={{ minWidth: 0 }}>
            <div className="nm">{r.name}</div>
            <div className="firm">{r.firm}</div>
          </div>
          <div className={cls('pl', signCls(r.pnl))}>{usdSign(r.pnl)}</div>
        </div>
      ))}

      <div className="section-title">Top participants</div>
      {lb.rows.slice(0, 12).map((r, i) => (
        <div key={`top-${r.name}-${i}`} className={cls('lb-row', r.me && 'me')}>
          <div className="rk">{r.rank ?? i + 1}</div>
          <div style={{ minWidth: 0 }}>
            <div className="nm">{r.name}</div>
            <div className="firm">{r.firm}</div>
          </div>
          <div className={cls('pl', signCls(r.pnl))}>{usdSign(r.pnl)}</div>
        </div>
      ))}

      <div className="section-title">Comment le score est calculé</div>
      <p className="hint" style={{ lineHeight: 1.6 }}>
        Votre P&amp;L total = spread capturé sur les flux clients − sélection adverse (le mouvement du prix
        après vos exécutions) − commissions de couverture. Le classement est actualisé en continu ;
        les seuils affichés correspondent à la distribution des participants de votre session.
      </p>
    </DrawerShell>
  );
}

/* ----------------------------------------------------------------- coach */
export function CoachDrawer({ state, onClose }) {
  const c = state?.coach;
  if (!c) return null;
  const hit = Math.round((c.hitRate ?? 0) * 100);
  const tips = c.tips ?? [];

  return (
    <DrawerShell title="◎ Coach de trading" onClose={onClose}>
      <div className="stat-grid">
        <div className="stat"><div className="k">Prix envoyés</div><div className="v">{c.quotesSent}</div></div>
        <div className="stat"><div className="k">Taux d'exécution</div><div className={cls('v', hit > 75 ? 'amber' : '')}>{hit} %</div></div>
        <div className="stat"><div className="k">Spread capturé</div><div className={cls('v', signCls(c.capture))}>{money(c.capture)}</div></div>
        <div className="stat"><div className="k">Sélection adverse</div><div className={cls('v', signCls(c.adverse))}>{money(c.adverse)}</div></div>
        <div className="stat"><div className="k">Edge net</div><div className={cls('v', signCls(c.netEdge))}>{money(c.netEdge)}</div></div>
        <div className="stat"><div className="k">Commissions</div><div className="v" style={{ color: 'var(--text-dim)' }}>{money(c.fees)}</div></div>
      </div>

      <div className="section-title">Lecture du round</div>
      {tips.length ? tips.map((t, i) => (
        <div key={i} className={cls('tip', t.tone)}>
          <span>{t.tone === 'good' ? '✓' : t.tone === 'bad' ? '✕' : t.tone === 'warn' ? '⚠' : 'ℹ'}</span>
          <span>{t.text}</span>
        </div>
      )) : <p className="hint">Le coach s'active dès les premières cotations.</p>}

      <div className="section-title">Vos clients</div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>
        Chaque contrepartie a un profil. Le flux informé arrive juste après les news.
      </div>
      {(state?.clients ?? []).map((cl) => (
        <div key={cl.id} className="client-row">
          <div className="nm"><span className="client-dot" style={{ background: cl.color }} />{cl.name}</div>
          <div className="mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>{cl.label}</div>
          <div className="note">{cl.note}</div>
          <div className="num">{cl.trades} trades</div>
        </div>
      ))}

      <div className="section-title">Mémo express</div>
      <div className="tip info"><span>1</span><span>Cotez large quand vous ne savez pas : un prix trop serré fait de vous la contrepartie du flux informé.</span></div>
      <div className="tip info"><span>2</span><span>Après une news, le prix converge en ~30 s. Skewez dans le sens de l'information au lieu de coter symétrique.</span></div>
      <div className="tip info"><span>3</span><span>Une position non couverte est un pari directionnel : couvrez le flux toxique, laissez vivre le flux sain.</span></div>
    </DrawerShell>
  );
}

/* ------------------------------------------------------------------ aide */
export function HelpDrawer({ state, onClose, onRestart }) {
  return (
    <DrawerShell title="? Méthode & règles" onClose={onClose}>
      <div className="kicker">Le métier</div>
      <p>
        Vous êtes <b>market maker</b> sur un desk actions. Des clients (hedge funds, asset managers, corporates…)
        vous demandent un <b>prix à double sens</b> (bid / offer) sur une action. Si vous cotez, ils peuvent traiter
        avec vous au prix que vous avez affiché.
      </p>
      <p>
        Vous gagnez le <b>spread</b> (la différence entre votre prix d'achat et de vente), mais vous prenez le
        risque que le prix bouge après l'exécution : c'est la <b>sélection adverse</b>.
      </p>

      <div className="section-title">Les 3 leviers</div>
      <div className="steps">
        <div className="step">
          <div className="n">1</div>
          <div className="t">Spread</div>
          <div className="d">Large = peu de trades mais bonne marge. Serré = beaucoup de volume et d'edge… si le flux est sain.</div>
        </div>
        <div className="step">
          <div className="n">2</div>
          <div className="t">Skew</div>
          <div className="d">Décale les deux prix. Skew + = vous pensez que le vrai prix est plus haut. C'est votre arme contre le flux informé.</div>
        </div>
        <div className="step">
          <div className="n">3</div>
          <div className="t">Taille</div>
          <div className="d">Cotez moins que la demande sur un client suspect : vous limitez l'exposition sans refuser le flux.</div>
        </div>
      </div>

      <div className="section-title">Comment lire le marché</div>
      <div className="tip info"><span>📡</span><span>Une <b>news</b> fait bouger le « vrai prix ». Le marché converge vers ce prix en 20-40 s : c'est la fenêtre du flux informé.</span></div>
      <div className="tip info"><span>📊</span><span>La colonne <b>Flux 45 s</b> (panneau equities) montre le sens des trades clients : un flux massif et unidirectionnel est un signal.</span></div>
      <div className="tip info"><span>💬</span><span>Le <b>Deal Room</b> donne la couleur du desk. Ce n'est pas une vérité, juste du bruit informé.</span></div>
      <div className="tip warn"><span>⚠</span><span>Le bruit domine : 1 ou 2 trades ne veulent rien dire. Cherchez la répétition dans le même sens.</span></div>

      <div className="section-title">Plan pour finir dans le top 10 %</div>
      <div className="tip good"><span>R1</span><span><b>Mesurez.</b> Cotez 12 à 20 bps sans skew et notez qui vous exécute. Ouvrez le débrief : le markout 10 s vous dit qui était informé.</span></div>
      <div className="tip good"><span>R2</span><span><b>Skewez.</b> Dès qu'une news tombe, décalez vos deux prix de +8 à +15 bps dans son sens pendant 30 s. Vous ne serez plus la contrepartie facile.</span></div>
      <div className="tip good"><span>R3</span><span><b>Élargissez et couvrez.</b> 20 à 35 bps de spread, taille réduite sur les clients « pressés », couverture immédiate au-delà de 5 M$ d'exposition.</span></div>

      <div className="section-title">Risque</div>
      <p className="hint">
        Limite de 8 M$ de notionnel par titre et 30 M$ au total. Le bouton <b>Couvrir</b> ramène la position à zéro
        au marché (≈ 11 bps de coût : spread + commission). Couvrir coûte cher : ne le faites que si le risque
        directionnel dépasse votre edge.
      </p>

      <div className="section-title">Raccourcis</div>
      <div className="hint" style={{ lineHeight: 1.9 }}>
        <kbd>Entrée</kbd> envoyer le prix · <kbd>P</kbd> passer la demande · <kbd>H</kbd> couvrir la position affichée
        · <kbd>Espace</kbd> pause · <kbd>1</kbd>–<kbd>3</kbd> vitesse
      </div>

      <div className="section-title">À propos</div>
      <p className="hint">
        TradeLab est un simulateur pédagogique indépendant. Il s'inspire du format des challenges de simulation
        de marché (cotation, flux clients, classement) sans être affilié à une institution ou à un organisme de
        certification. Les prix, news et clients sont générés par le moteur : rien n'est réel, rien n'est un conseil
        d'investissement.
      </p>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onRestart}>Réinitialiser la session</button>
        <button className="btn primary" onClick={onClose}>Reprendre l'entraînement</button>
      </div>
    </DrawerShell>
  );
}
