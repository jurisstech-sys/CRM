'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Send,
  Paperclip,
  Clock,
  User,
  FileText,
  Loader2,
  X,
} from 'lucide-react'

export interface LeadComment {
  id: string
  lead_id: string
  user_id: string
  comment: string
  files: { name: string; url: string; type: string }[] | null
  created_at: string
  users?: {
    full_name: string | null
    email: string
  }
}

interface LeadTimelineProps {
  leadId: string
}

export function LeadTimeline({ leadId }: LeadTimelineProps) {
  const [comments, setComments] = useState<LeadComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [files, setFiles] = useState<{ name: string; url: string; type: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadComments = useCallback(async () => {
    try {
      setLoading(true)
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) return

      const res = await fetch(`/api/lead-comments?lead_id=${leadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setComments(data.comments || [])
      }
    } catch (err) {
      console.error('Error loading comments:', err)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    if (leadId) {
      loadComments()
    }
  }, [leadId, loadComments])

  const handleSubmit = async () => {
    if (!newComment.trim()) return

    try {
      setSubmitting(true)
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) return

      const res = await fetch('/api/lead-comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lead_id: leadId,
          comment: newComment.trim(),
          files: files.length > 0 ? files : null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setComments((prev) => [data.comment, ...prev])
        setNewComment('')
        setFiles([])
      }
    } catch (err) {
      console.error('Error adding comment:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileSelect = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = (e) => {
      const fileList = (e.target as HTMLInputElement).files
      if (fileList) {
        const newFiles = Array.from(fileList).map((f) => ({
          name: f.name,
          url: URL.createObjectURL(f),
          type: f.type,
        }))
        setFiles((prev) => [...prev, ...newFiles])
      }
    }
    input.click()
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit()
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-blue-400" />
        Timeline de Atividades
      </h3>

      {/* New Comment Form */}
      <div className="space-y-2 bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-slate-800 border-slate-700 text-white min-h-[60px] resize-none"
          placeholder="Adicionar comentário... (Ctrl+Enter para enviar)"
          rows={2}
        />

        {/* Attached files preview */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 bg-slate-700 rounded px-2 py-1 text-xs text-slate-300"
              >
                <FileText className="w-3 h-3" />
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(idx)}
                  className="text-slate-400 hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFileSelect}
            className="text-slate-400 hover:text-white h-8"
          >
            <Paperclip className="w-4 h-4 mr-1" />
            Anexar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="bg-blue-600 hover:bg-blue-700 h-8"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-1" />
            )}
            Enviar
          </Button>
        </div>
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-400">Carregando...</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-6 text-slate-500">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum comentário ainda</p>
          <p className="text-xs mt-1">Adicione o primeiro comentário acima</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {comments.map((c) => (
            <div
              key={c.id}
              className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <User className="w-3 h-3 text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-slate-300">
                    {c.users?.full_name || c.users?.email || 'Usuário'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  {c.created_at
                    ? format(new Date(c.created_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })
                    : ''}
                </span>
              </div>

              <p className="text-sm text-slate-300 whitespace-pre-wrap ml-8">
                {c.comment}
              </p>

              {/* Attached files */}
              {c.files && c.files.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 ml-8">
                  {c.files.map((file, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="text-[10px] border-slate-600 text-slate-400 gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      {file.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
