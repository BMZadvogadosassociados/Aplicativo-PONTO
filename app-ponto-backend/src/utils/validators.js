// Validar CPF com algoritmo oficial
const validarCPF = (cpf) => {
  const cpfLimpo = cpf.replace(/\D/g, '');
  
  if (cpfLimpo.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;
  
  // Primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpfLimpo.charAt(i)) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.charAt(9))) return false;
  
  // Segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpfLimpo.charAt(i)) * (11 - i);
  }
  resto = 11 - (soma % 11);
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.charAt(10))) return false;
  
  return true;
};

// Calcular distância entre duas coordenadas (fórmula de Haversine)
const calcularDistancia = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lng2-lng1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distância em metros
};

// Validar se está dentro da área da empresa
const validarLocalizacaoEmpresa = (lat, lng) => {
  const COMPANY_LAT = parseFloat(process.env.COMPANY_LAT);
  const COMPANY_LNG = parseFloat(process.env.COMPANY_LNG);
  const RADIUS = parseFloat(process.env.COMPANY_RADIUS);
  
  const distancia = calcularDistancia(lat, lng, COMPANY_LAT, COMPANY_LNG);
  
  return {
    dentroEmpresa: distancia <= RADIUS,
    distancia: Math.round(distancia)
  };
};

// Validar horário de trabalho
const validarHorarioTrabalho = (tipo) => {
  const agora = new Date();
  const hora = agora.getHours();
  const minuto = agora.getMinutes();
  const horaCompleta = hora + (minuto / 60);
  
  const regras = {
    entrada: { min: 6, max: 10, nome: 'Entrada' },
    saida_almoco: { min: 11, max: 14, nome: 'Saída para Almoço' },
    entrada_almoco: { min: 12, max: 15, nome: 'Retorno do Almoço' },
    saida: { min: 16, max: 20, nome: 'Saída' }
  };
  
  const regra = regras[tipo];
  if (!regra) return { valido: false, motivo: 'Tipo de ponto inválido' };
  
  const valido = horaCompleta >= regra.min && horaCompleta <= regra.max;
  
  return {
    valido,
    motivo: valido ? null : `${regra.nome} só pode ser marcada entre ${regra.min}:00 e ${regra.max}:00`,
    horarioAtual: `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`
  };
};

// Validar sequência de pontos
const validarSequenciaPonto = (pontosHoje, novoTipo) => {
  const sequenciaCorreta = ['entrada', 'saida_almoco', 'entrada_almoco', 'saida'];
  const tiposJaMarcados = pontosHoje.map(p => p.tipo);
  
  // Verifica se o tipo já foi marcado hoje
  if (tiposJaMarcados.includes(novoTipo)) {
    return {
      valido: false,
      motivo: `${novoTipo.replace('_', ' ')} já foi marcada hoje`
    };
  }
  
  // Verifica se está na sequência correta
  const proximoEsperado = sequenciaCorreta[tiposJaMarcados.length];
  
  if (novoTipo !== proximoEsperado) {
    return {
      valido: false,
      motivo: `Próximo ponto esperado: ${proximoEsperado.replace('_', ' ')}`
    };
  }
  
  return { valido: true };
};

module.exports = {
  validarCPF,
  calcularDistancia,
  validarLocalizacaoEmpresa,
  validarHorarioTrabalho,
  validarSequenciaPonto
};