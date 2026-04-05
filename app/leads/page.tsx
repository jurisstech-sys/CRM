'use client';

import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { LeadUploader, Lead } from '@/components/leads/LeadUploader';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Upload, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface LeadPreviewData extends Lead {
  _rowIndex: number;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadPreviewData[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);

  const handleDataParsed = useCallback((parsedLeads: Lead[], uploadedFileName: string) => {
    const leadsWithIndex = parsedLeads.map((lead, index) => ({
      ...lead,
      _rowIndex: index,
    }));
    setLeads(leadsWithIndex);
    setFileName(uploadedFileName);
    setImportProgress(0);
    setImportedCount(0);
  }, []);

  const removeLeadFromPreview = (rowIndex: number) => {
    setLeads(prev => prev.filter(lead => lead._rowIndex !== rowIndex));
    toast.success('Lead removido da pré-visualização');
  };

  const getAccessToken = async (): Promise<string | null> => {
    if (!supabase) {
      toast.error('Supabase não configurado. Verifique as variáveis de ambiente.');
      return null;
    }
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      toast.error('Sessão expirada. Faça login novamente.');
      console.error('[LeadsPage] Erro ao obter sessão:', error?.message);
      return null;
    }
    return session.access_token;
  };

  const handleImport = async () => {
    if (leads.length === 0) {
      toast.error('Nenhum lead para importar. Carregue um arquivo primeiro.');
      return;
    }

    // Obter token de autenticação
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportedCount(0);

    try {
      // Importa em lotes de até 2000 leads
      const batchSize = 2000;
      let totalImported = 0;

      for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, Math.min(i + batchSize, leads.length));
        
        // Remove a propriedade _rowIndex antes de enviar
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const cleanedBatch = batch.map(({ _rowIndex, ...lead }) => lead);

        console.log(`[LeadsPage] Enviando batch ${Math.floor(i / batchSize) + 1}: ${cleanedBatch.length} leads`);

        const response = await fetch('/api/leads/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            leads: cleanedBatch,
            fileName,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('[LeadsPage] Erro na resposta:', data);
          throw new Error(data.error || 'Erro ao importar leads');
        }

        totalImported += data.count;
        setImportedCount(totalImported);
        setImportProgress(Math.min(((i + batch.length) / leads.length) * 100, 100));

        console.log(`[LeadsPage] Batch importado: ${data.count} leads. Total: ${totalImported}`);

        // Pequeno delay entre batches para evitar sobrecarga
        if (i + batchSize < leads.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      toast.success(`✅ ${totalImported} leads importados com sucesso!`);
      
      // Limpa os dados após importação bem-sucedida
      setLeads([]);
      setFileName('');
      setImportProgress(100);
      
      // Reset para novo upload após 2 segundos
      setTimeout(() => {
        setImportProgress(0);
        setImportedCount(0);
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`❌ Erro ao importar: ${errorMessage}`);
      console.error('[LeadsPage] Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              🚀 Importar Leads
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Carregue um arquivo CSV ou Excel para importar múltiplos leads em massa
            </p>
          </div>
        </div>

        {/* Uploader */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Passo 1: Selecione o arquivo
          </h2>
          <LeadUploader
            onDataParsed={handleDataParsed}
            isLoading={isImporting}
          />
        </Card>

        {/* Preview dos dados */}
        {leads.length > 0 && (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Passo 2: Pré-visualize os dados
              </h2>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {leads.length} lead{leads.length !== 1 ? 's' : ''} carregado{leads.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Tabela de preview */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Celular 1</TableHead>
                    <TableHead>Celular 2</TableHead>
                    <TableHead>Email 1</TableHead>
                    <TableHead>Email 2</TableHead>
                    <TableHead>Email 3</TableHead>
                    <TableHead className="w-[60px]">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.slice(0, 10).map((lead, idx) => (
                    <TableRow key={lead._rowIndex}>
                      <TableCell className="text-xs text-gray-500">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-gray-900 dark:text-white">
                        {lead.nome || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {lead.celular1 || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {lead.celular2 || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {lead.email1 || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {lead.email2 || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {lead.email3 || '-'}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => removeLeadFromPreview(lead._rowIndex)}
                          disabled={isImporting}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors disabled:opacity-50"
                          title="Remover da pré-visualização"
                        >
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {leads.length > 10 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 px-4">
                Mostrando 10 de {leads.length} leads. Todos serão importados.
              </p>
            )}

            {/* Barra de progresso de importação */}
            {isImporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Importando leads...
                  </h3>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {importedCount} / {leads.length}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300 ease-out"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {Math.round(importProgress)}% concluído
                </p>
              </div>
            )}

            {/* Botão de importação */}
            {!isImporting && (
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleImport}
                  disabled={leads.length === 0 || isImporting}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Importar {leads.length} Lead{leads.length !== 1 ? 's' : ''}
                </Button>
                <Button
                  onClick={() => {
                    setLeads([]);
                    setFileName('');
                  }}
                  variant="outline"
                  disabled={isImporting}
                >
                  Limpar
                </Button>
              </div>
            )}

            {/* Aviso de segurança */}
            {leads.length > 0 && !isImporting && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-medium">📌 Dica:</p>
                  <p>Revise os dados antes de importar. Você pode remover leads individualmente se necessário.</p>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Estado vazio */}
        {leads.length === 0 && fileName === '' && (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-12 w-12 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400">
                Carregue um arquivo para começar
              </p>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
