-- Termos de Uso separados (Anunciantes / Candidatos), Política de Privacidade
-- e registro de aceite de candidatos sem conta (no clique em "Candidatar-se").
BEGIN;

ALTER TABLE terms_versions DROP CONSTRAINT IF EXISTS terms_versions_audience_check;
ALTER TABLE terms_versions ADD CONSTRAINT terms_versions_audience_check
  CHECK (audience IN ('COMPANY', 'CANDIDATE', 'ALL', 'PRIVACY'));
ALTER TABLE terms_versions ADD COLUMN IF NOT EXISTS slug  text;
ALTER TABLE terms_versions ADD COLUMN IF NOT EXISTS title text;

UPDATE terms_versions SET slug = 'clausula-geral', title = 'Cláusula de Natureza do Serviço e Isenção de Responsabilidade'
 WHERE version = '1.0';

-- Aceite de quem se candidata sem conta (guardamos hash do IP, não o IP cru)
CREATE TABLE IF NOT EXISTS anonymous_terms_acceptances (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  terms_version_id  integer     NOT NULL REFERENCES terms_versions(id),
  job_id            uuid        REFERENCES jobs(id),
  ip_hash           text,
  ip                inet,
  user_agent        text,
  accepted_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE anonymous_terms_acceptances ENABLE ROW LEVEL SECURITY;

INSERT INTO terms_versions (version, audience, is_current, slug, title, content_md) VALUES
('anunciantes-1.0', 'COMPANY', true, 'anunciantes', 'Termos de Uso para Anunciantes',
$t$## TERMO DE USO E CONDIÇÕES GERAIS PARA ANUNCIANTES (RECRUTADORES E EMPRESAS)

Este documento estabelece as regras, obrigações e limitações de responsabilidade aplicáveis a todas as pessoas físicas ou jurídicas (doravante denominadas "ANUNCIANTE") que utilizam a plataforma de classificados de empregos Empregos Litoral (doravante denominada "PLATAFORMA") para divulgar vagas de emprego, estágios ou processos seletivos.

Ao cadastrar, publicar ou manter qualquer anúncio de vaga na PLATAFORMA, o ANUNCIANTE declara ter lido, compreendido e aceitado integralmente os termos abaixo.

## 1. DA NATUREZA DA PLATAFORMA

**1.1.** A PLATAFORMA atua exclusivamente como um classificado online de anúncios e diretório de oportunidades, consistindo em uma ferramenta tecnológica de aproximação entre empresas contratantes e potenciais candidatos.

**1.2.** A PLATAFORMA não é agência de empregos, não realiza recrutamento e seleção, não intermedeia contratações, não testa candidatos e não possui qualquer vínculo empregatício, societário ou de parceria com o ANUNCIANTE ou com os candidatos.

## 2. DA RESPONSABILIDADE EXCLUSIVA DO ANUNCIANTE

**2.1.** O ANUNCIANTE é o único e exclusivo responsável por todas as informações, requisitos, salários, benefícios e condições divulgadas nos anúncios publicados sob sua autoria ou conta.

**2.2.** O ANUNCIANTE assume total responsabilidade cível, criminal e trabalhista perante os candidatos e órgãos fiscalizadores por eventuais danos causados decorrentes do processo seletivo, promessas de contratação, condições de trabalho ou descumprimento de ofertas.

**2.3.** O ANUNCIANTE obriga-se a cumprir rigorosamente a legislação brasileira vigente, incluindo a Consolidação das Leis do Trabalho (CLT), o Código de Defesa do Consumidor e a Lei Geral de Proteção de Dados (LGPD).

## 3. DA PROIBIÇÃO DE COBRANÇA DE TAXAS E PRÁTICAS ABUSIVAS

**3.1.** É terminantemente proibido ao ANUNCIANTE cobrar qualquer tipo de taxa, valor, depósito ou custo dos candidatos a qualquer título (tais como taxas de inscrição, exames médicos admissionais prévios, compra de materiais ou pagamento por cursos preparatórios obrigatórios para a vaga).

**3.2.** A constatação ou denúncia fundamentada de cobrança indevida resultará na exclusão imediata da vaga, bloqueio permanente da conta do ANUNCIANTE e fornecimento dos dados de cadastro e logs de acesso às autoridades competentes, sem prejuízo de responsabilização civil e criminal do infrator.

## 4. DA VEDAÇÃO A ANÚNCIOS DISCRIMINATÓRIOS

**4.1.** O ANUNCIANTE compromete-se a não publicar vagas que contenham exigências discriminatórias baseadas em sexo, idade, cor, raça, estado civil, religião, opinião política, origem, deficiência ou situação de gravidez, em estrita observância à Lei nº 9.029/1995 e à Constituição Federal.

## 5. DA ISENÇÃO TOTAL DE RESPONSABILIDADE DA PLATAFORMA

**5.1.** A PLATAFORMA não se responsabiliza, sob nenhuma hipótese, por:
A) Fraudes, perfis falsos ou informações inverídicas inseridas por anunciantes;
B) Prejuízos financeiros, materiais ou morais sofridos por candidatos ou empresas durante ou após processos seletivos;
C) Falhas de comunicação, indisponibilidade temporária do sistema ou perda de dados;
D) Acordos verbais ou contratuais firmados diretamente entre o ANUNCIANTE e os candidatos.

**5.2.** O ANUNCIANTE concorda em indenizar e isentar a PLATAFORMA, seus mantenedores e administradores de quaisquer reclamações, processos, perdas, danos ou despesas (incluindo honorários advocatícios) decorrentes de atos ou omissões do ANUNCIANTE.

## 6. DA MODERAÇÃO E REMOÇÃO DE CONTEÚDO

**6.1.** A PLATAFORMA reserva-se o direito de, a qualquer momento e sem aviso prévio, remover anúncios, suspender ou banir contas de ANUNCIANTES que violem estes termos, infrinjam a lei ou recebam denúncias recorrentes de irregularidades.

Ao clicar em "Aceitar" ou publicar uma vaga, o Anunciante concorda com todas as cláusulas acima.$t$),

('candidatos-1.0', 'CANDIDATE', true, 'candidatos', 'Termos de Uso para Candidatos',
$t$## TERMO DE CIÊNCIA, USO E ISENÇÃO DE RESPONSABILIDADE PARA CANDIDATOS (BUSCA DE EMPREGO)

Este documento estabelece as regras de utilização da plataforma de classificados de empregos Empregos Litoral (doravante denominada "PLATAFORMA") por parte dos candidatos, usuários que buscam oportunidades profissionais, vagas ou estágios (doravante denominados "CANDIDATO").

Ao se cadastrar, candidatar-se a vagas ou navegar pela PLATAFORMA, o CANDIDATO declara que leu, compreendeu e concordou expressamente com os termos descritos abaixo.

## 1. DA NATUREZA DA PLATAFORMA (MERA VITRINE)

**1.1.** A PLATAFORMA funciona exclusivamente como um classificado online de anúncios e diretório de oportunidades, atuando como ferramenta tecnológica facilitadora da divulgação de vagas oferecidas por empresas e recrutadores terceiros ("ANUNCIANTES").

**1.2.** A PLATAFORMA não é agência de empregos, não contrata, não emprega, não agenda entrevistas diretas, não garante a obtenção de vagas e não participa de nenhum processo seletivo, servindo apenas como canal de visibilidade.

## 2. DA INEXISTÊNCIA DE VÍNCULO COM A PLATAFORMA

**2.1.** O CANDIDATO reconhece e concorda que a relação de emprego ou prestação de serviços, caso venha a se concretizar, ocorrerá exclusivamente entre o CANDIDATO e a empresa anunciante da vaga.

**2.2.** A PLATAFORMA não possui qualquer responsabilidade sobre as condições de trabalho, cumprimento de leis trabalhistas (CLT), pagamento de salários, benefícios, promessas feitas pelo recrutador ou demissões decorrentes de processos seletivos iniciados através do site.

## 3. ALERTA IMPORTANTE: PROIBIÇÃO ABSOLUTA DE COBRANÇA DE TAXAS

**3.1.** A PLATAFORMA É TOTALMENTE GRATUITA PARA OS CANDIDATOS.

**3.2.** É estritamente proibido aos ANUNCIANTES cobrarem qualquer valor dos candidatos (como taxas de inscrição, exames médicos prévios, compra de materiais ou pagamento por cursos de capacitação obrigatórios para validação da vaga).

**3.3.** O CANDIDATO FICA CIENTE DE QUE NUNCA DEVE PAGAR QUALQUER VALOR PARA CONCORRER A UMA VAGA. Caso qualquer empresa anunciante solicite pagamento, o CANDIDATO compromete-se a não pagar e a denunciar imediatamente a vaga através da ferramenta de denúncia da PLATAFORMA.

## 4. DA ISENÇÃO DE RESPONSABILIDADE POR FRAUDES E VAGAS FALSAS

**4.1.** A PLATAFORMA adota medidas razoáveis de moderação, mas não se responsabiliza por prejuízos decorrentes de anúncios falsos ("vagas fantasmas"), estelionato, roubo de dados praticados por terceiros mal-intencionados que se passem por empresas, ou por falhas na veracidade das informações prestadas pelos anunciantes.

**4.2.** O CANDIDATO é o único responsável por verificar a idoneidade da empresa antes de comparecer a entrevistas presenciais em locais isolados ou fornecer documentos sensíveis e confidenciais.

## 5. PROTEÇÃO DE DADOS PESSOAIS (LGPD)

**5.1.** O CANDIDATO autoriza o envio de seu currículo e dados de contato diretamente aos ANUNCIANTES das vagas às quais se candidatar voluntariamente.

**5.2.** A PLATAFORMA adota práticas de segurança da informação, mas exime-se de responsabilidade por vazamentos de dados causados por invasões cibernéticas externas (hackers) ou pelo uso indevido das informações por parte dos próprios recrutadores terceiros.

## 6. EXONERAÇÃO DE RECLAMAÇÕES

**6.1.** O CANDIDATO concorda em isentar irrevogavelmente a PLATAFORMA, seus proprietários e colaboradores de qualquer responsabilidade civil ou criminal por danos materiais, morais, expectativas frustradas ou prejuízos de qualquer natureza decorrentes da busca por emprego na PLATAFORMA.

Ao se cadastrar ou utilizar os serviços, o Candidato manifesta sua concordância integral com este termo.$t$),

('privacidade-1.0', 'PRIVACY', true, 'privacidade', 'Política de Privacidade',
$t$## POLÍTICA DE PRIVACIDADE

Esta Política explica quais dados pessoais a plataforma Empregos Litoral ("PLATAFORMA") coleta, para que os usa e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).

## 1. QUAIS DADOS COLETAMOS

**Anunciantes:** nome ou razão social, nome fantasia, CNPJ (opcional), WhatsApp, e-mail, cidade e o conteúdo das vagas publicadas.

**Candidatos com conta:** nome, e-mail, WhatsApp (opcional), cidade, vagas salvas e alertas criados.

**Todos os visitantes:** registros de acesso (data, hora e endereço IP), aceite dos termos e contagem de visualizações e cliques nas vagas.

Não coletamos CPF, e senhas são guardadas apenas de forma criptografada.

## 2. PARA QUE USAMOS OS DADOS

Para criar e manter sua conta; publicar e exibir vagas; confirmar o WhatsApp do anunciante e evitar fraudes e abusos; registrar o aceite dos termos; processar pagamentos de anúncios; enviar avisos sobre sua conta e suas vagas; moderar denúncias; e cumprir obrigações legais, como a guarda de registros de acesso exigida pelo Marco Civil da Internet (Lei nº 12.965/2014).

## 3. COM QUEM COMPARTILHAMOS

**3.1.** Os dados de contato informados em cada vaga (WhatsApp, e-mail ou link) são públicos, porque servem para o candidato falar com a empresa.

**3.2.** Quando o candidato clica em "Candidatar-se", ele é levado ao canal da empresa e decide o que enviar. A PLATAFORMA não envia currículos.

**3.3.** Usamos prestadores de serviço para hospedagem, banco de dados, envio de mensagens e pagamentos, que tratam os dados apenas para executar esses serviços.

**3.4.** Podemos fornecer dados às autoridades quando houver ordem judicial ou obrigação legal.

## 4. POR QUANTO TEMPO GUARDAMOS

Enquanto a conta estiver ativa. Registros de acesso são guardados por no mínimo 6 meses, e o histórico de aceites, pagamentos e moderação pelo prazo necessário para defesa de direitos e cumprimento legal.

## 5. SEUS DIREITOS

Você pode pedir confirmação do tratamento, acesso, correção, exclusão da conta e dos dados, e informações sobre compartilhamento, pelo e-mail contato@empregoslitoral.com.br.

## 6. COOKIES

Usamos apenas o cookie necessário para manter você conectado e um cookie que lembra que você aceitou os Termos para Candidatos. Não usamos cookies de publicidade.

## 7. ALTERAÇÕES

Esta Política pode ser atualizada. A versão vigente e a data de publicação ficam sempre nesta página.$t$);

COMMIT;
