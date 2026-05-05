# 💪 GymMax Power Center - Gym Management System

A comprehensive React-based gym management application built with Vite, featuring member management, inventory tracking, shift scheduling, and dashboard analytics.

## 📁 Project Structure

```
src/
├── assets/                 # Images, logos, static files
├── components/             # Reusable React components
│   ├── layout/            # Layout components
│   │   ├── Sidebar.jsx    # Navigation sidebar
│   │   ├── Header.jsx     # Top header with user info
│   │   └── ProtectedRoute.jsx  # Auth protection wrapper
│   └── ui/                # UI components
│       ├── Button.jsx     # Reusable button component
│       ├── Input.jsx      # Form input component
│       ├── Table.jsx      # Data table component
│       └── Modal.jsx      # Modal dialog component
├── config/                # Configuration files
│   └── supabase.js       # Supabase client initialization
├── context/              # React Context (optional, using Zustand)
├── hooks/                # Custom React hooks
│   ├── useAuth.js        # Authentication hook
│   └── useMembers.js     # Member management hook
├── pages/                # Page components
│   ├── Login/
│   │   └── Login.jsx     # Login page
│   ├── Dashboard/
│   │   └── Dashboard.jsx # Overview statistics
│   ├── Members/
│   │   └── Members.jsx   # Member management
│   ├── Inventory/
│   │   └── Inventory.jsx # Product inventory tracking
│   └── Shifts/
│       └── Shifts.jsx    # Shift scheduling
├── services/             # API services (Supabase)
│   ├── authService.js    # Authentication API
│   ├── memberService.js  # Member CRUD operations
│   └── productService.js # Product CRUD operations
├── store/               # Zustand state management
│   └── useAuthStore.js  # Global auth state
├── utils/               # Utility functions
│   └── formatters.js    # Data formatting helpers
├── App.jsx              # Main app component with routing
├── App.css              # Global styles
└── main.jsx             # React entry point
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Install dependencies**
```bash
npm install
```

2. **Configure Supabase** (in `src/config/supabase.js`)
```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default createClient(supabaseUrl, supabaseKey);
```

3. **Set up environment variables** (`.env.local`)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

4. **Start development server**
```bash
npm run dev
```

## 📦 Key Features

### 🔐 Authentication
- Secure login/logout with Supabase Auth
- Protected routes using `ProtectedRoute` component
- Global auth state with Zustand

### 👥 Member Management
- Add, edit, delete members
- View member list with table
- Member profile information (name, phone, email, status)

### 📦 Inventory Management
- Track product stock levels
- Manage water and retail products
- View inventory with pricing

### ⏰ Shift Management
- Create and manage work shifts
- Track staff assignments
- View shift calendar

### 📊 Dashboard
- Overview statistics
- Total members count
- Active members
- Monthly revenue
- Today's shifts

## 🛠️ Technology Stack

- **Frontend Framework**: React 19.2.5
- **Build Tool**: Vite 8.0.10
- **Routing**: React Router 6.20.0
- **State Management**: Zustand 4.4.0
- **Backend/Database**: Supabase (Firebase alternative)
- **UI Components**: Custom React components
- **Styling**: CSS with responsive design

## 📋 Component Documentation

### Layout Components

#### `Sidebar`
Navigation menu with gym branding and menu items.

#### `Header`
Top bar showing user info and logout button.

#### `ProtectedRoute`
Wrapper component that checks authentication before rendering protected content.

### UI Components

#### `Button`
Reusable button with variants (primary, secondary, danger) and sizes.

```jsx
<Button variant="primary" onClick={handleClick}>
  Add Member
</Button>
```

#### `Input`
Form input with label, placeholder, error handling.

```jsx
<Input
  label="Member Name"
  placeholder="Enter name"
  value={name}
  onChange={(e) => setName(e.target.value)}
  error={nameError}
/>
```

#### `Table`
Data display component with columns and action handlers.

```jsx
<Table
  columns={columns}
  data={data}
  loading={loading}
  actions={(row) => <button>Edit</button>}
/>
```

#### `Modal`
Dialog component for forms and confirmations.

```jsx
<Modal
  isOpen={isOpen}
  title="Add Member"
  onClose={() => setIsOpen(false)}
  onConfirm={handleSubmit}
>
  {/* Form content */}
</Modal>
```

## 🎨 Styling

The project uses a modern color scheme:
- Primary: `#667eea` (Purple)
- Accent: `#764ba2` (Dark Purple)
- Danger: `#e74c3c` (Red)
- Success: `#27ae60` (Green)

Responsive breakpoints:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🔧 Custom Hooks

### `useAuth()`
Manages authentication state and operations.

```javascript
const { user, loading, login, logout } = useAuth();
```

### `useMembers()`
Manages member data and CRUD operations.

```javascript
const { members, loading, addMember, updateMember, deleteMember } = useMembers();
```

## 📝 Utility Functions

- `formatCurrency(value)` - Format number to Vietnamese currency
- `formatDate(date)` - Format date to DD/MM/YYYY
- `formatDateTime(date)` - Format date and time
- `formatTime(time)` - Format time to HH:MM
- `formatPhoneNumber(phone)` - Format phone to local format
- `truncateText(text, length)` - Truncate long strings

## 📝 Environment Setup

### Supabase Configuration

Create a Supabase project and get:
- Project URL
- Anon Public Key
- Service Role Key (for backend)

Add to `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Database Tables

Required Supabase tables:

**members**
```sql
- id (UUID)
- name (text)
- phone (text)
- email (text)
- status (enum: active, inactive)
- created_at (timestamp)
```

**products**
```sql
- id (UUID)
- name (text)
- quantity (integer)
- price (numeric)
- created_at (timestamp)
```

**shifts**
```sql
- id (UUID)
- staff (UUID, FK to auth.users)
- date (date)
- start_time (time)
- end_time (time)
- status (enum: pending, completed, cancelled)
- created_at (timestamp)
```

## 🚀 Building & Deployment

### Development
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Lint Code
```bash
npm run lint
```

## 📚 File Structure Best Practices

1. **Services**: API calls and external integrations
2. **Hooks**: Reusable logic and state management
3. **Components**: UI and layout components
4. **Pages**: Full page components combining features
5. **Utils**: Helper functions and formatters
6. **Store**: Global state management

## 🔐 Security Considerations

- Never commit `.env.local` (add to `.gitignore`)
- Validate user input on both client and server
- Use environment variables for sensitive data
- Implement row-level security (RLS) in Supabase
- Always use HTTPS in production
- Sanitize database queries

## 🐛 Common Issues & Solutions

### Issue: "Module not found" errors
**Solution**: Run `npm install` to ensure all dependencies are installed

### Issue: Supabase connection failing
**Solution**: Check environment variables and Supabase project settings

### Issue: Routes not working
**Solution**: Ensure React Router is properly configured in App.jsx

## 📞 Support

For issues or questions, check:
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [React Router Documentation](https://reactrouter.com)

## 📄 License

This project is proprietary and confidential.

---

**Last Updated**: May 2026
**Version**: 1.0.0
