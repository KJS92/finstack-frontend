import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { categoryService, Category } from '../services/categoryService';
import './Categories.css';
import AppHeader from '../components/layout/AppHeader';
import { theme } from '../theme';
import { Plus, Tag } from 'lucide-react';

const Categories: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [formData, setFormData] = useState({ name: '', icon: '📌', color: '#3B82F6' });

  const defaultIcons = ['🍔','🚗','🛍️','💡','🎬','🏥','📚','✈️','🛒','💰','📈','📌','🏠','👕','⚡','🎮','💊','🎓','🚌','☕'];
  const presetColors = ['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#6B7280'];

  useEffect(() => { checkUser(); loadCategories(); }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate('/auth');
    else setUserEmail(session.user.email || '');
  };

  const loadCategories = async () => {
    try {
      setLoading(true);
      setCategories(await categoryService.getCategories());
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ name: category.name, icon: category.icon || '📌', color: category.color || '#6B7280' });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', icon: '📌', color: '#3B82F6' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({ name: '', icon: '📌', color: '#3B82F6' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingCategory) await categoryService.updateCategory(editingCategory.id, formData);
      else await categoryService.createCategory(formData);
      await loadCategories();
      handleCloseModal();
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this category? Transactions with this category will become uncategorized.')) return;
    try { await categoryService.deleteCategory(id); await loadCategories(); }
    catch (err: any) { setError(err.message); }
  };

  if (loading) return <div className="categories-container"><p>Loading categories...</p></div>;

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <AppHeader title="Categories" userEmail={userEmail} activePage="categories" />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px 80px' }}>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

        {/* Page header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Tag size={20} color={theme.colors.primary} />
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Categories</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{categories.length} categories</p>
            </div>
          </div>
          <button
            onClick={() => handleOpenModal()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '9px 18px', background: theme.colors.primary,
              color: '#fff', border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontSize: '14px', fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <Plus size={16} /> Add Category
          </button>
        </div>

        {/* Categories grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {categories.map(category => (
            <div key={category.id} style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: '12px', padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'box-shadow 0.15s',
            }}>
              {/* Icon bubble */}
              <div style={{
                width: '46px', height: '46px', borderRadius: '12px',
                backgroundColor: category.color || '#6B7280',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', flexShrink: 0,
              }}>
                {category.icon}
              </div>

              {/* Name + badge */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {category.name}
                </div>
                {category.is_default && (
                  <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '20px', fontWeight: 500 }}>Default</span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={() => handleOpenModal(category)}
                  style={{ padding: '5px 12px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
                >
                  Edit
                </button>
                {!category.is_default && (
                  <button
                    onClick={() => handleDelete(category.id)}
                    style={{ padding: '5px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Modal */}
        {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={handleCloseModal}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '420px', width: '90%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
                <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>&times;</button>
              </div>
              <form onSubmit={handleSubmit}>
                {/* Name */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Category Name *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g. Entertainment" style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }} />
                </div>

                {/* Icon Picker */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Select Icon</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {defaultIcons.map(icon => (
                      <button key={icon} type="button"
                        onClick={() => setFormData({ ...formData, icon })}
                        style={{
                          width: '36px', height: '36px', fontSize: '18px',
                          borderRadius: '8px', border: formData.icon === icon ? `2px solid ${theme.colors.primary}` : '1px solid #e5e7eb',
                          background: formData.icon === icon ? `${theme.colors.primary}15` : '#f9fafb',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >{icon}</button>
                    ))}
                  </div>
                </div>

                {/* Colour Picker */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Select Colour</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {presetColors.map(color => (
                      <button key={color} type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          backgroundColor: color, border: formData.color === color ? '3px solid #111' : '2px solid transparent',
                          cursor: 'pointer', transition: 'border 0.1s',
                        }}
                      />
                    ))}
                    <input type="color" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} style={{ width: '28px', height: '28px', border: 'none', padding: 0, borderRadius: '50%', cursor: 'pointer' }} title="Custom colour" />
                  </div>
                </div>

                {/* Preview */}
                <div style={{ marginBottom: '20px', padding: '12px 16px', background: '#f9fafb', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: formData.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{formData.icon}</div>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>{formData.name || 'Category Name'}</span>
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={handleCloseModal} style={{ padding: '10px 20px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Cancel</button>
                  <button type="submit" style={{ padding: '10px 20px', background: theme.colors.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{editingCategory ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Categories;
