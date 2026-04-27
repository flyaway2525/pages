import { Link } from 'react-router-dom';

const links = [
  { to: '/word-game', label: 'Word Game', desc: 'しりとりスプラトゥーン' },
  { to: '/data-derby', label: 'データダービー', desc: 'バーチャートレースの着順を予想' },
  { to: '/about', label: 'About', desc: '自己紹介・プロフィール' },
  { to: '/works', label: 'Works', desc: '制作物・ポートフォリオ' },
  { to: '/blog', label: 'Blog', desc: '記事・ノート' },
  { to: '/contact', label: 'Contact', desc: 'お問い合わせ' },
];

export default function Home() {
  return (
    <main className="home">
      <div className="home-hero">
        <h1>GitHub Pages</h1>
        <p className="home-sub">React + Vite で構築した静的サイトです。</p>
      </div>
      <nav className="link-grid">
        {links.map(({ to, label, desc }) => (
          <Link key={to} to={to} className="link-card">
            <span className="link-card-label">{label}</span>
            <span className="link-card-desc">{desc}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
