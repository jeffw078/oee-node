// routes/api.js - Rotas da API
const express = require('express');
const router = express.Router();
const { query, run, get } = require('../config/database');
const { requireAuth, logAuditoria } = require('../middleware/auth');

// Status de conexão
router.head('/status', (req, res) => {
    res.status(200).end();
});

// Sincronização de dados offline
router.post('/sincronizar-offline', requireAuth, async (req, res) => {
    try {
        const { dados } = req.body;
        let processados = 0;
        let erros = [];
        
        for (const item of dados) {
            try {
                switch (item.tipo) {
                    case 'iniciar_componente':
                        await processarInicioComponente(item.dados, req);
                        break;
                    case 'finalizar_componente':
                        await processarFimComponente(item.dados, req);
                        break;
                    case 'iniciar_parada':
                        await processarInicioParada(item.dados, req);
                        break;
                    case 'finalizar_parada':
                        await processarFimParada(item.dados, req);
                        break;
                    default:
                        throw new Error('Tipo de operação não reconhecido');
                }
                processados++;
            } catch (error) {
                erros.push(`Erro no item ${item.id}: ${error.message}`);
            }
        }
        
        res.json({
            success: true,
            processados,
            erros: erros.length,
            detalhes_erros: erros
        });
        
    } catch (error) {
        console.error('Erro na sincronização:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Funções auxiliares para sincronização
async function processarInicioComponente(dados, req) {
    const { componente_id, modulo_id, pedido_numero, numero_poste_tubo, diametro } = dados;
    const soldador = req.session.usuario;
    
    // Buscar ou criar pedido
    let pedido = await get('SELECT * FROM pedidos WHERE numero = ?', [pedido_numero]);
    if (!pedido) {
        const pedidoResult = await run(`
            INSERT INTO pedidos (numero, descricao, status)
            VALUES (?, ?, 'ativo')
        `, [pedido_numero, `Pedido ${pedido_numero}`]);
        pedido = { id: pedidoResult.id };
    }
    
    // Buscar componente
    const componente = await get('SELECT * FROM componentes WHERE id = ?', [componente_id]);
    if (!componente) {
        throw new Error('Componente não encontrado');
    }
    
    // Calcular tempo padrão
    let tempoPadrao = parseFloat(componente.tempo_padrao);
    if (componente.considera_diametro && diametro && componente.formula_calculo) {
        try {
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
        soldador.soldador_id, modulo_id, componente_id, pedido.id,
        req.session.turno_id, numero_poste_tubo, diametro, tempoPadrao
    ]);
    
    await logAuditoria(req, 'INICIAR_COMPONENTE_OFFLINE', 'apontamentos', apontamentoResult.id, {}, dados);
}

async function processarFimComponente(dados, req) {
    const { apontamento_id } = dados;
    const soldador = req.session.usuario;
    
    const apontamento = await get(`
        SELECT * FROM apontamentos 
        WHERE id = ? AND soldador_id = ? AND fim_processo IS NULL
    `, [apontamento_id, soldador.soldador_id]);
    
    if (!apontamento) {
        throw new Error('Apontamento não encontrado');
    }
    
    // Calcular tempo real e eficiência
    const agora = new Date();
    const inicio = new Date(apontamento.inicio_processo);
    const tempoRealMinutos = (agora - inicio) / (1000 * 60);
    const eficiencia = (apontamento.tempo_padrao / tempoRealMinutos) * 100;
    
    await run(`
        UPDATE apontamentos 
        SET fim_processo = DATETIME('now', 'localtime'),
            tempo_real = ?,
            eficiencia_calculada = ?
        WHERE id = ?
    `, [tempoRealMinutos, eficiencia, apontamento_id]);
    
    await logAuditoria(req, 'FINALIZAR_COMPONENTE_OFFLINE', 'apontamentos', apontamento_id, apontamento, dados);
}

async function processarInicioParada(dados, req) {
    const { tipo_parada_id, motivo_detalhado } = dados;
    const soldador = req.session.usuario;
    
    const paradaResult = await run(`
        INSERT INTO paradas (
            tipo_parada_id, soldador_id, turno_id, inicio, motivo_detalhado
        ) VALUES (?, ?, ?, DATETIME('now', 'localtime'), ?)
    `, [tipo_parada_id, soldador.soldador_id, req.session.turno_id, motivo_detalhado]);
    
    await logAuditoria(req, 'INICIAR_PARADA_OFFLINE', 'paradas', paradaResult.id, {}, dados);
}

async function processarFimParada(dados, req) {
    const { parada_id } = dados;
    const soldador = req.session.usuario;
    
    const parada = await get(`
        SELECT * FROM paradas 
        WHERE id = ? AND soldador_id = ? AND fim IS NULL
    `, [parada_id, soldador.soldador_id]);
    
    if (!parada) {
        throw new Error('Parada não encontrada');
    }
    
    const agora = new Date();
    const inicio = new Date(parada.inicio);
    const duracaoMinutos = (agora - inicio) / (1000 * 60);
    
    await run(`
        UPDATE paradas 
        SET fim = DATETIME('now', 'localtime'),
            duracao_minutos = ?
        WHERE id = ?
    `, [duracaoMinutos, parada_id]);
    
    await logAuditoria(req, 'FINALIZAR_PARADA_OFFLINE', 'paradas', parada_id, parada, dados);
}

module.exports = router;