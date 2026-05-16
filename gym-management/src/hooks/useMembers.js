import { useCallback, useEffect, useState } from 'react';
import { memberService } from '../services/memberService';

export function useMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await memberService.getAllMembers();
      setMembers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const addMember = async (member) => {
    try {
      const newMember = await memberService.createMember(member);
      await fetchMembers(); // Refresh from view to ensure all calculated fields are present
      return newMember;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateMember = async (id, updates) => {
    try {
      const updated = await memberService.updateMember(id, updates);
      await fetchMembers(); // Refresh from view
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteMember = async (id) => {
    try {
      await memberService.deleteMember(id);
      await fetchMembers(); // Refresh from view
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const suspendMember = async (id, staffId, shiftId) => {
    try {
      await memberService.suspendMember(id, staffId, shiftId);
      await fetchMembers();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const reactivateMember = async (id, staffId, shiftId) => {
    try {
      await memberService.reactivateMember(id, staffId, shiftId);
      await fetchMembers();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return { members, loading, error, fetchMembers, addMember, updateMember, deleteMember, suspendMember, reactivateMember };
}
