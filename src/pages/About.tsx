import { Link } from 'react-router-dom';

export default function About() {
  return (
    <main className="page">
      <h1>About</h1>
      <p>このページは準備中です。</p>
      <Link to="/" className="back-link">← ホームへ戻る</Link>
    </main>
  );
}
