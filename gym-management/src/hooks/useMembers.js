import { useState, useEffect } from 'react';
import { memberService } from '../services/memberService';

export function useMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await memberService.getAllMembers();
      setMembers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addMember = async (member) => {
    try {
      const newMember = await memberService.createMember(member);
      setMembers([...members, newMember]);
      return newMember;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateMember = async (id, updates) => {
    try {
      const updated = await memberService.updateMember(id, updates);
      setMembers(members.map((m) => (m.id === id ? updated : m)));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteMember = async (id) => {
    try {
      await memberService.deleteMember(id);
      setMembers(members.filter((m) => m.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return { members, loading, error, fetchMembers, addMember, updateMember, deleteMember };
}
