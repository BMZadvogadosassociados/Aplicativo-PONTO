const express = require('express');
const router = express.Router();
const Ajuste = require('../models/Ajuste');

// POST /api/ajustes - usuário solicita ajuste de ponto
router.post('/', async (req, res) => {
  try {
    const { cpf, pontoId, novoHorario, motivo } = req.body;

    const novoAjuste = new Ajuste({
      cpf,
      pontoId,
      novoHorario,
      motivo,
      status: 'pendente',
      criadoEm: new Date()
    });

    await novoAjuste.save();

    res.json({ success: true, message: 'Solicitação enviada ao RH' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/ajustes - RH busca todos os ajustes pendentes
router.get('/', async (req, res) => {
  try {
    const ajustes = await Ajuste.find().sort({ criadoEm: -1 });
    res.json({ success: true, ajustes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/ajustes/:id - Aprovar ou recusar ajuste
router.put('/:id', async (req, res) => {
  try {
    const { status, respostaRH } = req.body;
    const ajuste = await Ajuste.findByIdAndUpdate(req.params.id, {
      status,
      respostaRH,
      atualizadoEm: new Date()
    }, { new: true });

    res.json({ success: true, ajuste });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
