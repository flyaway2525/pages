import { Link } from 'react-router-dom';

type HomeIconLinkProps = {
  label?: string;
};

export default function HomeIconLink({ label = 'メインページに戻る' }: HomeIconLinkProps) {
  return (
    <Link to="/" className="home-icon-link" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 5.5L5.5 10.8h1.8V18h4.2v-4.2h2.9V18h4.2v-7.2h1.8L13.9 5.5H12z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3.8 12h5.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.9 9.8L3.5 12l2.4 2.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
