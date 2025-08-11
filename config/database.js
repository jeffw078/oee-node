// server.js - Servidor principal
const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const db = require('./config/database');
const authRoutes = require('./routes/auth');
const soldagemRoutes = require('./routes/soldagem');
const qualidadeRoutes = require('./routes/qualidade');
const manutencaoRoutes = require('./routes/manutencao');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de segurança
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

app.use(compression());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000, // máximo 1000 requests por IP
    message: 'Muitas requisições, tente novamente em 15 minutos'
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Configuração de sessão
app.use(session({
    secret: process.env.SESSION_SECRET || 'sua-chave-secreta-aqui',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // true em produção com HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para verificar conexão
app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    res.locals.isOnline = true; // Para simular status de conexão
    next();
});

// Rotas
app.use('/', authRoutes);
app.use('/soldagem', soldagemRoutes);
app.use('/qualidade', qualidadeRoutes);
app.use('/manutencao', manutencaoRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

// Rota principal
app.get('/', (req, res) => {
    if (req.session.usuario) {
        if (req.session.usuario.tipo_usuario === 'soldador') {
            return res.redirect('/soldagem/apontamento');
        } else {
            return res.redirect('/admin/dashboard');
        }
    }
    res.redirect('/soldagem/selecao-soldador');
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        title: 'Erro do Sistema',
        message: 'Ocorreu um erro interno. Tente novamente.',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// 404
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Página não encontrada',
        message: 'A página solicitada não foi encontrada.',
        error: {}
    });
});

// Inicializar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor OEE rodando em http://localhost:${PORT}`);
    console.log(`📱 Acesso para tablets: http://[IP-DO-SERVIDOR]:${PORT}`);
    console.log(`👨‍💼 Admin: http://localhost:${PORT}/admin`);
});

module.exports = app;

// config/database.js - Configuração do banco SQLite
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'oee_system.db');

// Criar diretório data se não existir
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar com o banco:', err.message);
    } else {
        console.log('✅ Conectado ao banco SQLite');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Executar scripts de criação das tabelas
    const schemaPath = path.join(__dirname, 'schema.sql');
    
    if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        db.exec(schema, (err) => {
            if (err) {
                console.error('❌ Erro ao criar schema:', err.message);
            } else {
                console.log('✅ Schema do banco criado/atualizado');
                insertInitialData();
            }
        });
    }
}

function insertInitialData() {
    // Inserir dados iniciais se necessário
    db.get("SELECT COUNT(*) as count FROM usuarios WHERE tipo_usuario = 'admin'", (err, row) => {
        if (err) {
            console.error('Erro ao verificar admin:', err.message);
            return;
        }
        
        if (row.count === 0) {
            console.log('📊 Inserindo dados iniciais...');
            const initialDataPath = path.join(__dirname, 'initial_data.sql');
            
            if (fs.existsSync(initialDataPath)) {
                const initialData = fs.readFileSync(initialDataPath, 'utf8');
                db.exec(initialData, (err) => {
                    if (err) {
                        console.error('❌ Erro ao inserir dados iniciais:', err.message);
                    } else {
                        console.log('✅ Dados iniciais inseridos');
                    }
                });
            }
        }
    });
}

// Função para executar queries com Promise
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

module.exports = {
    db,
    query,
    run,
    get
};