'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PapaParseModule = any;
const Papa = require('papaparse') as PapaParseModule;

export interface Lead {
  nome?: string;
  celular1?: string;
  celular2?: string;
  email1?: string;
  email2?: string;
  email3?: string;
  [key: string]: any;
}

interface LeadUploaderProps {
  onDataParsed: (data: Lead[], fileName: string) => void;
  isLoading?: boolean;
}

export const LeadUploader = ({ onDataParsed, isLoading = false }: LeadUploaderProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string>('');

  const ACCEPTED_COLUMNS = ['nome', 'celular1', 'celular2', 'email1', 'email2', 'email3'];

  const validateColumns = (headers: string[]): { valid: boolean; missing: string[] } => {
    // Apenas aceita as colunas esperadas, sem obrigatoriedade
    return {
      valid: true,
      missing: [],
    };
  };

  const parseCSV = (file: File, text: string): Promise<Lead[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        complete: (results: any) => {
          if (results.data.length === 0) {
            reject(new Error('Arquivo CSV está vazio'));
            return;
          }

          const headers = Object.keys(results.data[0] || {});
          const validation = validateColumns(headers);

          if (!validation.valid) {
            reject(
              new Error(
                `Colunas obrigatórias faltando: ${validation.missing.join(', ')}`
              )
            );
            return;
          }

          const leads: Lead[] = (results.data as Record<string, string>[])
            .filter(row => row.nome) // Apenas filtra linhas sem NOME
            .map(row => ({
              nome: String(row.nome || '').trim(),
              celular1: String(row.celular1 || '').trim(),
              celular2: String(row.celular2 || '').trim(),
              email1: String(row.email1 || '').trim(),
              email2: String(row.email2 || '').trim(),
              email3: String(row.email3 || '').trim(),
            }));

          resolve(leads);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (error: any) => {
          reject(new Error(`Erro ao fazer parse do CSV: ${error.message}`));
        },
      });
    });
  };

  const parseExcel = (file: File, arrayBuffer: ArrayBuffer): Promise<Lead[]> => {
    return new Promise((resolve, reject) => {
      try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];

        if (!worksheet) {
          reject(new Error('Nenhuma planilha encontrada no arquivo Excel'));
          return;
        }

        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
          reject(new Error('Arquivo Excel está vazio'));
          return;
        }

        const headers = Object.keys(data[0] || {});
        const validation = validateColumns(headers);

        if (!validation.valid) {
          reject(
            new Error(
              `Colunas obrigatórias faltando: ${validation.missing.join(', ')}`
            )
          );
          return;
        }

        const leads: Lead[] = (data as any[])
          .filter(row => row.nome) // Apenas filtra linhas sem NOME
          .map(row => ({
            nome: String(row.nome || '').trim(),
            celular1: String(row.celular1 || '').trim(),
            celular2: String(row.celular2 || '').trim(),
            email1: String(row.email1 || '').trim(),
            email2: String(row.email2 || '').trim(),
            email3: String(row.email3 || '').trim(),
          }));

        resolve(leads);
      } catch (error) {
        reject(
          new Error(
            `Erro ao fazer parse do Excel: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
          )
        );
      }
    });
  };

  const handleFile = async (file: File) => {
    setParseError('');
    setUploadedFileName('');

    // Validar tipo de arquivo
    const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
    const isExcel =
      file.type ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls');

    if (!isCSV && !isExcel) {
      const error = 'Por favor, selecione um arquivo CSV ou Excel';
      setParseError(error);
      toast.error(error);
      return;
    }

    try {
      let leads: Lead[] = [];

      if (isCSV) {
        const text = await file.text();
        leads = await parseCSV(file, text);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        leads = await parseExcel(file, arrayBuffer);
      }

      setUploadedFileName(file.name);
      toast.success(`✅ ${leads.length} leads carregados com sucesso!`);
      onDataParsed(leads, file.name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setParseError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <div
        className={`relative rounded-lg border-2 border-dashed transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-300 dark:border-gray-600'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          accept=".csv,.xlsx,.xls"
          onChange={handleChange}
          disabled={isLoading}
          className="hidden"
        />

        <label
          htmlFor="file-upload"
          className="flex flex-col items-center justify-center gap-4 p-8 cursor-pointer"
        >
          <Upload className="h-12 w-12 text-gray-400" />
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              Arraste seu arquivo aqui ou clique para selecionar
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Aceita CSV ou Excel (XLSX, XLS)
            </p>
          </div>
        </label>
      </div>

      {/* Arquivo carregado com sucesso */}
      {uploadedFileName && !parseError && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950 p-3 border border-green-200 dark:border-green-800">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            Arquivo carregado: <span className="font-semibold">{uploadedFileName}</span>
          </span>
        </div>
      )}

      {/* Erro ao carregar arquivo */}
      {parseError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950 p-3 border border-red-200 dark:border-red-800">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Erro ao processar arquivo
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{parseError}</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              ℹ️ Certifique-se que seu arquivo contém as colunas: <span className="font-semibold">NOME, CELULAR1, CELULAR2, E-MAIL1, E-MAIL2, E-MAIL3</span>
            </p>
          </div>
        </div>
      )}

      {/* Instruções de colunas esperadas */}
      <div className="mt-6 rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
          📋 Colunas esperadas no arquivo:
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• <span className="font-mono">NOME</span> - Nome do lead (obrigatório para criar linha)</li>
          <li>• <span className="font-mono">CELULAR1</span> - Telefone celular 1 (opcional)</li>
          <li>• <span className="font-mono">CELULAR2</span> - Telefone celular 2 (opcional)</li>
          <li>• <span className="font-mono">E-MAIL1</span> - Email 1 (opcional)</li>
          <li>• <span className="font-mono">E-MAIL2</span> - Email 2 (opcional)</li>
          <li>• <span className="font-mono">E-MAIL3</span> - Email 3 (opcional)</li>
        </ul>
      </div>
    </div>
  );
};
