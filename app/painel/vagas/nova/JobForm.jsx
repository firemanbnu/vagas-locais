'use client';

import { useState } from 'react';
import { createJob } from '@/app/actions/company';
import { WORK_MODEL, EMPLOYMENT, salaryText, parseMoney, formatWhatsapp } from '@/lib/format';

export default function JobForm({ cities, categories, company }) {
  const [v, setV] = useState({
    title: '',
    description: '',
    requirements: '',
    benefits: '',
    neighborhood: '',
    city_id: company.cityId ? String(company.cityId) : '',
    category_id: '',
    work_model: 'ONSITE',
    employment_type: 'CLT',
    openings: '1',
    salary_min: '',
    salary_max: '',
    hide_salary: false,
    apply_channel: 'WHATSAPP',
    apply_whatsapp: formatWhatsapp(company.whatsapp),
    apply_email: company.email,
    apply_url: '',
  });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const city = cities.find((c) => String(c.id) === v.city_id);
  const cat = categories.find((c) => String(c.id) === v.category_id);

  return (
    <div className="grid-2">
      <form action={createJob} className="card">
        <div className="field">
          <label htmlFor="title">Cargo / título da vaga</label>
          <input id="title" name="title" required maxLength={120} value={v.title} onChange={set('title')} placeholder="Ex.: Auxiliar de Produção" />
        </div>
        <div className="row two">
          <div className="field">
            <label htmlFor="city_id">Cidade</label>
            <select id="city_id" name="city_id" required value={v.city_id} onChange={set('city_id')}>
              <option value="">Selecione</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="neighborhood">Bairro <span className="hint">(opcional)</span></label>
            <input id="neighborhood" name="neighborhood" value={v.neighborhood} onChange={set('neighborhood')} />
          </div>
        </div>
        <div className="row three">
          <div className="field">
            <label htmlFor="category_id">Área</label>
            <select id="category_id" name="category_id" required value={v.category_id} onChange={set('category_id')}>
              <option value="">Selecione</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="work_model">Modelo</label>
            <select id="work_model" name="work_model" value={v.work_model} onChange={set('work_model')}>
              {Object.entries(WORK_MODEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="employment_type">Contratação</label>
            <select id="employment_type" name="employment_type" value={v.employment_type} onChange={set('employment_type')}>
              {Object.entries(EMPLOYMENT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="description">Descrição</label>
          <textarea id="description" name="description" required maxLength={8000} value={v.description} onChange={set('description')}
                    placeholder="Atividades, horário, local de trabalho…" />
        </div>
        <div className="row two">
          <div className="field">
            <label htmlFor="requirements">Requisitos <span className="hint">(opcional)</span></label>
            <textarea id="requirements" name="requirements" value={v.requirements} onChange={set('requirements')} style={{ minHeight: 80 }} />
          </div>
          <div className="field">
            <label htmlFor="benefits">Benefícios <span className="hint">(opcional)</span></label>
            <textarea id="benefits" name="benefits" value={v.benefits} onChange={set('benefits')} style={{ minHeight: 80 }} />
          </div>
        </div>
        <div className="row three">
          <div className="field">
            <label htmlFor="salary_min">Salário de (R$)</label>
            <input id="salary_min" name="salary_min" inputMode="decimal" value={v.salary_min} onChange={set('salary_min')} placeholder="1.900,00" />
          </div>
          <div className="field">
            <label htmlFor="salary_max">até (R$)</label>
            <input id="salary_max" name="salary_max" inputMode="decimal" value={v.salary_max} onChange={set('salary_max')} />
          </div>
          <div className="field">
            <label htmlFor="openings">Nº de vagas</label>
            <input id="openings" name="openings" type="number" min={1} max={999} value={v.openings} onChange={set('openings')} />
          </div>
        </div>
        <div className="field">
          <label className="check">
            <input type="checkbox" name="hide_salary" checked={v.hide_salary} onChange={set('hide_salary')} />
            <span>Não mostrar o salário no anúncio</span>
          </label>
        </div>

        <div className="field">
          <label htmlFor="apply_channel">Como o candidato entra em contato</label>
          <select id="apply_channel" name="apply_channel" value={v.apply_channel} onChange={set('apply_channel')}>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">E-mail</option>
            <option value="URL">Link / formulário externo</option>
          </select>
        </div>
        {v.apply_channel === 'WHATSAPP' && (
          <div className="field">
            <label htmlFor="apply_whatsapp">WhatsApp para candidatos</label>
            <input id="apply_whatsapp" name="apply_whatsapp" inputMode="tel" required value={v.apply_whatsapp} onChange={set('apply_whatsapp')} />
          </div>
        )}
        {v.apply_channel === 'EMAIL' && (
          <div className="field">
            <label htmlFor="apply_email">E-mail para candidatos</label>
            <input id="apply_email" name="apply_email" type="email" required value={v.apply_email} onChange={set('apply_email')} />
          </div>
        )}
        {v.apply_channel === 'URL' && (
          <div className="field">
            <label htmlFor="apply_url">Link</label>
            <input id="apply_url" name="apply_url" type="url" required placeholder="https://" value={v.apply_url} onChange={set('apply_url')} />
          </div>
        )}

        <div className="actions">
          <button className="btn" type="submit" name="intent" value="publish">Publicar vaga</button>
          <button className="btn secondary" type="submit" name="intent" value="draft">Salvar rascunho</button>
        </div>
      </form>

      <div>
        <div className="preview-label">Prévia do anúncio</div>
        <div className="card">
          <h3>{v.title || 'Título da vaga'}</h3>
          <div className="meta">
            <span>{company.name}</span>
            <span>📍 {city?.name || 'Cidade'}{v.neighborhood ? ` · ${v.neighborhood}` : ''}</span>
          </div>
          <div className="tags">
            <span className="tag">{WORK_MODEL[v.work_model]}</span>
            <span className="tag gray">{EMPLOYMENT[v.employment_type]}</span>
            {cat && <span className="tag gray">{cat.name}</span>}
            {Number(v.openings) > 1 && <span className="tag gray">{v.openings} vagas</span>}
          </div>
          <p className="salary" style={{ marginTop: 10 }}>
            {v.hide_salary ? 'A combinar' : salaryText(parseMoney(v.salary_min), parseMoney(v.salary_max))}
          </p>
          {v.description && <p className="pre">{v.description}</p>}
          {v.requirements && (<><h3>Requisitos</h3><p className="pre">{v.requirements}</p></>)}
          {v.benefits && (<><h3>Benefícios</h3><p className="pre">{v.benefits}</p></>)}
          <span className="btn block" aria-hidden="true">
            {{ WHATSAPP: 'Candidatar-se pelo WhatsApp', EMAIL: 'Candidatar-se por e-mail', URL: 'Candidatar-se no site da empresa' }[v.apply_channel]}
          </span>
        </div>
      </div>
    </div>
  );
}
