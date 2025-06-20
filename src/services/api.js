import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Network from 'expo-network';

// ✅ CONFIGURAÇÃO DINÂMICA DE IP MELHORADA
const getApiBaseUrl = () => {
  if (__DEV__) {
    // Em desenvolvimento (Expo Go)
    const debuggerHost = Constants.expoConfig?.hostUri
      ? Constants.expoConfig.hostUri.split(':').shift()
      : null;
    
    if (debuggerHost && 
        debuggerHost !== 'localhost' && 
        debuggerHost !== '127.0.0.1' &&
        !debuggerHost.includes('exp://')) {
      console.log('🔍 DEV: Usando IP do debugger Expo:', debuggerHost);
      return `http://${debuggerHost}:3000`;
    }
    
    console.log('🔍 DEV: Usando IP fixo');
    return 'http://192.168.88.99:3000';
  }
  
  // ✅ EM PRODUÇÃO/BUILD - Use IP fixo conhecido da sua rede
  console.log('🏗️ BUILD: Usando IP fixo de produção');
  return 'http://192.168.88.99:3000';
};

class ApiService {
  constructor() {
    this.baseUrl = getApiBaseUrl();
    this.fallbackUrls = [
      'http://192.168.88.99:3000',
      'http://192.168.1.100:3000', 
      'http://192.168.0.100:3000',
      'http://10.0.2.2:3000', // Android emulator
      'http://localhost:3000'  // Fallback local
    ];
    
    console.log('🌐 ApiService inicializado');
    console.log('📱 Ambiente:', __DEV__ ? 'DESENVOLVIMENTO' : 'PRODUÇÃO');
    console.log('🌐 URL principal:', this.baseUrl);
    console.log('🔄 URLs de fallback:', this.fallbackUrls);
  }


  // ✅ TESTAR MÚLTIPLAS URLS
  async testarUrls() {
    const urlsParaTestar = [this.baseUrl, ...this.fallbackUrls];
    
    for (const url of urlsParaTestar) {
      try {
        console.log(`🔍 Testando: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${url}/health`, {
          signal: controller.signal,
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log(`✅ URL funcionando: ${url}`);
          this.baseUrl = url;
          return url;
        }
      } catch (error) {
        console.log(`❌ Falha em ${url}:`, error.message);
        continue;
      }
    }
    
    throw new Error('Nenhuma URL do servidor está acessível');
  }

  // ✅ VERIFICAR CONECTIVIDADE DE REDE
  async verificarRedeDisponivel() {
    try {
      const networkState = await Network.getNetworkStateAsync();
      
      if (!networkState.isConnected) {
        throw new Error('Sem conexão com a internet');
      }
      
      if (!networkState.isInternetReachable) {
        throw new Error('Internet não está acessível');
      }
      
      console.log('✅ Rede disponível:', {
        connected: networkState.isConnected,
        internet: networkState.isInternetReachable,
        type: networkState.type
      });
      
      return true;
    } catch (error) {
      console.error('❌ Problema de rede:', error.message);
      throw error;
    }
  }

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

  // ✅ VERIFICAR CONECTIVIDADE COM FALLBACK DE URLS
   // ✅ VERIFICAÇÃO MELHORADA PARA BUILD
  async verificarConectividade() {
    try {
      console.log('🔍 Verificando conectividade...');
      console.log('📱 Ambiente:', __DEV__ ? 'DEV' : 'BUILD');
      console.log('🌐 URL base atual:', this.baseUrl);
      
      // Verificar rede primeiro
      await this.verificarRedeDisponivel();
      
      // ✅ TENTAR URL ATUAL COM TIMEOUT MENOR EM BUILD
      const timeoutDuration = __DEV__ ? 5000 : 3000; // Timeout menor em build
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.log('⏰ Timeout na URL atual');
        }, timeoutDuration);
        
        const response = await fetch(`${this.baseUrl}/health`, {
          signal: controller.signal,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Servidor online na URL atual:', data);
          return { success: true, data, url: this.baseUrl };
        }
      } catch (error) {
        console.log('⚠️ URL atual falhou, tentando fallbacks...');
        console.log('❌ Erro específico:', error.message);
        
        // ✅ TESTAR FALLBACKS COM MÉTODO MAIS AGRESSIVO
        const urlFuncionando = await this.testarUrls();
        
        const response = await fetch(`${urlFuncionando}/health`);
        const data = await response.json();
        
        console.log('✅ Conectado via fallback:', data);
        return { success: true, data, url: urlFuncionando };
      }
      
    } catch (error) {
      console.error('❌ Falha total de conectividade:', error);
      
      // ✅ DIAGNÓSTICO ESPECÍFICO PARA BUILD
      if (!__DEV__) {
        console.error('🏗️ DIAGNÓSTICO BUILD:');
        console.error('- Verifique se usesCleartextTraffic está true');
        console.error('- Verifique networkSecurityConfig');
        console.error('- Teste se o servidor está acessível na rede');
        console.error('- URLs testadas:', [this.baseUrl, ...this.fallbackUrls]);
      }
      
      throw error;
    }
  }



  
  


  // ✅ FAZER REQUISIÇÃO COM VERIFICAÇÃO MELHORADA
  async makeRequest(endpoint, options = {}) {
    try {
      // Verificar conectividade apenas se não for skipado
      if (!options.skipConnectivityCheck) {
        await this.verificarConectividade();
      }
      
      const token = await this.getToken();
      
      const config = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        timeout: 15000,
        ...options,
      };

      const fullUrl = `${this.baseUrl}/api${endpoint}`;
      
      console.log(`🌐 ${config.method} ${fullUrl}`);
      console.log(`🔑 Token presente: ${!!token}`);
      
      // Timeout manual
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
        let errorText = 'Erro desconhecido';
        try {
          errorText = await response.text();
        } catch (e) {
          console.log('Não foi possível ler texto do erro');
        }
        
        console.error('❌ Erro HTTP:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ Resposta recebida:`, data.success ? 'Sucesso' : 'Falha');
      
      return data;

    } catch (error) {
      console.error(`❌ Erro na requisição para ${endpoint}:`, error);
      
      // Melhorar mensagens de erro
      if (error.name === 'AbortError') {
        throw new Error('Timeout: Operação demorou muito para completar');
      }
      
      if (error.message.includes('Network request failed') ||
          error.message.includes('fetch')) {
        throw new Error(`Erro de conexão. Verifique se o servidor está acessível em ${this.baseUrl}`);
      }
      
      throw error;
    }
  }

  // ==================== AUTENTICAÇÃO ====================
  async login(cpf, senha) {
    try {
      console.log('🔐 Iniciando login para CPF:', cpf.replace(/\d(?=\d{4})/g, '*'));
      console.log('🌐 Conectando em:', this.baseUrl);
      
      const response = await this.makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ cpf, senha }),
      });

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

  async cadastrar(dadosUsuario) {
  try {
    console.log('📝 Iniciando cadastro para:', dadosUsuario.email);
    console.log('🌐 Conectando em:', this.baseUrl);
    
    const response = await this.makeRequest('/auth/cadastrar', {
      method: 'POST',
      body: JSON.stringify(dadosUsuario),
    });

    console.log('✅ Cadastro realizado:', response.success);
    return response;
    
  } catch (error) {
    console.error('❌ Erro no cadastro:', error.message);
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
      try {
        await this.makeRequest('/auth/logout', {
          method: 'POST',
          skipConnectivityCheck: true
        });
      } catch (error) {
        console.log('⚠️ Erro ao notificar logout no servidor (ignorado):', error.message);
      }

      await this.removeToken();
      
      console.log('✅ Logout realizado');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erro no logout:', error.message);
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
        throw error;
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
      
      if (response.success && response.pontos) {
        const ajustesResponse = await this.buscarAjustes();
        if (ajustesResponse.success) {
          const ajustes = ajustesResponse.ajustes || [];
          
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
        throw error;
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
      
      return {
        success: true,
        ajustes: [],
        message: 'Ajustes carregados do cache local'
      };
    }
  }

  async diagnosticarConexaoBuild() {
  console.log('🔬 === DIAGNÓSTICO BUILD ===');
  console.log('📱 Ambiente:', __DEV__ ? 'DESENVOLVIMENTO' : 'BUILD APK');
  console.log('🌐 URL principal:', this.baseUrl);
  console.log('📡 Constants disponível:', !!Constants);
  console.log('🔌 Network disponível:', !!Network);
  
  const resultados = {
    ambiente: __DEV__ ? 'DEV' : 'BUILD',
    urlPrincipal: this.baseUrl,
    testeUrls: [],
    rede: null,
    erro: null
  };
  
  try {
    // Testar estado da rede
    console.log('📶 Testando estado da rede...');
    const networkState = await Network.getNetworkStateAsync();
    resultados.rede = {
      connected: networkState.isConnected,
      internet: networkState.isInternetReachable,
      type: networkState.type
    };
    console.log('📶 Estado da rede:', resultados.rede);
    
    // Testar cada URL individualmente com timeout pequeno
    const urlsParaTestar = [this.baseUrl, ...this.fallbackUrls];
    
    for (const url of urlsParaTestar) {
      const testeUrl = { url, status: null, tempo: null, erro: null, sucesso: false };
      
      try {
        console.log(`🧪 Testando: ${url}`);
        const inicio = Date.now();
        
        // Timeout bem pequeno para build
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.log(`⏰ Timeout em ${url}`);
        }, 2000); // 2 segundos apenas
        
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const tempo = Date.now() - inicio;
        
        testeUrl.status = response.status;
        testeUrl.tempo = tempo;
        testeUrl.sucesso = response.ok;
        
        console.log(`${response.ok ? '✅' : '❌'} ${url} - ${response.status} (${tempo}ms)`);
        
        if (response.ok) {
          try {
            const data = await response.json();
            testeUrl.resposta = data;
            console.log('📄 Resposta:', data?.message || 'OK');
            
            // Se encontrou uma URL funcionando, atualizar a base
            if (!resultados.urlFuncionando) {
              resultados.urlFuncionando = url;
              this.baseUrl = url; // Atualizar URL base
            }
          } catch (jsonError) {
            console.log('⚠️ Erro ao ler JSON da resposta');
            testeUrl.erro = 'Erro ao ler JSON';
          }
        }
        
      } catch (error) {
        testeUrl.erro = error.message;
        console.log(`❌ ${url} - ${error.message}`);
        
        if (error.name === 'AbortError') {
          testeUrl.erro = 'Timeout';
        }
      }
      
      resultados.testeUrls.push(testeUrl);
    }
    
    // Resultado final
    const urlsFuncionando = resultados.testeUrls.filter(t => t.sucesso);
    resultados.sucesso = urlsFuncionando.length > 0;
    resultados.totalTestadas = resultados.testeUrls.length;
    resultados.funcionando = urlsFuncionando.length;
    
    console.log('🎯 === RESULTADO FINAL ===');
    console.log(`✅ URLs funcionando: ${urlsFuncionando.length}/${resultados.totalTestadas}`);
    console.log(`🌐 URL escolhida: ${resultados.urlFuncionando || 'NENHUMA'}`);
    console.log('===========================');
    
    return resultados;
    
  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    resultados.erro = error.message;
    resultados.sucesso = false;
    return resultados;
  }
}

// ✅ MÉTODO SIMPLIFICADO PARA TESTE RÁPIDO
async testeRapidoBuild() {
  try {
    console.log('⚡ Teste rápido iniciado...');
    
    // Teste direto na URL principal
    const response = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        sucesso: true,
        url: this.baseUrl,
        status: response.status,
        resposta: data
      };
    } else {
      return {
        sucesso: false,
        url: this.baseUrl,
        status: response.status,
        erro: `HTTP ${response.status}`
      };
    }
    
  } catch (error) {
    return {
      sucesso: false,
      url: this.baseUrl,
      erro: error.message
    };
  }
}

  // ==================== UTILITÁRIOS ====================
  async testarConexao() {
    try {
      console.log('🔧 Testando conexão...');
      console.log('🌐 URL atual:', this.baseUrl);
      
      const resultado = await this.verificarConectividade();
      
      return {
        success: true,
        ...resultado,
        message: `Conectado com sucesso em ${resultado.url}`
      };
      
    } catch (error) {
      console.error('❌ Falha na conexão:', error.message);
      
      return {
        success: false,
        error: error.message,
        url: this.baseUrl,
        urlsTestadas: [this.baseUrl, ...this.fallbackUrls],
        sugestoes: [
          'Verifique se o servidor está rodando',
          'Confirme se está na mesma rede WiFi',
          'Teste manualmente no navegador os IPs listados',
          'Reinicie o servidor e o aplicativo',
          'Verifique o firewall/antivirus'
        ]
      };
    }
  }

  // ✅ FORÇAR REDESCOBERTA DO IP
  async redescbrirServidor() {
    try {
      console.log('🔍 Forçando redescoberta do servidor...');
      
      const urlEncontrada = await this.testarUrls();
      
      console.log(`✅ Servidor redescoberto em: ${urlEncontrada}`);
      
      return {
        success: true,
        novaUrl: urlEncontrada,
        message: `Servidor encontrado em ${urlEncontrada}`
      };
      
    } catch (error) {
      console.error('❌ Nenhum servidor encontrado');
      
      return {
        success: false,
        error: 'Nenhum servidor acessível encontrado',
        urlsTestadas: [this.baseUrl, ...this.fallbackUrls]
      };
    }
  }

  // ✅ NOVA: Obter informações de debug melhoradas
  getDebugInfo() {
    const debuggerHost = Constants.expoConfig?.hostUri
      ? Constants.expoConfig.hostUri.split(':').shift()
      : null;
      
    return {
      apiBaseUrl: this.baseUrl,
      fallbackUrls: this.fallbackUrls,
      isDev: __DEV__,
      debuggerHost,
      expoGoUrl: Constants.expoConfig?.hostUri,
      platform: Constants.platform,
      expoVersion: Constants.expoVersion,
      deviceName: Constants.deviceName,
      sessionId: Constants.sessionId
    };
  }

  // ✅ MÉTODO PARA LOGS DETALHADOS
  async logConnectionDetails() {
    const debug = this.getDebugInfo();
    
    console.log('📋 === DETALHES DE CONEXÃO ===');
    console.log('🌐 URL principal:', debug.apiBaseUrl);
    console.log('🔄 URLs fallback:', debug.fallbackUrls);
    console.log('📱 Plataforma:', debug.platform?.os);
    console.log('🔗 Expo Go URL:', debug.expoGoUrl);
    console.log('💻 Debugger Host:', debug.debuggerHost);
    console.log('📱 Device:', debug.deviceName);
    console.log('🆔 Session:', debug.sessionId);
    console.log('===============================');
    
    return debug;
  }
}




export default new ApiService();