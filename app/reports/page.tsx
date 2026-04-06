'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download, FileText, Sheet } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePermissions } from '@/hooks/usePermissions';

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

export default function ReportsPage() {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);

  const { isAdmin, canViewFullReports, userId, loading: permLoading } = usePermissions();

  // Initialize dates (last 30 days)
  useEffect(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    
    if (!permLoading) {
      fetchInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permLoading]);

  // Fetch sellers from users table
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      interface UserData {
        id: string;
        full_name: string | null;
        email: string | null;
      }
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, email')
        .order('email', { ascending: true });

      if (usersData) {
        setSellers((usersData as UserData[]).map(u => ({ id: u.id, name: u.full_name || u.email || 'Unknown' })));
      }
    } catch (error) {
      console.error('Error fetching sellers:', error);
      toast.error('Erro ao carregar vendedores');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch clients - filtered by role
      let clientsQuery = supabase
        .from('clients')
        .select('id, name, email, phone, created_at');

      if (!isAdmin && userId) {
        clientsQuery = clientsQuery.eq('created_by', userId);
      }
      if (startDate) {
        clientsQuery = clientsQuery.gte('created_at', startDate);
      }
      if (endDate) {
        clientsQuery = clientsQuery.lte('created_at', endDate);
      }

      const { data: clientsData } = await clientsQuery;
      setClients(clientsData || []);

      // Fetch leads - filtered by role
      let leadsQuery = supabase
        .from('leads')
        .select('id, title, client_name, value, status, expected_close_date, created_at');

      if (!isAdmin && userId) {
        leadsQuery = leadsQuery.eq('created_by', userId);
      }
      if (selectedClient) {
        leadsQuery = leadsQuery.eq('client_name', selectedClient);
      }
      if (startDate) {
        leadsQuery = leadsQuery.gte('created_at', startDate);
      }
      if (endDate) {
        leadsQuery = leadsQuery.lte('created_at', endDate);
      }

      const { data: leadsData } = await leadsQuery;
      setLeads(leadsData || []);

      // Fetch commissions - filtered by role
      let commissionsQuery = supabase
        .from('commissions')
        .select(`
          id,
          lead_id,
          lead:leads(title),
          seller_id,
          seller:users(full_name, email),
          amount,
          commission_rate,
          created_at
        `);

      if (!isAdmin && userId) {
        commissionsQuery = commissionsQuery.eq('user_id', userId);
      }
      if (selectedSeller && canViewFullReports) {
        commissionsQuery = commissionsQuery.eq('seller_id', selectedSeller);
      }
      if (startDate) {
        commissionsQuery = commissionsQuery.gte('created_at', startDate);
      }
      if (endDate) {
        commissionsQuery = commissionsQuery.lte('created_at', endDate);
      }

      const { data: commissionsData } = await commissionsQuery;
      interface CommissionData {
        id: string;
        lead_id: string;
        lead?: { title: string };
        seller?: { full_name: string | null; email: string | null };
        amount: number;
        commission_rate: number;
        created_at: string;
      }
      const formattedCommissions = ((commissionsData as unknown as CommissionData[]) || []).map((c: CommissionData) => ({
        id: c.id,
        lead_id: c.lead_id,
        lead_title: c.lead?.title || 'Unknown',
        seller_name: c.seller?.full_name || c.seller?.email || 'Unknown',
        amount: c.amount,
        commission_rate: c.commission_rate,
        created_at: c.created_at,
      }));
      setCommissions(formattedCommissions);

      toast.success('Dados carregados com sucesso!');
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const forceDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Small delay to ensure download starts before cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 250);
  };

  const handleGeneratePDF = async () => {
    try {
      setGeneratingPdf(true);
      const response = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          selectedClient,
          selectedSeller,
          clients,
          leads,
          commissions,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Falha ao gerar PDF');
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const filename = `relatorio_completo_${format(new Date(), 'dd_MM_yyyy')}.pdf`;
      forceDownload(blob, filename);

      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleGenerateExcel = async () => {
    try {
      setGeneratingExcel(true);
      const response = await fetch('/api/reports/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          selectedClient,
          selectedSeller,
          clients,
          leads,
          commissions,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Falha ao gerar Excel');
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `relatorio_dados_${format(new Date(), 'dd_MM_yyyy')}.xlsx`;
      forceDownload(blob, filename);

      toast.success('Excel gerado com sucesso!');
    } catch (error) {
      console.error('Error generating Excel:', error);
      toast.error('Erro ao gerar Excel');
    } finally {
      setGeneratingExcel(false);
    }
  };

  const uniqueClients = [...new Set(leads.map(l => l.client_name))];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-gray-400 mt-2">
            {canViewFullReports
              ? 'Gere relatórios completos em PDF e Excel com os dados filtrados'
              : 'Gere relatórios dos seus dados em PDF e Excel'}
          </p>
        </div>

        {/* Filters Section */}
        <Card className="p-6 border-gray-700 bg-slate-900">
          <h2 className="text-xl font-semibold mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Data Início</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Data Fim</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cliente</label>
              <Select value={selectedClient || 'all'} onValueChange={(v) => setSelectedClient(v === 'all' ? '' : v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueClients.filter(c => c && c.trim() !== '').map(client => (
                    <SelectItem key={client} value={client}>
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Seller filter only visible to admins */}
            {canViewFullReports && (
              <div>
                <label className="text-sm font-medium">Vendedor</label>
                <Select value={selectedSeller || 'all'} onValueChange={(v) => setSelectedSeller(v === 'all' ? '' : v)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {sellers.map(seller => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={fetchData}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Carregando...
                </>
              ) : (
                'Carregar Dados'
              )}
            </Button>
          </div>
        </Card>

        {/* Export Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-gray-700 bg-slate-900 hover:bg-slate-800 transition cursor-pointer">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">PDF Completo</h3>
              <FileText className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-sm text-gray-400 mb-4">Relatório completo com tabelas, gráficos e resumos</p>
            <Button
              onClick={handleGeneratePDF}
              disabled={generatingPdf || clients.length === 0}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {generatingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Gerar PDF
                </>
              )}
            </Button>
          </Card>

          <Card className="p-4 border-gray-700 bg-slate-900 hover:bg-slate-800 transition cursor-pointer">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Excel Clientes</h3>
              <Sheet className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-gray-400 mb-4">Dados de clientes em planilha Excel</p>
            <Button
              onClick={handleGenerateExcel}
              disabled={generatingExcel || clients.length === 0}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {generatingExcel ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Gerar Excel
                </>
              )}
            </Button>
          </Card>

          <Card className="p-4 border-gray-700 bg-slate-900 hover:bg-slate-800 transition cursor-pointer">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Excel Leads</h3>
              <Sheet className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-gray-400 mb-4">Dados de leads e comissões em planilha</p>
            <Button
              onClick={handleGenerateExcel}
              disabled={generatingExcel || leads.length === 0}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {generatingExcel ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Gerar Excel
                </>
              )}
            </Button>
          </Card>
        </div>

        {/* Data Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4 border-gray-700 bg-slate-900">
            <h3 className="font-semibold mb-2">Resumo de Dados</h3>
            <div className="space-y-2">
              <p className="text-sm"><span className="font-medium">Clientes:</span> {clients.length}</p>
              <p className="text-sm"><span className="font-medium">Leads:</span> {leads.length}</p>
              <p className="text-sm"><span className="font-medium">Comissões:</span> {commissions.length}</p>
              <p className="text-sm"><span className="font-medium">Total Comissões:</span> R$ {commissions.reduce((sum, c) => sum + (c.amount || 0), 0).toFixed(2)}</p>
            </div>
          </Card>
        </div>

        {/* Clients Preview */}
        {clients.length > 0 && (
          <Card className="p-6 border-gray-700 bg-slate-900">
            <h2 className="text-xl font-semibold mb-4">Preview - Clientes ({clients.length})</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Data Criação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.slice(0, 5).map(client => (
                    <TableRow key={client.id} className="border-gray-700">
                      <TableCell>{client.name}</TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>{client.phone || '-'}</TableCell>
                      <TableCell>{format(new Date(client.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {clients.length > 5 && (
                <p className="text-sm text-gray-400 mt-2">... e mais {clients.length - 5} clientes</p>
              )}
            </div>
          </Card>
        )}

        {/* Leads Preview */}
        {leads.length > 0 && (
          <Card className="p-6 border-gray-700 bg-slate-900">
            <h2 className="text-xl font-semibold mb-4">Preview - Leads ({leads.length})</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead>Título</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Criação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.slice(0, 5).map(lead => (
                    <TableRow key={lead.id} className="border-gray-700">
                      <TableCell>{lead.title}</TableCell>
                      <TableCell>{lead.client_name}</TableCell>
                      <TableCell>R$ {(lead.value || 0).toFixed(2)}</TableCell>
                      <TableCell>{lead.status}</TableCell>
                      <TableCell>{format(new Date(lead.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {leads.length > 5 && (
                <p className="text-sm text-gray-400 mt-2">... e mais {leads.length - 5} leads</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
