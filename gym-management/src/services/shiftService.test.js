import { describe, expect, it } from 'vitest';
import { validateShiftTime } from './shiftService';

const at = (h, m = 0) => new Date(2026, 9, 29, h, m);

describe('validateShiftTime', () => {
  it('cho mở trong khung giờ và sớm tối đa 10 phút', () => {
    expect(() => validateShiftTime('Ca 1', false, at(5, 30))).not.toThrow();
    expect(() => validateShiftTime('Ca 1', false, at(4, 50))).not.toThrow();
    expect(() => validateShiftTime('Ca 3', false, at(16, 0))).not.toThrow();
  });
  it('chặn ngoài khung giờ', () => {
    expect(() => validateShiftTime('Ca 1', false, at(4, 49))).toThrow('Không thể mở Ca 1');
    expect(() => validateShiftTime('Ca 5', false, at(22, 1))).toThrow('Không thể mở Ca 5');
  });
  it('admin được bỏ qua kiểm tra giờ', () => {
    expect(() => validateShiftTime('Ca 1', true, at(23, 0))).not.toThrow();
  });
});
