import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
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

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    // Stream to buffer
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));

    // Add header
    doc.fontSize(24).font('Helvetica-Bold').text('JurisIA CRM', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Relatório Completo de Dados', { align: 'center' });
    doc.moveDown(0.5);

    // Add generation date and filters
    doc.fontSize(10).font('Helvetica');
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`);
    doc.text(`Período: ${startDate} a ${endDate}`);
    if (selectedClient) doc.text(`Cliente: ${selectedClient}`);
    if (selectedSeller) doc.text(`Vendedor ID: ${selectedSeller}`);
    doc.moveDown(1);

    // Summary Section
    doc.fontSize(14).font('Helvetica-Bold').text('📊 RESUMO EXECUTIVO');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    const totalLeadsValue = leads.reduce((sum: number, l: Lead) => sum + (l.value || 0), 0);
    const totalCommissions = commissions.reduce((sum: number, c: Commission) => sum + (c.amount || 0), 0);

    doc.fontSize(11).font('Helvetica');
    doc.text(`Total de Clientes: ${clients.length}`, 70);
    doc.text(`Total de Leads: ${leads.length}`, 70);
    doc.text(`Total de Comissões: ${commissions.length}`, 70);
    doc.text(`Valor Total de Leads: R$ ${totalLeadsValue.toFixed(2)}`, 70);
    doc.text(`Valor Total de Comissões: R$ ${totalCommissions.toFixed(2)}`, 70);
    doc.moveDown(1);

    // Clients Section
    if (clients.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('👥 CLIENTES');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      // Table headers
      doc.fontSize(10).font('Helvetica-Bold');
      const colX = { name: 60, email: 200, phone: 350, date: 450 };
      doc.text('Nome', colX.name);
      doc.text('Email', colX.email);
      doc.text('Telefone', colX.phone);
      doc.text('Data', colX.date);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);

      // Table rows
      doc.fontSize(9).font('Helvetica');
      clients.forEach((client: Client) => {
        if (doc.y > 700) {
          doc.addPage();
          doc.fontSize(9).font('Helvetica');
        }
        doc.text(client.name.substring(0, 25), colX.name);
        doc.text(client.email.substring(0, 25), colX.email);
        doc.text(client.phone || '-', colX.phone);
        doc.text(format(new Date(client.created_at), 'dd/MM/yyyy', { locale: ptBR }), colX.date);
        doc.moveDown(0.4);
      });
      doc.moveDown(0.5);
    }

    // Leads Section
    if (leads.length > 0) {
      if (doc.y > 650) doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('🎯 LEADS');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      // Table headers
      doc.fontSize(10).font('Helvetica-Bold');
      const leadColX = { title: 60, client: 180, value: 280, status: 380, date: 450 };
      doc.text('Lead', leadColX.title);
      doc.text('Cliente', leadColX.client);
      doc.text('Valor', leadColX.value);
      doc.text('Status', leadColX.status);
      doc.text('Data', leadColX.date);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);

      // Table rows
      doc.fontSize(9).font('Helvetica');
      leads.forEach((lead: Lead) => {
        if (doc.y > 700) {
          doc.addPage();
          doc.fontSize(9).font('Helvetica');
        }
        doc.text(lead.title.substring(0, 15), leadColX.title);
        doc.text(lead.client_name.substring(0, 15), leadColX.client);
        doc.text(`R$ ${(lead.value || 0).toFixed(2)}`, leadColX.value);
        doc.text(lead.status, leadColX.status);
        doc.text(format(new Date(lead.created_at), 'dd/MM/yyyy', { locale: ptBR }), leadColX.date);
        doc.moveDown(0.4);
      });
      doc.moveDown(0.5);
    }

    // Commissions Section
    if (commissions.length > 0) {
      if (doc.y > 650) doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('💰 COMISSÕES');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      // Table headers
      doc.fontSize(10).font('Helvetica-Bold');
      const commColX = { lead: 60, seller: 180, rate: 280, amount: 380, date: 450 };
      doc.text('Lead', commColX.lead);
      doc.text('Vendedor', commColX.seller);
      doc.text('Taxa %', commColX.rate);
      doc.text('Valor', commColX.amount);
      doc.text('Data', commColX.date);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);

      // Table rows
      doc.fontSize(9).font('Helvetica');
      commissions.forEach((comm: Commission) => {
        if (doc.y > 700) {
          doc.addPage();
          doc.fontSize(9).font('Helvetica');
        }
        doc.text(comm.lead_title.substring(0, 15), commColX.lead);
        doc.text(comm.seller_name.substring(0, 15), commColX.seller);
        doc.text(`${(comm.commission_rate || 0).toFixed(1)}%`, commColX.rate);
        doc.text(`R$ ${(comm.amount || 0).toFixed(2)}`, commColX.amount);
        doc.text(format(new Date(comm.created_at), 'dd/MM/yyyy', { locale: ptBR }), commColX.date);
        doc.moveDown(0.4);
      });
      doc.moveDown(0.5);
    }

    // Footer
    if (doc.y < 100) doc.addPage();
    doc.fontSize(9).font('Helvetica');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);
    doc.text('Este é um documento confidencial. Gerado automaticamente pelo JurisIA CRM.', { align: 'center' });

    // Finalize PDF
    const pdfPromise = new Promise<Response>((resolve) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(
          new NextResponse(pdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="relatorio_${Date.now()}.pdf"`,
            },
          })
        );
      });
      doc.end();
    });

    return await pdfPromise;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar PDF' },
      { status: 500 }
    );
  }
}
