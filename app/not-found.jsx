import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container narrow section">
      <div className="card empty">
        <h2>Página não encontrada</h2>
        <p>A vaga pode ter sido encerrada ou expirada.</p>
        <Link href="/" className="btn">Ver vagas abertas</Link>
      </div>
    </div>
  );
}
