import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import ApiService from '../services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HomeScreen() {
  const router = useRouter();
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [pontosHoje, setPontosHoje] = useState([]);
  const [usuarioLogado, setUsuarioLogado] = useState({ nome: 'Carregando...' });
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const animBotao = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      setHoraAtual(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    carregarDadosIniciais();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      carregarPontosHoje(false);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const carregarDadosIniciais = async () => {
    try {
      await carregarDadosLocais();
      await carregarDadosAPI();
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
    }
  };

  const carregarDadosLocais = async () => {
    try {
      const dadosUsuarioCache = await AsyncStorage.getItem('dadosUsuario');
      if (dadosUsuarioCache) {
        const usuario = JSON.parse(dadosUsuarioCache);
        setUsuarioLogado(usuario);
      }

      const pontosCache = await AsyncStorage.getItem('pontosHojeBackup');
      if (pontosCache) {
        const pontos = JSON.parse(pontosCache);
        setPontosHoje(pontos);
      }
    } catch (error) {
      console.error('Erro ao carregar dados locais:', error);
    }
  };

  const carregarDadosAPI = async () => {
    try {
      const [usuarioPromise, pontosPromise] = await Promise.allSettled([
        carregarUsuarioLogado(),
        carregarPontosHoje(false),
      ]);

      if (usuarioPromise.status === 'rejected') {
        console.log('⚠️ Erro ao carregar usuário da API, usando cache');
      }
      if (pontosPromise.status === 'rejected') {
        console.log('⚠️ Erro ao carregar pontos da API, usando cache');
      }
    } catch (error) {
      console.error('Erro ao carregar dados da API:', error);
    }
  };

  const carregarUsuarioLogado = async () => {
    try {
      const response = await Promise.race([
        ApiService.verificarToken(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
      ]);

      if (response.success && response.usuario) {
        setUsuarioLogado(response.usuario);
        await AsyncStorage.setItem('dadosUsuario', JSON.stringify(response.usuario));
      }
    } catch (error) {
      console.log('⚠️ Usando dados em cache do usuário');
    }
  };

    const carregarPontosHoje = async (mostrarLoading = true) => {
    if (mostrarLoading) {
      setCarregandoDados(true);
    }

    try {
      const [pontosResponse, ajustesResponse] = await Promise.all([
        Promise.race([
          ApiService.buscarPontosHoje(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000)),
        ]),
        Promise.race([
          ApiService.buscarAjustes(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000)),
        ]).catch(() => ({ success: false, ajustes: [] })) // Não falhar se ajustes não carregarem
      ]);

      if (pontosResponse.success && pontosResponse.pontos) {
        let pontosProcessados = pontosResponse.pontos;

        // 🔧 Aplicar ajustes aprovados
        if (ajustesResponse.success && ajustesResponse.ajustes) {
          pontosProcessados = aplicarAjustesAosPontos(pontosProcessados, ajustesResponse.ajustes);
        }

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setPontosHoje(pontosProcessados);
        await AsyncStorage.setItem('pontosHojeBackup', JSON.stringify(pontosProcessados));
      }
    } catch (error) {
      console.log('⚠️ Usando pontos em cache');
    } finally {
      if (mostrarLoading) {
        setCarregandoDados(false);
      }
    }
  };

    const aplicarAjustesAosPontos = (pontos, ajustes) => {
    return pontos.map(ponto => {
      // Buscar ajustes aprovados para este ponto
      const ajusteAprovado = ajustes.find(ajuste => 
        ajuste.pontoId === (ponto.id || ponto._id) && 
        ajuste.status === 'aprovado'
      );

      if (ajusteAprovado) {
        return {
          ...ponto,
          dataHora: ajusteAprovado.novoHorario, // Usar horário ajustado
          horarioOriginal: ponto.dataHora, // Manter referência do original
          ajustado: true
        };
      }

      return ponto;
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await carregarDadosAPI();
    setRefreshing(false);
  };

  const logout = async () => {
    Alert.alert('Logout', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([
              'token',
              'dadosUsuario',
              'biometricCredentials',
              'biometricEnabled',
            ]);
            await ApiService.logout();
            router.replace('/');
          } catch (error) {
            console.error('Erro no logout:', error);
            router.replace('/');
          }
        },
      },
    ]);
  };

  const formatarHora = (data) => {
    return data.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatarData = (data) => {
    return data.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const obterProximoTipoPonto = () => {
    if (pontosHoje.length === 0) return 'entrada';
    const tiposJaMarcados = pontosHoje.map((ponto) => ponto.tipo);
    const sequenciaPontos = ['entrada', 'saida_almoco', 'entrada_almoco', 'saida'];
    for (const tipo of sequenciaPontos) {
      if (!tiposJaMarcados.includes(tipo)) return tipo;
    }
    return null;
  };

  const marcarPonto = () => {
    const status = obterStatusPonto();
    if (status.desabilitado) {
      Alert.alert('Parabéns!', 'Todos os pontos do dia já foram registrados.');
      return;
    }

    Animated.sequence([
      Animated.timing(animBotao, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animBotao, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    router.push({
      pathname: '/clockinout',
      params: {
        tipo: status.tipo,
      },
    });
  };

  const obterHorarioPorTipo = (tipo) => {
    const ponto = pontosHoje.find((ponto) => ponto.tipo === tipo);
    return ponto ? new Date(ponto.dataHora) : null;
  };

  const calcularHorasTrabalhadas = () => {
    const entrada = obterHorarioPorTipo('entrada');
    const saidaAlmoco = obterHorarioPorTipo('saida_almoco');
    const entradaAlmoco = obterHorarioPorTipo('entrada_almoco');
    const saida = obterHorarioPorTipo('saida');

    if (!entrada) return '00:00:00';

    let totalMinutos = 0;

    if (entrada && saidaAlmoco) {
      totalMinutos += Math.floor((saidaAlmoco.getTime() - entrada.getTime()) / 60000);
    } else if (entrada && !saidaAlmoco) {
      totalMinutos += Math.floor((new Date().getTime() - entrada.getTime()) / 60000);
    }

    if (entradaAlmoco && saida) {
      totalMinutos += Math.floor((saida.getTime() - entradaAlmoco.getTime()) / 60000);
    } else if (entradaAlmoco && !saida) {
      totalMinutos += Math.floor((new Date().getTime() - entradaAlmoco.getTime()) / 60000);
    }

    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:00`;
  };

  const calcularTempoAlmoco = () => {
    const saidaAlmoco = obterHorarioPorTipo('saida_almoco');
    const entradaAlmoco = obterHorarioPorTipo('entrada_almoco');

    if (!saidaAlmoco) return '--:--';

    const fimAlmoco = entradaAlmoco || new Date();
    const diff = fimAlmoco.getTime() - saidaAlmoco.getTime();
    if (diff < 0) return '--:--';

    const totalMinutos = Math.floor(diff / 60000);
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;

    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
  };

  const obterStatusPonto = () => {
    const proximoTipo = obterProximoTipoPonto();

    if (!proximoTipo) {
      return {
        tipo: null,
        texto: 'TODOS OS PONTOS MARCADOS',
        icone: 'checkmark-circle-outline',
        cor: '#28a745',
        desabilitado: true,
      };
    }

    const statusPorTipo = {
      entrada: {
        texto: 'MARCAR ENTRADA',
        icone: 'enter-outline',
        cor: '#28a745',
      },
      saida_almoco: {
        texto: 'SAÍDA PARA ALMOÇO',
        icone: 'restaurant-outline',
        cor: '#ffc107',
      },
      entrada_almoco: {
        texto: 'RETORNO DO ALMOÇO',
        icone: 'return-down-back-outline',
        cor: '#17a2b8',
      },
      saida: {
        texto: 'MARCAR SAÍDA',
        icone: 'exit-outline',
        cor: '#dc3545',
      },
    };

    return {
      tipo: proximoTipo,
      ...statusPorTipo[proximoTipo],
      desabilitado: false,
    };
  };

  const statusPonto = obterStatusPonto();
  if (carregandoDados && pontosHoje.length === 0 && usuarioLogado.nome === 'Carregando...') {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#1e5f74" />
        <Text style={styles.loadingText}>Iniciando...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.saudacao}>Olá, {usuarioLogado.nome}!</Text>
          <Text style={styles.empresa}>{usuarioLogado.empresa || 'BMZ Advogados'}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <View style={styles.perfilContainer}>
            <Ionicons name="log-out-outline" size={25} color="red" style={styles.logoutIcon} />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.cardHora}>
        <Ionicons name="time-outline" size={40} color="#1e5f74" />
        <View style={styles.horaInfo}>
          <Text style={styles.horaAtual}>{formatarHora(horaAtual)}</Text>
          <Text style={styles.dataAtual}>{formatarData(horaAtual)}</Text>
        </View>
        <Ionicons name="calendar-outline" size={20} color="#28a745" />
      </View>

      <Animated.View
        style={[
          styles.botaoMarcarPonto,
          {
            backgroundColor: statusPonto.desabilitado ? '#6c757d' : statusPonto.cor,
            opacity: statusPonto.desabilitado ? 0.7 : 1,
            transform: [{ scale: animBotao }],
          },
        ]}
      >
        <TouchableOpacity
          onPress={marcarPonto}
          disabled={statusPonto.desabilitado}
          style={styles.botaoMarcarPontoInterno}
        >
          <Ionicons name={statusPonto.icone} size={30} color="#fff" />
          <Text style={styles.botaoMarcarPontoTexto}>{statusPonto.texto}</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.cardStatus}>
        <View style={styles.cardTituloContainer}>
          <Text style={styles.cardTitulo}>Status do Dia</Text>
          <TouchableOpacity onPress={() => carregarPontosHoje(true)}>
            <Ionicons name="refresh-outline" size={20} color="#1e5f74" />
          </TouchableOpacity>
        </View>

        {[
          { label: 'Entrada', tipo: 'entrada' },
          { label: 'Saída Almoço', tipo: 'saida_almoco' },
          { label: 'Retorno Almoço', tipo: 'entrada_almoco' },
          { label: 'Saída', tipo: 'saida' },
        ].map(({ label, tipo }) => (
          <View key={tipo} style={styles.statusItem}>
            <Text style={styles.statusLabel}>{label}:</Text>
            <Text style={styles.statusValor}>
              {obterHorarioPorTipo(tipo) ? formatarHora(obterHorarioPorTipo(tipo)) : '--:--'}
            </Text>
          </View>
        ))}

        <View style={[styles.statusItem, styles.statusItemDestaque]}>
          <Text style={styles.statusLabel}>Horas Trabalhadas:</Text>
          <Text style={[styles.statusValor, styles.statusValorDestaque]}>{calcularHorasTrabalhadas()}</Text>
        </View>

        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Tempo de Almoço:</Text>
          <Text style={styles.statusValor}>{calcularTempoAlmoco()}</Text>
        </View>
      </View>

      <View style={styles.menuRapido}>
        {[
          { label: 'Histórico', icon: 'calendar-outline', path: '/history' },
          { label: 'Configurações', icon: 'settings-outline', path: '/settings' },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={styles.menuItem} onPress={() => router.push(item.path)}>
            <Ionicons name={item.icon} size={30} color="#1e5f74" />
            <Text style={styles.menuItemText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
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
  },
  saudacao: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e5f74',
  },
  empresa: {
    fontSize: 14,
    color: '#999',
  },
  perfilContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  fotoPerfil: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#1e5f74',
  },
  logoutIcon: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 2,
  },
  cardHora: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  horaInfo: {
    marginLeft: 20,
    flex: 1,
  },
  horaAtual: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e5f74',
  },
  dataAtual: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  botaoMarcarPonto: {
    marginHorizontal: 20,
    borderRadius: 15,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  botaoMarcarPontoInterno: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoMarcarPontoTexto: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  cardStatus: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTituloContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e5f74',
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusItemDestaque: {
    borderBottomWidth: 2,
    borderBottomColor: '#1e5f74',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
  },
  statusValor: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e5f74',
  },
  statusValorDestaque: {
    fontSize: 18,
    color: '#1e5f74',
  },
  menuRapido: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  menuItem: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  menuItemText: {
    fontSize: 12,
    color: '#1e5f74',
    marginTop: 5,
  },
});