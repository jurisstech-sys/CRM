const https = require('https');

const url = 'https://krmbhkmgifiwvzhcvivj.supabase.co/auth/v1/token?grant_type=password';
const newKey = 'sb_publishable_u7cO10MMo2L0xUXWFCpAUg_8e8Ki3y8';

const data = JSON.stringify({
  email: 'contato@juriss.com.br',
  password: 'Juris@1711'
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': newKey,
    'Content-Length': data.length
  }
};

const req = https.request(url, options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      console.log('Response:', JSON.parse(responseData));
    } catch {
      console.log('Response:', responseData);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.write(data);
req.end();
