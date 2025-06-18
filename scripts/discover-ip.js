const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Procurar por IPv4 não interno
      if (iface.family === 'IPv4' && !iface.internal) {
        // Priorizar redes WiFi/Ethernet comuns
        if (iface.address.startsWith('192.168.') || 
            iface.address.startsWith('10.') || 
            iface.address.startsWith('172.')) {
          console.log(`🌐 IP encontrado: ${iface.address} (interface: ${name})`);
          return iface.address;
        }
      }
    }
  }
  
  return 'localhost';
}

const localIP = getLocalIP();
console.log('\n📱 Configure seu app.json e API service com:');
console.log(`IP: ${localIP}`);
console.log(`URL completa: http://${localIP}:3000`);
console.log('\n🔧 Para testar a conectividade:');
console.log(`curl http://${localIP}:3000/health`);
console.log(`ou abra no navegador: http://${localIP}:3000/health`);

module.exports = { getLocalIP };