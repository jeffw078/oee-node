const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const soldagemRoutes = require('./routes/soldagem');
const qualidadeRoutes = require('./routes/qualidade');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de segurança com CSP mais permissivo
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

app.use(compression());
app.use(cors());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Muitas requisições, tente novamente em 15 minutos'
});
app.use(limiter);

app.use(morgan('combined'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'oee-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    res.locals.isOnline = true;
    next();
});

// Rotas
app.use('/', authRoutes);
app.use('/soldagem', soldagemRoutes);
app.use('/qualidade', qualidadeRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

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

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        title: 'Erro do Sistema',
        message: 'Ocorreu um erro interno. Tente novamente.',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Página não encontrada',
        message: 'A página solicitada não foi encontrada.',
        error: {}
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor OEE rodando em http://localhost:${PORT}`);
    console.log(`📱 Acesso para tablets: http://[IP-DO-SERVIDOR]:${PORT}`);
    console.log(`👨‍💼 Admin: http://localhost:${PORT}/admin`);
});

module.exports = app;