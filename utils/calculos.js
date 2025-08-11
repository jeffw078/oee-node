// utils/calculos.js - Utilitários para cálculos OEE
const { query, get } = require('../config/database');

class CalculosOEE {
    
    /**
     * Calcula OEE para um soldador em um período
     */
    static async calcularOEE(soldadorId, dataInicio, dataFim) {
        try {
            const utilizacao = await this.calcularUtilizacao(soldadorId, dataInicio, dataFim);
            const eficiencia = await this.calcularEficiencia(soldadorId, dataInicio, dataFim);
            const qualidade = await this.calcularQualidade(soldadorId, dataInicio, dataFim);
            const produtividade = utilizacao * eficiencia;
            const oee = utilizacao * eficiencia * qualidade;
            
            return {
                utilizacao: Math.round(utilizacao * 10000) / 100, // 2 casas decimais
                eficiencia: Math.round(eficiencia * 10000) / 100,
                qualidade: Math.round(qualidade * 10000) / 100,
                produtividade: Math.round(produtividade * 10000) / 100,
                oee: Math.round(oee * 10000) / 100
            };
        } catch (error) {
            console.error('Erro no cálculo OEE:', error);
            return {
                utilizacao: 0,
                eficiencia: 0,
                qualidade: 0,
                produtividade: 0,
                oee: 0
            };
        }
    }
    
    /**
     * Calcula utilização: horas trabalhadas / horas disponíveis
     */
    static async calcularUtilizacao(soldadorId, dataInicio, dataFim) {
        const turnos = await query(`
            SELECT 
                SUM(horas_disponiveis) as total_horas_disponiveis,
                COUNT(*) as dias_trabalhados
            FROM turnos 
            WHERE soldador_id = ? 
            AND data_turno BETWEEN ? AND ?
        `, [soldadorId, dataInicio, dataFim]);
        
        const horasDisponiveis = turnos[0]?.total_horas_disponiveis || 0;
        
        if (horasDisponiveis === 0) return 0;
        
        // Calcular tempo total de paradas que penalizam
        const paradas = await query(`
            SELECT SUM(p.duracao_minutos) as total_paradas
            FROM paradas p
            JOIN tipos_parada tp ON p.tipo_parada_id = tp.id
            WHERE p.soldador_id = ?
            AND DATE(p.inicio) BETWEEN ? AND ?
            AND tp.penaliza_oee = 1
            AND p.fim IS NOT NULL
        `, [soldadorId, dataInicio, dataFim]);
        
        const minutosParadas = paradas[0]?.total_paradas || 0;
        const horasParadas = minutosParadas / 60;
        
        const horasTrabalhadas = Math.max(0, horasDisponiveis - horasParadas);
        
        return horasDisponiveis > 0 ? horasTrabalhadas / horasDisponiveis : 0;
    }
    
    /**
     * Calcula eficiência: tempo padrão / tempo real
     */
    static async calcularEficiencia(soldadorId, dataInicio, dataFim) {
        const apontamentos = await query(`
            SELECT 
                SUM(tempo_padrao) as total_tempo_padrao,
                SUM(tempo_real) as total_tempo_real
            FROM apontamentos 
            WHERE soldador_id = ? 
            AND DATE(inicio_processo) BETWEEN ? AND ?
            AND fim_processo IS NOT NULL
        `, [soldadorId, dataInicio, dataFim]);
        
        const tempoPadrao = apontamentos[0]?.total_tempo_padrao || 0;
        const tempoReal = apontamentos[0]?.total_tempo_real || 0;
        
        return tempoReal > 0 ? tempoPadrao / tempoReal : 0;
    }
    
    /**
     * Calcula qualidade: 1 - (área defeitos / área total)
     */
    static async calcularQualidade(soldadorId, dataInicio, dataFim) {
        // Buscar todos os apontamentos do período
        const apontamentos = await query(`
            SELECT a.*, c.tempo_padrao, c.considera_diametro, c.formula_calculo
            FROM apontamentos a
            JOIN componentes c ON a.componente_id = c.id
            WHERE a.soldador_id = ? 
            AND DATE(a.inicio_processo) BETWEEN ? AND ?
            AND a.fim_processo IS NOT NULL
        `, [soldadorId, dataInicio, dataFim]);
        
        if (apontamentos.length === 0) return 1; // 100% se não há apontamentos
        
        let areaTotalSoldagem = 0;
        let areaTotalDefeitos = 0;
        
        for (const apontamento of apontamentos) {
            // Calcular área de soldagem do componente
            const areaSoldagem = this.calcularAreaSoldagem(apontamento);
            areaTotalSoldagem += areaSoldagem;
            
            // Buscar defeitos deste apontamento
            const defeitos = await query(`
                SELECT SUM(area_defeito) as total_area_defeitos
                FROM defeitos 
                WHERE apontamento_id = ?
            `, [apontamento.id]);
            
            const areaDefeitos = defeitos[0]?.total_area_defeitos || 0;
            areaTotalDefeitos += areaDefeitos;
        }
        
        if (areaTotalSoldagem === 0) return 1;
        
        const percentualDefeitos = areaTotalDefeitos / areaTotalSoldagem;
        return Math.max(0, 1 - percentualDefeitos);
    }
    
    /**
     * Calcula área de soldagem baseado no componente
     */
    static calcularAreaSoldagem(apontamento) {
        const { diametro, tempo_padrao } = apontamento;
        
        // Fórmula básica: área baseada no tempo padrão
        // Para componentes com diâmetro, usar fórmula específica
        if (diametro && diametro > 0) {
            // Fórmula simplificada: π * diâmetro * altura_estimada
            const alturaEstimada = tempo_padrao * 10; // 10mm por minuto (aproximação)
            return Math.PI * diametro * alturaEstimada;
        }
        
        // Para componentes sem diâmetro, usar tempo padrão como base
        return tempo_padrao * 100; // 100mm² por minuto (aproximação)
    }
    
    /**
     * Gera relatório completo de OEE
     */
    static async gerarRelatorioOEE(filtros = {}) {
        const { soldadorId, dataInicio, dataFim, moduloId } = filtros;
        
        let whereClause = '1=1';
        let params = [];
        
        if (soldadorId) {
            whereClause += ' AND a.soldador_id = ?';
            params.push(soldadorId);
        }
        
        if (dataInicio) {
            whereClause += ' AND DATE(a.inicio_processo) >= ?';
            params.push(dataInicio);
        }
        
        if (dataFim) {
            whereClause += ' AND DATE(a.inicio_processo) <= ?';
            params.push(dataFim);
        }
        
        if (moduloId) {
            whereClause += ' AND a.modulo_id = ?';
            params.push(moduloId);
        }
        
        const apontamentos = await query(`
            SELECT 
                a.*,
                s.usuario_id,
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
            AND a.fim_processo IS NOT NULL
            ORDER BY a.inicio_processo DESC
        `, params);
        
        // Agrupar por soldador para calcular OEE individual
        const soldadores = {};
        
        for (const apt of apontamentos) {
            if (!soldadores[apt.soldador_id]) {
                soldadores[apt.soldador_id] = {
                    id: apt.soldador_id,
                    nome: apt.soldador_nome,
                    apontamentos: [],
                    oee: null
                };
            }
            soldadores[apt.soldador_id].apontamentos.push(apt);
        }
        
        // Calcular OEE para cada soldador
        for (const soldadorData of Object.values(soldadores)) {
            soldadorData.oee = await this.calcularOEE(
                soldadorData.id,
                dataInicio || '1900-01-01',
                dataFim || '2100-12-31'
            );
        }
        
        return {
            apontamentos,
            soldadores: Object.values(soldadores),
            resumo: await this.calcularResumoGeral(filtros)
        };
    }
    
    /**
     * Calcula resumo geral do período
     */
    static async calcularResumoGeral(filtros) {
        const { dataInicio, dataFim } = filtros;
        
        const resumo = await query(`
            SELECT 
                COUNT(DISTINCT a.soldador_id) as total_soldadores,
                COUNT(*) as total_apontamentos,
                SUM(a.tempo_real) as tempo_total_real,
                SUM(a.tempo_padrao) as tempo_total_padrao,
                AVG(a.eficiencia_calculada) as eficiencia_media,
                COUNT(DISTINCT a.modulo_id) as modulos_utilizados,
                COUNT(DISTINCT DATE(a.inicio_processo)) as dias_producao
            FROM apontamentos a
            WHERE a.fim_processo IS NOT NULL
            ${dataInicio ? 'AND DATE(a.inicio_processo) >= ?' : ''}
            ${dataFim ? 'AND DATE(a.inicio_processo) <= ?' : ''}
        `, [dataInicio, dataFim].filter(Boolean));
        
        const paradas = await query(`
            SELECT 
                COUNT(*) as total_paradas,
                SUM(p.duracao_minutos) as tempo_total_paradas,
                tp.categoria,
                COUNT(*) as quantidade_por_categoria
            FROM paradas p
            JOIN tipos_parada tp ON p.tipo_parada_id = tp.id
            WHERE p.fim IS NOT NULL
            ${dataInicio ? 'AND DATE(p.inicio) >= ?' : ''}
            ${dataFim ? 'AND DATE(p.inicio) <= ?' : ''}
            GROUP BY tp.categoria
        `, [dataInicio, dataFim].filter(Boolean));
        
        return {
            producao: resumo[0] || {},
            paradas: paradas || []
        };
    }
}

module.exports = CalculosOEE;