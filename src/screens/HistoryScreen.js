import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ApiService from '../services/api';

// Componente para um item de ponto
const PontoItem = ({ ponto, onSolicitarAjuste }) => {
  const formatarHora = (dataHora) => {
    return new Date(dataHora).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const tiposInfo = {
    entrada: { nome: 'Entrada', cor: '#28a745', icone: 'enter-outline' },
    saida_almoco: { nome: 'Saída Almoço', cor: '#ffc107', icone: 'restaurant-outline' },
    entrada_almoco: { nome: 'Retorno Almoço', cor: '#17a2b8', icone: 'return-down-back-outline' },
    saida: { nome: 'Saída', cor: '#dc3545', icone: 'exit-outline' },
  };

  const info = tiposInfo[ponto.tipo] || {
    nome: ponto.tipo,
    cor: '#666',
    icone: 'time-outline',
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'aprovado': return '#28a745';
      case 'rejeitado': return '#dc3545';
      case 'pendente': return '#ffc107';
      default: return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'aprovado': return '✅ Ajuste aprovado';
      case 'rejeitado': return '❌ Ajuste rejeitado';
      case 'pendente': return '⏳ Ajuste em análise';
      default: return '';
    }
  };

  return (
    <View style={styles.pontoItem}>
      <View style={styles.pontoHeader}>
        <View style={[styles.tipoIndicator, { backgroundColor: info.cor }]}>
          <Ionicons name={info.icone} size={16} color="#fff" />
        </View>
        
        <View style={styles.pontoInfo}>
          <Text style={styles.pontoTipo}>{info.nome}</Text>
          
          <View style={styles.horarioContainer}>
            <Text style={styles.pontoHora}>{formatarHora(ponto.dataHora)}</Text>
            {ponto.horarioOriginal && (
              <Text style={styles.horarioOriginal}>
                (original: {formatarHora(ponto.horarioOriginal)})
              </Text>
            )}
          </View>

          {ponto.statusAjuste && (
  <View style={styles.ajusteInfo}>
    <Text style={[styles.statusAjuste, { color: getStatusColor(ponto.statusAjuste) }]}>
      {getStatusText(ponto.statusAjuste)}
    </Text>
    {ponto.respostaRH && (
      <Text style={styles.respostaRH}>RH: {ponto.respostaRH}</Text>
    )}
    {ponto.motivoAjuste && (
      <Text style={styles.motivoAjuste}>Motivo: {ponto.motivoAjuste}</Text>
    )}
  </View>
)}

<TouchableOpacity 
  onPress={() => onSolicitarAjuste(ponto)} 
  style={[
    styles.botaoAjuste,
    ponto.statusAjuste === 'pendente' && styles.botaoAjusteDisabled
  ]}
  disabled={ponto.statusAjuste === 'pendente'}
>
  <Ionicons 
    name={ponto.statusAjuste === 'pendente' ? "hourglass-outline" : "time-outline"} 
    size={16} 
    color={ponto.statusAjuste === 'pendente' ? "#999" : "#1e5f74"} 
  />
  <Text style={[
    styles.textoAjuste,
    ponto.statusAjuste === 'pendente' && styles.textoAjusteDisabled
  ]}>
    {ponto.statusAjuste === 'pendente' ? 'Aguardando análise' : 'Solicitar ajuste'}
  </Text>
</TouchableOpacity>
        </View>
      </View>

      {ponto.foto && (
        <Image source={{ uri: ponto.foto }} style={styles.pontoFoto} />
      )}

      {ponto.localizacao && (
        <View style={styles.localizacaoInfo}>
          <Ionicons name="location-outline" size={14} color="#666" />
          <Text style={styles.localizacaoTexto}>
            {ponto.localizacao.endereco || 'Localização registrada'}
          </Text>
        </View>
      )}
    </View>
  );
};

// Componente para um dia com seus pontos
const DiaItem = ({ dia, onSolicitarAjuste }) => {
  const calcularHorasTrabalhadas = (pontos) => {
    const pontosPorTipo = {};
    pontos.forEach((ponto) => {
      pontosPorTipo[ponto.tipo] = new Date(ponto.dataHora);
    });

    const entrada = pontosPorTipo['entrada'];
    const saidaAlmoco = pontosPorTipo['saida_almoco'];
    const entradaAlmoco = pontosPorTipo['entrada_almoco'];
    const saida = pontosPorTipo['saida'];

    if (!entrada) return '--:--';

    let totalMinutos = 0;

    if (entrada && saidaAlmoco) {
      totalMinutos += Math.floor((saidaAlmoco - entrada) / 60000);
    }

    if (entradaAlmoco && saida) {
      totalMinutos += Math.floor((saida - entradaAlmoco) / 60000);
    }

    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;

    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
  };

  const horasTrabalhadas = calcularHorasTrabalhadas(dia.pontos);
  const pontosCount = dia.pontos.length;
  const statusDia = pontosCount === 4 ? '✅ Completo' : `⏳ ${pontosCount}/4`;

  return (
    <View style={styles.diaContainer}>
      <View style={styles.diaHeader}>
        <View>
          <Text style={styles.diaData}>{dia.data}</Text>
          <Text style={styles.diaStatus}>{statusDia}</Text>
        </View>
        <View style={styles.diaResumo}>
          <Text style={styles.diaHoras}>{horasTrabalhadas}</Text>
          <Text style={styles.diaHorasLabel}>trabalhadas</Text>
        </View>
      </View>

      {dia.pontos.map((ponto, index) => (
        <PontoItem 
          key={`${dia.data}-${index}`} 
          ponto={ponto} 
          onSolicitarAjuste={onSolicitarAjuste}
        />
      ))}
    </View>
  );
};

// Componente do Modal de Ajuste
const ModalAjuste = ({ 
  visible, 
  ponto, 
  onClose, 
  onSubmit,
  loading 
}) => {
  const [novaHora, setNovaHora] = useState(8);
  const [novoMinuto, setNovoMinuto] = useState(0);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (ponto) {
      const dataHora = new Date(ponto.dataHora);
      setNovaHora(dataHora.getHours());
      setNovoMinuto(dataHora.getMinutes());
      setMotivo('');
    }
  }, [ponto]);

  const ajustarHora = (incremento) => {
    let nova = novaHora + incremento;
    if (nova < 0) nova = 23;
    if (nova > 23) nova = 0;
    setNovaHora(nova);
  };

  const ajustarMinuto = (incremento) => {
    let novo = novoMinuto + incremento;
    if (novo < 0) novo = 59;
    if (novo > 59) novo = 0;
    setNovoMinuto(novo);
  };

  const handleSubmit = () => {
    if (!motivo.trim() || motivo.trim().length < 10) {
      Alert.alert('Erro', 'O motivo deve ter pelo menos 10 caracteres.');
      return;
    }

    const novaData = new Date(ponto.dataHora);
    novaData.setHours(novaHora, novoMinuto, 0, 0);

    const dadosParaEnvio = {
      pontoId: ponto.id || ponto._id,
      novoHorario: novaData.toISOString(),
      motivo: motivo.trim(),
    };

    console.log('📤 Dados sendo enviados:', dadosParaEnvio);
    onSubmit(dadosParaEnvio);
  };

  if (!ponto) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Solicitar Ajuste</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.pontoInfoModal}>
              <Text style={styles.pontoInfoLabel}>Ponto selecionado:</Text>
              <Text style={styles.pontoInfoValue}>
                {ponto.tipo.replace('_', ' ').toUpperCase()}
              </Text>
              <Text style={styles.pontoInfoTime}>
                Horário atual: {new Date(ponto.dataHora).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <View style={styles.timePickerContainer}>
              <Text style={styles.timePickerLabel}>Novo horário:</Text>
              
              <View style={styles.timePicker}>
                <View style={styles.timeSelector}>
                  <TouchableOpacity onPress={() => ajustarHora(1)}>
                    <Ionicons name="chevron-up" size={24} color="#1e5f74" />
                  </TouchableOpacity>
                  <View style={styles.timeDisplay}>
                    <Text style={styles.timeValue}>
                      {novaHora.toString().padStart(2, '0')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => ajustarHora(-1)}>
                    <Ionicons name="chevron-down" size={24} color="#1e5f74" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.timeSeparator}>:</Text>

                <View style={styles.timeSelector}>
                  <TouchableOpacity onPress={() => ajustarMinuto(1)}>
                    <Ionicons name="chevron-up" size={24} color="#1e5f74" />
                  </TouchableOpacity>
                  <View style={styles.timeDisplay}>
                    <Text style={styles.timeValue}>
                      {novoMinuto.toString().padStart(2, '0')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => ajustarMinuto(-1)}>
                    <Ionicons name="chevron-down" size={24} color="#1e5f74" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.quickMinutes}>
                <Text style={styles.quickMinutesLabel}>Minutos:</Text>
                <View style={styles.quickMinutesButtons}>
                  {[0, 15, 30, 45].map((min) => (
                    <TouchableOpacity
                      key={min}
                      style={[
                        styles.quickMinuteButton,
                        novoMinuto === min && styles.quickMinuteButtonActive
                      ]}
                      onPress={() => setNovoMinuto(min)}
                    >
                      <Text style={[
                        styles.quickMinuteText,
                        novoMinuto === min && styles.quickMinuteTextActive
                      ]}>
                        {min.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.motivoContainer}>
              <Text style={styles.motivoLabel}>Motivo da alteração:</Text>
              <TextInput
                style={styles.motivoInput}
                placeholder="Explique o motivo da alteração (mínimo 10 caracteres)"
                value={motivo}
                onChangeText={setMotivo}
                multiline
                numberOfLines={4}
                maxLength={300}
                textAlignVertical="top"
                returnKeyType="done"
                blurOnSubmit={true}
              />
              <Text style={[
                styles.contadorCaracteres,
                motivo.length < 10 && styles.contadorCaracteresAlerta
              ]}>
                {motivo.length}/300 caracteres {motivo.length < 10 ? '(mínimo 10)' : ''}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (loading || motivo.trim().length < 10) && styles.submitButtonDisabled
                ]} 
                onPress={handleSubmit}
                disabled={loading || motivo.trim().length < 10}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Enviar Solicitação</Text>
                )}
              </TouchableOpacity>
            </View>
            
            {/* Espaço extra para o teclado */}
            <View style={{ height: 100 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// Componente principal
export default function HistoryScreen() {
  const router = useRouter();
  const [pontos, setPontos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [pontoSelecionado, setPontoSelecionado] = useState(null);
  const [enviandoAjuste, setEnviandoAjuste] = useState(false);

  // Função para carregar histórico
  const carregarHistorico = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      if (isRefresh) setRefreshing(true);

      console.log('📊 Carregando histórico...');

      // Verificar token primeiro
      const token = await AsyncStorage.getItem('token');
      const dadosUsuario = await AsyncStorage.getItem('dadosUsuario');
      
      console.log('🔑 Token existe:', !!token);
      console.log('👤 Dados usuário:', !!dadosUsuario);

      if (!token) {
        Alert.alert(
          'Sessão Expirada',
          'Você precisa fazer login novamente.',
          [{ text: 'OK', onPress: () => router.replace('/login') }]
        );
        return;
      }

      // Fazer apenas UMA tentativa da API
      const response = await ApiService.buscarHistorico();
      console.log('📋 Resposta da API:', response);

      if (!response) {
        throw new Error('Nenhuma resposta da API');
      }

      if (!response.success) {
        // Se for erro de token, limpar dados e voltar pro login
        if (response.message?.toLowerCase().includes('token')) {
          await AsyncStorage.multiRemove(['token', 'dadosUsuario']);
          Alert.alert(
            'Sessão Expirada',
            'Faça login novamente.',
            [{ text: 'OK', onPress: () => router.replace('/login') }]
          );
          return;
        }
        throw new Error(response.message || 'Erro ao carregar histórico');
      }

      const pontosRecebidos = Array.isArray(response.pontos) ? response.pontos : [];
      console.log('📋 Pontos recebidos:', pontosRecebidos.length);

      const pontosOrdenados = pontosRecebidos.sort(
        (a, b) => new Date(b.dataHora) - new Date(a.dataHora)
      );

      setPontos(pontosOrdenados);

      // Cache offline
      await AsyncStorage.setItem('historicoCache', JSON.stringify({
        pontos: pontosOrdenados,
        timestamp: new Date().toISOString()
      }));

      console.log('✅ Histórico carregado:', pontosOrdenados.length, 'pontos');

    } catch (error) {
      console.error('❌ Erro ao carregar histórico:', error);

      // Tentar carregar do cache
      try {
        const cache = await AsyncStorage.getItem('historicoCache');
        if (cache) {
          const dadosCache = JSON.parse(cache);
          setPontos(dadosCache.pontos || []);
          Alert.alert('Modo Offline', 'Mostrando dados salvos.');
        } else {
          // Se não tem cache, mostrar erro específico
          Alert.alert(
            'Erro',
            `Não foi possível carregar o histórico.\n\nErro: ${error.message}`,
            [
              { text: 'Tentar Novamente', onPress: () => carregarHistorico() },
              { text: 'OK' }
            ]
          );
        }
      } catch (cacheError) {
        Alert.alert(
          'Erro', 
          'Não foi possível carregar o histórico. Verifique sua conexão.'
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  // Função para agrupar pontos por data
  const agruparPontosPorData = useCallback(() => {
    if (!pontos.length) return [];

    const grupos = {};
    
    pontos.forEach((ponto) => {
      if (!ponto?.dataHora) return;
      
      const data = new Date(ponto.dataHora).toLocaleDateString('pt-BR');
      if (!grupos[data]) grupos[data] = [];
      grupos[data].push(ponto);
    });

    return Object.entries(grupos).map(([data, pontosDoDia]) => ({
      data,
      pontos: pontosDoDia,
    }));
  }, [pontos]);

  // Função para abrir modal de ajuste
  const abrirModalAjuste = useCallback((ponto) => {
    setPontoSelecionado(ponto);
    setModalVisible(true);
  }, []);

  // Função para fechar modal
  const fecharModal = useCallback(() => {
    setModalVisible(false);
    setPontoSelecionado(null);
  }, []);

  // Função para enviar solicitação de ajuste
  const enviarSolicitacao = useCallback(async (dadosAjuste) => {
  try {
    setEnviandoAjuste(true);

    const usuario = JSON.parse(await AsyncStorage.getItem('dadosUsuario') || '{}');
    
    if (!usuario.cpf) {
      Alert.alert('Erro', 'Dados do usuário não encontrados. Faça login novamente.');
      return;
    }

    const payload = {
      cpf: usuario.cpf,
      pontoId: dadosAjuste.pontoId,
      novoHorario: dadosAjuste.novoHorario,
      motivo: dadosAjuste.motivo,
    };

    console.log('📝 Enviando ajuste:', payload);

    const response = await ApiService.solicitarAjuste(payload);

    if (response.success) {
      Alert.alert(
        'Sucesso', 
        response.offline ? 
          'Solicitação salva localmente. Será enviada quando possível.' :
          'Solicitação enviada com sucesso!'
      );
      
      // Atualizar ponto local para mostrar status pendente
      setPontos(prevPontos => 
        prevPontos.map(p => {
          const pontoId = p.id || p._id;
          if (pontoId === dadosAjuste.pontoId) {
            return { 
              ...p, 
              statusAjuste: 'pendente',
              motivoAjuste: dadosAjuste.motivo 
            };
          }
          return p;
        })
      );
      
      fecharModal();
      
      // Recarregar histórico após 2 segundos se não for offline
      if (!response.offline) {
        setTimeout(() => carregarHistorico(false), 2000);
      }
      
    } else {
      Alert.alert('Erro', response.message || 'Falha ao enviar solicitação.');
    }
  } catch (error) {
    console.error('❌ Erro ao enviar ajuste:', error);
    Alert.alert('Erro', `Não foi possível enviar a solicitação: ${error.message}`);
  } finally {
    setEnviandoAjuste(false);
  }
}, [carregarHistorico, fecharModal]);

  // Carregar dados ao montar o componente
  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  // Componente de loading
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e5f74" />
        <Text style={styles.loadingText}>Carregando histórico...</Text>
      </View>
    );
  }

  // Componente de lista vazia
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>Nenhum ponto registrado</Text>
      <Text style={styles.emptySubtext}>Seus pontos aparecerão aqui</Text>
      <TouchableOpacity 
        style={styles.botaoRecarregar} 
        onPress={() => carregarHistorico()}
      >
        <Text style={styles.textoRecarregar}>Tentar novamente</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e5f74" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Histórico de Pontos</Text>
        <TouchableOpacity onPress={() => carregarHistorico(true)}>
          <Ionicons name="refresh-outline" size={22} color="#1e5f74" />
        </TouchableOpacity>
      </View>

      {/* Lista */}
      <FlatList
        data={agruparPontosPorData()}
        keyExtractor={(item) => item.data}
        renderItem={({ item }) => (
          <DiaItem dia={item} onSolicitarAjuste={abrirModalAjuste} />
        )}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => carregarHistorico(true)}
            colors={['#1e5f74']}
            tintColor="#1e5f74"
          />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {/* Modal de Ajuste */}
      <ModalAjuste
        visible={modalVisible}
        ponto={pontoSelecionado}
        onClose={fecharModal}
        onSubmit={enviarSolicitacao}
        loading={enviandoAjuste}
      />
    </View>
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
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  motivoAjuste: {
  fontSize: 11,
  color: '#888',
  marginTop: 2,
  fontStyle: 'italic',
},
textoAjusteDisabled: {
  color: '#999',
},
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e5f74',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  botaoRecarregar: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1e5f74',
    borderRadius: 8,
  },
  textoRecarregar: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  diaContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  diaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  diaData: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  diaStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  diaResumo: {
    alignItems: 'flex-end',
  },
  diaHoras: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e5f74',
  },
  diaHorasLabel: {
    fontSize: 12,
    color: '#666',
  },
  pontoItem: {
    marginBottom: 12,
  },
  pontoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipoIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pontoInfo: {
    flex: 1,
  },
  pontoTipo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  horarioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  pontoHora: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e5f74',
  },
  horarioOriginal: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  ajusteInfo: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
  },
  statusAjuste: {
    fontSize: 12,
    fontWeight: '600',
  },
  respostaRH: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  botaoAjuste: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  botaoAjusteDisabled: {
    opacity: 0.6,
  },
  textoAjuste: {
    fontSize: 12,
    color: '#1e5f74',
    marginLeft: 4,
  },
  pontoFoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginTop: 8,
  },
  localizacaoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  localizacaoTexto: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    padding: 20,
  },
  pontoInfoModal: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  pontoInfoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  pontoInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  pontoInfoTime: {
    fontSize: 14,
    color: '#1e5f74',
    marginTop: 4,
  },
  timePickerContainer: {
    marginBottom: 24,
  },
  timePickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  timePicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeSelector: {
    alignItems: 'center',
  },
  timeDisplay: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  timeValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e5f74',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e5f74',
    marginHorizontal: 16,
  },
  quickMinutes: {
    alignItems: 'center',
  },
  quickMinutesLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  quickMinutesButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  quickMinuteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  quickMinuteButtonActive: {
    backgroundColor: '#1e5f74',
  },
  quickMinuteText: {
    fontSize: 14,
    color: '#666',
  },
  quickMinuteTextActive: {
    color: '#fff',
  },
  motivoContainer: {
    marginBottom: 24,
  },
  motivoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  motivoInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  contadorCaracteres: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1e5f74',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});