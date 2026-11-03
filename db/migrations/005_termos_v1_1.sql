-- Termos versão 1.1: limitação de responsabilidade compatível com CDC/LGPD
-- e cláusula de dados alinhada ao funcionamento real (sem envio de currículo).
-- Quem aceitou a 1.0 precisará aceitar a 1.1.
BEGIN;

UPDATE terms_versions SET is_current = false WHERE version IN ('anunciantes-1.0', 'candidatos-1.0', '1.0');

INSERT INTO terms_versions (version, audience, is_current, slug, title, content_md) VALUES
('anunciantes-1.1', 'COMPANY', true, 'anunciantes', 'Termos de Uso para Anunciantes', $t$## TERMO DE USO E CONDIÇÕES GERAIS PARA ANUNCIANTES (RECRUTADORES E EMPRESAS)

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

## 5. DA LIMITAÇÃO DE RESPONSABILIDADE DA PLATAFORMA

**5.1.** Por atuar apenas como meio de divulgação, a PLATAFORMA não responde, na máxima extensão permitida pela legislação aplicável, por:
A) Fraudes, perfis falsos ou informações inverídicas inseridas por anunciantes;
B) Prejuízos financeiros, materiais ou morais sofridos por candidatos ou empresas durante ou após processos seletivos conduzidos pelo ANUNCIANTE;
C) Indisponibilidade temporária do sistema decorrente de manutenção programada, caso fortuito, força maior ou fato de terceiros;
D) Acordos verbais ou contratuais firmados diretamente entre o ANUNCIANTE e os candidatos.

**5.2.** A obrigação da PLATAFORMA perante o ANUNCIANTE consiste em manter o anúncio disponível pelo período contratado. Se uma falha técnica atribuível à PLATAFORMA impedir a veiculação, a PLATAFORMA prorrogará o prazo do anúncio pelo tempo correspondente ou, se não for possível, restituirá o valor proporcional ao período não veiculado.

**5.3.** O ANUNCIANTE concorda em indenizar a PLATAFORMA, seus mantenedores e administradores por reclamações, processos, perdas, danos ou despesas (incluindo honorários advocatícios) decorrentes de atos ou omissões do próprio ANUNCIANTE, inclusive do conteúdo das vagas que publicar.

**5.4.** Nada nestes termos afasta direitos que a legislação brasileira, em especial o Código de Defesa do Consumidor e a LGPD, considere irrenunciáveis.

## 6. DA MODERAÇÃO E REMOÇÃO DE CONTEÚDO

**6.1.** A PLATAFORMA reserva-se o direito de, a qualquer momento e sem aviso prévio, remover anúncios, suspender ou banir contas de ANUNCIANTES que violem estes termos, infrinjam a lei ou recebam denúncias recorrentes de irregularidades.

Ao clicar em "Aceitar" ou publicar uma vaga, o Anunciante concorda com todas as cláusulas acima.$t$),
('candidatos-1.1', 'CANDIDATE', true, 'candidatos', 'Termos de Uso para Candidatos', $t$## TERMO DE CIÊNCIA, USO E LIMITAÇÃO DE RESPONSABILIDADE PARA CANDIDATOS (BUSCA DE EMPREGO)

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

## 4. DA LIMITAÇÃO DE RESPONSABILIDADE POR FRAUDES E VAGAS FALSAS

**4.1.** A PLATAFORMA adota medidas razoáveis de moderação, como a verificação do WhatsApp do anunciante e a análise de denúncias, mas, na máxima extensão permitida pela legislação aplicável, não se responsabiliza por prejuízos decorrentes de anúncios falsos ("vagas fantasmas"), estelionato, roubo de dados praticados por terceiros mal-intencionados que se passem por empresas, ou por falhas na veracidade das informações prestadas pelos anunciantes.

**4.2.** O CANDIDATO é o único responsável por verificar a idoneidade da empresa antes de comparecer a entrevistas presenciais em locais isolados ou fornecer documentos sensíveis e confidenciais.

## 5. PROTEÇÃO DE DADOS PESSOAIS (LGPD)

**5.1.** Ao clicar em "Candidatar-se", o CANDIDATO é direcionado ao canal de contato informado pelo ANUNCIANTE (WhatsApp, e-mail ou site) e decide livremente quais dados e documentos enviar. A PLATAFORMA não recebe nem repassa currículos.

**5.2.** A PLATAFORMA adota medidas técnicas e administrativas de segurança aptas a proteger os dados pessoais que armazena, nos termos da LGPD. Os dados que o CANDIDATO enviar diretamente ao ANUNCIANTE passam a ser tratados sob a responsabilidade do ANUNCIANTE.

**5.3.** As regras completas sobre o tratamento de dados estão na Política de Privacidade da PLATAFORMA.

## 6. DAS RECLAMAÇÕES

**6.1.** O CANDIDATO reconhece que reclamações sobre vagas, processos seletivos, contratações ou condutas de empresas devem ser dirigidas ao ANUNCIANTE responsável, que responde pelo anúncio e pelo processo seletivo, sem prejuízo dos direitos garantidos por lei.

**6.2.** A PLATAFORMA mantém a ferramenta de denúncia em todas as vagas e pode remover anúncios e bloquear anunciantes que descumprirem estes termos.

Ao se cadastrar ou utilizar os serviços, o Candidato manifesta sua concordância integral com este termo.$t$);

INSERT INTO terms_versions (version, audience, is_current, slug, title, content_md) VALUES
('geral-1.1', 'ALL', true, 'clausula-geral', 'Cláusula de Natureza do Serviço e Limitação de Responsabilidade',
$t$## Cláusula de Natureza do Serviço e Limitação de Responsabilidade

1. **Natureza Jurídica:** A Plataforma atua única e exclusivamente como meio de veiculação e publicidade de oportunidades de trabalho, funcionando sob a modalidade de classificados eletrônicos. A Plataforma não é agência de emprego, não atua como intermediadora de mão de obra e não integra nenhuma relação de trabalho ou prestação de serviços entre as partes.

2. **Responsabilidade do Anunciante:** A empresa ou contratante anunciante é a única e exclusiva responsável pela veracidade, legalidade, exatidão das informações divulgadas, bem como pelo cumprimento integral da legislação trabalhista (CLT), previdenciária e civil aplicável. É terminantemente proibida a cobrança de qualquer taxa do candidato para participação em processos seletivos.

3. **Limitação de Responsabilidade da Plataforma:** A Plataforma e seus administradores não conduzem nem fiscalizam previamente os processos seletivos, entrevistas, contratações, promessas de remuneração, condições de trabalho ou condutas das empresas ou dos candidatos. A obrigação da Plataforma consiste em manter o anúncio disponível durante o período contratado, sem prejuízo dos direitos garantidos pela legislação brasileira.

4. **Obrigação de Atualização e Denúncias:** É dever da empresa anunciante remover ou pausar a vaga no painel assim que preenchida. Caso candidatos constatem vagas inexistentes, preenchidas, enganosas ou discriminatórias, deverão utilizar a ferramenta de denúncia no anúncio para que a administração da Plataforma adote as medidas de desativação cautelar e eventual banimento do anunciante.$t$);

COMMIT;
