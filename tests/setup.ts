// Test environment setup
process.env.TZ = 'America/Tegucigalpa';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Avoid noisy logs during tests
const mute = ['Servidor corriendo en puerto'];
const origLog = console.log;
console.log = (...args: any[]) => {
  const s = args.join(' ');
  if (mute.some((m) => s.includes(m))) return;
  origLog(...args);
};

