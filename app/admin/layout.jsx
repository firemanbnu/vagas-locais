import { requireAdmin } from '@/lib/auth';
import AdminNav from './AdminNav';

export default async function AdminLayout({ children }) {
  await requireAdmin();
  return (
    <div className="container">
      <div className="page-head"><h1>Administração</h1></div>
      <AdminNav />
      {children}
    </div>
  );
}
