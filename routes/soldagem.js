// routes/soldagem.js - Rotas de soldagem
const express = require('express');
const router = express.Router();
const moment = require('moment');
const { query, run, get } = require('../config/database');
const { requireAuth, requireSoldador, logAuditoria } = require('../middleware/auth');

// Seleção de soldador (tela inicial)
router.get('/selecao-soldador', async (req, res) => {
    try {
        const soldadores = await query(`
            SELECT s.*, u.nome_completo 
            FROM soldadores s 
            JOIN usuarios u ON s.usuario_id = u.id 
            WHERE s.ativo = 1 AND u.ativo = 1
            ORDER BY u.nome_completo
        `);
        
        res.render('soldagem/selecao_soldador', {
            title: 'Seleção de Soldador',
            soldadores
        });
    } catch (error) {
        console.error('Erro ao buscar soldadores:', error);
        res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao carregar soldadores'
        });
    }
});

// Login do soldador
router.post('/login-soldador', async (req, res) => {
    try {
        const { soldador_id, senha } = req.body;
        
        const soldador = await get(`
            SELECT s.*, u.nome_completo, u.username, u.tipo_usuario
            FROM soldadores s 
            JOIN usuarios u ON s.usuario_id = u.id 
            WHERE s.id = ? AND s.senha_simplificada = ? AND s.ativo = 1
        `, [soldador_id, senha]);
        
        if (!soldador) {
            return res.json({ success: false, message: 'Senha incorreta' });
        }
        
        // Criar sessão
        req.session.usuario = {
            id: soldador.usuario_id,
            soldador_id: soldador.id,
            nome_completo: soldador.nome_completo,
            username: soldador.username,
            tipo_usuario: soldador.tipo_usuario
        };
        
        // Verificar se já existe um turno ativo
        let turno = await get(`
            SELECT * FROM turnos 
            WHERE soldador_id = ? AND data_turno = DATE('now', 'localtime') AND status = 'ativo'
        `, [soldador.id]);
        
        if (!turno) {
            // Criar novo turno
            const turnoResult = await run(`
                INSERT INTO turnos (soldador_id, data_turno, inicio_turno, horas_disponiveis, status)
                VALUES (?, DATE('now', 'localtime'), DATETIME('now', 'localtime'), 8, 'ativo')
            `, [soldador.id]);
            
            req.session.turno_id = turnoResult.id;
        } else {
            req.session.turno_id = turno.id;
        }
        
        // Registrar último login
        await run('UPDATE usuarios SET ultimo_login = DATETIME("now", "localtime") WHERE id = ?', [soldador.usuario_id]);
        
        // Log de auditoria
        await logAuditoria(req, 'LOGIN_SOLDADOR', 'usuarios', soldador.usuario_id, {}, { login_time: new Date() });
        
        res.json({ success: true, redirect: '/soldagem/apontamento' });
        
    } catch (error) {
        console.error('Erro no login:', error);
        res.json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Tela principal de apontamento
router.get('/apontamento', requireAuth, requireSoldador, async (req, res) => {
    try {
        const soldador = req.session.usuario;
        
        // Buscar módulos ativos
        const modulos = await query(`
            SELECT * FROM modulos 
            WHERE ativo = 1 
            ORDER BY ordem_exibicao, nome
        `);
        
        // Verificar se há apontamento ativo
        const apontamentoAtivo = await get(`
            SELECT a.*, c.nome as componente_nome, m.nome as modulo_nome, p.numero as pedido_numero
            FROM apontamentos a
            JOIN componentes c ON a.componente_id = c.id
            JOIN modulos m ON a.modulo_id = m.id
            JOIN pedidos p ON a.pedido_id = p.id
            WHERE a.soldador_id = ? AND a.fim_processo IS NULL
            ORDER BY a.inicio_processo DESC LIMIT 1
        `, [soldador.soldador_id]);
        
        // Verificar se há parada ativa
        const paradaAtiva = await get(`
            SELECT p.*, tp.nome as tipo_nome, tp.categoria, tp.cor_exibicao
            FROM paradas p
            JOIN tipos_parada tp ON p.tipo_parada_id = tp.id
            WHERE p.soldador_id = ? AND p.fim IS NULL
            ORDER BY p.inicio DESC LIMIT 1
        `, [soldador.soldador_id]);
        
        // Obter saudação baseada no horário
        const hora = moment().hour();
        let saudacao = 'Bom dia';
        if (hora >= 12 && hora < 18) saudacao = 'Boa tarde';
        if (hora >= 18) saudacao = 'Boa noite';
        
        res.render('soldagem/apontamento', {
            title: 'Apontamento de Soldagem',
            soldador,
            modulos,
            apontamentoAtivo,
            paradaAtiva,
            saudacao,
            momento: moment()
        });
        
    } catch (error) {
        console.error('Erro ao carregar apontamento:', error);
        res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao carregar tela de apontamento'
        });
    }
});

// API - Iniciar módulo
router.post('/api/iniciar-modulo', requireAuth, async (req, res) => {
    try {
        const { modulo_id, pedido_numero, numero_poste_tubo } = req.body;
        const soldador = req.session.usuario;
        
        // Verificar se o módulo existe
        const modulo = await get('SELECT * FROM modulos WHERE id = ? AND ativo = 1', [modulo_id]);
        if (!modulo) {
            return res.json({ success: false, message: 'Módulo não encontrado' });
        }
        
        // Buscar ou criar pedido
        let pedido = await get('SELECT * FROM pedidos WHERE numero = ?', [pedido_numero]);
        if (!pedido) {
            const pedidoResult = await run(`
                INSERT INTO pedidos (numero, descricao, status)
                VALUES (?, ?, 'ativo')
           `, [pedido_numero, `Pedido ${pedido_numero}`, 'ativo']);
           
           pedido = { id: pedidoResult.id, numero: pedido_numero };
       }
       
       // Buscar componentes do módulo
       const componentes = await query(`
           SELECT * FROM componentes 
           WHERE ativo = 1 
           ORDER BY nome
       `);
       
       res.json({ 
           success: true, 
           modulo,
           pedido,
           componentes,
           numero_poste_tubo
       });
       
   } catch (error) {
       console.error('Erro ao iniciar módulo:', error);
       res.json({ success: false, message: 'Erro interno' });
   }
});

// API - Iniciar componente
router.post('/api/iniciar-componente', requireAuth, async (req, res) => {
   try {
       const { componente_id, modulo_id, pedido_id, numero_poste_tubo, diametro } = req.body;
       const soldador = req.session.usuario;
       
       // Verificar se já existe apontamento ativo
       const apontamentoExistente = await get(`
           SELECT * FROM apontamentos 
           WHERE soldador_id = ? AND fim_processo IS NULL
       `, [soldador.soldador_id]);
       
       if (apontamentoExistente) {
           return res.json({ success: false, message: 'Existe um apontamento ativo. Finalize-o primeiro.' });
       }
       
       // Buscar componente
       const componente = await get('SELECT * FROM componentes WHERE id = ?', [componente_id]);
       if (!componente) {
           return res.json({ success: false, message: 'Componente não encontrado' });
       }
       
       // Calcular tempo padrão
       let tempoPadrao = parseFloat(componente.tempo_padrao);
       if (componente.considera_diametro && diametro && componente.formula_calculo) {
           try {
               // Avaliação segura da fórmula (substitui 'diametro' pelo valor)
               const formula = componente.formula_calculo.replace(/diametro/g, diametro);
               tempoPadrao = eval(formula);
           } catch (e) {
               console.error('Erro na fórmula:', e);
           }
       }
       
       // Criar apontamento
       const apontamentoResult = await run(`
           INSERT INTO apontamentos (
               soldador_id, modulo_id, componente_id, pedido_id, turno_id,
               numero_poste_tubo, diametro, inicio_processo, tempo_padrao
           ) VALUES (?, ?, ?, ?, ?, ?, ?, DATETIME('now', 'localtime'), ?)
       `, [
           soldador.soldador_id, modulo_id, componente_id, pedido_id, 
           req.session.turno_id, numero_poste_tubo, diametro, tempoPadrao
       ]);
       
       // Log de auditoria
       await logAuditoria(req, 'INICIAR_COMPONENTE', 'apontamentos', apontamentoResult.id, {}, {
           componente_id, modulo_id, pedido_id, numero_poste_tubo, diametro
       });
       
       res.json({ 
           success: true, 
           apontamento_id: apontamentoResult.id,
           tempo_padrao: tempoPadrao,
           componente: componente.nome
       });
       
   } catch (error) {
       console.error('Erro ao iniciar componente:', error);
       res.json({ success: false, message: 'Erro interno' });
   }
});

// API - Finalizar componente
router.post('/api/finalizar-componente', requireAuth, async (req, res) => {
   try {
       const { apontamento_id } = req.body;
       const soldador = req.session.usuario;
       
       // Buscar apontamento
       const apontamento = await get(`
           SELECT * FROM apontamentos 
           WHERE id = ? AND soldador_id = ? AND fim_processo IS NULL
       `, [apontamento_id, soldador.soldador_id]);
       
       if (!apontamento) {
           return res.json({ success: false, message: 'Apontamento não encontrado' });
       }
       
       // Calcular tempo real em minutos
       const agora = new Date();
       const inicio = new Date(apontamento.inicio_processo);
       const tempoRealMinutos = (agora - inicio) / (1000 * 60);
       
       // Calcular eficiência
       const eficiencia = (apontamento.tempo_padrao / tempoRealMinutos) * 100;
       
       // Finalizar apontamento
       await run(`
           UPDATE apontamentos 
           SET fim_processo = DATETIME('now', 'localtime'),
               tempo_real = ?,
               eficiencia_calculada = ?
           WHERE id = ?
       `, [tempoRealMinutos, eficiencia, apontamento_id]);
       
       // Log de auditoria
       await logAuditoria(req, 'FINALIZAR_COMPONENTE', 'apontamentos', apontamento_id, 
           apontamento, { fim_processo: agora, tempo_real: tempoRealMinutos, eficiencia_calculada: eficiencia });
       
       res.json({ 
           success: true, 
           tempo_real: tempoRealMinutos.toFixed(2),
           eficiencia: eficiencia.toFixed(2)
       });
       
   } catch (error) {
       console.error('Erro ao finalizar componente:', error);
       res.json({ success: false, message: 'Erro interno' });
   }
});

// API - Iniciar parada
router.post('/api/iniciar-parada', requireAuth, async (req, res) => {
   try {
       const { tipo_parada_id, motivo_detalhado } = req.body;
       const soldador = req.session.usuario;
       
       // Verificar se já existe parada ativa
       const paradaExistente = await get(`
           SELECT * FROM paradas 
           WHERE soldador_id = ? AND fim IS NULL
       `, [soldador.soldador_id]);
       
       if (paradaExistente) {
           return res.json({ success: false, message: 'Já existe uma parada ativa' });
       }
       
       // Buscar tipo de parada
       const tipoParada = await get('SELECT * FROM tipos_parada WHERE id = ?', [tipo_parada_id]);
       if (!tipoParada) {
           return res.json({ success: false, message: 'Tipo de parada não encontrado' });
       }
       
       // Criar parada
       const paradaResult = await run(`
           INSERT INTO paradas (
               tipo_parada_id, soldador_id, turno_id, inicio, motivo_detalhado
           ) VALUES (?, ?, ?, DATETIME('now', 'localtime'), ?)
       `, [tipo_parada_id, soldador.soldador_id, req.session.turno_id, motivo_detalhado]);
       
       // Log de auditoria
       await logAuditoria(req, 'INICIAR_PARADA', 'paradas', paradaResult.id, {}, {
           tipo_parada_id, motivo_detalhado
       });
       
       res.json({ 
           success: true, 
           parada_id: paradaResult.id,
           tipo_parada: tipoParada.nome
       });
       
   } catch (error) {
       console.error('Erro ao iniciar parada:', error);
       res.json({ success: false, message: 'Erro interno' });
   }
});

// API - Finalizar parada
router.post('/api/finalizar-parada', requireAuth, async (req, res) => {
   try {
       const { parada_id } = req.body;
       const soldador = req.session.usuario;
       
       // Buscar parada
       const parada = await get(`
           SELECT * FROM paradas 
           WHERE id = ? AND soldador_id = ? AND fim IS NULL
       `, [parada_id, soldador.soldador_id]);
       
       if (!parada) {
           return res.json({ success: false, message: 'Parada não encontrada' });
       }
       
       // Calcular duração em minutos
       const agora = new Date();
       const inicio = new Date(parada.inicio);
       const duracaoMinutos = (agora - inicio) / (1000 * 60);
       
       // Finalizar parada
       await run(`
           UPDATE paradas 
           SET fim = DATETIME('now', 'localtime'),
               duracao_minutos = ?
           WHERE id = ?
       `, [duracaoMinutos, parada_id]);
       
       // Log de auditoria
       await logAuditoria(req, 'FINALIZAR_PARADA', 'paradas', parada_id, 
           parada, { fim: agora, duracao_minutos: duracaoMinutos });
       
       res.json({ 
           success: true, 
           duracao_minutos: duracaoMinutos
       });
       
   } catch (error) {
       console.error('Erro ao finalizar parada:', error);
       res.json({ success: false, message: 'Erro interno' });
   }
});

// API - Buscar tipos de parada
router.get('/api/tipos-parada/:categoria', requireAuth, async (req, res) => {
   try {
       const { categoria } = req.params;
       
       const tiposParada = await query(`
           SELECT * FROM tipos_parada 
           WHERE categoria = ? AND ativo = 1 
           ORDER BY nome
       `, [categoria]);
       
       res.json({ success: true, tipos_parada: tiposParada });
       
   } catch (error) {
       console.error('Erro ao buscar tipos de parada:', error);
       res.json({ success: false, message: 'Erro interno' });
   }
});

// Finalizar turno
router.post('/finalizar-turno', requireAuth, async (req, res) => {
   try {
       const soldador = req.session.usuario;
       
       // Verificar apontamentos ou paradas ativas
       const apontamentoAtivo = await get(`
           SELECT * FROM apontamentos 
           WHERE soldador_id = ? AND fim_processo IS NULL
       `, [soldador.soldador_id]);
       
       const paradaAtiva = await get(`
           SELECT * FROM paradas 
           WHERE soldador_id = ? AND fim IS NULL
       `, [soldador.soldador_id]);
       
       if (apontamentoAtivo || paradaAtiva) {
           return res.json({ 
               success: false, 
               message: 'Finalize todos os apontamentos e paradas antes de finalizar o turno' 
           });
       }
       
       // Finalizar turno
       await run(`
           UPDATE turnos 
           SET fim_turno = DATETIME('now', 'localtime'), status = 'finalizado'
           WHERE id = ?
       `, [req.session.turno_id]);
       
       // Log de auditoria
       await logAuditoria(req, 'FINALIZAR_TURNO', 'turnos', req.session.turno_id, {}, {
           fim_turno: new Date()
       });
       
       // Limpar sessão
       req.session.destroy();
       
       res.json({ success: true, redirect: '/' });
       
   } catch (error) {
       console.error('Erro ao finalizar turno:', error);
       res.json({ success: false, message: 'Erro interno' });
   }
});

module.exports = router;