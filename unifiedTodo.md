# 📋 UNIFIED TODO PLAN - Gym Management System

## 🎯 Mục Tiêu
Hợp nhất todoPlan2.md (Security Fixes) + Todo.md (Features) thành roadmap hoàn chỉnh.

---

## ✅ Review Update (2026-05-07)
- [x] Critical: Fixed `memberService.createMember` payload mapping (`member_code`, `full_name`).
- [x] Critical: Fixed renew contract mismatch between `Members.jsx` and `memberService.renewMember`.
- [x] Critical: Added `verified_by`, `verified_at` to `payment_logs` schema to match policy/function.
- [x] High: Removed duplicate create-flow payment/log writes from `Members.jsx` after moving to atomic RPC.
- [x] High: Fixed renewal date comparison by parsing `member.end_date` to `Date` before comparing.
- [x] High: Added stronger RPC response validation and clearer error mapping in member service.
- [x] Feature: Added shift expense tab (`Chi`) and formula `TM hoi vien + TM nuoc - chi` in shifts handover.

**Manual verification still needed on Supabase environment:**
- [ ] Run updated SQL migration on the target project.
- [ ] Validate RLS behavior with 1 staff account + 1 admin account.
- [ ] Smoke-test create/renew/verify flows on production-like data.

## ✅ ĐÃ HOÀN THÀNH (DONE)
- [x] Thêm `opened_by` vào bảng `shifts` (Database & Code)
- [x] Tạo bảng `payment_logs` và tích hợp vào quy trình Thêm/Gia hạn hội viên
- [x] Chặn bán nước khi chưa mở ca làm việc
- [x] Di chuyển toàn bộ dữ liệu Lương & Lịch xếp ca từ `localStorage` lên Supabase
- [x] Cập nhật Dashboard sử dụng `payment_logs` để tính doanh thu học viên chính xác

---

## 🔴 PHASE 1: CRITICAL SECURITY FIXES (Week 1)

### 1. Implement Row-Level Security (RLS) Policies
**Priority:** ⭐⭐⭐⭐⭐ CRITICAL
**Status:** Not Started
**Files Affected:**
- `gym-management/src/config/Supabase.sql` - Add RLS policies

**Current Issue:**
- All authenticated users can read/write all tables
- Staff can see other staff's logs, schedules, salaries
- No data isolation

**Solution:**
```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_adjustments ENABLE ROW LEVEL SECURITY;

-- Staff can only view own logs
CREATE POLICY "staff_logs are viewable by own staff" ON staff_logs 
  FOR SELECT USING (auth.uid() = staff_id);

-- Member logs only admins can view
CREATE POLICY "member_logs are viewable by admins" ON member_logs 
  FOR SELECT USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Weekly schedules: Staff view own, admins view all
CREATE POLICY "schedules viewable" ON weekly_schedules 
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR auth.uid() = staff_id
  );

-- Members: All authenticated can view (for check-in)
CREATE POLICY "members are viewable by authenticated" ON members 
  FOR SELECT USING (auth.role() = 'authenticated');

-- Payment logs: Staff can view own verifications, admins view all
CREATE POLICY "payment_logs viewable" ON payment_logs 
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR auth.uid() = verified_by
  );
```

**Acceptance Criteria:**
- [ ] RLS enabled on all sensitive tables
- [ ] Staff cannot view other staff's logs
- [ ] Only admins can approve payments
- [ ] Test: Non-admin user queries staff_logs → returns only own records

---

### 2. Add Transaction Safety for Sales & Member Creation
**Priority:** ⭐⭐⭐⭐⭐ CRITICAL
**Status:** Not Started
**Files Affected:**
- `gym-management/src/config/Supabase.sql` - Database functions
- `gym-management/src/services/productService.js` - sellOneBottle()
- `gym-management/src/services/memberService.js` - createMember()

**Current Issue:**
- If `sales_logs` insert fails → stock already decremented (data inconsistency)
- If `member_logs` insert fails → member still created (incomplete record)
- No rollback mechanism

**Database Functions to Create:**
```sql
-- Atomic product sale transaction
CREATE OR REPLACE FUNCTION sell_bottle_transaction(
  p_product_id BIGINT,
  p_shift_id BIGINT,
  p_staff_id UUID,
  p_quantity INT,
  p_total_price NUMERIC
)
RETURNS JSON AS $$
DECLARE
  v_sales_log_id BIGINT;
  v_current_stock INT;
BEGIN
  -- Check stock first
  SELECT stock_quantity INTO v_current_stock FROM products WHERE id = p_product_id;
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Hết hàng';
  END IF;

  -- Atomic: Decrement + Log in transaction
  UPDATE products SET stock_quantity = stock_quantity - p_quantity WHERE id = p_product_id;
  
  INSERT INTO sales_logs (product_id, shift_id, sold_by, quantity, total_price)
  VALUES (p_product_id, p_shift_id, p_staff_id, p_quantity, p_total_price)
  RETURNING id INTO v_sales_log_id;
  
  INSERT INTO staff_logs (staff_id, action, target_item, details)
  VALUES (p_staff_id, 'Bán hàng', (SELECT name FROM products WHERE id = p_product_id), 
          json_build_object('sale_id', v_sales_log_id));
  
  RETURN json_build_object('success', true, 'sale_id', v_sales_log_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Atomic member creation transaction
CREATE OR REPLACE FUNCTION create_member_transaction(
  p_code VARCHAR,
  p_name VARCHAR,
  p_package_type INT,
  p_fee NUMERIC,
  p_payment_method VARCHAR,
  p_shift_id BIGINT,
  p_staff_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_member_id BIGINT;
  v_payment_id BIGINT;
BEGIN
  -- Create member
  INSERT INTO members (code, name, package_type, fee, start_date, end_date)
  VALUES (p_code, p_name, p_package_type, p_fee, NOW()::DATE, 
          (NOW() + (p_package_type || ' months')::INTERVAL)::DATE)
  RETURNING id INTO v_member_id;
  
  -- Create payment log
  INSERT INTO payment_logs (member_id, shift_id, payment_type, payment_method, amount, 
                            is_payment_verified, verified_by)
  VALUES (v_member_id, p_shift_id, 'new', p_payment_method, p_fee,
          (p_payment_method = 'TM'), CASE WHEN p_payment_method = 'TM' THEN p_staff_id ELSE NULL END)
  RETURNING id INTO v_payment_id;
  
  -- Create audit logs
  INSERT INTO member_logs (member_id, staff_id, action, details)
  VALUES (v_member_id, p_staff_id, 'CREATE', 
          json_build_object('code', p_code, 'fee', p_fee, 'payment_id', v_payment_id));
  
  INSERT INTO staff_logs (staff_id, action, target_item, details)
  VALUES (p_staff_id, 'Tạo hội viên', p_code, 
          json_build_object('member_id', v_member_id, 'fee', p_fee));
  
  RETURN json_build_object('success', true, 'member_id', v_member_id, 'payment_id', v_payment_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
```

**Service Updates:**
```javascript
// productService.js
export async function sellOneBottle(productId, shiftId, staffId) {
  const { data, error } = await supabase.rpc('sell_bottle_transaction', {
    p_product_id: productId,
    p_shift_id: shiftId,
    p_staff_id: staffId,
    p_quantity: 1,
    p_total_price: productPrice
  });
  
  if (error) throw new Error('Bán hàng thất bại. Không trừ kho');
  return data;
}

// memberService.js
export async function createMember(memberData) {
  const { data, error } = await supabase.rpc('create_member_transaction', {
    p_code: memberData.code,
    p_name: memberData.name,
    p_package_type: memberData.package_type,
    p_fee: memberData.fee,
    p_payment_method: memberData.payment_method,
    p_shift_id: memberData.shift_id,
    p_staff_id: memberData.staff_id
  });
  
  if (error) throw new Error('Tạo hội viên thất bại');
  return data;
}
```

**Acceptance Criteria:**
- [ ] Database transaction functions created
- [ ] Services call transaction functions
- [ ] If any step fails → entire transaction rolls back
- [ ] Test: Simulated sales_logs insert failure → stock not decremented

---

### 3. Fix Race Condition in Payment Verification
**Priority:** ⭐⭐⭐⭐ HIGH
**Status:** Not Started
**Files Affected:**
- `gym-management/src/config/Supabase.sql` - Schema + function
- `gym-management/src/services/paymentService.js` - verifyPayment()

**Schema Changes:**
```sql
-- Add optimistic locking columns
ALTER TABLE payment_logs ADD COLUMN IF NOT EXISTS
  verified_version INT DEFAULT 0,
  verified_by_admin UUID,
  verified_at TIMESTAMP;

-- Create atomic verification function
CREATE OR REPLACE FUNCTION verify_payment_atomic(
  p_payment_id BIGINT,
  p_admin_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE payment_logs 
  SET 
    is_payment_verified = true,
    verified_by_admin = p_admin_id,
    verified_at = NOW(),
    verified_version = verified_version + 1
  WHERE 
    id = p_payment_id 
    AND is_payment_verified = false  -- Only if not already verified
    AND payment_method = 'CK'         -- Only for bank transfers
  RETURNING id INTO v_updated;

  IF v_updated IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Payment already verified or not found');
  END IF;

  -- Log verification
  INSERT INTO staff_logs (staff_id, action, target_item, details)
  VALUES (p_admin_id, 'Xác thực thanh toán', 'Payment #' || p_payment_id, 
          json_build_object('payment_id', p_payment_id));

  RETURN json_build_object('success', true, 'payment_id', p_payment_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
```

**Service Update:**
```javascript
export async function verifyPayment(paymentId, adminId) {
  const { data, error } = await supabase.rpc('verify_payment_atomic', {
    p_payment_id: paymentId,
    p_admin_id: adminId
  });

  if (error || !data.success) {
    throw new Error(data?.error || 'Failed to verify payment');
  }
  
  return data;
}
```

**Acceptance Criteria:**
- [ ] Payment verification uses atomic UPDATE
- [ ] Cannot verify same payment twice
- [ ] verified_by_admin tracks who verified
- [ ] Test: Two concurrent requests → second fails gracefully

---

### 4. Add Date Validation for Member Dates
**Priority:** ⭐⭐⭐⭐ HIGH
**Status:** Not Started
**Files Affected:**
- `gym-management/src/services/memberService.js` - validateMemberDates()
- `gym-management/src/pages/Members/Members.jsx` - Form validation

**Add Validations:**
```javascript
// memberService.js
export async function validateMemberDates(startDate, packageType) {
  const start = new Date(startDate);
  const end = addMonths(start, packageType);
  
  // Validation 1: end_date must be in future
  if (end < new Date()) {
    throw new Error(`Ngày kết thúc (${format(end, 'dd/MM/yyyy')}) không được ở quá khứ`);
  }
  
  // Validation 2: package_type max 36 months (3 years)
  if (packageType > 36) {
    throw new Error('Gói tập tối đa 36 tháng');
  }
  
  // Validation 3: package_type must be positive
  if (packageType < 1) {
    throw new Error('Gói tập tối thiểu 1 tháng');
  }
  
  return true;
}

export async function createMember(memberData) {
  // Validate dates before creating
  await validateMemberDates(memberData.start_date || new Date(), memberData.package_type);
  
  // Then proceed with creation
  return await supabase.rpc('create_member_transaction', memberData);
}

export async function renewMember(memberId, renewalData) {
  const { packageType, fee, paymentMethod, staffId, shiftId } = renewalData;
  
  // Get current member
  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('id', memberId)
    .single();
  
  // Use current end_date as start for renewal, or today if expired
  const renewalStart = member.end_date >= new Date() ? member.end_date : new Date();
  const newEndDate = addMonths(renewalStart, packageType);
  
  // Validate new end date
  await validateMemberDates(renewalStart, packageType);
  
  // Update member
  const { data: updatedMember, error: updateError } = await supabase
    .from('members')
    .update({ end_date: newEndDate, package_type: packageType })
    .eq('id', memberId)
    .select()
    .single();
  
  if (updateError) throw updateError;
  
  // Create payment log for renewal
  const { data: payment, error: paymentError } = await supabase
    .from('payment_logs')
    .insert([{
      member_id: memberId,
      shift_id: shiftId,
      payment_type: 'renew',
      payment_method: paymentMethod,
      amount: fee,
      is_payment_verified: paymentMethod === 'TM',
      verified_by: paymentMethod === 'TM' ? staffId : null,
      verified_at: paymentMethod === 'TM' ? new Date() : null
    }])
    .select()
    .single();
  
  if (paymentError) throw paymentError;
  
  // Log actions
  await memberLogService.logAction(memberId, staffId, 'RENEW', {
    package_type: packageType,
    fee: fee,
    payment_id: payment.id
  });
  
  await staffLogService.logAction(staffId, 'Gia hạn hội viên', 
    `${member.code} - ${member.name}`, {
      member_id: memberId,
      fee: fee,
      payment_id: payment.id
    });
  
  return { member: updatedMember, payment };
}
```

**UI Validation:**
```javascript
// Members.jsx
const [packageType, setPackageType] = useState(1);
const [error, setError] = useState('');

const handlePackageChange = (value) => {
  if (value < 1 || value > 36) {
    setError('Gói tập từ 1-36 tháng');
  } else {
    setError('');
  }
  setPackageType(value);
};
```

**Acceptance Criteria:**
- [ ] validateMemberDates() validates all constraints
- [ ] UI shows error if package_type outside 1-36
- [ ] Cannot create member with end_date in past
- [ ] Renewal extends from current end_date (if valid) or today

---

### 5. Fix Staff Type Default Value
**Priority:** ⭐⭐⭐ MEDIUM
**Status:** Not Started
**Files Affected:**
- `gym-management/src/config/Supabase.sql` - Schema

**Solution:**
```sql
-- Add NOT NULL with DEFAULT
ALTER TABLE profiles 
  ALTER COLUMN staff_type SET DEFAULT 'CT',
  ALTER COLUMN staff_type SET NOT NULL;

-- Update existing NULLs
UPDATE profiles SET staff_type = 'CT' WHERE staff_type IS NULL;
```

**Acceptance Criteria:**
- [ ] staff_type has DEFAULT 'CT' in schema
- [ ] New staff automatically gets 'CT' type
- [ ] No NULL values in existing data

---

### 6. Implement Soft Deletes
**Priority:** ⭐⭐⭐ MEDIUM
**Status:** Not Started
**Files Affected:**
- `gym-management/src/config/Supabase.sql` - Add deleted_at columns
- All services - Update DELETE queries

**Schema Changes:**
```sql
ALTER TABLE members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX idx_members_deleted ON members(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_deleted ON products(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_deleted ON profiles(deleted_at) WHERE deleted_at IS NULL;
```

**Service Updates:**
```javascript
// OLD:
await supabase.from('members').delete().eq('id', memberId);

// NEW:
await supabase
  .from('members')
  .update({ deleted_at: new Date() })
  .eq('id', memberId);

// For selecting active records:
await supabase
  .from('members')
  .select('*')
  .is('deleted_at', null);
```

**Acceptance Criteria:**
- [ ] All tables have deleted_at column
- [ ] DELETE operations become soft deletes
- [ ] All SELECT queries filter deleted_at IS NULL
- [ ] Deleted records still exist for audit trail

---

### 7. Fix Null Checks in Payment Service
**Priority:** ⭐⭐⭐ MEDIUM
**Status:** Not Started
**Files Affected:**
- `gym-management/src/services/paymentService.js` - SQL queries

**Solution:**
```javascript
// OLD - assumes join exists:
const query = `
  SELECT 
    pl.*,
    p.full_name as verified_by_name,
    m.name as member_name
  FROM payment_logs pl
  JOIN profiles p ON pl.verified_by = p.id
  JOIN members m ON pl.member_id = m.id
`;

// NEW - safe NULL handling:
const query = `
  SELECT 
    pl.*,
    COALESCE(p.full_name, 'Deleted User') as verified_by_name,
    COALESCE(m.name, 'Deleted Member') as member_name
  FROM payment_logs pl
  LEFT JOIN profiles p ON pl.verified_by = p.id
  LEFT JOIN members m ON pl.member_id = m.id
  WHERE pl.deleted_at IS NULL
`;
```

**Acceptance Criteria:**
- [ ] All JOINs use COALESCE() or LEFT JOIN
- [ ] No NULL crashes when related records deleted
- [ ] Service gracefully handles missing data

---

### 8. Add Error Notifications to UI
**Priority:** ⭐⭐⭐ MEDIUM
**Status:** Not Started
**Files Affected:**
- `gym-management/src/components/ui/Toast.jsx` - Create component
- All page components - Add error handling

**Create Toast Component:**
```javascript
// components/ui/Toast.jsx
import { useState } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);
  
  const addToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };
  
  return { 
    toasts, 
    addToast, 
    showError: (msg) => addToast(msg, 'error', 5000),
    showSuccess: (msg) => addToast(msg, 'success', 3000)
  };
}

export function ToastContainer({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div key={toast.id} 
             className={`p-4 rounded-lg shadow-lg ${
               toast.type === 'error' ? 'bg-red-500 text-white' : 
               toast.type === 'success' ? 'bg-green-500 text-white' : 
               'bg-blue-500 text-white'
             }`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
```

**Update Service Calls:**
```javascript
// In Inventory.jsx
const { showError } = useToast();

const handleSell = async (productId) => {
  try {
    await productService.sellOneBottle(productId, shiftId, staffId);
    // Success toast if needed
  } catch (error) {
    showError(`Bán hàng thất bại: ${error.message}`);
  }
};
```

**Acceptance Criteria:**
- [ ] Toast component displays error messages
- [ ] User sees feedback when action fails
- [ ] Error messages are user-friendly Vietnamese text

---

## 🟡 PHASE 2: FEATURE ENHANCEMENTS (Week 2)

### 9. Tính toán tiền bàn giao trong modal Chốt ca
**Priority:** ⭐⭐⭐ HIGH
**Status:** ✅ COMPLETED
**Files Affected:**
- `gym-management/src/pages/Shifts/Shifts.jsx` - Close shift modal
- `gym-management/src/services/paymentService.js` - getPaymentsByShift() added

**Implementation:**
- Added `calculateHandoverCash()` function that sums TM payments + drink sales for the shift
- Displays suggested ending cash in the form placeholder with breakdown
- Shows calculation: "Dự kiến: Xđ (tiền đầu ca + TM + nước)"
- Staff can override the suggested amount if needed

**Acceptance Criteria:**
- [x] Close shift modal shows suggested end cash amount
- [x] Calculation includes TM payments + drink sales
- [x] Staff can override if needed

---

### 10. Cảnh báo hết hạn hội viên
**Priority:** ⭐⭐⭐ HIGH
**Status:** ✅ COMPLETED
**Files Affected:**
- `gym-management/src/pages/Members/Members.jsx` - Member list styling

**Implementation:**
- Added `getMemberStatus()` function that calculates days left until expiry
- Applied color coding: Red for expired, Yellow for ≤7 days, Green for active
- Each member row now displays warning colors based on expiry status
- Integrated into member table rows using className binding

**Acceptance Criteria:**
- [x] Members with <7 days show yellow warning
- [x] Expired members show red
- [x] Active members show green

---

### 11. Tính năng Check-in hội viên
**Priority:** ⭐⭐⭐ HIGH
**Status:** Not Started
**Files Affected:**
- `gym-management/src/pages/Dashboard/Dashboard.jsx` - Add check-in widget
- `gym-management/src/services/memberService.js` - checkInMember()

**Solution:**
```javascript
// memberService.js
export async function checkInMember(memberCode, staffId) {
  // Find member by code
  const { data: member, error } = await supabase
    .from('members')
    .select('*')
    .eq('code', memberCode)
    .is('deleted_at', null)
    .single();
  
  if (error || !member) {
    throw new Error('Không tìm thấy hội viên với mã này');
  }
  
  const today = new Date();
  const endDate = new Date(member.end_date);
  
  if (endDate < today) {
    throw new Error('Hội viên đã hết hạn tập');
  }
  
  // Log check-in
  await staffLogService.logAction(staffId, 'Check-in', memberCode, {
    member_id: member.id,
    member_name: member.name
  });
  
  return member;
}

// Dashboard.jsx - Add check-in widget
const [checkInCode, setCheckInCode] = useState('');
const [checkInResult, setCheckInResult] = useState(null);

const handleCheckIn = async () => {
  try {
    const member = await memberService.checkInMember(checkInCode, staffId);
    setCheckInResult({ success: true, member });
    setCheckInCode('');
  } catch (error) {
    setCheckInResult({ success: false, error: error.message });
  }
};
```

**Acceptance Criteria:**
- [ ] Dashboard has check-in input field
- [ ] Enter member code → shows success/error
- [ ] Expired members cannot check-in
- [ ] Check-in is logged in staff_logs

---

### 12. Lọc báo cáo theo khoảng thời gian
**Priority:** ⭐⭐⭐ MEDIUM
**Status:** Not Started
**Files Affected:**
- `gym-management/src/pages/Dashboard/Dashboard.jsx` - Add date filters

**Solution:**
```javascript
// Dashboard.jsx
const [dateRange, setDateRange] = useState('today'); // today, week, month
const [customStart, setCustomStart] = useState('');
const [customEnd, setCustomEnd] = useState('');

const getDateRange = () => {
  const today = new Date();
  switch (dateRange) {
    case 'today':
      return { start: today, end: today };
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      return { start: weekStart, end: today };
    case 'month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: monthStart, end: today };
    case 'custom':
      return { start: new Date(customStart), end: new Date(customEnd) };
    default:
      return { start: today, end: today };
  }
};

// Update revenue calculations to use date range
const { start, end } = getDateRange();
const revenue = await paymentService.getTotalMemberRevenue(start, end);
```

**Acceptance Criteria:**
- [ ] Dashboard has date range selector (Today/Week/Month/Custom)
- [ ] Revenue metrics update based on selected range
- [ ] Custom date picker for specific periods

---

## 🔵 PHASE 3: OPTIMIZATION & ADVANCED FEATURES (Week 3+)

### 13. Thông báo Real-time
**Priority:** ⭐⭐⭐ MEDIUM
**Status:** Not Started
**Files Affected:**
- `gym-management/src/pages/Dashboard/Dashboard.jsx` - Add subscriptions

**Solution:**
```javascript
// Dashboard.jsx
useEffect(() => {
  // Subscribe to payment_logs changes
  const subscription = supabase
    .channel('payment_changes')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'payment_logs',
      filter: 'payment_method=eq.CK'
    }, (payload) => {
      // Show notification for new CK payment
      showNotification('Có thanh toán chuyển khoản mới cần duyệt');
      // Refresh pending payments count
      loadPendingPayments();
    })
    .subscribe();
  
  return () => subscription.unsubscribe();
}, []);
```

**Acceptance Criteria:**
- [ ] New CK payments trigger real-time notifications
- [ ] Dashboard updates without refresh
- [ ] Pending payment count updates live

---

### 14. Xuất Excel báo cáo
**Priority:** ⭐⭐⭐ LOW
**Status:** Not Started
**Files Affected:**
- `gym-management/src/pages/Dashboard/Dashboard.jsx` - Add export button
- Install `xlsx` library

**Solution:**
```javascript
// Install: npm install xlsx
import * as XLSX from 'xlsx';

const exportToExcel = async () => {
  // Get data
  const members = await memberService.getAllMembers();
  const payments = await paymentService.getAllPayments();
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Members sheet
  const membersWS = XLSX.utils.json_to_sheet(members);
  XLSX.utils.book_append_sheet(wb, membersWS, 'Hội viên');
  
  // Payments sheet
  const paymentsWS = XLSX.utils.json_to_sheet(payments);
  XLSX.utils.book_append_sheet(wb, paymentsWS, 'Thanh toán');
  
  // Save file
  XLSX.writeFile(wb, `BaoCao_${new Date().toISOString().split('T')[0]}.xlsx`);
};
```

**Acceptance Criteria:**
- [ ] Export button on Dashboard
- [ ] Excel file contains members and payments data
- [ ] File named with current date

---

### 15. In biên lai
**Priority:** ⭐⭐⭐ LOW
**Status:** Not Started
**Files Affected:**
- `gym-management/src/pages/Members/Members.jsx` - Add print button
- Install `react-to-print` or similar

**Solution:**
```javascript
// Install: npm install react-to-print
import { useReactToPrint } from 'react-to-print';

const ReceiptComponent = ({ payment }) => (
  <div className="receipt">
    <h2>BIÊN LAI THANH TOÁN</h2>
    <p>Mã hội viên: {payment.member_code}</p>
    <p>Tên: {payment.member_name}</p>
    <p>Số tiền: {payment.amount.toLocaleString()} VND</p>
    <p>Ngày: {new Date(payment.created_at).toLocaleDateString('vi-VN')}</p>
  </div>
);

const handlePrint = useReactToPrint({
  content: () => receiptRef.current,
});
```

**Acceptance Criteria:**
- [ ] Print receipt button after payment
- [ ] Receipt shows member info and payment details
- [ ] Works with thermal printers

---

## 📊 IMPLEMENTATION TIMELINE

```
Week 1 (CRITICAL): ✅ COMPLETED
├─ RLS Policies + Transaction Functions ✅
├─ Payment Verification Fix + Date Validation ✅
├─ Staff Type Defaults + Soft Deletes ✅
├─ Null Checks + Toast Notifications ✅
└─ Testing & Review ✅

Week 2 (FEATURES): 🟡 IN PROGRESS
├─ Mon-Tue: Check-in + Member Warnings ✅ COMPLETED
├─ Wed: Shift Handover Calculation ✅ COMPLETED
├─ Thu: Date Range Filtering ⏳ NEXT
└─ Fri: Real-time Notifications

Week 3+ (ADVANCED):
├─ Excel Export
├─ Print Receipts
├─ Performance Optimization
└─ Code Cleanup
```

---

## ✅ TESTING CHECKLIST

### Phase 1 Critical Tests
- [ ] RLS: Staff cannot view other staff's logs
- [ ] Transactions: Failed sales don't decrement stock
- [ ] Race condition: Cannot verify payment twice
- [ ] Date validation: Cannot create past-dated members
- [ ] Soft deletes: Deleted records still exist

### Phase 2 Feature Tests
- [x] Shift handover: Shows correct cash calculation ✅ COMPLETED
- [x] Member warnings: <7 days show yellow ✅ COMPLETED
- [ ] Check-in: Valid code shows success, invalid shows error
- [ ] Date filtering: Revenue updates by selected range

### Phase 3 Advanced Tests
- [ ] Real-time: New payments trigger notifications
- [ ] Excel export: File contains correct data
- [ ] Print receipts: Receipt shows correct info
</content>
<parameter name="filePath">d:\GymManagement\unifiedTodo.md
