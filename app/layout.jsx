import './globals.css';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { whatsappDemo } from '@/lib/whatsapp';
import { pixDemo } from '@/lib/pix';

export const metadata = {
  title: 'Vagas Locais — empregos na sua região',
  description: 'Vagas de emprego da sua cidade. Candidate-se direto com a empresa pelo WhatsApp, e-mail ou site.',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0f7b5f' };

export default async function RootLayout({ children }) {
  const s = await getSession();
  const demo = whatsappDemo() || pixDemo();
  return (
    <html lang="pt-BR">
      <body>
        {demo && (
          <div className="banner-demo">
            Versão de demonstração: WhatsApp e PIX estão simulados.
          </div>
        )}
        <header className="topbar">
          <div className="container">
            <Link href="/" className="logo">
              Vagas<span>Locais</span>
            </Link>
            <nav className="nav">
              {!s && <Link href="/entrar">Entrar</Link>}
              {!s && (
                <Link href="/cadastro" className="btn small">
                  Anunciar vaga
                </Link>
              )}
              {s?.role === 'COMPANY' && <Link href="/painel">Meu painel</Link>}
              {s?.role === 'ADMIN' && <Link href="/admin">Admin</Link>}
              {s?.role === 'CANDIDATE' && <Link href="/conta">Minha conta</Link>}
              {s && <Link href="/conta/senha">Senha</Link>}
              {s && <Link href="/sair">Sair</Link>}
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <div className="container">
            <p>
              A plataforma é um meio de divulgação de vagas (classificados eletrônicos) e não é agência de emprego.
              Nunca pague para participar de um processo seletivo.
            </p>
            <p>
              <Link href="/termos">Termos de uso</Link> · <Link href="/cadastro">Anunciar uma vaga</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
