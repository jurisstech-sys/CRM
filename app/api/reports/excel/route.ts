import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

interface Lead {
  id: string;
  title: string;
  client_name: string;
  value: number;
  status: string;
  expected_close_date: string;
  created_at: string;
}

interface Commission {
  id: string;
  lead_id: string;
  lead_title: string;
  seller_name: string;
  amount: number;
  commission_rate: number;
  created_at: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { startDate, endDate, selectedClient, selectedSeller, clients, leads, commissions } = body;

    // Create workbook
    const workbook = new ExcelJS.Workbook();

    // Add Clients Sheet
    const clientsSheet = workbook.addWorksheet('Clientes', { properties: { tabColor: { argb: 'FF00FF00' } } });
    clientsSheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Nome', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Telefone', key: 'phone', width: 15 },
      { header: 'Data Criação', key: 'created_at', width: 15 },
    ];

    // Style header row
    clientsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    clientsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };

    // Add client data
    clients.forEach((client: Client) => {
      clientsSheet.addRow({
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone || '-',
        created_at: format(new Date(client.created_at), 'dd/MM/yyyy', { locale: ptBR }),
      });
    });

    // Add summary row
    if (clients.length > 0) {
      const summaryRow = clientsSheet.addRow({
        id: 'TOTAL',
        name: `Total de clientes: ${clients.length}`,
      });
      summaryRow.font = { bold: true };
      summaryRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7E6E6' },
      };
    }

    // Add Leads Sheet
    const leadsSheet = workbook.addWorksheet('Leads', { properties: { tabColor: { argb: 'FFFFFF00' } } });
    leadsSheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Título', key: 'title', width: 25 },
      { header: 'Cliente', key: 'client_name', width: 20 },
      { header: 'Valor (R$)', key: 'value', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Data Fechamento', key: 'expected_close_date', width: 15 },
      { header: 'Data Criação', key: 'created_at', width: 15 },
    ];

    // Style header row
    leadsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    leadsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFC55A11' },
    };

    // Add leads data
    let totalLeadsValue = 0;
    leads.forEach((lead: Lead) => {
      totalLeadsValue += lead.value || 0;
      leadsSheet.addRow({
        id: lead.id,
        title: lead.title,
        client_name: lead.client_name,
        value: lead.value || 0,
        status: lead.status,
        expected_close_date: lead.expected_close_date ? format(new Date(lead.expected_close_date), 'dd/MM/yyyy', { locale: ptBR }) : '-',
        created_at: format(new Date(lead.created_at), 'dd/MM/yyyy', { locale: ptBR }),
      });
    });

    // Add summary row
    if (leads.length > 0) {
      const summaryRow = leadsSheet.addRow({
        id: 'TOTAL',
        title: `Total de leads: ${leads.length}`,
        client_name: '',
        value: totalLeadsValue,
        status: '',
        expected_close_date: '',
        created_at: '',
      });
      summaryRow.font = { bold: true };
      summaryRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7E6E6' },
      };
      // Format value cell as currency
      summaryRow.getCell('value').numFmt = '[R$]#,##0.00';
    }

    // Format value column as currency
    leadsSheet.getColumn('value').numFmt = '[R$]#,##0.00';

    // Add Commissions Sheet
    const commissionsSheet = workbook.addWorksheet('Comissões', { properties: { tabColor: { argb: 'FF92D050' } } });
    commissionsSheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Lead', key: 'lead_title', width: 25 },
      { header: 'Vendedor', key: 'seller_name', width: 20 },
      { header: 'Taxa (%)', key: 'commission_rate', width: 12 },
      { header: 'Valor (R$)', key: 'amount', width: 15 },
      { header: 'Data', key: 'created_at', width: 15 },
    ];

    // Style header row
    commissionsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    commissionsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' },
    };

    // Add commissions data
    let totalCommissionsValue = 0;
    commissions.forEach((comm: Commission) => {
      totalCommissionsValue += comm.amount || 0;
      commissionsSheet.addRow({
        id: comm.id,
        lead_title: comm.lead_title,
        seller_name: comm.seller_name,
        commission_rate: (comm.commission_rate || 0).toFixed(2),
        amount: comm.amount || 0,
        created_at: format(new Date(comm.created_at), 'dd/MM/yyyy', { locale: ptBR }),
      });
    });

    // Add summary row
    if (commissions.length > 0) {
      const summaryRow = commissionsSheet.addRow({
        id: 'TOTAL',
        lead_title: `Total de comissões: ${commissions.length}`,
        seller_name: '',
        commission_rate: '',
        amount: totalCommissionsValue,
        created_at: '',
      });
      summaryRow.font = { bold: true };
      summaryRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7E6E6' },
      };
      // Format value cell as currency
      summaryRow.getCell('amount').numFmt = '[R$]#,##0.00';
    }

    // Format amount column as currency
    commissionsSheet.getColumn('amount').numFmt = '[R$]#,##0.00';

    // Add Summary Sheet
    const summarySheet = workbook.addWorksheet('Resumo', { properties: { tabColor: { argb: 'FF0066FF' } } });
    summarySheet.columns = [
      { header: 'Métrica', key: 'metric', width: 30 },
      { header: 'Valor', key: 'value', width: 20 },
    ];

    // Style header row
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066FF' },
    };

    // Add summary data
    summarySheet.addRow({ metric: 'Data de Início', value: startDate });
    summarySheet.addRow({ metric: 'Data de Fim', value: endDate });
    summarySheet.addRow({ metric: 'Cliente Selecionado', value: selectedClient || 'Todos' });
    summarySheet.addRow({ metric: 'Vendedor Selecionado', value: selectedSeller || 'Todos' });
    summarySheet.addRow({ metric: '', value: '' });
    summarySheet.addRow({ metric: 'Total de Clientes', value: clients.length });
    summarySheet.addRow({ metric: 'Total de Leads', value: leads.length });
    summarySheet.addRow({ metric: 'Valor Total de Leads', value: totalLeadsValue });
    summarySheet.addRow({ metric: 'Total de Comissões', value: commissions.length });
    summarySheet.addRow({ metric: 'Valor Total de Comissões', value: totalCommissionsValue });
    summarySheet.addRow({ metric: 'Data de Geração', value: format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) });

    // Format currency columns
    summarySheet.getColumn('value').numFmt = '[R$]#,##0.00';

    // Generate buffer
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="relatorio_${Date.now()}.xlsx"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating Excel:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar Excel' },
      { status: 500 }
    );
  }
}
