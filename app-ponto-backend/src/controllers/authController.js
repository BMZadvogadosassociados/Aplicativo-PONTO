const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { validarCPF } = require('../utils/validators');

// Cadastro de usuário
const cadastrar = async (req, res) => {
  try {
    const { nome, sobrenome, cpf, email, senha } = req.body;

    // Validações básicas
    if (!nome || !sobrenome || !cpf || !email || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Todos os campos são obrigatórios'
      });
    }

    // Validar CPF
    if (!validarCPF(cpf)) {
      return res.status(400).json({
        success: false,
        message: 'CPF inválido'
      });
    }

    // Verificar se usuário já existe
    const cpfLimpo = cpf.replace(/\D/g, '');
    const usuarioExistente = await User.findOne({
      $or: [
        { cpf: cpfLimpo },
        { email: email.toLowerCase() }
      ]
    });

    if (usuarioExistente) {
      return res.status(400).json({
        success: false,
        message: 'CPF ou email já cadastrado'
      });
    }

    // Criar usuário
    const novoUsuario = new User({
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      cpf: cpfLimpo,
      email: email.toLowerCase().trim(),
      senha
    });

    await novoUsuario.save();

    // Gerar token
    const token = generateToken(novoUsuario._id);

    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso',
      token,
      usuario: {
        id: novoUsuario._id,
        nome: novoUsuario.nome,
        sobrenome: novoUsuario.sobrenome,
        cpf: novoUsuario.cpf,
        email: novoUsuario.email,
        empresa: novoUsuario.empresa,
        cargo: novoUsuario.cargo
      }
    });

  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Login de usuário
const login = async (req, res) => {
  try {
    const { cpf, senha } = req.body;

    // Validações básicas
    if (!cpf || !senha) {
      return res.status(400).json({
        success: false,
        message: 'CPF e senha são obrigatórios'
      });
    }

    // Validar CPF
    if (!validarCPF(cpf)) {
      return res.status(400).json({
        success: false,
        message: 'CPF inválido'
      });
    }

    // Buscar usuário
    const cpfLimpo = cpf.replace(/\D/g, '');
    const usuario = await User.findOne({ cpf: cpfLimpo }).select('+senha');

    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'CPF não encontrado'
      });
    }

    // Verificar se usuário está ativo
    if (!usuario.ativo) {
      return res.status(401).json({
        success: false,
        message: 'Usuário inativo. Contate o administrador'
      });
    }

    // Verificar senha
    const senhaCorreta = await usuario.comparePassword(senha);
    if (!senhaCorreta) {
      return res.status(401).json({
        success: false,
        message: 'Senha incorreta'
      });
    }

    // Gerar token
    const token = generateToken(usuario._id);

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      token,
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        sobrenome: usuario.sobrenome,
        cpf: usuario.cpf,
        email: usuario.email,
        empresa: usuario.empresa,
        cargo: usuario.cargo,
        fotoPerfil: usuario.fotoPerfil
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Verificar token (middleware de autenticação)
const verificarToken = async (req, res) => {
  try {
    // O middleware auth já coloca o usuário em req.user
    res.json({
      success: true,
      usuario: {
        id: req.user._id,
        nome: req.user.nome,
        sobrenome: req.user.sobrenome,
        cpf: req.user.cpf,
        email: req.user.email,
        empresa: req.user.empresa,
        cargo: req.user.cargo,
        fotoPerfil: req.user.fotoPerfil
      }
    });
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

module.exports = {
  cadastrar,
  login,
  verificarToken
};