import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import ApiService from '../services/api';
import BiometricService from '../services/BiometricService';
import NotificationService from '../services/NotificationService';

export default function SettingsScreen() {
  const router = useRouter();
  const [usuario, setUsuario] = useState({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  
  // Estados para edição de perfil
  const [modoEdicao, setModoEdicao] = useState(false);
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [email, setEmail] = useState('');
  
  // Estados para alteração de senha
  const [mostrarAlterarSenha, setMostrarAlterarSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenhas, setMostrarSenhas] = useState(false);
  
  // Estados para configurações
  const [notificacoes, setNotificacoes] = useState(true);
  const [modoEscuro, setModoEscuro] = useState(false);
  const [sincronizacaoAuto, setSincronizacaoAuto] = useState(true);
  const [biometriaHabilitada, setBiometriaHabilitada] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState(null);

  useEffect(() => {
    carregarDadosUsuario();
    carregarConfiguracoes();
    verificarBiometria();
  }, []);

  const verificarBiometria = async () => {
    try {
      const status = await BiometricService.getFullStatus();
      setBiometricStatus(status);
      setBiometriaHabilitada(status.isEnabled);
      console.log('🔐 Status biometria nas configurações:', status);
    } catch (error) {
      console.error('❌ Erro ao verificar biometria:', error);
    }
  };

  const carregarDadosUsuario = async () => {
    try {
      setLoading(true);
      
      // Tentar buscar dados atualizados da API
      const response = await ApiService.verificarToken();
      
      if (response.success && response.usuario) {
        setUsuario(response.usuario);
        setNome(response.usuario.nome);
        setSobrenome(response.usuario.sobrenome);
        setEmail(response.usuario.email);
      } else {
        // Fallback para dados locais
        const dadosLocais = await AsyncStorage.getItem('dadosUsuario');
        if (dadosLocais) {
          const usuarioLocal = JSON.parse(dadosLocais);
          setUsuario(usuarioLocal);
          setNome(usuarioLocal.nome);
          setSobrenome(usuarioLocal.sobrenome);
          setEmail(usuarioLocal.email);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados do usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarConfiguracoes = async () => {
    try {
      const configs = await AsyncStorage.getItem('configuracoes');
      if (configs) {
        const configObj = JSON.parse(configs);
        setNotificacoes(configObj.notificacoes ?? true);
        setModoEscuro(configObj.modoEscuro ?? false);
        setSincronizacaoAuto(configObj.sincronizacaoAuto ?? true);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar configurações:', error);
    }
  };

  const salvarConfiguracoes = async (novasConfigs) => {
    try {
      const configs = {
        notificacoes,
        modoEscuro,
        sincronizacaoAuto,
        ...novasConfigs
      };
      
      await AsyncStorage.setItem('configuracoes', JSON.stringify(configs));
    } catch (error) {
      console.error('❌ Erro ao salvar configurações:', error);
    }
  };

  const toggleBiometria = async (value) => {
    try {
      if (value) {
        // Habilitar biometria
        if (!biometricStatus?.isSupported) {
          Alert.alert(
            'Biometria Indisponível',
            'Seu dispositivo não suporta autenticação biométrica ou não tem nenhuma biometria cadastrada.',
            [{ text: 'OK' }]
          );
          return;
        }

        // Configurar biometria
        const cpfUsuario = usuario.cpf;
        const token = await AsyncStorage.getItem('token');
        
        if (!cpfUsuario || !token) {
          Alert.alert('Erro', 'Dados de usuário não encontrados. Faça login novamente.');
          return;
        }

        const sucesso = await BiometricService.setupBiometric(cpfUsuario, token);
        
        if (sucesso) {
          setBiometriaHabilitada(true);
          await verificarBiometria();
        }
      } else {
        // Desabilitar biometria
        Alert.alert(
          'Desabilitar Biometria',
          'Tem certeza que deseja desabilitar a autenticação biométrica?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Desabilitar',
              style: 'destructive',
              onPress: async () => {
                await BiometricService.clearCredentials();
                setBiometriaHabilitada(false);
                await verificarBiometria();
                Alert.alert('Biometria Desabilitada', 'Autenticação biométrica foi desabilitada.');
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Erro ao configurar biometria:', error);
      Alert.alert('Erro', 'Não foi possível configurar a biometria');
    }
  };

  const salvarPerfil = async () => {
    if (!nome.trim() || !sobrenome.trim() || !email.trim()) {
      Alert.alert('Erro', 'Todos os campos são obrigatórios');
      return;
    }

    setSalvando(true);
    
    try {
      const dadosPerfil = {
        nome: nome.trim(),
        sobrenome: sobrenome.trim(),
        email: email.trim()
      };

      const response = await ApiService.atualizarPerfil(dadosPerfil);
      
      if (response.success) {
        setUsuario(response.usuario);
        setModoEdicao(false);
        Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
      } else {
        throw new Error(response.message || 'Erro ao atualizar perfil');
      }
      
    } catch (error) {
      console.error('❌ Erro ao salvar perfil:', error);
      
      let mensagemErro = 'Não foi possível atualizar o perfil';
      
      if (error.message.includes('email já está sendo usado')) {
        mensagemErro = 'Este email já está sendo usado por outro usuário';
      } else if (error.message.includes('Token inválido')) {
        mensagemErro = 'Sua sessão expirou. Faça login novamente.';
        setTimeout(() => router.replace('/'), 2000);
      } else if (error.message.includes('fetch')) {
        mensagemErro = 'Erro de conexão. Verifique sua internet.';
      }
      
      Alert.alert('Erro', mensagemErro);
    } finally {
      setSalvando(false);
    }
  };

  const alterarSenha = async () => {
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      Alert.alert('Erro', 'Todos os campos de senha são obrigatórios');
      return;
    }

    if (novaSenha.length < 6) {
      Alert.alert('Erro', 'A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }

    setSalvando(true);
    
    try {
      const dadosSenha = {
        senhaAtual,
        novaSenha
      };

      const response = await ApiService.alterarSenha(dadosSenha);
      
      if (response.success) {
        setSenhaAtual('');
        setNovaSenha('');
        setConfirmarSenha('');
        setMostrarAlterarSenha(false);
        
        Alert.alert('Sucesso', 'Senha alterada com sucesso!');
      } else {
        throw new Error(response.message || 'Erro ao alterar senha');
      }
      
    } catch (error) {
      console.error('❌ Erro ao alterar senha:', error);
      
      let mensagemErro = 'Não foi possível alterar a senha';
      
      if (error.message.includes('Senha atual incorreta')) {
        mensagemErro = 'A senha atual está incorreta';
      } else if (error.message.includes('nova senha deve ser diferente')) {
        mensagemErro = 'A nova senha deve ser diferente da senha atual';
      } else if (error.message.includes('Token inválido')) {
        mensagemErro = 'Sua sessão expirou. Faça login novamente.';
        setTimeout(() => router.replace('/'), 2000);
      } else if (error.message.includes('fetch')) {
        mensagemErro = 'Erro de conexão. Verifique sua internet.';
      }
      
      Alert.alert('Erro', mensagemErro);
    } finally {
      setSalvando(false);
    }
  };

  const sincronizarDados = async () => {
    setSalvando(true);
    
    try {
      await ApiService.sincronizarDadosOffline();
      Alert.alert('Sucesso', 'Dados sincronizados com sucesso!');
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      Alert.alert('Erro', 'Falha na sincronização de dados');
    } finally {
      setSalvando(false);
    }
  };

  const limparCache = async () => {
    Alert.alert(
      'Limpar Cache',
      'Isso irá remover todos os dados em cache. Tem certeza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                'pontosHojeBackup',
                'historicoCache'
              ]);
              Alert.alert('Sucesso', 'Cache limpo com sucesso!');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível limpar o cache');
            }
          }
        }
      ]
    );
  };

  const logout = async () => {
    Alert.alert(
      'Logout',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          onPress: async () => {
            try {
              await ApiService.logout();
              router.replace('/');
            } catch (error) {
              console.error('Erro no logout:', error);
              router.replace('/');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e5f74" />
        <Text style={styles.loadingText}>Carregando configurações...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e5f74" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configurações</Text>
        <View />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Seção do Perfil */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Perfil</Text>
          
          <View style={styles.perfilContainer}>
         <Image source={require('../assets/logo.png')} style={styles.fotoPerfil} />
            <View style={styles.perfilInfo}>
              <Text style={styles.nomeUsuario}>
                {usuario.nome} {usuario.sobrenome}
              </Text>
              <Text style={styles.emailUsuario}>{usuario.email}</Text>
              <Text style={styles.empresaUsuario}>{usuario.empresa}</Text>
            </View>
          </View>

          {!modoEdicao ? (
            <TouchableOpacity
              style={styles.botaoSecundario}
              onPress={() => setModoEdicao(true)}
            >
              <Ionicons name="pencil-outline" size={20} color="#1e5f74" />
              <Text style={styles.botaoSecundarioTexto}>Editar Perfil</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.formularioEdicao}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Nome</Text>
                <TextInput
                  style={styles.input}
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Seu nome"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Sobrenome</Text>
                <TextInput
                  style={styles.input}
                  value={sobrenome}
                  onChangeText={setSobrenome}
                  placeholder="Seu sobrenome"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Seu email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.botoesEdicao}>
                <TouchableOpacity
                  style={styles.botaoCancelar}
                  onPress={() => {
                    setModoEdicao(false);
                    setNome(usuario.nome);
                    setSobrenome(usuario.sobrenome);
                    setEmail(usuario.email);
                  }}
                >
                  <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.botaoPrimario, { opacity: salvando ? 0.7 : 1 }]}
                  onPress={salvarPerfil}
                  disabled={salvando}
                >
                  {salvando ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.botaoPrimarioTexto}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Seção de Segurança */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Segurança</Text>
          
          {/* Biometria */}
          {biometricStatus?.isSupported && (
            <View style={styles.opcaoItem}>
              <View style={styles.opcaoInfo}>
                <Ionicons 
                  name={biometricStatus.types.faceId ? "scan-outline" : "finger-print-outline"} 
                  size={24} 
                  color="#1e5f74" 
                />
                <View>
                  <Text style={styles.opcaoTexto}>{biometricStatus.biometricName}</Text>
                  <Text style={styles.opcaoDescricao}>
                    {biometriaHabilitada ? 'Autenticação ativa' : 'Login rápido com biometria'}
                  </Text>
                </View>
              </View>
              <Switch
                value={biometriaHabilitada}
                onValueChange={toggleBiometria}
                trackColor={{ false: '#ccc', true: '#1e5f74' }}
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.opcaoItem}
            onPress={() => setMostrarAlterarSenha(!mostrarAlterarSenha)}
          >
            <View style={styles.opcaoInfo}>
              <Ionicons name="lock-closed-outline" size={24} color="#1e5f74" />
              <Text style={styles.opcaoTexto}>Alterar Senha</Text>
            </View>
            <Ionicons 
              name={mostrarAlterarSenha ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#666" 
            />
          </TouchableOpacity>

          {mostrarAlterarSenha && (
            <View style={styles.formularioSenha}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Senha Atual</Text>
                <View style={styles.inputSenhaContainer}>
                  <TextInput
                    style={styles.inputSenha}
                    value={senhaAtual}
                    onChangeText={setSenhaAtual}
                    placeholder="Digite sua senha atual"
                    secureTextEntry={!mostrarSenhas}
                  />
                  <TouchableOpacity onPress={() => setMostrarSenhas(!mostrarSenhas)}>
                    <Ionicons 
                      name={mostrarSenhas ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color="#666" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Nova Senha</Text>
                <TextInput
                  style={styles.input}
                  value={novaSenha}
                  onChangeText={setNovaSenha}
                  placeholder="Digite a nova senha"
                  secureTextEntry={!mostrarSenhas}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirmar Nova Senha</Text>
                <TextInput
                  style={styles.input}
                  value={confirmarSenha}
                  onChangeText={setConfirmarSenha}
                  placeholder="Confirme a nova senha"
                  secureTextEntry={!mostrarSenhas}
                />
              </View>

              <TouchableOpacity
                style={[styles.botaoPrimario, { opacity: salvando ? 0.7 : 1 }]}
                onPress={alterarSenha}
                disabled={salvando}
              >
                {salvando ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.botaoPrimarioTexto}>Alterar Senha</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Seção de Preferências */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Preferências</Text>
          
          <View style={styles.opcaoItem}>
            <View style={styles.opcaoInfo}>
              <Ionicons name="notifications-outline" size={24} color="#1e5f74" />
              <View>
                <Text style={styles.opcaoTexto}>Notificações</Text>
                <Text style={styles.opcaoDescricao}>Receber lembretes de ponto</Text>
              </View>
            </View>
           <Switch
  value={notificacoes}
  onValueChange={async (value) => {
    setNotificacoes(value);
    salvarConfiguracoes({ notificacoes: value });
    
    // Conectar com o NotificationService
    if (value) {
      const success = await NotificationService.initialize();
      if (success) {
        Alert.alert('✅ Ativado', 'Você receberá notificações sobre seus ajustes de ponto.');
      } else {
        Alert.alert('❌ Erro', 'Não foi possível ativar as notificações. Verifique as permissões.');
        setNotificacoes(false);
        salvarConfiguracoes({ notificacoes: false });
      }
    } else {
      Alert.alert('🔕 Desativado', 'Você não receberá mais notificações de ajustes.');
    }
  }}
  trackColor={{ false: '#ccc', true: '#1e5f74' }}
/>
          </View>

          <View style={styles.opcaoItem}>
            <View style={styles.opcaoInfo}>
              <Ionicons name="moon-outline" size={24} color="#1e5f74" />
              <View>
                <Text style={styles.opcaoTexto}>Modo Escuro</Text>
                <Text style={styles.opcaoDescricao}>Ainda não implementado.</Text>
              </View>
            </View>
            <Switch
              value={false}
            />
          </View>

          <View style={styles.opcaoItem}>
            <View style={styles.opcaoInfo}>
              <Ionicons name="sync-outline" size={24} color="#1e5f74" />
              <View>
                <Text style={styles.opcaoTexto}>Sincronização Automática</Text>
                <Text style={styles.opcaoDescricao}>Sincronizar dados automaticamente</Text>
              </View>
            </View>
            <Switch
              value={sincronizacaoAuto}
              onValueChange={(value) => {
                setSincronizacaoAuto(value);
                salvarConfiguracoes({ sincronizacaoAuto: value });
              }}
              trackColor={{ false: '#ccc', true: '#1e5f74' }}
            />
          </View>
        </View>

        {/* Seção de Dados */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Dados</Text>
          
          <TouchableOpacity style={styles.opcaoItem}>
            <View style={styles.opcaoInfo}>
              <Ionicons name="cloud-upload-outline" size={24} color="#1e5f74" />
              <Text style={styles.opcaoTexto}>Sincronizar Dados (WIP)</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.opcaoItem} onPress={limparCache}>
            <View style={styles.opcaoInfo}>
              <Ionicons name="trash-outline" size={24} color="#ff6b6b" />
              <Text style={[styles.opcaoTexto, { color: '#ff6b6b' }]}>Limpar Cache</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

          {/* Seção de Teste de Notificações */}
        {notificacoes && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Teste de Notificações</Text>
            
            <TouchableOpacity 
              style={styles.opcaoItem} 
              onPress={async () => {
                try {
                  await NotificationService.testNotification();
                  Alert.alert('🎉 BMZ Advogados Associados', 'Suas notificações estão funcionando corretamente!');
                } catch (error) {
                  Alert.alert('❌ Erro', 'Não foi possível testar as notificações.');
                }
              }}
            >
              <View style={styles.opcaoInfo}>
                <Ionicons name="flask-outline" size={24} color="#1e5f74" />
                <Text style={styles.opcaoTexto}>Testar Notificação</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        )}

        {/* Seção de Informações */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Informações</Text>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Versão do App:</Text>
            <Text style={styles.infoValor}>1.0.0</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Empresa:</Text>
            <Text style={styles.infoValor}>{usuario.empresa || 'BMZ Advogados'}</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>CPF:</Text>
            <Text style={styles.infoValor}>
              {usuario.cpf ? usuario.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : 'N/A'}
            </Text>
          </View>

          {biometricStatus && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Biometria:</Text>
              <Text style={styles.infoValor}>
                {biometricStatus.isSupported ? biometricStatus.biometricName : 'Não suportada'}
              </Text>
            </View>
          )}
        </View>

        {/* Botão de Logout */}
        <TouchableOpacity style={styles.botaoLogout} onPress={logout}>
          <Ionicons name="log-out-outline" size={24} color="#dc3545" />
          <Text style={styles.botaoLogoutTexto}>Sair do App</Text>
        </TouchableOpacity>

        <View style={styles.espacoFinal} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e5f74',
  },
  content: {
    flex: 1,
  },
  secao: {
    backgroundColor: '#fff',
    marginTop: 15,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  secaoTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e5f74',
    marginBottom: 15,
  },
  perfilContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  fotoPerfil: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#1e5f74',
  },
  perfilInfo: {
    marginLeft: 20,
    flex: 1,
  },
  nomeUsuario: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  emailUsuario: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  empresaUsuario: {
    fontSize: 14,
    color: '#1e5f74',
    marginTop: 2,
  },
  botaoSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e5f74',
  },
  botaoSecundarioTexto: {
    color: '#1e5f74',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  formularioEdicao: {
    marginTop: 20,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputSenhaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    paddingHorizontal: 15,
  },
  inputSenha: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  botoesEdicao: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  botaoCancelar: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc3545',
    alignItems: 'center',
  },
  botaoCancelarTexto: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: 'bold',
  },
  botaoPrimario: {
    flex: 1,
    backgroundColor: '#1e5f74',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  botaoPrimarioTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formularioSenha: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  opcaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  opcaoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  opcaoTexto: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  opcaoDescricao: {
    fontSize: 14,
    color: '#666',
    marginLeft: 15,
    marginTop: 2,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValor: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  botaoLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 15,
    paddingVertical: 20,
    marginHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  botaoLogoutTexto: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  espacoFinal: {
    height: 30,
  },
});