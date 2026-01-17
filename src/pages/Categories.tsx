import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { categoryService, Category } from '../services/categoryService';
import './Categories.css';

const Categories: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    icon: '📌',
    color: '#3B82F6'
  });

  const defaultIcons = ['🍔', '🚗', '🛍️', '💡', '🎬', '🏥', '📚', '✈️', '🛒', '💰', '📈', '📌', '🏠', '👕', '⚡', '🎮', '💊', '🎓', '🚌', '☕'];

  useEffect(() => {
    checkUser();
    loadCategories();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
    }
  };

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await categoryService.getCategories();
      setCategories(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        icon: category.icon || '📌',
        color: category.color || '#3B82F6'
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        icon: '📌',
        color: '#3B82F6'
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      icon: '📌',
      color: '#3B82F6'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingCategory) {
        await categoryService.updateCategory(editingCategory.id, formData);
      } else {
        await categoryService.createCategory(formData);
      }
      await loadCategories();
      handleCloseModal();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category? Transactions with this category will become uncategorized.')) {
      return;
    }

    try {
      await categoryService.deleteCategory(id);
      await loadCategories();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (loading) {
    return <div className="categories-container"><p>Loading categories...</p></div>;
  }

  return (
    <div className="categories-container">
      <header className="categories-header">
        <h1>Categories</h1>
        <div className="header-actions">
          <button onClick={() => handleOpenModal()} className="btn-primary">
            + Add Category
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            Dashboard
          </button>
          <button onClick={() => navigate('/transactions-list')} className="btn-secondary">
            Transactions
          </button>
          <button onClick={() => navigate('/accounts')} className="btn-secondary">
            Accounts
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="categories-grid">
        {categories.map((category) => (
          <div key={category.id} className="category-card">
            <div className="category-icon" style={{ backgroundColor: category.color }}>
              {category.icon}
            </div>
            <div className="category-info">
              <h3>{category.name}</h3>
              {category.is_default && <span className="default-badge">Default</span>}
            </div>
            <div className="category-actions">
              <button onClick={() => handleOpenModal(category)} className="btn-edit-small">
                Edit
              </button>
              {!category.is_default && (
                <button onClick={() => handleDelete(category.id)} className="btn-delete-small">
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
              <button onClick={handleCloseModal} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Category Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Entertainment"
                />
              </div>

              <div className="form-group">
                <label>Select Icon</label>
                <div className="icon-picker">
                  {defaultIcons.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      className={`icon-option ${formData.icon === icon ? 'selected' : ''}`}
                      onClick={() => setFormData({ ...formData, icon })}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Select Color</label>
                <div className="color-picker">
                  {['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-option ${formData.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="color-input"
                />
              </div>

              <div className="form-group preview">
                <label>Preview</label>
                <div className="category-preview">
                  <div className="preview-icon" style={{ backgroundColor: formData.color }}>
                    {formData.icon}
                  </div>
                  <span>{formData.name || 'Category Name'}</span>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={handleCloseModal} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
