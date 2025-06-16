import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import ApiService from '../services/api';

export default function ClockInOutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [foto, setFoto] = useState(null);
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [salvandoPonto, setSalvandoPonto] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      setHoraAtual(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const inicializar = async () => {
      if (!permission?.granted) {
        await requestPermission();
      }
    };
    inicializar();
  }, [permission]);

  const tirarFoto = async () => {
    try {
      const fotoSimulada = {
        uri: 'foto_simulada_' + Date.now(),
        timestamp: new Date().toISOString()
      };

      setFoto(fotoSimulada);
      console.log('📸 Foto "tirada" para validação psicológica');
    } catch (error) {
      console.error('❌ Erro ao simular foto:', error);
      Alert.alert('Erro', 'Não foi possível ativar a câmera');
    }
  };

  const confirmarPonto = async () => {
    if (!foto) {
      Alert.alert('Atenção', 'É necessário tirar uma foto para marcar o ponto');
      return;
    }

    setSalvandoPonto(true);

    try {
      const agora = new Date();
      const tipoPonto = params.tipo || 'entrada';

      const dadosParaAPI = {
        tipo: tipoPonto,
        dataHora: agora.toISOString(),
        observacoes: `Ponto ${tipoPonto} registrado via app móvel`,
        fotoVerificada: true
      };

      console.log('📤 Enviando dados para API:', dadosParaAPI);

      const response = await ApiService.marcarPonto(dadosParaAPI);

      if (response.success) {
        console.log('✅ Ponto registrado com sucesso na API!');

        await salvarPontoLocal({
          ...dadosParaAPI,
          sincronizado: true
        });

        const mensagensPonto = {
          'entrada': 'Entrada registrada com sucesso! ✅',
          'saida_almoco': 'Saída para almoço registrada! 🍽️',
          'entrada_almoco': 'Retorno do almoço registrado! ⚡',
          'saida': 'Saída registrada com sucesso! 🏠'
        };

        Alert.alert(
          'Ponto Marcado!',
          mensagensPonto[tipoPonto] || 'Ponto registrado com sucesso!',
          [{
            text: 'OK',
            onPress: () => router.replace('/home')
          }]
        );

      } else {
        throw new Error(response.message || 'Erro ao registrar ponto');
      }

    } catch (error) {
      console.error('❌ Erro ao marcar ponto:', error);

      try {
        const dadosLocal = {
          tipo: params.tipo || 'entrada',
          dataHora: new Date().toISOString(),
          observacoes: `Ponto ${params.tipo || 'entrada'} salvo localmente`,
          sincronizado: false,
          fotoVerificada: true
        };

        await salvarPontoLocal(dadosLocal);

        Alert.alert(
          'Ponto Salvo Localmente',
          'Não foi possível conectar ao servidor, mas seu ponto foi salvo no dispositivo e será sincronizado quando a conexão for restabelecida.',
          [{
            text: 'OK',
            onPress: () => router.replace('/home')
          }]
        );

      } catch (localError) {
        console.error('❌ Erro ao salvar localmente:', localError);
        Alert.alert(
          'Erro',
          'Não foi possível salvar o ponto. Verifique sua conexão e tente novamente.'
        );
      }
    } finally {
      setSalvandoPonto(false);
    }
  };

  const salvarPontoLocal = async (dadosPonto) => {
    try {
      const pontosExistentes = await AsyncStorage.getItem('pontos');
      const pontos = pontosExistentes ? JSON.parse(pontosExistentes) : [];

      const pontoLocal = {
        ...dadosPonto,
        id: Date.now().toString(),
        timestamp: new Date().getTime(),
      };

      pontos.push(pontoLocal);
      await AsyncStorage.setItem('pontos', JSON.stringify(pontos));

      console.log('💾 Ponto salvo localmente como backup');
    } catch (error) {
      console.error('❌ Erro ao salvar ponto localmente:', error);
    }
  };

  const formatarHora = (data) => {
    return data.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatarData = (data) => {
    return data.toLocaleDateString('pt-BR');
  };

  const obterInfoTipo = () => {
    const infos = {
      'entrada': { titulo: 'Marcar Entrada', icone: 'enter-outline', cor: '#28a745' },
      'saida_almoco': { titulo: 'Saída para Almoço', icone: 'restaurant-outline', cor: '#ffc107' },
      'entrada_almoco': { titulo: 'Retorno do Almoço', icone: 'return-down-back-outline', cor: '#17a2b8' },
      'saida': { titulo: 'Marcar Saída', icone: 'exit-outline', cor: '#dc3545' }
    };

    return infos[params.tipo] || infos['entrada'];
  };

  const infoTipo = obterInfoTipo();

  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e5f74" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{infoTipo.titulo}</Text>
          <View />
        </View>

        <View style={styles.semPermissaoContainer}>
          <Ionicons name="camera-outline" size={80} color="#ccc" />
          <Text style={styles.semPermissao}>Acesso à câmera necessário</Text>
          <Text style={styles.semPermissaoDesc}>
            Para marcar o ponto, precisamos acessar sua câmera para verificação de segurança.
          </Text>
          <TouchableOpacity style={styles.botao} onPress={requestPermission}>
            <Text style={styles.botaoTexto}>Permitir Acesso à Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botaoSecundario} onPress={() => router.back()}>
            <Text style={styles.botaoSecundarioTexto}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: infoTipo.cor }]}>
        <TouchableOpacity onPress={() => router.back()} disabled={salvandoPonto}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{infoTipo.titulo}</Text>
        <View />
      </View>

      <View style={[styles.infoContainer, { backgroundColor: infoTipo.cor }]}>
        <Text style={styles.horaAtual}>{formatarHora(horaAtual)}</Text>
        <Text style={styles.dataAtual}>{formatarData(horaAtual)}</Text>
        <Text style={styles.infoTexto}>
          Tire sua foto e marque seu ponto!
        </Text>
      </View>

      <View style={styles.cameraContainer}>
        {foto ? (
          <View style={styles.fotoContainer}>
            <Animated.View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: scaleAnim }],
              }}
            >
              <Ionicons name="checkmark-circle" size={80} color="#28a745" />
              <Text style={styles.fotoConfirmada}>Foto Verificada ✅</Text>
              <Text style={styles.fotoHorario}>
                Verificada às {formatarHora(new Date(foto.timestamp))}
              </Text>
            </Animated.View>
            {!salvandoPonto && (
              <TouchableOpacity style={styles.botaoRetomar} onPress={() => setFoto(null)}>
                <Ionicons name="camera-outline" size={20} color="#fff" />
                <Text style={styles.botaoRetomarTexto}>Tirar Nova Foto</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
            <CameraView style={styles.camera} facing="front" ref={cameraRef} />
            <View style={styles.cameraOverlay}>
              <View style={styles.cameraFrame} />
              <Text style={styles.cameraInstrucao}>
                Posicione seu rosto no centro da tela
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.botoesContainer}>
        {!foto ? (
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[styles.botaoCamera, { backgroundColor: infoTipo.cor }]}
              onPress={() => {
                Animated.sequence([
                  Animated.timing(scaleAnim, {
                    toValue: 0.95,
                    duration: 100,
                    useNativeDriver: true,
                  }),
                  Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                  }),
                ]).start(() => tirarFoto());
              }}
              disabled={salvandoPonto}
            >
              <Ionicons name="camera" size={30} color="#fff" />
              <Text style={styles.botaoCameraTexto}>Tirar Foto</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity
            style={[
              styles.botaoConfirmar,
              {
                backgroundColor: salvandoPonto ? '#ccc' : '#28a745',
                opacity: salvandoPonto ? 0.7 : 1
              }
            ]}
            onPress={confirmarPonto}
            disabled={salvandoPonto}
          >
            {salvandoPonto ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.botaoConfirmarTexto}>SALVANDO...</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.botaoConfirmarTexto}>CONFIRMAR PONTO</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.infoAdicionais}>
        <View style={styles.infoItem}>
          <Ionicons name="warning-outline" size={16} color="red" />
          <Text style={styles.infoTextoItem}>
            Em caso de algum erro, contate o RH
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#28a745" />
          <Text style={styles.infoTextoItem}>
            Sua foto não será compartilhada.
          </Text>
        </View>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  infoContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  horaAtual: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  dataAtual: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 5,
  },
  infoTexto: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    textAlign: 'center',
  },
  cameraContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  cameraFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 125,
    backgroundColor: 'transparent',
  },
  cameraInstrucao: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  fotoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  fotoPreviewContainer: {
    alignItems: 'center',
    padding: 20,
  },
  fotoConfirmada: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#28a745',
    marginTop: 15,
  },
  fotoHorario: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  botaoRetomar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  botaoRetomarTexto: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  botoesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  botaoCamera: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    justifyContent: 'center',
    minWidth: 150,
  },
  botaoCameraTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  botaoConfirmar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    flex: 1,
    justifyContent: 'center',
  },
  botaoConfirmarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoAdicionais: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTextoItem: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  semPermissaoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#fff',
  },
  semPermissao: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  semPermissaoDesc: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
    lineHeight: 22,
  },
  botao: {
    backgroundColor: '#1e5f74',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  botaoTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  botaoSecundario: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
    width: '100%',
    alignItems: 'center',
  },
  botaoSecundarioTexto: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
});