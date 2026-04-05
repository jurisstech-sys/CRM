import { NextRequest, NextResponse } from 'next/server';
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

// Lightweight PDF generator using text-based approach
function generatePDFText(
  startDate: string,
  endDate: string,
  selectedClient: string,
  selectedSeller: string,
  clients: Client[],
  leads: Lead[],
  commissions: Commission[]
): string {
  const lines: string[] = [];

  // Header
  lines.push('JurisIA CRM - Relatório Completo de Dados');
  lines.push('');
  lines.push(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`);
  lines.push(`Período: ${startDate} a ${endDate}`);
  if (selectedClient) lines.push(`Cliente: ${selectedClient}`);
  if (selectedSeller) lines.push(`Vendedor ID: ${selectedSeller}`);
  lines.push('');

  // Summary
  const totalLeadsValue = leads.reduce((sum: number, l: Lead) => sum + (l.value || 0), 0);
  const totalCommissions = commissions.reduce((sum: number, c: Commission) => sum + (c.amount || 0), 0);

  lines.push('===== RESUMO EXECUTIVO =====');
  lines.push(`Total de Clientes: ${clients.length}`);
  lines.push(`Total de Leads: ${leads.length}`);
  lines.push(`Total de Comissões: ${commissions.length}`);
  lines.push(`Valor Total de Leads: R$ ${totalLeadsValue.toFixed(2)}`);
  lines.push(`Valor Total de Comissões: R$ ${totalCommissions.toFixed(2)}`);
  lines.push('');

  // Clients Section
  if (clients.length > 0) {
    lines.push('===== CLIENTES =====');
    lines.push(
      ['Nome', 'Email', 'Telefone', 'Data Criação'].join('\t')
    );
    clients.forEach((client: Client) => {
      lines.push(
        [
          client.name.substring(0, 25),
          client.email.substring(0, 25),
          client.phone || '-',
          format(new Date(client.created_at), 'dd/MM/yyyy', { locale: ptBR }),
        ].join('\t')
      );
    });
    lines.push('');
  }

  // Leads Section
  if (leads.length > 0) {
    lines.push('===== LEADS =====');
    lines.push(
      ['Lead', 'Cliente', 'Valor', 'Status', 'Data'].join('\t')
    );
    leads.forEach((lead: Lead) => {
      lines.push(
        [
          lead.title.substring(0, 15),
          lead.client_name.substring(0, 15),
          `R$ ${(lead.value || 0).toFixed(2)}`,
          lead.status,
          format(new Date(lead.created_at), 'dd/MM/yyyy', { locale: ptBR }),
        ].join('\t')
      );
    });
    lines.push('');
  }

  // Commissions Section
  if (commissions.length > 0) {
    lines.push('===== COMISSÕES =====');
    lines.push(
      ['Lead', 'Vendedor', 'Taxa %', 'Valor', 'Data'].join('\t')
    );
    commissions.forEach((comm: Commission) => {
      lines.push(
        [
          comm.lead_title.substring(0, 15),
          comm.seller_name.substring(0, 15),
          `${(comm.commission_rate || 0).toFixed(1)}%`,
          `R$ ${(comm.amount || 0).toFixed(2)}`,
          format(new Date(comm.created_at), 'dd/MM/yyyy', { locale: ptBR }),
        ].join('\t')
      );
    });
    lines.push('');
  }

  // Footer
  lines.push('Este é um documento confidencial. Gerado automaticamente pelo JurisIA CRM.');

  return lines.join('\n');
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { startDate, endDate, selectedClient, selectedSeller, clients, leads, commissions } = body;

    // Generate PDF content as text
    const pdfContent = generatePDFText(
      startDate,
      endDate,
      selectedClient,
      selectedSeller,
      clients,
      leads,
      commissions
    );

    // For now, return as text/plain instead of PDF to avoid font issues
    // This is a temporary workaround - in production, use a proper PDF library
    const buffer = Buffer.from(pdfContent, 'utf-8');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="relatorio_${Date.now()}.txt"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      {
        error: 'Erro ao gerar PDF',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
