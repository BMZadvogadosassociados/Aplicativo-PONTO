import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e5f74" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View />
      </View>

      <View style={styles.content}>
        <Image
          source={{ uri: 'https://via.placeholder.com/120' }}
          style={styles.fotoPerfil}
        />
        <Text style={styles.nome}>João Silva</Text>
        <Text style={styles.empresa}>BMZ Advogados</Text>
        
        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Ionicons name="mail-outline" size={20} color="#1e5f74" />
            <Text style={styles.infoTexto}>joao.silva@bmz.com.br</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Ionicons name="card-outline" size={20} color="#1e5f74" />
            <Text style={styles.infoTexto}>***.***.***-**</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Ionicons name="briefcase-outline" size={20} color="#1e5f74" />
            <Text style={styles.infoTexto}>Desenvolvedor</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.botaoSair} onPress={() => router.push('/')}>
          <Ionicons name="log-out-outline" size={20} color="#dc3545" />
          <Text style={styles.botaoSairTexto}>Sair do App</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  fotoPerfil: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#1e5f74',
    marginBottom: 20,
  },
  nome: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e5f74',
    marginBottom: 5,
  },
  empresa: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  infoContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoTexto: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  botaoSair: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  botaoSairTexto: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});