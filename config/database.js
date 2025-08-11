// config/database.js - Configuração do banco SQLite
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

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
    const schemaPath = path.join(__dirname, 'schema.sql');
    
    if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Dividir o schema em comandos separados
        const commands = schema.split(';').filter(cmd => cmd.trim().length > 0);
        
        let completed = 0;
        const total = commands.length;
        
        commands.forEach((command, index) => {
            db.run(command + ';', (err) => {
                if (err && !err.message.includes('already exists')) {
                    console.error(`❌ Erro no comando ${index + 1}:`, err.message);
                }
                
                completed++;
                if (completed === total) {
                    console.log('✅ Schema do banco criado/atualizado');
                    setTimeout(insertInitialData, 100); // Pequeno delay
                }
            });
        });
    } else {
        console.log('⚠️ Arquivo schema.sql não encontrado');
        insertInitialData();
    }
}

function insertInitialData() {
    console.log('📊 Verificando dados iniciais...');
    
    db.get("SELECT COUNT(*) as count FROM usuarios WHERE tipo_usuario = 'admin'", (err, row) => {
        if (err) {
            console.error('❌ Erro ao verificar admin:', err.message);
            console.log('✅ Sistema iniciado (sem dados iniciais)');
            return;
        }
        
        if (row && row.count === 0) {
            console.log('📊 Inserindo dados iniciais...');
            const initialDataPath = path.join(__dirname, 'initial_data.sql');
            
            if (fs.existsSync(initialDataPath)) {
                const initialData = fs.readFileSync(initialDataPath, 'utf8');
                
                // Dividir em comandos separados
                const commands = initialData.split(';').filter(cmd => cmd.trim().length > 0);
                
                let completed = 0;
                const total = commands.length;
                
                commands.forEach((command, index) => {
                    db.run(command + ';', (err) => {
                        if (err && !err.message.includes('UNIQUE constraint failed')) {
                            console.error(`❌ Erro no dados iniciais ${index + 1}:`, err.message);
                        }
                        
                        completed++;
                        if (completed === total) {
                            console.log('✅ Dados iniciais inseridos');
                            console.log('🎉 Sistema pronto para uso!');
                            console.log('👤 Login soldador: ALCIONEI / senha: 1234');
                        }
                    });
                });
            } else {
                console.log('⚠️ Arquivo initial_data.sql não encontrado');
                console.log('✅ Sistema iniciado (sem dados iniciais)');
            }
        } else {
            console.log('✅ Dados iniciais já existem');
            console.log('🎉 Sistema pronto para uso!');
            console.log('👤 Login soldador: ALCIONEI / senha: 1234');
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