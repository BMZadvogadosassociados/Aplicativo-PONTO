import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuração da API
const API_BASE_URL = 'http://192.168.88.99:3000';

class ApiService {
  
  // Obter token armazenado
  async getToken() {
    try {
      return await AsyncStorage.getItem('token');
    } catch (error) {
      console.log('❌ Erro ao obter token:', error);
      return null;
    }
  }

  // Salvar token
  async saveToken(token) {
    try {
      await AsyncStorage.setItem('token', token);
      console.log('✅ Token salvo com sucesso');
    } catch (error) {
      console.log('❌ Erro ao salvar token:', error);
    }
  }

  // Remover token (logout)
  async removeToken() {
    try {
      await AsyncStorage.multiRemove(['token', 'dadosUsuario']);
      console.log('✅ Token e dados removidos');
    } catch (error) {
      console.log('❌ Erro ao remover token:', error);
    }
  }

  // Fazer requisição SIMPLES - SEM RETRY INFINITO
  async makeRequest(endpoint, options = {}) {
    try {
      const token = await this.getToken();
      
      const config = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        timeout: 10000, // 10 segundos
        ...options,
      };

      const fullUrl = `${API_BASE_URL}/api${endpoint}`;
      
      console.log(`🌐 ${config.method} ${fullUrl}`);
      console.log(`🔑 Token presente: ${!!token}`);
      
      // Criar timeout manual
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log('⏰ Timeout da requisição');
      }, config.timeout);
      
      const response = await fetch(fullUrl, {
        ...config,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`📡 Status da resposta: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Erro desconhecido');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ Resposta recebida:`, data.success ? 'Sucesso' : 'Falha');
      
      return data;

    } catch (error) {
      console.error(`❌ Erro na requisição para ${endpoint}:`, error.message);
      
      // Para erros de rede, retornar erro estruturado
      if (error.name === 'AbortError') {
        throw new Error('Timeout da requisição. Verifique sua conexão.');
      }
      
      if (error.message.includes('Network')) {
        throw new Error('Erro de rede. Verifique sua conexão.');
      }
      
      throw error;
    }
  }

  // ==================== AUTENTICAÇÃO ====================
  async login(cpf, senha) {
    try {
      console.log('🔐 Iniciando login para CPF:', cpf.replace(/\d(?=\d{4})/g, '*'));
      
      const response = await this.makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ cpf, senha }),
      });

      // Salvar token e dados do usuário se login foi bem-sucedido
      if (response.success) {
        if (response.token) {
          await this.saveToken(response.token);
        }
        
        if (response.usuario) {
          await AsyncStorage.setItem('dadosUsuario', JSON.stringify(response.usuario));
        }
        
        console.log('✅ Login realizado com sucesso');
      }

      return response;
      
    } catch (error) {
      console.error('❌ Erro no login:', error.message);
      throw error;
    }
  }

  async verificarToken() {
    try {
      const token = await this.getToken();
      
      if (!token) {
        return {
          success: false,
          message: 'Token não encontrado'
        };
      }

      const response = await this.makeRequest('/auth/verificar', {
        method: 'GET',
      });

      console.log('🔍 Verificação de token:', response.success ? 'Válido' : 'Inválido');
      return response;
      
    } catch (error) {
      console.error('❌ Erro na verificação do token:', error.message);
      
      // Se o token for inválido, removê-lo
      if (error.message.includes('401') || error.message.includes('Token inválido')) {
        await this.removeToken();
      }
      
      return {
        success: false,
        message: error.message
      };
    }
  }

  async logout() {
    try {
      // Tentar notificar o servidor (opcional)
      try {
        await this.makeRequest('/auth/logout', {
          method: 'POST',
        });
      } catch (error) {
        console.log('⚠️ Erro ao notificar logout no servidor (ignorado):', error.message);
      }

      // Sempre limpar dados locais
      await this.removeToken();
      
      console.log('✅ Logout realizado');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erro no logout:', error.message);
      // Mesmo com erro, tentar limpar dados locais
      await this.removeToken();
      return { success: true };
    }
  }

  // ==================== PONTOS ====================
  async marcarPonto(dadosPonto) {
    try {
      console.log('📍 Marcando ponto:', dadosPonto.tipo);
      
      const dadosOtimizados = {
        tipo: dadosPonto.tipo,
        dataHora: dadosPonto.dataHora,
        localizacao: dadosPonto.localizacao,
        observacoes: dadosPonto.observacoes || `Ponto ${dadosPonto.tipo} via app`,
      };

      const response = await this.makeRequest('/pontos/marcar', {
        method: 'POST',
        body: JSON.stringify(dadosOtimizados),
      });

      console.log('✅ Ponto marcado:', response.success);
      return response;
      
    } catch (error) {
      console.error('❌ Erro ao marcar ponto:', error.message);
      
      // Salvar offline em caso de erro
      try {
        const pontosOffline = await AsyncStorage.getItem('pontosOffline');
        const lista = pontosOffline ? JSON.parse(pontosOffline) : [];
        lista.push({
          ...dadosPonto,
          timestampOffline: new Date().toISOString()
        });
        await AsyncStorage.setItem('pontosOffline', JSON.stringify(lista));
        
        return {
          success: true,
          message: 'Ponto salvo localmente. Será enviado quando possível.',
          offline: true,
          ponto: {
            ...dadosPonto,
            id: Date.now().toString(),
            sincronizado: false
          }
        };
      } catch (offlineError) {
        throw error; // Lança o erro original se não conseguir salvar offline
      }
    }
  }

  async buscarPontosHoje() {
    try {
      console.log('📅 Buscando pontos de hoje...');
      
      const response = await this.makeRequest('/pontos/hoje', {
        method: 'GET',
      });

      console.log('✅ Pontos de hoje:', response.pontos?.length || 0);
      return response;
      
    } catch (error) {
      console.error('❌ Erro ao buscar pontos de hoje:', error.message);
      throw error;
    }
  }

  async buscarHistorico(filtros = {}) {
  try {
    console.log('📊 Buscando histórico...');
    
    // Verificar token antes de fazer a requisição
    const token = await this.getToken();
    if (!token) {
      return {
        success: false,
        message: 'Token não encontrado'
      };
    }
    
    const params = new URLSearchParams();
    
    if (filtros.data) params.append('data', filtros.data);
    if (filtros.limite) params.append('limite', filtros.limite.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `/pontos/historico?${queryString}` : '/pontos/historico';
    
    const response = await this.makeRequest(endpoint, {
      method: 'GET',
    });

    console.log('✅ Histórico carregado:', response.pontos?.length || 0, 'pontos');
    
    // NOVO: Buscar ajustes do usuário e mapear nos pontos
    if (response.success && response.pontos) {
      const ajustesResponse = await this.buscarAjustes();
      if (ajustesResponse.success) {
        const ajustes = ajustesResponse.ajustes || [];
        
        // Mapear ajustes nos pontos correspondentes
        response.pontos = response.pontos.map(ponto => {
          const ajusteRelacionado = ajustes.find(ajuste => 
            ajuste.pontoId === (ponto.id || ponto._id)
          );
          
          if (ajusteRelacionado) {
            return {
              ...ponto,
              statusAjuste: ajusteRelacionado.status,
              novoHorario: ajusteRelacionado.novoHorario,
              motivoAjuste: ajusteRelacionado.motivo,
              respostaRH: ajusteRelacionado.respostaMensagem,
              // Se aprovado, mostrar o novo horário como principal
              ...(ajusteRelacionado.status === 'aprovado' ? {
                horarioOriginal: ponto.dataHora,
                dataHora: ajusteRelacionado.novoHorario
              } : {})
            };
          }
          return ponto;
        });
      }
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error.message);
    throw error;
  }
}

  // ==================== AJUSTES ====================
 async solicitarAjuste(dadosAjuste) {
  try {
    console.log('📝 Solicitando ajuste de horário:', dadosAjuste);
    
    // Validação dos dados
    if (!dadosAjuste.cpf || !dadosAjuste.pontoId || !dadosAjuste.novoHorario || !dadosAjuste.motivo) {
      throw new Error('Dados incompletos para solicitação de ajuste');
    }

    if (dadosAjuste.motivo.trim().length < 10) {
      throw new Error('O motivo deve ter pelo menos 10 caracteres');
    }

    const response = await this.makeRequest('/ajustes', {
      method: 'POST',
      body: JSON.stringify(dadosAjuste),
    });

    console.log('✅ Ajuste solicitado:', response.success);
    
    return response;
    
  } catch (error) {
    console.error('❌ Erro ao solicitar ajuste:', error.message);
    
    // Salvar offline em caso de erro
    try {
      const ajustesOffline = await AsyncStorage.getItem('ajustesOffline');
      const lista = ajustesOffline ? JSON.parse(ajustesOffline) : [];
      lista.push({
        ...dadosAjuste,
        timestampOffline: new Date().toISOString()
      });
      await AsyncStorage.setItem('ajustesOffline', JSON.stringify(lista));
      
      return {
        success: true,
        message: 'Ajuste salvo localmente. Será enviado quando possível.',
        offline: true
      };
    } catch (offlineError) {
      throw error; // Lança o erro original se não conseguir salvar offline
    }
  }
}

  async buscarAjustes() {
    try {
      console.log('📋 Buscando ajustes do usuário...');
      
      const response = await this.makeRequest('/ajustes', {
        method: 'GET',
      });

      console.log('✅ Ajustes carregados:', response.ajustes?.length || 0);
      return response;
      
    } catch (error) {
      console.error('❌ Erro ao buscar ajustes:', error.message);
      
      // Retornar vazio em caso de erro para não quebrar o app
      return {
        success: true,
        ajustes: [],
        message: 'Ajustes carregados do cache local'
      };
    }
  }

  // ==================== UTILITÁRIOS ====================
  async testarConexao() {
    try {
      console.log('🔧 Testando conexão...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Conexão OK:', data.status);
      
      return {
        success: true,
        data,
        url: API_BASE_URL
      };
      
    } catch (error) {
      console.error('❌ Falha na conexão:', error.message);
      
      return {
        success: false,
        error: error.message,
        url: API_BASE_URL,
        sugestoes: [
          'Verifique se o servidor está rodando',
          'Confirme o IP da rede',
          'Teste a conectividade de rede'
        ]
      };
    }
  }
}

export default new ApiService();