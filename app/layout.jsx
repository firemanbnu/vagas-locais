import './globals.css';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { whatsappDemo } from '@/lib/whatsapp';
import { pixDemo } from '@/lib/pix';
import { settings } from '@/lib/db';

export const metadata = {
  metadataBase: new URL('https://www.empregoslitoral.com.br'),
  title: 'Empregos Litoral — vagas de emprego no litoral e Vale do Itajaí',
  description: 'Vagas de emprego da sua cidade. Candidate-se direto com a empresa pelo WhatsApp, e-mail ou site.',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0f7b5f' };

export default async function RootLayout({ children }) {
  const s = await getSession();
  // O aviso só aparece quando alguma função simulada está realmente em uso:
  // código do WhatsApp na tela (verificação ligada) ou PIX de mentira (vaga com preço).
  let demo = false;
  try {
    const st = await settings();
    demo = (whatsappDemo() && st.whatsapp_verification_required) || (pixDemo() && st.job_price_cents > 0);
  } catch {
    demo = whatsappDemo() || pixDemo();
  }
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
              Empregos<span>Litoral</span>
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
              <Link href="/termos/anunciantes">Termos para Anunciantes</Link> ·{' '}
              <Link href="/termos/candidatos">Termos para Candidatos</Link> ·{' '}
              <Link href="/termos/privacidade">Política de Privacidade</Link> ·{' '}
              <Link href="/cadastro">Anunciar uma vaga</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
