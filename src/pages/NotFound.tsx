import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="page">
      <h1>404</h1>
      <p>お探しのページは見つかりませんでした。</p>
      <Link to="/" className="back-link">← ホームへ戻る</Link>
    </main>
  );
}
