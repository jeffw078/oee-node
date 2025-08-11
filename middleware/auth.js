// middleware/auth.js - Middleware de autenticação
const { run } = require('../config/database');

function requireAuth(req, res, next) {
    if (!req.session.usuario) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ success: false, message: 'Não autenticado' });
        }
        return res.redirect('/');
    }
    next();
}

function requireSoldador(req, res, next) {
    if (!req.session.usuario || req.session.usuario.tipo_usuario !== 'soldador') {
        return res.status(403).render('error', {
            title: 'Acesso Negado',
            message: 'Acesso restrito para soldadores'
        });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.usuario || req.session.usuario.tipo_usuario !== 'admin') {
        return res.status(403).render('error', {
            title: 'Acesso Negado',
            message: 'Acesso restrito para administradores'
        });
    }
    next();
}

function requireQualidade(req, res, next) {
    if (!req.session.usuario || req.session.usuario.tipo_usuario !== 'qualidade') {
        return res.status(403).render('error', {
            title: 'Acesso Negado',
            message: 'Acesso restrito para qualidade'
        });
    }
    next();
}

function requireManutencao(req, res, next) {
    if (!req.session.usuario || req.session.usuario.tipo_usuario !== 'manutencao') {
        return res.status(403).render('error', {
            title: 'Acesso Negado',
            message: 'Acesso restrito para manutenção'
        });
    }
    next();
}

async function logAuditoria(req, acao, tabela, registro_id, dados_antes = {}, dados_depois = {}) {
    try {
        const usuario = req.session.usuario;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || '';
        
        await run(`
            INSERT INTO log_auditoria (
                usuario_id, acao, tabela_afetada, registro_id, 
                dados_antes, dados_depois, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            usuario ? usuario.id : null,
            acao,
            tabela,
            registro_id.toString(),
            JSON.stringify(dados_antes),
            JSON.stringify(dados_depois),
            ip,
            userAgent
        ]);
    } catch (error) {
        console.error('Erro ao registrar auditoria:', error);
    }
}

module.exports = {
    requireAuth,
    requireSoldador,
    requireAdmin,
    requireQualidade,
    requireManutencao,
    logAuditoria
};