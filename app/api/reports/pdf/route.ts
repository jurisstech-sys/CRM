import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';

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

function generatePDF(
  startDate: string,
  endDate: string,
  selectedClient: string,
  selectedSeller: string,
  clients: Client[],
  leads: Lead[],
  commissions: Commission[]
): Uint8Array {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > 270) {
      doc.addPage();
      y = 20;
    }
  };

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('JurisIA CRM - Relatorio Completo', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.text(`Periodo: ${startDate || 'N/A'} a ${endDate || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  if (selectedClient) {
    doc.text(`Cliente: ${selectedClient}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }
  if (selectedSeller) {
    doc.text(`Vendedor ID: ${selectedSeller}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }
  y += 6;

  // Summary
  const totalLeadsValue = leads.reduce((sum: number, l: Lead) => sum + (l.value || 0), 0);
  const totalCommissions = commissions.reduce((sum: number, c: Commission) => sum + (c.amount || 0), 0);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo Executivo', 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryItems = [
    `Total de Clientes: ${clients.length}`,
    `Total de Leads: ${leads.length}`,
    `Total de Comissoes: ${commissions.length}`,
    `Valor Total de Leads: R$ ${totalLeadsValue.toFixed(2)}`,
    `Valor Total de Comissoes: R$ ${totalCommissions.toFixed(2)}`,
  ];
  summaryItems.forEach((item) => {
    doc.text(item, 14, y);
    y += 5;
  });
  y += 8;

  // Clients table
  if (clients.length > 0) {
    checkPage(20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Clientes', 14, y);
    y += 7;

    // Table header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(68, 114, 196);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y - 4, pageWidth - 28, 6, 'F');
    doc.text('Nome', 16, y);
    doc.text('Email', 60, y);
    doc.text('Telefone', 120, y);
    doc.text('Data', 165, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    clients.forEach((client: Client) => {
      checkPage(6);
      doc.text((client.name || '').substring(0, 20), 16, y);
      doc.text((client.email || '').substring(0, 28), 60, y);
      doc.text((client.phone || '-').substring(0, 18), 120, y);
      try {
        doc.text(format(new Date(client.created_at), 'dd/MM/yyyy', { locale: ptBR }), 165, y);
      } catch {
        doc.text('-', 165, y);
      }
      y += 5;
    });
    y += 8;
  }

  // Leads table
  if (leads.length > 0) {
    checkPage(20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Leads', 14, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(197, 90, 17);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y - 4, pageWidth - 28, 6, 'F');
    doc.text('Lead', 16, y);
    doc.text('Cliente', 55, y);
    doc.text('Valor', 100, y);
    doc.text('Status', 135, y);
    doc.text('Data', 165, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    leads.forEach((lead: Lead) => {
      checkPage(6);
      doc.text((lead.title || '').substring(0, 18), 16, y);
      doc.text((lead.client_name || '').substring(0, 18), 55, y);
      doc.text(`R$ ${(lead.value || 0).toFixed(2)}`, 100, y);
      doc.text((lead.status || '').substring(0, 12), 135, y);
      try {
        doc.text(format(new Date(lead.created_at), 'dd/MM/yyyy', { locale: ptBR }), 165, y);
      } catch {
        doc.text('-', 165, y);
      }
      y += 5;
    });
    y += 8;
  }

  // Commissions table
  if (commissions.length > 0) {
    checkPage(20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Comissoes', 14, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(112, 173, 71);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y - 4, pageWidth - 28, 6, 'F');
    doc.text('Lead', 16, y);
    doc.text('Vendedor', 55, y);
    doc.text('Taxa %', 105, y);
    doc.text('Valor', 135, y);
    doc.text('Data', 165, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    commissions.forEach((comm: Commission) => {
      checkPage(6);
      doc.text((comm.lead_title || '').substring(0, 18), 16, y);
      doc.text((comm.seller_name || '').substring(0, 18), 55, y);
      doc.text(`${(comm.commission_rate || 0).toFixed(1)}%`, 105, y);
      doc.text(`R$ ${(comm.amount || 0).toFixed(2)}`, 135, y);
      try {
        doc.text(format(new Date(comm.created_at), 'dd/MM/yyyy', { locale: ptBR }), 165, y);
      } catch {
        doc.text('-', 165, y);
      }
      y += 5;
    });
  }

  // Footer
  checkPage(20);
  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Este e um documento confidencial. Gerado automaticamente pelo JurisIA CRM.', pageWidth / 2, y, { align: 'center' });

  // Get PDF as Uint8Array
  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { startDate, endDate, selectedClient, selectedSeller, clients, leads, commissions } = body;

    const pdfBuffer = generatePDF(
      startDate,
      endDate,
      selectedClient,
      selectedSeller,
      clients || [],
      leads || [],
      commissions || []
    );

    return new Response(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="relatorio_${Date.now()}.pdf"`,
        'Content-Length': String(pdfBuffer.byteLength),
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
