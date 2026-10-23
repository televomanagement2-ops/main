import { useState } from 'react';
import { RowsSkeleton } from '../../../components/ui/Skeletons';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Drawer } from '../../../components/ui/Drawer';
import { Spinner } from '../../../components/ui/Spinner';
import { IconAlert, IconPlus, IconTrash } from '../../../components/ui/icons';
import { useDeleteSizeGuide, useSaveSizeGuide, useSizeGuides } from '../../../hooks/useSizeGuides';
import { useAdminCategories, useAdminProducts } from '../../../hooks/useAdminProducts';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import { SizeGuideTable } from '../../../components/ui/SizeGuideTable';
import type { SizeGuide } from '../../../types';

const MAX_COLUMNS = 12;
const MAX_ROWS = 60;

/** Starting points; the admin edits them freely (names and headings are translated). */
const TEMPLATES: { id: string; columns: string[]; rows: string[][] }[] = [
  {
    id: 'tops',
    columns: ['size', 'it', 'eu', 'us', 'uk', 'chest', 'waist'],
    rows: [
      ['XS', '38', '32', '0-2', '4-6', '80-84', '62-66'],
      ['S', '40', '34-36', '4-6', '8-10', '84-88', '66-70'],
      ['M', '42-44', '38', '8-10', '12', '88-94', '70-76'],
      ['L', '46', '40-42', '12', '14-16', '94-100', '76-82'],
      ['XL', '48-50', '44', '14-16', '18', '100-106', '82-88'],
    ],
  },
  {
    id: 'shoes',
    columns: ['eu', 'us', 'uk', 'foot'],
    rows: [
      ['36', '5.5', '3.5', '22.5'],
      ['37', '6.5', '4', '23.5'],
      ['38', '7.5', '5', '24'],
      ['39', '8', '6', '25'],
      ['40', '9', '6.5', '25.5'],
      ['41', '9.5', '7.5', '26'],
      ['42', '10', '8', '27'],
      ['43', '11', '9', '27.5'],
      ['44', '12', '9.5', '28.5'],
    ],
  },
  {
    id: 'trousers',
    columns: ['size', 'waist', 'hips', 'inseam'],
    rows: [
      ['26', '66', '88', '76'],
      ['28', '71', '93', '78'],
      ['30', '76', '98', '80'],
      ['32', '81', '103', '81'],
      ['34', '86', '108', '82'],
    ],
  },
  {
    id: 'rings',
    columns: ['size', 'diameter', 'circumference'],
    rows: [
      ['5', '15.7', '49.3'],
      ['6', '16.5', '51.9'],
      ['7', '17.3', '54.4'],
      ['8', '18.1', '57'],
      ['9', '18.9', '59.5'],
    ],
  },
];

export function AdminSizeGuidesPage() {
  const { t } = useI18n();
  const { data: guides = [], isLoading, error } = useSizeGuides();
  const { data: categories = [] } = useAdminCategories();
  const { data: products = [] } = useAdminProducts();
  const remove = useDeleteSizeGuide();
  const [editing, setEditing] = useState<SizeGuide | 'new' | null>(null);

  if (isLoading) return <RowsSkeleton rows={4} />;
  if (error) return <ErrorMessage message={t('admin.guides.loadError')} />;

  return (
    <>
      <header className="admin-page__head">
        <div>
          <p className="t-label">{t('admin.guides.eyebrow')}</p>
          <h1 className="admin-page__title">{t('admin.guides.title')}</h1>
          <p className="t-sm t-faint admin-page__desc">{t('admin.guides.subtitle')}</p>
        </div>
        <div className="admin-page__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing('new')}>
            <IconPlus size={15} />
            {t('admin.guides.new')}
          </button>
        </div>
      </header>

      {guides.length === 0 ? (
        <div className="empty">
          <p className="empty__title">{t('admin.guides.emptyTitle')}</p>
          <p className="empty__body">{t('admin.guides.empty')}</p>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 'var(--s-6)' }}>
          <table className="table table--stack">
            <thead>
              <tr>
                <th>{t('admin.guides.table.name')}</th>
                <th>{t('admin.guides.table.categories')}</th>
                <th className="table__num">{t('admin.guides.table.products')}</th>
                <th className="table__num">{t('admin.guides.table.size')}</th>
                <th className="table__actions">{t('admin.catalog.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {guides.map((guide) => {
                const cats = categories.filter((c) => c.size_guide_id === guide.id);
                const count = products.filter((p) => p.size_guide_id === guide.id).length;
                return (
                  <tr key={guide.id}>
                    <td data-col="meta" className="table__primary">{guide.name}</td>
                    <td data-col="full" className="t-sm">{cats.map((c) => c.name).join(', ') || '—'}</td>
                    <td data-col="end" className="table__num">{count}</td>
                    <td data-col="end" className="table__num t-faint">{guide.rows.length} × {guide.columns.length}</td>
                    <td data-col="end" className="table__actions">
                      <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(guide)}>
                          {t('admin.catalog.edit')}
                        </button>
                        <button
                          type="button"
                          className="btn btn--quiet btn--sm"
                          disabled={remove.isPending}
                          onClick={() =>
                            window.confirm(t('admin.guides.deleteConfirm', { name: guide.name }))
                            && remove.mutate(guide.id, {
                              onSuccess: () => toast(t('admin.guides.deleted', { name: guide.name })),
                              onError: (err) => toast(err instanceof Error ? err.message : t('common.error'), 'critical'),
                            })
                          }
                        >
                          {t('admin.guides.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <SizeGuideDrawer
          key={editing === 'new' ? 'new' : editing.id}
          guide={editing === 'new' ? null : editing}
          assigned={editing === 'new' ? [] : categories.filter((c) => c.size_guide_id === editing.id).map((c) => c.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function SizeGuideDrawer({ guide, assigned, onClose }: { guide: SizeGuide | null; assigned: string[]; onClose: () => void }) {
  const { t } = useI18n();
  const save = useSaveSizeGuide();
  const { data: categories = [] } = useAdminCategories();
  const [name, setName] = useState(guide?.name ?? '');
  const [columns, setColumns] = useState<string[]>(guide?.columns ?? [t('admin.guides.col.size'), '']);
  const [rows, setRows] = useState<string[][]>(guide?.rows ?? [['', '']]);
  const [notes, setNotes] = useState(guide?.notes ?? '');
  const [categoryIds, setCategoryIds] = useState<string[]>(assigned);
  const [error, setError] = useState<string | null>(null);

  const applyTemplate = (id: string) => {
    const template = TEMPLATES.find((tpl) => tpl.id === id);
    if (!template) return;
    setColumns(template.columns.map((c) => t(`admin.guides.col.${c}`)));
    setRows(template.rows.map((r) => [...r]));
    if (!name.trim()) setName(t(`admin.guides.template.${id}`));
    if (!notes.trim()) setNotes(t('admin.guides.templateNotes'));
  };

  const setCell = (r: number, c: number, value: string) =>
    setRows((prev) => prev.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)));
  const addColumn = () => {
    if (columns.length >= MAX_COLUMNS) return;
    setColumns((prev) => [...prev, '']);
    setRows((prev) => prev.map((row) => [...row, '']));
  };
  const removeColumn = (c: number) => {
    if (columns.length <= 1) return;
    setColumns((prev) => prev.filter((_, i) => i !== c));
    setRows((prev) => prev.map((row) => row.filter((_, i) => i !== c)));
  };
  const addRow = () => rows.length < MAX_ROWS && setRows((prev) => [...prev, columns.map(() => '')]);
  const removeRow = (r: number) => setRows((prev) => prev.filter((_, i) => i !== r));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanColumns = columns.map((c) => c.trim().slice(0, 40));
    const cleanRows = rows
      .map((row) => row.map((cell) => cell.trim().slice(0, 40)))
      .filter((row) => row.some(Boolean));
    if (!name.trim()) return setError(t('admin.guides.errors.name'));
    if (cleanColumns.some((c) => !c)) return setError(t('admin.guides.errors.columns'));
    if (cleanRows.length === 0) return setError(t('admin.guides.errors.rows'));

    save.mutate(
      {
        guide: { id: guide?.id, name: name.trim().slice(0, 80), columns: cleanColumns, rows: cleanRows, notes: notes.trim().slice(0, 2000) || null },
        categoryIds,
      },
      {
        onSuccess: () => {
          toast(t('admin.guides.saved'));
          onClose();
        },
        onError: (err) => setError(err instanceof Error ? err.message : t('common.error')),
      },
    );
  };

  return (
    <Drawer
      open
      onClose={onClose}
      wide
      eyebrow={t('admin.guides.eyebrow')}
      title={guide ? t('admin.guides.editTitle') : t('admin.guides.newTitle')}
      closeLabel={t('common.close')}
      footer={
        <div className="row gap-3" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={save.isPending}>{t('common.cancel')}</button>
          <button type="submit" form="guide-form" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? <><Spinner onAction />{t('admin.catalog.form.saving')}</> : t('admin.catalog.form.save')}
          </button>
        </div>
      }
    >
      <form id="guide-form" className="form-sections" onSubmit={submit}>
        <section className="form-section">
          <div className="field">
            <label className="field__label" htmlFor="guide-name">{t('admin.guides.form.name')} *</label>
            <input id="guide-name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <span className="field__label">{t('admin.guides.form.templates')}</span>
            <div className="size-presets">
              {TEMPLATES.map((tpl) => (
                <button key={tpl.id} type="button" className="btn btn--secondary btn--sm" onClick={() => applyTemplate(tpl.id)}>
                  {t(`admin.guides.template.${tpl.id}`)}
                </button>
              ))}
            </div>
            <p className="field__hint">{t('admin.guides.form.templatesHint')}</p>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__head">
            <p className="t-label">{t('admin.guides.form.table')}</p>
            <p className="t-xs t-faint">{t('admin.guides.form.tableHint')}</p>
          </div>
          <div className="guide-editor">
            <table>
              <thead>
                <tr>
                  {columns.map((col, c) => (
                    <th key={c}>
                      <div className="guide-editor__head">
                        <input
                          className="input input--sm"
                          value={col}
                          maxLength={40}
                          onChange={(e) => setColumns((prev) => prev.map((x, i) => (i === c ? e.target.value : x)))}
                          aria-label={t('admin.guides.form.columnAria', { n: c + 1 })}
                        />
                        <button
                          type="button"
                          className="size-row__icon size-row__icon--danger"
                          onClick={() => removeColumn(c)}
                          disabled={columns.length <= 1}
                          aria-label={t('admin.guides.form.removeColumn', { n: c + 1 })}
                        >
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c}>
                        <input
                          className="input input--sm"
                          value={cell}
                          maxLength={40}
                          onChange={(e) => setCell(r, c, e.target.value)}
                          aria-label={t('admin.guides.form.cellAria', { row: r + 1, column: columns[c] || c + 1 })}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="size-row__icon size-row__icon--danger"
                        onClick={() => removeRow(r)}
                        aria-label={t('admin.guides.form.removeRow', { n: r + 1 })}
                      >
                        <IconTrash size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row gap-2">
            <button type="button" className="btn btn--secondary btn--sm" onClick={addRow} disabled={rows.length >= MAX_ROWS}>
              <IconPlus size={14} />
              {t('admin.guides.form.addRow')}
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={addColumn} disabled={columns.length >= MAX_COLUMNS}>
              <IconPlus size={14} />
              {t('admin.guides.form.addColumn')}
            </button>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="guide-notes">{t('admin.guides.form.notes')}</label>
            <textarea id="guide-notes" className="textarea" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <p className="field__hint">{t('admin.guides.form.notesHint')}</p>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__head">
            <p className="t-label">{t('admin.guides.form.categories')}</p>
            <p className="t-xs t-faint">{t('admin.guides.form.categoriesHint')}</p>
          </div>
          <div className="check-list">
            {categories.map((c) => (
              <label key={c.id} className="checkbox">
                <input
                  type="checkbox"
                  checked={categoryIds.includes(c.id)}
                  onChange={() =>
                    setCategoryIds((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]))
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__head"><p className="t-label">{t('admin.guides.form.preview')}</p></div>
          <SizeGuideTable columns={columns} rows={rows} notes={notes} />
        </section>

        {error && (
          <div className="notice notice--critical">
            <IconAlert size={15} />
            <div className="notice__body">{error}</div>
          </div>
        )}
      </form>
    </Drawer>
  );
}
