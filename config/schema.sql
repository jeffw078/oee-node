-- config/schema.sql - Schema do banco de dados
-- Tabelas de usuários e soldadores
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    nome_completo TEXT NOT NULL,
    tipo_usuario TEXT CHECK(tipo_usuario IN ('admin', 'analista', 'qualidade', 'manutencao', 'soldador')) NOT NULL,
    ativo BOOLEAN DEFAULT 1,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    ultimo_login DATETIME
);

CREATE TABLE IF NOT EXISTS soldadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    senha_simplificada TEXT NOT NULL,
    ativo BOOLEAN DEFAULT 1,
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
);

-- Tabelas de produção
CREATE TABLE IF NOT EXISTS modulos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL,
    descricao TEXT,
    ativo BOOLEAN DEFAULT 1,
    ordem_exibicao INTEGER DEFAULT 0,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS componentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL,
    descricao TEXT,
    tempo_padrao REAL NOT NULL,
    considera_diametro BOOLEAN DEFAULT 0,
    formula_calculo TEXT,
    ativo BOOLEAN DEFAULT 1,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE NOT NULL,
    descricao TEXT,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_prevista DATE,
    status TEXT CHECK(status IN ('ativo', 'finalizado', 'cancelado')) DEFAULT 'ativo',
    observacoes TEXT
);

-- Tabelas de apontamentos
CREATE TABLE IF NOT EXISTS turnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    soldador_id INTEGER NOT NULL,
    data_turno DATE NOT NULL,
    inicio_turno DATETIME NOT NULL,
    fim_turno DATETIME,
    horas_disponiveis REAL,
    status TEXT CHECK(status IN ('ativo', 'finalizado')) DEFAULT 'ativo',
    FOREIGN KEY (soldador_id) REFERENCES soldadores (id)
);

CREATE TABLE IF NOT EXISTS apontamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    soldador_id INTEGER NOT NULL,
    modulo_id INTEGER NOT NULL,
    componente_id INTEGER NOT NULL,
    pedido_id INTEGER NOT NULL,
    turno_id INTEGER,
    numero_poste_tubo TEXT NOT NULL,
    diametro REAL,
    inicio_processo DATETIME NOT NULL,
    fim_processo DATETIME,
    tempo_real REAL,
    tempo_padrao REAL NOT NULL,
    eficiencia_calculada REAL,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    observacoes TEXT,
    FOREIGN KEY (soldador_id) REFERENCES soldadores (id),
    FOREIGN KEY (modulo_id) REFERENCES modulos (id),
    FOREIGN KEY (componente_id) REFERENCES componentes (id),
    FOREIGN KEY (pedido_id) REFERENCES pedidos (id),
    FOREIGN KEY (turno_id) REFERENCES turnos (id)
);

-- Tabelas de paradas
CREATE TABLE IF NOT EXISTS tipos_parada (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL,
    categoria TEXT CHECK(categoria IN ('geral', 'manutencao', 'qualidade')) NOT NULL,
    penaliza_oee BOOLEAN DEFAULT 1,
    requer_senha_especial BOOLEAN DEFAULT 0,
    ativo BOOLEAN DEFAULT 1,
    cor_exibicao TEXT DEFAULT '#dc3545'
);

CREATE TABLE IF NOT EXISTS paradas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_parada_id INTEGER NOT NULL,
    soldador_id INTEGER NOT NULL,
    apontamento_id INTEGER,
    turno_id INTEGER,
    inicio DATETIME NOT NULL,
    fim DATETIME,
    duracao_minutos REAL,
    motivo_detalhado TEXT,
    usuario_autorizacao_id INTEGER,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tipo_parada_id) REFERENCES tipos_parada (id),
    FOREIGN KEY (soldador_id) REFERENCES soldadores (id),
    FOREIGN KEY (apontamento_id) REFERENCES apontamentos (id),
    FOREIGN KEY (turno_id) REFERENCES turnos (id),
    FOREIGN KEY (usuario_autorizacao_id) REFERENCES usuarios (id)
);

-- Tabelas de qualidade
CREATE TABLE IF NOT EXISTS tipos_defeito (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL,
    descricao TEXT,
    ativo BOOLEAN DEFAULT 1,
    cor_exibicao TEXT DEFAULT '#dc3545'
);

CREATE TABLE IF NOT EXISTS defeitos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_defeito_id INTEGER NOT NULL,
    apontamento_id INTEGER NOT NULL,
    soldador_id INTEGER NOT NULL,
    tamanho_mm REAL NOT NULL,
    area_defeito REAL,
    data_deteccao DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_qualidade_id INTEGER NOT NULL,
    observacoes TEXT,
    FOREIGN KEY (tipo_defeito_id) REFERENCES tipos_defeito (id),
    FOREIGN KEY (apontamento_id) REFERENCES apontamentos (id),
    FOREIGN KEY (soldador_id) REFERENCES soldadores (id),
    FOREIGN KEY (usuario_qualidade_id) REFERENCES usuarios (id)
);

-- Tabelas de configuração e auditoria
CREATE TABLE IF NOT EXISTS configuracao_sistema (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descricao TEXT,
    tipo_dado TEXT CHECK(tipo_dado IN ('string', 'integer', 'float', 'boolean')) DEFAULT 'string',
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS log_auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    acao TEXT NOT NULL,
    tabela_afetada TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    dados_antes TEXT,
    dados_depois TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
);

-- Tabela para funcionalidade offline
CREATE TABLE IF NOT EXISTS dados_offline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dispositivo_id TEXT NOT NULL,
    tipo_operacao TEXT CHECK(tipo_operacao IN ('apontamento', 'parada', 'defeito')) NOT NULL,
    dados_json TEXT NOT NULL,
    sincronizado BOOLEAN DEFAULT 0,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_sincronizacao DATETIME
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_apontamentos_soldador ON apontamentos(soldador_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_data ON apontamentos(data_criacao);
CREATE INDEX IF NOT EXISTS idx_paradas_soldador ON paradas(soldador_id);
CREATE INDEX IF NOT EXISTS idx_paradas_data ON paradas(data_criacao);
CREATE INDEX IF NOT EXISTS idx_turnos_soldador ON turnos(soldador_id);
CREATE INDEX IF NOT EXISTS idx_log_timestamp ON log_auditoria(timestamp);