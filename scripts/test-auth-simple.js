const https = require('https');

const url = 'https://krmbhkmgifiwvzhcvivj.supabase.co/auth/v1/token?grant_type=password';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtybWJoa21naWZpd3d6aGN2aXZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTA5NzQsImV4cCI6MjA5MDg4Njk3NH0.SvaoFww4A_LxQtVCC4ET8T9tixQjjXJbGEFGJwTXI8A';

const data = JSON.stringify({
  email: 'contato@juriss.com.br',
  password: 'Juris@1711'
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': anonKey,
    'Content-Length': data.length
  }
};

const req = https.request(url, options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', responseData);
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.write(data);
req.end();
