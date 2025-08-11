// routes/admin.js - Rotas administrativas
const express = require('express');
const router = express.Router();
const moment = require('moment');
const { query, run, get } = require('../config/database');
const { requireAuth, requireAdmin, logAuditoria } = require('../middleware/auth');
const CalculosOEE = require('../utils/calculos');

// Dashboard administrativo
router.get('/dashboard', requireAuth, requireAdmin, async (req, res) => {
    try {
        const hoje = moment().format('YYYY-MM-DD');
        const inicioMes = moment().startOf('month').format('YYYY-MM-DD');
        
        // Estatísticas gerais
        const stats = await query(`
            SELECT 
                (SELECT COUNT(*) FROM soldadores WHERE ativo = 1) as soldadores_ativos,
                (SELECT COUNT(*) FROM apontamentos WHERE DATE(inicio_processo) = ?) as apontamentos_hoje,
                (SELECT COUNT(*) FROM paradas WHERE DATE(inicio) = ? AND fim IS NOT NULL) as paradas_hoje,
                (SELECT COUNT(*) FROM turnos WHERE data_turno = ?) as turnos_hoje
        `, [hoje, hoje, hoje]);
        
        // OEE do mês
        const oeeResumo = await CalculosOEE.gerarRelatorioOEE({
            dataInicio: inicioMes,
            dataFim: hoje
        });
        
        // Soldadores mais eficientes do mês
        const topSoldadores = oeeResumo.soldadores
            .sort((a, b) => b.oee.oee - a.oee.oee)
            .slice(0, 5);
        
        // Apontamentos recentes
        const apontamentosRecentes = await query(`
            SELECT 
                a.*,
                u.nome_completo as soldador_nome,
                m.nome as modulo_nome,
                c.nome as componente_nome,
                p.numero as pedido_numero
            FROM apontamentos a
            JOIN soldadores s ON a.soldador_id = s.id
            JOIN usuarios u ON s.usuario_id = u.id
            JOIN modulos m ON a.modulo_id = m.id
            JOIN componentes c ON a.componente_id = c.id
            JOIN pedidos p ON a.pedido_id = p.id
            ORDER BY a.inicio_processo DESC
            LIMIT 10
        `);
        
        res.render('admin/dashboard', {
            title: 'Dashboard Administrativo',
            stats: stats[0],
            oeeResumo,
            topSoldadores,
            apontamentosRecentes,
            momento: moment()
        });
        
    } catch (error) {
        console.error('Erro no dashboard:', error);
        res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao carregar dashboard'
        });
    }
});

// Gestão de apontamentos
router.get('/apontamentos', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { soldador_id, data_inicio, data_fim, modulo_id } = req.query;
        
        let whereClause = '1=1';
        let params = [];
        
        if (soldador_id) {
            whereClause += ' AND a.soldador_id = ?';
            params.push(soldador_id);
        }
        
        if (data_inicio) {
            whereClause += ' AND DATE(a.inicio_processo) >= ?';
            params.push(data_inicio);
        }
        
        if (data_fim) {
            whereClause += ' AND DATE(a.inicio_processo) <= ?';
            params.push(data_fim);
        }
        
        if (modulo_id) {
            whereClause += ' AND a.modulo_id = ?';
            params.push(modulo_id);
        }
        
        const apontamentos = await query(`
            SELECT 
                a.*,
                u.nome_completo as soldador_nome,
                m.nome as modulo_nome,
                c.nome as componente_nome,
                p.numero as pedido_numero
            FROM apontamentos a
            JOIN soldadores s ON a.soldador_id = s.id
            JOIN usuarios u ON s.usuario_id = u.id
            JOIN modulos m ON a.modulo_id = m.id
            JOIN componentes c ON a.componente_id = c.id
            JOIN pedidos p ON a.pedido_id = p.id
            WHERE ${whereClause}
            ORDER BY a.inicio_processo DESC
            LIMIT 100
        `, params);
        
        // Buscar dados para filtros
        const soldadores = await query(`
            SELECT s.id, u.nome_completo 
            FROM soldadores s 
            JOIN usuarios u ON s.usuario_id = u.id 
            WHERE s.ativo = 1 
            ORDER BY u.nome_completo
        `);
        
        const modulos = await query(`
            SELECT * FROM modulos 
            WHERE ativo = 1 
            ORDER BY ordem_exibicao, nome
        `);
        
        res.render('admin/apontamentos', {
            title: 'Gestão de Apontamentos',
            apontamentos,
            soldadores,
            modulos,
            filtros: req.query,
            momento: moment()
        });
        
    } catch (error) {
        console.error('Erro ao buscar apontamentos:', error);
        res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao carregar apontamentos'
        });
    }
});

// Relatórios OEE
router.get('/relatorios', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { tipo, soldador_id, data_inicio, data_fim } = req.query;
        
        let relatorio = null;
        
        if (tipo === 'oee') {
            relatorio = await CalculosOEE.gerarRelatorioOEE({
                soldadorId: soldador_id,
                dataInicio: data_inicio || moment().startOf('month').format('YYYY-MM-DD'),
                dataFim: data_fim || moment().format('YYYY-MM-DD')
            });
        }
        
        // Dados para filtros
        const soldadores = await query(`
            SELECT s.id, u.nome_completo 
            FROM soldadores s 
            JOIN usuarios u ON s.usuario_id = u.id 
            WHERE s.ativo = 1 
            ORDER BY u.nome_completo
        `);
        
        res.render('admin/relatorios', {
            title: 'Relatórios OEE',
            relatorio,
            soldadores,
            filtros: req.query,
            momento: moment()
        });
        
    } catch (error) {
        console.error('Erro nos relatórios:', error);
        res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao gerar relatórios'
        });
    }
});

// Gestão de usuários
router.get('/usuarios', requireAuth, requireAdmin, async (req, res) => {
    try {
        const usuarios = await query(`
            SELECT u.*, s.senha_simplificada, s.ativo as soldador_ativo
            FROM usuarios u
            LEFT JOIN soldadores s ON u.id = s.usuario_id
            ORDER BY u.tipo_usuario, u.nome_completo
        `);
        
        res.render('admin/usuarios', {
            title: 'Gestão de Usuários',
            usuarios
        });
        
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao carregar usuários'
        });
    }
});

// Gestão de componentes
router.get('/componentes', requireAuth, requireAdmin, async (req, res) => {
    try {
        const componentes = await query(`
            SELECT * FROM componentes 
            ORDER BY nome
        `);
        
        res.render('admin/componentes', {
            title: 'Gestão de Componentes',
            componentes
        });
        
    } catch (error) {
        console.error('Erro ao buscar componentes:', error);
        res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao carregar componentes'
        });
    }
});

// API para dados de gráficos
router.get('/api/grafico-oee', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { periodo = '30', soldador_id } = req.query;
        const diasAtras = parseInt(periodo);
        const dataInicio = moment().subtract(diasAtras, 'days').format('YYYY-MM-DD');
        const dataFim = moment().format('YYYY-MM-DD');
        
        // Buscar dados diários
        const dadosDiarios = await query(`
            SELECT 
                DATE(a.inicio_processo) as data,
                COUNT(*) as apontamentos,
                AVG(a.eficiencia_calculada) as eficiencia_media,
                SUM(a.tempo_real) as tempo_total
            FROM apontamentos a
            WHERE DATE(a.inicio_processo) BETWEEN ? AND ?
            ${soldador_id ? 'AND a.soldador_id = ?' : ''}
            AND a.fim_processo IS NOT NULL
            GROUP BY DATE(a.inicio_processo)
            ORDER BY data
        `, soldador_id ? [dataInicio, dataFim, soldador_id] : [dataInicio, dataFim]);
        
        res.json({
            success: true,
            labels: dadosDiarios.map(d => moment(d.data).format('DD/MM')),
            datasets: [
                {
                    label: 'Eficiência (%)',
                    data: dadosDiarios.map(d => Math.round(d.eficiencia_media || 0)),
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Apontamentos',
                    data: dadosDiarios.map(d => d.apontamentos),
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        });
        
    } catch (error) {
        console.error('Erro no gráfico OEE:', error);
        res.json({ success: false, message: error.message });
    }
});

module.exports = router;