/**
 * Script para testar os endpoints de relatórios
 */

// Dados mock para testes
const testData = {
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  selectedClient: '',
  selectedSeller: '',
  clients: [
    {
      id: 'test-client-1',
      name: 'Cliente Teste',
      email: 'cliente@teste.com',
      phone: '+55 11 98765-4321',
      created_at: new Date().toISOString(),
    },
  ],
  leads: [
    {
      id: 'test-lead-1',
      title: 'Lead Teste',
      client_name: 'Cliente Teste',
      value: 1000,
      status: 'aberto',
      expected_close_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ],
  commissions: [
    {
      id: 'test-comm-1',
      lead_id: 'test-lead-1',
      lead_title: 'Lead Teste',
      seller_name: 'Vendedor Teste',
      amount: 100,
      commission_rate: 10,
      created_at: new Date().toISOString(),
    },
  ],
};

async function testPDF() {
  console.log('\n📄 Testando geração de PDF...');
  try {
    const response = await fetch('http://localhost:3000/api/reports/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ ERRO no PDF:', error);
      return false;
    }

    const blob = await response.blob();
    console.log(`✅ PDF gerado com sucesso! Tamanho: ${blob.size} bytes`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao testar PDF:', error.message);
    return false;
  }
}

async function testExcel() {
  console.log('\n📊 Testando geração de Excel...');
  try {
    const response = await fetch('http://localhost:3000/api/reports/excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ ERRO no Excel:', error);
      return false;
    }

    const blob = await response.blob();
    console.log(`✅ Excel gerado com sucesso! Tamanho: ${blob.size} bytes`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao testar Excel:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Iniciando testes de relatórios...');
  console.log('Esperando que o servidor esteja rodando em http://localhost:3000\n');

  const pdfSuccess = await testPDF();
  const excelSuccess = await testExcel();

  console.log('\n📋 RESUMO DOS TESTES:');
  console.log(`  PDF:   ${pdfSuccess ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`  Excel: ${excelSuccess ? '✅ OK' : '❌ FALHOU'}`);

  process.exit(pdfSuccess && excelSuccess ? 0 : 1);
}

runTests();
