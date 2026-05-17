'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';

export default function CategoriesPage() {
  const utils = trpc.useUtils();
  const { data: categories } = trpc.categories.list.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMarkup, setNewMarkup] = useState('30');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const createCategory = trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.invalidate();
      setShowAdd(false);
      setNewName('');
      setNewMarkup('30');
    },
  });

  const deleteCategory = trpc.categories.delete.useMutation({
    onSuccess: () => utils.categories.invalidate(),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-on-surface">Categories</h1>
          <p className="text-on-surface-variant mt-1">Manage product categories and default margins</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="h-12 px-5 bg-primary text-on-primary font-bold rounded-xl flex items-center gap-2 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Category
        </button>
      </div>

      <div className="space-y-3">
        {categories?.map((cat) => (
          <div key={cat.id} className="bg-surface-container-lowest rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary">category</span>
              </div>
              <div>
                <h3 className="font-bold text-on-surface">{cat.name}</h3>
                <p className="text-sm text-on-surface-variant">{cat._count.products} products · {Number(cat.defaultMarkupPercent)}% default markup</p>
              </div>
            </div>
            {cat._count.products === 0 && (
              deleteConfirm === cat.id ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { deleteCategory.mutate({ id: cat.id }); setDeleteConfirm(null); }}
                    className="text-xs font-bold text-on-error bg-error px-3 py-1.5 rounded-lg"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="text-xs text-on-surface-variant px-3 py-1.5 rounded-lg bg-surface-container-high"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(cat.id)}
                  className="text-error text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-error/5 transition-all"
                >
                  Delete
                </button>
              )
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-surface-container-lowest rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-on-surface">Add Category</h2>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline transition-colors"
              autoFocus
            />
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Default Markup %</label>
              <input
                type="number"
                value={newMarkup}
                onChange={(e) => setNewMarkup(e.target.value)}
                className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface transition-colors"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 h-14 border-2 border-outline-variant rounded-xl text-on-surface-variant font-bold active:scale-95 transition-all">Cancel</button>
              <button
                onClick={() => createCategory.mutate({ name: newName, defaultMarkupPercent: parseFloat(newMarkup) || 0 })}
                disabled={!newName.trim()}
                className="flex-1 h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
