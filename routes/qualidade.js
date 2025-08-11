const express = require('express');
const router = express.Router();

router.get('/painel', (req, res) => {
    res.render('qualidade/painel', { title: 'Painel de Qualidade' });
});

module.exports = router;
