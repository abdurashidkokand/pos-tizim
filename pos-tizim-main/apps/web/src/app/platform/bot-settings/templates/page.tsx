'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  LayoutTemplate,
  Plus,
  Edit2,
  Eye,
  RefreshCw,
  Save,
  X,
  Bot,
  Layers,
} from 'lucide-react';

interface TgTemplate {
  id: string;
  templateKey: string;
  displayName: string;
  bodyTemplate: string;
  parseMode: string;
  isActive: boolean;
  description: string | null;
  exampleVars: Record<string, string> | null;
}

interface PreviewResult {
  rendered: string;
  parseMode: string;
}

const PARSE_MODES = ['HTML', 'Markdown', 'MarkdownV2'];

function TemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: TgTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [body, setBody] = useState(template?.bodyTemplate ?? '');
  const [parseMode, setParseMode] = useState(template?.parseMode ?? 'HTML');
  const [displayName, setDisplayName] = useState(template?.displayName ?? '');
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [previewVars, setPreviewVars] = useState(
    JSON.stringify(template?.exampleVars ?? {}, null, 2)
  );

  const saveMut = useMutation({
    mutationFn: (data: object) =>
      template
        ? api.patch(`/telegram/templates/${template.id}`, data)
        : api.post('/telegram/templates', data),
    onSuccess: () => onSaved(),
  });

  const previewMut = useMutation({
    mutationFn: async () => {
      let vars: Record<string, string> = {};
      try { vars = JSON.parse(previewVars); } catch { /* ignore */ }
      return api.post<PreviewResult>(`/telegram/templates/${template!.id}/preview`, { vars });
    },
    onSuccess: (res) => setPreviewResult(res as PreviewResult),
  });

  const handleSave = () => {
    saveMut.mutate({
      bodyTemplate: body,
      parseMode,
      displayName: displayName || undefined,
    });
  };

  const isEdit = !!template;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-6 space-y-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b">
          <Edit2 className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-800">
            {isEdit ? `Tahrirlash: ${template.displayName}` : 'Yangi shablon'}
          </h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!isEdit && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Shablon nomi</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="kirish.salom"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-1">Xabar matni</label>
              <textarea
                rows={10}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono leading-relaxed resize-none"
                placeholder="Xabar matni. {{o'zgaruvchi}} sintaksisini ishlating."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Parse mode</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={parseMode}
                  onChange={(e) => setParseMode(e.target.value)}
                >
                  {PARSE_MODES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>

              {isEdit && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Preview o'zgaruvchilar (JSON)</label>
                    <textarea
                      rows={6}
                      className="w-full border rounded-lg px-3 py-2 text-xs font-mono resize-none"
                      value={previewVars}
                      onChange={(e) => setPreviewVars(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => previewMut.mutate()}
                    disabled={previewMut.isPending}
                    className="w-full flex items-center justify-center gap-1.5 border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg py-2 text-sm transition"
                  >
                    <Eye className="w-4 h-4" />
                    {previewMut.isPending ? `Ko\'rib chiqilmoqda...` : `Ko\'rib chiqish`}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Preview result */}
          {previewResult && (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-1">
              <p className="text-xs font-medium text-gray-500">Ko'rib chiqish:</p>
              <pre className="text-sm whitespace-pre-wrap break-words text-gray-700">{previewResult.rendered}</pre>
            </div>
          )}

          {/* Placeholder helper */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            <strong>O'zgaruvchilar:</strong> <code>{'{{nom}}'}</code>, <code>{'{{summa}}'}</code>, <code>{'{{sana}}'}</code> kabi sintaksis
          </div>
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-100"
          >
            Bekor
          </button>
          <button
            onClick={handleSave}
            disabled={saveMut.isPending || !body}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition"
          >
            <Save className="w-4 h-4" />
            {saveMut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<TgTemplate | null | 'new'>('__none__' as any);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery<TgTemplate[]>({
    queryKey: ['tg-templates'],
    queryFn: () => api.get<TgTemplate[]>('/telegram/templates'),
  });

  const seedMut = useMutation({
    mutationFn: () => api.post('/telegram/templates/seed-defaults', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tg-templates'] }),
  });

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['tg-templates'] });
    setEditing('__none__' as any);
  };

  const isModalOpen = editing !== ('__none__' as any);

  const categories = Array.from(
    new Set(templates.map((t) => t.templateKey.split('.')[0]))
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <LayoutTemplate className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Xabar shablonlari</h1>
          <p className="text-sm text-gray-500">Telegram bot xabarlari uchun shablonlar</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => seedMut.mutate()}
            disabled={seedMut.isPending}
            className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm text-gray-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${seedMut.isPending ? 'animate-spin' : ''}`} />
            Standart yuklash
          </button>
          <button
            onClick={() => setEditing(null)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Yangi shablon
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Yuklanmoqda...</p>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
          <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm mb-3">Hali shablonlar yo'q</p>
          <button
            onClick={() => seedMut.mutate()}
            disabled={seedMut.isPending}
            className="text-sm text-blue-600 hover:underline"
          >
            Standart shablonlarni yuklash
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  {cat === 'owner' ? "Owner (Do'kon egasi)" : cat === 'customer' ? 'Mijoz' : cat}
                </h2>
              </div>
              <div className="grid gap-3">
                {templates
                  .filter((t) => t.templateKey.startsWith(cat + '.'))
                  .map((t) => (
                    <div
                      key={t.id}
                      className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer transition ${selectedId === t.id ? 'border-blue-300 bg-blue-50/30' : 'border-gray-100 hover:border-gray-200'}`}
                      onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm text-gray-800">{t.displayName}</p>
                          <p className="text-xs text-gray-400 font-mono">{t.templateKey}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${t.isActive ? 'border-green-200 text-green-600 bg-green-50' : 'border-gray-200 text-gray-400 bg-gray-50'}`}>
                            {t.isActive ? 'Faol' : 'Noaktiv'}
                          </span>
                          <span className="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">{t.parseMode}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditing(t); }}
                            className="text-blue-500 hover:text-blue-700 ml-1"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {selectedId === t.id && (
                        <pre className="mt-3 text-xs bg-gray-50 border rounded-lg p-3 whitespace-pre-wrap break-words text-gray-600 leading-relaxed">
                          {t.bodyTemplate}
                        </pre>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <TemplateModal
          template={editing as TgTemplate | null}
          onClose={() => setEditing('__none__' as any)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
