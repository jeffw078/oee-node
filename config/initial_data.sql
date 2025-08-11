-- config/initial_data.sql - Dados iniciais
-- Usuário administrador padrão (senha: admin123)
INSERT OR IGNORE INTO usuarios (username, password, email, nome_completo, tipo_usuario, ativo) VALUES 
('admin', '$2a$10$rOJx5Q5JZx.zGy6K6J6x1.i5K5Q5JZx.zGy6K6J6x1ui5K5Q5JZx.z', 'admin@empresa.com', 'Administrador', 'admin', 1);

-- Usuários de exemplo
INSERT OR IGNORE INTO usuarios (username, password, email, nome_completo, tipo_usuario, ativo) VALUES 
('jefferson.admin', '$2a$10$rOJx5Q5JZx.zGy6K6J6x1.i5K5Q5JZx.zGy6K6J6x1ui5K5Q5JZx.z', 'jefferson@empresa.com', 'JEFFERSON', 'admin', 1),
('qualidade.user', '$2a$10$rOJx5Q5JZx.zGy6K6J6x1.i5K5Q5JZx.zGy6K6J6x1ui5K5Q5JZx.z', 'qualidade@empresa.com', 'Usuário Qualidade', 'qualidade', 1),
('manutencao.user', '$2a$10$rOJx5Q5JZx.zGy6K6J6x1.i5K5Q5JZx.zGy6K6J6x1ui5K5Q5JZx.z', 'manutencao@empresa.com', 'Usuário Manutenção', 'manutencao', 1),
('alcionei.soldador', '$2a$10$rOJx5Q5JZx.zGy6K6J6x1.i5K5Q5JZx.zGy6K6J6x1ui5K5Q5JZx.z', 'alcionei@empresa.com', 'ALCIONEI', 'soldador', 1);

-- Módulos padrão
INSERT OR IGNORE INTO modulos (nome, descricao, ordem_exibicao) VALUES 
('Módulo A', 'Módulo de produção A', 1),
('Módulo T', 'Módulo de produção T', 2),
('Módulo B', 'Módulo de produção B', 3),
('Módulo C', 'Módulo de produção C', 4);

-- Componentes de exemplo baseados no MVP
INSERT OR IGNORE INTO componentes (nome, descricao, tempo_padrao, considera_diametro, formula_calculo) VALUES 
('FAIS', 'Componente FAIS com diâmetro do tubo', 15.0, 1, 'diametro * 0.02'),
('FAIB', 'Componente FAIB com diâmetro do tubo', 12.0, 1, 'diametro * 0.015'),
('ANTIGIRO', 'Componente Antigiro - 600mm', 25.0, 0, ''),
('CHAPA DE SACRIFÍCIO', 'Chapa de Sacrifício com diâmetro', 10.0, 1, 'diametro * 0.012'),
('ATERRAMENTO', 'Aterramento - 200mm', 8.0, 0, ''),
('OLHAL LINHA DE VIDA', 'Olhal Linha de Vida - 185.1mm', 20.0, 0, ''),
('ESCADAS', 'Escadas - 1085.1mm', 45.0, 0, ''),
('FAIE', 'FAIE com diâmetro do tubo', 18.0, 1, 'diametro * 0.022');

-- Tipos de parada padrão
INSERT OR IGNORE INTO tipos_parada (nome, categoria, penaliza_oee, requer_senha_especial, cor_exibicao) VALUES 
('Banheiro', 'geral', 1, 0, '#ffc107'),
('Lanche', 'geral', 0, 0, '#28a745'),
('Troca de Consumíveis', 'geral', 1, 0, '#6c757d'),
('Falta de Material', 'geral', 0, 0, '#17a2b8'),
('Manutenção Preventiva', 'manutencao', 0, 1, '#fd7e14'),
('Manutenção Corretiva', 'manutencao', 1, 1, '#dc3545'),
('Inspeção de Qualidade', 'qualidade', 0, 1, '#6f42c1'),
('HIG PESSOAL', 'geral', 1, 0, '#20c997');

-- Tipos de defeito padrão
INSERT OR IGNORE INTO tipos_defeito (nome, descricao, cor_exibicao) VALUES 
('DESALINHAMENTO DE SOLDA', 'Desalinhamento na execução da solda', '#dc3545'),
('POROSIDADE', 'Porosidade na solda', '#fd7e14'),
('FALTA DE PENETRAÇÃO', 'Falta de penetração na solda', '#ffc107'),
('MORDEDURA', 'Mordedura na solda', '#e83e8c'),
('RESPINGO', 'Respingo de solda', '#6c757d');

-- Pedidos de exemplo
INSERT OR IGNORE INTO pedidos (numero, descricao, status) VALUES 
('5454', 'Pedido de produção exemplo', 'ativo'),
('5054', 'Pedido de produção exemplo 2', 'ativo');

-- Soldadores de exemplo (após inserir usuários)
INSERT OR IGNORE INTO soldadores (usuario_id, senha_simplificada, ativo) 
SELECT id, '1234', 1 FROM usuarios WHERE username = 'alcionei.soldador';

-- Configurações do sistema
INSERT OR IGNORE INTO configuracao_sistema (chave, valor, descricao, tipo_dado) VALUES 
('horas_trabalho_padrao', '8', 'Horas de trabalho padrão por dia', 'integer'),
('timeout_sessao_minutos', '480', 'Timeout da sessão em minutos (8 horas)', 'integer'),
('backup_automatico', 'true', 'Backup automático habilitado', 'boolean'),
('versao_sistema', '2.0.0', 'Versão atual do sistema', 'string'),
('sincronizacao_offline', 'true', 'Sincronização offline habilitada', 'boolean');