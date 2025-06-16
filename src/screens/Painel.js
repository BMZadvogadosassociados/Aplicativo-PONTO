import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ApiService from '../services/api';

export default function PainelRH() {
  const [ajustes, setAjustes] = useState([]);
  const [loading, setLoading] = useState(false);

  const carregarAjustes = async () => {
    setLoading(true);
    try {
      const response = await ApiService.makeRequest('/ajustes', { method: 'GET' });
      if (response.success) {
        setAjustes(response.ajustes);
      } else {
        Alert.alert('Erro', 'Não foi possível carregar os ajustes.');
      }
    } catch (error) {
      Alert.alert('Erro', error.message);
    }
    setLoading(false);
  };

  const responderAjuste = async (id, status) => {
    const respostaRH = status === 'aprovado' ? 'Ajuste aprovado' : 'Ajuste recusado';
    try {
      await ApiService.makeRequest(`/ajustes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, respostaRH }),
      });
      carregarAjustes();
    } catch (error) {
      Alert.alert('Erro ao responder', error.message);
    }
  };

  useEffect(() => {
    carregarAjustes();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" style={{ flex: 1 }} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Solicitações de Ajuste de Ponto</Text>
      <FlatList
        data={ajustes}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>CPF: {item.cpf}</Text>
            <Text>Motivo: {item.motivo}</Text>
            <Text>Novo Horário: {new Date(item.novoHorario).toLocaleString()}</Text>
            <Text>Status: {item.status}</Text>

            {item.status === 'pendente' && (
              <View style={styles.acoes}>
                <TouchableOpacity style={styles.aprovar} onPress={() => responderAjuste(item._id, 'aprovado')}>
                  <Text style={styles.botaoTexto}>Aprovar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejeitar} onPress={() => responderAjuste(item._id, 'rejeitado')}>
                  <Text style={styles.botaoTexto}>Rejeitar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  titulo: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  card: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 8, marginBottom: 15 },
  acoes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  aprovar: { backgroundColor: '#28a745', padding: 10, borderRadius: 5 },
  rejeitar: { backgroundColor: '#dc3545', padding: 10, borderRadius: 5 },
  botaoTexto: { color: '#fff', fontWeight: 'bold' },
});
