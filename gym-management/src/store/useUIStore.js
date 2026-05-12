import { create } from 'zustand';

export const useUIStore = create((set) => ({
  toasts: [],
  addToast: (message, type = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    
    // Tự động xóa sau 3 giây
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);
  },
  
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),

  confirmDialog: null, // { title, message, onConfirm, onCancel }
  showConfirm: (config) => set({ confirmDialog: config }),
  hideConfirm: () => set({ confirmDialog: null }),
}));
