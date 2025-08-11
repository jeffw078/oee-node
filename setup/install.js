// setup/install.js - Script de instalação automática
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Iniciando instalação do Sistema OEE...');

// Criar diretórios necessários
const diretorios = [
    'data',
    'logs',
    'public/css',
    'public/js',
    'public/images',
    'views/partials',
    'views/soldagem',
    'views/qualidade',
    'views/admin',
    'routes',
    'middleware',
    'config',
    'utils'
];

diretorios.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
   if (!fs.existsSync(fullPath)) {
       fs.mkdirSync(fullPath, { recursive: true });
       console.log(`✅ Diretório criado: ${dir}`);
   }
});

// Instalar dependências
console.log('📦 Instalando dependências...');
try {
   execSync('npm install', { stdio: 'inherit' });
   console.log('✅ Dependências instaladas');
} catch (error) {
   console.error('❌ Erro ao instalar dependências:', error.message);
   process.exit(1);
}

// Criar arquivos de configuração
console.log('⚙️ Criando arquivos de configuração...');

// .env
const envContent = `
NODE_ENV=development
PORT=3000
SESSION_SECRET=sua-chave-secreta-super-forte-aqui-${Date.now()}
DB_PATH=./data/oee_system.db
LOG_LEVEL=info
`;

fs.writeFileSync(path.join(__dirname, '..', '.env'), envContent);
console.log('✅ Arquivo .env criado');

// .gitignore
const gitignoreContent = `
node_modules/
data/
logs/
.env
*.log
.DS_Store
Thumbs.db
`;

fs.writeFileSync(path.join(__dirname, '..', '.gitignore'), gitignoreContent);
console.log('✅ Arquivo .gitignore criado');

// Criar partials EJS
const partialsDir = path.join(__dirname, '..', 'views', 'partials');

// extra_css.ejs
fs.writeFileSync(path.join(partialsDir, 'extra_css.ejs'), '<!-- CSS extra aqui -->');

// extra_js.ejs
fs.writeFileSync(path.join(partialsDir, 'extra_js.ejs'), '<!-- JavaScript extra aqui -->');

console.log('✅ Partials EJS criados');

// Criar logo placeholder
const logoPath = path.join(__dirname, '..', 'public', 'images');
const logoContent = `
<svg width="120" height="40" xmlns="http://www.w3.org/2000/svg">
 <rect width="120" height="40" fill="#dc3545"/>
 <text x="60" y="25" font-family="Arial" font-size="14" fill="white" text-anchor="middle">SteelMast</text>
</svg>
`;

fs.writeFileSync(path.join(logoPath, 'logo.svg'), logoContent);
console.log('✅ Logo placeholder criado');

console.log('🎉 Instalação concluída!');
console.log('');
console.log('Para iniciar o sistema:');
console.log('  npm start     - Produção');
console.log('  npm run dev   - Desenvolvimento');
console.log('');
console.log('Acesso padrão:');
console.log('  Sistema: http://localhost:3000');
console.log('  Admin: admin / admin123');
console.log('  Soldador: ALCIONEI / 1234');