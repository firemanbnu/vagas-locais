'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  ['/admin', 'Métricas'],
  ['/admin/denuncias', 'Denúncias'],
  ['/admin/vagas', 'Vagas'],
  ['/admin/empresas', 'Empresas'],
  ['/admin/configuracoes', 'Configurações'],
  ['/admin/regioes', 'Regiões'],
  ['/admin/auditoria', 'Auditoria'],
];

export default function AdminNav() {
  const p = usePathname();
  return (
    <nav className="subnav">
      {ITEMS.map(([href, label]) => (
        <Link key={href} href={href} className={p === href ? 'on' : ''}>{label}</Link>
      ))}
    </nav>
  );
}
