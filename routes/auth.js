const express = require('express');
const router = express.Router();

router.get('/error', (req, res) => {
    res.render('error', {
        title: 'Erro',
        message: 'Ocorreu um erro',
        error: {}
    });
});

module.exports = router;
