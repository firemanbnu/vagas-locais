-- Ajustes da aplicação: senha local, região inicial e vagas de exemplo
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;

-- Região inicial (ajuste/ative outras em /admin/regioes)
INSERT INTO regions (name, slug, state, is_active, launched_at)
VALUES ('Vale do Itajaí e Litoral Norte', 'vale-itajai-litoral-norte', 'SC', true, now());

INSERT INTO cities (region_id, name, slug, state, is_active)
SELECT r.id, c.name, c.slug, 'SC', true
  FROM regions r,
       (VALUES ('Blumenau', 'blumenau'), ('Gaspar', 'gaspar'), ('Pomerode', 'pomerode'),
               ('Indaial', 'indaial'), ('Timbó', 'timbo'), ('Brusque', 'brusque'),
               ('Itajaí', 'itajai'), ('Balneário Camboriú', 'balneario-camboriu'),
               ('Navegantes', 'navegantes'), ('Balneário Piçarras', 'balneario-picarras'),
               ('Penha', 'penha')) AS c(name, slug)
 WHERE r.slug = 'vale-itajai-litoral-norte';

-- Anunciante de demonstração (não faz login) com vagas marcadas como EXEMPLO
INSERT INTO users (id, email, name, role)
VALUES ('00000000-0000-0000-0000-00000000de00', 'demo@vagas-locais.invalid', 'Demonstração', 'COMPANY');

INSERT INTO companies (id, owner_user_id, legal_name, trade_name, whatsapp, contact_email, city_id)
SELECT '00000000-0000-0000-0000-00000000de01', '00000000-0000-0000-0000-00000000de00',
       'Empresa Exemplo (demonstração)', 'Empresa Exemplo', '5547900000000', 'demo@vagas-locais.invalid', id
  FROM cities WHERE slug = 'blumenau';

INSERT INTO jobs (company_id, city_id, category_id, slug, title, description, requirements, benefits,
                  neighborhood, work_model, employment_type, openings, salary_min_cents, salary_max_cents,
                  apply_channel, apply_email, status, billing_type, published_at, expires_at)
SELECT '00000000-0000-0000-0000-00000000de01', ci.id, ca.id, v.slug, v.title, v.descr, v.req, v.ben,
       v.bairro, v.modelo::work_model, v.tipo::employment_type, v.qtd, v.smin, v.smax,
       'EMAIL', 'exemplo@vagas-locais.invalid', 'PUBLISHED', 'ADMIN_GRANT', now(), now() + interval '30 days'
  FROM (VALUES
    ('exemplo-auxiliar-producao', '[EXEMPLO] Auxiliar de Produção', 'blumenau', 'industria-producao', 'Itoupava Central',
     'ONSITE', 'CLT', 3, 190000, 220000,
     'Vaga de demonstração da plataforma. Atuação na linha de produção têxtil, turno A (6h às 14h20).',
     'Ensino fundamental completo. Disponibilidade de horário.', 'Vale-transporte, refeitório no local, plano de saúde.'),
    ('exemplo-atendente-loja', '[EXEMPLO] Atendente de Loja', 'balneario-camboriu', 'comercio-vendas', 'Centro',
     'ONSITE', 'CLT', 2, 180000, 210000,
     'Vaga de demonstração da plataforma. Atendimento ao cliente, organização de vitrine e caixa.',
     'Experiência com atendimento será um diferencial.', 'Comissão sobre vendas, vale-alimentação.'),
    ('exemplo-auxiliar-administrativo', '[EXEMPLO] Auxiliar Administrativo', 'itajai', 'administrativo', 'Fazenda',
     'HYBRID', 'CLT', 1, 220000, 260000,
     'Vaga de demonstração da plataforma. Rotinas de escritório, emissão de notas e controle de planilhas.',
     'Ensino médio completo, Excel básico.', 'Vale-refeição, 2 dias por semana em home office.'),
    ('exemplo-desenvolvedor-web', '[EXEMPLO] Desenvolvedor(a) Web Júnior', 'blumenau', 'tecnologia', 'Velha',
     'REMOTE', 'PJ', 1, 350000, 500000,
     'Vaga de demonstração da plataforma. Desenvolvimento de sistemas web em JavaScript.',
     'Conhecimento em JavaScript, HTML e CSS.', 'Horário flexível, equipamento fornecido.')
  ) AS v(slug, title, cidade, cat, bairro, modelo, tipo, qtd, smin, smax, descr, req, ben)
  JOIN cities ci ON ci.slug = v.cidade
  JOIN categories ca ON ca.slug = v.cat;

COMMIT;
