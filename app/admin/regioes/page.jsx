import { sql } from '@/lib/db';
import { toggleCity, toggleRegion, addCity, addRegion } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

export default async function Regioes({ searchParams }) {
  const sp = await searchParams;
  const [regions, cities] = await Promise.all([
    sql`SELECT * FROM regions ORDER BY name`,
    sql`SELECT c.*, (SELECT count(*) FROM jobs j WHERE j.city_id = c.id AND j.status = 'PUBLISHED') AS active_jobs
          FROM cities c ORDER BY c.name`,
  ]);
  return (
    <div className="section" style={{ paddingTop: 0 }}>
      {sp.erro && <div className="alert err">{sp.erro}</div>}
      <p className="hint">Cidades ou regiões inativas somem da vitrine e do cadastro, sem apagar as vagas.</p>
      <div className="stack">
        {regions.map((r) => (
          <div key={r.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{r.name} <span className="hint">({r.state})</span></h3>
              <form action={toggleRegion}>
                <input type="hidden" name="region_id" value={r.id} />
                <button className={r.is_active ? 'btn small secondary' : 'btn small'}>{r.is_active ? 'Desativar região' : 'Ativar região'}</button>
              </form>
            </div>
            <div className="tags" style={{ marginTop: 12 }}>
              {cities.filter((c) => c.region_id === r.id).map((c) => (
                <form key={c.id} action={toggleCity} className="inline">
                  <input type="hidden" name="city_id" value={c.id} />
                  <button className={c.is_active ? 'tag' : 'tag gray'} style={{ border: 0, cursor: 'pointer' }} title="Clique para ativar/desativar">
                    {c.is_active ? '✓ ' : ''}{c.name} · {String(c.active_jobs)}
                  </button>
                </form>
              ))}
            </div>
            <form action={addCity} className="actions" style={{ marginTop: 12 }}>
              <input type="hidden" name="region_id" value={r.id} />
              <input type="hidden" name="state" value={r.state} />
              <input name="name" placeholder="Adicionar cidade" style={{ maxWidth: 260 }} />
              <button className="btn small secondary">Adicionar</button>
            </form>
          </div>
        ))}
      </div>
      <form action={addRegion} className="card actions" style={{ marginTop: 16 }}>
        <input name="name" placeholder="Nova região (ex.: Grande Florianópolis)" style={{ maxWidth: 320 }} />
        <input name="state" placeholder="UF" defaultValue="SC" style={{ maxWidth: 70 }} />
        <button className="btn small">Criar região</button>
      </form>
    </div>
  );
}
