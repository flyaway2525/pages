import { Link } from 'react-router-dom';

export default function Blog() {
  return (
    <main className="page">
      <h1>Blog</h1>
      <p>このページは準備中です。</p>
      <Link to="/" className="back-link">← ホームへ戻る</Link>
    </main>
  );
}
